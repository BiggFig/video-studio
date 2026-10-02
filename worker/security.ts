import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { resolve, relative, isAbsolute } from "node:path";
import { PipelineError } from "./types";

export function publicAddress(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(value) === 4) {
    const [a,b] = value.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  // Only globally routable unicast IPv6. This excludes mapped IPv4, link-local,
  // multicast, unique-local, loopback, translation prefixes and unspecified.
  const specialV6=value.startsWith("2001:")&&parseInt(value.split(":")[1]||"0",16)<0x200;
  return isIP(value) === 6 && /^[23]/.test(value) && !specialV6 && !value.startsWith("2001:db8") && !value.startsWith("2002:") && !value.startsWith("3fff:");
}
export function safePath(root: string, value: string): string {
  if (!value || value.includes("\0") || value.includes("\\") || /^[a-z]:/i.test(value) || isAbsolute(value)) throw new Error("Unsafe artifact path");
  const path = resolve(root, value), rel = relative(root, path);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Artifact path escapes workspace");
  return path;
}
export async function safeDestination(raw: string): Promise<{ url: URL; address: string; family: number }> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new PipelineError("invalid_url", "This URL is not valid.", "Enter a public HTTPS product URL.", "needs_input"); }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port)) || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new PipelineError("unsafe_url", "This destination is not a public website.", "Use a public product URL or upload assets.", "needs_input");
  const addresses = isIP(hostname) ? [{address: hostname, family: isIP(hostname)}] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new PipelineError("unsafe_url", "The URL resolves to a restricted network.", "Use a public product URL or upload assets.", "needs_input");
  return { url, ...addresses[0] };
}
export async function safeDownload(raw: string, maxBytes: number, auth?: { origin: string; token: string }, redirect = 0, allowDestination?: (url: URL) => boolean): Promise<{ bytes: Buffer; contentType: string; url: string; status: number; browserHeaders:Record<string,string> }> {
  if (redirect > 5) throw new PipelineError("redirect_limit", "The source redirects too many times.", "Use its final public URL.", "needs_input");
  if (allowDestination && !allowDestination(new URL(raw))) throw new PipelineError("unsafe_url", "The research destination is outside the permitted public origin or paths.", "Use the accessible public product source.", "needs_input");
  const {url,address,family} = await safeDestination(raw);
  const response = await new Promise<{ status: number; location?: string; contentType: string; bytes: Buffer;browserHeaders:Record<string,string> }>((done, reject) => {
    // Pin the validated address to the connection, closing the DNS-rebinding gap.
    const request = (url.protocol === "https:" ? https : http).request(url, { method: "GET", family, lookup: (_host, options, callback) => options.all ? callback(null,[{address,family}]) : callback(null, address, family), headers: { "User-Agent": "VideoStudio/1.0 (+public-product-capture)", "Accept-Encoding": "identity", ...(auth && url.origin === auth.origin ? { Authorization: `Bearer ${auth.token}` } : {}) }, timeout: 30_000 }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) { res.resume(); done({status:res.statusCode,location:res.headers.location,contentType:"",bytes:Buffer.alloc(0),browserHeaders:{}}); return; }
      if (Number(res.headers["content-length"] || 0) > maxBytes) { res.destroy(); reject(new Error("Source exceeds download limit")); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", chunk => { size += chunk.length; if (size > maxBytes) { res.destroy(new Error("Source exceeds download limit")); } else chunks.push(chunk); });
      const browserHeaders:Record<string,string>={};for(const name of ["access-control-allow-origin","access-control-allow-credentials","cross-origin-resource-policy"])if(typeof res.headers[name]==="string")browserHeaders[name]=res.headers[name] as string;
      res.on("error", reject); res.on("end", () => done({status:res.statusCode || 0,contentType:String(res.headers["content-type"] || "application/octet-stream"),bytes:Buffer.concat(chunks),browserHeaders}));
    });
    request.on("timeout", () => request.destroy(new Error("Source request timed out"))); request.on("error", reject); request.end();
  });
  if (response.location) return safeDownload(new URL(response.location,url).href,maxBytes,auth,redirect+1,allowDestination);
  if (response.status < 200 || response.status >= 300) throw new PipelineError("source_unreachable", "The source could not be retrieved.", "Check that the URL is public, or upload the file directly.", "needs_input");
  return {...response,url:url.href};
}
