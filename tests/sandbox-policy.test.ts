import test from "node:test";
import assert from "node:assert/strict";
import { BlockList, isIP } from "node:net";
import { workerNetworkPolicy } from "../lib/server/sandbox-policy";
import { publicAddress, safeDestination } from "../worker/security";

test("Sandbox policy uses supported IPv4 CIDRs and retains private-network denials", () => {
  const policy = workerNetworkPolicy(), denied = new BlockList();
  assert.deepEqual(policy.allow, ["*"]);
  for (const cidr of policy.subnets.deny) {
    const [address, prefix] = cidr.split("/");
    assert.equal(isIP(address), 4, "The Sandbox allocation API rejects IPv6 CIDRs");
    assert.ok(Number.isInteger(Number(prefix)) && Number(prefix) >= 0 && Number(prefix) <= 32);
    denied.addSubnet(address, Number(prefix), "ipv4");
  }
  for (const address of ["0.1.2.3", "10.0.0.1", "100.64.0.1", "100.127.255.254", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.254", "192.168.1.1", "224.0.0.1", "239.255.255.254"]) {
    assert.equal(denied.check(address, "ipv4"), true, `${address} must remain blocked`);
  }
  for (const address of ["1.1.1.1", "8.8.8.8"]) assert.equal(denied.check(address, "ipv4"), false);
});

test("application SSRF protection still rejects private IPv6 without making network requests", async () => {
  for (const address of ["::", "::1", "fc00::1234", "fd00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254"]) {
    assert.equal(publicAddress(address), false);
    await assert.rejects(safeDestination(`https://[${address}]/`), /restricted network/);
  }
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
});
