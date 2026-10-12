import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { boundedResearchDom, enrichProductResearch, MINIMUM_GUIDE_CAPTURE_MS, observedGuideCatalog, persistResearchText, ResearchCaptureClock, RESEARCH_TEXT_WRITE_LIMIT_MS, researchDestination, researchPageExcerpt, selectDocumentationFollowup, selectResearchLinks } from "./url-research";
import { safeDownload } from "./security";
import { captureProduct, CaptureDownloadBudget } from "./ingest";

const homepage = "https://product.example/";
const integration = process.env.STUDIO_RESEARCH_CAPTURE_INTEGRATION === "1";

test("bounded DOM reads preserve successful values and ordinary failures without closing a healthy page", async()=>{
  let closes=0;const page={close:async()=>{closes++;}} as unknown as Page;
  assert.deepEqual(await boundedResearchDom(page,1000,"fixture",async()=>({body:"Actual readable source"})),{body:"Actual readable source"});
  await assert.rejects(boundedResearchDom(page,1000,"fixture",async()=>{throw Error("Observed page error");}),/Observed page error/);
  assert.equal(closes,0);
});

test("expired DOM reads close their page and settle pending work before returning", async()=>{
  let rejectRead!:(error:Error)=>void,settled=false,closes=0;
  const read=new Promise<string>((_resolve,reject)=>{rejectRead=reject;}).finally(()=>{settled=true;});
  const page={close:async()=>{closes++;await new Promise(resolve=>setTimeout(resolve,10));rejectRead(Error("Target closed"));}} as unknown as Page;
  await assert.rejects(boundedResearchDom(page,10,"fixture snapshot",()=>read),/fixture snapshot exceeded.*page closed/);
  assert.equal(closes,1);assert.equal(settled,true,"the function must not leave a detached pending read behind");
});

test("actual Chromium interrupts an unresolved DOM evaluation on its deadline",{skip:!integration,timeout:10000},async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();await page.setContent("<h1>Readable guide</h1>");
    await assert.rejects(boundedResearchDom(page,100,"fixture snapshot",()=>page.evaluate(()=>new Promise<string>(()=>{}))),/page closed/);
    assert.equal(page.isClosed(),true);await assert.rejects(page.evaluate(()=>document.title),/closed/);
  }finally{await browser.close();}
});

test("guide handoff survives optional viewport failure but never calls selection after closure or expiry",{skip:!integration,timeout:30000},async(t)=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const outcome of ["viewport-failed","page-closed","deadline-expired"]){
      const workspace=await mkdtemp(join(tmpdir(),"video-studio-handoff-page-"));await mkdir(join(workspace,"analysis"));await mkdir(join(workspace,"assets"));
      const page=await browser.newPage(),docs=homepage+"docs",guide=docs+"/build";let selections=0;
      await page.route("**/*",async route=>{
        const url=route.request().url(),links=url===homepage?"<a href='/docs'>Documentation</a>":url===docs?"<a href='/docs/build'>Build a workflow</a>":"";
        await route.fulfill({contentType:"text/html",body:`<title>Guide</title><body>${links}<h2>Build your workflow</h2><p>${"Actual guide instructions about adding connected steps. ".repeat(8)}</p></body>`});
      });
      await page.goto(homepage);
      const addStyle=page.addStyleTag.bind(page);page.addStyleTag=async options=>{assert.notEqual(page.url(),docs,"optional preparation must not close the handoff page");return addStyle(options);};
      const screenshot=page.screenshot.bind(page),now=Date.now;let restore:undefined|(()=>void),elapsedOffset=0;
      if(outcome==="deadline-expired"){const mocked=t.mock.method(Date,"now",()=>now()+elapsedOffset);restore=()=>mocked.mock.restore();}
      page.screenshot=async options=>{
        if(page.url()!==docs)return screenshot(options);
        if(outcome==="page-closed")await page.close();
        if(outcome==="deadline-expired")elapsedOffset=31000;
        throw Error("Optional viewport unavailable");
      };
      try{
        const result=await enrichProductResearch(page,workspace,{homepageUrl:homepage,homepageTitle:"Product",homepageText:"Product workflow evidence. ".repeat(10),resolvedUrl:url=>url,checkpointGuide:async()=>{},chooseGuide:async({catalog})=>{
          selections++;assert.equal(catalog.entries[0].url,guide);
          return {version:1,decision:"capture-guide",guideId:catalog.entries[0].id,sourceAssetIds:["fixture-image"],intent:"Inspect the observed guide",missingEvidence:["action"],reason:"Observed task guide fixture."};
        }});
        assert.equal(selections,outcome==="viewport-failed"?1:0,outcome);
        if(outcome==="viewport-failed")assert.ok(result.text.includes(`Source page: ${guide}`),"saved anchors remain usable for the next guide navigation");
      }finally{restore?.();await page.close();}
    }
  }finally{await browser.close();}
});

test("documentation excerpts preserve late procedural source text within the existing allowance", () => {
  const procedure = "Click the plus icon after the trigger to open the node selector. Choose an action to add a connected step.\nKeep the current publication state unchanged.";
  const heading = "How to build your workflow";
  const body = `Product overview and terminology.\n${heading}\nAnother contents link\n${"History and concept explanations. ".repeat(280)}\n${heading}\n${procedure}\n${"Additional documentation. ".repeat(300)}`;
  const excerpt = researchPageExcerpt(homepage+"docs/workflow","Workflow guide",body,[{text:heading,followingText:procedure.slice(0,180)}]);
  assert.equal(excerpt.length,7500);assert.match(excerpt,/Product overview and terminology/);assert.ok(excerpt.includes(procedure));assert.match(excerpt,/Intervening source text omitted/);
  assert.ok(excerpt.indexOf(procedure)>excerpt.indexOf("Intervening source text omitted"),"the observed instruction paragraph disambiguates the earlier table-of-contents heading");
  const unchanged = researchPageExcerpt(homepage,"Guide",body,[{text:heading,followingText:"Unobserved instructions that do not occur anywhere in the actual page body."}]);
  assert.equal(unchanged,`Source page: ${homepage}\nTitle: Guide\n${body}`.slice(0,7500));
  assert.equal(researchPageExcerpt(homepage,"Guide",body,[],200).length,200);
});

test("guide catalog contains only exact observed safe documentation IDs within existing anchor bounds",()=>{
  const catalog=observedGuideCatalog(homepage,homepage+"docs",[
    {href:"/docs/first",text:"First guide",index:3},{href:"https://other.example/docs/second",text:"Unrelated guide"},
    {href:"/docs/private?token=secret",text:"Private guide"},{href:"/account/docs",text:"Account docs"},
    {href:"/docs/first#section",text:"Duplicate"},{href:"/docs/second",text:"Second guide",index:8},
    {href:"/pricing",text:"Pricing"},{href:"/docs/download-guide",text:"Download",download:true},
  ]);
  assert.deepEqual(catalog.entries,[{id:"guide-1",url:homepage+"docs/first",anchorText:"First guide",anchorIndex:3},{id:"guide-6",url:homepage+"docs/second",anchorText:"Second guide",anchorIndex:8}]);
  const many=observedGuideCatalog(homepage,homepage+"docs",Array.from({length:310},(_,index)=>({href:`/docs/guide-${index}`,text:"Observed guide "+index,index})));
  assert.equal(many.entries.length,64);assert.ok(Buffer.byteLength(JSON.stringify(many),"utf8")<=24000);
  assert.deepEqual(observedGuideCatalog(homepage,homepage+"docs",Array.from({length:310},(_,index)=>({href:index<300?"/legal":`/docs/guide-${index}`,text:"Guide"}))).entries,[]);
});

test("selector waiting pauses but never resets the shared active capture allowance",async()=>{
  let now=0;const clock=new ResearchCaptureClock(()=>now);
  now=8000;assert.equal(clock.remaining(30000),22000);
  await clock.handoff(async()=>{now+=45000;});
  assert.equal(clock.selectionWaitMs,45000);assert.equal(clock.elapsedMs,53000);assert.equal(clock.activeMs,8000);assert.equal(clock.remaining(30000),22000);
  now+=21000;assert.equal(clock.remaining(12000),1000);
  now+=1001;assert.throws(()=>clock.remaining(1),/scheduling limit/);
});

test("successful bounded source-text persistence has its own ledger without consuming capture time",async()=>{
  let now=0;const clock=new ResearchCaptureClock(()=>now),workspace=join(tmpdir(),"research-clock-fixture"),excerpt="Actual source instructions";
  now=4700;
  await persistResearchText(workspace,1,excerpt,clock,async(path,text,{signal})=>{
    assert.equal(path,join(workspace,"analysis/research-page-1.txt"));assert.equal(text,excerpt);assert.equal(signal.aborted,false);
    now+=25140;
  });
  assert.equal(clock.elapsedMs,29840);assert.equal(clock.persistedTextWaitMs,25140);assert.equal(clock.activeMs,4700);assert.equal(clock.remainingActiveMs,25300);
  await clock.handoff(async()=>{now+=32510;});
  assert.equal(clock.selectionWaitMs,32510);assert.equal(clock.persistedTextWaitMs,25140);assert.equal(clock.activeMs,4700);
  assert.equal(clock.elapsedMs,clock.activeMs+clock.persistedTextWaitMs+clock.selectionWaitMs);
  now+=25301;assert.throws(()=>clock.remaining(1),/scheduling limit/);
});

test("failed and overdue source-text writes get no capture credit",async()=>{
  for(const failure of ["rejected","overdue"]){
    let now=0;const clock=new ResearchCaptureClock(()=>now);now=4700;
    await assert.rejects(persistResearchText(tmpdir(),2,"Observed instructions",clock,async()=>{
      now+=failure==="rejected"?25140:RESEARCH_TEXT_WRITE_LIMIT_MS+1;
      if(failure==="rejected")throw Error("Disk unavailable");
    }),failure==="rejected"?/Disk unavailable/:/local I\/O deadline/);
    assert.equal(clock.persistedTextWaitMs,0);assert.equal(clock.activeMs,now);assert.equal(clock.selectionWaitMs,0);
  }
});

test("source-text write abort waits for native settlement and never credits an overdue completion",async()=>{
  let settled=false,abortObserved=false;
  const clock=new ResearchCaptureClock();
  await assert.rejects(persistResearchText(tmpdir(),1,"Source text",clock,async(_path,_text,{signal})=>{
    await new Promise<void>(resolve=>signal.addEventListener("abort",()=>{abortObserved=true;setTimeout(()=>{settled=true;resolve();},15);},{once:true}));
  },10),/local I\/O deadline/);
  assert.equal(abortObserved,true);assert.equal(settled,true,"do not return while an aborted writer can still mutate its file");assert.equal(clock.persistedTextWaitMs,0);
});

test("only the two bounded source-text artifacts can receive local persistence credit",async()=>{
  const clock=new ResearchCaptureClock();let writes=0;
  const writer=async()=>{writes++;};
  for(const index of [0,3,1.5])await assert.rejects(persistResearchText(tmpdir(),index,"text",clock,writer),/bounded research text artifact/);
  await assert.rejects(persistResearchText(tmpdir(),1,"x".repeat(7501),clock,writer),/bounded research text artifact/);
  assert.equal(writes,0);
  await persistResearchText(tmpdir(),2,"x".repeat(7500),clock,writer);assert.equal(writes,1);
});

test("guide selection needs twelve useful capture seconds, including the exact boundary",()=>{
  let now=0;const clock=new ResearchCaptureClock(()=>now);
  assert.equal(MINIMUM_GUIDE_CAPTURE_MS,12000);now=18000;
  assert.equal(clock.remainingActiveMs,12000);assert.equal(clock.canSelectGuide,true);
  now++;assert.equal(clock.canSelectGuide,false);
  now=29930;assert.equal(clock.remainingActiveMs,70);assert.equal(clock.canSelectGuide,false);
});

test("actual Chromium guide handoff records low-time skips and accepts exactly twelve seconds",{skip:!integration,timeout:15000},async(t)=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const remainingMs of [70,11999,12000]){
      const workspace=await mkdtemp(join(tmpdir(),"video-studio-handoff-budget-"));await mkdir(join(workspace,"analysis"));await mkdir(join(workspace,"assets"));
      const page=await browser.newPage(),docs=homepage+"docs",guide=docs+"/build";let selections=0,checkpoints=0;
      await page.route("**/*",async route=>{
        const url=route.request().url(),links=url===homepage?"<a href='/docs'>Documentation</a>":url===docs?"<a href='/docs/build'>Build a workflow</a>":"";
        await route.fulfill({contentType:"text/html",body:`<title>Guide</title><body>${links}<p>${"Actual instructions for adding a connected workflow step. ".repeat(8)}</p></body>`});
      });
      await page.goto(homepage);
      const started=Date.now();let now=started;
      const mocked=t.mock.method(Date,"now",()=>now);
      page.screenshot=async()=>{if(page.url()===docs)now=started+30000-remainingMs;throw Error("Optional viewport unavailable");};
      try{
        const result=await enrichProductResearch(page,workspace,{homepageUrl:homepage,homepageTitle:"Product",homepageText:"Existing homepage evidence.",resolvedUrl:url=>url,checkpointGuide:async()=>{checkpoints++;},chooseGuide:async({catalog})=>{
          selections++;assert.equal(catalog.entries[0].url,guide);
          return {version:1,decision:"capture-guide",guideId:catalog.entries[0].id,sourceAssetIds:["fixture-image"],intent:"Inspect the observed guide",missingEvidence:["action"],reason:"Observed task guide fixture."};
        }});
        const report=JSON.parse(await readFile(join(workspace,"analysis/research-sources.json"),"utf8")),accepted=remainingMs===12000;
        assert.equal(selections,accepted?1:0);assert.equal(checkpoints,selections);
        assert.equal(report.elapsedMs,report.activeCaptureMs+report.selectionWaitMs+report.persistedTextWaitMs);
        assert.equal(report.limits.schedulingLimitMs,30000);assert.equal(report.limits.minimumGuideCaptureMs,12000);
        assert.equal(report.sources[1].status,"captured");assert.ok(result.text.includes(`Source page: ${docs}`));
        if(accepted){assert.ok(result.text.includes(`Source page: ${guide}`));assert.equal(report.sources[1].guideSelection,undefined);}
        else{
          assert.deepEqual(report.sources[1].guideSelection,{status:"skipped",reason:"capture-time-exhausted",remainingActiveMs:remainingMs,minimumActiveMs:12000});
          assert.equal(report.sources.length,2);assert.equal(result.guideProposal,undefined);assert.equal(report.guideProposal,undefined);
        }
      }finally{mocked.mock.restore();await page.close();}
    }
  }finally{await browser.close();}
});

test("readable server-rendered documentation survives a deferred script that holds DOMContentLoaded", {skip:!integration,timeout:25000},async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-docs-deferred-"));for(const directory of ["assets","analysis"])await mkdir(join(workspace,directory));
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:960}});
  let release!:()=>void;const deferred=new Promise<void>(resolve=>{release=resolve;});
  try{
    await page.route("**/*",async route=>{
      const url=route.request().url();
      if(url.endsWith("late-script.js")){await deferred;await route.fulfill({contentType:"application/javascript",body:"window.fixtureScriptLoaded=true"});return;}
      await route.fulfill({contentType:"text/html",body:url===homepage?"<title>Product</title><body><a href='/docs/guide'>Documentation</a></body>":`<html><head><title>Task guide</title><script defer src='/late-script.js'></script></head><body><h1>Create a form</h1><p>${"Documented form controls and the supported published result. ".repeat(10)}</p></body></html>`});
    });
    await page.goto(homepage);let loaded=false;page.on("domcontentloaded",()=>{loaded=true;});
    const captured=await enrichProductResearch(page,workspace,{homepageUrl:homepage,homepageTitle:"Product",homepageText:"Homepage product evidence. ".repeat(10),resolvedUrl:url=>url,captureVisuals:async()=>({assets:[],artifactPaths:[]})});
    assert.equal(loaded,false,"the external script remains pending while its readable guide is retained");
    assert.match(captured.text,/Documented form controls/);
    const report=JSON.parse(await readFile(join(workspace,"analysis/research-sources.json"),"utf8"));assert.equal(report.sources[1].status,"captured");assert.equal(report.sources[1].url,homepage+"docs/guide");
    const phases=report.sources[1].timings.map((timing:{phase:string})=>timing.phase);
    assert.ok(phases.indexOf("source-dom-snapshot")<phases.indexOf("text-persistence"));
    assert.ok(phases.indexOf("focused-images")<phases.indexOf("viewport-image"),"source images retain priority over optional viewport capture");
    assert.ok(!phases.includes("viewport-prepare"),"optional style work cannot destroy a documentation handoff page");
    for(const timing of report.sources[1].timings)assert.ok(timing.elapsedMs>=0&&timing.remainingActiveMs>=0&&timing.remainingActiveMs<=30000);
  }finally{release();await page.waitForLoadState("domcontentloaded",{timeout:2000}).catch(()=>{});await browser.close();}
});

test("knowledge bases and user documentation outrank generic developer documentation", () => {
  const links=selectResearchLinks(homepage,[{href:"/docs/index",text:"Documentation"},{href:"/user-docs",text:"Knowledge base"},{href:"/pricing",text:"Pricing"}]);
  assert.deepEqual(links.map(link=>link.url),[homepage+"user-docs",homepage+"pricing"]);
  for(const url of ["/user-docs/account","/user-docs/delete","/user-docs?token=x","/user/docs","/users/docs","/user-docs-private/forms"])
    assert.equal(researchDestination(url,homepage),null,url);
  assert.equal(selectResearchLinks(homepage,[{href:"/demo",text:"Live demo"},{href:"/docs",text:"Documentation"}])[0].kind,"docs","documentation establishes behavior for the homepage's already captured visuals");
});

test("documentation followup selects only observed related task guides under the same destination guards", () => {
  const anchors=[{href:"/user-docs/publish-workflow",text:"Publish your workflow"},{href:"/docs/install",text:"Install your workflow"},{href:"/user-docs/create-form",text:"Create a form"},{href:"/account/workflow",text:"Publish workflow"},{href:"https://other.example/docs/workflow",text:"Publish workflow"},{href:"/user-docs/workflow?token=secret",text:"Publish workflow"}];
  assert.equal(selectDocumentationFollowup(homepage,homepage+"user-docs",anchors,"Workflow automation for your team")?.url,homepage+"user-docs/publish-workflow");
  assert.deepEqual(selectDocumentationFollowup(homepage,homepage+"user-docs",anchors,"Workflow automation for your team"),selectDocumentationFollowup(homepage,homepage+"user-docs",[...anchors].reverse(),"Workflow automation for your team"));
  assert.equal(selectDocumentationFollowup(homepage,homepage+"user-docs",[{href:"/docs/install",text:"Install with Docker"},{href:"/docs/intro",text:"API overview"},{href:"/user-docs",text:"Workflow guides"}],"Workflow"),undefined);
});

test("observed action-guide labels outrank passive features despite greater homepage overlap", () => {
  // Labels observed in Plausible's docs; synthetic URLs isolate selection from
  // capture. Production must still discover every destination from its page.
  const anchors=[
    {href:"/docs/consolidated",text:"Consolidated View",index:40},
    {href:"/docs/filters",text:"Filter and segment your audience",index:37},
    {href:"/docs/scroll",text:"Automatic scroll depth tracking",index:43},
  ];
  const hints="Consolidated view of all sites. Automatic scroll depth tracking. One readable dashboard.";
  const expected={url:homepage+"docs/filters",kind:"docs",anchorText:"Filter and segment your audience",anchorIndex:37};
  assert.deepEqual(selectDocumentationFollowup(homepage,homepage+"docs",anchors,hints),expected);
  assert.deepEqual(selectDocumentationFollowup(homepage,homepage+"docs",[...anchors].reverse(),hints),expected);
  assert.equal(selectDocumentationFollowup(homepage,homepage+"docs",anchors.filter(anchor=>anchor.href!=="/docs/filters"),"Consolidated view")?.url,homepage+"docs/consolidated","an unavailable action guide is never synthesized");
});

test("task-guide priority retains relevant action selection and observed-anchor limits", () => {
  const anchors=[{href:"/docs/create-form",text:"Create a form"},{href:"/docs/publish-workflow",text:"Publish your workflow"},{href:"/docs/edit-workflow",text:"Editing workflow steps"}];
  assert.equal(selectDocumentationFollowup(homepage,homepage+"docs",anchors,"Publish workflow automation")?.url,homepage+"docs/publish-workflow");
  const bounded=[{href:"/docs/overview",text:"Workflow overview"},...Array.from({length:299},(_,index)=>({href:`/legal/${index}`,text:"Legal notice"})),{href:"/docs/publish-workflow",text:"Publish your workflow"}];
  assert.equal(selectDocumentationFollowup(homepage,homepage+"docs",bounded,"Publish workflow")?.url,homepage+"docs/overview","a better guide outside the 300 observed-anchor cap is not inspected");
  assert.equal(selectDocumentationFollowup(homepage,homepage+"docs",[{href:"/docs/publish-workflow",text:"Publish your workflow",download:true}],"Publish workflow"),undefined);
});

test("actual Chromium replaces pricing with one observed documentation task while preserving page and byte caps", {skip:!integration,timeout:45000},async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-task-guide-"));for(const directory of ["assets","analysis"])await mkdir(join(workspace,directory));
  const requests:string[]=[];
  await captureProduct(homepage,workspace,{download:async(raw,maxBytes,_auth,_redirect,policy)=>{
    if(policy&&!policy(new URL(raw)))throw Error("Blocked fixture document");requests.push(raw);
    assert.ok([homepage,homepage+"user-docs",homepage+"user-docs/publish-workflow"].includes(raw));
    const links=raw===homepage?"<a href='/docs/index'>Developer docs</a><a href='/user-docs'>Knowledge base</a><a href='/pricing'>Pricing</a>":raw.endsWith("user-docs")?"<a href='/user-docs/publish-workflow'>Publish your workflow</a><a href='/docs/install'>Install with Docker</a>":"<a href='/user-docs/another'>Create another workflow</a>";
    const bytes=Buffer.from(`<html><title>Workflow product</title><body>${links}<p>${"Workflow automation for teams. ".repeat(25)}</p></body></html>`);assert.ok(bytes.length<=maxBytes);return {bytes,url:raw,status:200,contentType:"text/html",browserHeaders:{}};
  }});
  assert.deepEqual(requests,[homepage,homepage+"user-docs",homepage+"user-docs/publish-workflow"]);
  const report=JSON.parse(await readFile(join(workspace,"analysis/research-sources.json"),"utf8"));
  assert.equal(report.sources[2].discoveredOn,homepage+"user-docs");assert.equal(report.sources[2].anchorText,"Publish your workflow");assert.equal(report.limits.followupPages,2);assert.equal(report.sources.length,3);assert.ok(report.aggregateTextCharacters<=45000);
});
test("research prioritizes observed feature links before pricing deterministically, not invented URLs", () => {
  const anchors = [{ href: "/features/team", text: "Team features" }, { href: "/pricing", text: "Pricing" }, { href: "/product", text: "Product" }, { href: "/legal", text: "Privacy" }];
  assert.deepEqual(selectResearchLinks(homepage, anchors).map(link => link.url), ["https://product.example/features/team", "https://product.example/pricing"]);
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
  assert.deepEqual(result.map(link => link.url), ["https://product.example/features", "https://product.example/pricing"]);
  assert.equal(result[0].anchorIndex, 5);
});

test("research discovery is limited to two selected pages and 300 observed anchors", () => {
  const anchors = Array.from({ length: 310 }, (_, i) => ({ href: `/features/${i}`, text: i < 300 ? "Legal notice" : "Features" }));
  assert.deepEqual(selectResearchLinks(homepage, anchors), []);
  assert.equal(selectResearchLinks(homepage, Array.from({ length: 20 }, (_, i) => ({ href: `/features/${i}`, text: "Features" }))).length, 2);
});

test("observed public docs/demo child hosts qualify without registrable-domain guessing or unrelated crawl", () => {
  assert.equal(researchDestination("https://help.product.example/guide", homepage), "https://help.product.example/guide");
  assert.equal(researchDestination("https://docs.product.example/start", "https://www.product.example/"), "https://docs.product.example/start");
  for (const target of ["https://product.example.attacker.test/docs", "https://other.example/docs", "http://docs.product.example/help", "https://auth.product.example/help", "https://docs.product.example/account", "https://docs.product.example/guide?token=x"]) assert.equal(researchDestination(target, homepage), null, target);
  assert.equal(researchDestination("https://other.co.uk/docs", "https://product.co.uk/"), null);
  assert.equal(researchDestination("https://example.com/docs", "https://product.example.com/"), null);
  const links = selectResearchLinks(homepage, [{ href: "https://help.product.example/guide", text: "Documentation" }, { href: "/pricing", text: "Pricing" }, { href: "/features", text: "Features" }, { href: "https://other.example/docs", text: "Help" }]);
  assert.deepEqual(links.map(link => [link.kind, link.url]), [["docs", "https://help.product.example/guide"], ["features", "https://product.example/features"]]);
  assert.deepEqual(selectResearchLinks(homepage, [{ href: "/demo", text: "Live demo" }]).map(link => link.kind), ["demo"]);
  assert.equal(selectResearchLinks(homepage, [{ href: "https://docs.product.example/", text: "Developer docs" }, { href: "https://help.product.example/", text: "Help" }])[0].url, "https://help.product.example/");
  assert.equal(selectResearchLinks(homepage, [{ href: "/canvas", text: "A limitless playground for your ideas" }]).length, 0);
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
  for (redirect of ["https://external.example/pricing", "https://93.184.216.34.attacker.example/docs", "/auth/signin", "/checkout", "/pricing?buy=1"]) {
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

test("actual Chromium retains public brand and complete product panels with distinct pricing provenance", { skip: !integration, timeout: 45000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-brand-panels-"));
  for (const directory of ["assets", "analysis"]) await mkdir(join(workspace, directory));
  const requests: string[] = [];
  const result = await captureProduct(homepage, workspace, { download: async (raw, maxBytes, _auth, _redirect, policy) => {
    if (policy && !policy(new URL(raw))) throw new Error("Blocked fixture document");
    requests.push(raw);
    assert.ok([homepage, "https://docs.product.example/guide", homepage + "pricing"].includes(raw), raw);
    const header = `<header><a href='/'><svg class='brand-logo' aria-label='Fixture mark' width='160' height='48' viewBox='0 0 160 48'><rect x='0' y='0' width='48' height='48' fill='#6c41bb'/><text x='54' y='32' fill='#222'>Fixture</text></svg></a></header>`;
    const links = `<a href='https://docs.product.example/guide'>Documentation</a><a href='/pricing'>Pricing</a><a href='https://other.example/docs'>Help</a>`;
    const panel = `<section><h2>Editor demonstration</h2><div class='product-editor' style='width:800px;height:400px;background:#ece7ff;border:2px solid #6c41bb'><aside>Files</aside><h3>Example note</h3><p>Actual visible synthetic fixture content.</p><p>Public demonstration panel.</p></div></section>`;
    const body = Buffer.from(`<!doctype html><html lang='en-US'><title>Fixture product</title><meta name='description' content='An offline capture fixture'><style>body{font-family:Arial,sans-serif;color:#222;background:#fff}h1{color:#6c41bb}a{color:#6c41bb}</style><body>${header}<h1>Fixture product</h1>${links}<p>${"Accessible product information. ".repeat(20)}</p>${raw.endsWith("pricing") ? "<h2>Pricing</h2><p>Published plan options.</p>" : panel}</body></html>`);
    assert.ok(body.length <= maxBytes);
    return { bytes: body, url: raw, status: 200, contentType: "text/html", browserHeaders: {} };
  } });
  assert.deepEqual(requests, [homepage, "https://docs.product.example/guide", homepage + "pricing"]);
  assert.equal(result.url, homepage); assert.equal(result.brand?.language, "en-US");
  assert.equal(result.brand?.logoAssetIds.length, 1);
  assert.ok(result.brand?.colors.some(color => color.value === "rgb(108, 65, 187)"));
  assert.ok(result.brand?.typography.some(type => type.family.includes("Arial")));
  const focused = result.assets.filter(asset => asset.provenance?.role === "product-ui-candidate");
  assert.ok(focused.length >= 2 && focused.length <= 4);
  assert.ok(focused.every(asset => asset.provenance?.method === "element" && asset.width >= 800 && asset.height >= 400));
  assert.ok(focused.some(asset => asset.provenance?.pageKind === "docs"));
  assert.ok(result.assets.filter(asset => asset.provenance?.pageKind === "pricing").every(asset => asset.provenance?.role === "marketing"));
  assert.ok(result.assets.length <= 10);
  assert.equal(new Set(result.assets.map(asset => asset.id)).size, result.assets.length);
  assert.ok(result.artifactPaths.includes("analysis/brand-evidence.json"));
});

test("actual Chromium research shares the homepage byte budget, retains homepage on optional failure, and persists provenance", { skip: !integration, timeout: 45000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "video-studio-research-"));
  for (const directory of ["assets", "analysis"]) await mkdir(join(workspace, directory));
  const requests: string[] = [], reservations: number[] = [];
  const html = (title: string, body: string) => Buffer.from(`<!doctype html><title>${title}</title><body><h1>${title}</h1><p>${body}</p></body>`);
  const home = html("Fixture product", `<a href='/pricing'>Pricing</a> <a href='/features'>Features</a> <a href='/account'>Account</a> ${"A real public product description. ".repeat(20)}`);
  const features = html("Fixture features", "This source demonstrates a public product feature. ".repeat(40));
  const bytesAllowed = home.length + features.length;
  const result = await captureProduct(homepage, workspace, { downloadBudget: new CaptureDownloadBudget(bytesAllowed, bytesAllowed, 1), download: async (raw, maxBytes, _auth, _redirect, policy) => {
    requests.push(raw); reservations.push(maxBytes);
    if (policy && !policy(new URL(raw))) throw new Error("Blocked research document");
    const bytes = raw === homepage ? home : raw === homepage + "features" ? features : (() => { throw new Error("Unexpected or over-budget fixture request"); })();
    return { bytes, url: raw, status: 200, contentType: "text/html", browserHeaders: {} };
  } });
  assert.equal(result.url, homepage);
  assert.ok(result.text.includes("Fixture product") && result.text.includes("Fixture features"));
  assert.ok(result.text.length <= 45000);
  assert.ok(result.assets.some(asset => asset.id === "capture-0"));
  assert.equal(result.assets.filter(asset => asset.id.startsWith("research-page-")).length, 1);
  assert.ok(result.artifactPaths.includes("analysis/research-sources.json"));
  assert.deepEqual(requests, [homepage, homepage + "features"]);
  assert.deepEqual(reservations, [bytesAllowed, features.length]);
  const manifest = JSON.parse(await readFile(join(workspace, "analysis/research-sources.json"), "utf8"));
  assert.equal(manifest.sources[1].status, "captured");
  assert.equal(manifest.sources[1].url, homepage + "features");
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
  assert.deepEqual(requests, [homepage, homepage + "features", homepage + "pricing"]);
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
