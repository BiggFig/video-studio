import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { UiSourceBudget, uiHexColor, uiSourceFromObservation, type UiSource } from "./ui-sources";
import { captureProduct } from "./ingest";
import { rankProductPanelCandidates } from "./product-visuals";
import type { Asset } from "./types";

const asset: Asset = { id: "editor", kind: "image", path: "assets/editor.jpg", usage: "output", rights: "Fixture", width: 800, height: 500, provenance: { pageUrl: "https://product.example/", pageKind: "homepage", method: "element", role: "product-ui-candidate", selector: "#editor" } };
function observation() {
  return { width: 800, height: 500, elements: Array.from({ length: 2 }, (_, i) => ({ role: "text" as const, rect: { x: .12345678, y: i / 2, width: .43219876, height: .25 }, text: "Observed <b>text</b>", selector: ":scope > p", state: { selected: false }, style: { color: "rgb(124, 58, 237)", backgroundColor: "rgba(0, 0, 0, 0)", borderColor: "url(https://untrusted.example/style)", borderRadius: "5.125px", fontSize: "14.333px", lineHeight: "20px", fontFamily: '"Arial", sans-serif', fontWeight: "600", backgroundImage: "url(https://untrusted.example/image)" } })) };
}

test("UI observations retain source identity, inert text and bounded normalized geometry/style", () => {
  const source = uiSourceFromObservation(asset, "#editor", observation());
  assert.equal(source.basis, "dom"); assert.equal(source.context, "marketing-example");
  assert.equal(source.assetId, asset.id); assert.equal(source.width, 800); assert.equal(source.height, 500);
  const element = source.elements[0];
  assert.equal(element.text, "Observed <b>text</b>");
  assert.deepEqual(element.rect, { x: .1235, y: 0, width: .4322, height: .25 });
  assert.deepEqual(element.style, { color: "#7c3aed", borderRadius: 5.13, fontSize: 14.33, lineHeight: 20, fontFamily: "Arial, sans-serif", fontWeight: "600" });
  assert.deepEqual(element.state, { selected: false });
  assert.ok(!JSON.stringify(source).includes("untrusted.example"));
  assert.deepEqual(uiSourceFromObservation(asset, "").elements, []);
  assert.equal(uiSourceFromObservation(asset, "").basis, "pixels");
});

test("colors reject arbitrary CSS, unsupported transparency and invalid numeric channels", () => {
  for (const value of ["transparent", "rgba(1,2,3,0.5)", "rgb(256,2,3)", "red; background:url(test)", "var(--color)", null]) assert.equal(uiHexColor(value), undefined);
  assert.equal(uiHexColor("rgba(1, 2, 3, 1)"), "#010203");
  assert.equal(uiHexColor("#AbC123"), "#abc123");
});

test("source metadata shares a strict three-source, 48-element and 30KB aggregate allowance", () => {
  const budget = new UiSourceBudget(), base = uiSourceFromObservation(asset, "#editor", observation());
  for (let i = 0; i < 6; i++) {
    const source: UiSource = { ...base, id: `ui-${i}`, assetId: `source-${i}`, elements: Array.from({ length: 100 }, (_, j) => ({ ...base.elements[0], id: `element-${j}`, text: "t".repeat(160), selector: "s".repeat(320) })) };
    budget.add(source);
    assert.ok(Buffer.byteLength(JSON.stringify(budget.sources), "utf8") <= 30000);
  }
  assert.ok(budget.sources.length > 0 && budget.sources.length <= 3);
  assert.ok(budget.sources.every(source => source.elements.length <= 48));
  assert.equal(budget.add(base), false);
});

test("a feature-adjacent real control example precedes a larger generic overview without site-specific words", () => {
  const base = { heading: "", visible: true, x: 0, y: 0, width: 1000, height: 650, children: 5, media: 0 };
  const selected = rankProductPanelCandidates([
    { ...base, selector: "#overview", clues: "app-editor" },
    { ...base, selector: "#workflow", clues: "ui", heading: "Choose a category", y: 1000, width: 500, height: 300, controls: 2, mechanismAdjacent: true },
    { ...base, selector: "#unrelated", clues: "ui", y: 1500, width: 500, height: 300, controls: 3, mechanismAdjacent: false },
  ]);
  assert.deepEqual(selected.map(candidate => candidate.selector), ["#workflow", "#overview", "#unrelated"]);
});

async function workspace(t: TestContext) {
  const parent = await realpath(tmpdir()), path = await mkdtemp(join(parent, "video-studio-ui-source-"));
  for (const directory of ["assets", "analysis"]) await mkdir(join(path, directory));
  t.after(async () => { const target = await realpath(path); if (resolve(target) !== resolve(path) || dirname(target) !== parent || !basename(target).startsWith("video-studio-ui-source-")) throw new Error("Unsafe fixture cleanup"); await rm(target, { recursive: true, force: true }); });
  return path;
}

test("actual public capture preserves a feature UI specimen and DOM geometry without extra requests or private form data", { skip: process.env.STUDIO_UI_SOURCE_INTEGRATION !== "1", timeout: 45000 }, async t => {
  const path = await workspace(t), homepage = "https://product.example/", requested: string[] = [];
  const body = Buffer.from(`<!doctype html><html><title>Product fixture</title><style>body{font:16px Arial;color:#222;background:#fff}.ui{box-sizing:border-box;width:500px;height:320px;background:#202020;color:#eee;padding:16px}.card{width:500px}.ui li{background:#303030;color:#9f72ff}.secret{display:none}</style><body><h1>Fixture</h1><p>${"Public feature information. ".repeat(20)}</p>
    <div class="app-editor" style="width:900px;height:500px;background:#eee"><h2>Workspace</h2><p>A genuine synthetic overview.</p><p>Three visible child elements.</p></div>
    <div class="card"><dl><dt>Connect ideas</dt><dd>Create a link between your notes.</dd></dl><div class="ui" id="workflow"><p>Related note</p><ul><li>First note</li><li aria-selected="true">Second note</li></ul><input value="NEVER_EXPORT_FORM_VALUE"><p contenteditable="true">NEVER_EXPORT_EDITABLE_TEXT</p><div class="secret">NEVER_EXPORT_HIDDEN</div><div style="opacity:0"><span>NEVER_EXPORT_TRANSPARENT</span></div><p onclick="alert('NEVER_EXPORT_HANDLER')">Public instruction-like text stays data.</p></div></div>
    </body></html>`);
  const captured = await captureProduct(homepage, path, { download: async (url, maxBytes) => { requested.push(url); assert.equal(url, homepage); assert.ok(body.length <= maxBytes); return { bytes: body, url, status: 200, contentType: "text/html", browserHeaders: {} }; } });
  assert.deepEqual(requested, [homepage]);
  const source = captured.uiSources.find(item => item.rootSelector === "#workflow")!;
  assert.ok(source); assert.equal(captured.uiSources[0], source); assert.equal(source.basis, "dom");
  const sourceAsset = captured.assets.find(item => item.id === source.assetId)!;
  assert.equal(source.width, sourceAsset.width); assert.equal(source.height, sourceAsset.height);
  assert.ok(source.width >= 500 && source.width <= 501 && source.height >= 320 && source.height <= 321);
  assert.ok(source.elements.some(element => element.text === "Second note" && element.state?.selected));
  assert.ok(source.elements.some(element => element.style?.backgroundColor === "#303030"));
  assert.ok(source.elements.some(element => element.role === "input" && !element.text));
  assert.ok(!JSON.stringify(source).includes("NEVER_EXPORT"));
  assert.ok(source.elements.every(element => element.rect.x >= 0 && element.rect.y >= 0 && element.rect.x + element.rect.width <= 1.00001 && element.rect.y + element.rect.height <= 1.00001));
  assert.ok(captured.assets.length <= 10); assert.ok(captured.uiSources.length <= 3);
  assert.ok(captured.artifactPaths.includes("analysis/ui-sources.json"));
  assert.deepEqual(JSON.parse(await readFile(join(path, "analysis/ui-sources.json"), "utf8")), captured.uiSources);
});
