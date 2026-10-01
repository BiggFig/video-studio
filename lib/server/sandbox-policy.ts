import type { NetworkPolicy } from "@vercel/sandbox";

export function workerNetworkPolicy() {
  // Sandbox rejects IPv6 CIDRs at allocation. The worker separately rejects
  // private IPv6 destinations, validates redirects and pins validated DNS results.
  return {
    allow: ["*"],
    subnets: { deny: [
      "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
      "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4",
    ] },
  } satisfies NetworkPolicy;
}
