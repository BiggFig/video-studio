import test from "node:test";
import assert from "node:assert/strict";
import { rankLogoCandidates, type LogoCandidate } from "./brand-evidence";

const logo = (values: Partial<LogoCandidate> = {}): LogoCandidate => ({ selector: "header > svg", label: "Product", clues: "brand-logo",
  width: 160, height: 40, visible: true, inNavigation: true, linksHome: true, ...values });
test("logo discovery prefers genuine visible home/navigation marks and excludes unrelated content", () => {
  const candidates = [logo({ selector: "footer > img", url: "https://example.com/logo.png", linksHome: false }), logo(),
    logo({ selector: "#customer-logo", inNavigation: false, linksHome: false }), logo({ visible: false }),
    logo({ clues: "social-icon" }), logo({ width: 2 }), logo({ height: 1000 })];
  assert.deepEqual(rankLogoCandidates(candidates).map(value => value.selector), ["header > svg", "footer > img"]);
});
test("logo discovery bounds candidates and deduplicates repeated source images", () => {
  const duplicate = "https://example.com/logo.svg";
  assert.equal(rankLogoCandidates([logo({ url: duplicate }), logo({ selector: "#same-logo", url: duplicate })]).length, 1);
  assert.equal(rankLogoCandidates(Array.from({ length: 12 }, (_, i) => logo({ selector: `#logo-${i}` }))).length, 4);
});
