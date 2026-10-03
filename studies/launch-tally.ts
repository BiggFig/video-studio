import type { MotionStudy } from './types';

// Hand-authored product film. This is not an automatic pipeline acceptance.
const fields = ['Lucy', 'Doe', 'Acme', 'lucy@acme.inc', 'acme.inc', '+1 345-534-5634'];
const star = (id: string, className = '') => `<svg id="${id}" class="tl-star ${className}" viewBox="0 0 100 100" aria-hidden="true"><g fill="currentColor">${[0, 60, 120].map(angle => `<rect x="43" y="5" width="14" height="90" rx="7" transform="rotate(${angle} 50 50)"/>`).join('')}</g></svg>`;
const logo = (className = '') => `<div class="tl-logo ${className}">tally${star('tl-logo-star-' + className)}</div>`;

export const tallyStudy: MotionStudy = {
  id: 'tally', title: 'Tally — ideas need replies', width: 1920, height: 1080, fps: 30, durationFrames: 720,
  reference: { path: '', startSeconds: 0, durationSeconds: 24 },
  reviewFrames: [0, 24, 55, 89, 90, 115, 165, 189, 190, 222, 253, 287, 319, 320, 347, 370, 382, 394, 405, 417, 434, 480, 515, 529, 555, 583, 599, 600, 617, 640, 680, 719],
  notes: [
    'Manually authored 24-second product launch study, not URL-only generation, provider acceptance or a recording of a submitted form.',
    'Source pack: .local/launch-tally-sourcepack-20261003/submission-fixture.json. Original form https://tally.so/; completion https://tally.so/help/how-to-create-a-thank-you-page. Exact source sizes and SHA-256 hashes are retained in provenance.json.',
    'All visible interface is editable authored HTML/SVG. No screenshot pixels, remote resources, reference clips or soundtrack are embedded.',
    'The six contact fields, public example values and Contact me control follow the captured form. Email entry and click are illustrative reconstructed actions; no real submission occurred.',
    'The line-to-fields build is an editorial representation of the documented doc-like builder, not an invented authenticated editor toolbar. Completion uses the actual documented default thank-you copy.',
    'Lemon paper surfaces, typography, cursor and camera are authored editorial direction. The completed UI reframes into the payoff without resetting its result. Geist and a typographic Tally wordmark approximate source typography; the source is not asserted to use this exact font or logo geometry.',
    'The thank-you example is a separate official source. Its factual submission relationship is documented; no claim that the pictured original contact example was operated.',
    'No audio is included by this study. Root may separately attach owned instrumental audio with explicit provenance.',
  ],
  html: `<div id="tl-film">
    <div id="tl-base"></div><div id="tl-lemon"></div><div id="tl-rule"></div>
    <div id="tl-top-logo">${logo('top')}</div><div id="tl-edition">FOR FOUNDERS WITH AN IDEA</div>
    <div id="tl-hook"><span>Ideas need</span><br><span class="tl-hook-last">replies.<i></i></span></div>
    <div id="tl-doc-copy"><span>Like a doc.</span><br><span>Made for<br>replies.</span></div>
    <div id="tl-detail-copy">Room for<br>the details.</div>
    <div id="tl-form-rig">
      <div class="tl-paper tl-paper-back"></div><div class="tl-paper tl-paper-mid"></div>
      <div id="tl-form" class="tl-paper">
        <div class="tl-browser-line"><i></i><i></i><i></i></div>
        <div id="tl-form-title"><span id="tl-title-text">Your contact details</span><b id="tl-title-caret"></b></div>
        <div id="tl-fields">${fields.map((value, i) => `<div id="tl-field-${i}" class="tl-field" data-source-field="${i}"><span id="tl-field-value-${i}">${value}</span>${i === 3 ? '<b id="tl-email-caret"></b>' : ''}${i === 5 ? '<svg class="tl-flag" viewBox="0 0 30 20" aria-label="Australia"><path fill="#012169" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="3" d="M0 0l15 10M15 0L0 10"/><path stroke="#c8102e" stroke-width="1" d="M0 0l15 10M15 0L0 10"/><path fill="#fff" d="M6 0h3v10H6zM0 3.5h15v3H0z"/><path fill="#c8102e" d="M7 0h1v10H7zM0 4.5h15v1H0z"/><g fill="#fff"><circle cx="7.5" cy="15" r="2"/><circle cx="23" cy="4" r="1.2"/><circle cx="19" cy="10" r="1.2"/><circle cx="26" cy="9" r="1.2"/><circle cx="23" cy="16" r="1.2"/></g></svg><span class="tl-chevron">⌄</span>' : ''}</div>`).join('')}</div>
        <div id="tl-submit"><span>Contact me</span><svg viewBox="0 0 28 24"><path d="M2 12h22M15 3l9 9-9 9"/></svg></div>
        <div id="tl-email-focus"></div>
      </div>
      <svg id="tl-cursor" viewBox="0 0 48 60"><path d="M5 3L40 32L24 34L17 51Z" fill="#111" stroke="white" stroke-width="3" stroke-linejoin="round"/><circle id="tl-click-ring" cx="5" cy="3" r="12" fill="none" stroke="#111" stroke-width="2"/></svg>
    </div>
    <div id="tl-submit-wipe"></div>
    <div id="tl-thanks">
      <div id="tl-payoff">Make hello<br>happen.</div>
      <div id="tl-thanks-window">
      <div id="tl-thanks-top" class="tl-thanks-top">${logo('result')}</div>
      <div id="tl-check-disc"><svg viewBox="0 0 100 100"><path id="tl-check-path" d="M25 51L43 69L78 32"/></svg></div>
      <h1 id="tl-thanks-title">Thanks for completing this form!</h1>
      <p id="tl-thanks-byline">Made with Tally, the simplest way to create forms for free.</p>
      <div id="tl-thanks-create">${star('tl-thanks-star')}<span>Create your own form</span></div>
      </div>
    </div>
    <div id="tl-end"><div id="tl-end-paper-a"></div><div id="tl-end-paper-b"></div>${star('tl-end-star')}<div id="tl-end-logo">${logo('end')}</div><div id="tl-end-cta">Create a free form <svg viewBox="0 0 36 28"><path d="M2 14h29M20 3l11 11-11 11"/></svg></div><div id="tl-end-url">tally.so</div></div>
  </div>`,
  css: `
#tl-film{position:absolute;inset:0;background:#f5f5ef;color:#171717;letter-spacing:-1.8px;overflow:hidden}
#tl-base,#tl-lemon,#tl-thanks,#tl-end{position:absolute;inset:0}#tl-base{background:#f5f5ef}#tl-lemon{background:#ecf78c;transform-origin:right center}
#tl-rule{position:absolute;left:116px;right:116px;top:169px;height:1px;background:#1113}
.tl-logo{display:flex;align-items:center;font-size:78px;line-height:1;font-weight:750;letter-spacing:-6px}.tl-logo .tl-star{width:44px;height:44px;margin:10px 0 0 6px}.tl-star{display:block;color:inherit}
#tl-top-logo{position:absolute;left:116px;top:66px}#tl-edition{position:absolute;right:118px;top:99px;font-size:21px;font-weight:650;letter-spacing:2.8px}
#tl-hook{position:absolute;left:116px;top:302px;font-size:135px;font-weight:650;line-height:1.05;letter-spacing:-8px}.tl-hook-last{position:relative}.tl-hook-last i{position:absolute;left:3px;bottom:-10px;width:444px;height:13px;background:#171717;transform:rotate(-2deg);transform-origin:left}
#tl-doc-copy{position:absolute;left:116px;top:348px;font-size:78px;font-weight:550;line-height:1.08;letter-spacing:-4px}#tl-doc-copy>span:first-child{color:#85857d;font-size:45px;letter-spacing:-1.7px;line-height:1.8}
#tl-detail-copy{position:absolute;left:1706px;top:242px;width:180px;font-size:42px;font-weight:550;letter-spacing:-1.8px;line-height:1.12;z-index:3}
#tl-form-rig{position:absolute;width:1000px;height:640px;transform-origin:0 0}.tl-paper{position:absolute;left:0;top:0;width:1000px;height:640px;border-radius:17px;background:white;border:1px solid #deded9;transform-origin:center}.tl-paper-back{background:#d4c7ef;transform:translate(24px,29px) rotate(2deg);border:none}.tl-paper-mid{background:#171717;transform:translate(12px,14px) rotate(.8deg);border:none}
#tl-form{box-shadow:0 24px 42px #18180e12;overflow:hidden}.tl-browser-line{height:48px;border-bottom:1px solid #ecece9;display:flex;gap:8px;align-items:center;padding-left:20px}.tl-browser-line i{width:10px;height:10px;border-radius:50%;background:#dededc}
#tl-form-title{position:absolute;left:80px;top:95px;font-size:34px;font-weight:650;line-height:46px;letter-spacing:-1px;white-space:nowrap}#tl-title-caret{display:inline-block;width:3px;height:37px;background:#171717;vertical-align:-6px;margin-left:2px}
#tl-fields{position:absolute;left:80px;top:161px;width:840px;display:grid;grid-template-columns:405px 405px;gap:17px 22px}.tl-field{position:relative;height:62px;border:1px solid #d1d1cd;box-shadow:0 2px 4px #00000008;border-radius:7px;background:#fff;color:#4a4a47;font-size:28px;line-height:60px;padding:0 17px;letter-spacing:-.35px;white-space:nowrap;overflow:hidden;transform-origin:left center}.tl-flag{position:absolute;right:35px;top:22px;width:26px;height:18px}.tl-chevron{position:absolute;right:12px;top:-2px;font-size:26px;color:#92928c}#tl-email-caret{display:inline-block;width:2px;height:31px;vertical-align:-6px;background:#111;margin-left:1px}
#tl-submit{position:absolute;left:80px;top:414px;width:218px;height:66px;background:#111;color:white;border-radius:7px;display:flex;gap:14px;align-items:center;justify-content:center;font-size:28px;font-weight:650;letter-spacing:-.55px;box-shadow:0 3px 5px #0002;transform-origin:center}#tl-submit svg{width:27px;height:24px}#tl-submit path,#tl-end-cta path{fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
#tl-email-focus{position:absolute;left:503px;top:234px;width:417px;height:74px;border:3px solid #9680b7;border-radius:10px;pointer-events:none;opacity:0}
#tl-cursor{position:absolute;left:0;top:0;width:37px;height:46px;filter:drop-shadow(0 2px 1px #0002);overflow:visible;transform-origin:5px 3px}
#tl-submit-wipe{position:absolute;background:#111;border-radius:12px;transform-origin:center;pointer-events:none}
#tl-thanks{background:#ecf78c;text-align:center;opacity:0;pointer-events:none}#tl-thanks-window{position:absolute;left:0;top:0;width:1920px;height:1080px;background:white;transform-origin:0 0;overflow:hidden}#tl-payoff{position:absolute;left:116px;top:338px;font-size:130px;font-weight:600;line-height:1.04;letter-spacing:-7px;text-align:left}#tl-thanks-top{position:absolute;left:116px;top:66px}.tl-thanks-top .tl-logo{font-size:52px}.tl-thanks-top .tl-star{width:30px;height:30px}
#tl-check-disc{position:absolute;left:886px;top:262px;width:148px;height:148px;border-radius:50%;background:#e0f0ff;display:grid;place-items:center}#tl-check-disc svg{width:88px;height:88px}#tl-check-path{stroke:#238bdf;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;fill:none;stroke-dasharray:80;stroke-dashoffset:0}
#tl-thanks-title{position:absolute;left:120px;right:120px;top:458px;margin:0;font-size:64px;line-height:1.15;font-weight:650;letter-spacing:-2.5px}#tl-thanks-byline{position:absolute;left:130px;right:130px;top:557px;margin:0;color:#888881;font-size:32px;line-height:1.3;letter-spacing:-.4px}#tl-thanks-create{position:absolute;left:702px;top:660px;width:516px;height:66px;border:1px solid #e2e2df;box-shadow:0 2px 5px #00000004;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:14px;font-size:31px;font-weight:550;letter-spacing:-.7px}#tl-thanks-create .tl-star{width:32px;height:32px;color:#d750d9}
#tl-end{background:#ecf78c;opacity:0;pointer-events:none;overflow:hidden}#tl-end-paper-a,#tl-end-paper-b{position:absolute;width:610px;height:780px;border:1px solid #151515;right:-320px;top:190px;transform:rotate(-18deg);background:#fff}#tl-end-paper-b{right:-358px;top:220px;background:#d4c7ef;transform:rotate(-11deg)}#tl-end-star{position:absolute;width:330px;height:330px;left:112px;top:195px}#tl-end-logo{position:absolute;left:635px;top:271px}#tl-end-logo .tl-logo{font-size:230px;letter-spacing:-19px}#tl-end-logo .tl-star{width:107px;height:107px;margin-top:24px;margin-left:16px}#tl-end-cta{position:absolute;left:637px;top:604px;display:flex;align-items:center;justify-content:center;gap:25px;width:618px;height:110px;border-radius:7px;background:#111;color:#fff;font-size:47px;font-weight:550;letter-spacing:-1.5px}#tl-end-cta svg{width:39px;height:30px}#tl-end-url{position:absolute;left:638px;top:773px;font-size:33px;font-weight:450;letter-spacing:-.5px}
`,
  script: `
const tlEl=id=>document.getElementById(id);
const tlClamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const tlP=(f,a,b)=>tlClamp((f-a)/(b-a));
const tlEase=x=>1-Math.pow(1-tlClamp(x),3);
const tlSmooth=x=>{x=tlClamp(x);return x*x*(3-2*x)};
const tlMix=(a,b,t)=>a+(b-a)*t;
function tlOpacity(id,v){tlEl(id).style.opacity=String(tlClamp(v));}
function tlMove(id,x,y,s=1,r=0){tlEl(id).style.transform='translate('+x+'px,'+y+'px) scale('+s+') rotate('+r+'deg)';}
function tlRigAt(f){
 const keys=[[0,1050,340,.76,-4],[70,1002,290,.82,-3],[115,610,229,1.10,0],[190,610,229,1.10,0],[225,-20,66,1.66,0],[300,-20,66,1.66,0],[342,425,210,1.17,0],[390,425,210,1.17,0]];
 for(let i=1;i<keys.length;i++){if(f<=keys[i][0]){const a=keys[i-1],b=keys[i],p=tlSmooth(tlP(f,a[0],b[0]));return a.slice(1).map((v,j)=>tlMix(v,b[j+1],p));}}
 return keys[keys.length-1].slice(1);
}
function draw(frame){
 const f=tlClamp(frame,0,719),rig=tlRigAt(f),intro=1-tlEase(tlP(f,78,106)),doc=tlEase(tlP(f,91,113))*(1-tlEase(tlP(f,177,201))),close=tlEase(tlP(f,206,228))*(1-tlEase(tlP(f,299,323)));
 tlOpacity('tl-top-logo',1-tlP(f,378,394));tlOpacity('tl-edition',1-tlEase(tlP(f,78,106)));tlOpacity('tl-rule',1-tlEase(tlP(f,80,115)));
 tlOpacity('tl-hook',intro);tlMove('tl-hook',-48*(1-intro),0);tlEl('tl-hook').querySelector('i').style.transform='rotate(-2deg) scaleX('+tlEase(tlP(f,15,43))+')';
 tlOpacity('tl-doc-copy',doc);tlMove('tl-doc-copy',-28*(1-doc),0);tlOpacity('tl-detail-copy',close);tlMove('tl-detail-copy',28*(1-close),0);
 tlEl('tl-lemon').style.transform='scaleX('+(1-.71*tlEase(tlP(f,84,120))+.04*close)+')';
 tlOpacity('tl-form-rig',f<395?1:1-tlP(f,395,409));tlMove('tl-form-rig',rig[0],rig[1],rig[2],rig[3]);
 const title='Your contact details',typed=Math.floor(title.length*tlP(f,9,53));tlEl('tl-title-text').textContent=title.slice(0,typed);tlOpacity('tl-title-caret',f<62&&Math.floor(f/9)%2===0?1:0);
 const values=['Lucy','Doe','Acme','lucy@acme.inc','acme.inc','+1 345-534-5634'];
 for(let i=0;i<6;i++){const p=tlEase(tlP(f,38+i*5,57+i*5));tlOpacity('tl-field-'+i,p);tlMove('tl-field-'+i,0,18*(1-p));tlEl('tl-field-value-'+i).textContent=values[i];}
 const email='lucy@acme.inc',emailProgress=tlP(f,218,263);if(f>=207&&f<263)tlEl('tl-field-value-3').textContent=email.slice(0,Math.floor(email.length*emailProgress));
 tlOpacity('tl-email-caret',f>=213&&f<286&&Math.floor(f/10)%2===0?1:0);tlOpacity('tl-email-focus',tlEase(tlP(f,208,219))*(1-tlEase(tlP(f,285,303))));
 const submit=tlEase(tlP(f,74,91));tlOpacity('tl-submit',submit);const press=tlP(f,373,380)*(1-tlP(f,380,388));tlEl('tl-submit').style.transform='translateY('+(14*(1-submit))+'px) scale('+(1-.045*press)+')';
 let cursorX=690,cursorY=276,cursorAlpha=0;
 if(f>=202&&f<303){cursorAlpha=tlP(f,202,212)*(1-tlP(f,286,303));cursorX=690;cursorY=276;}
 if(f>=329&&f<395){const p=tlSmooth(tlP(f,333,369));cursorAlpha=tlP(f,329,340);cursorX=tlMix(470,242,p);cursorY=tlMix(322,448,p);}
 tlOpacity('tl-cursor',cursorAlpha);tlMove('tl-cursor',cursorX,cursorY,1-.14*press);tlOpacity('tl-click-ring',f>=374&&f<389?Math.sin(tlP(f,374,389)*Math.PI):0);tlEl('tl-click-ring').setAttribute('r',String(8+17*tlP(f,374,389)));
 const wipe=tlEase(tlP(f,390,412)),buttonX=425+80*1.17,buttonY=210+414*1.17;
 tlOpacity('tl-submit-wipe',f>=389&&f<428?1:0);tlEl('tl-submit-wipe').style.left=tlMix(buttonX,0,wipe)+'px';tlEl('tl-submit-wipe').style.top=tlMix(buttonY,0,wipe)+'px';tlEl('tl-submit-wipe').style.width=tlMix(218*1.17,1920,wipe)+'px';tlEl('tl-submit-wipe').style.height=tlMix(66*1.17,1080,wipe)+'px';tlEl('tl-submit-wipe').style.borderRadius=tlMix(8,0,wipe)+'px';
 const thanks=tlEase(tlP(f,412,430))*(1-tlP(f,605,620));tlOpacity('tl-thanks',thanks);tlMove('tl-thanks',0,54*(1-tlEase(tlP(f,412,430))));
 const check=tlEase(tlP(f,424,445));tlMove('tl-check-disc',0,0,.76+.24*check);tlEl('tl-check-path').style.strokeDashoffset=String(80*(1-tlP(f,431,451)));
 tlOpacity('tl-thanks-title',tlEase(tlP(f,430,445)));tlOpacity('tl-thanks-byline',tlEase(tlP(f,438,452)));tlOpacity('tl-thanks-create',tlEase(tlP(f,445,459)));
 const reframe=tlEase(tlP(f,516,540)),fold=tlEase(tlP(f,589,615));
 tlMove('tl-thanks-window',tlMix(0,960,reframe)+720*fold,tlMix(0,265,reframe)+115*fold,tlMix(1,.46,reframe)-.05*fold,1.5*reframe+9*fold);tlEl('tl-thanks-window').style.borderRadius=(23*reframe)+'px';tlEl('tl-thanks-window').style.boxShadow=(18*reframe)+'px '+(22*reframe)+'px 0 #171717';
 tlOpacity('tl-payoff',tlEase(tlP(f,518,533)));tlMove('tl-payoff',-25*(1-tlEase(tlP(f,518,533))),0);
 const end=tlEase(tlP(f,600,621));tlOpacity('tl-end',end);tlMove('tl-end',0,1080*(1-end));tlMove('tl-end-star',0,0,.90+.10*tlEase(tlP(f,611,638)),-18*(1-tlEase(tlP(f,611,638))));
 tlOpacity('tl-end-logo',tlEase(tlP(f,617,636)));tlMove('tl-end-logo',0,20*(1-tlEase(tlP(f,617,636))));tlOpacity('tl-end-cta',tlEase(tlP(f,625,643)));tlMove('tl-end-cta',0,23*(1-tlEase(tlP(f,625,643))));tlOpacity('tl-end-url',tlEase(tlP(f,635,650)));
}
`,
};
