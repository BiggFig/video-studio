import type { MotionStudy } from './types';

// Authored assisted-source film. The pane below is HTML/SVG, not a screenshot.
const mark = (name: string) => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="${name}"><circle cx="32" cy="32" r="29"/></clipPath></defs><g clip-path="url(#${name})" fill="currentColor"><path d="M3 3h58v58H3z"/><path d="M-9 15L49 73M-9 26L38 73M-9 37L27 73M-9 48L16 73" stroke="var(--logo-cut,#101114)" stroke-width="4.8"/></g></svg>`;
const arrowUp = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 25V7M8 15l8-8 8 8" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const branch = '<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="7" cy="5" r="3"/><circle cx="21" cy="8" r="3"/><circle cx="7" cy="23" r="3"/><path d="M7 8v12M21 11c0 7-14 1-14 9"/></svg>';
const pr = (id: string) => `<div class="ln-pr-card" id="${id}"><div class="ln-pr-meta"><span>Changed <b>2 files</b></span><span class="ln-diff"><b>+22</b><em>−10</em></span><span class="ln-preview">⌕&nbsp; Preview</span></div><div class="ln-pr-title">${branch}<span class="ln-draft">Draft</span><strong>Reset dimmed ride rows</strong></div><div class="ln-branch">master <span>←</span> ride/drv-364-reset-dimmed-rows</div></div>`;

export const linearStudy: MotionStudy = {
  id: 'linear', title: 'Linear — from a clear issue to a draft PR',
  width: 1920, height: 1080, fps: 30, durationFrames: 720,
  reference: { path: '', startSeconds: 0, durationSeconds: 24 },
  reviewFrames: [0, 18, 40, 68, 90, 118, 144, 164, 174, 195, 223, 255, 300, 344, 363, 395, 445, 476, 510, 565, 590, 620, 660, 719],
  notes: [
    'ASSISTED SOURCE INPUTS / manually authored film, not an automatic URL-only acceptance pass.',
    'Source pack: .local/launch-linear-sourcepack-20261003/fixture.json; official public source https://linear.app/.',
    'All visible product UI is authored HTML/SVG from the verified agent-pane crop. No source screenshot or source-video pixels are rendered.',
    'Illustrative sequence: an observed request is entered through the evidenced reply/send control; the observed draft-PR result appears. No authenticated operation is asserted.',
    'The result is a draft pull request for review, not proof of merged, shipped or independently tested code. Diff numbers are the original displayed example, not a general metric.',
    'Peripheral window chrome and the implementation-detail sentence are omitted. The complete first result sentence and draft PR identity are preserved; no capability is added.',
    'Linear mark is a manually authored SVG approximation and Geist is the local typeface; no claim of exact official brand geometry.',
    'Deterministic 720-frame choreography, no CSS animation, timers, randomness or untrusted executable content. Root supplies soundtrack separately.',
  ],
  html: `
  <div id="ln-dark"><div class="ln-grid"></div><div class="ln-side-light"></div></div>
  <div id="ln-cream"></div>
  <div id="ln-topmark">${mark('ln-top-logo')}<span>Linear</span></div>
  <div id="ln-hook"><div class="ln-kicker">FOR PRODUCT BUILDERS</div><div id="ln-hook-one">The issue<br>is clear.</div><div id="ln-hook-two">The work<br>is waiting.</div><div class="ln-hook-rule"><i></i></div></div>
  <div id="ln-direct"><div class="ln-kicker">01 &nbsp; DELEGATE</div><div id="ln-direct-title">Give it<br>a task.</div><div class="ln-direct-foot">Inside Linear.</div></div>
  <div id="ln-result-copy"><div class="ln-kicker">02 &nbsp; THE RESULT</div><div>A draft PR.</div><p>Ready for review.</p></div>
  <div id="ln-ui-camera"><div id="ln-pane">
    <div class="ln-pane-rim"></div>
    <div class="ln-pane-header"><div class="ln-pane-brand">${mark('ln-pane-logo')}<b>Linear</b><span>Opus 5</span></div><div class="ln-pane-tools"><i>−</i><i>↗</i><i>×</i></div></div>
    <div id="ln-request"><span>Fix the dimmed ride rows<br>that never reset and open a PR</span></div>
    <div id="ln-context"><span class="ln-context-dot">!</span> DRV-364 <span>added to context</span></div>
    <div id="ln-progress"><i></i><i></i><i></i></div>
    <div id="ln-result">Pushed and opened<br>a draft PR.</div>
    ${pr('ln-pr-inside')}
    <div id="ln-input"><div id="ln-input-copy"><span id="ln-typed"></span><i id="ln-caret"></i></div><span id="ln-input-placeholder">Reply…</span><span class="ln-input-skills"><svg viewBox="0 0 20 20" fill="none"><path d="M3 6l7-4 7 4v8l-7 4-7-4zM3 6l7 4 7-4M10 10v8" stroke="currentColor" stroke-width="1.5"/></svg> Skills⌄</span><span class="ln-input-attach">⌕</span><button id="ln-send" tabindex="-1" aria-label="Send request">${arrowUp}</button><div id="ln-send-ring"></div></div>
  </div></div>
  <svg id="ln-pointer" viewBox="0 0 50 60" aria-hidden="true"><path d="M5 4L42 32L26 35L36 52L27 57L17 39L6 49Z" fill="#faf9f5" stroke="#090b0e" stroke-width="2.8" stroke-linejoin="round"/></svg>
  <div id="ln-artifact-shadow"></div><div id="ln-artifact">${pr('ln-pr-free')}</div>
  <div id="ln-review-copy"><div class="ln-kicker">03 &nbsp; REVIEW</div><div>Work you<br>can review.</div></div>
  <div id="ln-detail-left"><span>THE TASK</span><b>A clear request.</b><div>Fix the dimmed ride rows.</div></div>
  <svg id="ln-connector" viewBox="0 0 1920 1080" aria-hidden="true"><path id="ln-connector-line" d="M575 585H745Q785 585 785 545V450Q785 410 830 410H900" fill="none" stroke="#8174b8" stroke-width="2" pathLength="1"/><circle id="ln-connector-dot" cx="900" cy="410" r="5" fill="#8174b8"/></svg>
  <div id="ln-detail-title">From issue<br>to draft PR.</div>
  <div id="ln-close"><div class="ln-close-brand">${mark('ln-close-logo')}<span>Linear</span></div><div id="ln-close-line"></div><div id="ln-close-cta">Get started <span>↗</span></div><div id="ln-close-url">linear.app</div></div>
  <div id="ln-source-note">Illustrative product demonstration</div>
  <div id="ln-frame-line"></div>
  `,
  css: `
  #stage{background:#eeede7;color:#151518;font-weight:430;letter-spacing:-.045em;--logo-cut:#101114}
  #ln-dark,#ln-cream{position:absolute;inset:0;pointer-events:none}#ln-dark{background:#0d1013;overflow:hidden}.ln-grid{position:absolute;inset:0;background:linear-gradient(90deg,transparent 49.95%,#bcb3e40d 50%,transparent 50.05%),linear-gradient(0deg,transparent 49.93%,#bcb3e40c 50%,transparent 50.07%);background-size:160px 160px;transform:perspective(1000px) rotateX(12deg) scale(1.12)}.ln-side-light{position:absolute;left:38%;top:-200px;width:900px;height:1600px;background:linear-gradient(90deg,transparent,#a59bd30b,transparent);transform:rotate(21deg)}#ln-cream{background:#eeede7;transform-origin:left center}
  #ln-topmark{position:absolute;left:110px;top:68px;display:flex;align-items:center;gap:13px;font-size:36px;letter-spacing:-.04em;z-index:12;--logo-cut:#eeede7}#ln-topmark svg{width:37px;height:37px}
  .ln-kicker{font-size:20px;letter-spacing:.14em;line-height:1.25;font-weight:570;color:#817d89}
  #ln-hook{position:absolute;left:111px;top:236px;z-index:5}#ln-hook-one,#ln-hook-two{font-size:112px;line-height:1.01;letter-spacing:-.065em;font-weight:510}#ln-hook-one{margin-top:30px}#ln-hook-two{margin-top:15px;color:#938c9d}.ln-hook-rule{margin-top:38px;width:147px;height:2px;background:#d1ccd6;overflow:hidden}.ln-hook-rule i{display:block;width:147px;height:2px;background:#8c7abe;transform-origin:left center}
  #ln-direct{position:absolute;left:113px;top:319px;color:#f2f0eb;z-index:4}#ln-direct-title{font-size:116px;line-height:1.02;letter-spacing:-.07em;margin-top:28px;font-weight:460}.ln-direct-foot{font-size:27px;letter-spacing:-.015em;margin-top:35px;color:#98959e}
  #ln-result-copy{position:absolute;left:114px;top:405px;color:#f0efeb;z-index:3}#ln-result-copy>div:nth-child(2){font-size:99px;letter-spacing:-.06em;margin-top:25px;line-height:1.05}#ln-result-copy p{font-size:35px;color:#a39ab7;letter-spacing:-.02em;margin:21px 0 0}
  #ln-ui-camera{position:absolute;left:0;top:0;transform-origin:0 0;z-index:6;will-change:transform}#ln-pane{position:relative;width:900px;height:760px;background:linear-gradient(135deg,#181b1e,#14171a 80%);border:1px solid #414148;border-radius:22px;color:#d5d8df;box-shadow:0 55px 100px #0008,0 1px 0 #fff1 inset;overflow:hidden;letter-spacing:-.025em}.ln-pane-rim{position:absolute;inset:1px;border-radius:20px;border:1px solid #fff03;pointer-events:none}.ln-pane-header{position:absolute;left:0;right:0;top:0;height:88px;display:flex;align-items:center;justify-content:space-between;padding:0 34px}.ln-pane-brand{display:flex;align-items:center;gap:12px;font-size:28px}.ln-pane-brand>svg{width:28px;height:28px}.ln-pane-brand>b{font-weight:540}.ln-pane-brand>span{font-size:18px;letter-spacing:-.01em;color:#9b9da4;border:1px solid #414148;border-radius:6px;padding:3px 8px;margin-left:2px}.ln-pane-tools{display:flex;gap:27px;font-size:26px;color:#8c8f97}.ln-pane-tools i{font-style:normal}
  #ln-request{position:absolute;left:75px;right:33px;top:114px;min-height:125px;border:1px solid #313338;border-radius:15px;background:linear-gradient(145deg,#272a2d,#24272a);padding:23px 27px;font-size:30px;line-height:1.27;font-weight:560;letter-spacing:-.025em;transform-origin:bottom right}
  #ln-context{position:absolute;right:38px;top:256px;color:#acb0ba;font-size:21px;display:flex;align-items:center;gap:9px}#ln-context>span:last-child{color:#737882}.ln-context-dot{display:inline-flex;align-items:center;justify-content:center;border:2px solid #767d88;width:23px;height:23px;border-radius:50%;font-size:15px;font-weight:650}
  #ln-progress{position:absolute;left:36px;top:301px;display:flex;gap:9px;height:30px;align-items:center}#ln-progress i{height:7px;width:7px;background:#a399c7;border-radius:50%;display:block}
  #ln-result{position:absolute;left:34px;top:307px;font-size:38px;line-height:1.18;font-weight:500;letter-spacing:-.035em}
  .ln-pr-card{position:absolute;left:34px;top:409px;width:832px;height:134px;border-radius:13px;border:1px solid #44434b;background:linear-gradient(112deg,#272a2d,#222528);padding:16px 21px;box-shadow:0 1px 0 #fff04 inset;color:#d7d9df;letter-spacing:-.018em}.ln-pr-meta{font-size:20px;display:flex;gap:8px;align-items:center;line-height:25px;color:#b9bdc5}.ln-pr-meta>span>b{font-weight:570;color:#e4e6ec}.ln-diff{display:flex;gap:6px;margin-left:2px}.ln-diff>b{color:#52b77d!important;font-weight:440!important}.ln-diff>em{font-style:normal;color:#dc7377}.ln-preview{margin-left:auto;font-size:17px;border:1px solid #414349;padding:0 11px;border-radius:8px;line-height:24px;color:#b5bac3}.ln-pr-title{display:flex;gap:9px;align-items:center;font-size:25px;line-height:34px;white-space:nowrap}.ln-pr-title svg{width:25px;height:25px;stroke:#aeb3bf;stroke-width:1.7;flex:none}.ln-draft{font-size:22px;font-weight:450;color:#c5c9d2}.ln-pr-title strong{font-weight:560}.ln-branch{font-family:ui-monospace,Consolas,monospace;font-size:16px;line-height:27px;color:#a1a5af;letter-spacing:.005em}.ln-branch span{padding:0 8px;color:#797c85}
  #ln-input{position:absolute;left:34px;right:34px;top:578px;height:147px;border:1px solid #49474f;border-radius:15px;background:linear-gradient(140deg,#222528,#1d2023);box-shadow:inset 0 1px 0 #fff04}#ln-input-copy{position:absolute;left:25px;right:94px;top:20px;font-size:29px;line-height:1.25;letter-spacing:-.025em;white-space:pre-wrap;color:#f0f0f1}#ln-caret{display:inline-block;width:2px;height:30px;background:#b6a6f1;vertical-align:-5px;margin-left:1px}#ln-input-placeholder{position:absolute;left:24px;top:20px;font-size:26px;color:#7b7e88;letter-spacing:-.02em}.ln-input-skills{position:absolute;left:23px;bottom:21px;color:#9ca1af;display:flex;gap:7px;align-items:center;font-size:19px;letter-spacing:-.02em}.ln-input-skills svg{width:20px;height:20px}.ln-input-attach{position:absolute;right:90px;bottom:18px;font-size:27px;color:#9298a6}#ln-send{appearance:none;position:absolute;right:17px;bottom:17px;width:49px;height:49px;border:1px solid #5a5861;background:#37393e;border-radius:50%;padding:9px;color:#eff0f3}#ln-send>svg{display:block;width:100%;height:100%}#ln-send-ring{position:absolute;right:17px;bottom:17px;width:49px;height:49px;border:1.6px solid #bcabff;border-radius:50%;pointer-events:none}
  #ln-pointer{position:absolute;left:0;top:0;width:40px;height:48px;z-index:20;filter:drop-shadow(0 3px 2px #0005);transform-origin:5px 5px}
  #ln-artifact{position:absolute;left:0;top:0;width:832px;height:134px;transform-origin:0 0;z-index:9}#ln-artifact>.ln-pr-card{inset:0;box-shadow:0 36px 65px #14111d33,0 1px 0 #ffffff22 inset}#ln-artifact-shadow{position:absolute;left:330px;top:596px;width:1270px;height:96px;border-radius:50%;background:#28223820;filter:blur(26px);z-index:2}
  #ln-review-copy{position:absolute;left:116px;top:172px;z-index:10}#ln-review-copy>div:nth-child(2){font-size:88px;line-height:1.02;letter-spacing:-.06em;font-weight:480;margin-top:23px}
  #ln-detail-left{position:absolute;left:124px;top:453px;z-index:6}#ln-detail-left>span{font-size:18px;letter-spacing:.13em;color:#908697;display:block;margin-bottom:19px}#ln-detail-left>b{font-size:54px;letter-spacing:-.045em;font-weight:510;display:block}#ln-detail-left>div{font-size:26px;letter-spacing:-.02em;color:#827c88;line-height:1.4;margin-top:14px}#ln-connector{position:absolute;inset:0;z-index:3}#ln-connector-line{stroke-dasharray:1;stroke-dashoffset:1}#ln-detail-title{position:absolute;left:110px;top:148px;font-size:90px;line-height:1.02;letter-spacing:-.063em;font-weight:490;z-index:5}
  #ln-close{position:absolute;inset:0;z-index:11}.ln-close-brand{position:absolute;left:0;right:0;top:352px;display:flex;align-items:center;justify-content:center;gap:29px;color:#17171b;font-size:156px;letter-spacing:-.065em;font-weight:530;--logo-cut:#eeede7}.ln-close-brand svg{width:128px;height:128px}.ln-close-brand span{line-height:1.1}#ln-close-line{position:absolute;left:730px;top:568px;width:460px;height:1px;background:#bbb3c7;transform-origin:center}#ln-close-cta{position:absolute;left:0;right:0;top:627px;text-align:center;font-size:42px;letter-spacing:-.035em;font-weight:480}#ln-close-cta>span{display:inline-block;font-size:40px;padding-left:25px;color:#756590}#ln-close-url{position:absolute;left:0;right:0;top:720px;text-align:center;font-size:24px;letter-spacing:.01em;color:#877e8e}
  #ln-source-note{position:absolute;left:113px;bottom:48px;font-size:18px;letter-spacing:.01em;color:#959099;z-index:13}#ln-frame-line{position:absolute;left:0;top:0;height:3px;background:#a592d8;transform-origin:left center;width:1920px;z-index:30}
  `,
  script: `
  function draw(frame){
    const f=Math.max(0,Math.min(719,Math.round(frame))),e=id=>document.getElementById(id),p=(a,b)=>Math.max(0,Math.min(1,(f-a)/(b-a))),out=t=>1-Math.pow(1-t,3),smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
    const opacity=(id,v)=>{e(id).style.opacity=String(Math.max(0,Math.min(1,v)));},transform=(id,v)=>{e(id).style.transform=v;};
    ['ln-hook','ln-direct','ln-result-copy','ln-review-copy','ln-detail-left','ln-detail-title','ln-connector','ln-close','ln-artifact','ln-artifact-shadow'].forEach(id=>opacity(id,0));
    const toDark=smooth(p(63,82)),toCream=smooth(p(342,370));opacity('ln-dark',1);opacity('ln-cream',1-toDark+toCream);
    e('ln-topmark').style.color=f<70?'#202026':'#eeedf0';e('ln-topmark').style.setProperty('--logo-cut',f<70?'#eeede7':'#0d1013');opacity('ln-topmark',f<343?1:0);
    opacity('ln-source-note',p(78,94)*(1-p(581,597)));e('ln-source-note').style.color=f<353?'#8b8996':'#918799';
    transform('ln-frame-line','scaleX('+p(0,719)+')');opacity('ln-frame-line',.6);
    const hookFade=1-p(60,76);opacity('ln-hook',hookFade);opacity('ln-hook-one',1);opacity('ln-hook-two',p(12,23));
    transform('ln-hook-one','translateY('+mix(9,0,out(p(0,12)))+'px)');transform('ln-hook-two','translateY('+mix(27,0,out(p(12,31)))+'px)');transform('ln-hook','translateX('+(-95*out(p(57,79)))+'px)');document.querySelector('.ln-hook-rule i').style.transform='scaleX('+p(22,54)+')';
    opacity('ln-direct',p(75,93)*(1-p(111,129)));transform('ln-direct','translateY('+mix(34,0,out(p(75,98)))+'px)');
    opacity('ln-result-copy',p(216,238)*(1-p(331,352)));transform('ln-result-copy','translateY('+mix(24,0,out(p(216,240)))+'px)');
    let x=1203,y=279,s=.82;
    if(f<80){const t=out(p(12,80));x=mix(1203,892,t);y=mix(279,184,t);s=mix(.82,.96,t);}
    else if(f<120){const t=smooth(p(95,120));x=mix(892,713,t);y=mix(184,128,t);s=mix(.96,1.04,t);}
    else if(f<183){const t=smooth(p(120,142));x=mix(713,132,t);y=mix(128,-710,t);s=mix(1.04,1.84,t);}
    else if(f<235){const t=out(p(183,232));x=mix(132,867,t);y=mix(-710,153,t);s=mix(1.84,.96,t);}
    else if(f<350){x=867;y=153;s=.96;}
    else {const t=out(p(350,380));x=mix(867,965,t);y=mix(153,205,t);s=mix(.96,.85,t);}
    transform('ln-ui-camera','translate('+x+'px,'+y+'px) scale('+s+')');opacity('ln-ui-camera',p(12,24)*(1-p(350,382)));
    const request='Fix the dimmed ride rows\\nthat never reset and open a PR',typed=Math.floor(request.length*smooth(p(84,136)));e('ln-typed').textContent=request.slice(0,typed);
    opacity('ln-input-copy',f<177?1:0);opacity('ln-input-placeholder',f<177?0:1);opacity('ln-caret',f>=82&&f<170?(Math.floor(f/8)%2?.18:1):0);
    const sendPulse=f>=166&&f<=177?Math.sin(Math.PI*p(166,177)):0;e('ln-send').style.background=f>=160&&f<182?'#8e7cb9':'#37393e';e('ln-send').style.borderColor=f>=160&&f<182?'#c5b3eb':'#5a5861';transform('ln-send','scale('+(1-.11*sendPulse)+')');opacity('ln-send-ring',p(169,173)*(1-p(173,190)));transform('ln-send-ring','scale('+mix(1,2.2,p(170,190))+')');
    const bubble=out(p(177,199));opacity('ln-request',p(177,187));transform('ln-request','translateY('+mix(455,0,bubble)+'px) scale('+mix(.93,1,bubble)+')');opacity('ln-context',p(198,208));
    opacity('ln-progress',p(183,192)*(1-p(209,217)));document.querySelectorAll('#ln-progress i').forEach((dot,i)=>{const a=(f-182-i*6)/8;dot.style.opacity=String(.3+.7*(.5+.5*Math.sin(a)));dot.style.transform='translateY('+(-3*(.5+.5*Math.sin(a)))+'px)';});
    opacity('ln-result',p(216,231));transform('ln-result','translateY('+mix(16,0,out(p(216,239)))+'px)');opacity('ln-pr-inside',p(239,255)*(1-p(347,350)));transform('ln-pr-inside','translateY('+mix(22,0,out(p(239,263)))+'px)');
    const cursorMove=out(p(145,162)),cursorX=mix(1870,x+s*824.5-5,cursorMove),cursorY=mix(1030,y+s*683.5-4,cursorMove);transform('ln-pointer','translate('+cursorX+'px,'+cursorY+'px) scale('+(1-.09*sendPulse)+')');opacity('ln-pointer',p(145,153)*(1-p(185,198)));
    if(f>=347&&f<590){
      const lift=out(p(347,386)),recap=smooth(p(466,494)),exit=smooth(p(566,594));
      const ax=mix(mix(899.64,320,lift),880,recap),ay=mix(mix(545.64,467,lift),445,recap),scale=mix(mix(.96,1.54,lift),1.06,recap);
      transform('ln-artifact','translate('+(ax+exit*70)+'px,'+(ay-exit*110)+'px) rotate('+mix(0,-1.9,lift)*(1-recap)+'deg) scale('+(scale*(1-exit*.08))+')');opacity('ln-artifact',p(347,350)*(1-p(573,594)));
      opacity('ln-artifact-shadow',p(358,381)*(1-p(465,488)));transform('ln-artifact-shadow','scale('+mix(.65,1,lift)+')');
    }
    opacity('ln-review-copy',p(366,387)*(1-p(455,476)));transform('ln-review-copy','translateY('+mix(38,0,out(p(365,389)))+'px)');
    opacity('ln-detail-left',p(480,499)*(1-p(569,586)));transform('ln-detail-left','translateX('+mix(-30,0,out(p(480,502)))+'px)');
    opacity('ln-detail-title',p(471,490)*(1-p(569,589)));transform('ln-detail-title','translateY('+mix(25,0,out(p(471,492)))+'px)');
    opacity('ln-connector',p(498,506)*(1-p(567,586)));e('ln-connector-line').style.strokeDashoffset=String(1-p(498,524));opacity('ln-connector-dot',p(519,528));
    opacity('ln-close',p(588,608));transform('ln-close','translateY('+mix(34,0,out(p(588,612)))+'px)');transform('ln-close-line','scaleX('+out(p(601,624))+')');opacity('ln-close-cta',p(606,620));transform('ln-close-cta','translateY('+mix(17,0,out(p(606,624)))+'px)');opacity('ln-close-url',p(616,629));
  }
  `,
};
