import type { MotionStudy } from './types';

// Private, manually authored visual study. No reference picture/audio is embedded.
const slab = (index: number) => `<g id="el-slab-${index}" class="el-slab"><path d="M-175 0L0 108L175 0V44L0 152L-175 44Z" fill="url(#el-side-${index % 2})"/><path d="M-175 0L0-108L175 0L0 108Z" fill="url(#el-top-${index % 2})" stroke="#fff" stroke-opacity=".07"/><path d="M0 108V152M-175 0L0 108L175 0" fill="none" stroke="#fff" stroke-opacity=".12"/><text x="0" y="15" fill="white" font-size="76" text-anchor="middle" transform="rotate(31) scale(1 .62)">$</text></g>`;
const wordmark = (id: string) => `<div id="${id}" class="el-wordmark"><b class="el-bars"></b><b class="el-eleven">Eleven</b><span class="el-agents">Agents</span></div>`;
const orb = (id: string, extra = '') => `<div id="${id}" class="el-orb ${extra}"><div class="el-orb-lobe"></div><div class="el-orb-grain"></div><div class="el-orb-shine"></div></div>`;
const tray = (id: string) => `<div id="${id}" class="el-tray"><svg viewBox="0 0 420 340"><defs><linearGradient id="${id}-body" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#333432"/><stop offset=".23" stop-color="#b5b6b3"/><stop offset=".54" stop-color="#eaeae7"/><stop offset=".79" stop-color="#e9e9e6"/><stop offset="1" stop-color="#999b98"/></linearGradient><linearGradient id="${id}-lid" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#efefec"/><stop offset=".28" stop-color="#a2a3a0"/><stop offset=".55" stop-color="#dbdcd8"/><stop offset=".83" stop-color="#ededea"/><stop offset="1" stop-color="#b0b2ad"/></linearGradient></defs><path d="M38 78Q19 81 23 109L35 137L124 268Q142 293 172 295L365 277Q406 273 398 250L292 87Z" fill="#d8d9d6"/><path d="M45 65L247 49Q275 46 291 70L390 225Q411 253 380 258L171 277Q144 278 127 254L29 109Q12 82 45 65Z" fill="url(#${id}-body)" stroke="#727572" stroke-width="1.2"/><path class="el-tray-lid" d="M45 65L247 49Q275 46 291 70L390 225Q411 253 380 258L171 277Q144 278 127 254L29 109Q12 82 45 65Z" fill="url(#${id}-lid)"/></svg></div>`;

export const elevenlabsStudy: MotionStudy = {
  id: 'elevenlabs', title: 'ElevenLabs — authored native-frame motion study',
  width: 1920, height: 1080, fps: 30, durationFrames: 841,
  reference: { path: '.local/addx-reference/elevenlabs.mp4', startSeconds: 0, durationSeconds: 841 / 30 },
  reviewFrames: [1, 19, 40, 56, 80, 111, 112, 124, 145, 158, 172, 210, 224, 278, 343, 367, 385, 397, 404, 430, 450, 480, 494, 510, 534, 550, 558, 600, 634, 674, 690, 717, 724, 740, 760, 780, 840],
  notes: [
    'Manually authored isolated reference replication, not automatic product-pipeline output. Native 841-frame, 30fps sequence.',
    'All 841 source frames inspected in 43 contiguous sheets. Full frame index and measurement evidence are in .local/reference-replication/elevenlabs.',
    'No source-video pixels or soundtrack in this study. ElevenAgents name, reference phrases and prices appear solely in this private visual replication.',
    'Dark stack and glass slabs use authored CSS/SVG geometry. Their perspective, soft reflections and depth approximate the observed 3D render; original shaders/camera cannot be recovered.',
    'Iridescent orb uses authored layered gradients/grain; network sphere uses deterministic projected points. It approximates the reference material, not its exact simulation.',
    'Geist substitutes for the unverified original font; tiny icons, glyph outlines, material noise, occlusion/refraction and true motion blur differ.',
    'Sound not audited. This study intentionally contains no audio.',
  ],
  html: `<div id="el-study">
    <svg width="0" height="0" aria-hidden="true"><defs>
      <filter id="el-grain"><feTurbulence type="fractalNoise" baseFrequency=".67" numOctaves="3" seed="11" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    </defs></svg>
    <div id="el-dark" class="el-scene">
      <div id="el-dark-glow"></div><div id="el-grid"></div>
      <div id="el-seed"><span id="el-seed-glyph">€</span></div>
      <div id="el-stack">${Array.from({ length: 7 }, (_, i) => `<div class="el-dark-plane" id="el-plane-${i}"></div>`).join('')}<canvas id="el-dollar" width="700" height="700"></canvas>
      <div class="el-language" id="el-lang-ja"><strong>あ</strong><span>Japanese</span></div><div class="el-language" id="el-lang-en"><strong>Aa</strong><span>English</span></div><div class="el-language" id="el-lang-zh"><strong>是</strong><span>Chinese</span></div></div>
    </div>
    <div id="el-interjection" class="el-scene"><div id="el-well"><span>Well</span><span id="el-usually">usually,</span></div></div>
    <div id="el-cost" class="el-scene"><div class="el-cost-glow" id="el-cost-glow"></div>
      <svg id="el-cost-rings" viewBox="0 0 900 900">${[250, 300, 350].map(r => `<circle cx="450" cy="450" r="${r}"/>`).join('')}</svg>
      <div id="el-price-band" class="el-band"><div id="el-wheel"><div id="el-wheel-strip">${['$0.11', '$0.10', '$0.09', '$0.08', '$0.07'].map(x => `<div>${x}</div>`).join('')}</div></div><span id="el-price-icons">ϟ ◷</span></div>
      <div id="el-unit-band" class="el-band"><span id="el-unit-icons">⬡ ▤</span><span>/MIN</span></div>
      <svg id="el-slabs" viewBox="-440 -420 880 840"><defs>
        <linearGradient id="el-top-0" x1=".25" y1="0" x2=".7" y2="1"><stop stop-color="#242527"/><stop offset=".38" stop-color="#202122"/><stop offset=".66" stop-color="#375875"/><stop offset=".83" stop-color="#e4d5bd"/><stop offset="1" stop-color="#d6a839"/></linearGradient>
        <linearGradient id="el-side-0"><stop stop-color="#486573"/><stop offset=".28" stop-color="#d0cbbb"/><stop offset=".5" stop-color="#d7b752"/><stop offset=".72" stop-color="#244252"/><stop offset="1" stop-color="#0d4d84"/></linearGradient>
        <linearGradient id="el-top-1" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#333738"/><stop offset=".32" stop-color="#e6dfc8"/><stop offset=".5" stop-color="#b5bba4"/><stop offset=".72" stop-color="#dac981"/><stop offset="1" stop-color="#748977"/></linearGradient>
        <linearGradient id="el-side-1"><stop stop-color="#babeb6"/><stop offset=".5" stop-color="#a0a99b"/><stop offset="1" stop-color="#7f8162"/></linearGradient>
      </defs>${slab(0)}${slab(1)}${slab(2)}</svg>
      <div id="el-cost-tag-0" class="el-tiny-tag">PLATFORM FEE</div><div id="el-cost-tag-1" class="el-tiny-tag">STACKED COST</div><div id="el-cost-tag-2" class="el-tiny-tag">COMMITMENT</div><div id="el-cost-tag-3" class="el-tiny-tag">BOOK A DEMO</div>
      <div id="el-cost-bloom"></div><div id="el-light-bars"><i></i><i></i></div>
    </div>
    <div id="el-brand" class="el-scene"><div id="el-brand-halo"></div>${orb('el-brand-orb')}${orb('el-brand-orb-half', 'el-half')}${wordmark('el-brand-wordmark')}</div>
    <div id="el-simple-price" class="el-scene">${orb('el-price-orb')}<div id="el-simple-value"><span id="el-number">$0.08</span><span id="el-per-min"> / min</span></div>${wordmark('el-price-wordmark')}</div>
    <div id="el-trays" class="el-scene">${tray('el-tray-upper')}${tray('el-tray-lower')}${orb('el-tray-orb')}<div id="el-tray-copy"></div></div>
    <div id="el-network" class="el-scene"><div id="el-network-content"><svg id="el-network-svg" viewBox="0 0 800 800">${[200, 250, 300].map(r => `<circle class="el-net-ring" cx="400" cy="400" r="${r}"/>`).join('')}<g id="el-net-lines"></g></svg><canvas id="el-net-ball" width="360" height="360"></canvas></div><div id="el-net-copy"><div id="el-net-line-one"></div><div id="el-net-line-two"></div><small>*LLM and telephony costs billed separately at cost.</small></div><div id="el-net-wash"></div></div>
    <div id="el-finale" class="el-scene">${orb('el-final-orb')}${wordmark('el-final-wordmark')}<div id="el-final-cta">Try for free today</div></div>
  </div>`,
  css: `
#el-study{position:absolute;inset:0;background:#131313;color:#f7f7f7;font-family:Studio,Arial,sans-serif;letter-spacing:-3px}
#el-study .el-scene{position:absolute;inset:0;overflow:hidden;display:none}
#el-dark,#el-cost{background:#131313}#el-interjection,#el-brand,#el-simple-price,#el-trays,#el-network,#el-finale{background:#f4f2f0;color:#141414}
#el-dark-glow{position:absolute;left:-400px;top:560px;width:2500px;height:900px;background:radial-gradient(ellipse at 22% 100%,#0e739a99,transparent 55%),radial-gradient(ellipse at 78% 100%,#45a276dd,transparent 62%);filter:blur(65px)}
#el-grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff09 1px,transparent 1px),linear-gradient(90deg,#ffffff09 1px,transparent 1px);background-size:192px 192px;background-position:96px 60px;mask-image:radial-gradient(ellipse,#000,transparent 66%)}
#el-seed{position:absolute;width:180px;height:180px;left:870px;top:450px;display:grid;place-items:center;background:radial-gradient(ellipse at 8% 8%,#454545,#1b1b1b 38%,#151515 72%);border:1px solid #ffffff0c;box-shadow:0 6px 14px #0002}
#el-seed:after{content:'';position:absolute;inset:-2px;background:radial-gradient(circle at 0 0,#9de89d 1.5px,transparent 3px),radial-gradient(circle at 100% 100%,#9de89d 1.5px,transparent 3px)}
#el-seed-glyph{font:400 135px Arial,sans-serif;line-height:1;letter-spacing:0}
#el-stack{position:absolute;inset:0;transform-origin:960px 540px;perspective:1600px}
.el-dark-plane{position:absolute;left:490px;top:390px;width:940px;height:650px;border-radius:88px;background:radial-gradient(ellipse at 5% 0%,#535353c0,transparent 39%),linear-gradient(160deg,#0b0b0b,#202020 56%,#151515);box-shadow:0 23px 0 #252525,0 29px 0 #101010,0 52px 32px #0005;transform-origin:50% 50%;border-top:1px solid #ffffff0b}
#el-dollar{position:absolute;width:700px;height:700px;left:610px;top:90px;filter:drop-shadow(-13px 15px 0 #0008)}
.el-language{position:absolute;height:105px;border:2px solid #c6c6c6b0;border-radius:60px;display:flex;align-items:center;padding:0 30px;gap:25px;font-size:34px;letter-spacing:-1px;background:#17171755;backdrop-filter:blur(7px);white-space:nowrap}
.el-language strong{font-weight:400;border-right:2px solid #b5b5b5;padding-right:23px}.el-language span{display:block}
#el-lang-ja{left:590px;top:130px}#el-lang-en{left:1110px;top:250px}#el-lang-zh{left:490px;top:560px}
#el-well{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:14px;font-size:98px;white-space:nowrap;letter-spacing:-5px}
.el-cost-glow{position:absolute;inset:-240px;background:radial-gradient(ellipse at 91% 50%,#59b38cb0,transparent 41%),radial-gradient(ellipse at 15% 110%,#1d8da575,transparent 50%);filter:blur(72px)}
.el-band{position:absolute;height:150px;background:linear-gradient(125deg,#ffffff27,#ffffff02 75%);border-top:1px solid #ffffff15;border-bottom:1px solid #ffffff15;display:flex;align-items:center;gap:32px;font-size:112px;white-space:nowrap;letter-spacing:-4px}
#el-price-band{left:520px;top:450px;width:610px;padding-left:100px}#el-unit-band{left:1020px;top:450px;width:610px;padding-left:25px}
#el-wheel{height:470px;width:335px;flex-shrink:0;overflow:hidden;mask-image:linear-gradient(transparent,#0003 20%,#000 36%,#000 62%,#0003 80%,transparent)}#el-wheel-strip{position:relative}#el-wheel-strip>div{height:175px;line-height:175px}#el-price-icons{font-size:105px;letter-spacing:4px}#el-unit-icons{font-size:88px;letter-spacing:7px;overflow:hidden;flex-shrink:0}
#el-cost-rings{position:absolute;left:510px;top:90px;width:900px;height:900px;fill:none;stroke:#ffffff1c;stroke-width:1}
#el-slabs{position:absolute;left:520px;top:120px;width:880px;height:840px;overflow:visible}
.el-tiny-tag{position:absolute;border:1px solid #ddd8;border-radius:30px;padding:9px 20px;font-size:23px;letter-spacing:-1px;background:#232525a0;white-space:nowrap}
#el-cost-tag-0{left:655px;top:790px}#el-cost-tag-1{left:1150px;top:300px}#el-cost-tag-2{left:600px;top:435px}#el-cost-tag-3{left:1145px;top:725px}
#el-cost-bloom{position:absolute;inset:-250px;background:radial-gradient(ellipse at 50% 52%,#ffffdacc,#c3d896bb 30%,#4da89c77 65%,transparent);filter:blur(80px);pointer-events:none}
#el-light-bars{position:absolute;left:814px;top:290px;display:flex;gap:60px;filter:blur(5px) drop-shadow(0 0 55px #fff)}#el-light-bars i{display:block;background:white;width:66px;height:390px}
.el-orb{position:absolute;width:600px;height:600px;border-radius:50%;overflow:hidden;transform-origin:center;background:radial-gradient(ellipse at 16% 64%,#a6dcf6 0,transparent 38%),radial-gradient(ellipse at 73% 13%,#f1b585 0,transparent 31%),radial-gradient(ellipse at 69% 65%,#c0b932 0,transparent 36%),radial-gradient(ellipse at 27% 23%,#173c15 0,transparent 46%),radial-gradient(ellipse at 85% 90%,#25541c 0,transparent 43%),linear-gradient(130deg,#2b7b80,#5f8758 50%,#b9c657);box-shadow:inset 8px 3px 20px #fffffc35,inset -7px -4px 18px #153f4340;will-change:transform}
.el-orb-lobe{position:absolute;inset:-6%;background:radial-gradient(ellipse at 28% 29%,#102f0af2 0,transparent 40%),radial-gradient(ellipse at 72% 54%,#e1c925e0 0,transparent 35%),radial-gradient(ellipse at 29% 74%,#dcf7ffe8 0,transparent 28%),radial-gradient(ellipse at 86% 24%,#eecbaa9c 0,transparent 22%);filter:blur(16px);transform-origin:center}
.el-orb-grain{position:absolute;inset:0;filter:url(#el-grain);mix-blend-mode:soft-light;opacity:.065}
.el-orb-shine{position:absolute;inset:0;border-radius:50%;background:radial-gradient(ellipse 58% 12% at 40% 66%,#d5f6ffc9,transparent 92%),radial-gradient(ellipse 42% 15% at 84% 48%,#efcf35b5,transparent 92%),radial-gradient(ellipse 37% 19% at 31% 94%,#0077bb98,transparent 90%),radial-gradient(ellipse at 26% 9%,#faffff2a,transparent 45%);filter:blur(17px)}
.el-wordmark{position:absolute;display:flex;align-items:baseline;justify-content:center;gap:10px;white-space:nowrap;left:50%;top:50%;font-size:118px;line-height:1;letter-spacing:-6px;transform:translate(-50%,-50%)}.el-wordmark b{font-weight:650}.el-wordmark .el-bars{letter-spacing:-16px;margin-right:5px;font-weight:700}.el-wordmark .el-agents{font-weight:400}.el-wordmark .el-eleven,.el-wordmark .el-agents,.el-wordmark .el-bars{display:block}
.el-wordmark .el-bars{position:relative;width:.34em;height:.73em;align-self:center;margin-right:0;flex-shrink:0}.el-wordmark .el-bars:before,.el-wordmark .el-bars:after{content:'';position:absolute;top:0;bottom:0;width:.115em;background:currentColor}.el-wordmark .el-bars:before{left:0}.el-wordmark .el-bars:after{right:0}
#el-brand-halo{position:absolute;inset:-400px;background:radial-gradient(ellipse at 50% 50%,transparent 18%,#b7f6c4c0 35%,#72d9f8a0 47%,#cadb6790 65%,transparent 78%);filter:blur(80px)}
#el-brand-orb,#el-brand-orb-half{left:660px;top:240px}.el-half{clip-path:polygon(87% 0,100% 0,100% 100%,54% 100%,76% 50%)}
#el-price-orb{left:620px;top:150px;width:350px;height:350px}#el-simple-value{position:absolute;left:640px;top:585px;font-size:123px;font-weight:400;letter-spacing:-6px;white-space:nowrap}#el-per-min{color:#aaa;font-size:105px}#el-price-wordmark{font-size:49px;letter-spacing:-2.5px;left:820px;top:915px;gap:3px}#el-price-wordmark .el-bars{letter-spacing:-6px;margin-right:2px}
.el-tray{position:absolute;width:420px;height:340px;left:750px;transform-origin:50% 50%;filter:drop-shadow(12px 20px 12px #00000012)}.el-tray svg{width:420px;height:340px;overflow:visible}.el-tray-lid{transform-origin:center}
#el-tray-upper{top:110px}#el-tray-lower{top:440px}#el-tray-orb{width:116px;height:116px;left:890px;top:190px}#el-tray-copy{position:absolute;left:0;right:0;top:805px;text-align:center;font-size:63px;letter-spacing:-3px;color:#4d4d4b;z-index:20}
#el-network-content{position:absolute;left:560px;top:-20px;width:800px;height:800px;transform-origin:400px 400px}#el-network-svg{width:800px;height:800px;position:absolute;inset:0;overflow:visible}.el-net-ring{fill:none;stroke:#393b3524;stroke-width:1.2}
#el-net-ball{position:absolute;width:270px;height:270px;left:265px;top:265px;border-radius:50%;background:radial-gradient(ellipse at 22% 27%,#d9deb0,#4d9ba9 52%,#00518c 89%);box-shadow:inset -12px -2px 26px #00347944}
#el-net-copy{position:absolute;left:0;right:0;top:864px;text-align:center;font-size:57px;line-height:1.16;letter-spacing:-3px;color:#484845}#el-net-copy small{display:block;margin-top:24px;font-size:28px;font-style:italic;letter-spacing:-.8px;color:#999994}#el-net-line-two{min-height:66px}
#el-net-wash{position:absolute;inset:-320px;background:linear-gradient(105deg,#81eafa 0%,#d8fdc2 47%,#e7dc86 72%,#549475);filter:blur(120px)}
#el-final-orb{left:660px;top:240px}#el-final-wordmark{font-size:107px;letter-spacing:-5px;top:492px}#el-final-cta{position:absolute;left:725px;top:645px;width:470px;height:130px;display:grid;place-items:center;border-radius:80px;background:#eee;border:1.5px solid #d5d4d2;font-size:48px;color:#000;letter-spacing:-2.7px}
`,
  script: String.raw`
const el = id => document.getElementById(id);
const clamp = x => Math.max(0,Math.min(1,x));
const progress = (f,a,b) => clamp((f-a)/(b-a));
const out = x => 1-Math.pow(1-clamp(x),3);
const smooth = x => {x=clamp(x);return x*x*(3-2*x)};
const lerp = (a,b,t) => a+(b-a)*t;
const show = (id,yes) => el(id).style.display=yes?'block':'none';
const opacity = (id,v) => el(id).style.opacity=String(clamp(v));
const transform = (id,value) => el(id).style.transform=value;
function curve(f,points){if(f<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){if(f<=points[i][0])return lerp(points[i-1][1],points[i][1],progress(f,points[i-1][0],points[i][0]));}return points[points.length-1][1];}
function material(id,f,turn=0){const node=el(id);node.querySelector('.el-orb-lobe').style.transform='rotate('+(turn+Math.sin(f*.017)*12)+'deg) scale('+(.99+Math.sin(f*.021)*.07)+')';node.querySelector('.el-orb-shine').style.transform='rotate('+(-12+Math.sin(f*.025)*8)+'deg)';}
let dollarReady=false;
function dollar(){if(dollarReady)return;dollarReady=true;const c=el('el-dollar'),ctx=c.getContext('2d'),mask=document.createElement('canvas');mask.width=700;mask.height=700;const m=mask.getContext('2d');m.font='400 625px Arial';m.textAlign='center';m.textBaseline='middle';m.fillText('$',350,380);const pixels=m.getImageData(0,0,700,700).data;ctx.fillStyle='#f4f4f4';for(let y=8;y<692;y+=11)for(let x=8;x<692;x+=11){if(pixels[(y*700+x)*4+3]>90)ctx.fillRect(x,y,7,7);}}
function logo(id,f,start,color,size){const n=el(id);n.style.color=color;n.style.fontSize=size+'px';const t=out(progress(f,start,start+12));n.querySelector('.el-bars').style.opacity=String(clamp(t*2));n.querySelector('.el-eleven').style.clipPath='inset(0 '+(100*(1-t))+'% 0 0)';n.querySelector('.el-agents').style.clipPath='inset(0 '+(100*(1-t))+'% 0 0)';n.querySelector('.el-eleven').style.transform='translateX('+(-150*(1-t))+'px)';n.querySelector('.el-agents').style.transform='translateX('+(170*(1-t))+'px)';}
function netBall(f){const ctx=el('el-net-ball').getContext('2d');ctx.clearRect(0,0,360,360);const rot=f*.009;for(let j=0;j<30;j++){const latitude=-Math.PI/2+(j+.5)*Math.PI/30;for(let i=0;i<76;i++){const longitude=i*Math.PI*2/76+rot+latitude*.34;const x=Math.cos(latitude)*Math.sin(longitude),z=Math.cos(latitude)*Math.cos(longitude),y=Math.sin(latitude);if(z<0)continue;const px=180+x*178,py=180+y*178;ctx.fillStyle='rgba(219,244,232,'+(.08+.28*z)+')';ctx.beginPath();ctx.arc(px,py,1.1+z*.7,0,Math.PI*2);ctx.fill();}}}
function draw(frame){
 const f=Math.max(0,Math.min(840,Math.round(frame)));dollar();
 ['el-dark','el-interjection','el-cost','el-brand','el-simple-price','el-trays','el-network','el-finale'].forEach(id=>show(id,false));
 if(f<112){show('el-dark',true);show('el-seed',f<57);show('el-stack',f>=57);opacity('el-grid',1-progress(f,50,70));opacity('el-dark-glow',progress(f,0,22)*(1-progress(f,50,76)));transform('el-dark-glow','translateY('+lerp(180,0,out(progress(f,0,20)))+'px)');
  const glyph=f<20?'€':f<30?'¥':f<40?'₹':'$';el('el-seed-glyph').textContent=glyph;
  const size=curve(f,[[0,.01],[1,.10],[5,.57],[10,.78],[15,.87],[19,.91],[40,1],[45,1.08],[50,1.24],[54,1.63],[56,2.21]]);transform('el-seed','scale('+size+')');
  const growth=out(progress(f,57,78));const exit=Math.pow(progress(f,99,111),2);const globalScale=lerp(.50,1,growth)+.13*progress(f,79,99)+.25*exit;transform('el-stack','translateY('+(-270*exit)+'px) scale('+globalScale+')');
  for(let i=0;i<7;i++){const a=out(progress(f,57+i*1.4,68+i*1.4));opacity('el-plane-'+i,a);transform('el-plane-'+i,'translateY('+(i*(75+exit*60))+'px) rotateX(61deg) rotateZ(-9deg)');el('el-plane-'+i).style.zIndex=String(8-i);}
  el('el-dollar').style.zIndex='20';transform('el-dollar','translateY('+lerp(30,-12,growth)+'px)');
  ['ja','en','zh'].forEach((id,i)=>{const t=out(progress(f,[64,59,69][i],[79,75,87][i]));opacity('el-lang-'+id,t);transform('el-lang-'+id,'translateY('+(45*(1-t))+'px) scale('+lerp(.75,1,t)+')');el('el-lang-'+id).style.zIndex='30';});
 }
 if(f>=112&&f<145){show('el-interjection',true);const a=out(progress(f,112,116)),b=out(progress(f,120,125));el('el-well').firstElementChild.style.opacity=String(a);el('el-well').firstElementChild.style.transform='translateY('+(18*(1-a))+'px)';opacity('el-usually',b);transform('el-usually','translateY('+(20*(1-b))+'px)');}
 if(f>=145&&f<368){show('el-cost',true);const split=out(progress(f,171,185));const second=out(progress(f,213,225)),third=out(progress(f,260,277));const count=curve(f,[[145,0],[147,1],[149,1],[151,2],[154,2],[156,3],[171,3]]);const wheelHeight=lerp(470,150,split);el('el-wheel').style.height=wheelHeight+'px';el('el-wheel').style.maskImage=split>.98?'none':'linear-gradient(transparent,#0003 20%,#000 36%,#000 62%,#0003 80%,transparent)';transform('el-wheel-strip','translateY('+(-count*175+(wheelHeight-175)/2)+'px)');
  const wheelEntry=108*(1-out(progress(f,145,151)));transform('el-price-band','translate('+lerp(-100,0,split)+'px,'+(lerp(wheelEntry,-250,split)-third*90)+'px) scale('+lerp(1,.90,split)+')');el('el-price-band').style.width=lerp(1100,710,split)+'px';el('el-price-band').style.paddingLeft=lerp(270,100,split)+'px';transform('el-unit-band','translate('+lerp(0,-210,split)+'px,'+(lerp(wheelEntry,285,split)+third*100)+'px) scale('+lerp(1,.90,split)+')');el('el-unit-band').style.background=split>.02?'linear-gradient(125deg,#ffffff18,#ffffff02 75%)':'transparent';el('el-unit-band').style.borderColor=split>.02?'#ffffff15':'transparent';el('el-unit-icons').style.width=(210*split)+'px';el('el-unit-band').style.gap=(32*split)+'px';opacity('el-price-icons',split);opacity('el-unit-icons',split);opacity('el-cost-rings',split*.65);
  const positions=[lerp(0,90,second)+third*20,lerp(-190,-65,second)+third*55,lerp(-280,-140,third)];
  for(let i=0;i<3;i++){opacity('el-slab-'+i,i===0?split:i===1?second:third);el('el-slab-'+i).setAttribute('transform','translate(0 '+positions[i]+')');}
  const retreat=out(progress(f,344,367));transform('el-slabs','scale('+lerp(1,.86,retreat)+')');opacity('el-cost-glow',split);transform('el-cost-glow','translateX('+(-f*.28+60)+'px)');
  [0,1,2,3].forEach(i=>opacity('el-cost-tag-'+i,out(progress(f,[175,214,260,270][i],[190,230,278,284][i]))));opacity('el-cost-bloom',retreat*.94);opacity('el-light-bars',Math.pow(progress(f,354,367),2));
 }
 if(f>=368&&f<441){show('el-brand',true);const join=smooth(progress(f,368,390)),contract=progress(f,397,410);const diameter=curve(f,[[368,2300],[371,1840],[378,1390],[385,1130],[390,1040],[394,968],[397,860],[400,470],[404,338],[410,286],[420,254],[434,220],[440,220]]);const fade=1-progress(f,434,440);
  const splitClearance=20*out(progress(f,368,380)),closeSplit=progress(f,386,390); // Translate the same diagonal seam beyond the white wordmark as it assembles.
  transform('el-brand-orb','scale('+(diameter/600)+') rotate('+lerp(-21,0,join)+'deg)');el('el-brand-orb').style.clipPath=f<390?'polygon(0 0,'+lerp(100+splitClearance,100,closeSplit)+'% 0,'+lerp(48+splitClearance,100,closeSplit)+'% 100%,0 100%)':'none';opacity('el-brand-orb',fade);
  el('el-brand-orb-half').style.clipPath='polygon('+(87+splitClearance)+'% 0,120% 0,120% 100%,'+(54+splitClearance)+'% 100%,'+(76+splitClearance)+'% 50%)';
  transform('el-brand-orb-half','translate('+lerp(270,0,join)+'px,'+lerp(130,0,join)+'px) rotate('+lerp(28,0,join)+'deg) scale('+(diameter/600)+')');opacity('el-brand-orb-half',(1-progress(f,389,391))*fade);
  material('el-brand-orb',f);material('el-brand-orb-half',f,20);opacity('el-brand-halo',smooth(contract));transform('el-brand-halo','scale('+lerp(.85,1.24,progress(f,398,440))+') rotate('+(f*.025)+'deg)');
  const font=curve(f,[[368,150],[385,118],[394,118],[400,94],[410,86],[434,80]]);logo('el-brand-wordmark',f,368,f<398?'#fff':'#111',font);opacity('el-brand-wordmark',fade);
 }
 if(f>=441&&f<487){show('el-simple-price',true);const settle=out(progress(f,441,460)),exit=Math.pow(progress(f,478,487),2);const value=curve(f,[[441,14],[443,13],[445,12],[447,11],[450,10],[454,9],[457,8]]);el('el-number').textContent='$0.'+String(Math.round(value)).padStart(2,'0');transform('el-simple-value','translateY('+(160*(1-settle)+400*exit)+'px) scale('+lerp(2.4,1,settle)+')');el('el-simple-value').style.transformOrigin='left center';opacity('el-per-min',out(progress(f,458,474)));
  transform('el-price-orb','translateY('+(35*(1-settle)+500*exit)+'px) scale('+lerp(1.8,1,settle)+')');material('el-price-orb',f);el('el-price-orb').style.filter='blur('+(14*(1-settle))+'px)';logo('el-price-wordmark',f,444,'#080808',49);transform('el-price-wordmark','translate(-50%,-50%) translateY('+(150*exit)+'px)');opacity('el-price-wordmark',1-exit);
 }
 if(f>=487&&f<558){show('el-trays',true);const enter=out(progress(f,487,499)),leave=Math.pow(progress(f,550,558),2);const base=-510*(1-enter)-leave*420;transform('el-tray-upper','translateY('+base+'px)');transform('el-tray-lower','translateY('+base+'px)');el('el-tray-upper').querySelector('.el-tray-lid').style.transform='translateY(-45px)';el('el-tray-lower').querySelector('.el-tray-lid').style.transform='translateY('+(-70*out(progress(f,526,539)))+'px)';el('el-tray-lower').querySelector('.el-tray-lid').style.opacity=String(out(progress(f,526,529)));
  const ballY=curve(f,[[487,-100],[492,30],[498,275],[505,365],[510,420],[518,420],[525,420],[532,610],[540,745],[550,765],[557,870]]);transform('el-tray-orb','translateY('+(ballY-190+base*.1)+'px)');material('el-tray-orb',f);
  el('el-tray-upper').style.zIndex=f<498?'5':'2';el('el-tray-lower').style.zIndex=f<532?'1':'5';el('el-tray-orb').style.zIndex='3';
  const first=f<519;el('el-tray-copy').textContent=first?(f<495?'No':'No minimums.'):(f<526?'No':f<534?'No sales':'No sales call.');opacity('el-tray-copy',first?out(progress(f,488,497))*(1-progress(f,514,519)):out(progress(f,519,535)));transform('el-tray-copy','translateY('+lerp(18,0,enter)+'px)');
 }
 if(f>=558&&f<679){show('el-network',true);netBall(f);const enter=out(progress(f,558,574));const shrink=out(progress(f,649,678));transform('el-network-content','translateY('+lerp(80,0,enter)+'px) scale('+lerp(1,.72,shrink)+')');const svg=el('el-net-lines');const num=f<569?1:f<579?2:f<613?3:f<622?4:f<633?5:6;let line='';const nodes=[];for(let i=0;i<num;i++){const angle=[1.62,.02,-2.08,1.26,-.65,-1.84][i]+(f-558)*.001;const r=[282,300,266,307,314,325][i];nodes.push([400+Math.cos(angle)*r,400+Math.sin(angle)*r]);}
  nodes.forEach((p,i)=>{const q=nodes[(i+1)%nodes.length];if(num>1)line+='<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+q[0]+'" y2="'+q[1]+'" stroke="#41413d" stroke-width="1.4"/>';line+='<rect x="'+(p[0]-7)+'" y="'+(p[1]-7)+'" width="14" height="14" fill="#50504b" transform="rotate(-12 '+p[0]+' '+p[1]+')"/>';});svg.innerHTML=line;
  document.querySelectorAll('.el-net-ring').forEach((n,i)=>{n.style.opacity=String(out(progress(f,560+i*2,571+i*2)));n.style.transformOrigin='400px 400px';n.style.transform='scale('+lerp(.75,1,out(progress(f,558,580)))+')';});
  el('el-net-line-one').textContent=f<562?'':f<567?'Full':f<573?'Full voice':'Full voice stack,';el('el-net-line-two').textContent=f<613?'':f<621?'in':f<627?'in one':f<634?'in one per-minute':'in one per-minute rate.';opacity('el-net-copy',out(progress(f,561,573))*(1-shrink*.8));el('el-net-copy').querySelector('small').style.opacity=String(out(progress(f,566,575)));opacity('el-net-wash',shrink);transform('el-net-wash','translateX('+lerp(260,-120,shrink)+'px) rotate(-5deg)');
 }
 if(f>=679){show('el-finale',true);const d=curve(f,[[679,1250],[685,700],[690,600],[695,544],[700,506],[705,476],[710,438],[715,350],[717,280],[719,168],[721,100],[723,65],[725,37],[727,20],[729,0]]);transform('el-final-orb','scale('+(Math.max(0,d)/600)+')');material('el-final-orb',f);el('el-final-orb').style.filter='blur('+(lerp(30,0,out(progress(f,679,700))))+'px)';opacity('el-final-orb',f<729?1:0);
  logo('el-final-wordmark',f,718,'#050505',curve(f,[[718,118],[732,107],[755,101],[840,101]]));opacity('el-final-wordmark',f>=718?1:0);transform('el-final-wordmark','translate(-50%,-50%) translateY('+lerp(49,0,out(progress(f,730,754)))+'px)');const button=out(progress(f,756,764));opacity('el-final-cta',button);transform('el-final-cta','translateY('+(54*(1-button))+'px)');
 }
}
`,
};
