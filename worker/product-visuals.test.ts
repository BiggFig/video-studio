import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Page } from "playwright";
import { extractProductVisuals, rankProductImageCandidates, rankProductPanelCandidates, type ProductImageCandidate, type ProductPanelCandidate } from "./product-visuals";

function sample(overrides: Partial<ProductImageCandidate> = {}): ProductImageCandidate {
  return { url: "https://example.com/images/product-screenshot.png", selector: "main > img", alt: "Product workspace screenshot", classes: "hero", naturalWidth: 1600, naturalHeight: 1000, displayedWidth: 800, displayedHeight: 500, declaredWidth: 1600, declaredHeight: 1000, visible: true, ...overrides };
}
function pageWith(candidates: ProductImageCandidate[]): Page {
  return { locator: () => ({ evaluateAll: async () => candidates }), evaluate: async () => [] } as unknown as Page;
}

test("large product screenshots survive while logos, portraits, tiny embeds and hidden images do not", () => {
  const input = [sample(), sample({ url: "https://example.com/logo.png", alt: "Product logo" }), sample({ url: "https://example.com/team-portrait.png", alt: "Editor portrait" }), sample({ naturalWidth: 200, naturalHeight: 240, declaredWidth: 200, declaredHeight: 240 }), sample({ displayedWidth: 80, displayedHeight: 60 }), sample({ visible: false }), sample({ url: "https://example.com/stock-mountain.png", alt: "Mountain", classes: "hero" })];
  assert.deepEqual(rankProductImageCandidates(input).map((image) => image.url), [input[0].url]);
});
test("responsive portrait product screens are accepted and extreme strips/oversized rasters rejected", () => {
  assert.equal(rankProductImageCandidates([sample({ naturalWidth: 1080, naturalHeight: 1920, displayedWidth: 320, displayedHeight: 568 })]).length, 1);
  assert.equal(rankProductImageCandidates([sample({ naturalWidth: 8000, naturalHeight: 600 }), sample({ naturalWidth: 10000, naturalHeight: 10000 })]).length, 0);
});
test("candidate URLs are deduplicated, credentialed/data URLs omitted, and the candidate list capped", () => {
  assert.equal(rankProductImageCandidates([sample(), sample({ url: `${sample().url}#fragment` }), sample({ url: "https://user:pass@example.com/screenshot.png" }), sample({ url: "data:image/png;base64,not-a-public-image" })]).length, 1);
  assert.equal(rankProductImageCandidates(Array.from({ length: 40 }, (_, i) => sample({ url: `https://example.com/screenshot-${i}.png` }))).length, 12);
});
test("an internal image URL is denied before an injected downloader receives it", async () => {
  let downloads = 0;
  const workspace = await mkdtemp(join(tmpdir(),"video-studio-product-images-"));
  const result = await extractProductVisuals(pageWith([sample({ url: "http://127.0.0.1/screenshot.png" })]), workspace, "https://example.com", { download: async () => { downloads++; throw new Error("must never run"); } });
  assert.equal(downloads, 0);
  assert.equal(result.assets.length, 0);
  assert.match(result.diagnostics.sources[0].reason || "", /restricted network/);
});
test("failed candidates retain their byte reservation and stop further attempts when exhausted", async () => {
  const workspace = await mkdtemp(join(tmpdir(),"video-studio-product-image-limits-"));
  const candidates = Array.from({ length: 4 }, (_, i) => sample({ url: `http://127.0.0.1/screenshot-${i}.png` }));
  const result = await extractProductVisuals(pageWith(candidates), workspace, "https://example.com", { maxFileBytes: 100, maxTotalBytes: 150, download: async () => { throw new Error("must never run"); } });
  assert.equal(result.diagnostics.attempts, 2);
  assert.equal(result.diagnostics.reservedBytes, 150);
  assert.equal(result.assets.length, 0);
});

function panel(overrides: Partial<ProductPanelCandidate> = {}): ProductPanelCandidate {
  return { selector: "#editor", clues: "app-editor", heading: "A public editor demonstration", visible: true,
    x: 0, y: 0, width: 800, height: 500, children: 5, media: 0, ...overrides };
}
test("focused DOM candidates retain complete panels and suppress nested duplicates", () => {
  const result = rankProductPanelCandidates([panel(), panel({ selector: "#editor-inner", width: 700, height: 400, x: 20, y: 20 }),
    panel({ selector: "#graph", clues: "graph", x: 0, y: 800, width: 700, height: 400 })]);
  assert.deepEqual(result.map(p => p.selector), ["#editor", "#graph"]);
});
test("DOM candidates reject marketing/price text, hidden/tiny panels, page-size containers and unsupported visual hints", () => {
  for (const candidate of [panel({ clues: "pricing product-preview" }), panel({ clues: "logo app" }), panel({ clues: "hero" }),
    panel({ visible: false }), panel({ height: 80 }), panel({ height: 1800 }), panel({ children: 1, media: 0 })]) {
    assert.deepEqual(rankProductPanelCandidates([candidate]), [], candidate.clues);
  }
  assert.equal(rankProductPanelCandidates(Array.from({ length: 10 }, (_, i) => panel({ selector: `#panel-${i}`, y: i * 600 }))).length, 4);
});
