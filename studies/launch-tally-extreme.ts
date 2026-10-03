import type { MotionStudy } from './types';

// A separate, manually authored maximalist cut. The original launch study is unchanged.
const values = ['Lucy', 'Doe', 'Acme', '', 'acme.inc', '+1 345-534-5634'];
const burst = (id: string, points = 12) => {
  const xy = Array.from({ length: points * 2 }, (_, i) => {
    const a = Math.PI * i / points - Math.PI / 2, r = i % 2 ? 32 : 49;
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
  }).join(' ');
  return `<svg id="${id}" class="tx-burst" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${xy}" fill="currentColor"/></svg>`;
};
const cursor = (id: string, className = '') => `<svg id="${id}" class="tx-pointer ${className}" viewBox="0 0 52 68" aria-hidden="true"><path d="M4 4L46 35L28 39L20 60Z" fill="currentColor" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
const asterisk = '<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="currentColor" stroke-width="15" stroke-linecap="round"><path d="M50 10v80M15 30l70 40M15 70l70-40"/></g></svg>';
const paper = (i: number) => `<div id="tx-fly-${i}" class="tx-fly"><div class="tx-fly-name">tally${asterisk}</div><i></i><i></i><i></i><b>Contact me <span>↗</span></b></div>`;
const resultCard = (id: string, extra = '') => `<div id="${id}" class="tx-result-card ${extra}"><div class="tx-result-brand">tally${asterisk}</div><div class="tx-result-check"><svg viewBox="0 0 100 100"><path d="M22 51l21 20 36-40"/></svg></div><h2>Thanks for completing this form!</h2><p>Made with Tally, the simplest way to create forms for free.</p><div class="tx-create">${asterisk}<span>Create your own form</span></div></div>`;

export const tallyStudy: MotionStudy = {
  id: 'tally', title: 'Tally — make hello happen / extreme', width: 1920, height: 1080, fps: 30, durationFrames: 540,
  reference: { path: '', startSeconds: 0, durationSeconds: 18 },
  reviewFrames: [0, 18, 45, 76, 89, 112, 145, 166, 178, 205, 229, 253, 267, 288, 307, 315, 326, 341, 365, 400, 418, 435, 461, 476, 493, 516, 539],
  notes: [
    'Separate manually authored 18-second extreme launch film. Not automatic URL generation, an official Tally campaign, or a recording of a real submission. Original launch-tally.ts is unchanged.',
    'Source pack .local/launch-tally-sourcepack-20261003/submission-fixture.json retains original public-source bytes, URLs and SHA-256 hashes. Contact form: https://tally.so/. Default thank-you appearance: https://tally.so/help/how-to-create-a-thank-you-page.',
    'Editable trusted HTML/SVG only: no screenshot pixels, remote assets, runtime-generated code or reference soundtrack. All frame state is a deterministic function of the requested frame.',
    'The form uses the captured six fields and example values, the real Contact me control, and documented default completion text. Typing lucy@acme.inc, clicking and showing completion are illustrative reconstructed actions using separate official sources; no real form was submitted.',
    'Acid yellow, pink and cobalt, repeated paper objects, cursors, starbursts, shouted copy and camera moves are editorial graphics. Repeated forms/confirmation cards are a visual motif, not a claim of multiple received responses or collaboration.',
    'The 160 BPM visual grid is 11.25 frames per beat. Accents move or scale objects; there is no full-screen strobe or repeated black-white flashing. Score/audio is attached separately by the operator and is not asserted to synchronize exactly.',
    'Source UI remains monochrome with the observed blue confirmation check. Typographic Tally lettering and Geist approximate source typography; editorial palettes do not claim observed brand colors.',
    'Short energetic proof: the completed email and actual submit control are readable, followed by a roughly 2.7-second stable thank-you view before the editorial stack payoff. CTA stays clear through the moving final two seconds.',
  ],
  html: `<div id="tx-film">
    <div id="tx-bg-yellow" class="tx-bg"></div><div id="tx-bg-blue" class="tx-bg"></div><div id="tx-bg-pink" class="tx-bg"></div>
    <div id="tx-stripe-a" class="tx-stripe"></div><div id="tx-stripe-b" class="tx-stripe"></div>
    <div id="tx-top"><span>tally${asterisk}</span><b>FOR FOUNDERS. FOR CREATORS.</b></div>
    <div id="tx-hook"><span id="tx-hook-0">MAKE</span><span id="tx-hook-1">HELLO</span><span id="tx-hook-2">HAPPEN.</span></div>
    <div id="tx-proof-copy">MAKE<br>CONTACT<span>→</span></div>
    <div id="tx-type-mat"></div><div id="tx-type-copy">GO ON.<br>SAY HI.</div>
    <div id="tx-send-copy">HIT<br>SEND<span>↘</span></div>
    <div id="tx-paper-cloud">${[0, 1, 2, 3, 4, 5].map(paper).join('')}</div>
    ${[0, 1, 2, 3, 4].map(i => burst(`tx-star-${i}`)).join('')}
    ${cursor('tx-deco-cursor-0')}${cursor('tx-deco-cursor-1')}
    <div id="tx-form-rig">
      <div id="tx-form-shadow"></div><div id="tx-form-back"></div>
      <div id="tx-form">
        <div class="tx-form-chrome"><i></i><i></i><i></i><span>tally.so</span></div>
        <h1>Your contact details</h1>
        <div id="tx-fields">${values.map((value, i) => `<div id="tx-field-${i}" class="tx-field"><span id="tx-value-${i}">${value}</span>${i === 3 ? '<b id="tx-caret"></b>' : ''}${i === 5 ? '<svg class="tx-flag" viewBox="0 0 30 20" aria-label="Australia"><path fill="#012169" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="3" d="M0 0l15 10M15 0L0 10"/><path stroke="#c8102e" stroke-width="1" d="M0 0l15 10M15 0L0 10"/><path fill="#fff" d="M6 0h3v10H6zM0 3.5h15v3H0z"/><path fill="#c8102e" d="M7 0h1v10H7zM0 4.5h15v1H0z"/><g fill="#fff"><circle cx="7.5" cy="15" r="2"/><circle cx="23" cy="4" r="1.2"/><circle cx="19" cy="10" r="1.2"/><circle cx="26" cy="9" r="1.2"/><circle cx="23" cy="16" r="1.2"/></g></svg><small>⌄</small>' : ''}</div>`).join('')}</div>
        <div id="tx-submit"><span>Contact me</span><svg viewBox="0 0 28 24"><path d="M2 12h22M15 3l9 9-9 9"/></svg></div>
        <div id="tx-email-focus"></div>
      </div>
      ${cursor('tx-main-cursor')}<div id="tx-click-ring"></div>
    </div>
    <div id="tx-click-impact">${burst('tx-impact-star', 16)}</div><div id="tx-button-wipe"></div>
    <div id="tx-completion"><div id="tx-result-ticker">HELLO ↗ HELLO ↗ HELLO ↗ HELLO ↗ HELLO ↗ HELLO ↗ HELLO ↗</div>${burst('tx-result-star-a', 16)}${burst('tx-result-star-b', 10)}<div id="tx-completion-label">HELLO, RECEIVED.</div>${resultCard('tx-result-back-0', 'tx-result-back')}${resultCard('tx-result-back-1', 'tx-result-back')}${resultCard('tx-result-main')}<div id="tx-payoff">HELLO<br>HAPPENED<span>↗</span></div></div>
    <div id="tx-close"><div id="tx-close-band-a"></div><div id="tx-close-band-b"></div>${burst('tx-close-star-a')}${burst('tx-close-star-b', 8)}<div id="tx-close-word">tally${asterisk}</div><div id="tx-close-cta">Create a free form <span>↗</span></div><div id="tx-close-url">tally.so</div><div id="tx-close-tag">YOUR NEXT HELLO STARTS HERE</div>${cursor('tx-close-cursor')}</div>
  </div>`,
  css: `
#tx-film{position:absolute;inset:0;overflow:hidden;background:#eeff00;color:#101010;letter-spacing:-1px}.tx-bg{position:absolute;inset:0}#tx-bg-yellow{background:#eeff00}#tx-bg-blue{background:#143eff;transform-origin:left center}#tx-bg-pink{background:#ff70c8;transform-origin:right center}
#tx-top{position:absolute;left:72px;right:72px;top:48px;display:flex;justify-content:space-between;align-items:center;z-index:3}#tx-top>span{font-size:70px;line-height:1;font-weight:850;letter-spacing:-5px;display:flex;align-items:center}#tx-top svg{width:42px;height:42px;margin:8px 0 0 7px}#tx-top b{font-size:22px;letter-spacing:2px;font-weight:800}
#tx-hook{position:absolute;left:68px;top:240px;font-size:167px;line-height:.88;font-weight:900;letter-spacing:-12px;z-index:3}#tx-hook>span{display:block;transform-origin:left center}#tx-hook-1{color:#143eff}#tx-hook-2{font-size:145px;letter-spacing:-10px}#tx-proof-copy,#tx-send-copy{position:absolute;left:67px;top:287px;font-weight:900;font-size:135px;letter-spacing:-9px;line-height:.9;color:#eeff00;z-index:3}#tx-proof-copy span{display:block;font-size:198px;margin-left:9px;line-height:.85}#tx-type-copy{position:absolute;left:66px;top:212px;font-size:118px;line-height:.91;letter-spacing:-8px;font-weight:900;z-index:3}#tx-send-copy{top:258px;color:#111;font-size:170px}#tx-send-copy span{display:block;color:#143eff;font-size:194px;line-height:.8}
#tx-type-mat{position:absolute;left:0;top:0;width:601px;height:1080px;background:#ff70c8;border-right:4px solid #111;z-index:3;transform-origin:left center}#tx-type-copy{top:260px}
.tx-stripe{position:absolute;height:115px;width:2300px;left:-180px;top:940px;background:#101010;transform:rotate(-7deg);transform-origin:center}.tx-stripe:after{content:'HELLO  ↗  HELLO  ↗  HELLO  ↗  HELLO  ↗  HELLO  ↗';color:#eeff00;font-size:62px;line-height:115px;font-weight:850;white-space:nowrap;letter-spacing:1px}#tx-stripe-b{top:-215px;background:#ff70c8;height:85px}#tx-stripe-b:after{content:''}
.tx-burst{position:absolute;width:190px;height:190px;color:#ff70c8;transform-origin:center}.tx-pointer{position:absolute;width:83px;height:108px;color:#111;overflow:visible;transform-origin:4px 4px}#tx-deco-cursor-0{color:#143eff}#tx-deco-cursor-1{color:#ff70c8}
#tx-paper-cloud{position:absolute;inset:0;pointer-events:none}.tx-fly{position:absolute;left:0;top:0;width:330px;height:390px;border:3px solid #111;background:#fff;box-shadow:12px 12px 0 #111;padding:28px;transform-origin:center}.tx-fly-name{font-size:48px;font-weight:850;letter-spacing:-4px;display:flex;align-items:center;margin-bottom:29px}.tx-fly-name svg{width:30px;height:30px;margin-left:5px}.tx-fly>i{display:block;height:38px;border:2px solid #bbb;border-radius:4px;margin:14px 0}.tx-fly>b{display:flex;justify-content:space-between;background:#111;color:#fff;font-size:20px;padding:13px 15px;margin-top:25px;letter-spacing:0}.tx-fly:nth-child(2n){background:#ffb9e5}
#tx-form-rig{position:absolute;left:0;top:0;width:1000px;height:650px;transform-origin:0 0;z-index:2}#tx-form-shadow,#tx-form-back,#tx-form{position:absolute;inset:0;border:3px solid #111;border-radius:14px;transform-origin:center}#tx-form-shadow{background:#111;transform:translate(27px,29px) rotate(3deg)}#tx-form-back{background:#ff70c8;transform:translate(13px,15px) rotate(1.5deg)}#tx-form{background:#fff;overflow:hidden}.tx-form-chrome{height:52px;border-bottom:2px solid #111;display:flex;align-items:center;gap:9px;padding:0 20px}.tx-form-chrome i{display:block;width:10px;height:10px;border-radius:50%;background:#111}.tx-form-chrome>span{font-size:17px;letter-spacing:0;margin-left:auto;color:#777}#tx-form h1{position:absolute;left:70px;top:90px;margin:0;font-size:41px;line-height:52px;font-weight:700;letter-spacing:-1.6px}#tx-fields{position:absolute;left:70px;top:173px;display:grid;grid-template-columns:415px 415px;gap:20px 22px}.tx-field{position:relative;border:1.5px solid #c9c9c9;border-radius:7px;width:415px;height:72px;line-height:69px;padding:0 16px;font-size:29px;letter-spacing:-.5px;background:#fff;color:#444;white-space:nowrap;overflow:hidden;transform-origin:left center}.tx-field small{position:absolute;right:10px;top:0;color:#888;font-size:24px}.tx-flag{position:absolute;right:35px;top:26px;width:27px;height:18px}#tx-caret{display:inline-block;vertical-align:-6px;width:3px;height:33px;margin-left:1px;background:#111}#tx-submit{position:absolute;left:70px;top:473px;width:239px;height:72px;border-radius:7px;background:#111;color:#fff;font-size:29px;font-weight:650;letter-spacing:-.5px;display:flex;align-items:center;justify-content:center;gap:17px;transform-origin:center}#tx-submit svg{width:27px;height:24px}#tx-submit path{fill:none;stroke:currentColor;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}#tx-email-focus{position:absolute;left:499px;top:257px;width:431px;height:88px;border:5px solid #143eff;border-radius:12px;pointer-events:none}#tx-main-cursor{width:48px;height:62px;z-index:3}#tx-click-ring{position:absolute;width:70px;height:70px;border:4px solid #111;border-radius:50%;transform-origin:center;pointer-events:none}
#tx-click-impact{position:absolute;left:380px;top:594px;width:365px;height:365px;z-index:1}#tx-impact-star{inset:0;width:100%;height:100%;color:#ff70c8}#tx-button-wipe{position:absolute;background:#111;z-index:6;border-radius:9px}
#tx-completion{position:absolute;inset:0;background:#143eff;z-index:7;overflow:hidden}#tx-completion-label{position:absolute;left:74px;top:40px;color:#eeff00;font-size:39px;font-weight:850;letter-spacing:2px}.tx-result-card{position:absolute;left:0;top:0;width:1400px;height:790px;background:white;border:3px solid #111;border-radius:15px;box-shadow:18px 20px 0 #111;transform-origin:0 0;overflow:hidden;text-align:center}.tx-result-brand{position:absolute;left:49px;top:33px;font-weight:750;font-size:52px;letter-spacing:-4px;display:flex;align-items:center}.tx-result-brand svg{width:32px;height:32px;margin-left:5px}.tx-result-check{position:absolute;left:645px;top:145px;width:110px;height:110px;background:#e0f0ff;border-radius:50%;display:grid;place-items:center}.tx-result-check svg{width:76px;height:76px}.tx-result-check path{fill:none;stroke:#238bdf;stroke-width:8;stroke-linejoin:round;stroke-linecap:round}.tx-result-card h2{position:absolute;left:58px;right:58px;top:339px;margin:0;font-weight:680;font-size:57px;line-height:1.15;letter-spacing:-2.7px}.tx-result-card p{position:absolute;left:75px;right:75px;top:434px;margin:0;font-size:26px;line-height:1.3;color:#888;letter-spacing:-.45px}.tx-create{position:absolute;left:443px;top:532px;width:514px;height:66px;display:flex;align-items:center;justify-content:center;gap:16px;border:1px solid #ddd;border-radius:6px;font-size:28px;font-weight:550;letter-spacing:-.7px}.tx-create svg{width:29px;height:29px;color:#d750d9}.tx-result-back{pointer-events:none}#tx-payoff{position:absolute;left:73px;top:265px;font-size:158px;line-height:.9;font-weight:900;letter-spacing:-10px;color:#eeff00}#tx-payoff span{display:block;font-size:210px;margin-left:12px;line-height:1}
#tx-result-ticker{position:absolute;left:-300px;top:965px;width:3100px;white-space:nowrap;font-size:79px;font-weight:900;letter-spacing:-3px;line-height:1;color:#ff70c8;transform-origin:center}#tx-result-star-a{left:-94px;top:215px;width:440px;height:440px;color:#eeff00}#tx-result-star-b{left:1630px;top:620px;width:460px;height:460px;color:#ff70c8}
#tx-close{position:absolute;inset:0;background:#111;z-index:8;overflow:hidden;color:#eeff00}#tx-close-word{position:absolute;left:410px;top:189px;display:flex;align-items:center;font-size:345px;line-height:1.1;font-weight:850;letter-spacing:-26px;transform-origin:center}#tx-close-word svg{width:166px;height:166px;margin:39px 0 0 18px}#tx-close-cta{position:absolute;left:475px;top:650px;width:970px;height:143px;border:4px solid #111;box-shadow:10px 10px 0 #ff70c8;background:#eeff00;color:#111;display:flex;align-items:center;justify-content:center;gap:52px;font-weight:780;font-size:62px;letter-spacing:-2px;transform-origin:center}#tx-close-cta span{font-size:78px}#tx-close-url{position:absolute;left:800px;top:885px;width:320px;text-align:center;color:white;font-size:40px;font-weight:600;letter-spacing:-1px}#tx-close-tag{position:absolute;left:0;right:0;top:83px;text-align:center;font-size:24px;font-weight:750;letter-spacing:4px;color:#fff}#tx-close-band-a,#tx-close-band-b{position:absolute;left:-70px;top:-100px;width:320px;height:1300px;background:#ff70c8;transform-origin:center}#tx-close-band-b{left:1720px;background:#143eff}#tx-close-star-a{width:300px;height:300px;color:#143eff;left:70px;top:446px}#tx-close-star-b{width:220px;height:220px;color:#ff70c8;left:1586px;top:142px}#tx-close-cursor{left:1450px;top:813px;color:#ff70c8;width:112px;height:145px}
`,
  script: `
function txEl(id){return document.getElementById(id);}
function txClamp(x){return Math.max(0,Math.min(1,x));}
function txP(f,a,b){return txClamp((f-a)/(b-a));}
function txEase(t){t=txClamp(t);return 1-Math.pow(1-t,4);}
function txSmooth(t){t=txClamp(t);return t*t*(3-2*t);}
function txMix(a,b,t){return a+(b-a)*t;}
function txO(id,v){txEl(id).style.opacity=String(txClamp(v));}
function txM(id,x,y,s,r){txEl(id).style.transform='translate('+x+'px,'+y+'px) rotate('+(r||0)+'deg) scale('+(s===undefined?1:s)+')';}
function txRig(f){
 const keys=[[0,991,241,.80,-8],[18,1050,280,.75,5],[33,900,185,.87,-7],[45,951,201,.85,-4],[80,923,195,.88,-3],[101,742,175,1.01,0],[156,742,175,1.01,0],[180,-348,-48,2.03,0],[251,-348,-48,2.03,0],[279,670,157,1.09,0],[320,670,157,1.09,0]];
 for(let i=1;i<keys.length;i++){if(f<=keys[i][0]){const a=keys[i-1],b=keys[i],p=txSmooth(txP(f,a[0],b[0]));return[txMix(a[1],b[1],p),txMix(a[2],b[2],p),txMix(a[3],b[3],p),txMix(a[4],b[4],p)];}}
 return[670,157,1.09,0];
}
function draw(frame){
 const f=Math.max(0,Math.min(539,frame)),beat=f/11.25,hit=Math.pow(1-(beat-Math.floor(beat)),3),rig=txRig(f);
 txEl('tx-bg-blue').style.transform='translateX('+(1920*(1-txEase(txP(f,84,99))))+'px)';
 txEl('tx-bg-pink').style.transform='translateY('+(1080*(1-txEase(txP(f,160,176))))+'px)';
 txO('tx-bg-pink',1-txEase(txP(f,258,272)));txO('tx-bg-blue',1-txEase(txP(f,258,272)));
 txO('tx-top',(1-txP(f,305,322))*(1-txEase(txP(f,161,174))*(1-txEase(txP(f,256,272)))));txEl('tx-top').style.color=f>=98&&f<163?'#eeff00':'#111';
 const opening=1-txEase(txP(f,82,97));txO('tx-hook',opening);txM('tx-hook',-120*(1-opening),0,1,0);
 for(let i=0;i<3;i++){const settle=txEase(txP(f,i*9,i*9+13)),accent=(f<77?hit:0);txM('tx-hook-'+i,24*(1-settle),0,.985+.015*settle+.012*accent,-2.5*(1-settle));}
 const proof=txEase(txP(f,92,105))*(1-txEase(txP(f,153,169)));txO('tx-proof-copy',proof);txM('tx-proof-copy',-90*(1-proof),0,1,0);
 const type=txEase(txP(f,166,183))*(1-txP(f,246,250)),mat=txEase(txP(f,166,183))*(1-txEase(txP(f,251,267)));txO('tx-type-copy',type);txM('tx-type-copy',0,-45*(1-type),1,0);txO('tx-type-mat',mat);txM('tx-type-mat',-601*(1-mat),0,1,0);
 const send=txEase(txP(f,277,288));txO('tx-send-copy',send*(1-txP(f,320,334)));txM('tx-send-copy',-70*(1-send),0,1,0);
 txM('tx-stripe-a',-((f*12)%340),35*Math.sin(f/33),1,-7);txO('tx-stripe-a',(1-txP(f,158,174))*.95);txM('tx-stripe-b',0,40*Math.sin(f/39),1,9);
 const cloud=1-txEase(txP(f,155,177));txO('tx-paper-cloud',cloud);
 const fly=[[2180-((f*30+350)%2660),876,.70,17],[-390+((f*27+1250)%2560),-252,.75,-13],[-248,-420+((f*21+570)%1580),.76,-14],[1840,-420+((f*25+120)%1650),.78,26],[2120-((f*36+500)%2540),-316,.74,8],[-370+((f*29+900)%2650),924,.63,-23]];
 for(let i=0;i<6;i++){const q=fly[i];txM('tx-fly-'+i,q[0],q[1]+22*Math.sin(f/12+i),q[2]+.04*hit,q[3]+22*Math.sin(f/16+i));}
 const stars=[[760,707,200,'#ff70c8'],[1667,90,167,'#ff70c8'],[117,850,118,'#143eff'],[1810,800,211,'#eeff00'],[686,-70,147,'#143eff']];
 for(let i=0;i<5;i++){const a=stars[i],e=txEl('tx-star-'+i);e.style.width=a[2]+'px';e.style.height=a[2]+'px';e.style.color=a[3];txM('tx-star-'+i,a[0]+16*Math.sin(f/21+i),a[1]+20*Math.cos(f/27+i),1+.12*hit,f*(i%2?-.6:.8));txO('tx-star-'+i,f<165?1:(f<261?.35:1)*(1-txP(f,320,334)));}
 txM('tx-deco-cursor-0',1790+35*Math.sin(f/15),730+45*Math.cos(f/23),1.18,-18);txO('tx-deco-cursor-0',1-txP(f,161,172));txM('tx-deco-cursor-1',832+25*Math.cos(f/19),862+25*Math.sin(f/27),.85,14);txO('tx-deco-cursor-1',1-txP(f,161,172));
 txM('tx-form-rig',rig[0],rig[1],rig[2],rig[3]);txO('tx-form-rig',1-txP(f,324,335));
 for(let i=0;i<6;i++){const p=txEase(txP(f,0+i*5,14+i*5));txO('tx-field-'+i,.65+.35*p);txM('tx-field-'+i,28*(1-p),0,1,0);}
 const email='lucy@acme.inc',typed=Math.floor(email.length*txP(f,187,229));txEl('tx-value-3').textContent=email.slice(0,typed);txO('tx-caret',f>=179&&f<249&&Math.floor(f/5)%2===0?1:0);txO('tx-email-focus',txEase(txP(f,176,184))*(1-txP(f,250,268)));
 let cx=739,cy=303,co=0;const press=Math.sin(txP(f,306,318)*Math.PI);
 if(f>=174&&f<250){co=txP(f,174,180)*(1-txP(f,233,250));cx=718+16*(1-txEase(txP(f,174,184)));cy=301;}
 if(f>=275&&f<330){const p=txSmooth(txP(f,276,305));co=txP(f,275,282);cx=txMix(728,254,p);cy=txMix(353,516,p);}
 txO('tx-main-cursor',co);txM('tx-main-cursor',cx,cy,1-.18*press,0);txEl('tx-submit').style.transform='scale('+(1-.075*press)+')';txM('tx-click-ring',219,481,.5+txP(f,307,321),0);txO('tx-click-ring',f>=307&&f<321?Math.sin(txP(f,307,321)*Math.PI):0);
 txO('tx-click-impact',f>=307&&f<332?Math.sin(txP(f,307,332)*Math.PI):0);txM('tx-click-impact',0,0,.7+.7*txEase(txP(f,307,330)),f*.6);
 const wipe=txEase(txP(f,319,335));txO('tx-button-wipe',f>=319&&f<342?1:0);const we=txEl('tx-button-wipe');we.style.left=txMix(670+70*1.09,0,wipe)+'px';we.style.top=txMix(157+473*1.09,0,wipe)+'px';we.style.width=txMix(239*1.09,1920,wipe)+'px';we.style.height=txMix(72*1.09,1080,wipe)+'px';we.style.borderRadius=txMix(9,0,wipe)+'px';
 const complete=txEase(txP(f,333,346));txO('tx-completion',complete);txM('tx-completion',0,1080*(1-complete),1,0);
 txM('tx-result-ticker',-((f*15)%455),8*Math.sin(f/14),1,-2);txM('tx-result-star-a',27*Math.sin(f/12)-480*txEase(txP(f,412,429)),37*Math.cos(f/16),1+.09*hit,f*1.7);txM('tx-result-star-b',35*Math.cos(f/15),31*Math.sin(f/12),1+.10*hit,-f*1.5);
 const payoff=txEase(txP(f,418,439));txO('tx-completion-label',1-payoff);txO('tx-payoff',payoff);txM('tx-payoff',-160*(1-payoff),0,1,0);
 const fold=txEase(txP(f,468,485)),settle=txEase(txP(f,337,349));
 txM('tx-result-main',txMix(260,937,payoff)+450*fold+22*Math.sin(f/9)*payoff,txMix(150,310,payoff)+240*fold+11*Math.cos(f/11)*payoff,txMix(1,.63,payoff)*(1-.15*fold+.018*hit*payoff),txMix(0,-6,payoff)+15*fold+2*Math.sin(f/9)*payoff);txO('tx-result-main',settle);
 txM('tx-result-back-0',937+90*payoff+350*fold,310-85*payoff+210*fold,.63,-6+12*payoff+10*fold+7*Math.sin(f/12)*payoff);txO('tx-result-back-0',payoff);txM('tx-result-back-1',937+150*payoff+300*fold,310-150*payoff+180*fold,.63,-6+19*payoff+15*fold-8*Math.sin(f/14)*payoff);txO('tx-result-back-1',payoff);
 const close=txEase(txP(f,476,491));txO('tx-close',close);txM('tx-close',-1920*(1-close),0,1,0);
 const ch=Math.pow(1-((f-480)/11.25-Math.floor((f-480)/11.25)),3);txM('tx-close-word',0,-6*ch,1+.015*ch,0);txM('tx-close-cta',0,4*ch,1,0);
 txM('tx-close-band-a',28*Math.sin(f/13),-20*Math.cos(f/18),1,-15+4*Math.sin(f/30));txM('tx-close-band-b',-30*Math.sin(f/15),24*Math.cos(f/17),1,18+4*Math.cos(f/27));txM('tx-close-star-a',0,18*Math.sin(f/12),1+.15*ch,f*1.25);txM('tx-close-star-b',0,14*Math.cos(f/13),1+.12*ch,-f*1.2);txM('tx-close-cursor',35*Math.sin(f/12),20*Math.cos(f/13),1,12+8*Math.sin(f/19));
}
`,
};
