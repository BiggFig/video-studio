import type { MotionStudy } from './types';

const mark = (id: string) => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="32" cy="32" r="29"/></clipPath></defs><g clip-path="url(#${id})" fill="currentColor"><path d="M3 3h58v58H3z"/><path d="M-9 15L49 73M-9 26L38 73M-9 37L27 73M-9 48L16 73" stroke="var(--mark-cut,#08090a)" stroke-width="4.8"/></g></svg>`;
const up = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 25V7M8 15l8-8 8 8"/></svg>';
const diagonal = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 25L25 7M8 7h17v17"/></svg>';
const branch = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="8" cy="6" r="3"/><circle cx="24" cy="9" r="3"/><circle cx="8" cy="26" r="3"/><path d="M8 9v14M24 12c0 9-16 2-16 11"/></svg>';
const leftArrow = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M27 16H5M13 8l-8 8 8 8"/></svg>';
const chevron = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg>';
const cube = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10"/></svg>';
const paperclip = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 15l7-7a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9"/></svg>';

export const linearStudy: MotionStudy = {
  id: 'linear-motion', title: 'Linear — the issue becomes the work',
  width: 1920, height: 1080, fps: 30, durationFrames: 540,
  reference: { path: '', startSeconds: 0, durationSeconds: 18 },
  reviewFrames: [0, 22, 37, 55, 73, 93, 112, 135, 163, 190, 198, 208, 220, 243, 280, 299, 322, 345, 369, 391, 417, 444, 462, 481, 509, 539],
  notes: [
    'ASSISTED SOURCE INPUTS / manually authored HTML and SVG film. No automatic URL-only acceptance or live authenticated product operation is claimed.',
    'Verified 2026-10-03: https://linear.app/brand prefers monochrome; official Mercury White #F4F5F8 and Nordic Gray #222326. Retained official homepage DOM evidence records #08090A background, #F7F8F8 text and #D0D6E0 control accent. No added neon or arbitrary violet palette.',
    'Brand source: .local/software-launch-capture-linear-1791033383211/analysis/brand-evidence.json. Product source: https://linear.app/ and .local/launch-linear-sourcepack-20261003/fixture.json; source crop SHA256 463d4e91c497fa5c933f267e80404c1055804fd2f1cea39d1c4775327b8905eb.',
    'The source establishes delegation of implementation work and the observed result Pushed and opened a draft PR. Request, DRV-364 context, draft title, two files, +22/-10 and branch relationship follow the retained official example. No merged, shipped, tested or performance claim is added.',
    'Opening task title abbreviates the observed request; it is an editorial task card, not an assertion that the unrelated left-side issue title in the original marketing capture matches this agent pane.',
    '0.00-1.00s / F0-29: the task is the entire composition. Linear and the product-builder audience are visible immediately; no decorative objects.',
    '1.00-2.00s / F30-59: the same title contracts approximately 2.3x, its surface closes into a compact issue card, and the camera tracks left. A crisp acceleration and physical scale change introduce the UI.',
    '2.00-3.20s / F60-95: the issue surface unfolds sideways into the agent composer. Its task becomes the DRV-364 context chip; no detached wipe or unrelated overlay drives the transition.',
    '3.20-6.50s / F96-194: a 1.22x travelling camera follows three meaningful chunks of the exact request. After the complete request is readable, a 12-frame acceleration reframes the actual send control at 3x scale (198px screen diameter). The cursor travels only to that source control.',
    '6.50-7.70s / F195-230: the send control compresses on click. A muted expanding surface mask originates at that control and reveals the observed response; this is illustrative timing, not measured execution speed.',
    '7.70-9.50s / F231-284: the actual draft PR result holds clearly for about 1.8s. Draft remains explicit. The result card is the continuous subject for the next shot.',
    '9.50-12.00s / F285-359: the camera catches that same PR card and separates its three existing information layers in depth: changed files, draft identity and branch. It is an editorial exploded view, not an invented application feature or code diff.',
    '12.00-14.70s / F360-440: the separated layers travel back onto one axis and reassemble on a Mercury White review canvas. A large from-issue/to-draft statement sits above the same dark card. No new review controls are invented.',
    '14.70-16.00s / F441-479: the card contracts into the closing brand anchor while the camera pulls clear. One meaningful object transforms, rather than particles or floating slogans.',
    '16.00-18.00s / F480-539: Linear, Get started and linear.app hold still and readable. The preceding product choreography earns this final pause.',
    'All symbols use explicit SVG geometry, not fallback Unicode arrows. Local Geist and the manually authored logomark approximate the official typography/geometry; not exact official artwork. No timers, random values, CSS animation or provider-generated executable content.',
    'Audio and final export are handled by the coordinator. This source has no music or sound quality certification.',
  ],
  html: `<div id="lm-dark"></div><div id="lm-review-ground"></div>
    <div id="lm-top"><div>${mark('lm-logo-top')}<span>Linear</span></div><span id="lm-audience">For product builders</span></div>
    <div id="lm-issue-trace"></div>
    <div id="lm-surface">
      <div id="lm-surface-rim"></div>
      <div id="lm-task-meta"><span class="lm-issue-icon"></span><b>DRV-364</b><span>THE TASK</span></div>
      <div id="lm-task-title">Fix the dimmed<br>ride rows.</div>
      <div id="lm-task-footer">A clear issue. A concrete next step.</div>
      <div id="lm-agent-header"><div>${mark('lm-logo-agent')}<b>Linear</b><span>Opus 5</span></div><div class="lm-window-tools"><span></span>${diagonal}</div></div>
      <div id="lm-context"><span class="lm-issue-icon"></span><b>DRV-364</b><span>added to context</span></div>
      <div id="lm-composer"><div id="lm-request"><span id="lm-typed"></span><i id="lm-caret"></i></div><div class="lm-tools">${cube}<span>Skills</span>${chevron}</div><div class="lm-attach">${paperclip}</div><div id="lm-send">${up}</div></div>
      <div id="lm-send-wipe"></div>
      <div id="lm-answer"><div class="lm-answer-label">LINEAR</div><div>Pushed and opened<br><strong>a draft PR.</strong></div></div>
    </div>
    <div id="lm-step-label"><span id="lm-step-number">01</span><i></i><span id="lm-step-copy">The issue</span></div>
    <svg id="lm-pointer" viewBox="0 0 50 60" aria-hidden="true"><path d="M5 4L42 32L26 35L36 52L27 57L17 39L6 49Z" fill="#F4F5F8" stroke="#08090A" stroke-width="2.6" stroke-linejoin="round"/></svg>
    <div id="lm-pr-shadow"></div><div id="lm-pr">
      <div id="lm-pr-rim"></div>
      <div id="lm-pr-files" class="lm-pr-layer"><span>Changed <b>2 files</b></span><div class="lm-diff"><b>+22</b><span>-10</span></div><div class="lm-preview">Preview ${diagonal}</div></div>
      <div id="lm-pr-title" class="lm-pr-layer">${branch}<span class="lm-draft-badge">Draft</span><b>Reset dimmed ride rows</b></div>
      <div id="lm-pr-branch" class="lm-pr-layer"><span>master</span>${leftArrow}<span>ride/drv-364-reset-dimmed-rows</span></div>
    </div>
    <div id="lm-review-copy"><span>THE WORK, MADE REVIEWABLE</span><div>A draft.<br>For review.</div></div>
    <div id="lm-assembled-copy"><span>ONE CONTINUOUS WORKFLOW</span><div>From issue to draft PR.</div></div>
    <div id="lm-close"><div id="lm-close-brand">${mark('lm-logo-close')}<span>Linear</span></div><div id="lm-cta">Get started ${diagonal}</div><div id="lm-url">linear.app</div></div>
    <div id="lm-note">Illustrative product demonstration</div>`,
  css: `
    #stage{background:#08090a;color:#f4f5f8;letter-spacing:-.035em;font-weight:470;--mark-cut:#08090a}
    svg{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    #lm-dark,#lm-review-ground{position:absolute;inset:0}#lm-dark{background:#08090a}#lm-review-ground{background:#f4f5f8;transform-origin:left center}
    #lm-top{position:absolute;left:96px;right:96px;top:63px;display:flex;align-items:center;justify-content:space-between;z-index:20;color:#f4f5f8;letter-spacing:-.025em}#lm-top>div{display:flex;align-items:center;gap:12px;font-size:38px;font-weight:560}#lm-top svg{width:38px;height:38px;stroke:none}#lm-audience{font-size:25px;color:#a4a8b1;font-weight:450;letter-spacing:-.01em}
    #lm-surface{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;background:#151618;border:1px solid #34363b;border-radius:24px;box-shadow:0 35px 75px #0005;color:#f4f5f8}#lm-surface-rim{position:absolute;inset:1px;border-radius:23px;border:1px solid #ffffff05;pointer-events:none}#lm-issue-trace{position:absolute;left:0;top:0;border:1px solid #34363b;border-radius:23px;transform-origin:0 0;background:#0d0e10}
    #lm-task-meta{position:absolute;left:54px;top:35px;display:flex;align-items:center;gap:12px;font-size:23px;letter-spacing:.01em;color:#c2c6cf}#lm-task-meta b{font-weight:500}#lm-task-meta>span:last-child{margin-left:20px;font-size:17px;letter-spacing:.1em;color:#787d87}.lm-issue-icon{width:19px;height:19px;border-radius:50%;border:2px solid #a0a6b2;display:inline-block;flex:none;position:relative}.lm-issue-icon:after{content:'';position:absolute;left:7px;top:2px;width:2px;height:9px;background:#a0a6b2;border-radius:1px}
    #lm-task-title{position:absolute;left:54px;top:88px;font-size:146px;line-height:.98;font-weight:550;letter-spacing:-.065em;white-space:nowrap;transform-origin:0 0}#lm-task-footer{position:absolute;left:56px;bottom:27px;font-size:21px;color:#8f949d;letter-spacing:-.015em}
    #lm-agent-header{position:absolute;left:56px;right:52px;top:34px;display:flex;justify-content:space-between;align-items:center;height:53px}#lm-agent-header>div:first-child{display:flex;align-items:center;gap:12px;font-size:32px}#lm-agent-header svg{width:30px;height:30px;stroke:none;--mark-cut:#151618}#lm-agent-header b{font-weight:550}#lm-agent-header span{font-size:20px;color:#a4a7af;border:1px solid #3b3d43;border-radius:5px;padding:4px 8px;margin-left:6px}.lm-window-tools{display:flex;align-items:center;gap:27px;color:#8d919a}.lm-window-tools>span{width:14px;height:1px;background:#8d919a;border:0!important;padding:0!important}.lm-window-tools>svg{width:22px!important;height:22px!important;stroke:currentColor!important;stroke-width:1.8!important;fill:none}
    #lm-context{position:absolute;left:65px;top:137px;display:flex;align-items:center;gap:11px;height:39px;font-size:25px;letter-spacing:-.025em;color:#9da3af}#lm-context b{font-weight:520;color:#d0d6e0}#lm-context>span:last-child{font-size:22px;color:#7a808b}
    #lm-composer{position:absolute;left:56px;right:56px;top:211px;bottom:54px;border:1px solid #545963;border-radius:18px;background:#222326;box-shadow:0 1px 0 #ffffff08 inset;overflow:hidden}#lm-request{position:absolute;left:37px;right:100px;top:32px;white-space:pre-wrap;font-size:56px;line-height:1.25;letter-spacing:-.035em;font-weight:520;color:#f4f5f8}#lm-caret{display:inline-block;width:3px;height:54px;background:#d0d6e0;vertical-align:-8px;margin-left:2px}.lm-tools{position:absolute;left:33px;bottom:31px;display:flex;align-items:center;gap:9px;color:#a5abb6;font-size:25px}.lm-tools svg{width:24px;height:24px}.lm-tools svg:last-child{width:18px;height:18px}.lm-attach{position:absolute;right:128px;bottom:36px;color:#b8bfca}.lm-attach svg{width:28px;height:28px}#lm-send{position:absolute;right:28px;bottom:24px;width:66px;height:66px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#3b3e45;border:1px solid #565b66;color:#eef0f4;transform-origin:center}#lm-send svg{width:35px;height:35px;stroke-width:2.2}
    #lm-send-wipe{position:absolute;inset:0;background:#222326;pointer-events:none}#lm-answer{position:absolute;left:64px;top:131px}.lm-answer-label{font-size:18px;letter-spacing:.14em;color:#9da3ae;margin-bottom:16px}#lm-answer>div:last-child{font-size:60px;font-weight:470;letter-spacing:-.04em;line-height:1.1}#lm-answer strong{font-weight:540}
    #lm-step-label{position:absolute;left:97px;bottom:96px;display:flex;align-items:center;gap:17px;z-index:13;font-size:22px;letter-spacing:-.02em;color:#858b95}#lm-step-number{font:500 18px Studio;letter-spacing:.025em;color:#d0d6e0}#lm-step-label i{width:42px;height:1px;background:#464b54}#lm-pointer{position:absolute;left:0;top:0;width:43px;height:52px;transform-origin:5px 4px;z-index:15;stroke:none}
    #lm-pr{position:absolute;left:0;top:0;width:1280px;height:244px;transform-origin:0 0;transform-style:preserve-3d;z-index:8;color:#f4f5f8;letter-spacing:-.025em}#lm-pr-rim{position:absolute;inset:0;border:1px solid #4c5058;border-radius:14px;box-shadow:0 32px 75px #0004}.lm-pr-layer{position:absolute;left:0;right:0;display:flex;align-items:center;padding:0 32px;background:#222326;border:1px solid #444951;transform-origin:center;backface-visibility:hidden}#lm-pr-files{top:0;height:74px;border-radius:14px 14px 0 0;font-size:27px;color:#aeb5c1;gap:13px}#lm-pr-files b{font-weight:560;color:#e8ebf0}.lm-diff{display:flex;gap:10px;margin-left:2px}.lm-diff b{color:#61ac7e!important;font-weight:500!important}.lm-diff>span{color:#bc777b}.lm-preview{display:flex;align-items:center;gap:10px;margin-left:auto;border:1px solid #4d525a;border-radius:6px;font-size:21px;padding:4px 12px;color:#c8cdd6}.lm-preview svg{width:20px;height:20px}
    #lm-pr-title{top:73px;height:99px;font-size:38px;gap:14px}#lm-pr-title>svg{width:35px;height:35px;color:#bbc4d3}.lm-draft-badge{color:#aeb7c5;font-size:31px}#lm-pr-title>b{font-weight:530}#lm-pr-branch{top:171px;height:73px;border-radius:0 0 14px 14px;gap:20px;font-size:24px;font-family:Studio;letter-spacing:.015em;color:#909aaa}#lm-pr-branch svg{width:25px;height:25px;color:#a6afbd}#lm-pr-shadow{position:absolute;width:1280px;height:244px;border-radius:16px;background:#0003;filter:blur(20px);transform-origin:0 0;z-index:5}
    #lm-review-copy{position:absolute;left:111px;top:222px;color:#f4f5f8;z-index:9}#lm-review-copy>span,#lm-assembled-copy>span{display:block;font-size:18px;letter-spacing:.11em;color:#a0a7b2;margin-bottom:25px}#lm-review-copy>div{font-size:82px;font-weight:510;line-height:1.01;letter-spacing:-.06em}#lm-assembled-copy{position:absolute;left:172px;top:191px;color:#222326;z-index:9}#lm-assembled-copy>span{color:#777e89}#lm-assembled-copy>div{font-size:93px;letter-spacing:-.06em;font-weight:520}
    #lm-close{position:absolute;inset:0;z-index:12;color:#222326;--mark-cut:#f4f5f8}#lm-close-brand{position:absolute;left:50%;top:330px;display:flex;align-items:center;gap:25px;width:max-content;font-size:170px;line-height:1.15;letter-spacing:-.065em;font-weight:570}#lm-close-brand svg{width:143px;height:143px;stroke:none}#lm-cta{position:absolute;left:50%;top:608px;display:flex;gap:35px;align-items:center;width:max-content;font-size:46px;letter-spacing:-.035em;padding-bottom:15px;border-bottom:1px solid #b3b8c0;font-weight:490}#lm-cta svg{width:33px;height:33px}#lm-url{position:absolute;left:50%;top:744px;transform:translateX(-50%);font-size:25px;letter-spacing:-.01em;color:#7a818c}#lm-note{position:absolute;right:80px;bottom:35px;z-index:25;font-size:14px;letter-spacing:.02em;color:#787e88}
  `,
  script: `
    function draw(frame){
      const f=Math.max(0,Math.min(539,Math.round(frame)));
      const el=id=>document.getElementById(id),c=v=>Math.max(0,Math.min(1,v)),p=(a,b)=>c((f-a)/(b-a)),s=t=>t*t*(3-2*t),o=t=>1-Math.pow(1-t,4),mix=(a,b,t)=>a+(b-a)*t;
      const alpha=(id,v)=>{el(id).style.opacity=String(c(v));el(id).style.visibility=v<=0?'hidden':'visible';};
      const pose=(id,x,y,scale=1,rz=0,ry=0,rx=0)=>{el(id).style.transform='translate('+x+'px,'+y+'px) perspective(1800px) rotateX('+rx+'deg) rotateY('+ry+'deg) rotate('+rz+'deg) scale('+scale+')';};
      // Every property below derives from f, including hidden sections and child layers.
      const card=o(p(29,57)),unfold=o(p(61,96)),camera=s(p(96,115)),send=p(195,204),result=o(p(207,229)),explosion=s(p(286,323)),assembly=s(p(359,391)),close=s(p(441,478));
      const light=s(p(365,391));el('lm-review-ground').style.clipPath='inset(0 '+((1-light)*100)+'% 0 0)';
      const topExit=p(441,458);alpha('lm-top',(1-topExit)*(1-s(p(116,143))*(1-result)));el('lm-top').style.color=light>.12?'#222326':'#f4f5f8';el('lm-top').style.setProperty('--mark-cut',light>.12?'#f4f5f8':'#08090a');
      let x=mix(114,172,card),y=mix(225,376,card),w=mix(1690,744,card),h=mix(600,292,card),ry=mix(0,-9,card),rz=mix(0,-3,card);
      x=mix(x,216,unfold);y=mix(y,230,unfold);w=mix(w,1488,unfold);h=mix(h,622,unfold);ry=mix(ry,0,unfold);rz=mix(rz,0,unfold);
      x=mix(x,128,camera);y=mix(y,208,camera);w=mix(w,1664,camera);h=mix(h,684,camera);
      x=mix(x,224,result);y=mix(y,180,result);w=mix(w,1472,result);h=mix(h,682,result);
      const words=s(p(116,148)),aim=s(p(181,193)),viewScale=1+(words*.22+aim*1.78)*(1-result);x+=(-114*words-3255*aim)*(1-result);y+=(-266*words-1001*aim)*(1-result);
      const surfaceExit=s(p(286,308));pose('lm-surface',x-190*surfaceExit,y+25*surfaceExit,viewScale*(1-.15*surfaceExit),rz-3*surfaceExit,ry,0);el('lm-surface').style.width=w+'px';el('lm-surface').style.height=h+'px';el('lm-surface').style.background=f<195?'#151618':'#222326';el('lm-surface').style.borderColor='rgba(75,79,88,'+card+')';el('lm-surface').style.boxShadow='0 35px 75px rgba(0,0,0,'+(.32*card)+')';alpha('lm-surface',1-surfaceExit);
      alpha('lm-surface-rim',card);alpha('lm-task-meta',card*(1-unfold));alpha('lm-task-footer',card*(1-unfold));alpha('lm-task-title',1-s(p(65,88)));el('lm-task-title').style.fontSize=mix(188,64,card)+'px';el('lm-task-title').style.top=mix(88,93,card)+'px';
      pose('lm-issue-trace',172+35*p(61,96),376-22*p(61,96),1,-3,-9,0);el('lm-issue-trace').style.width='744px';el('lm-issue-trace').style.height='292px';alpha('lm-issue-trace',p(50,58)*(1-p(66,87))*.7);
      alpha('lm-agent-header',p(77,94));alpha('lm-context',p(84,103)*(1-p(211,224)));alpha('lm-composer',p(83,104)*(1-p(203,214)));alpha('lm-answer',p(216,231));pose('lm-answer',0,mix(23,0,o(p(215,231))));
      // Meaningful word groups type in one input; the observed request is unchanged.
      const chunks=['Fix the dimmed ride rows','that never reset','and open a PR'];let text='';
      for(let i=0;i<3;i++){const a=[108,130,147][i],b=[127,143,163][i],n=Math.floor(chunks[i].length*s(p(a,b)));if(n>0)text+=(i===0?'':i===1?'\\n':' ')+chunks[i].slice(0,n);}
      el('lm-typed').textContent=text;alpha('lm-caret',f>=108&&f<195?1:0);
      const pressed=f>=195&&f<204?Math.sin(Math.PI*send):0;pose('lm-send',0,0,1-.13*pressed);el('lm-send').style.background=f>=167?'#d0d6e0':'#3b3e45';el('lm-send').style.color=f>=167?'#17191d':'#eef0f4';
      const sx=x+viewScale*(w-56-28-33),sy=y+viewScale*(h-54-24-33),travel=o(p(174,192));pose('lm-pointer',mix(1750,sx-5,travel),mix(975,sy-4,travel),1-.09*pressed);alpha('lm-pointer',p(174,182)*(1-p(202,209)));
      const radius=1850*o(p(200,218));el('lm-send-wipe').style.clipPath='circle('+radius+'px at '+(w-117)+'px '+(h-111)+'px)';alpha('lm-send-wipe',f>=200?(1-p(219,229)):0);
      let px=mix(288,598,explosion),py=mix(527,470,explosion),ps=mix(1,.85,explosion),pry=mix(0,-10,explosion),prx=mix(0,7,explosion),prz=mix(0,-4,explosion);
      px=mix(px,210,assembly);py=mix(py,441,assembly);ps=mix(ps,1.17,assembly);pry=mix(pry,0,assembly);prx=mix(prx,0,assembly);prz=mix(prz,0,assembly);
      px=mix(px,636,close);py=mix(py,410,close);ps=mix(ps,.11,close);
      pose('lm-pr',px,py+mix(26,0,o(p(220,239))),ps,prz,pry,prx);alpha('lm-pr',p(220,234)*(1-p(463,478)));alpha('lm-pr-rim',(1-explosion)*(1-close)+assembly*(1-close));
      const gap=explosion*(1-assembly),layer=(id,dy,dz,rot)=>{el(id).style.transform='translate3d(0,'+dy+'px,'+dz+'px) rotate('+rot+'deg)';};
      layer('lm-pr-files',-156*gap,82*gap,-1.6*gap);layer('lm-pr-title',0,150*gap,0);layer('lm-pr-branch',160*gap,28*gap,1.3*gap);
      pose('lm-pr-shadow',px+10,py+45,ps,prz,pry,0);alpha('lm-pr-shadow',p(220,234)*(1-p(286,312))*.6+assembly*(1-close)*.23);
      alpha('lm-review-copy',p(300,321)*(1-p(351,372)));pose('lm-review-copy',mix(-32,0,o(p(300,321))),0);
      alpha('lm-assembled-copy',p(376,392)*(1-p(435,454)));pose('lm-assembled-copy',0,mix(30,0,o(p(375,392)))-70*s(p(435,454)));
      alpha('lm-close',p(459,477));el('lm-close-brand').style.transform='translate(-50%,'+mix(44,0,o(p(459,479)))+'px)';alpha('lm-cta',p(475,487));el('lm-cta').style.transform='translate(-50%,'+mix(16,0,o(p(475,488)))+'px)';alpha('lm-url',p(484,497));
      const step=f<61?['01','The issue']:f<207?['02','Delegate in Linear']:f<285?['03','A draft PR']:['04','Ready for review'];el('lm-step-number').textContent=step[0];el('lm-step-copy').textContent=step[1];alpha('lm-step-label',1-p(435,456));el('lm-step-number').style.color=light>.5?'#515967':'#d0d6e0';
      el('lm-note').style.color=light>.5?'#747c87':'#787e88';
    }
  `,
};
