import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium, type Page } from "playwright";
import { captureProductPanelState, extractProductVisuals, observeProductImages, observeProductPanels, rasterExtension, rankProductImageCandidates, rankProductPanelCandidates, type ProductImageCandidate, type ProductPanelCandidate } from "./product-visuals";
import { UiSourceBudget } from "./ui-sources";
import type { Asset } from "./types";

function sample(overrides: Partial<ProductImageCandidate> = {}): ProductImageCandidate {
  return { url: "https://example.com/images/product-screenshot.png", selector: "main > img", alt: "Product workspace screenshot", classes: "hero", naturalWidth: 1600, naturalHeight: 1000, displayedWidth: 800, displayedHeight: 500, declaredWidth: 1600, declaredHeight: 1000, visible: true, ...overrides };
}
function pageWith(candidates: ProductImageCandidate[]): Page {
  return { locator: () => ({ evaluateAll: async () => candidates }), evaluate: async () => [] } as unknown as Page;
}

test("object-storage raster signatures qualify under generic binary MIME but conflicting or active types do not", () => {
  const samples: [Buffer, "png" | "jpg" | "webp"][] = [[Buffer.from([137,80,78,71,13,10,26,10]),"png"],[Buffer.from([255,216,255,224]),"jpg"],[Buffer.from("RIFF0000WEBPVP8 "),"webp"]];
  for(const [bytes,extension] of samples){
    assert.equal(rasterExtension(bytes,"Application/Octet-Stream; charset=binary"),extension);
    for(const type of ["text/html","image/svg+xml","application/javascript",""])assert.equal(rasterExtension(bytes,type),null);
  }
  assert.equal(rasterExtension(samples[2][0],"image/png"),null,"an explicit conflicting image type is not trusted");
  for(const bytes of [Buffer.from("<!doctype html><html>error</html>"),Buffer.from("<svg></svg>"),Buffer.from("RIFF0000WAVE"),Buffer.from("RIFF")])assert.equal(rasterExtension(bytes,"application/octet-stream"),null);
});

test("large product screenshots survive while logos, portraits, tiny embeds and hidden images do not", () => {
  const input = [sample(), sample({ url: "https://example.com/logo.png", alt: "Product logo" }), sample({ url: "https://example.com/team-portrait.png", alt: "Editor portrait" }), sample({ naturalWidth: 200, naturalHeight: 240, declaredWidth: 200, declaredHeight: 240 }), sample({ displayedWidth: 80, displayedHeight: 60 }), sample({ visible: false }), sample({ url: "https://example.com/stock-mountain.png", alt: "Mountain", classes: "hero" })];
  assert.deepEqual(rankProductImageCandidates(input).map((image) => image.url), [input[0].url]);
});
test("responsive portrait product screens are accepted and extreme strips/oversized rasters rejected", () => {
  assert.equal(rankProductImageCandidates([sample({ naturalWidth: 1080, naturalHeight: 1920, displayedWidth: 320, displayedHeight: 568 })]).length, 1);
  assert.equal(rankProductImageCandidates([sample({ naturalWidth: 8000, naturalHeight: 600 }), sample({ naturalWidth: 10000, naturalHeight: 10000 })]).length, 0);
});

test("unloaded article product images are bounded candidates, not confirmed raster evidence", () => {
  const unloaded = sample({ url: "https://example.com/workflow-automation.jpg", alt: "Workflow automation", naturalWidth: 0, naturalHeight: 0, declaredWidth: 0, declaredHeight: 0, displayedWidth: 180, displayedHeight: 18 });
  assert.equal(rankProductImageCandidates([unloaded]).length, 1, "missing natural dimensions and alt-text layout must not prevent a safe decode attempt");
  assert.equal(rankProductImageCandidates([{...unloaded,visible:false,unloadedSource:true,displayedWidth:0,displayedHeight:0}]).length,1,"a pending 0×0 source link can be attempted but is not observed pixels");
  for (const rejected of [sample({ ...unloaded, visible: false }), sample({ ...unloaded, declaredWidth: 100 }), sample({ ...unloaded, naturalWidth: 80, naturalHeight: 80 }), sample({ ...unloaded, alt: "Workflow icon", url: "https://example.com/icon.png" }), sample({ ...unloaded, alt: "Landscape", url: "https://example.com/landscape.jpg" })])
    assert.equal(rankProductImageCandidates([rejected]).length, 0);
  assert.equal(rankProductImageCandidates(Array.from({length:30}, (_,i) => ({...unloaded,url:`https://example.com/workflow-${i}.jpg`}))).length,12);
});

test("actual unloaded and data-src guide images qualify only after bounded raster decoding", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-unloaded-images-"));
  const browser = await chromium.launch({headless:true});
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  try {
    const page=await browser.newPage({viewport:{width:1000,height:700}});
    await page.setContent('<body style="background:#dde"><h1>Workflow editor</h1><p>Choose an action</p></body>');
    const complete=await page.screenshot({type:"png"}), tiny=await page.screenshot({type:"png",clip:{x:0,y:0,width:80,height:80}});
    await page.setContent('<body style="background:#eed"><h1>Workflow history</h1><p>Inspect an existing run</p></body>');
    const secondary=await page.screenshot({type:"png"});
    await page.route("**/*",async route=>{if(route.request().url().endsWith("/workflow.png"))await pending;await route.abort().catch(()=>{});});
    await page.setContent(`<base href="https://93.184.216.34/docs/guide"><main>
      <img id="workflow" src="/images/workflow.png" alt="Workflow automation">
      <img id="lazy" src="data:image/png;base64,invalid" data-src="/images/node-history.png" alt="Node history">
      <img id="tiny" src="/images/editor-tiny.png" alt="Editor screenshot">
      <img id="broken" src="/images/editor-broken.png" alt="Editor screenshot">
      <img id="duplicate" src="/images/editor-duplicate.png" alt="Editor screenshot">
      <img id="hidden" style="display:none" src="/images/editor-hidden.png" alt="Editor screenshot">
      <section style="display:none"><img id="hidden-parent" src="/images/editor-hidden-parent.png" alt="Editor screenshot"></section>
      <section style="opacity:0"><img id="hidden-opacity" src="/images/editor-hidden-opacity.png" alt="Editor screenshot"></section>
      <img id="logo" src="/images/logo.png" alt="Product logo">
      <img id="invalid" data-src="javascript:alert(1)" alt="Workflow automation">
    </main>`,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>(document.querySelector("#hidden-opacity") as HTMLImageElement)?.complete,undefined,{timeout:1000});
    const observed=await observeProductImages(page);
    const lazy=observed.find(image=>image.selector==="#lazy")!;
    const unloaded=observed.find(image=>image.selector==="#workflow")!;
    assert.equal(unloaded.naturalWidth,0);assert.equal(unloaded.displayedWidth,0);assert.equal(unloaded.visible,false);assert.equal(unloaded.unloadedSource,true);
    assert.equal(observed.find(image=>image.selector==="#hidden-parent")!.unloadedSource,false);
    const hiddenOpacity=observed.find(image=>image.selector==="#hidden-opacity")!;
    assert.equal(hiddenOpacity.naturalWidth,0);assert.ok(hiddenOpacity.displayedWidth>0 && hiddenOpacity.displayedHeight>0,"broken image alt text has positive layout under an opacity-zero parent");
    assert.equal(hiddenOpacity.visible,false);assert.equal(hiddenOpacity.unloadedSource,false);
    assert.equal(lazy.url,"https://93.184.216.34/images/node-history.png");assert.equal(lazy.sourceAttribute,"data-src");assert.equal(lazy.naturalWidth,0);
    const requested:string[]=[];
    const result=await extractProductVisuals(page,workspace,"https://93.184.216.34/docs/guide",{pageKind:"docs",maxPanels:0,maxAssets:4,maxAttempts:5,maxFileBytes:1_000_000,maxTotalBytes:4_000_000,download:async(url,reservation)=>{
      requested.push(url);const bytes=url.includes("tiny")?tiny:url.includes("broken")?Buffer.from([137,80,78,71,13,10,26,10]):url.includes("node-history")?secondary:complete;
      assert.ok(bytes.length<=reservation);return {bytes,contentType:"image/png",url};
    }});
    assert.equal(result.diagnostics.attempts,5);assert.equal(result.assets.length,2,"duplicate, tiny and corrupt source files never become evidence");
    assert.ok(!requested.some(url=>/hidden|logo|javascript/.test(url)));
    assert.equal(result.assets[0].width,1000);assert.equal(result.assets[0].provenance?.pageKind,"docs");
    assert.ok(result.diagnostics.sources.some(source=>source.sourceAttribute==="data-src" && source.status==="accepted"));
    assert.ok(result.diagnostics.sources.some(source=>/Duplicate/.test(source.reason||"")));
    assert.ok(result.diagnostics.sources.some(source=>/dimensions/.test(source.reason||"")));
    assert.ok(result.diagnostics.reservedBytes<=4_000_000);
  } finally { release();await browser.close(); }
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

test("screen sizing utilities cannot promote marketing or pricing grids into product panels", () => {
  for (const clues of ["grid max-w-screen-xl", "grid md:max-w-screen-2xl gap-8", "w-screen h-screen", "lg:min-h-screen"])
    assert.deepEqual(rankProductPanelCandidates([panel({ clues, heading: "Starter", media: 8 })]), [], clues);
  assert.equal(rankProductPanelCandidates([panel({ clues: "app-editor max-w-screen-xl" })]).length, 1, "sizing classes do not erase a real editor identity");
});

test("bounded heading, parent pricing and purchase content reject false demos without excluding real UI data", () => {
  for (const candidate of [
    panel({ clues: "demo grid", ownHeading: "Why use this product?", media: 8 }),
    panel({ clues: "demo grid", ownHeading: "Starter", contextClues: "pricing mx-auto", controls: 3, controlLabels: ["Monthly", "Yearly", "Start free trial"] }),
    panel({ clues: "demo grid", ownHeading: "Starter", textSample: "Starter $9 /month Start free trial. Growth $14 /month Start free trial." }),
    panel({ clues: "demo", controlLabels: ["Start free trial", "Contact sales"], controls: 2 }),
  ]) assert.deepEqual(rankProductPanelCandidates([candidate]), [], candidate.ownHeading || candidate.clues);
  assert.equal(rankProductPanelCandidates([panel({ ownHeading: "Invoices", textSample: "Invoice $9 Paid Invoice $14 Paid", interfaceElements: 1 })]).length, 1, "currency inside a real table is not evidence of a pricing section");
  assert.equal(rankProductPanelCandidates([panel({ clues: "workspace-preview", heading: "Why use this product?", ownHeading: "", media: 1, largeMedia: 1 })]).length, 1, "a nested product picture may inherit a marketing section heading");
  for (const proof of [{ editableControls: 1 }, { interfaceElements: 1 }, { largeMedia: 1 }])
    assert.equal(rankProductPanelCandidates([panel({ contextClues: "pricing", ownHeading: "Draft", ...proof })]).length, 1, "independently observed nested UI survives a sales-page wrapper");
  assert.deepEqual(rankProductPanelCandidates([panel({ contextClues: "pricing", interfaceElements: 1, ownHeading: "Starter", textSample: "Starter $9 /month Start free trial. Growth $14 /month Start free trial." })]), [], "real widgets do not override the candidate's own pricing content");
});

test("observed interface evidence ranks ahead of a larger decorative mockup", () => {
  const ranked = rankProductPanelCandidates([
    panel({ selector: "#decorative", clues: "mockup", width: 1200, height: 700 }),
    panel({ selector: "#real-editor", y: 800, editableControls: 1, interfaceElements: 1 }),
  ]);
  assert.deepEqual(ranked.map(candidate => candidate.selector), ["#real-editor", "#decorative"]);
});

test("actual DOM marketing grids leave capture slots for a complete editor and product preview", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-purpose-"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.setContent(`<style>body{margin:0;font:18px Arial}h2,h3{margin:0}section,.panel{width:1000px;height:420px;margin:20px}#editor,#preview{width:800px;height:400px;background:#eef}textarea{width:450px;height:180px}</style>
      <section id="benefits" class="grid max-w-screen-xl"><h2>Why use this product?</h2><p>Feature one</p><p>Feature two</p><p>Feature three</p><svg width="30" height="30"><rect width="30" height="30"/></svg></section>
      <section id="pricing"><div class="panel grid max-w-screen-xl"><h3>Starter</h3><p>$9 /month</p><p>Growth $14 /month</p><button>Start free trial</button></div></section>
      <section id="sales-demo" class="demo"><h2>Product tour</h2><p>See what our product can do.</p><p>Make work better.</p><button>Contact sales</button></section>
      <section id="editor" class="app-editor max-w-screen-xl"><h2>Draft</h2><textarea aria-label="Message">Example content</textarea><button>Publish</button><button style="display:none">Start free trial</button></section>
      <div id="preview" class="workspace-preview"><svg width="800" height="400" role="img" aria-label="Product workspace overview"><rect width="800" height="400" fill="#eee"/><text x="30" y="60">Workspace</text><rect x="30" y="90" width="250" height="250" fill="#ccc"/></svg></div>`);
    const observed = await observeProductPanels(page);
    assert.ok(!observed.some(candidate => candidate.selector === "#benefits"), "layout screen utilities are excluded before consuming candidate slots");
    const editor = observed.find(candidate => candidate.selector === "#editor")!;
    assert.deepEqual(editor.controlLabels, ["Message", "Publish"], "hidden marketing controls do not contaminate observed UI controls");
    assert.equal(editor.editableControls, 1);
    assert.equal(editor.interfaceElements, 1);
    assert.deepEqual(rankProductPanelCandidates(observed).map(candidate => candidate.selector), ["#editor", "#preview"]);
    const uiSources = new UiSourceBudget();
    const result = await extractProductVisuals(page, workspace, "https://product.example/", { maxPanels: 3, maxAssets: 3, uiSources, download: async () => { throw new Error("No source-image download is expected"); } });
    assert.equal(result.assets.length, 2);
    assert.deepEqual(result.assets.map(asset => asset.provenance?.selector), ["#editor", "#preview"]);
    assert.equal(uiSources.sources.length, 2, "the third bounded inventory slot remains available for later source evidence");
    assert.deepEqual(result.assets.map(asset => [asset.width, asset.height]), [[800, 400], [800, 400]], "complete product panels are retained");
  } finally { await browser.close(); }
});

const animatedAsset: Asset = { id: "product-panel-0", path: "assets/product-panel-0.jpg", kind: "image", usage: "output", width: 800, height: 400, source: "https://product.example/", rights: "Public fixture", provenance: { pageUrl: "https://product.example/", pageKind: "homepage", method: "element", role: "product-ui-candidate", selector: "#editor" } };
async function fixturePixel(page: Page, path: string, x: number, y: number) {
  return page.evaluate(async sample => {
    const image = new Image(); image.src = `data:image/jpeg;base64,${sample.bytes}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!; context.drawImage(image, sample.x, sample.y, 1, 1, 0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, { bytes: (await readFile(path)).toString("base64"), x, y });
}
async function animatedPanel(page: Page) {
  await page.setContent(`<style>body{margin:0;padding-top:1000px;background:#ddd}#editor{position:relative;width:800px;height:400px;background:#102030;font:20px Arial;color:white}h2,p{margin:0;padding:24px}#marker{position:absolute;top:180px;left:40px;width:120px;height:60px;background:#e03020}#paused{position:absolute;top:280px;left:40px;width:100px;height:40px}</style><section id="editor" class="app-editor"><h2>Current draft</h2><p>Visible public message</p><div id="marker">Preview</div><div id="paused">Paused</div><input aria-label="Recipient" value="private-form-value@example.test"></section>`);
  await page.evaluate(() => {
    const root = document.querySelector("#editor")!;
    const finite = root.animate([{ backgroundColor: "#102030" }, { backgroundColor: "#703050" }], { duration: 60000, fill: "both" }); finite.currentTime = 15000;
    const moving = root.animate([{ transform: "translateX(0px)" }, { transform: "translateX(20px)" }], { duration: 500, iterations: Infinity, direction: "alternate" });
    const marker = document.querySelector("#marker")!.animate([{ transform: "translateX(0px)" }, { transform: "translateX(220px)" }], { duration: 800, iterations: Infinity, direction: "alternate" });
    const paused = document.querySelector("#paused")!.animate([{ backgroundColor: "#204080" }, { backgroundColor: "#608020" }], { duration: 10000 }); paused.pause(); paused.currentTime = 1000;
    (window as any).captureFixture = { finite, moving, marker, paused, finished: 0 }; finite.onfinish = () => { (window as any).captureFixture.finished++; };
  });
}

test("animated panels capture matching current-frame pixels/inventory without finishing or resetting animation", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-animated-panel-")), browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); await animatedPanel(page);
    // Chromium can occasionally sample equal boxes at an animation turnaround;
    // an old locator screenshot timing out is not a deterministic prerequisite.
    // Prove this is a running-animation fixture, then prohibit that old path.
    assert.deepEqual(await page.evaluate(() => { const state=(window as any).captureFixture; return [state.finite,state.moving,state.marker].map(animation=>animation.playState); }),["running","running","running"]);
    page.locator = (() => { throw Error("Capture must not perform a second locator scroll/stability action"); }) as Page["locator"];
    const originalShot = page.screenshot.bind(page);
    page.screenshot = async options => {
      const before = await page.evaluate(() => ({ x: scrollX, y: scrollY, width: innerWidth, height: innerHeight }));
      assert.equal(options!.fullPage, true); assert.equal(options!.clip!.width, 800); assert.equal(options!.clip!.height, 400);
      const bytes = await originalShot(options);
      assert.deepEqual(await page.evaluate(() => ({ x: scrollX, y: scrollY, width: innerWidth, height: innerHeight })), before, "document clip must not scroll or resize the viewport");
      return bytes;
    };
    const path = join(workspace, "panel.jpg"), captured = await captureProductPanelState(page, animatedAsset, "#editor", path, 3000);
    assert.equal(captured.pausedAnimations, 3); assert.equal(captured.source.basis, "dom");
    assert.ok(captured.source.elements.some(element => element.text === "Visible public message"));
    assert.ok(!JSON.stringify(captured.source).includes("private-form-value"), "the same existing inventory privacy rules apply");
    const root = captured.source.elements.find(element => element.selector === ":scope")!;
    const data = await fixturePixel(page, path, 5, 5);
    const color = root.style!.backgroundColor!;
    assert.match(color, /^#[0-9a-f]{6}$/i);
    for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(data[channel] - parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16)) <= 4, "pixel background must match the captured current-state DOM color");
    const marker = captured.source.elements.find(element => element.text === "Preview")!;
    const sample = await fixturePixel(page, path, Math.floor((marker.rect.x + marker.rect.width * .8) * 800), Math.floor((marker.rect.y + marker.rect.height * .8) * 400));
    assert.ok(sample[0] > 190 && sample[1] < 80 && sample[2] < 80, "moving marker pixels match its inventoried position");
    const restored = await page.evaluate(() => { const state = (window as any).captureFixture; return { running: [state.finite, state.moving, state.marker].map(animation => animation.playState), finiteTime: state.finite.currentTime, paused: state.paused.playState, pausedTime: state.paused.currentTime, finished: state.finished }; });
    assert.deepEqual(restored.running, ["running", "running", "running"]); assert.ok(restored.finiteTime < 30000, "finite animation was never fast-forwarded");
    assert.equal(restored.paused, "paused"); assert.equal(restored.pausedTime, 1000); assert.equal(restored.finished, 0);
  } finally { await browser.close(); }
});

test("paired panel capture rejects concurrent DOM changes and restores animations after screenshot failure", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-change-")), browser = await chromium.launch({ headless: true });
  try {
    for (const fail of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); await animatedPanel(page);
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async options => {
        assert.ok(options!.timeout! > 0 && options!.timeout! <= 3000); assert.equal(options!.animations, "allow"); assert.equal(options!.caret, "initial");
        if (fail) throw new Error("Fixture screenshot failed");
        const bytes = await screenshot(options); await page.evaluate(() => { document.querySelector("#editor p")!.textContent = "A different draft"; }); return bytes;
      };
      await assert.rejects(captureProductPanelState(page, animatedAsset, "#editor", join(workspace, `${fail}.jpg`), 3000), fail ? /Fixture screenshot failed/ : /changed during paired/);
      const restored = await page.evaluate(() => { const state = (window as any).captureFixture; return [state.finite.playState, state.moving.playState, state.marker.playState, state.paused.playState, state.finished]; });
      assert.deepEqual(restored, ["running", "running", "running", "paused", 0]); await page.close();
    }
  } finally { await browser.close(); }
});

test("document clip retains a full below-fold panel taller than the viewport without resizing it", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-full-clip-")), browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); await animatedPanel(page);
    await page.evaluate(() => { const root = document.querySelector("#editor") as HTMLElement; root.style.height = "1000px"; const bottom = document.createElement("p"); bottom.id = "bottom-proof"; bottom.textContent = "Actual lower panel"; bottom.style.cssText = "position:absolute;left:40px;top:880px;width:300px;height:70px;padding:0;background:#2080e0"; root.append(bottom); });
    const path = join(workspace, "tall.jpg"), captured = await captureProductPanelState(page, { ...animatedAsset, height: 1000 }, "#editor", path, 3000);
    const dimensions = await page.evaluate(() => ({ x: scrollX, y: scrollY, width: innerWidth, height: innerHeight }));
    assert.ok(dimensions.y > 0); assert.equal(dimensions.width, 1000); assert.equal(dimensions.height, 700);
    assert.equal(captured.source.height, 1000);
    const bottom = captured.source.elements.find(element => element.text === "Actual lower panel")!;
    assert.ok(bottom && bottom.rect.y >= .87, "lower off-viewport content remains in the same complete source inventory");
    const pixel = await fixturePixel(page, path, Math.floor((bottom.rect.x + bottom.rect.width * .8) * 800), Math.floor((bottom.rect.y + bottom.rect.height * .8) * 1000));
    assert.ok(pixel[0] < 60 && pixel[1] > 100 && pixel[2] > 190, "actual lower-panel pixels were captured instead of viewport cropping");
  } finally { await browser.close(); }
});

test("panel animation observation remains bounded without changing excess animations", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-animation-cap-")), browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); await animatedPanel(page);
    await page.evaluate(() => { for (let index = 0; index < 257; index++) document.querySelector("#marker")!.animate([{ opacity: .8 }, { opacity: 1 }], { duration: 60000, iterations: Infinity }); });
    const before = await page.evaluate(() => document.getAnimations().map(animation => animation.playState));
    await assert.rejects(captureProductPanelState(page, animatedAsset, "#editor", join(workspace, "excess.jpg"), 3000), /bounded allowance/);
    assert.deepEqual(await page.evaluate(() => document.getAnimations().map(animation => animation.playState)), before);
  } finally { await browser.close(); }
});

test("only exact no-op ancestor assignments pass; descendant styling and transient class cycles remain rejected", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 45000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-ancestor-")), browser = await chromium.launch({ headless: true });
  try {
    for (const change of ["noop", "paint", "descendant", "cycle", "bookkeeping"] as const) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); await animatedPanel(page);
      await page.addStyleTag({ content: ".capture-active #marker{background:#2040ff!important}" });
      await page.evaluate(() => { document.body.className = "scroll-completed"; });
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async options => {
        const bytes = await screenshot(options); await page.evaluate(changed => {
          if (changed === "noop") document.body.className = "scroll-completed";
          if (changed === "paint") document.body.style.filter = "brightness(.5)";
          if (changed === "descendant" || changed === "cycle") document.body.classList.add("capture-active");
          if (changed === "cycle") document.body.classList.remove("capture-active");
          if (changed === "bookkeeping") document.body.classList.add("unrelated-class");
        }, change); return bytes;
      };
      const captured = captureProductPanelState(page, animatedAsset, "#editor", join(workspace, `${change}.jpg`), 3000);
      if (change !== "noop") await assert.rejects(captured, /changed during paired/);
      else assert.equal((await captured).source.basis, "dom");
      assert.equal(await page.evaluate(() => (window as any).captureFixture.moving.playState), "running"); await page.close();
    }
  } finally { await browser.close(); }
});

test("delayed scroll-end settles before observation while continuously mutating panels fail and resume animations", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-quiet-")), browser = await chromium.launch({ headless: true });
  try {
    for (const continuous of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); await animatedPanel(page);
      await page.evaluate(changing => {
        let timer: ReturnType<typeof setTimeout>; addEventListener("scroll", () => { document.body.classList.add("moving-page"); clearTimeout(timer); timer = setTimeout(() => document.body.classList.remove("moving-page"), 250); }, { once: true });
        if (changing) { let tick = 0; (window as any).captureMutationTimer = setInterval(() => { document.querySelector("#editor p")!.textContent = `Changing draft ${++tick}`; }, 40); }
      }, continuous);
      const capture = captureProductPanelState(page, animatedAsset, "#editor", join(workspace, `${continuous}.jpg`), 3000);
      if (continuous) await assert.rejects(capture, /did not settle within its bounded capture allowance/);
      else { const result = await capture; assert.equal(result.source.basis, "dom"); assert.ok(result.source.elements.some(element => element.text === "Visible public message")); assert.equal(await page.evaluate(() => document.body.classList.contains("moving-page")), false); }
      assert.equal(await page.evaluate(() => (window as any).captureFixture.moving.playState), "running");
      await page.evaluate(() => clearInterval((window as any).captureMutationTimer)); await page.close();
    }
  } finally { await browser.close(); }
});

async function geometryOnlyPanel(page: Page, mode: "size" | "position" | "continuous" | "slow") {
  await animatedPanel(page);
  // CSSOM edits change actual layout without mutating DOM attributes/text.
  // Trigger them when production pauses the first animation, so scheduling the
  // test process cannot move this fixture outside the quiet interval.
  await page.evaluate(`(() => {
    const root=document.querySelector('#editor'),sheet=document.styleSheets[0];
    const bodyRule=Array.from(sheet.cssRules).find(rule=>rule.selectorText==='body');
    const rootRule=Array.from(sheet.cssRules).find(rule=>rule.selectorText==='#editor');
    bodyRule.style.overflowAnchor='none';
    const state={changedAt:0,changes:0,mutations:0,reads:0,frames:new Set(),observers:new Set(),interval:null};
    window.geometryFixture=state;
    const NativeObserver=window.MutationObserver,monitor=new NativeObserver(records=>{state.mutations+=records.length;});
    monitor.observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true});state.monitor=monitor;
    window.MutationObserver=class extends NativeObserver{
      observe(...args){super.observe(...args);state.observers.add(this);}
      disconnect(){super.disconnect();state.observers.delete(this);}
    };
    const nativeFrame=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>{const id=nativeFrame(time=>{state.frames.delete(id);callback(time);});state.frames.add(id);return id;};
    window.cancelAnimationFrame=id=>{state.frames.delete(id);nativeCancel(id);};
    const nativeRect=root.getBoundingClientRect.bind(root);root.getBoundingClientRect=()=>{state.reads++;return nativeRect();};
    const mode=${JSON.stringify(mode)},animation=window.captureFixture.finite,nativePause=animation.pause.bind(animation);
    animation.pause=()=>{
      nativePause();
      const change=()=>{state.changes++;state.changedAt=performance.now();if(mode==='position')bodyRule.style.paddingTop=(1000+state.changes*100)+'px';else if(mode==='slow')rootRule.style.left=(state.changes*.06)+'px';else rootRule.style.height=(400+(state.changes%2?80:60))+'px';};
      if(mode==='continuous'||mode==='slow')state.interval=setInterval(change,40);
      else{setTimeout(change,100);setTimeout(change,250);}
    };
  })()`);
}

test("geometry-only size and ancestor position changes restart the bounded panel quiet interval", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-geometry-")), browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ["size", "position"] as const) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); await geometryOnlyPanel(page, mode);
      const screenshot = page.screenshot.bind(page); let shots = 0;
      page.screenshot = async options => {
        shots++;
        const observed = await page.evaluate(() => { const state=(window as any).geometryFixture,box=document.querySelector("#editor")!.getBoundingClientRect();return { quiet:performance.now()-state.changedAt,changes:state.changes,mutations:state.mutations,x:box.x+scrollX,y:box.y+scrollY,width:box.width,height:box.height }; });
        assert.equal(observed.changes, 2); assert.equal(observed.mutations, 0, "readiness cannot rely on MutationObserver for this real CSSOM layout change");
        assert.ok(observed.quiet >= 295, `capture began only ${observed.quiet}ms after the last geometry change`);
        assert.deepEqual(options!.clip, { x: observed.x, y: observed.y, width: observed.width, height: observed.height });
        assert.ok(options!.timeout! > 0 && options!.timeout! < 2700, "quiet time is deducted from the unchanged three-second capture allowance");
        return screenshot(options);
      };
      const path = join(workspace, `${mode}.jpg`), captured = await captureProductPanelState(page, animatedAsset, "#editor", path, 3000);
      assert.equal(shots, 1); assert.equal(captured.pausedAnimations, 3); assert.equal(captured.source.height, mode === "size" ? 460 : 400);
      const marker=captured.source.elements.find(element=>element.text==="Preview")!;
      const pixel=await fixturePixel(page,path,Math.floor((marker.rect.x+marker.rect.width*.8)*captured.source.width),Math.floor((marker.rect.y+marker.rect.height*.8)*captured.source.height));
      assert.ok(pixel[0]>190&&pixel[1]<80&&pixel[2]<80,"decoded pixels still match the final measured source coordinates");
      const cleanup=await page.evaluate(()=>{const state=(window as any).geometryFixture;return {frames:state.frames.size,observers:state.observers.size,reads:state.reads,running:(window as any).captureFixture.moving.playState};});
      assert.deepEqual({frames:cleanup.frames,observers:cleanup.observers,running:cleanup.running},{frames:0,observers:0,running:"running"});
      await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,80)));
      assert.equal(await page.evaluate(()=>(window as any).geometryFixture.reads),cleanup.reads,"geometry sampling ends after successful capture");
      await page.close();
    }
  } finally { await browser.close(); }
});

test("continuous geometry changes exhaust the same quiet limit and clean up without capturing", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 15000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-panel-geometry-limit-")), browser = await chromium.launch({ headless: true });
  try {
    for(const mode of ["continuous","slow"] as const){
    const page=await browser.newPage({viewport:{width:1000,height:700}});await geometryOnlyPanel(page,mode);let shots=0;
    page.screenshot=async()=>{shots++;throw Error("An unstable panel must never reach screenshot capture");};
    await assert.rejects(captureProductPanelState(page,animatedAsset,"#editor",join(workspace,"unstable.jpg"),3000),/did not settle within its bounded capture allowance/);
    const cleanup=await page.evaluate(()=>{const state=(window as any).geometryFixture;clearInterval(state.interval);return {frames:state.frames.size,observers:state.observers.size,mutations:state.mutations,changes:state.changes,reads:state.reads,running:(window as any).captureFixture.moving.playState};});
    assert.equal(shots,0);assert.equal(cleanup.mutations,0);assert.ok(cleanup.changes>=10);
    assert.deepEqual({frames:cleanup.frames,observers:cleanup.observers,running:cleanup.running},{frames:0,observers:0,running:"running"});
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,80)));
    assert.equal(await page.evaluate(()=>(window as any).geometryFixture.reads),cleanup.reads,"geometry sampling ends after timeout too");
    await page.close();
    }
  } finally { await browser.close(); }
});

test("geometry-only movement during the screenshot remains a rejected paired capture", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 15000 }, async () => {
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-panel-geometry-verify-")),browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1000,height:700}});await animatedPanel(page);
    const screenshot=page.screenshot.bind(page);
    page.screenshot=async options=>{const bytes=await screenshot(options);await page.evaluate(()=>{const rule=Array.from(document.styleSheets[0].cssRules).find(rule=>(rule as CSSStyleRule).selectorText==="#editor") as CSSStyleRule;rule.style.height="460px";});return bytes;};
    await assert.rejects(captureProductPanelState(page,animatedAsset,"#editor",join(workspace,"changed.jpg"),3000),/geometry changed during paired capture/);
    assert.equal(await page.evaluate(()=>(window as any).captureFixture.moving.playState),"running");
  } finally { await browser.close(); }
});

async function rasterAlternativeFixture(page: Page, variant: "valid" | "neighbor" | "ambiguous" | "hidden" | "editable" = "valid") {
  const encoded=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=600;const ctx=canvas.getContext("2d")!;ctx.fillStyle="#ffffff";ctx.fillRect(0,0,1000,600);ctx.fillStyle="#111111";ctx.font="32px Arial";ctx.fillText("Your contact details",40,60);ctx.fillText("Ada",40,160);ctx.fillText("Contact me",40,260);return canvas.toDataURL("image/png").split(",")[1];});
  const bytes=Buffer.from(encoded,"base64");
  await page.route("https://example.com/**",route=>route.fulfill({status:200,contentType:"image/png",body:bytes}));
  const image='<img src="https://example.com/product-demo.png" alt="Product form screenshot" style="width:100%;height:100%">';
  const vector='<svg width="100%" height="100%"><rect width="100%" height="100%" fill="#eeddcc"/><text x="40" y="60">Another product view</text></svg>';
  const primary=variant==="neighbor"?vector:variant==="hidden"?vector+image.replace('style="','style="display:none;'):variant==="ambiguous"?image.replace("width:100%","width:50%")+image.replace("product-demo.png","other-demo.png").replace("width:100%","width:50%"):image;
  await page.setContent(`<style>body{margin:0}#primary{position:relative;width:1000px;height:600px}#secondary{width:900px;height:550px}#third{width:800px;height:500px}section{margin:20px}img{vertical-align:top}input{position:absolute;top:100px;left:50px}</style><section id="primary" class="workspace-preview">${primary}${variant==="editable"?'<input aria-label="Message">':""}</section><section id="secondary" class="workspace-preview">${vector}</section><section id="third" class="workspace-preview">${vector}</section>${variant==="neighbor"?`<div id="primary-other">${image}</div>`:""}`);
  await page.evaluate(()=>Promise.all(Array.from(document.images).map(image=>image.decode())));
  const screenshot=page.screenshot.bind(page),events:string[]=[];
  page.screenshot=async options=>{
    const first=options!.clip!.width===1000;events.push(first?"primary-screenshot":"later-screenshot");
    const result=await screenshot(options);
    if(first)await page.evaluate(()=>{const rule=Array.from(document.styleSheets[0].cssRules).find(rule=>(rule as CSSStyleRule).selectorText==="#primary") as CSSStyleRule;rule.style.height="602px";});
    return result;
  };
  return {bytes,events};
}

test("an unstable image-based panel uses its exact observed raster before later panels fill the same two slots", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-panel-raster-")),browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:960}}),fixture=await rasterAlternativeFixture(page),uiSources=new UiSourceBudget();
    const result=await extractProductVisuals(page,workspace,"https://example.com/",{maxPanels:2,maxAssets:2,maxAttempts:1,maxFileBytes:1_000_000,maxTotalBytes:1_000_000,uiSources,download:async(url,maximum)=>{fixture.events.push("raster-download");assert.equal(url,"https://example.com/product-demo.png");assert.equal(maximum,1_000_000);return {bytes:fixture.bytes,contentType:"image/png",url};}});
    assert.deepEqual(fixture.events,["primary-screenshot","raster-download","later-screenshot"]);
    assert.equal(result.assets.length,2);assert.deepEqual(result.assets.map(asset=>asset.provenance?.method),["source-image","element"]);
    assert.equal(result.assets[1].provenance?.selector,"#secondary");assert.equal(result.diagnostics.attempts,1);
    assert.equal(result.diagnostics.reservedBytes,fixture.bytes.length);assert.equal(result.diagnostics.downloadedBytes,fixture.bytes.length);
    assert.match(result.diagnostics.sources[0].reason!,/geometry changed during paired/);assert.equal(result.diagnostics.sources[0].status,"skipped");
    const alternate=result.diagnostics.sources[1];assert.equal(alternate.fallbackPanelSelector,"#primary");assert.equal(alternate.status,"accepted");assert.equal(alternate.method,"source-image");
    assert.equal(uiSources.sources[0].basis,"pixels");assert.deepEqual(uiSources.sources[0].elements,[],"a standalone source raster never acquires fabricated captured DOM controls");
    assert.equal(uiSources.sources.length,2);assert.equal(result.assets[0].rights,"Complete image linked by a public product page; a visual candidate, not an authenticated application recording.");
  }finally{await browser.close();}
});

test("raster alternatives require true containment, a unique image and no missing live controls", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 45000 }, async () => {
  const browser=await chromium.launch({headless:true});
  try{
    for(const variant of ["neighbor","ambiguous","hidden","editable","replaced","unrelated"] as const){
      const workspace=await mkdtemp(join(tmpdir(),"video-studio-panel-raster-binding-")),page=await browser.newPage({viewport:{width:1440,height:960}});
      const fixture=await rasterAlternativeFixture(page,variant==="replaced"||variant==="unrelated"?"valid":variant);
      if(variant==="replaced"){
        const evaluate=page.evaluate.bind(page);
        page.evaluate=((fn:any,arg:any)=>{if(arg?.panels&&arg?.images)return evaluate(async()=>{const image=document.querySelector("#primary img") as HTMLImageElement;image.src="https://example.com/replaced-demo.png";await image.decode();}).then(()=>evaluate(fn,arg));return evaluate(fn,arg);}) as Page["evaluate"];
      }
      if(variant==="unrelated"){
        const screenshot=page.screenshot.bind(page);page.screenshot=async options=>{if(options!.clip!.width===1000)throw Error("Fixture unrelated screenshot error");return screenshot(options);};
      }
      let downloads=0;
      const result=await extractProductVisuals(page,workspace,"https://example.com/",{maxPanels:2,maxAssets:2,download:async(url)=>{downloads++;return {bytes:fixture.bytes,contentType:"image/png",url};}});
      assert.equal(downloads,0,variant);assert.equal(result.diagnostics.attempts,0,variant);
      assert.deepEqual(result.assets.map(asset=>asset.provenance?.selector),["#secondary","#third"],variant);
      assert.ok(!result.diagnostics.sources.some(source=>source.fallbackPanelSelector),variant);
      await page.close();
    }
  }finally{await browser.close();}
});

test("a failed raster alternative retains its byte reservation and cannot retry in the trailing image pass", { skip: process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION !== "1", timeout: 30000 }, async () => {
  const browser=await chromium.launch({headless:true});
  try{
    for(const failure of ["network","mime"] as const){
      const workspace=await mkdtemp(join(tmpdir(),"video-studio-panel-raster-failure-")),page=await browser.newPage({viewport:{width:1440,height:960}});await rasterAlternativeFixture(page);let downloads=0;
      const result=await extractProductVisuals(page,workspace,"https://example.com/",{maxPanels:2,maxAssets:3,maxAttempts:3,maxFileBytes:100,maxTotalBytes:300,download:async url=>{downloads++;if(failure==="network")throw Error("Fixture download failed");return {bytes:Buffer.from("<html>not a raster</html>"),contentType:"text/html",url};}});
      assert.equal(downloads,1,"the same URL cannot repeat even with unused attempt, byte and asset capacity");assert.equal(result.diagnostics.attempts,1);assert.equal(result.assets.length,2);
      assert.ok(result.assets.every(asset=>asset.provenance?.method==="element"));
      assert.equal(result.diagnostics.reservedBytes,failure==="network"?100:25);
      assert.equal(result.diagnostics.sources.filter(source=>source.method==="source-image").length,1);
      assert.equal(result.diagnostics.sources.find(source=>source.fallbackPanelSelector)?.status,"skipped");
      await page.close();
    }
  }finally{await browser.close();}
});
