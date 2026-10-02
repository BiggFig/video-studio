import type { MotionStudy } from './types';

// A manually authored reconstruction from the full native-frame audit. No image/video
// from the reference is embedded: every panel, character, icon and pointer is DOM/SVG.
let glyphSequence = 0;
const glyph = (kind: string) => {
  const gradientId = `org-gem-${glyphSequence++}`;
  const inner: Record<string, string> = {
    chat: Array.from({ length: 6 }, (_, i) => `<path transform="rotate(${i * 60} 32 32)" d="M32 10c12-5 23 8 17 19l-17 10-10-6V21l10-6 10 6v12"/>`).join(''),
    claude: Array.from({ length: 12 }, (_, i) => `<path transform="rotate(${i * 30} 32 32)" d="M32 7l2 24-3 3-2-3z" fill="currentColor"/>`).join(''),
    gemini: `<defs><linearGradient id="${gradientId}"><stop stop-color="#a96dc6"/><stop offset="1" stop-color="#25b7e7"/></linearGradient></defs><path d="M32 2C29 21 21 29 2 32c19 3 27 11 30 30 3-19 11-27 30-30C43 29 35 21 32 2" fill="url(#${gradientId})" stroke="none"/>`,
    grok: '<path d="M46 14C24 1 3 29 20 47c15 17 42-6 29-27M8 58L58 6" stroke-width="5"/><path d="M38 16L15 46l16-8 18-24" fill="currentColor" stroke="none"/>',
    perplexity: '<path d="M17 7l30 25-30 25V7zm30 0L17 32l30 25V7zM9 22h46v27H44V35H20v14H9V22zm23-19v58"/>',
    flux: '<rect x="5" y="5" width="54" height="54" rx="10" fill="#504298" stroke="none"/><path d="M16 46L32 16l17 30H16zm9-13l16 13M30 22l2 26" stroke="white" stroke-width="3"/>',
    banana: '<path d="M44 6c3 23-8 38-31 40 8 14 33 10 39-6C60 22 50 9 44 6z" fill="#f7dc7e" stroke="#493133"/><path d="M44 8c-4 16-12 25-23 29" stroke="#ae7185"/>',
  };
  return inner[kind] ? `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round">${inner[kind]}</svg>` : `<span class="org-monogram">${kind}</span>`;
};
const wordmark = (id: string) => `<div id="${id}" class="org-wordmark">${Array.from('FilmLoop.AI').map((c, i) => `<span data-letter="${i}">${c}</span>`).join('')}</div>`;
const arrow = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 25V7m-7 7 7-7 7 7"/></svg>';
const tabs = [ ['ChatGPT','chat'], ['Claude','claude'], ['Gemini','gemini'], ['Grok','grok'], ['Perplexity','perplexity'], ['Runway','RW'], ['Pika','PK'], ['Luma','LR'] ];
const resultNames = ['ChatGPT-5.4','Claude-sonnet-4','Gemini-3'];
const resultKinds = ['chat','claude','gemini'];
const resultDescriptions = ['All-purpose problem solving','Thoughtful reasoning','Fast responses'];
const menuData = [
  { title:'Chat', label:'PREMIUM MODELS', items:[['ChatGPT-5.4','chat'],['Grok-4','grok'],['Gemini-3','gemini'],['Claude Sonnet 4','claude'],['Perplexity Pro','perplexity']] },
  { title:'Image Generation', label:'IMAGE MODELS', items:[['Nano Banana 2','banana'],['FLUX.1','flux'],['GPT Image 1','chat']] },
  { title:'Video Generation', label:'VIDEO MODELS', items:[['Pika 2.2','PK'],['Runway Gen-4.5','RW'],['Luma Ray Flash 2','LR']] },
];

export const originalStudy: MotionStudy = {
  id: 'original',
  title: 'FilmLoop original — authored frame study',
  width: 1920, height: 1080, fps: 30, durationFrames: 660,
  reference: { path: '.local/reference-replication/original/reference.mp4', startSeconds: 0, durationSeconds: 22 },
  reviewFrames: [1,18,55,79,83,87,96,110,145,176,179,185,207,235,244,253,275,309,317,332,363,384,420,475,490,510,559,563,566,578,601,640,659],
  notes: [
    'Full22-second manually authored DOM/SVG reconstruction after examining all660 native frames in27 contiguous sheets and native-resolution keyframes.',
    'Every seek derives from frame: no source screenshots, source video, remote assets, timers, or CSS animations.',
    'Reference frame0 is a one-frame flash of its later comparison; the study deliberately opens on the browser instead of reproducing that export artifact.',
    'Geist substitutes for the unidentified geometric reference font; provider logos are manually drawn approximations. Layout, copy, interaction sequence and measured transition samples are retained.',
    'Audio is excluded from this picture study. No listening or soundtrack match is claimed. Native source PTS starts0.066667s; all authored events use decoded-frame-relative time.',
  ],
  html: `
<div id="org-root">
  <section id="org-hook" class="org-scene">
    <div id="org-browser">
      <div id="org-chrome"><div class="org-dots"><i></i><i></i><i></i></div><div id="org-tabs">${tabs.map(([name, icon], i) => `<div class="org-tab" id="org-tab-${i}"><b>${glyph(icon)}</b><span>${name}</span><small>×</small></div>`).join('')}</div></div>
      <div id="org-address"><span>‹</span><span>›</span><span>↻</span><div id="org-url">chatgpt.com</div></div>
      <h1 id="org-hook-title">Still juggling 8 AI tabs?</h1>
    </div>
  </section>
  <section id="org-demo" class="org-scene">
    <h2 id="org-demo-title" class="org-heading">Ask once. Compare every answer.</h2>
    <div id="org-composer"><div id="org-prompt"></div><span id="org-caret"></span>
      <div id="org-tools"><svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 20l10-10a4 4 0 0 0-6-6L4 14a7 7 0 0 0 10 10l11-11M7 17L17 7"/></svg>${resultNames.map(n=>`<span class="org-chip">${n} ×</span>`).join('')}</div>
      <div id="org-selector">Select Models <span>⌄</span></div><div id="org-submit">${arrow}</div>
    </div>
    ${resultNames.map((n,i)=>`<article class="org-result" id="org-result-${i}"><div class="org-result-name"><b>${glyph(resultKinds[i])}</b>${n}</div><div class="org-result-desc">${resultDescriptions[i]}</div><div class="org-answer" id="org-answer-${i}"></div>${i===2?'<span id="org-winner">Winner</span>':''}</article>`).join('')}
    <svg id="org-cursor" viewBox="0 0 32 44"><path d="M3 2v33l8-8 7 14 6-3-7-13 12-1z" fill="#111" stroke="white" stroke-width="2.2" stroke-linejoin="round"/></svg>
  </section>
  <section id="org-features" class="org-scene"><h2 id="org-features-title" class="org-heading">Chat, images and video. One workspace.</h2>
    ${menuData.map((col,i)=>`<div class="org-menu" id="org-menu-${i}"><div class="org-menu-control">${col.title}<span class="org-chevron"></span></div><div class="org-menu-list" id="org-list-${i}"><div class="org-menu-label">${col.label}</div>${col.items.map(([name,icon],j)=>`<div class="org-menu-row" id="org-menu-row-${i}-${j}"><b>${glyph(icon)}</b><span>${name}</span></div>`).join('')}</div></div>`).join('')}
  </section>
  <section id="org-offer" class="org-scene"><h2 id="org-offer-title" class="org-heading">One credit balance. Every tool.</h2>
    ${['Starter','Pro','Power'].map((name,i)=>`<article id="org-price-${i}" class="org-price ${i===1?'org-pro':''}"><div class="org-price-content"><h3>${name}</h3>${i===1?'<span class="org-popular">Most popular</span>':''}<p>${['Perfect for getting started','For power users and creators','For teams and heavy usage'][i]}</p><div class="org-price-line"><strong>$${['9.99','19.99','49.99'][i]}</strong><span>/month</span></div><div id="org-credits-${i}" class="org-credits"></div><div class="org-subscribe">Subscribe</div></div></article>`).join('')}
    <div id="org-reassurance"><div id="org-rollover"><span>⟳</span> Credits roll over for up to 3 months</div><div id="org-buy"><svg viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="2" y="2" width="28" height="20" rx="3"/><path d="M2 8h28"/></svg> Buy more anytime</div></div>
  </section>
  <section id="org-brand" class="org-scene">${wordmark('org-brand-wordmark')}<div id="org-brand-tagline" class="org-tagline">Make AIs compete. You win.</div><div id="org-badges">${['chat','claude','gemini','grok','perplexity'].map((g,i)=>`<div id="org-badge-${i}">${glyph(g)}</div>`).join('')}</div></section>
  <div id="org-iris"></div>
  <div id="org-expansion"></div>
  <section id="org-cta" class="org-scene">${wordmark('org-cta-wordmark')}<div id="org-cta-tagline" class="org-tagline">Make AIs compete. You win.</div><div id="org-cta-pill">Plans from $9.99/mo</div></section>
</div>`,
  css: `
#org-root{position:absolute;inset:0;background:#f9f8fa;color:#0c0c0c;font-family:Studio,Arial,sans-serif;letter-spacing:-.6px}
#org-root *{box-sizing:border-box}#org-root svg{display:block;width:100%;height:100%}.org-scene{position:absolute;inset:0;overflow:hidden}.org-heading{position:absolute;top:157px;left:70px;right:70px;margin:0;text-align:center;font-size:76px;font-weight:850;letter-spacing:-3.2px;line-height:1.2}
#org-browser{position:absolute;left:120px;top:96px;width:1680px;height:888px;border-radius:23px;background:#fff;box-shadow:0 30px 70px #00000017,0 4px 9px #00000009;overflow:hidden;transform-origin:center}
#org-chrome{height:96px;background:#1b1a1c;position:relative;color:#ddd}.org-dots{position:absolute;left:35px;top:37px;display:flex;gap:13px}.org-dots i{width:16px;height:16px;background:#4c4b4d;border-radius:50%}#org-tabs{position:absolute;left:150px;right:20px;bottom:0;display:flex;align-items:end;height:68px;gap:7px}.org-tab{height:67px;display:flex;align-items:center;gap:13px;border-radius:14px 14px 0 0;padding:10px 16px;color:#c4c4c6;overflow:hidden;font-size:27px;background:#1b1a1c;flex:none;white-space:nowrap}.org-tab b{flex:none;background:#f4f4f4;color:#202124;border-radius:8px;width:40px;height:40px;padding:6px}.org-tab>span{overflow:hidden;text-overflow:ellipsis}.org-tab small{font-size:30px;color:#707072;margin-left:auto}.org-monogram{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:22px;font-weight:850;letter-spacing:0}
#org-address{height:84px;background:#2a292b;display:flex;align-items:center;gap:23px;padding:0 26px;color:#c4c4c6;font-size:32px}#org-address>span{font-weight:700}#org-url{background:#202022;border-radius:33px;height:56px;flex:1;padding:10px 23px;font-size:27px;font-weight:400;letter-spacing:-.4px}
#org-hook-title{position:absolute;left:0;right:0;top:425px;margin:0;text-align:center;font-size:108px;font-weight:850;letter-spacing:-4.9px;line-height:1.2}
#org-brand{background:#0c0c0c;color:white;z-index:5}.org-wordmark{position:absolute;left:0;right:0;top:302px;text-align:center;white-space:nowrap;font-size:200px;font-weight:850;letter-spacing:-8px;line-height:1.15}.org-wordmark span{display:inline-block;white-space:pre;transform-origin:50% 80%}.org-tagline{position:absolute;top:547px;left:0;right:0;text-align:center;font-size:58px;font-weight:450;line-height:1.2;letter-spacing:-1.5px;color:#bebec6}#org-badges{position:absolute;top:740px;left:664px;display:flex;gap:28px}#org-badges>div{width:96px;height:96px;border-radius:50%;background:white;display:flex;padding:25px;color:#0c0c0c}
#org-iris{position:absolute;left:960px;top:540px;width:2px;height:2px;border-radius:50%;background:#0c0c0c;z-index:6;transform:translate(-50%,-50%)}
#org-composer{position:absolute;left:210px;top:300px;width:1500px;height:176px;background:#fff;border:1px solid #dedee0;border-radius:35px;padding:27px 35px;box-shadow:0 3px 7px #00000004}#org-prompt{font-size:36px;line-height:46px;color:#777f8c;font-weight:400;letter-spacing:-.6px;white-space:pre}#org-caret{position:absolute;top:31px;width:2px;height:36px;background:#929aa5}#org-tools{position:absolute;left:34px;bottom:24px;display:flex;align-items:center;gap:9px;color:#6a7480}#org-tools>svg{width:35px;height:35px;margin-right:6px}.org-chip{background:#f2f3f4;padding:7px 12px;font-size:24px;border-radius:9px;white-space:nowrap;letter-spacing:-.6px}#org-selector{position:absolute;right:109px;bottom:25px;height:44px;border-radius:9px;background:#f1f2f3;padding:10px 17px;font-size:23px;color:#67717d;line-height:24px}#org-selector span{padding-left:22px}#org-submit{position:absolute;right:29px;bottom:24px;width:51px;height:51px;border-radius:50%;border:1px solid #e5e5e5;background:white;color:#111;padding:12px}
.org-result{position:absolute;top:533px;left:210px;width:480px;height:350px;border-radius:35px;border:1.4px solid #9da0a4;background:white;padding:32px 35px;color:#0c0c0c;transform-origin:center}.org-result-name{display:flex;gap:17px;align-items:center;font-size:31px;font-weight:550;white-space:nowrap;letter-spacing:-.8px}.org-result-name b{height:34px;width:34px;flex:none}.org-result-desc{font-size:20px;line-height:27px;color:#929296;margin-top:18px;font-weight:400;letter-spacing:-.2px}.org-answer{font-size:43px;line-height:1.23;font-weight:670;letter-spacing:-1.2px;margin-top:28px}.org-answer.org-loading{color:#d1d1d3;font-size:38px;letter-spacing:8px}#org-result-1{left:720px}#org-result-2{left:1230px}#org-winner{position:absolute;right:24px;top:25px;border-radius:30px;padding:7px 15px;background:white;color:#111;font-size:20px;line-height:25px;font-weight:650;letter-spacing:-.5px}#org-cursor{position:absolute;width:34px;height:44px;z-index:3;filter:drop-shadow(0 1px 2px #0003)}
.org-menu{position:absolute;top:300px;width:480px;left:210px}.org-menu-control{height:88px;border:1.5px solid #111;border-radius:21px;background:#fff;padding:24px 30px;font-size:32px;font-weight:530;position:relative}.org-chevron{position:absolute;right:39px;top:39px;width:12px;height:12px;border-top:3px solid #171717;border-left:3px solid #171717;transform:rotate(45deg)}.org-menu-list{background:#fff;border:1px solid #e1e1e3;border-radius:29px;padding:32px 30px 19px;margin-top:21px;box-shadow:0 18px 38px #0000000c;transform-origin:top}.org-menu-label{color:#74777c;font-size:18px;font-weight:650;letter-spacing:2.7px;margin-bottom:22px}.org-menu-row{height:78px;display:flex;gap:22px;align-items:center;font-size:32px;font-weight:520;color:#252c39;white-space:nowrap;letter-spacing:-.7px}.org-menu-row b{width:54px;height:54px;border-radius:50%;background:#f2f3f5;border:1px solid #e3e4e7;padding:11px;flex:none}.org-menu-row .org-monogram{font-size:17px}#org-menu-1{left:720px}#org-menu-2{left:1230px}
.org-price{position:absolute;left:264px;top:310px;width:440px;height:452px;padding:40px 38px;border:1px solid #e3e2e5;border-radius:41px;background:#fff;box-shadow:0 11px 24px #00000006;color:#222b38;transform-origin:center}.org-price h3{font-size:43px;font-weight:800;line-height:1.1;margin:10px 0 22px;letter-spacing:-1.4px}.org-price p{font-size:24px;color:#777e88;margin:0;white-space:nowrap;letter-spacing:-.6px}.org-price-line{display:flex;align-items:baseline;margin-top:35px;gap:7px}.org-price strong{font-size:82px;line-height:1.15;font-weight:850;letter-spacing:-3px}.org-price-line>span{font-size:29px;color:#747a85;letter-spacing:-.8px}.org-credits{font-size:27px;font-weight:680;margin-top:18px;letter-spacing:-.5px;white-space:nowrap}.org-subscribe{position:absolute;left:38px;right:38px;bottom:39px;border-radius:70px;background:black;color:white;text-align:center;font-size:29px;font-weight:650;padding:17px 0;line-height:35px;letter-spacing:-.4px}#org-price-1{left:740px;top:296px;background:#000;color:white;border-color:#000}.org-pro .org-price-line>span,.org-pro p{color:#c1c2c8}.org-pro .org-subscribe{color:#000;background:#fff}.org-popular{position:absolute;right:34px;top:41px;padding:9px 18px;background:white;color:black;border-radius:30px;font-size:21px;line-height:24px;font-weight:650;letter-spacing:-.6px}#org-price-2{left:1216px}#org-reassurance{position:absolute;top:822px;left:430px;display:flex;gap:85px;color:#252c39;font-size:28px;letter-spacing:-.5px}#org-reassurance>div{background:white;border:1px solid #e0dfe3;border-radius:60px;padding:17px 29px;white-space:nowrap;display:flex;align-items:center;gap:15px;height:69px}#org-reassurance span{font-size:35px;line-height:30px;color:#111}#org-buy>svg{width:28px;height:24px;color:#111}
#org-expansion{position:absolute;background:black;z-index:7;border-radius:40px}#org-cta{background:#000;color:white;z-index:8}#org-cta .org-wordmark{top:280px}#org-cta .org-tagline{top:550px}#org-cta-pill{position:absolute;left:724px;top:680px;width:472px;height:91px;border-radius:80px;background:#fff;color:#0c0c0c;text-align:center;font-size:38px;font-weight:650;letter-spacing:-1.1px;line-height:91px;transform-origin:center}
/* Match measured ink boxes while retaining the locally available study font. */
.org-wordmark{top:263px;scale:.95 1.16;transform-origin:50% 0}.org-tagline{top:532px;scale:1.13 1.2;transform-origin:50% 0}.org-heading{top:153px;scale:1.075 1.2;transform-origin:50% 0}#org-demo-title{top:158px}#org-hook-title{top:407px;scale:1.026 1.23;transform-origin:50% 0}#org-root #org-cursor{width:34px;height:44px}
`,
  script: `
const org = id => document.getElementById(id);
const orgClamp = v => Math.max(0, Math.min(1, v));
const orgProgress = (f,a,b) => orgClamp((f-a)/(b-a));
const orgOut = t => 1-Math.pow(1-orgClamp(t),3);
const orgSmooth = t => {t=orgClamp(t);return t*t*(3-2*t)};
const orgLerp = (a,b,t) => a+(b-a)*t;
const orgOpacity = (id,v) => {org(id).style.opacity=String(v)};
const orgShow = (id,on) => {org(id).style.display=on?'block':'none'};
const orgSample = (frame,start,values) => {const t=Math.max(0,Math.min(values.length-1,frame-start)),i=Math.floor(t);return orgLerp(values[i],values[Math.min(i+1,values.length-1)],t-i)};
const orgMove = (id,x,y,scale=1) => {org(id).style.transform='translate('+x+'px,'+y+'px) scale('+scale+')'};
const orgMeasure=document.createElement('canvas').getContext('2d');
function orgLetters(id,frame,start){const letters=org(id).children;for(let i=0;i<letters.length;i++){const p=orgProgress(frame,start+i*1.23,start+i*1.23+4.4),e=orgOut(p);letters[i].style.opacity=String(p);letters[i].style.transform='translateY('+((1-e)*24)+'px) scale('+(0.88+e*0.12)+')'}}
function draw(frame){
  const f=Math.max(0,Math.min(659,frame));
  orgShow('org-hook',f<88);orgShow('org-demo',f>=172&&f<366);orgShow('org-features',f>=361&&f<470);orgShow('org-offer',f>=466&&f<570);orgShow('org-brand',f>=88&&f<186);orgShow('org-iris',f>=80&&f<88);orgShow('org-expansion',f>=560&&f<570);orgShow('org-cta',f>=570);
  const tabStarts=[3,11,18,24,31,37,44,51],tabUrls=['chatgpt.com','claude.ai','gemini.google.com','grok.com','perplexity.ai','runwayml.com','pika.art','lumalabs.ai'];
  const count=tabStarts.filter(x=>f>=x).length||1;
  const countText=Math.min(8,1+[12,19,25,32,38,45,52].filter(x=>f>=x).length);
  const tabWidth=Math.min(310,(1495-(count-1)*7)/count);
  for(let i=0;i<8;i++){const t=org('org-tab-'+i),p=orgOut(orgProgress(f,tabStarts[i],tabStarts[i]+5));t.style.display=i<count?'flex':'none';t.style.width=tabWidth+'px';t.style.opacity=String(p);t.style.transform='translateY('+((1-p)*8)+'px)';t.style.background=i===count-1?'#2a292b':'#1b1a1c';}
  org('org-url').textContent=tabUrls[count-1];org('org-hook-title').textContent='Still juggling '+countText+' AI tabs?';orgOpacity('org-hook-title',orgProgress(f,10,17)*(1-orgProgress(f,74,80)));
  org('org-browser').style.opacity=String(1-orgProgress(f,81,88)*0.65);orgMove('org-browser',0,0,1-orgProgress(f,79,88)*.025);
  const radius=orgSample(f,80,[5.5,30.5,87.5,190,351.5,585.5,827.5,1010,1200]);org('org-iris').style.width=radius*2+'px';org('org-iris').style.height=radius*2+'px';
  const lift=orgSample(f,172,[0,4,20,57,124,228,380,584,768,900,988,1041,1069,1080]);orgMove('org-brand',0,-lift);
  orgLetters('org-brand-wordmark',f,90);orgOpacity('org-brand-tagline',orgProgress(f,104,115));
  for(let i=0;i<5;i++){const p=orgProgress(f,117+i*2.4,123+i*2.4);orgOpacity('org-badge-'+i,p);orgMove('org-badge-'+i,0,(1-orgOut(p))*8,orgOut(p));}
  const demoExit=1-orgProgress(f,355,363);orgOpacity('org-demo-title',orgProgress(f,181,189)*demoExit);orgMove('org-demo-title',0,(1-orgOut(orgProgress(f,181,189)))*18);
  orgOpacity('org-composer',orgProgress(f,183,193)*(1-orgProgress(f,358,363)));orgMove('org-composer',0,(1-orgOut(orgProgress(f,183,193)))*15);
  const promptText='Write a tagline for a coffee shop on the moon';const typed=Math.floor(promptText.length*orgProgress(f,196,235));org('org-prompt').textContent=f<197?'Ask me anything...':promptText.slice(0,typed);org('org-prompt').style.color=f<197?'#9399a2':'#747d88';
  orgMeasure.font='400 36px Studio';const textWidth=orgMeasure.measureText(org('org-prompt').textContent).width;org('org-caret').style.left=(35+textWidth-.6*org('org-prompt').textContent.length)+'px';orgOpacity('org-caret',f<240?1:0);
  const submitted=orgProgress(f,240,243);org('org-submit').style.background=submitted>.1?'#0c0c0c':'white';org('org-submit').style.color=submitted>.1?'white':'#111';orgMove('org-submit',0,0,1-Math.sin(orgProgress(f,240,246)*Math.PI)*.16);
  const answers=['“Great coffee. Zero atmosphere.”','“Every table has an Earth view.”','“One small sip for man.”'];
  for(let i=0;i<3;i++){const p=orgOut(orgProgress(f,247+i*3.2,255+i*3.2)),win=orgProgress(f,308,317),a=org('org-answer-'+i);orgOpacity('org-result-'+i,p*(1-orgProgress(f,360+i,364+i)));orgMove('org-result-'+i,0,(1-p)*55,i===2?1+.032*orgOut(win):1);const n=Math.floor(answers[i].length*orgProgress(f,259+i*6,278+i*5));a.textContent=f<259+i*6?'•••':answers[i].slice(0,n);a.className='org-answer'+(f<259+i*6?' org-loading':'');org('org-result-'+i).style.color=i===2?'rgb('+Math.round(12+243*win)+','+Math.round(12+243*win)+','+Math.round(12+243*win)+')':'rgba(12,12,12,'+(1-.37*win)+')';if(i===2){const c=Math.round(255-243*orgOut(win));org('org-result-2').style.background='rgb('+c+','+c+','+c+')';org('org-result-2').style.borderColor='rgba(157,160,164,'+(1-win)+')';}}
  orgOpacity('org-winner',orgOut(orgProgress(f,311,317)));orgMove('org-winner',0,0,orgOut(orgProgress(f,311,317)));
  let cursorX=1580,cursorY=1040;if(f<238){const p=orgSmooth(orgProgress(f,226,238));cursorX=orgLerp(1580,1650,p);cursorY=orgLerp(1040,436,p)}else if(f<294){cursorX=1650;cursorY=436}else{const p=orgSmooth(orgProgress(f,294,306));cursorX=orgLerp(1650,1505,p);cursorY=orgLerp(436,798,p)}orgMove('org-cursor',cursorX,cursorY,1-Math.sin(orgProgress(f,307,312)*Math.PI)*.18);orgOpacity('org-cursor',orgProgress(f,212,215)*(1-orgProgress(f,337,345)));
  orgOpacity('org-features-title',orgProgress(f,361,369)*(1-orgProgress(f,460,467)));orgMove('org-features-title',0,(1-orgOut(orgProgress(f,361,369)))*14);
  const rowCounts=[5,3,3];for(let i=0;i<3;i++){const p=orgOut(orgProgress(f,365+i*3,373+i*3));orgOpacity('org-menu-'+i,p*(1-orgProgress(f,461+i*1.5,466+i*1.5)));orgMove('org-menu-'+i,0,(1-p)*19);const opening=orgOut(orgProgress(f,377+i*3,385+i*3));orgOpacity('org-list-'+i,opening);orgMove('org-list-'+i,0,(1-opening)*-13,1);org('org-list-'+i).style.clipPath='inset(0 0 '+((1-opening)*100)+'% 0)';org('org-menu-'+i).querySelector('.org-chevron').style.transform='rotate('+(45+180*(1-opening))+'deg)';for(let j=0;j<rowCounts[i];j++){const p=orgOut(orgProgress(f,379+i*3+j*2.2,385+i*3+j*2.2));orgOpacity('org-menu-row-'+i+'-'+j,p);orgMove('org-menu-row-'+i+'-'+j,0,(1-p)*12);}}
  orgOpacity('org-offer-title',orgProgress(f,466,473)*(1-orgProgress(f,559,565)));orgMove('org-offer-title',0,(1-orgOut(orgProgress(f,466,473)))*16);
  const creditTotals=[10000,20000,50000];for(let i=0;i<3;i++){const p=orgOut(orgProgress(f,471+i*2.5,479+i*2.5));orgOpacity('org-price-'+i,p*(i===1?1-orgProgress(f,559,561):1-orgProgress(f,562,565)));orgMove('org-price-'+i,0,(1-p)*65,i===1?1.03:1);org('org-price-'+i).querySelector('.org-price-content').style.opacity=String(i===1?1-orgProgress(f,553,559):1);const credits=Math.round(creditTotals[i]*orgOut(orgProgress(f,480,506))/100)*100;org('org-credits-'+i).textContent=credits.toLocaleString('en-US')+' credits / month';}
  orgOpacity('org-reassurance',1-orgProgress(f,561,565));orgOpacity('org-rollover',orgProgress(f,498,505));orgMove('org-rollover',0,(1-orgOut(orgProgress(f,498,505)))*10);orgOpacity('org-buy',orgProgress(f,502,509));orgMove('org-buy',0,(1-orgOut(orgProgress(f,502,509)))*10);
  const boxFrames=[ [733,289,454,466],[705,278,510,489],[655,258,610,532],[563,221,794,610],[419,164,1082,732],[244,94,1432,880],[122,45,1676,984],[48,16,1824,1046],[10,0,1900,1079],[0,0,1920,1080] ];const bi=Math.max(0,Math.min(9,Math.floor(f-560))),box=boxFrames[bi];Object.assign(org('org-expansion').style,{left:box[0]+'px',top:box[1]+'px',width:box[2]+'px',height:box[3]+'px',borderRadius:(40*(1-orgProgress(f,560,569)))+'px'});
  orgLetters('org-cta-wordmark',f,571);orgOpacity('org-cta-tagline',orgProgress(f,585,595));const pill=orgProgress(f,595,602);orgOpacity('org-cta-pill',pill);orgMove('org-cta-pill',0,0,orgOut(pill));
}
`,
};
