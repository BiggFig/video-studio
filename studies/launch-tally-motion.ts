import type { MotionStudy } from './types';

// Trusted, manually authored reconstruction of Tally's documented editor.
const mark = `<svg viewBox="0 0 16 16" aria-label="Tally"><path fill="currentColor" d="M9.99169 2.39306C9.99169 3.27827 9.66489 4.49613 9.18309 6.13269L8.83837 7.38966L9.92921 6.67715C12.0027 5.2211 13.2549 4.67462 14.0838 4.67462C15.0266 4.67462 16 5.34831 16 6.68815C16 8.39252 14.1804 8.8767 10.6672 8.9364L9.35372 8.99811L10.3896 9.82276C12.8489 11.7184 13.7015 12.647 13.7015 13.8238C13.7015 14.7498 12.8408 15.7144 11.7737 15.7144C10.1704 15.7144 9.44568 14.0483 8.46877 11.2197L7.97078 9.99025L7.50229 11.2197C6.40739 14.4325 5.56468 15.6849 4.16787 15.6849C3.04174 15.6849 2.2401 14.6612 2.2401 13.7942C2.2401 12.4993 3.41711 11.4228 5.58146 9.82276L6.61736 8.99811L5.33333 8.9364C1.60214 8.90626 0 8.36962 0 6.6586C0 5.31875 1.00351 4.64506 1.92835 4.64506C3.04521 4.64506 4.2633 5.39844 6.07135 6.67715L7.1622 7.38966L6.81748 6.13269C6.2952 4.40746 6.04995 3.14179 6.04995 2.39306C6.04995 1.22098 6.71048 0.25 8.00028 0.25C9.31959 0.25 9.99169 1.22098 9.99169 2.39306Z"/></svg>`;
const arrow = `<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 12h24M18 3l9 9-9 9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const emailIcon = `<svg viewBox="0 0 28 24"><rect x="2" y="3" width="24" height="18" rx="3"/><path d="m3 5 11 8L25 5"/></svg>`;
const choiceIcon = `<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10"/><path d="m8 14 4 4 9-10"/></svg>`;
const grip = `<svg viewBox="0 0 20 28" aria-hidden="true"><g fill="currentColor"><circle cx="6" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="6" cy="14" r="2"/><circle cx="14" cy="14" r="2"/><circle cx="6" cy="22" r="2"/><circle cx="14" cy="22" r="2"/></g></svg>`;

export const tallyStudy: MotionStudy = {
  id: 'tally-motion', title: 'Tally — make room for feedback', width: 1920, height: 1080, fps: 30, durationFrames: 540,
  reference: { path: '', startSeconds: 0, durationSeconds: 18 },
  reviewFrames: [0, 26, 55, 72, 94, 119, 139, 155, 174, 192, 213, 235, 259, 277, 295, 312, 331, 348, 369, 389, 407, 422, 449, 466, 486, 511, 539],
  notes: [
    'Manually authored 18-second HTML/SVG product film. It is neither automatic URL-generation acceptance nor a screen recording or real submission.',
    'Official source: https://tally.so/help/create-a-form — inspected its embedded Create-a-form-7.gif (444 native frames, 1256×820) and Create-a-form-1.png. The GIF shows Feedback form, /email, Email question/input menu, Your email, Multiple choice, Where did you hear about us?, Google, Social media, Friends, Submit, and the blue Publish control.',
    'https://tally.so/help/keyboard-shortcuts and https://tally.so/help/input-blocks establish slash insertion, question/input combinations and multiple-choice blocks. Only these demonstrated capabilities are used.',
    'White, near-black ink, pale gray UI surfaces and blue Publish follow the actual official editor illustration. Blue is restricted to observed functional controls and completion. No acid/pink/cobalt editorial palette, confetti, ticker or decorative crowd.',
    'Official Tally icon path was read from the help-center header. Tally text and interface typography use bundled Geist as an approximation. Camera framing, assembly, masking and transition choreography are authored, not literal software animations.',
    'The feedback form is a compact illustrative form assembled from documented blocks, with source labels and options. The long source introduction and extra rating/Colleagues blocks are omitted as an authored shorter form, not claimed to be the unmodified source recording. lucy@example.com is an illustrative respondent value.',
    'Publishing transitions editorially to respondent view; no invented dashboard/share dialog or verified live URL is shown. The illustrative submit resolves to the documented default message at https://tally.so/help/how-to-create-a-thank-you-page. Original default screenshot is retained in .local/launch-tally-sourcepack-20261003.',
    'Frames 0–65: founder hook and typed document. 66–137: slash-to-email block. 138–233: multiple choice and form assembly. 234–311: complete form and Publish. 312–406: respondent entry, choice, Submit. 407–465: persistent thank-you. 466–539: brand CTA. Key results remain readable before the next purposeful transition.',
    'No audio embedded. The shared runner may reuse the previously owned soundtrack separately; this file changes visual direction only.',
  ],
  html: `<div id="tm-film">
    <div id="tm-top"><div class="tm-brand">${mark}<span>Tally</span></div><span id="tm-category">THE FORM BUILDER</span></div>
    <div id="tm-hook"><div class="tm-eyebrow">FOR FOUNDERS &amp; CREATORS</div><h1>Make room<br>for feedback.</h1><p>Start with a page.</p></div>
    <div id="tm-caption"><span id="tm-step">01 / TYPE</span><strong id="tm-instruction">Build it like a doc.</strong></div>
    <div id="tm-editor">
      <div id="tm-toolbar"><div class="tm-breadcrumb">${mark}<span>Product</span><i></i><b>Feedback form</b></div><div id="tm-toolbar-actions"><span class="tm-draft">Draft</span><span>Preview</span><div id="tm-publish">Publish</div></div></div>
      <div id="tm-title"><span id="tm-title-value"></span><b id="tm-title-caret" class="tm-caret"></b></div>
      <div id="tm-slash"><span id="tm-slash-value"></span><b id="tm-slash-caret" class="tm-caret"></b></div>
      <div id="tm-email-block" class="tm-block"><div class="tm-grip">${grip}</div><label>Your email</label><div id="tm-email-input"><span id="tm-email-value"></span><b id="tm-email-caret" class="tm-caret"></b><span class="tm-email-icon">${emailIcon}</span></div></div>
      <div id="tm-choice-block" class="tm-block"><div class="tm-grip">${grip}</div><label>Where did you hear about us?</label><div id="tm-options">${['Google','Social media','Friends'].map((v,i)=>`<div id="tm-option-${i}" class="tm-option"><span class="tm-option-key">${String.fromCharCode(65+i)}</span><span>${v}</span><svg class="tm-option-check" viewBox="0 0 24 24"><path d="m5 12 5 5 9-11"/></svg></div>`).join('')}</div></div>
      <div id="tm-submit">Submit ${arrow}</div>
      <div id="tm-menu"><div class="tm-menu-label">Questions</div><div id="tm-menu-question" class="tm-menu-row selected"><span id="tm-question-icon"></span><span id="tm-question-label">Email</span></div><div class="tm-menu-separator"></div><div class="tm-menu-label">Input blocks</div><div id="tm-menu-input" class="tm-menu-row"><span id="tm-input-icon"></span><span id="tm-input-label">Email</span></div></div>
      <div id="tm-block-morph"><span>${emailIcon}</span><b>Email</b></div>
      <svg id="tm-cursor" viewBox="0 0 48 60"><path d="M6 3 40 32 24 34 17 52Z" fill="#191919" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle id="tm-click" cx="6" cy="3" r="15" fill="none" stroke="#191919" stroke-width="2"/></svg>
    </div>
    <div id="tm-result"><div id="tm-result-top">${mark}<span>Tally</span></div><div id="tm-check"><svg viewBox="0 0 100 100"><path d="m25 51 18 18 35-37"/></svg></div><h2>Thanks for completing<br>this form!</h2><p>Made with Tally, the simplest way to create forms for free.</p></div>
    <div id="tm-end"><div class="tm-end-brand">${mark}<span>Tally</span></div><h2>Your idea.<br>Your form.</h2><div id="tm-end-cta">Create a free form ${arrow}</div><div id="tm-end-url">tally.so</div></div>
    <div id="tm-matte"></div>
  </div>`,
  css: `
#tm-film{position:absolute;inset:0;background:#fff;color:#202020;overflow:hidden;letter-spacing:-.6px}
#tm-top{position:absolute;left:80px;right:80px;top:55px;height:60px;display:flex;align-items:center;justify-content:space-between;z-index:5}.tm-brand{display:flex;align-items:center;gap:15px;font-size:48px;font-weight:720;letter-spacing:-2px}.tm-brand svg{width:40px;height:40px}#tm-category{font-size:17px;letter-spacing:3px;font-weight:650}
#tm-hook{position:absolute;left:80px;top:230px;width:760px}.tm-eyebrow{font-size:23px;letter-spacing:2px;font-weight:600;color:#666}#tm-hook h1{font-size:115px;line-height:1.03;letter-spacing:-7px;font-weight:620;margin:27px 0}#tm-hook p{font-size:33px;color:#888;letter-spacing:-1px;margin-top:40px}
#tm-caption{position:absolute;left:82px;bottom:45px;right:82px;display:flex;justify-content:space-between;align-items:center;z-index:8}#tm-step{font-size:19px;letter-spacing:2px;color:#737373;font-weight:600}#tm-instruction{font-size:27px;letter-spacing:-.6px;font-weight:520}
#tm-editor{position:absolute;left:0;top:0;width:1280px;height:860px;background:white;border:1px solid #e5e5e5;border-radius:14px;box-shadow:0 18px 65px #0000000b;transform-origin:0 0;overflow:visible}
#tm-toolbar{position:absolute;left:0;right:0;top:0;height:72px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;color:#797979;font-size:18px}.tm-breadcrumb{display:flex;align-items:center;gap:14px}.tm-breadcrumb svg{height:24px;width:24px}.tm-breadcrumb i{width:7px;height:7px;border-top:1.5px solid #aaa;border-right:1.5px solid #aaa;transform:rotate(45deg)}.tm-breadcrumb b{font-weight:550}.tm-draft{background:#f1f1f1;padding:4px 8px;border-radius:4px;color:#888;font-size:15px}#tm-toolbar-actions{display:flex;gap:24px;align-items:center}#tm-publish{display:grid;place-items:center;height:44px;width:110px;background:#0077d7;color:white;border-radius:6px;font-size:19px;font-weight:600;box-shadow:0 2px 3px #0001}
#tm-title{position:absolute;left:160px;top:146px;font-size:66px;line-height:1.12;letter-spacing:-2.7px;font-weight:700;white-space:nowrap}.tm-caret{display:inline-block;width:3px;height:1em;background:#222;vertical-align:-.1em;margin-left:2px}#tm-slash{position:absolute;left:160px;top:315px;font-size:33px;line-height:42px;white-space:nowrap}
.tm-block{position:absolute;left:160px;width:820px}.tm-block label{display:block;font-size:26px;font-weight:550;line-height:38px;letter-spacing:-.5px}.tm-grip{position:absolute;left:-35px;top:6px;color:#bcbcbc;width:18px}.tm-grip svg{width:18px;height:26px}#tm-email-block{top:291px}#tm-email-input{position:relative;border:1.5px solid #d8d8d8;height:64px;border-radius:6px;margin-top:13px;width:700px;box-shadow:0 2px 3px #00000007;padding:13px 19px;font-size:26px;line-height:34px;letter-spacing:-.5px}.tm-email-icon{position:absolute;right:15px;top:19px;color:#b1b1b1}.tm-email-icon svg{width:25px;height:23px;fill:none;stroke:currentColor;stroke-width:1.6}#tm-choice-block{top:466px}#tm-options{display:flex;flex-direction:column;gap:10px;margin-top:14px}.tm-option{position:relative;border:1px solid #dedede;background:#fafafa;border-radius:5px;width:370px;height:45px;display:flex;align-items:center;gap:12px;padding:0 12px;font-size:23px;line-height:28px;transform-origin:left center}.tm-option-key{border:1px solid #d7d7d7;background:#fff;border-radius:3px;font-size:15px;width:25px;height:25px;display:grid;place-items:center}.tm-option-check{position:absolute;right:12px;top:12px;width:21px;height:21px;fill:none;stroke:#222;stroke-width:2;opacity:0}
#tm-submit{position:absolute;left:160px;top:735px;height:54px;padding:0 20px;border-radius:5px;background:#111;color:#fff;display:flex;gap:17px;align-items:center;font-size:23px;font-weight:600}#tm-submit svg{width:26px;height:24px}
#tm-menu{position:absolute;left:160px;top:132px;width:425px;border:1px solid #ddd;border-radius:9px;box-shadow:0 5px 19px #00000013;background:#fff;padding:9px;transform-origin:left bottom;z-index:4}.tm-menu-label{font-size:17px;color:#858585;letter-spacing:0;padding:5px 10px 9px}.tm-menu-row{height:50px;border-radius:6px;display:flex;align-items:center;gap:13px;padding:0 12px;font-size:24px;letter-spacing:-.3px}.tm-menu-row.selected{background:#eeeeee}.tm-menu-row svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.7}.tm-menu-separator{height:1px;background:#eee;margin:8px -9px}#tm-cursor{position:absolute;width:32px;height:40px;left:0;top:0;z-index:9;transform-origin:4px 2px}
#tm-block-morph{position:absolute;border:1.5px solid #d8d8d8;border-radius:6px;background:#eee;z-index:5;display:flex;align-items:center;gap:13px;padding:0 12px;font-size:24px;overflow:hidden;transform-origin:0 0}#tm-block-morph b{font-weight:400}#tm-block-morph svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.7}
#tm-result{position:absolute;left:0;top:0;width:1920px;height:1080px;background:#fff;text-align:center;transform-origin:0 0}#tm-result-top{position:absolute;left:80px;top:55px;display:flex;align-items:center;gap:13px;font-size:48px;font-weight:700;letter-spacing:-2px}#tm-result-top svg{height:40px;width:40px}#tm-check{position:absolute;left:895px;top:205px;width:130px;height:130px;background:#e4f1ff;border-radius:50%;display:grid;place-items:center}#tm-check svg{width:90px;height:90px;fill:none;stroke:#238bdf;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}#tm-result h2{position:absolute;top:382px;left:210px;right:210px;font-size:78px;line-height:1.12;letter-spacing:-3px;margin:0;font-weight:600}#tm-result p{position:absolute;top:615px;left:220px;right:220px;color:#888;font-size:27px;letter-spacing:-.4px}
#tm-end{position:absolute;inset:0;background:#fff;transform-origin:0 0}.tm-end-brand{position:absolute;left:112px;top:162px;display:flex;align-items:center;gap:22px;font-size:80px;font-weight:650;letter-spacing:-4px}.tm-end-brand svg{width:72px;height:72px}#tm-end h2{position:absolute;left:112px;top:302px;font-size:128px;line-height:1.02;letter-spacing:-7px;font-weight:560;margin:0}#tm-end-cta{position:absolute;left:115px;top:731px;display:flex;align-items:center;gap:25px;background:#111;color:white;height:86px;padding:0 30px;border-radius:6px;font-size:34px;font-weight:520;letter-spacing:-.8px}#tm-end-cta svg{width:34px;height:28px}#tm-end-url{position:absolute;left:118px;top:864px;font-size:27px;color:#777}#tm-matte{position:absolute;inset:0;background:#fff;pointer-events:none}
`,
  script: `
const tmGet=id=>document.getElementById(id);
const tmClamp=x=>Math.min(1,Math.max(0,x));
const tmPart=(f,a,b)=>tmClamp((f-a)/(b-a));
const tmEase=x=>{x=tmClamp(x);return x*x*x*(x*(x*6-15)+10)};
const tmMix=(a,b,t)=>a+(b-a)*t;
const tmShow=(id,v)=>{tmGet(id).style.opacity=String(v);tmGet(id).style.visibility=v>0?'visible':'hidden'};
const tmMove=(id,x,y,s=1,r=0)=>{tmGet(id).style.transform='translate('+x+'px,'+y+'px) scale('+s+') rotate('+r+'deg)'};
const tmType=(id,text,p)=>{tmGet(id).textContent=text.slice(0,Math.floor(text.length*tmClamp(p)))};
const tmMailIcon=${JSON.stringify(emailIcon)};
const tmChoiceIcon=${JSON.stringify(choiceIcon)};
function draw(frame){
 const f=Math.max(0,Math.min(539,frame));
 let x=890,y=205,s=1.15;
 const camera=[
  [0,890,205,1.15],[48,865,188,1.17],[72,250,83,1.12],
  [91,180,180,1.36],[125,180,180,1.36],[149,140,92,1.23],
  [171,125,-109,1.39],[213,125,-109,1.39],[238,364,145,.91],
  [262,364,145,.91],[283,-3350,390,3.6],[301,-3350,390,3.6],
  [321,389,75,1.04],[360,389,75,1.04],[379,234,-127,1.24],[405,234,-127,1.24]
 ];
 for(let i=0;i<camera.length-1;i++){if(f>=camera[i][0]&&f<camera[i+1][0]){const a=camera[i],b=camera[i+1],p=tmEase(tmPart(f,a[0],b[0]));x=tmMix(a[1],b[1],p);y=tmMix(a[2],b[2],p);s=tmMix(a[3],b[3],p);break}}
 if(f>=405){x=234;y=-127;s=1.24}
 tmMove('tm-editor',x,y,s);tmShow('tm-editor',f<407?1:0);
 tmShow('tm-top',f<66?1:0);tmShow('tm-hook',1-tmEase(tmPart(f,48,69)));tmMove('tm-hook',-130*tmEase(tmPart(f,48,69)),0);
 tmShow('tm-caption',f>=66&&f<407?1:0);
 tmGet('tm-step').textContent=f<138?'01 / TYPE':f<234?'02 / BUILD':f<312?'03 / PUBLISH':'04 / RESPOND';
 tmGet('tm-instruction').textContent=f<138?'Build it like a doc.':f<234?'A question becomes a form.':f<312?'Ready for your audience.':'A form made for answers.';
 tmType('tm-title-value','Feedback form',tmPart(f,2,46));tmShow('tm-title-caret',f<53?1:0);
 tmShow('tm-toolbar',f<306?1:1-tmEase(tmPart(f,306,321)));tmGet('tm-editor').style.borderColor=f<312?'#e5e5e5':'transparent';tmGet('tm-editor').style.boxShadow=f<312?'0 18px 65px #0000000b':'none';
 const emailPhase=f>=76&&f<136, choicePhase=f>=150&&f<191;
 tmShow('tm-slash',emailPhase||choicePhase?1:0);tmGet('tm-slash').style.top=choicePhase?'466px':'315px';
 tmType('tm-slash-value',emailPhase?'/email':'/multiple',emailPhase?tmPart(f,77,96):tmPart(f,151,169));
 tmShow('tm-slash-caret',emailPhase||choicePhase?1:0);
 const menuOn=(f>=92&&f<136)||(f>=163&&f<191);const mStart=f<138?92:163;
 tmShow('tm-menu',menuOn?tmEase(tmPart(f,mStart,mStart+7)):0);tmMove('tm-menu',0,12*(1-tmEase(tmPart(f,mStart,mStart+7))),.97+.03*tmEase(tmPart(f,mStart,mStart+7)));
 tmGet('tm-menu').style.top=f<138?'100px':'236px';tmGet('tm-question-label').textContent=f<138?'Email':'Multiple choice';tmGet('tm-input-label').textContent=f<138?'Email':'Multiple choice';tmGet('tm-question-icon').innerHTML=f<138?tmMailIcon:tmChoiceIcon;tmGet('tm-input-icon').innerHTML=f<138?tmMailIcon:tmChoiceIcon;
 // The selected menu row becomes the input: matched source and destination,
 // one continuous 200px move and 407→700px stretch rather than a new-card fade.
 const ep=tmEase(tmPart(f,143,155));tmShow('tm-email-block',ep);tmMove('tm-email-block',0,0,1);tmGet('tm-email-input').style.opacity=f>=155?'1':'0';
 const morph=tmEase(tmPart(f,135,155));tmShow('tm-block-morph',f>=135&&f<155?1:0);
 tmMove('tm-block-morph',tmMix(169,160,morph),tmMix(143,342,morph),1);
 tmGet('tm-block-morph').style.width=tmMix(407,700,morph)+'px';tmGet('tm-block-morph').style.height=tmMix(50,64,morph)+'px';
 tmGet('tm-block-morph').style.background='rgb('+Math.round(tmMix(238,255,morph))+','+Math.round(tmMix(238,255,morph))+','+Math.round(tmMix(238,255,morph))+')';
 tmGet('tm-block-morph').querySelector('b').style.opacity=String(1-tmEase(tmPart(f,143,151)));
 tmGet('tm-block-morph').querySelector('span').style.transform='translateX('+(647*tmEase(tmPart(f,151,155)))+'px)';
 tmGet('tm-block-morph').querySelector('span').style.color=f>=147?'#b1b1b1':'#202020';
 const qp=tmEase(tmPart(f,190,201));tmShow('tm-choice-block',qp);tmMove('tm-choice-block',0,28*(1-qp),1);
 for(let i=0;i<3;i++){const p=tmEase(tmPart(f,197+i*6,211+i*6));tmMove('tm-option-'+i,70*(1-p),0,.94+.06*p);tmShow('tm-option-'+i,p);tmGet('tm-option-'+i).style.background=f>=361&&i===1?'#eeeeee':'#fafafa';tmGet('tm-option-'+i).style.borderColor=f>=361&&i===1?'#777':'#dedede';tmGet('tm-option-'+i).querySelector('.tm-option-check').style.opacity=f>=361&&i===1?'1':'0'}
 tmShow('tm-submit',f<70||f>=226?1:0);tmGet('tm-submit').style.top=f<135?'480px':f<191?'466px':'735px';
 tmGet('tm-submit').style.transform='scale('+(f>=399&&f<=405?(.98+.02*Math.abs((f-402)/3)):1)+')';
 tmType('tm-email-value','lucy@example.com',tmPart(f,329,350));tmShow('tm-email-caret',f>=326&&f<353?1:0);tmGet('tm-email-input').style.borderColor=f>=326&&f<353?'#777':'#d8d8d8';
 const grips=tmGet('tm-editor').querySelectorAll('.tm-grip');for(const g of grips)g.style.opacity=f<306?'1':'0';
 let cx=0,cy=0,vis=0,click=0;
 if(f>=115&&f<138){const p=tmEase(tmPart(f,115,128));cx=tmMix(635,408,p);cy=tmMix(425,169,p);vis=1;click=f>=130?Math.sin(Math.PI*tmPart(f,130,137)):0}
 if(f>=174&&f<193){const p=tmEase(tmPart(f,174,183));cx=tmMix(645,419,p);cy=tmMix(658,304,p);vis=1;click=f>=184?Math.sin(Math.PI*tmPart(f,184,191)):0}
 if(f>=270&&f<313){const p=tmEase(tmPart(f,270,291));cx=tmMix(1020,1195,p);cy=tmMix(178,35,p);vis=1;click=f>=298&&f<=306?Math.sin(Math.PI*tmPart(f,298,306)):0}
 if(f>=353&&f<371){const p=tmEase(tmPart(f,353,361));cx=tmMix(791,366,p);cy=tmMix(389,582,p);vis=1;click=f>=361&&f<=369?Math.sin(Math.PI*tmPart(f,361,369)):0}
 if(f>=382&&f<407){const p=tmEase(tmPart(f,382,398));cx=tmMix(482,252,p);cy=tmMix(644,762,p);vis=1;click=f>=399?Math.sin(Math.PI*tmPart(f,399,406)):0}
 tmMove('tm-cursor',cx,cy,1);tmShow('tm-cursor',vis);tmShow('tm-click',click);tmGet('tm-click').setAttribute('r',String(8+18*click));tmGet('tm-publish').style.transform='scale('+(f>=298&&f<=306?1-.04*Math.sin(Math.PI*tmPart(f,298,306)):1)+')';
 // Publish-to-respondent is an editorial matched cut, not a fabricated share dialog.
 const wipe=.45*tmEase(tmPart(f,306,312))*(1-tmEase(tmPart(f,312,320)));tmShow('tm-matte',wipe);
 const result=f>=407&&f<478;tmShow('tm-result',result?1:0);
 const rp=tmEase(tmPart(f,407,418));const end=tmEase(tmPart(f,466,489));
 tmMove('tm-result',tmMix(0,1040,end),tmMix(18*(1-rp),262,end),tmMix(1,.4,end));tmGet('tm-result').style.boxShadow=end>0?'0 20px 60px #00000010':'none';tmGet('tm-result').style.border=end>0?'1px solid #ddd':'none';tmGet('tm-result').style.borderRadius=(18*end)+'px';
 tmGet('tm-check').style.transform='scale('+( .75+.25*rp )+')';tmGet('tm-check').querySelector('path').style.strokeDasharray='90';tmGet('tm-check').querySelector('path').style.strokeDashoffset=String(90*(1-rp));
 tmShow('tm-end',f>=466?1:0);tmMove('tm-end',0,50*(1-end));tmGet('tm-end').style.clipPath='inset(0 '+(100*(1-end))+'% 0 0)';
 // Retain the actual completed result as a quiet, readable object beside the CTA.
 if(f>=478){tmShow('tm-result',1);tmMove('tm-result',1040,262,.4);tmGet('tm-result').style.zIndex='4'}else{tmGet('tm-result').style.zIndex='2'}
 tmGet('tm-end').style.zIndex='3';tmGet('tm-caption').style.zIndex='8';
}
`,
};
