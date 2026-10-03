import type { MotionStudy } from './types';

// Authored action study: one sentence becomes one saved task. No source pixels.
const svg = (name: string) => {
  const paths: Record<string, string> = {
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-10 4h4"/>',
    flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
    inbox: '<path d="M4 4h16v16H4zM4 14h5l2 3h2l2-3h5"/>',
    up: '<path d="M12 20V4M5 11l7-7 7 7"/>',
    right: '<path d="M4 12h16M13 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    label: '<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>',
    attach: '<path d="M8 16l8-8a3 3 0 00-4-4L3 13a5 5 0 007 7l10-10M7 16l8-8"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plus}</svg>`;
};
const mark = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor"/><g stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l10 6 26-15M15 31l10 6 26-15M15 43l10 6 26-15"/></g></svg>';
const sentence = ['Meet with Ada', 'tomorrow', 'at 14', 'p1'];

export const todoistStudy: MotionStudy = {
  id: 'todoist-motion', title: 'Todoist — a thought becomes a task', width: 1920, height: 1080, fps: 30, durationFrames: 540,
  reference: { path: '', startSeconds: 0, durationSeconds: 18 },
  reviewFrames: [0, 12, 30, 53, 68, 86, 105, 129, 154, 180, 208, 229, 248, 269, 291, 299, 318, 337, 364, 388, 414, 438, 465, 492, 539],
  notes: [
    'Manually authored action-centered 18-second film. Not automatic URL generation or an official Todoist campaign; older studies are unchanged.',
    'Official source: https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz documents natural-language dates/times and p1. Preserved official desktop video/frames in .local/launch-todoist-sourcepack-20261003 show Quick Add → red Add arrow → matching Inbox task, Tomorrow 14:00 and an unfilled red priority circle.',
    'Palette comes from the captured official public site https://www.todoist.com/: logo flat color rgb(222,72,58) #DE483A; body rgb(37,34,30) #25221E; captured logo background rgb(254,253,252) #FEFDFC. Evidence: .local/software-launch-capture-todoist-1791033893687/analysis/brand-evidence.json and original assets/brand-logo-0.png. These are observed public-site values, not an invented brand manual.',
    'Native due-date ochre #AD8032, priority red #BD4B40 and Add control #D94332 follow the preserved official desktop demonstration; stage palette is near-white/warm black/Todoist red only. Typeface is the pinned local Geist approximation, not a claim to distribute Todoist Graphik.',
    'F0–53 giant sentence; F54–90 same words enter Quick Add; F100–137 tomorrow recognition; F150–185 time recognition; F202–231 P1 recognition; F244–278 overview; F289 single click; F295–328 composer contracts into saved Inbox row; F328–369 readable result; F370–423 macro persistence proof; F424–473 thought-to-task payoff; F474–539 brand CTA.',
    'Token flights and composer-to-row contraction are editorial explanations of documented parsing and saving, not literal recordings of the interface animation. No task is completed; no Today placement, reminder entitlement, voice/AI, instant-speed, or multiple-task claim.',
    'One input sentence is retained until confirmation. Title, Tomorrow 14:00 and P1 remain coherent after the click. Result holds still for approximately 1.37 seconds before the inspection camera travels.',
    'Deterministic HTML/SVG, locally pinned GSAP/font. No Unicode UI icons, CSS animations, randomness, confetti, tickers, swarms, or flashing backgrounds. Start for free is the official homepage CTA.',
  ],
  html: `
    <div id="tm-paper"></div><div id="tm-header"><div class="tm-lockup">${mark}<span>todoist</span></div><span>FOR WORK. FOR LIFE.</span></div>
    <div id="tm-thought-label">A task starts as a thought.</div><div id="tm-thought">${sentence.map((text, i) => `<span id="tm-word-${i}" class="tm-word">${text}</span>`).join('')}</div>
    <div id="tm-intro-foot">Task management, in your own words.</div><div id="tm-quick-caption"><b>QUICK ADD</b><span>Type it as you think it.</span></div>
    <div id="tm-camera"><div id="tm-window"><div class="tm-window-chrome"><i></i><i></i><i></i><span>${mark}<b>todoist</b></span></div><h2>Inbox</h2><div id="tm-row-rule"></div><div id="tm-add-another">${svg('plus')}<span>Add task</span></div><div class="tm-section" id="tm-work">${svg('chevron')}<strong>Work</strong><small>1</small></div><div class="tm-section" id="tm-personal">${svg('chevron')}<strong>Personal</strong><small>4</small></div></div>
      <div id="tm-composer-surface"><svg viewBox="0 0 1140 316" preserveAspectRatio="none" aria-hidden="true"><rect x=".5" y=".5" width="1139" height="315" rx="15.5" fill="#fff" stroke="#ddd6ce" stroke-width="1"/></svg></div>
      <div id="tm-native-title">${sentence.map((text, i) => `<span id="tm-native-${i}">${text}</span>`).join('')}<i id="tm-caret"></i></div>
      <div id="tm-description">Description</div>
      <div id="tm-date-chip" class="tm-chip">${svg('calendar')}<span id="tm-date-day">Date</span><span id="tm-date-time">14:00</span></div>
      <div id="tm-priority-chip" class="tm-chip">${svg('flag')}<span id="tm-priority-value">Priority</span></div>
      <div id="tm-deadline-chip" class="tm-chip">${svg('calendar')}<span>Deadline</span></div><div id="tm-label-icon">${svg('label')}</div><div id="tm-attach-icon">${svg('attach')}</div>
      <div id="tm-footer"><div id="tm-inbox-control">${svg('inbox')}<span>Inbox</span>${svg('down')}</div><div id="tm-send">${svg('up')}</div></div>
      <div id="tm-priority-circle"></div><div id="tm-toast">Task added to Inbox</div>
    </div>
    <div id="tm-date-echo" class="tm-echo">tomorrow</div><div id="tm-time-echo" class="tm-echo">at 14</div><div id="tm-priority-echo" class="tm-echo">p1</div>
    <div id="tm-recognition-label"><span id="tm-recognition-index">01</span><span id="tm-recognition-copy">A date, recognized.</span></div>
    <div id="tm-cursor"><svg viewBox="0 0 48 60" aria-hidden="true"><path d="M5 3L42 32L26 34L37 50L29 56L19 39L8 51Z" fill="#25221e" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></div>
    <div id="tm-commit-caption">One click.<br><strong>It’s a task.</strong></div>
    <svg id="tm-leaders" width="1920" height="1080" viewBox="0 0 1920 1080" fill="none" aria-hidden="true"><path id="tm-priority-line"/><path id="tm-date-line"/><circle id="tm-priority-dot" r="4"/><circle id="tm-date-dot" r="4"/></svg>
    <div id="tm-priority-note" class="tm-proof-note"><b>PRIORITY 1</b><span>Still marked.</span></div><div id="tm-date-note" class="tm-proof-note"><b>TOMORROW, 14:00</b><span>Still scheduled.</span></div>
    <div id="tm-payoff"><span>From thought.</span><strong>To task.</strong></div>
    <div id="tm-finish"><div class="tm-finish-category">TASK MANAGEMENT, IN YOUR OWN WORDS.</div><div id="tm-finish-brand">${mark}<span>todoist</span></div><div id="tm-finish-cta">Start for free ${svg('right')}</div><div class="tm-finish-url">todoist.com</div></div>
  `,
  css: `
    :root{--tm-red:#de483a;--tm-ink:#25221e;--tm-paper:#fefdfc;--tm-line:#e7e2dc;--tm-muted:#858078}#stage{background:var(--tm-paper);color:var(--tm-ink);font-family:Studio,Arial,sans-serif;isolation:isolate}#stage svg{display:block}#tm-paper{position:absolute;inset:0;background:linear-gradient(115deg,#fefdfc 52%,#f6f3ee 100%)}#tm-header{position:absolute;left:100px;top:65px;right:100px;display:flex;justify-content:space-between;align-items:center;z-index:15}#tm-header>span{color:#8c857d;font-size:18px;font-weight:550;letter-spacing:2.6px}.tm-lockup{display:flex;align-items:center;gap:11px;color:var(--tm-red);font-size:38px;font-weight:720;letter-spacing:-1px}.tm-lockup svg{width:40px;height:40px}
    #tm-thought-label{position:absolute;left:116px;top:195px;font-size:25px;color:#8d867e;letter-spacing:-.4px}#tm-thought{position:absolute;inset:0;z-index:10}.tm-word{position:absolute;left:0;top:0;line-height:1.08;white-space:nowrap;letter-spacing:-7px;font-weight:610;transform-origin:left top}#tm-word-1{color:var(--tm-red)}#tm-word-3{color:#7a7269}#tm-intro-foot{position:absolute;left:116px;top:887px;font-size:29px;color:#8b857c;font-weight:430;letter-spacing:-.5px}#tm-quick-caption{position:absolute;left:128px;top:799px;display:flex;gap:31px;align-items:baseline;z-index:1}#tm-quick-caption b{font-size:20px;letter-spacing:2px;font-weight:640;color:var(--tm-red)}#tm-quick-caption span{font-size:42px;letter-spacing:-1.4px;font-weight:480}
    #tm-camera{position:absolute;left:0;top:0;width:1400px;height:850px;transform-origin:0 0;z-index:5}#tm-window{position:absolute;inset:0;background:#fff;border:1px solid #e5e1db;border-radius:17px;box-shadow:0 28px 75px #42372a10;overflow:hidden}.tm-window-chrome{position:absolute;top:0;left:0;right:0;height:62px;display:flex;align-items:center;gap:10px;padding-left:25px;background:#fcfbf9;border-bottom:1px solid #ece8e2}.tm-window-chrome>i{width:12px;height:12px;border-radius:50%;background:#d5d0ca}.tm-window-chrome>span{position:absolute;left:622px;display:flex;align-items:center;gap:8px;color:var(--tm-red)}.tm-window-chrome svg{width:25px;height:25px}.tm-window-chrome b{font-size:22px;font-weight:700;letter-spacing:-.5px}#tm-window h2{position:absolute;left:130px;top:163px;margin:0;font-size:50px;font-weight:680;letter-spacing:-1.8px}#tm-row-rule{position:absolute;left:130px;right:130px;top:436px;height:1px;background:#e9e5df}#tm-add-another{position:absolute;left:130px;top:474px;display:flex;align-items:center;gap:13px;font-size:26px;color:#8b847a}#tm-add-another svg{width:28px;height:28px;color:var(--tm-red)}.tm-section{position:absolute;left:130px;width:1140px;display:flex;gap:14px;align-items:center;font-size:26px;border-bottom:1px solid #ece8e2;padding-bottom:23px}.tm-section svg{width:23px;height:23px;color:#a29b93}.tm-section strong{font-weight:590}.tm-section small{color:#a69f97;font-size:21px}#tm-work{top:588px}#tm-personal{top:691px}
    #tm-composer-surface{position:absolute;left:130px;top:300px;width:1140px;height:316px;border:0;border-radius:16px;background:transparent;box-shadow:0 24px 65px #47382b17;transform-origin:34px 35px}#tm-composer-surface>svg{width:100%;height:100%}#tm-native-title{position:absolute;left:164px;top:330px;display:flex;align-items:baseline;gap:12px;white-space:nowrap;font-size:44px;font-weight:480;letter-spacing:-1.25px;line-height:1.2;z-index:3}#tm-native-title>span{display:block}#tm-caret{display:block;width:2px;height:45px;background:#a76555;transform:translateY(6px)}#tm-description{position:absolute;left:164px;top:402px;font-size:23px;color:#a09990;font-weight:400;letter-spacing:-.3px}
    .tm-chip{position:absolute;left:160px;top:454px;height:47px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #e1dcd5;border-radius:7px;font-size:25px;letter-spacing:-.4px;line-height:1;color:#817a71;white-space:nowrap;transform-origin:left center;background:#fff}.tm-chip svg{width:27px;height:27px;flex:none}#tm-date-time{margin-left:1px}#tm-priority-chip{left:341px}#tm-deadline-chip{left:532px}#tm-label-icon,#tm-attach-icon{position:absolute;top:463px;left:720px;width:26px;height:26px;color:#8d857a}#tm-attach-icon{left:767px}#tm-label-icon svg,#tm-attach-icon svg{width:26px;height:26px}#tm-footer{position:absolute;left:131px;top:539px;width:1138px;height:75px;background:#fcfbf8;border-top:1px solid #eee9e2;border-radius:0 0 15px 15px}#tm-inbox-control{position:absolute;left:30px;top:25px;display:flex;align-items:center;gap:11px;color:#797268;font-size:23px}#tm-inbox-control svg{width:24px;height:24px}#tm-inbox-control svg:last-child{width:15px;height:15px;margin-left:5px}#tm-send{position:absolute;right:20px;top:11px;width:52px;height:52px;background:#d94332;border-radius:50%;color:white;display:grid;place-items:center;transform-origin:center}#tm-send svg{width:29px;height:29px}#tm-priority-circle{position:absolute;left:147px;top:336px;width:31px;height:31px;border:2px solid #bd4b40;border-radius:50%;background:transparent}#tm-toast{position:absolute;left:526px;top:748px;background:#292725;color:#fff;padding:16px 24px;font-size:24px;border-radius:7px;box-shadow:0 7px 16px #0002}
    .tm-echo{position:absolute;left:0;top:0;line-height:1.2;letter-spacing:-1px;color:var(--tm-red);font-weight:530;transform-origin:left top;z-index:11;white-space:nowrap;pointer-events:none}#tm-recognition-label{position:absolute;left:118px;bottom:125px;display:flex;gap:23px;align-items:center;font-size:31px;letter-spacing:-.5px;color:#787167;z-index:12}#tm-recognition-index{font-size:18px;color:var(--tm-red);border-top:2px solid var(--tm-red);padding-top:11px;align-self:start}#tm-cursor{position:absolute;left:0;top:0;width:50px;height:62px;z-index:18;transform-origin:5px 3px;filter:drop-shadow(0 3px 2px #0002)}#tm-commit-caption{position:absolute;left:107px;top:200px;font-size:68px;line-height:1.12;font-weight:440;letter-spacing:-2.8px;color:#979086;z-index:1}#tm-commit-caption strong{font-weight:570;color:var(--tm-ink)}
    #tm-leaders{position:absolute;inset:0;z-index:8;pointer-events:none}#tm-leaders path{stroke:#b9b0a5;stroke-width:1.2}#tm-leaders circle{fill:var(--tm-red)}.tm-proof-note{position:absolute;top:660px;z-index:10;display:flex;flex-direction:column;gap:15px}.tm-proof-note b{font-size:18px;font-weight:600;letter-spacing:2px;color:var(--tm-red)}.tm-proof-note span{font-size:32px;letter-spacing:-.7px;color:#645c53}#tm-priority-note{left:187px}#tm-date-note{left:1140px}#tm-payoff{position:absolute;left:110px;top:292px;display:flex;flex-direction:column;gap:7px;z-index:3;font-size:104px;line-height:1.03;letter-spacing:-5px;color:#a49b90;font-weight:480}#tm-payoff strong{color:var(--tm-ink);font-weight:640}
    #tm-finish{position:absolute;inset:0;z-index:22;background:var(--tm-paper);text-align:center}.tm-finish-category{position:absolute;left:0;right:0;top:172px;font-size:22px;letter-spacing:2px;color:#8b8379;font-weight:450}#tm-finish-brand{position:absolute;left:0;right:0;top:336px;display:flex;align-items:center;justify-content:center;gap:30px;font-size:157px;font-weight:720;letter-spacing:-7px;color:var(--tm-red)}#tm-finish-brand svg{width:136px;height:136px}#tm-finish-cta{position:absolute;left:699px;top:663px;width:522px;height:109px;display:flex;align-items:center;justify-content:center;gap:24px;background:var(--tm-red);border-radius:14px;color:#fff;font-size:38px;font-weight:570;letter-spacing:-.7px;box-shadow:0 7px 0 #c44134}#tm-finish-cta svg{width:35px;height:35px}.tm-finish-url{position:absolute;left:0;right:0;top:844px;color:#8b8379;font-size:26px;letter-spacing:.2px}
  `,
  script: `
    const tmQ=id=>document.getElementById(id),tmP=(f,a,b)=>Math.max(0,Math.min(1,(f-a)/(b-a))),tmL=(a,b,p)=>a+(b-a)*p;
    const tmE=p=>1-Math.pow(1-p,4),tmS=p=>p*p*(3-2*p);
    const tmO=(id,a)=>{const e=tmQ(id);e.style.opacity=String(Math.max(0,Math.min(1,a)));e.style.visibility=a>0?'visible':'hidden';};
    const tmM=(id,x,y,s=1,r=0)=>{tmQ(id).style.transform='translate('+x+'px,'+y+'px) scale('+s+') rotate('+r+'deg)';};
    const tmW=(f,a,b,c,d)=>tmP(f,a,b)*(1-tmP(f,c,d));
    function tmCamera(f){
      const keys=[[0,235,40,1],[96,235,40,1],[120,-70,-255,1.55],[148,-125,-305,1.65],[180,-220,-595,2.3],[201,-220,-595,2.3],[229,-780,-775,2.7],[262,215,55,1.06],[277,215,55,1.06],[289,-3340,-1640,3.9],[298,-3340,-1640,3.9],[328,195,90,1.1],[369,195,90,1.1],[391,65,-315,1.85],[414,65,-315,1.85],[450,858,137,.64],[475,1030,146,.55],[501,2120,146,.55],[539,2120,146,.55]];
      for(let i=1;i<keys.length;i++){if(f<=keys[i][0]){const a=keys[i-1],b=keys[i],p=tmS(tmP(f,a[0],b[0]));return[tmL(a[1],b[1],p),tmL(a[2],b[2],p),tmL(a[3],b[3],p)];}}return[2120,146,.55];
    }
    function tmFlight(id,fromId,toId,f,a,b,arc,word){
      const p=tmP(f,a,b),e=tmE(p),from=tmQ(fromId).getBoundingClientRect(),to=tmQ(toId).getBoundingClientRect();
      tmO(id,f>=a&&f<b?Math.sin(Math.PI*p)*.98:0);tmQ(id).textContent=word;
      tmQ(id).style.fontSize=tmL(from.height/1.2,to.height,e)+'px';
      tmM(id,tmL(from.x,to.x,e),tmL(from.y,to.y,e)-arc*Math.sin(Math.PI*p),1,0);
    }
    function draw(frame){
      const f=Math.max(0,Math.min(539,frame)),cam=tmCamera(f),commit=tmS(tmP(f,295,328));
      tmM('tm-camera',cam[0],cam[1],cam[2]);
      const crop=tmE(tmP(f,369,391))*(1-tmE(tmP(f,414,436)));tmQ('tm-camera').style.clipPath='inset(0 0 '+(395*crop)+'px 0)';
      tmO('tm-header',1-tmP(f,84,100));tmO('tm-thought-label',1-tmP(f,46,62));tmO('tm-intro-foot',1-tmP(f,47,63));
      tmO('tm-quick-caption',tmW(f,68,85,94,107));tmM('tm-quick-caption',0,25*(1-tmE(tmP(f,68,88))));
      const panel=tmE(tmP(f,51,82));tmO('tm-composer-surface',panel*(1-commit));tmM('tm-composer-surface',0,100*(1-panel));
      tmQ('tm-composer-surface').style.height=tmL(316,110,commit)+'px';tmQ('tm-composer-surface').style.boxShadow='0 '+tmL(24,0,commit)+'px '+tmL(65,0,commit)+'px #47382a17';
      tmO('tm-window',tmP(f,307,325));tmM('tm-window',0,50*(1-tmE(tmP(f,307,328))));
      tmO('tm-native-title',f>=91?1:0);tmQ('tm-native-title').style.left=tmL(164,205,commit)+'px';tmQ('tm-native-title').style.top=tmL(330,320,commit)+'px';tmQ('tm-native-title').style.fontSize=tmL(44,40,commit)+'px';
      for(let i=1;i<4;i++){tmO('tm-native-'+i,1-tmP(f,294+i*2,307+i*2));}
      tmO('tm-caret',f>=87&&f<287?.6:0);tmO('tm-description',tmP(f,73,87)*(1-commit));tmO('tm-footer',tmP(f,70,84)*(1-tmP(f,294,313)));
      const date=tmE(tmP(f,108,120)),time=tmE(tmP(f,164,182)),priority=tmE(tmP(f,210,229));
      const dateWidth=tmL(128,207,date)+tmL(0,85,time),priorityLeft=160+dateWidth+14,priorityWidth=tmL(166,100,priority);
      const dateEl=tmQ('tm-date-chip');dateEl.style.width=dateWidth+'px';dateEl.style.left=tmL(160,205,commit)+'px';dateEl.style.top=tmL(454,383,commit)+'px';dateEl.style.height=tmL(47,39,commit)+'px';dateEl.style.padding=tmL(12,0,commit)+'px';dateEl.style.borderColor=commit>=1?'transparent':date>.1?'#dbcaa8':'#e1dcd5';dateEl.style.background=commit>=1?'transparent':'#fff';dateEl.style.color=date>.1?'#ad8032':'#817a71';
      tmQ('tm-date-day').textContent=f>=117?'Tomorrow':'Date';tmO('tm-date-time',f>=179?1:0);tmQ('tm-date-time').style.display=f>=164?'block':'none';
      tmO('tm-date-chip',tmP(f,73,87));tmQ('tm-priority-chip').style.left=priorityLeft+'px';tmQ('tm-priority-chip').style.width=priorityWidth+'px';tmQ('tm-priority-chip').style.color=f>=222?'#bd4b40':'#817a71';tmQ('tm-priority-chip').style.borderColor=f>=222?'#dab3ac':'#e1dcd5';tmQ('tm-priority-value').textContent=f>=222?'P1':'Priority';tmO('tm-priority-chip',tmP(f,73,87)*(1-tmP(f,296,314)));
      tmQ('tm-deadline-chip').style.left=(priorityLeft+priorityWidth+14)+'px';tmQ('tm-label-icon').style.left=(priorityLeft+priorityWidth+200)+'px';tmQ('tm-attach-icon').style.left=(priorityLeft+priorityWidth+248)+'px';for(const id of ['tm-deadline-chip','tm-label-icon','tm-attach-icon'])tmO(id,tmP(f,75,89)*(1-tmP(f,295,313)));
      tmO('tm-priority-circle',tmP(f,311,326));tmO('tm-toast',tmW(f,323,335,365,381));
      tmO('tm-thought',f<91?1:0);const starts=[[110,279,166],[118,493,168],[1040,512,134],[1502,512,134]],offsets=[-70,-50,80,0];
      for(let i=0;i<4;i++){const start=starts[i],m=tmE(tmP(f,62,88)),shrink=tmE(tmP(f,51,65)),rush=tmE(tmP(f,0+i*2,17+i*2)),target=tmQ('tm-native-'+i).getBoundingClientRect();const word=tmQ('tm-word-'+i);word.style.fontSize=tmL(start[2]*(1+.12*(1-rush)),44,shrink)+'px';word.style.letterSpacing=tmL(-start[2]*.038,-1.25,shrink)+'px';word.style.fontWeight=String(tmL(610,480,shrink));word.style.lineHeight=String(tmL(1.08,1.2,shrink));word.style.color=f>=84?'#25221e':i===1?'#de483a':i===3?'#7a7269':'#25221e';tmM('tm-word-'+i,tmL(start[0]+offsets[i]*(1-rush),target.x,m),tmL(start[1]+(i===0?-32:35)*(1-rush),target.y,m),1,(i%2?1.8:-1.1)*(1-rush)*(1-m));}
      tmFlight('tm-date-echo','tm-native-1','tm-date-day',f,101,119,90,'tomorrow');tmFlight('tm-time-echo','tm-native-2','tm-date-time',f,162,181,75,f>=174?'14:00':'at 14');tmFlight('tm-priority-echo','tm-native-3','tm-priority-value',f,208,227,75,f>=221?'P1':'p1');
      tmO('tm-recognition-label',tmW(f,111,123,243,258));tmQ('tm-recognition-index').textContent=f<161?'01':f<209?'02':'03';tmQ('tm-recognition-copy').textContent=f<161?'A date, recognized.':f<209?'The time, included.':'The priority, set.';
      const send=tmQ('tm-send').getBoundingClientRect(),cx=send.x+send.width/2,cy=send.y+send.height/2,cp=tmS(tmP(f,274,288));tmO('tm-cursor',tmW(f,272,279,298,306));tmM('tm-cursor',tmL(1840,cx-5,cp),tmL(880,cy-3,cp),1-.14*Math.sin(Math.PI*tmP(f,286,295)));
      tmM('tm-send',0,0,1-.12*Math.sin(Math.PI*tmP(f,286,296)));tmO('tm-commit-caption',0);
      const proof=tmW(f,378,391,414,428);tmO('tm-leaders',proof);tmO('tm-priority-note',proof);tmO('tm-date-note',proof);
      const dot=tmQ('tm-priority-circle').getBoundingClientRect(),due=tmQ('tm-date-chip').getBoundingClientRect(),dx=dot.x+dot.width/2,dy=dot.y+dot.height/2,ex=due.x+due.width*.64,ey=due.y+due.height;
      tmQ('tm-priority-line').setAttribute('d','M'+dx+' '+(dy+23)+' L'+dx+' 614 L192 614');tmQ('tm-date-line').setAttribute('d','M'+ex+' '+(ey+12)+' L'+ex+' 614 L1145 614');tmQ('tm-priority-dot').setAttribute('cx',dx);tmQ('tm-priority-dot').setAttribute('cy',dy+23);tmQ('tm-date-dot').setAttribute('cx',ex);tmQ('tm-date-dot').setAttribute('cy',ey+12);
      tmO('tm-payoff',tmW(f,445,456,475,486));tmM('tm-payoff',-65*(1-tmE(tmP(f,445,458))),0);
      const finish=tmE(tmP(f,471,491));tmO('tm-finish',finish);tmM('tm-finish',-1920*(1-finish),0);tmM('tm-finish-brand',0,30*(1-tmE(tmP(f,482,505))));tmM('tm-finish-cta',0,60*(1-tmE(tmP(f,487,514))));
    }
  `,
};
