import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { captureUiSource, selectUiSourceElements, UiSourceBudget, uiHexColor, uiPaintBounds, uiSourceFromObservation, type UiSource } from "./ui-sources";
import { motionBrowserPath } from "./motion-browser";
import { captureProduct } from "./ingest";
import { rankProductPanelCandidates } from "./product-visuals";
import { literalPreviewCandidates } from "./literal-preview-candidates";
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

test("effective opaque background is a separately bounded source field, never a default for unknown paint", () => {
  const raw = observation(); raw.elements[0].style = { ...raw.elements[0].style, backgroundColor: "transparent", effectiveBackgroundColor: "#101010" } as typeof raw.elements[0]["style"];
  const first = uiSourceFromObservation(asset, "#editor", raw).elements[0];
  assert.equal(first.style!.backgroundColor, "transparent"); assert.equal(first.style!.effectiveBackgroundColor, "#101010");
  raw.elements[0].style = { ...raw.elements[0].style, effectiveBackgroundColor: "linear-gradient(white, black)" } as typeof raw.elements[0]["style"];
  assert.equal(uiSourceFromObservation(asset, "#editor", raw).elements[0].style!.effectiveBackgroundColor, undefined);
});

const paintLayer = (backgroundColor = "rgb(0, 0, 0)", backgroundImage = "none") => ({ backgroundColor, backgroundImage, opacity: "1", filter: "none", backdropFilter: "none", mixBlendMode: "normal" });
const faintGradient = "radial-gradient(100% 50% at 50% 0%, rgba(0, 163, 255, 0.13) 0%, rgba(0, 163, 255, 0) 50%, rgba(0, 163, 255, 0) 100%)";
test("observed alpha and gradient envelopes exclude inverted colors without certifying an exact gradient", () => {
  const constraints = uiPaintBounds("rgba(252, 253, 255, 0.937)", [paintLayer("rgb(0, 0, 0)", faintGradient)]);
  assert.deepEqual(constraints.colorBounds, { min: [235, 236, 237], max: [254, 255, 255] });
  assert.deepEqual(constraints.effectiveBackgroundColorBounds, { min: [0, 0, 0], max: [36, 36, 36] });
  const observationWithBounds = observation();
  Object.assign(observationWithBounds.elements[0], { paintBounds: constraints });
  Object.assign(observationWithBounds.elements[0].style, { color: "", effectiveBackgroundColor: "", backgroundColor: "transparent" });
  const style = uiSourceFromObservation(asset, "#editor", observationWithBounds).elements[0].style!;
  assert.equal(style.color, undefined); assert.equal(style.effectiveBackgroundColor, undefined);
  assert.deepEqual(style.colorBounds, constraints.colorBounds); assert.deepEqual(style.effectiveBackgroundColorBounds, constraints.effectiveBackgroundColorBounds);
  // An exact source color has precedence, even when extra metadata is present.
  observationWithBounds.elements[0].style.color = "rgb(1, 2, 3)";
  assert.equal(uiSourceFromObservation(asset, "#editor", observationWithBounds).elements[0].style!.colorBounds, undefined);
});

test("paint envelopes reject unsupported layers, stops, effects and unresolved backgrounds", () => {
  for (const image of ["linear-gradient(red, rgba(0, 0, 0, .1))", "linear-gradient(color(srgb 1 0 0 / .1), rgba(0, 0, 0, .1))", "url(https://example.com/image.png)", `${faintGradient}, ${faintGradient}`, "linear-gradient(rgba(0,0,0,9), rgba(0,0,0,0))"]) {
    assert.equal(uiPaintBounds("rgba(250,250,250,.9)", [paintLayer("rgb(0,0,0)", image)]).effectiveBackgroundColorBounds, undefined, image);
  }
  assert.equal(uiPaintBounds("rgb(255,255,255)", [paintLayer("rgba(0,0,0,0)", faintGradient)]).effectiveBackgroundColorBounds, undefined);
  for (const effect of [{ opacity: ".9" }, { filter: "invert(1)" }, { backdropFilter: "blur(1px)" }, { mixBlendMode: "screen" }, { maskImage: "linear-gradient(black,transparent)" }, { maskBorderSource: "url(mask.png)" }, { clipPath: "circle(10px)" }, { pseudoPaint: true }]) assert.deepEqual(uiPaintBounds("rgba(250,250,250,.9)", [{ ...paintLayer(), ...effect }]), {});
  for (const effect of [{ backgroundClip: "text" }, { backgroundClip: "content-box" }, { coversRegion: false }, { boxShadow: "white 0 0 100px inset" }]) assert.equal(uiPaintBounds("rgba(250,250,250,.9)", [{ ...paintLayer(), ...effect }]).effectiveBackgroundColorBounds, undefined);
  assert.equal(uiPaintBounds("rgba(250,250,250,.9)", [{ ...paintLayer(), textFillColor: "rgb(0,0,0)" }]).colorBounds, undefined);
  assert.equal(uiPaintBounds("rgba(250,250,250,.9)", [paintLayer("rgb(0,0,0)", `linear-gradient(${"rgba(0,0,0,.1),".repeat(1000)}rgba(0,0,0,0))`)]).effectiveBackgroundColorBounds, undefined);
  assert.deepEqual(uiPaintBounds("rgba(250,250,250,.9)", [paintLayer()], false), {});
  assert.deepEqual(uiPaintBounds("rgba(250,250,250,.9)", Array(16).fill(paintLayer())), {});
});

test("layer envelopes contain composited RGB at all alpha and backdrop extremes", () => {
  const partial = paintLayer("rgba(120,80,200,.25)", "linear-gradient(rgba(0,0,0,.2), rgba(255,255,255,0))");
  const constraints = uiPaintBounds("rgba(12,34,56,.7)", [partial, paintLayer("rgb(220,230,240)", faintGradient)]);
  const bg = constraints.effectiveBackgroundColorBounds!, fg = constraints.colorBounds!;
  for (const alpha1 of [0, .13]) for (const alpha2 of [0, .2]) for (const hue1 of [0, 255]) for (const hue2 of [0, 255]) {
    const final = [220, 230, 240].map((base, i) => ((base * (1 - alpha1) + hue1 * alpha1) * .75 + [120, 80, 200][i] * .25) * (1 - alpha2) + hue2 * alpha2);
    assert.ok(final.every((value, i) => Math.round(value) >= bg.min[i] && Math.round(value) <= bg.max[i]));
    assert.ok(final.every((value, i) => { const composite = Math.round([12, 34, 56][i] * .7 + value * .3); return composite >= fg.min[i] && composite <= fg.max[i]; }));
  }
});

test("browser captures alpha-gradient constraints while exact paint stays unknown", { skip: process.env.STUDIO_UI_SOURCE_INTEGRATION !== "1", timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath: motionBrowserPath() }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }); await page.route("**/*", route => route.abort());
  await page.setContent(`<style>body{margin:0}#editor{width:1000px;height:650px;background:#000;color:#eee;padding:20px;box-sizing:border-box}.preview{width:500px;height:550px;background:#000;background-image:${faintGradient};color:rgba(252,253,255,.937)}h2{font:24px Arial}p{font:14px Arial}</style><section id="editor"><div class="preview"><h2>Observed heading</h2><p>Observed greeting</p></div></section>`);
  const source = await captureUiSource(page, { ...asset, width: 1000, height: 650 }, "#editor");
  for (const text of ["Observed heading", "Observed greeting"]) {
    const style = source.elements.find(element => element.text === text)!.style!;
    assert.equal(style.color, undefined); assert.equal(style.effectiveBackgroundColor, undefined); assert.equal(style.backgroundColor, "transparent");
    assert.ok(style.colorBounds!.min.every(value => value >= 230)); assert.ok(style.effectiveBackgroundColorBounds!.max.every(value => value < 50));
  }
  await page.addStyleTag({ content: '.preview{position:relative}.preview::before{content:"";position:absolute;inset:0;background:white}' });
  const overpainted = await captureUiSource(page, { ...asset, width: 1000, height: 650 }, "#editor");
  const overpaintedStyle = overpainted.elements.find(element => element.text === "Observed greeting")!.style!;
  assert.equal(overpaintedStyle.colorBounds, undefined); assert.equal(overpaintedStyle.effectiveBackgroundColorBounds, undefined);
});

test("browser color capture resolves supported modern colors and opaque ancestors without flattening alpha or gradients", { skip: process.env.STUDIO_UI_SOURCE_INTEGRATION !== "1", timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath: motionBrowserPath() }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }); await page.route("**/*", route => route.abort());
  await page.setContent(`<!doctype html><html><style>body{margin:0;background:#101010}#editor{width:1000px;height:800px;font:16px Arial}p{margin:8px;height:32px;color:color(srgb 1 1 1)}#hsl{color:hsl(120 100% 50%)}#ok{color:oklch(100% 0 0)}#alpha{color:rgb(255 255 255 / .99)}.gradient{background:linear-gradient(#123456,#654321)}.alpha{background:rgb(255 255 255 / .5)}.opacity{opacity:.8}.solid{background:#123456}</style><body><section id="editor"><p>Modern white</p><p id="hsl">HSL green</p><p id="ok">OKLCH white</p><p id="alpha">Partial foreground</p><div class="gradient"><p>Gradient unknown</p><div class="solid"><p>Opaque covering gradient</p></div></div><div class="alpha"><p>Partial backdrop unknown</p></div><div class="opacity"><p>Group opacity unknown</p></div><input value="NEVER_EXPORT"><div contenteditable>NEVER_EXPORT</div></section></body></html>`);
  const source = await captureUiSource(page, { ...asset, width: 1000, height: 800 }, "#editor");
  const style = (text: string) => { const element = source.elements.find(element => element.text === text); assert.ok(element, text); return element.style!; };
  assert.equal(style("Modern white").color, "#ffffff"); assert.equal(style("Modern white").backgroundColor, "transparent"); assert.equal(style("Modern white").effectiveBackgroundColor, "#101010");
  assert.equal(style("HSL green").color, "#00ff00"); assert.equal(style("OKLCH white").color, "#ffffff");
  assert.equal(style("Partial foreground").color, undefined); assert.equal(style("Gradient unknown").effectiveBackgroundColor, undefined);
  assert.equal(style("Opaque covering gradient").effectiveBackgroundColor, "#123456");
  assert.equal(style("Partial backdrop unknown").effectiveBackgroundColor, undefined); assert.equal(style("Group opacity unknown").effectiveBackgroundColor, undefined); assert.equal(style("Group opacity unknown").color, undefined);
  assert.doesNotMatch(JSON.stringify(source), /NEVER_EXPORT|linear-gradient/);
  const budget = new UiSourceBudget(); assert.equal(budget.add(source), true); assert.ok(Buffer.byteLength(JSON.stringify(budget.sources), "utf8") <= 30000); assert.ok(budget.sources[0].elements.length <= 48);
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

test("inventory deduplicates nested labels without losing their owner or identical labels elsewhere", () => {
  const rect = { x: .1, y: .1, width: .2, height: .1 };
  const elements: UiSource["elements"] = [
    { id: "nested-first", role: "text", rect, text: "Send", selector: ":scope > p > span" },
    { id: "owner-later", role: "text", rect, text: "Send", selector: ":scope > p" },
    { id: "button", role: "button", rect: { ...rect, y: .5 }, text: "Send", selector: ":scope > button" },
    { id: "button-label", role: "text", rect: { ...rect, y: .5 }, text: "Send", selector: ":scope > button > span" },
    { id: "different-place", role: "text", rect: { ...rect, x: .7 }, text: "Send", selector: ":scope > aside" },
  ];
  assert.deepEqual(new Set(selectUiSourceElements(elements, 48).map(element => element.id)), new Set(["owner-later", "button", "different-place"]));
});

test("element and byte caps retain later controls and spatial context instead of a dense text prefix", () => {
  const base = uiSourceFromObservation(asset, "#editor", observation());
  const textElements: UiSource["elements"] = Array.from({ length: 90 }, (_, index) => ({
    id: `token-${index}`, role: "text", text: `Code token ${index}: ` + "x".repeat(120),
    selector: ":scope > div > p:nth-of-type(" + (index + 1) + ")", style: base.elements[0].style,
    rect: { x: .02 + (index % 9) * .02, y: .02 + Math.floor(index / 9) * .02, width: .015, height: .015 },
  }));
  const source: UiSource = { ...base, elements: [...textElements,
    { id: "action", role: "button", text: "Send message", selector: ":scope > button", rect: { x: .75, y: .8, width: .2, height: .1 } },
    { id: "result", role: "text", text: "Delivery status", selector: ":scope > aside", rect: { x: .65, y: .45, width: .25, height: .1 } },
    { id: "input", role: "input", selector: ":scope > input", rect: { x: .45, y: .5, width: .15, height: .1 } },
  ] };
  const selected = selectUiSourceElements(source.elements, 48);
  assert.equal(selected.length, 48);
  assert.ok(["action", "result", "input"].every(id => selected.some(element => element.id === id)));
  const budget = new UiSourceBudget();
  assert.equal(budget.add(source), true);
  assert.ok(budget.sources[0].elements.length < 48, "fixture exercises the byte cap, not just the element cap");
  assert.ok(Buffer.byteLength(JSON.stringify(budget.sources[0]), "utf8") <= 9800);
  assert.ok(["action", "result", "input"].every(id => budget.sources[0].elements.some(element => element.id === id)));
  const observed = { width: 800, height: 500, elements: source.elements.map(element => ({ ...element, selector: element.selector || "", state: {}, style: {} })) };
  const sanitized = uiSourceFromObservation(asset, "#editor", observed);
  assert.equal(sanitized.elements.length, 48);
  assert.ok(sanitized.elements.some(element => element.text === "Send message"));
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

test("browser inventory samples past dense syntax descendants and keeps visible source geometry and privacy", { skip: process.env.STUDIO_UI_SOURCE_INTEGRATION !== "1", timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath: motionBrowserPath() });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route("**/*", route => route.abort());
  await page.setContent(`<!doctype html><html><style>
    body{margin:0;font:16px Arial}#editor{position:relative;width:1200px;height:720px;background:#fafafa}
    pre{position:absolute;left:20px;top:60px;width:520px;height:350px;overflow:hidden;white-space:pre-wrap;word-break:break-all;background:#eee}
    button{position:absolute;left:900px;top:590px;width:200px;height:50px}input{position:absolute;left:650px;top:200px;width:250px;height:40px}
    #result{position:absolute;left:650px;top:350px;width:400px;height:80px}h1{margin:0;padding:10px}
  </style><body><section id="editor"><h1>Email <span style="display:block">for developers</span></h1>
    <pre><div>${Array.from({ length: 700 }, (_, index) => `<span><span>token${index} </span></span>`).join("")}</div></pre>
    <input value="NEVER_EXPORT_FORM_VALUE"><div id="result"><p>Delivery status <span>ready<span hidden>NEVER_EXPORT_NESTED_HIDDEN</span></span></p></div>
    <button><span>Send message</span></button><button disabled aria-disabled="false" style="left:650px"><span>Unavailable action</span></button><div contenteditable="true">NEVER_EXPORT_EDITABLE</div>
    <p style="position:absolute;top:680px"><span>Public <span contenteditable="true">NEVER_EXPORT_NESTED_EDITABLE</span>label</span></p>
    </section></body></html>`);
  assert.ok(await page.locator("#editor *").count() > 400);
  const fixtureAsset: Asset = { ...asset, width: 1200, height: 720 };
  const source = await captureUiSource(page, fixtureAsset, "#editor");
  assert.deepEqual(await captureUiSource(page, fixtureAsset, "#editor"), source, "inventory ordering is deterministic");
  assert.equal(source.basis, "dom");
  assert.ok(source.elements.length <= 48);
  assert.ok(source.elements.some(element => element.role === "button" && element.text === "Send message"));
  assert.ok(source.elements.some(element => element.role === "button" && element.text === "Unavailable action" && element.state?.disabled === true));
  assert.ok(source.elements.some(element => element.role === "input" && !element.text));
  assert.ok(source.elements.some(element => element.text === "Delivery status ready"));
  assert.ok(source.elements.some(element => element.text === "Email for developers"));
  assert.equal(source.elements.filter(element => element.text?.startsWith("token0 ")).length, 1);
  assert.ok(!JSON.stringify(source).includes("NEVER_EXPORT"));
  for (const element of source.elements) {
    const rect = await page.locator("#editor").evaluate((root, selector) => {
      const node = selector === ":scope" ? root : root.querySelector(selector)!;
      const box = node.getBoundingClientRect(), outer = root.getBoundingClientRect();
      return { x: (box.x - outer.x) / outer.width, y: (box.y - outer.y) / outer.height, width: box.width / outer.width, height: box.height / outer.height };
    }, element.selector!);
    for (const key of ["x", "y", "width", "height"] as const) assert.ok(Math.abs(element.rect[key] - rect[key]) <= .0001, `${element.selector} ${key} remains bound to its actual source rectangle`);
  }
  const budget = new UiSourceBudget(); assert.equal(budget.add(source), true);
  assert.ok(Buffer.byteLength(JSON.stringify(budget.sources[0]), "utf8") <= 9800);
  assert.ok(budget.sources[0].elements.some(element => element.text === "Send message"));
});

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

test("complete visible syntax lines support source-bound preview candidates without importing hidden or clipped code", { skip: process.env.STUDIO_UI_SOURCE_INTEGRATION !== "1", timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath: motionBrowserPath() }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await page.route("**/*", route => route.abort());
  // The observed public topology is pre > block line > gutter + syntax spans;
  // names, labels and values are synthetic and do not seed any product plan.
  const line = (number: number, code: string) => `<div><span class="gutter">${number}</span>${code}</div>`;
  await page.setContent(`<style>body{margin:0}#editor{width:1000px;height:650px;background:#111;color:#eee;position:relative;font:16px Arial}pre{position:absolute;top:0;left:0;width:490px;height:600px;overflow:hidden;font:12px/17px monospace;white-space:pre}.gutter{display:inline-block;width:25px;user-select:none;color:#777}aside{position:absolute;left:550px;top:100px;width:400px}p{margin:10px 0}#clipped{position:absolute;left:5px;top:615px;width:490px;height:12px;overflow:hidden}</style>
    <section id="editor"><pre>${line(1, "<span>import</span><span> { Library } from 'generic-library';</span>")}
      ${line(2, "<span>recipient </span><span>=</span><span> </span><span>'Mina'</span><span>,</span>")}
      ${line(3, "<span>Dear </span><span>{</span><span>recipient</span><span>}</span><span>,</span>")}
      ${line(4, "<span>Welcome to &lt;b&gt;{company}&lt;/b&gt;, {recipient}!</span>")}
      ${line(5, "<span>" + "veryLongText ".repeat(30) + "</span>")}
      ${line(6, "<span>unsupported = 'Mina'</span><mark> + getSuffix()</mark>")}
      ${line(7, "<span>privateSuffix = 'Mina'</span><span contenteditable='true'>NEVER_EXPORT_SUFFIX</span>")}
      ${line(8, "<span style='display:inline-block;width:12px;overflow:hidden'>croppedChild = 'Mina'</span>")}
      ${line(9, "<span>spaced = 'Mina  Rao',</span>")}
      ${line(10, "<span>Hi {spaced},</span>")}
      ${line(11, "<span>broken =</span><br><span>'Mina'</span>")}
      ${line(12, "<span>blockLine =</span><span style='display:block'>'Mina'</span>")}
      ${Array.from({ length: 90 }, (_, i) => line(i + 13, `<span>padding${i}</span>`)).join("")}
      ${line(103, "<span>outside = 'NEVER_EXPORT_OFFSCREEN'</span>")}</pre>
      <aside><h2>Welcome, user!</h2><p>Dear Mina,</p><p>Hi Mina Rao,</p><p>Public example</p><input value="NEVER_EXPORT_VALUE"></aside>
      <pre style="display:none">${line(1, "hidden = 'NEVER_EXPORT_HIDDEN'")}</pre>
      <pre contenteditable="true">${line(1, "editable = 'NEVER_EXPORT_EDITABLE'")}</pre>
      <div id="clipped"><pre style="position:static;margin:0;width:490px;height:50px">${line(1, "clipped = 'NEVER_EXPORT_CLIPPED'")}</pre></div>
    </section>`);
  const observed = await captureUiSource(page, { ...asset, width: 1000, height: 650 }, "#editor"), budget = new UiSourceBudget();
  assert.equal(budget.add(observed), true); const source = budget.sources[0];
  assert.ok(source.elements.length <= 48); assert.ok(Buffer.byteLength(JSON.stringify(source)) <= 9800);
  assert.ok(!JSON.stringify(source).includes("NEVER_EXPORT"));
  const candidates = literalPreviewCandidates([source]); assert.equal(candidates.length, 1);
  assert.equal(candidates[0].codeText, "recipient = 'Mina',"); assert.equal(candidates[0].templateText, "Dear {recipient},"); assert.equal(candidates[0].outputBefore, "Dear Mina,");
  assert.ok(!source.elements.some(element => element.codeContainer && /unsupported|privateSuffix|croppedChild|broken|blockLine/.test(element.text || "")), "partial or multiline fragments cannot become certified simple assignments");
  assert.ok(source.elements.some(element => element.codeContainer && element.text === "spaced = 'Mina  Rao',"), "internal literal whitespace is preserved, never normalized into a false preview match");
  assert.ok(source.elements.filter(element => element.codeContainer).every(element => element.text!.length <= 160 && !/^\d/.test(element.text!)));
  for (const element of source.elements.filter(element => element.codeContainer)) {
    const rect = await page.locator("#editor").evaluate((root, selector) => {
      const node = root.querySelector(selector!)!, range = document.createRange(); range.selectNodeContents(node); range.setStartAfter(node.firstElementChild!);
      const box = range.getBoundingClientRect(), outer = root.getBoundingClientRect();
      return { x: (box.x - outer.x) / outer.width, y: (box.y - outer.y) / outer.height, width: box.width / outer.width, height: box.height / outer.height };
    }, element.selector);
    for (const key of ["x", "y", "width", "height"] as const) assert.ok(Math.abs(element.rect[key] - rect[key]) <= .0001, `${element.id} ${key} preserves its actual visible text rectangle`);
  }
});
