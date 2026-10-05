import type { MotionStudy } from './types';

// Authored product demonstration. The message fragments are editorial, never an import UI.
const mark = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M9.99169 2.39306C9.99169 3.27827 9.66489 4.49613 9.18309 6.13269L8.83837 7.38966L9.92921 6.67715C12.0027 5.2211 13.2549 4.67462 14.0838 4.67462C15.0266 4.67462 16 5.34831 16 6.68815C16 8.39252 14.1804 8.8767 10.6672 8.9364L9.35372 8.99811L10.3896 9.82276C12.8489 11.7184 13.7015 12.647 13.7015 13.8238C13.7015 14.7498 12.8408 15.7144 11.7737 15.7144C10.1704 15.7144 9.44568 14.0483 8.46877 11.2197L7.97078 9.99025L7.50229 11.2197C6.40739 14.4325 5.56468 15.6849 4.16787 15.6849C3.04174 15.6849 2.2401 14.6612 2.2401 13.7942C2.2401 12.4993 3.41711 11.4228 5.58146 9.82276L6.61736 8.99811L5.33333 8.9364C1.60214 8.90626 0 8.36962 0 6.6586C0 5.31875 1.00351 4.64506 1.92835 4.64506C3.04521 4.64506 4.2633 5.39844 6.07135 6.67715L7.1622 7.38966L6.81748 6.13269C6.2952 4.40746 6.04995 3.14179 6.04995 2.39306C6.04995 1.22098 6.71048 0.25 8.00028 0.25C9.31959 0.25 9.99169 1.22098 9.99169 2.39306Z"/></svg>`;
const arrow = `<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 12h24M18 3l9 9-9 9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const check = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="m25 51 18 18 35-37" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function makeTallyStudy(feed: boolean): MotionStudy {
  // Feed gets a taller working area relative to its canvas; neither format is a crop.
  const y = feed ? { brand: 120, hook: 222, slips: 620, heading: 208, form: 444, macro: 636, result: 476, end: 290, cta: 858 }
    : { brand: 300, hook: 392, slips: 828, heading: 380, form: 548, macro: 750, result: 590, end: 475, cta: 983 };
  return {
    id: feed ? 'tally-social-feed' : 'tally-social',
    title: 'Tally — stop collecting client briefs in DMs',
    width: 1080, height: feed ? 1350 : 1920, fps: 30, durationFrames: 540,
    reference: { path: '', startSeconds: 0, durationSeconds: 18 },
    reviewFrames: [0, 12, 30, 58, 70, 75, 90, 108, 125, 144, 172, 190, 207, 225, 240, 241, 266, 290, 315, 330, 340, 365, 380, 400, 435, 455, 490, 539],
    notes: [
      'Original 18-second ad concept for freelancers and small studios, with a single client-enquiry use case. Manually authored engine study, not automatic URL generation, official Tally advertising, a live form or a real client submission.',
      'Hook: Still taking client briefs in DMs? Editorial message fragments show incomplete back-and-forth. They disappear before the form editor appears: no message import, AI extraction, DM integration or automatic response is depicted.',
      'Official sources inspected 2026-10-05: https://tally.so/help/create-a-form establishes document-like editing, slash insertion, Publish and distribution; https://tally.so/help/input-blocks documents short answer, email and long answer; https://tally.so/help/how-to-create-a-thank-you-page establishes the default post-submit screen; https://tally.so/help/how-to-name-fields establishes retained answers under question labels. Free CTA supported by https://tally.so/help/faq.',
      'The original Tally symbol and white/ink/pale gray palette are retained; blue is limited to the real functional Publish control and confirmation. Geist approximates UI typography. Editor chrome is simplified and enlarged for mobile; its document, question labels, input controls and Publish are rebuilt in HTML/SVG.',
      'Name, email and project are illustrative authored content: Ada; ada@example.com; A new landing page. Submit visibly precedes the default thank-you. The following card says EXAMPLE BRIEF and is an editorial recap of those exact answers, not a fabricated Tally dashboard or conversion result.',
      '0–74: three-message tension; 75–197: slash/field construction; 198–240: isolated Publish press; 241–337: respondent fills the same three questions and visibly submits; 338–372: default thank-you; 373–451: readable structured brief recap; 452–539: Build your client brief / Create a free form / tally.so.',
      'Dramatic contrast is physical: jittering staggered message slips, sudden editorial reset, opening input outlines, precise typing, isolated macro control, decisive submit cut, a calm complete-answer hold, then a dimensional paper fold into CTA. No decorative confetti, unsupported metrics or off-brand colors.',
      feed ? '4:5 feed version is independently composed at 1080×1350. Essential content occupies x80–1000/y110–1200. Header, opening, form, macro, outcome and CTA each use feed-specific positions.' : '9:16 Reels version is composed at 1080×1920. Essential content occupies x80–1000/y290–1230, with quiet extension above and below. It is not a crop or padded landscape export.',
      'Every draw call resets scene visibility and all mutable transforms/content. Existing owned audio can be reused by the runner; performance claims require an actual controlled campaign test.',
    ],
    html: `<div id="ts-film">
      <div id="ts-brand">${mark}<span>Tally</span><span id="ts-audience">FOR FREELANCERS</span></div>
      <section id="ts-hook"><h1>Still taking<br>client briefs<br>in <span>DMs?</span></h1></section>
      <div id="ts-messages">${['What’s your email?','What do you need?','One more thing…'].map((v,i)=>`<div id="ts-message-${i}" class="ts-message"><span class="ts-message-dot"></span>${v}</div>`).join('')}</div>
      <h2 id="ts-heading">Build it<br>like a doc.</h2>
      <section id="ts-form">
        <div id="ts-toolbar"><span>Draft</span><div id="ts-publish">Publish</div></div>
        <h3>Project enquiry</h3>
        <div id="ts-name" class="ts-field"><label>Your name</label><div class="ts-input"><span id="ts-name-value"></span><i id="ts-name-caret"></i></div></div>
        <div id="ts-email" class="ts-field"><label>Your email</label><div class="ts-input"><span id="ts-email-value"></span><i id="ts-email-caret"></i></div></div>
        <div id="ts-project" class="ts-field"><label>What do you need?</label><div class="ts-input"><span id="ts-project-value"></span><i id="ts-project-caret"></i></div></div>
        <div id="ts-slash"><span id="ts-slash-value"></span><i></i></div>
        <div id="ts-menu"><div>Questions</div><strong><span>@</span> Email ${arrow}</strong></div>
        <div id="ts-submit">Submit ${arrow}</div>
      </section>
      <section id="ts-macro"><div id="ts-paper-back"></div><div id="ts-macro-button">Publish ${arrow}</div></section>
      <section id="ts-thanks"><div id="ts-thanks-check">${check}</div><h3>Thanks for<br>completing this form!</h3><p>Made with Tally</p></section>
      <section id="ts-brief"><div id="ts-brief-label">EXAMPLE BRIEF</div><div class="ts-answer"><label>Your name</label><b>Ada</b></div><div class="ts-answer"><label>Your email</label><b>ada@example.com</b></div><div class="ts-answer"><label>What do you need?</label><b>A new landing page.</b></div></section>
      <section id="ts-end"><h2>Build your<br>client brief.</h2><p>Give every enquiry<br>a place to land.</p><div id="ts-cta">Create a free form ${arrow}</div><div id="ts-url">tally.so</div></section>
      <svg id="ts-pointer" viewBox="0 0 48 60" aria-hidden="true"><path d="M6 3 40 32 24 34 17 52Z" fill="#202020" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>
      <div id="ts-press"></div>
    </div>`,
    css: `
#ts-film{position:absolute;inset:0;background:#fafafa;color:#202020;overflow:hidden;letter-spacing:-.7px}#ts-film *{box-sizing:border-box}#ts-brand{position:absolute;left:92px;top:${y.brand}px;width:896px;height:60px;display:flex;align-items:center;gap:15px;font-size:50px;font-weight:700;letter-spacing:-2px;z-index:10}#ts-brand>svg{width:45px;height:45px}#ts-audience{margin-left:auto;font-size:24px;letter-spacing:1.3px;font-weight:550}
#ts-hook{position:absolute;left:92px;top:${y.hook}px;transform-origin:0 0}#ts-hook h1{font-size:${feed ? 99 : 96}px;font-weight:650;line-height:1.035;letter-spacing:-5.5px;margin:0}#ts-hook h1 span{display:inline-block;border-bottom:6px solid #202020;padding-bottom:4px}
#ts-messages{position:absolute;left:118px;top:${y.slips}px;width:844px;height:355px;perspective:1200px}.ts-message{position:absolute;left:0;top:0;display:flex;gap:22px;align-items:center;width:770px;height:98px;padding:0 36px;background:#fff;border:2px solid #dedede;border-radius:16px;box-shadow:0 10px 30px #00000009;font-size:43px;line-height:1.2;font-weight:510;transform-origin:50% 50%;white-space:nowrap}.ts-message-dot{width:14px;height:14px;background:#939393;border-radius:50%;flex:none}
#ts-heading{position:absolute;left:92px;top:${y.heading}px;margin:0;font-size:76px;line-height:1.01;letter-spacing:-3.7px;font-weight:620;width:900px;z-index:3;transform-origin:left center}
#ts-form{position:absolute;left:100px;top:${y.form}px;width:880px;height:665px;border:1.5px solid #dedede;border-radius:13px;background:#fff;box-shadow:0 16px 50px #00000008;transform-origin:50% 50%;overflow:hidden}#ts-toolbar{position:absolute;left:0;top:0;right:0;height:72px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;padding:0 30px;font-size:32px;color:#777}#ts-publish{display:grid;place-items:center;background:#0077d7;color:#fff;font-size:38px;font-weight:600;border-radius:7px;width:177px;height:53px}#ts-form h3{position:absolute;left:40px;top:98px;font-size:53px;letter-spacing:-1.8px;line-height:1.1;margin:0;font-weight:650}.ts-field{position:absolute;left:40px;right:40px;transform-origin:0 0}.ts-field label{display:block;font-size:38px;font-weight:520;line-height:44px;letter-spacing:-.6px}.ts-input{height:64px;margin-top:9px;border:1.5px solid #cfcfcf;border-radius:6px;padding:8px 14px;font-size:40px;font-weight:420;line-height:44px;background:white;transform-origin:left center;white-space:nowrap}#ts-name{top:177px}#ts-email{top:307px}#ts-project{top:437px}#ts-project .ts-input{height:70px}.ts-input i,#ts-slash i{display:inline-block;background:#202020;width:3px;height:39px;vertical-align:-6px;margin-left:2px}
#ts-slash{position:absolute;left:40px;top:314px;font-size:48px;line-height:58px}#ts-menu{position:absolute;left:40px;top:380px;width:610px;padding:16px;border:1.5px solid #ddd;border-radius:9px;background:#fff;box-shadow:0 12px 35px #00000016;z-index:4;transform-origin:left top}#ts-menu>div{font-size:30px;color:#777;padding:0 13px 11px}#ts-menu strong{display:flex;align-items:center;gap:20px;font-size:43px;font-weight:480;height:74px;border-radius:7px;padding:0 18px;background:#eee}#ts-menu strong>span{font-size:39px}#ts-menu strong>svg{width:34px;height:30px;margin-left:auto}#ts-submit{position:absolute;left:40px;top:581px;display:flex;gap:22px;align-items:center;background:#202020;color:#fff;border-radius:7px;height:65px;padding:0 23px;font-size:38px;font-weight:550}#ts-submit svg{width:34px;height:28px}
#ts-macro{position:absolute;left:200px;top:${y.macro}px;width:680px;height:202px;perspective:1200px}#ts-paper-back{position:absolute;inset:-35px -28px;background:#fff;border:2px solid #ddd;border-radius:10px;box-shadow:0 15px 40px #0001;transform:rotate(-4deg)}#ts-macro-button{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:42px;background:#0077d7;color:#fff;font-size:88px;font-weight:560;border-radius:14px;box-shadow:0 8px 0 #0061b0;transform-origin:center}#ts-macro-button svg{width:67px;height:48px}
#ts-thanks{position:absolute;left:100px;top:${y.result}px;width:880px;height:560px;background:#fff;border:1.5px solid #dedede;border-radius:13px;text-align:center;padding:40px 20px;transform-origin:center;box-shadow:0 12px 40px #00000007}#ts-thanks-check{width:130px;height:130px;border-radius:50%;background:#e4f1ff;color:#0077d7;margin:0 auto 42px}#ts-thanks-check svg{width:130px;height:130px}#ts-thanks h3{font-size:55px;line-height:1.16;letter-spacing:-2px;font-weight:600;margin:0}#ts-thanks p{font-size:34px;color:#777;margin-top:35px}
#ts-brief{position:absolute;left:100px;top:${y.result}px;width:880px;height:610px;background:#fff;border:1.5px solid #dedede;border-radius:13px;padding:35px 40px;transform-origin:50% 50%;box-shadow:0 12px 40px #00000007}#ts-brief-label{font-size:33px;letter-spacing:1.6px;color:#777;margin-bottom:21px}.ts-answer{border-top:1px solid #dedede;padding:20px 0 19px;transform-origin:left center}.ts-answer label{display:block;font-size:38px;color:#6a6a6a;line-height:42px;letter-spacing:-.3px}.ts-answer b{display:block;font-size:49px;line-height:58px;letter-spacing:-1px;font-weight:560;margin-top:5px}
#ts-end{position:absolute;left:92px;top:${y.end}px;width:896px;transform-origin:left top}#ts-end h2{font-size:105px;line-height:1.03;letter-spacing:-5.5px;font-weight:650;margin:0}#ts-end p{font-size:49px;line-height:1.18;letter-spacing:-1.5px;margin:46px 0 0;font-weight:430}#ts-cta{position:absolute;top:${y.cta-y.end}px;left:0;height:111px;display:flex;align-items:center;justify-content:center;gap:24px;background:#202020;color:#fff;font-size:45px;font-weight:550;border-radius:8px;width:790px;letter-spacing:-.8px}#ts-cta svg{width:45px;height:34px}#ts-url{position:absolute;top:${y.cta-y.end+147}px;left:0;font-size:39px;letter-spacing:-.5px;color:#666}
#ts-pointer{position:absolute;left:0;top:0;width:49px;height:62px;z-index:20;transform-origin:6px 3px}#ts-press{position:absolute;left:0;top:0;width:94px;height:94px;border:3px solid #202020;border-radius:50%;z-index:19;transform-origin:center}
`,
    script: `
const tsY=${JSON.stringify(y)};
const tsGet=id=>document.getElementById('ts-'+id);
const tsPart=(f,a,b)=>Math.min(1,Math.max(0,(f-a)/(b-a)));
const tsEase=p=>{p=Math.min(1,Math.max(0,p));return p*p*p*(p*(p*6-15)+10)};
const tsMix=(a,b,p)=>a+(b-a)*p;
const tsShow=(id,v)=>{tsGet(id).style.opacity=String(v);tsGet(id).style.visibility=v>0?'visible':'hidden'};
const tsMove=(id,x=0,y=0,s=1,r=0)=>{tsGet(id).style.transform='translate('+x+'px,'+y+'px) scale('+s+') rotate('+r+'deg)'};
const tsType=(id,text,p)=>{tsGet(id).textContent=text.slice(0,Math.floor(text.length*Math.max(0,Math.min(1,p))))};
function draw(frame){
 const f=Math.min(539,Math.max(0,frame));
 ['hook','messages','heading','form','macro','thanks','brief','end','pointer','press'].forEach(id=>{tsShow(id,0);tsMove(id)});
 tsGet('film').style.background=f>=373&&f<452?'#f2f2f2':'#fafafa';
 tsGet('brand').style.color='#202020';tsGet('audience').textContent=f<75?'FOR FREELANCERS':'THE FORM BUILDER';
 tsGet('heading').innerHTML=f<198?'Build it<br>like a doc.':f<241?'Publish.<br>Share the link.':f<338?'Ask once.<br>Get the details.':f<373?'Sent.':'The brief.<br>In one place.';
 tsGet('heading').style.fontSize='76px';tsGet('heading').style.letterSpacing='-3.7px';
 if(f<75){
  tsShow('hook',1);tsShow('messages',1);
  const enter=tsEase(tsPart(f,0,12));tsMove('hook',0,tsMix(8,0,enter),1);
  for(let i=0;i<3;i++){
   const p=i===0?.35+.65*tsEase(tsPart(f,0,14)):tsEase(tsPart(f,i*10,i*10+14)),collapse=tsEase(tsPart(f,61+i*2,73));
   tsShow('message-'+i,p*(1-collapse));
   const jitter=Math.sin((f-i*8)*.33)*Math.max(0,1-tsPart(f,34,52))*2.5;
   tsMove('message-'+i,(i%2?40:0)+55*(1-p)+jitter,112*i-80*(1-p)-i*90*collapse,1-.11*collapse,(i%2?2:-2)*(1-collapse));
  }
 }
 const building=f>=75&&f<198,responding=f>=241&&f<338;
 if(building||responding){
  tsShow('heading',1);tsShow('form',1);
  const unfold=building?tsEase(tsPart(f,75,90)):1;
  tsGet('form').style.clipPath='inset(0 0 '+(100*(1-unfold))+'% 0 round 13px)';
  tsMove('form',0,0,1,0);
 }
 // Reset all mutable UI state; seek order cannot alter fields, caret, or button press.
 tsShow('toolbar',building?1:0);tsGet('form').style.height='665px';
 tsGet('form').querySelector('h3').style.top=responding?'28px':'98px';
 for(const [id,base] of [['name',177],['email',307],['project',437]]){
  tsGet(id).style.top=(base-(responding?69:0))+'px';tsMove(id);tsShow(id,1);
  tsGet(id).querySelector('.ts-input').style.clipPath='inset(0 0 0 0)';
  tsGet(id).querySelector('.ts-input').style.borderColor='#cfcfcf';
  tsGet(id+'-value').textContent='';tsShow(id+'-caret',0);
 }
 tsShow('slash',0);tsShow('menu',0);tsMove('menu');tsShow('submit',responding?1:0);tsMove('submit');
 if(building){
  tsShow('name',1);tsShow('email',f>=139?1:0);tsShow('project',f>=166?1:0);
  if(f<139){
   tsShow('slash',f>=91?1:0);tsType('slash-value','/email',tsPart(f,91,106));
   tsShow('menu',f>=106?tsEase(tsPart(f,106,113)):0);tsMove('menu',0,14*(1-tsEase(tsPart(f,106,113))));
  }
  if(f>=139){const p=tsEase(tsPart(f,139,151));tsGet('email').querySelector('.ts-input').style.clipPath='inset(0 '+(100*(1-p))+'% 0 0)';}
  if(f>=166){const p=tsEase(tsPart(f,166,180));tsGet('project').querySelector('.ts-input').style.clipPath='inset(0 '+(100*(1-p))+'% 0 0)';tsMove('project',0,12*(1-p));}
  if(f>=117&&f<139){const p=tsEase(tsPart(f,117,129));tsShow('pointer',1);tsMove('pointer',tsMix(817,550,p),tsY.form+tsMix(594,489,p));}
 }
 if(f>=198&&f<241){
  tsShow('heading',1);tsShow('macro',1);
  const arrive=tsEase(tsPart(f,198,210));tsMove('macro',0,34*(1-arrive),.90+.1*arrive,-3*(1-arrive));
  const press=Math.sin(Math.PI*tsPart(f,227,237));tsGet('macro-button').style.transform='translateY('+(7*press)+'px) scale('+(1-.025*press)+')';
  tsGet('macro-button').style.boxShadow='0 '+(8-7*press)+'px 0 #0061b0';
  const p=tsEase(tsPart(f,211,225));tsShow('pointer',f>=211?1:0);tsMove('pointer',tsMix(947,735,p),tsMix(tsY.macro+320,tsY.macro+105,p));
  tsShow('press',f>=227&&f<238?1-tsPart(f,227,238):0);tsMove('press',688,tsY.macro+58,.5+tsPart(f,227,238)*.6);
 }
 if(responding){
  const values=[['name','Ada',246,258],['email','ada@example.com',265,284],['project','A new landing page.',291,315]];
  for(const [id,text,a,b] of values){tsType(id+'-value',text,tsPart(f,a,b));tsShow(id+'-caret',f>=a&&f<b+4?1:0);tsGet(id).querySelector('.ts-input').style.borderColor=f>=a&&f<b+4?'#666':'#cfcfcf';}
  const p=tsEase(tsPart(f,319,329));tsShow('pointer',f>=319?1:0);tsMove('pointer',tsMix(726,286,p),tsY.form+tsMix(512,610,p));
  const press=Math.sin(Math.PI*tsPart(f,330,337));tsMove('submit',0,2*press,1-.02*press);
 }
 if(f>=338&&f<373){
  tsShow('heading',1);tsShow('thanks',1);const p=tsEase(tsPart(f,338,346));tsMove('thanks',0,0,.985+.015*p);
  tsGet('thanks-check').style.transform='scale('+( .85+.15*p )+')';
  tsGet('thanks-check').querySelector('path').style.strokeDasharray='90';tsGet('thanks-check').querySelector('path').style.strokeDashoffset=String(90*(1-p));
 }
 if(f>=373&&f<452){
  tsShow('heading',f<452?1:0);tsShow('brief',1);
  const p=tsEase(tsPart(f,373,386)),out=tsEase(tsPart(f,444,452));
  tsMove('brief',0,14*(1-p)-22*out,1,0);
  tsGet('brief').style.clipPath='inset(0 0 '+(out*100)+'% 0 round 13px)';
  tsGet('brief').querySelectorAll('.ts-answer').forEach((el,i)=>{const q=tsEase(tsPart(f,373+i*3,386+i*3));el.style.transform='translateX('+(20*(1-q))+'px)';el.style.opacity=String(q)});
 }
 if(f>=452){
  tsShow('end',1);const p=tsEase(tsPart(f,452,467));tsGet('end').style.clipPath='none';tsMove('end',0,12*(1-p));
  const q=tsEase(tsPart(f,466,480));tsGet('cta').style.transform='translateY('+(15*(1-q))+'px)';tsGet('cta').style.opacity=String(q);
 }
}
`,
  };
}

export const tallyStudy = makeTallyStudy(false);
export const tallyFeedStudy = makeTallyStudy(true);
