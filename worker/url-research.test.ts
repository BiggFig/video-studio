import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { researchDestination, selectResearchLinks } from "./url-research";
import { safeDownload } from "./security";
import { captureProduct, CaptureDownloadBudget } from "./ingest";

const homepage = "https://product.example/";
test("research selects observed pricing and feature links deterministically, not invented URLs", () => {
  const anchors = [{ href: "/features/team", text: "Team features" }, { href: "/pricing", text: "Pricing" }, { href: "/product", text: "Product" }, { href: "/legal", text: "Privacy" }];
  assert.deepEqual(selectResearchLinks(homepage, anchors).map(link => link.url), ["https://product.example/pricing", "https://product.example/features/team"]);
  assert.deepEqual(selectResearchLinks(homepage, [...anchors].reverse()), selectResearchLinks(homepage, anchors));
  assert.deepEqual(selectResearchLinks(homepage, [{ href: "/legal", text: "Privacy" }]), []);
});

test("same-origin policy rejects credentials, queries, other protocols/origins and unsafe paths", () => {
  for (const href of ["https://other.example/pricing", "//other.example/features", "http://product.example/pricing", "https://user:pass@product.example/pricing", "/pricing?", "/pricing?plan=pro", "javascript:alert(1)", "data:text/html,pricing", "https://product.example:8443/pricing", "/account/features", "/auth/pricing", "/checkout", "/download/product", "/api/features", "/log-in", "/sign_up", "/billing/plans", "/%61ccount/pricing", "/%2561pi/features", "/features%2f..%2faccount", "/features;logout", "/pricing.pdf", "/product.zip", "/features\\account"]) {
    assert.equal(researchDestination(href, homepage), null, href);
    assert.deepEqual(selectResearchLinks(homepage, [{ href, text: "Product pricing features" }]), [], href);
  }
  for (const home of ["http://127.0.0.1/", "http://localhost/", "http://private.internal/", "http://[::1]/"]) assert.equal(researchDestination("/pricing", home), null);
  for (const href of ["/log/out", "/sign/in", "/user/plans", "/console/pricing", "/subscribe/pro"]) assert.equal(researchDestination(href, homepage), null);
  assert.equal(researchDestination("/features/accounting", homepage), "https://product.example/features/accounting");
});

test("fragment and trailing-slash duplicates, homepage links and download anchors do not consume slots", () => {
  const result = selectResearchLinks(homepage, [{ href: "/#features", text: "Features" }, { href: "/pricing#annual", text: "Pricing" }, { href: "/pricing#monthly", text: "Plans" }, { href: "/pricing/", text: "Pricing" }, { href: "/feature-file", text: "Features", download: true }, { href: "/features", text: "Features", index: 5 }, { href: "/platform", text: "Platform" }]);
  assert.deepEqual(result.map(link => link.url), ["https://product.example/pricing", "https://product.example/features"]);
  assert.equal(result[1].anchorIndex, 5);
});

test("research discovery is limited to two selected pages and 300 observed anchors", () => {
  const anchors = Array.from({ length: 310 }, (_, i) => ({ href: `/features/${i}`, text: i < 300 ? "Legal notice" : "Features" }));
  assert.deepEqual(selectResearchLinks(homepage, anchors), []);
  assert.equal(selectResearchLinks(homepage, Array.from({ length: 20 }, (_, i) => ({ href: `/features/${i}`, text: "Features" }))).length, 2);
});

test("research destination predicate stops forbidden redirects before a second HTTP request", async t => {
  const origin = "https://93.184.216.34/";
  let redirect = "/account", calls = 0;
  t.mock.method(https, "request", ((_url: URL, _options: unknown, callback: (response: IncomingMessage) => void) => {
    calls++;
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => { const response = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> }; response.statusCode = 302; response.headers = { location: redirect }; callback(response as unknown as IncomingMessage); response.end(); };
    return request;
  }) as typeof https.request);
  const policy = (url: URL) => !!researchDestination(url.href, origin);
  for (redirect of ["https://external.example/pricing", "/auth/signin", "/checkout", "/pricing?buy=1"]) {
    calls = 0;
    await assert.rejects(safeDownload(origin + "pricing", 1000, undefined, 0, policy), /outside the permitted public origin or paths/);
    assert.equal(calls, 1, redirect);
  }
  calls = 0;
  await assert.rejects(safeDownload(origin + "api/features", 1000, undefined, 0, policy), /outside the permitted public origin or paths/);
  assert.equal(calls, 0);
  await assert.rejects(safeDownload("http://127.0.0.1/pricing", 1000, undefined, 0, () => true), /not a public website|restricted network/);
  assert.equal(calls, 0, "An accepting extra predicate cannot bypass the existing public-IP guard");
});

const integration = process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION === "1";
test("actual Chromium research shares the homepage byte budget, retains homepage on optional failure, and persists provenance", { skip: !integration, timeout: 45000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-research-"));
  for (const directory of ["assets", "analysis"]) await mkdir(join(workspace, directory));
  const requests: string[] = [], reservations: number[] = [];
  const html = (title: string, body: string) => Buffer.from(`<!doctype html><title>${title}</title><body><h1>${title}</h1><p>${body}</p></body>`);
  const home = html("Fixture product", `<a href='/pricing'>Pricing</a> <a href='/features'>Features</a> <a href='/account'>Account</a> ${"A real public product description. ".repeat(20)}`);
  const pricing = html("Fixture pricing", "This source offers a public monthly plan for its product. ".repeat(40));
  const bytesAllowed = home.length + pricing.length;
  const result = await captureProduct(homepage, workspace, { downloadBudget: new CaptureDownloadBudget(bytesAllowed, bytesAllowed, 1), download: async (raw, maxBytes, _auth, _redirect, policy) => {
    requests.push(raw); reservations.push(maxBytes);
    if (policy && !policy(new URL(raw))) throw new Error("Blocked research document");
    const bytes = raw === homepage ? home : raw === homepage + "pricing" ? pricing : (() => { throw new Error("Unexpected or over-budget fixture request"); })();
    return { bytes, url: raw, status: 200, contentType: "text/html", browserHeaders: {} };
  } });
  assert.equal(result.url, homepage);
  assert.ok(result.text.includes("Fixture product") && result.text.includes("Fixture pricing"));
  assert.ok(result.text.length <= 45000);
  assert.ok(result.assets.some(asset => asset.id === "capture-0"));
  assert.equal(result.assets.filter(asset => asset.id.startsWith("research-page-")).length, 1);
  assert.ok(result.artifactPaths.includes("analysis/research-sources.json"));
  assert.deepEqual(requests, [homepage, homepage + "pricing"]);
  assert.deepEqual(reservations, [bytesAllowed, pricing.length]);
  const manifest = JSON.parse(await readFile(join(workspace, "analysis/research-sources.json"), "utf8"));
  assert.equal(manifest.sources[1].status, "captured");
  assert.equal(manifest.sources[1].url, homepage + "pricing");
  assert.equal(manifest.sources[2].status, "failed");
});

test("actual Chromium followups cap combined text and capture only the two observed pages", { skip: !integration, timeout: 45000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-research-bounds-"));
  for (const directory of ["assets", "analysis"]) await mkdir(join(workspace, directory));
  const requests: string[] = [];
  const result = await captureProduct(homepage, workspace, { download: async (raw, maxBytes, _auth, _redirect, policy) => {
    if (policy && !policy(new URL(raw))) throw new Error("Blocked research document");
    requests.push(raw);
    assert.ok([homepage, homepage + "pricing", homepage + "features"].includes(raw));
    const body = Buffer.from(`<!doctype html><title>Public ${new URL(raw).pathname}</title><body><a href='/pricing'>Pricing</a><a href='/features'>Features</a><a href='/product'>Product</a><a href='https://external.example/features'>Features</a><p>${"Actual accessible product information. ".repeat(1500)}</p></body>`);
    assert.ok(body.length <= maxBytes);
    return { bytes: body, url: raw, status: 200, contentType: "text/html", browserHeaders: {} };
  } });
  assert.deepEqual(requests, [homepage, homepage + "pricing", homepage + "features"]);
  assert.equal(result.url, homepage);
  assert.equal(result.text.length, 45000);
  assert.equal(result.assets.filter(asset => asset.id.startsWith("research-page-")).length, 2);
  const manifest = JSON.parse(await readFile(join(workspace, "analysis/research-sources.json"), "utf8"));
  assert.equal(manifest.sources.length, 3);
  for (const source of manifest.sources.slice(1)) {
    assert.equal(source.status, "captured");
    assert.ok(source.textCharacters <= 7500);
    assert.equal(source.discoveredOn, homepage);
    assert.ok(result.artifactPaths.includes(source.textPath) && result.artifactPaths.includes(source.imagePath));
  }
});
