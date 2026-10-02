import type { MotionStudy } from './types';

const cards = [
  ['Informational agent', 'Answer questions, no booking needed', '<path d="M5 17v-6a7 7 0 0 1 14 0v6M5 12H3v7h4v-7zm14 0h2v7h-4v-7z"/>'],
  ['Receptionist agent', 'Full appointment booking system', '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 2v6M16 2v6M4 11h16"/>'],
  ['Reservation agent', 'Bookings for spaces and equipment', '<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>'],
];

export const receptionStudy: MotionStudy = {
  id: 'reception', title: 'Reception — material, glass and continuous object transitions',
  width: 1920, height: 1080, fps: 30, durationFrames: 590,
  reference: { path: '.local/addx-reference/embedded/elevenlabs-embedded.mp4', startSeconds: 396 / 30, durationSeconds: 590 / 30 },
  reviewFrames: [0, 8, 18, 32, 33, 38, 54, 90, 105, 114, 120, 123, 127, 136, 144, 159, 210, 234, 274, 286, 296, 336, 368, 387, 404, 414, 427, 443, 464, 474, 478, 479, 482, 485, 497, 519, 569, 589],
  notes: [
    'Manually authored replication of native frames396–985 of the directly embedded Reception.ai / ElevenLabs portfolio film; the complete986-frame original was inspected.',
    'Every generated pixel is authored HTML/CSS/SVG. Original pixels appear only in the separate labelled reference comparison.',
    'Gradient flows, luminous materials and halftone are analytic approximations; original shaders, meshes, typeface and easing curves are unknown.',
    'The opening telephone/object-collage sequence is fully documented but outside this excerpt. Silent design study, not a finished automatic product video.',
  ],
  html: `<div id="r-warm"><div class="warm-material"></div><div class="warm-dots"></div><div id="r-until"></div></div>
<div id="r-orbit"><div class="orbit-ring r1"></div><div class="orbit-ring r2"></div><div class="orbit-ring r3"></div><div class="small-sun"></div></div>
<div id="r-field"><div class="field-material"></div></div>
<div id="r-chat"><div class="chat c1"><i class="avatar"></i><label>Reception</label><div class="bubble"><span></span></div></div><div class="chat c2"><div class="bubble"><span></span></div></div><div class="chat c3"><i class="avatar"></i><label>Reception</label><div class="bubble"><span></span></div></div></div>
<div id="r-stop">${'Stop missing calls and opportunities'.split(' ').map(word => `<span>${word}</span>`).join(' ')}</div>
<svg id="r-outline" width="1920" height="1080" viewBox="0 0 1920 1080"><rect x="135" y="105" width="1650" height="870" rx="80" pathLength="1" fill="none" stroke="#d2d5c1" stroke-width="2"/></svg>
<div id="r-cards">${cards.map((card, i) => `<article class="reception-card rc${i}"><div class="card-field"></div><div class="card-copy"><div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${card[2]}</svg></div><strong>${card[0]}</strong><p>${card[1]}</p></div></article>`).join('')}</div>
<div id="r-stripe"></div><div id="r-brand">Reception<span>.ai</span><small><b>ⅡEleven</b> Agents</small></div>
<svg class="material-grain" width="1920" height="1080"><filter id="materialNoise"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" seed="8" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#materialNoise)" opacity=".2"/></svg>`,
  css: `
#stage{background:#000;color:#fff;font-weight:400;letter-spacing:-.045em}#r-warm,#r-orbit,#r-field,#r-chat,#r-stop,#r-outline,#r-cards,#r-stripe,#r-brand{position:absolute;visibility:hidden}
#r-warm{left:960px;top:540px;width:1500px;height:1500px;border-radius:50%;overflow:hidden;transform:translate(-50%,-50%);box-shadow:0 0 110px #df57464a}
.warm-material{position:absolute;inset:-20%;background:radial-gradient(ellipse at 65% 72%,#ffc05e 0%,#ef702d 27%,transparent 52%),radial-gradient(ellipse at 25% 25%,#6e223e 0%,transparent 47%),radial-gradient(ellipse at 40% 61%,#e51b21 0%,#b52d36 60%);filter:blur(22px)}
.warm-dots{position:absolute;inset:0;background:radial-gradient(ellipse,#fbf2d080 1.8px,transparent 2.9px);background-size:11px 10px;mask-image:radial-gradient(ellipse at 20% 25%,#000,transparent 42%),radial-gradient(ellipse at 76% 88%,#000,transparent 42%);transform:rotate(-5deg)}
#r-until{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:86px;white-space:nowrap;letter-spacing:-.065em}
#r-orbit{inset:0;z-index:3}.orbit-ring{position:absolute;left:960px;top:540px;border:1.8px solid #95919d99;border-radius:50%;background:none;mask-image:conic-gradient(from 30deg,#0003,#000,#0003,#0008,#0003);transform:translate(-50%,-50%)}.r1{width:780px;height:780px}.r2{width:1550px;height:1550px}.r3{width:2340px;height:2340px}
.small-sun,.avatar{background:radial-gradient(ellipse at 26% 27%,#ffffef 0%,#ffffdc 22%,#fff09a 40%,transparent 69%),conic-gradient(from 40deg,#f699a9,#e54d28,#ffaf67,#f4b8b3,#f699a9);border-radius:50%;box-shadow:0 0 27px #effdc987,12px 12px 38px #84ccd870,-10px -6px 40px #eac19155}
.small-sun{position:absolute;width:480px;height:480px;left:720px;top:300px;border:2px solid #f8f9d050}
#r-field{left:960px;top:540px;width:200px;height:200px;border-radius:50%;overflow:hidden;transform:translate(-50%,-50%)}.field-material{position:absolute;inset:-5%;background:radial-gradient(ellipse at 49% 43%,#142909 0%,#24451c 8%,transparent 31%),radial-gradient(ellipse at 91% 21%,#b7d9ec 0%,#77b6c6 19%,transparent 40%),radial-gradient(ellipse at 16% 20%,#e4b396 0%,#c29b57 11%,transparent 30%),radial-gradient(ellipse at 22% 78%,#c3dce9 0%,#87b8ce 10%,transparent 33%),radial-gradient(ellipse at 28% 46%,#e0c62a 0%,transparent 24%),linear-gradient(140deg,#75a8a7,#70a450 60%,#386d4e);filter:blur(45px)}
#r-chat{inset:0}.chat{position:absolute}.c1{left:580px;top:335px;width:548px}.c2{left:788px;top:540px;width:565px}.c3{left:550px;top:720px;width:677px}.chat label{position:absolute;top:-32px;left:0;font-size:22px;color:#e4efd780;letter-spacing:-.01em}.bubble{min-height:132px;padding:42px 44px;border:1.6px solid #e5f3d366;border-radius:28px;background:#dbeec026;box-shadow:inset 0 1px 1px #fff2;backdrop-filter:blur(8px);font-size:30px;line-height:1.6;letter-spacing:-.025em}.c2 .bubble{height:168px}.avatar{position:absolute;left:-68px;top:0;width:46px;height:46px;box-shadow:0 0 18px #fff5}
#r-stop{left:0;right:0;top:50%;text-align:center;transform:translateY(-50%);font-size:52px;letter-spacing:-.04em}#r-stop span{display:inline-block;white-space:pre}
#r-outline{inset:0;transform-origin:center}#r-outline rect{stroke-dasharray:1;stroke-dashoffset:1}
#r-cards{inset:0}.reception-card{position:absolute;top:393px;left:703px;width:514px;height:296px;border-radius:32px;overflow:hidden;border:2px solid #e5e9d887;transform-origin:center}.card-field{position:absolute;inset:-40%;background:radial-gradient(ellipse at 28% 27%,#dde890,transparent 41%),radial-gradient(ellipse at 83% 80%,#102e1a,transparent 55%),linear-gradient(135deg,#32615b,#659654 65%,#183e24);filter:blur(22px)}.rc0{border:none}.rc0 .card-field{background:radial-gradient(ellipse at 90% 90%,#709944,transparent 68%),linear-gradient(120deg,#07150f,#55977c)}.rc2{border:none}.rc2 .card-field{background:radial-gradient(ellipse at 10% 90%,#ffffce,transparent 35%),radial-gradient(ellipse at 27% 72%,#c7ca37,transparent 55%),linear-gradient(145deg,#244713,#527044)}
.card-copy{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:23px;letter-spacing:-.01em}.card-icon{background:#14362055;width:59px;height:59px;border-radius:16px;display:grid;place-items:center;margin-bottom:13px}.card-icon svg{width:36px;height:36px}.card-copy strong{font-weight:450}.card-copy p{font-size:20px;color:#e1e7d4a8;margin:10px 0 0;letter-spacing:-.012em}
#r-stripe{left:0;top:395px;width:1920px;height:290px;background:linear-gradient(95deg,#aed4dd,#dbe6dd 35%,#cbd240 65%,#829753);border-radius:22px}
#r-brand{left:0;right:0;top:490px;text-align:center;font-size:87px;letter-spacing:-.055em;text-shadow:0 0 36px #fff5}#r-brand span{color:#858584}#r-brand small{position:absolute;left:1002px;top:90px;display:block;font-size:29px;letter-spacing:-.04em;color:#969696;text-shadow:none}#r-brand small b{font-weight:720}.material-grain{position:absolute;inset:0;pointer-events:none;opacity:.16;mix-blend-mode:soft-light}
`,
  script: `
function draw(frame){
 const f=frame+396,el=id=>document.getElementById(id),p=(a,b)=>Math.max(0,Math.min(1,(f-a)/(b-a))),out=x=>1-Math.pow(1-x,3),mix=(a,b,t)=>a+(b-a)*t;
 const show=(id,on)=>{el(id).style.visibility=on?'visible':'hidden';};
 ['r-warm','r-orbit','r-field','r-chat','r-stop','r-outline','r-cards','r-stripe','r-brand'].forEach(id=>show(id,false));
 if(f<429){show('r-warm',true);const d=f<404?mix(2475,1920,p(396,404)):f<421?mix(1920,1390,out(p(404,421))):mix(1390,820,p(421,429)),s=d/1500;el('r-warm').style.transform='translate(-50%,-50%) scale('+s+')';el('r-until').textContent='Until now.'.slice(0,Math.min(10,2+Math.floor((f-396)/1.65)));el('r-until').style.transform='translate(-50%,-50%) scale('+(1/s)+')';document.querySelector('.warm-material').style.transform='rotate('+((f-396)*.65)+'deg)';}
 if(f>=429&&f<532){show('r-orbit',true);const zoom=mix(2.2,1,out(p(429,440)));el('r-orbit').style.transform='scale('+zoom+')';el('r-orbit').style.opacity='1';
  const route=[[502,960,540,480],[510,915,650,201],[516,552,662,104],[523,527,453,62],[532,535,358,46]];
  let position=route[0].slice(1);if(f>=502){let index=route.findIndex((point,i)=>i<route.length-1&&f>=point[0]&&f<route[i+1][0]);index=Math.max(0,index);const a=route[Math.max(0,index-1)],b=route[index],c=route[index+1],d=route[Math.min(route.length-1,index+2)],t=(f-b[0])/(c[0]-b[0]);position=[1,2,3].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t));}
  document.querySelector('.small-sun').style.transform='translate('+(position[0]-960)+'px,'+(position[1]-540)+'px) scale('+(Math.max(46,position[2])/480)+') rotate('+((f-429)*1.12)+'deg)';[...document.querySelectorAll('.orbit-ring')].forEach(r=>r.style.opacity=String(1-p(503,524)));}
 if(f>=502&&f<693){show('r-field',true);show('r-chat',true);const d=mix(490,2600,Math.pow(p(502,527),1.25));el('r-field').style.width=d+'px';el('r-field').style.height=d+'px';el('r-field').style.opacity=String(1-p(680,693));document.querySelector('.field-material').style.transform='rotate('+((f-502)*.06)+'deg) translate('+((f-540)*.03)+'px,'+((f-540)*.14)+'px)';el('r-chat').style.opacity=String(1-p(680,693));
  const messages=[['.c1',506,523,'Hi there. How can I help you today?'],['.c2',524,610,'Hey, I’m looking to book an appointment for next week, please?'],['.c3',616,673,'Sure! When would be a good time for you?']];
  messages.forEach((m,i)=>{const c=document.querySelector(m[0]),start=m[1],end=m[2],q=out(p(start,start+18));c.style.opacity=String(p(start,start+5));c.style.transform='translateY('+((1-q)*100-(i===0?95*p(560,635):i===1?92*p(580,650):32*p(640,670)))+'px) scale('+mix(.65,1,q)+')';c.querySelector('span').textContent=m[3].slice(0,Math.floor(m[3].length*p(start+8,end)));});
  document.querySelector('.c1 .avatar').style.opacity=f>=532?'1':'0';
 }
 if(f>=686&&f<813){show('r-stop',true);el('r-stop').style.opacity=String(p(686,692));const starts=[686,700,708,724,732],ends=[801,795,803,799,791];[...el('r-stop').children].forEach((s,i)=>{s.style.opacity=String(p(starts[i],starts[i]+5)*(1-p(ends[i]-7,ends[i])));s.style.filter='blur('+((1-p(starts[i],starts[i]+5))*9+p(ends[i]-7,ends[i])*9)+'px)';});}
 if(f>=765&&f<819){show('r-outline',true);el('r-outline').style.transform='scale('+mix(1,.33,out(p(790,819)))+')';el('r-outline').style.opacity=String(1-p(810,819));el('r-outline').querySelector('rect').style.strokeDashoffset=String(1-p(765,802));}
 if(f>=797&&f<880){show('r-cards',true);[...el('r-cards').children].forEach((card,i)=>{const q=out(p(i===1?797:813,i===1?822:840)),join=out(p(869,878)),flatten=out(p(874,882)),w=mix(514,642,join),h=mix(296,2,flatten),x=i===1?0:(i-1)*mix(mix(1150,602,q),640,join);card.style.width=w+'px';card.style.height=h+'px';card.style.left=(960-w/2)+'px';card.style.top=(540-h/2)+'px';card.style.borderRadius=mix(32,0,join)+'px';card.style.borderColor='rgba(229,233,216,'+(.53*(1-join))+')';card.style.transform='translateX('+x+'px) scale('+mix(i===1?2.6:.9,1,q)+')';card.style.opacity=String(i===1?p(797,816):p(813,825));card.querySelector('.card-copy').style.opacity=String(p(i===1?813:823,840)*(1-p(873,879)));});el('r-cards').style.opacity='1';}
 if(f>=878&&f<891){show('r-stripe',true);const q=out(p(874,882)),h=mix(296,2,q);el('r-stripe').style.height=h+'px';el('r-stripe').style.top=(540-h/2+120*p(882,891))+'px';el('r-stripe').style.opacity=String(p(878,880)*(1-p(886,891)));el('r-stripe').style.borderRadius='0px';}
 if(f>=883){show('r-brand',true);const q=out(p(883,902));el('r-brand').style.transform='translateY('+mix(75,0,q)+'px) scale('+mix(.93,1,q)+')';el('r-brand').style.opacity=String(p(883,895)*(1-p(965,985)));el('r-brand').style.filter='blur('+mix(8,0,q)+'px)';el('r-brand').querySelector('small').style.opacity=String(p(902,915));}
}
`,
};
