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
    await assert.rejects(page.locator("#editor").screenshot({ timeout: 150 }), /stable|Timeout/, "the unpaused panel reproduces locator stability starvation");
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
