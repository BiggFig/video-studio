import type { MotionStudy } from './types';

// Private, manually art-directed launch study. The reconstructed desktop Quick
// Add → Inbox interaction is grounded in Todoist's preserved official demo.
// Everything outside the native white UI is editorial animation, not product UI.
const icon = (name: string) => {
  const paths: Record<string, string> = {
    inbox: '<path d="M4 4h16v16H4zM4 14h5l2 3h2l2-3h5"/>',
    date: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
    flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M12 20V4M5 11l7-7 7 7"/>',
    label: '<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>',
    attach: '<path d="M8 16l8-8a3 3 0 00-4-4L3 13a5 5 0 007 7l10-10M7 16l8-8"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plus}</svg>`;
};
const mark = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor"/><g stroke="var(--mark-lines,#fff)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l10 6 26-15M15 31l10 6 26-15M15 43l10 6 26-15"/></g></svg>';
const thoughts = ['MEET WITH ADA', 'SEND THE PROPOSAL', 'BOOK THE DENTIST', 'THE NEXT BIG IDEA', 'CALL THEM BACK', 'REMEMBER THE THING', 'BUY COFFEE', 'MEET WITH ADA', 'ONE MORE THING', 'SEND THE PROPOSAL', 'BOOK THE DENTIST', 'GET IT OUT'];

export const todoistStudy: MotionStudy = {
  id: 'launch-todoist-extreme', title: 'Todoist — get it out', width: 1920, height: 1080, fps: 30, durationFrames: 540,
  reference: { path: '', startSeconds: 0, durationSeconds: 18 },
  html: `
    <div id="tx-backdrop"></div><div id="tx-grid"></div>
    <div id="tx-tornado">${thoughts.map((text, i) => `<div class="tx-strip" id="tx-strip-${i}"><span class="tx-hole"></span>${text}<span class="tx-strip-number">${String(i + 1).padStart(2, '0')}</span></div>`).join('')}</div>
    <div id="tx-hook"><div class="tx-kicker">FOR BUSY INDEPENDENT MINDS</div><div id="tx-too">TOO MUCH</div><div id="tx-mind">ON YOUR MIND?</div><div id="tx-out">GET IT OUT.</div></div>
    <div id="tx-type-label"><span>01 / QUICK ADD</span><strong>TYPE IT<br>OUT.</strong></div>
    <div id="tx-speed-lines">${Array.from({ length: 14 }, (_, i) => `<i id="tx-speed-${i}"></i>`).join('')}</div>
    <div id="tx-app-camera"><div id="tx-app">
      <div class="tx-chrome"><div class="tx-traffic"><i></i><i></i><i></i></div><span class="tx-sidebar">☷</span><span class="tx-chevron">‹</span><span class="tx-chevron">›</span><div class="tx-native-brand">${mark}<span>todoist</span></div><span class="tx-more">···</span></div>
      <div class="tx-inbox-title">Inbox</div>
      <div id="tx-empty-add">${icon('plus')}<span>Add task</span></div>
      <div class="tx-section" id="tx-section-work"><span>›</span><b>Work</b><small>1</small></div><div class="tx-section" id="tx-section-personal"><span>›</span><b>Personal</b><small>4</small></div>
      <div id="tx-composer"><div id="tx-input"><span id="tx-typed"></span><i id="tx-caret"></i></div><div class="tx-description">Description</div>
        <div class="tx-chips"><div id="tx-date-chip" class="tx-native-chip">${icon('date')}<span id="tx-date-text">Date</span></div><div id="tx-priority-chip" class="tx-native-chip">${icon('flag')}<span id="tx-priority-text">Priority</span></div><div class="tx-native-chip tx-deadline">${icon('date')}<span>Deadline</span></div><span class="tx-chip-icon">${icon('label')}</span><span class="tx-chip-icon">${icon('attach')}</span></div>
        <div class="tx-composer-footer"><span class="tx-inbox-chip">${icon('inbox')}Inbox <b>⌄</b></span><div id="tx-send">${icon('arrow')}</div></div>
      </div>
      <div id="tx-result"><div class="tx-p1-circle"></div><div class="tx-task-title">Meet with Ada</div><div class="tx-task-date">${icon('date')}Tomorrow 14:00</div><div class="tx-task-rule"></div></div>
      <div id="tx-result-add">${icon('plus')}<span>Add task</span></div><div id="tx-toast">Task added to Inbox <span>×</span></div>
    </div></div>
    <div id="tx-cursor"><svg viewBox="0 0 48 60" aria-hidden="true"><path d="M5 3L42 32L26 34L37 50L29 56L19 39L8 51Z" fill="#151515" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></div>
    <div id="tx-click-ring"></div>
    <div id="tx-recognition"><div id="tx-rec-date">TOMORROW<span>14:00</span></div><div id="tx-rec-priority">P1<span>PRIORITY</span></div></div>
    <div id="tx-result-type"><span>02 / INBOX</span><strong>IT’S<br>IN.</strong><p>Captured. Dated. Saved.</p></div>
    <div id="tx-bottom-tape"><div id="tx-tape-text">GET IT OUT. &nbsp; GET IT OUT. &nbsp; GET IT OUT. &nbsp; GET IT OUT. &nbsp; GET IT OUT. &nbsp; GET IT OUT.</div></div>
    <div id="tx-paper-match"><div class="tx-paper-label">INBOX <span>P1</span></div><div class="tx-paper-task"><i></i><span>Meet with Ada</span></div><div class="tx-paper-date">Tomorrow 14:00</div><div class="tx-paper-fold"></div></div>
    <div id="tx-payoff"><div id="tx-captured">CAPTURED.</div><div id="tx-carried">NOT CARRIED.</div><div id="tx-headspace">MAKE<br>SPACE.</div></div>
    <div id="tx-word-cascade">${['THINK.', 'TYPE.', 'ADD.'].map((word, i) => `<div id="tx-cascade-${i}">${word}<span> ${word} ${word}</span></div>`).join('')}</div>
    <div id="tx-particles">${Array.from({ length: 28 }, (_, i) => `<i id="tx-particle-${i}"></i>`).join('')}</div>
    <div id="tx-cta"><div class="tx-cta-kicker">MORE HEADSPACE STARTS HERE.</div><div id="tx-brand">${mark}<span>todoist</span></div><div id="tx-cta-button">Start for free <span>↗</span></div><div class="tx-cta-url">todoist.com</div></div>
    <div id="tx-cta-ticker"><div id="tx-cta-ticker-text">THINK IT. TYPE IT. ADD IT. &nbsp; THINK IT. TYPE IT. ADD IT. &nbsp; THINK IT. TYPE IT. ADD IT.</div></div>
    <div id="tx-corner-count">01—03</div>`,
  css: `
    :root{--tx-red:#ff3926;--tx-yellow:#e6ff27;--tx-black:#111012;--tx-paper:#fff9eb}#stage{background:var(--tx-black);font-family:Studio,Arial,sans-serif;isolation:isolate}#stage *{box-sizing:border-box}#stage svg{display:block}#tx-backdrop{position:absolute;inset:-120px;background:var(--tx-red);transform:translateX(2300px)}#tx-grid{position:absolute;inset:0;opacity:.085;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:90px 90px}
    #tx-tornado{position:absolute;inset:0;z-index:2}.tx-strip{position:absolute;left:0;top:0;display:flex;align-items:center;gap:24px;width:610px;height:92px;padding:18px 24px;color:var(--tx-black);background:var(--tx-paper);box-shadow:0 8px 0 #0004;font-size:33px;font-weight:780;letter-spacing:-1.4px;white-space:nowrap;transform-origin:center}.tx-strip:nth-child(3n){background:var(--tx-yellow)}.tx-strip:nth-child(3n+1){background:var(--tx-red);color:#fff}.tx-hole{display:block;flex:none;width:18px;height:18px;background:var(--tx-black);border-radius:50%}.tx-strip-number{margin-left:auto;font-size:18px;font-weight:550;letter-spacing:0}
    #tx-hook{position:absolute;inset:0;z-index:5;color:var(--tx-paper)}.tx-kicker{position:absolute;top:70px;left:88px;font-size:23px;letter-spacing:4px;font-weight:750;color:var(--tx-yellow)}#tx-too{position:absolute;left:70px;top:178px;font-size:262px;line-height:.89;font-weight:930;letter-spacing:-17px;white-space:nowrap}#tx-mind{position:absolute;left:77px;top:450px;font-size:172px;line-height:.98;font-weight:880;letter-spacing:-10px;white-space:nowrap;color:var(--tx-yellow)}#tx-out{position:absolute;left:85px;top:725px;font-size:76px;font-weight:850;letter-spacing:-4px;background:var(--tx-red);padding:4px 24px 12px;transform:rotate(-3deg)}
    #tx-type-label{position:absolute;left:72px;top:88px;z-index:4;color:var(--tx-paper)}#tx-type-label>span,#tx-result-type>span{font-size:22px;letter-spacing:3px;font-weight:700}#tx-type-label strong{display:block;font-size:184px;line-height:.82;letter-spacing:-10px;font-weight:930;margin-top:30px}#tx-speed-lines{position:absolute;inset:0;z-index:3;overflow:hidden}#tx-speed-lines i{position:absolute;height:5px;background:var(--tx-yellow);width:400px;transform-origin:left}
    #tx-app-camera{position:absolute;left:0;top:0;width:1320px;height:740px;z-index:7;transform-origin:0 0}#tx-app{position:absolute;inset:0;background:#fff;color:#282828;border-radius:17px;border:1px solid #e0ddda;box-shadow:0 28px 80px #08040566;overflow:hidden;transform-origin:0 0}.tx-chrome{height:65px;background:#fbfaf8;border-bottom:1px solid #eceae6;display:flex;align-items:center;gap:22px;padding:0 28px;color:#888}.tx-traffic{display:flex;gap:11px;margin-right:18px}.tx-traffic i{width:15px;height:15px;border-radius:50%;background:#d8d4d0}.tx-traffic i:first-child{background:#ef746e}.tx-traffic i:nth-child(2){background:#edc363}.tx-traffic i:nth-child(3){background:#93c681}.tx-sidebar{font-size:34px}.tx-chevron{font-size:36px;line-height:1;color:#aaa}.tx-native-brand{position:absolute;left:580px;display:flex;align-items:center;gap:9px;color:#de483a;font-size:23px;letter-spacing:-.5px;font-weight:750}.tx-native-brand svg{width:27px;height:27px}.tx-more{margin-left:auto;font-size:27px}.tx-inbox-title{position:absolute;left:84px;top:112px;font-size:47px;font-weight:750;letter-spacing:-1px}#tx-empty-add,#tx-result-add{position:absolute;left:84px;top:233px;display:flex;gap:14px;align-items:center;font-size:26px;color:#888}#tx-empty-add svg,#tx-result-add svg{width:27px;height:27px;color:#dc4b3e}.tx-section{position:absolute;left:84px;width:1152px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #eae7e3;padding-bottom:22px;font-size:27px}.tx-section>span{font-size:34px;color:#8e8e8e}.tx-section small{color:#9a9a9a;font-size:22px;font-weight:400}#tx-section-work{top:560px}#tx-section-personal{top:660px}
    #tx-composer{position:absolute;left:84px;top:224px;width:1152px;height:284px;border:1.8px solid #ddd6ce;border-radius:16px;background:#fff;box-shadow:0 6px 24px #36312c08;overflow:hidden}#tx-input{position:absolute;left:25px;top:24px;right:25px;font-size:37px;font-weight:540;letter-spacing:-1.1px;white-space:nowrap}#tx-caret{display:inline-block;width:2px;height:40px;background:#b24a34;vertical-align:-7px;margin-left:2px}.tx-description{position:absolute;top:88px;left:27px;font-size:23px;color:#96928c}.tx-chips{position:absolute;left:25px;top:138px;display:flex;align-items:center;gap:12px;height:45px}.tx-native-chip{height:43px;display:flex;gap:9px;align-items:center;padding:0 13px;border:1px solid #e5e0d9;border-radius:7px;font-size:23px;color:#77736c;white-space:nowrap}.tx-native-chip svg{width:26px;height:26px}.tx-chip-icon{display:block;padding:6px;color:#8b847b}.tx-chip-icon svg{width:26px;height:26px}.tx-composer-footer{position:absolute;left:0;bottom:0;right:0;height:76px;background:#fcfbf8;border-top:1px solid #efebe6;display:flex;align-items:center;padding:0 25px}.tx-inbox-chip{display:flex;gap:11px;align-items:center;font-size:23px;color:#6f6b64}.tx-inbox-chip svg{width:25px;height:25px}.tx-inbox-chip b{font-size:19px;font-weight:400}#tx-send{position:absolute;right:19px;top:11px;background:#d94332;border-radius:50%;width:53px;height:53px;color:white;display:grid;place-items:center;transform-origin:center}#tx-send svg{width:30px;height:30px}
    #tx-result{position:absolute;left:84px;top:219px;width:1152px;height:130px}.tx-p1-circle{position:absolute;top:9px;left:0;width:31px;height:31px;border:2px solid #bd4b40;border-radius:50%;background:transparent}.tx-task-title{position:absolute;top:0;left:52px;font-size:35px;letter-spacing:-.5px}.tx-task-date{position:absolute;left:52px;top:52px;display:flex;align-items:center;gap:7px;font-size:25px;color:#ad8032}.tx-task-date svg{width:23px;height:23px}.tx-task-rule{position:absolute;left:0;right:0;bottom:2px;background:#e9e5df;height:1px}#tx-result-add{top:373px}#tx-toast{position:absolute;left:380px;bottom:36px;background:#272727;color:#fff;border-radius:8px;padding:18px 24px;box-shadow:0 7px 16px #0003;font-size:24px;font-weight:500}#tx-toast span{padding-left:58px;color:#aaa}
    #tx-cursor{position:absolute;left:0;top:0;width:59px;height:73px;z-index:11;filter:drop-shadow(0 4px 2px #0004);transform-origin:5px 3px}#tx-click-ring{position:absolute;width:100px;height:100px;border:9px solid var(--tx-yellow);border-radius:50%;z-index:10;transform-origin:center}
    #tx-recognition{position:absolute;z-index:8;left:80px;top:850px;display:flex;gap:18px;color:#111}#tx-rec-date,#tx-rec-priority{display:flex;align-items:center;gap:26px;background:var(--tx-yellow);padding:15px 28px;font-weight:900;font-size:54px;letter-spacing:-2px;box-shadow:7px 8px 0 #111}#tx-rec-date span{font-weight:580}#tx-rec-priority{background:var(--tx-red);color:#fff}#tx-rec-priority span{font-size:20px;letter-spacing:2px}#tx-result-type{position:absolute;left:70px;top:170px;z-index:6;color:var(--tx-paper)}#tx-result-type strong{display:block;font-size:213px;line-height:.85;letter-spacing:-11px;font-weight:950;margin-top:35px}#tx-result-type p{font-size:27px;letter-spacing:-.8px;max-width:270px;line-height:1.15;margin-top:35px;color:var(--tx-yellow)}
    #tx-bottom-tape{position:absolute;top:1010px;left:-100px;width:2350px;height:100px;transform:rotate(-3deg);z-index:13;background:var(--tx-yellow);color:#111;overflow:hidden}#tx-tape-text{position:absolute;left:0;top:4px;font-size:70px;line-height:1.1;font-weight:950;letter-spacing:-3px;white-space:nowrap}
    #tx-paper-match{position:absolute;left:0;top:0;width:880px;height:310px;background:var(--tx-paper);color:#111;border-radius:4px;z-index:16;box-shadow:14px 18px 0 #111;transform-origin:0 0;overflow:hidden}.tx-paper-label{position:absolute;top:22px;left:34px;right:34px;font-size:21px;letter-spacing:4px;font-weight:800}.tx-paper-label span{float:right;background:#bd4b40;color:#fff;letter-spacing:0;font-size:19px;padding:5px 9px}.tx-paper-task{position:absolute;left:34px;top:103px;display:flex;align-items:center;gap:24px;font-size:65px;letter-spacing:-2.5px;font-weight:650}.tx-paper-task i{width:43px;height:43px;border:3px solid #bd4b40;border-radius:50%;flex:none}.tx-paper-date{position:absolute;left:104px;top:199px;font-size:35px;color:#aa7a25}.tx-paper-fold{position:absolute;right:-1px;bottom:-1px;width:70px;height:70px;background:linear-gradient(135deg,#ece6d9 50%,var(--tx-red) 51%)}
    #tx-payoff{position:absolute;inset:0;z-index:15;color:var(--tx-black);font-weight:950;letter-spacing:-11px}#tx-captured{position:absolute;left:66px;top:74px;font-size:202px;line-height:1}#tx-carried{position:absolute;left:73px;top:828px;font-size:165px;line-height:1;color:var(--tx-paper);letter-spacing:-9px}#tx-headspace{position:absolute;left:76px;top:120px;font-size:326px;line-height:.83;letter-spacing:-22px;color:var(--tx-yellow)}#tx-word-cascade{position:absolute;inset:0;z-index:18;color:var(--tx-black);font-weight:950;letter-spacing:-16px;overflow:hidden}#tx-word-cascade>div{position:absolute;left:55px;font-size:264px;line-height:1;white-space:nowrap}#tx-word-cascade span{color:transparent;-webkit-text-stroke:3px var(--tx-black)}#tx-cascade-0{top:58px}#tx-cascade-1{top:357px}#tx-cascade-2{top:656px}
    #tx-particles{position:absolute;inset:0;z-index:14;pointer-events:none}#tx-particles i{position:absolute;width:18px;height:58px;background:var(--tx-yellow)}#tx-particles i:nth-child(3n){background:var(--tx-paper)}#tx-particles i:nth-child(3n+1){background:var(--tx-red)}#tx-cta{position:absolute;inset:0;color:var(--tx-paper);z-index:21;text-align:center}.tx-cta-kicker{position:absolute;left:0;right:0;top:100px;font-size:27px;font-weight:700;letter-spacing:5px;color:var(--tx-yellow)}#tx-brand{position:absolute;left:0;right:0;top:270px;display:flex;align-items:center;justify-content:center;gap:35px;font-size:204px;font-weight:800;letter-spacing:-11px}#tx-brand svg{width:177px;height:177px;color:var(--tx-red)}#tx-cta-button{position:absolute;left:626px;top:608px;width:668px;height:121px;border-radius:70px;background:var(--tx-red);display:flex;align-items:center;justify-content:center;gap:35px;font-size:57px;font-weight:780;letter-spacing:-2px;box-shadow:8px 8px 0 var(--tx-yellow)}#tx-cta-button span{font-size:68px}.tx-cta-url{position:absolute;left:0;right:0;top:791px;font-size:29px;letter-spacing:2px}#tx-cta-ticker{position:absolute;left:-100px;top:951px;width:2220px;height:110px;background:var(--tx-yellow);transform:rotate(-3deg);z-index:23;overflow:hidden}#tx-cta-ticker-text{white-space:nowrap;font-size:75px;font-weight:950;letter-spacing:-3px;line-height:110px;color:#111}#tx-corner-count{position:absolute;bottom:27px;right:32px;color:#fff;font-size:18px;letter-spacing:3px;z-index:30}
  `,
  script: `
    const txP=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
    const txE=p=>1-Math.pow(1-p,3);
    const txIO=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    const txL=(a,b,p)=>a+(b-a)*p;
    const txQ=id=>document.getElementById(id);
    const txA=(id,a)=>{const el=txQ(id);el.style.opacity=String(Math.max(0,Math.min(1,a)));el.style.visibility=a>0?'visible':'hidden';};
    const txT=(id,t)=>{txQ(id).style.transform=t;};
    const txWindow=(f,a,b,c,d)=>txP(f,a,b)*(1-txP(f,c,d));
    function draw(frame){
      const f=Math.max(0,Math.min(539,frame)),beat=Math.pow(1-(f%11.25)/11.25,2);
      txQ('tx-corner-count').textContent=f<68?'01—03':f<338?'02—03':'03—03';
      const hook=1-txP(f,54,68);txA('tx-hook',hook);txA('tx-tornado',1-txP(f,57,76));
      txT('tx-hook','translate('+(-240*txE(txP(f,54,68)))+'px,'+(-16*txE(txP(f,0,11)))+'px) scale('+(1+.018*beat)+')');
      txT('tx-mind','translateX('+(-24+24*txE(txP(f,0,16)))+'px)');
      txT('tx-out','rotate('+(-3+2*Math.sin(f*.13))+ 'deg) translateX('+(25*txE(txP(f,35,54)))+'px)');
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6+f*.026,r=1+txP(f,48,76)*1.25;
        const x=960+Math.cos(a)*960*r-305,y=540+Math.sin(a)*430*r-46;
        const rot=Math.sin(a)*23+(i%2?8:-8)+f*.32;
        txT('tx-strip-'+i,'translate('+x+'px,'+y+'px) rotate('+rot+'deg)');
      }
      const redEntry=txE(txP(f,58,74));
      txT('tx-backdrop','translateX('+(2100*(1-redEntry))+'px)');
      txQ('tx-backdrop').style.background=f>=405&&f<478?'#e6ff27':'#ff3926';
      txA('tx-backdrop',1-txP(f,473,487));txA('tx-grid',f<68?.45:f>=484?.35:.12);
      txA('tx-type-label',txWindow(f,64,78,107,119));txT('tx-type-label','translateX('+(-110*(1-txE(txP(f,64,80))))+'px)');
      let ax=430,ay=170,as=1.03,ar=0;
      if(f<91){let p=txE(txP(f,60,82));ax=txL(1500,430,p);ay=txL(-520,170,p);as=txL(1.9,1.03,p);ar=txL(-15,0,p);}
      else if(f<119){let p=txIO(txP(f,91,117));ax=txL(430,-44,p);ay=txL(170,-70,p);as=txL(1.03,1.45,p);}
      else if(f<151){let p=txIO(txP(f,125,140));ax=txL(-44,-92,p);ay=txL(-70,-230,p);as=txL(1.45,1.88,p);}
      else if(f<184){let p=txIO(txP(f,162,176));ax=txL(-92,-115,p);ay=txL(-230,-305,p);as=txL(1.88,2.05,p);}
      else if(f<227){let p=txIO(txP(f,184,211));ax=txL(-115,-35,p);ay=txL(-305,-75,p);as=txL(2.05,1.455,p);}
      else if(f<270){let p=txIO(txP(f,230,269));ax=txL(-35,485,p);ay=txL(-75,184,p);as=txL(1.455,1.02,p);ar=-2.5*Math.sin(p*Math.PI);}
      else{let p=txIO(txP(f,315,337));ax=txL(485,370,p);ay=txL(184,107,p);as=txL(1.02,1.28,p);}
      if(f>=333){const p=txE(txP(f,333,350));ax+=1700*p;ar+=13*p;}
      txA('tx-app-camera',txWindow(f,61,70,339,350));txT('tx-app-camera','translate('+ax+'px,'+ay+'px) scale('+as+') rotate('+ar+'deg)');
      const composer=1-txP(f,225,235);txA('tx-composer',composer);txT('tx-composer','translateY('+(-14*txE(txP(f,225,236)))+'px) scale('+(1-.02*txP(f,225,236))+')');
      txA('tx-empty-add',0);
      let typed='';
      if(f>=78&&f<112){typed='Meet with Ada'.slice(0,Math.floor(txP(f,78,108)*13));}
      else if(f>=112&&f<154){typed='Meet with Ada'+' tomorrow at 14'.slice(0,Math.floor(txP(f,112,150)*15));}
      else if(f>=154){typed='Meet with Ada tomorrow at 14'+' p1'.slice(0,Math.floor(txP(f,154,166)*3));}
      txQ('tx-typed').textContent=typed;txA('tx-caret',f>=78&&f<225?1:0);
      const dateSeen=f>=135,prioritySeen=f>=168;
      txQ('tx-date-text').textContent=dateSeen?(f>=153?'Tomorrow 14:00':'Tomorrow'):'Date';
      txQ('tx-date-chip').style.color=dateSeen?'#ad8032':'#77736c';
      txQ('tx-date-chip').style.borderColor=dateSeen?'#d9c89f':'#e5e0d9';
      txQ('tx-priority-text').textContent=prioritySeen?'P1':'Priority';
      txQ('tx-priority-chip').style.color=prioritySeen?'#bd4b40':'#77736c';
      txQ('tx-priority-chip').style.borderColor=prioritySeen?'#d5a6a0':'#e5e0d9';
      txT('tx-date-chip','scale('+(1+(dateSeen?.13*Math.sin(Math.PI*txP(f,135,147)):0))+')');
      txT('tx-priority-chip','scale('+(1+(prioritySeen?.15*Math.sin(Math.PI*txP(f,168,180)):0))+')');
      txT('tx-send','scale('+(1-.16*Math.sin(Math.PI*txP(f,222,230)))+')');
      txA('tx-result',txP(f,231,239));txT('tx-result','translateY('+(24*(1-txE(txP(f,231,244))))+'px)');
      txA('tx-result-add',txP(f,239,250));txA('tx-toast',txWindow(f,248,258,328,336));
      txT('tx-section-work','translateY('+(-115*txE(txP(f,232,270)))+'px)');txT('tx-section-personal','translateY('+(-115*txE(txP(f,232,270)))+'px)');
      const pointer=txWindow(f,197,205,229,237),travel=txIO(txP(f,197,220));
      const targetX=ax+(84+1106)*as,targetY=ay+(224+246)*as;
      txA('tx-cursor',pointer);txT('tx-cursor','translate('+txL(1895,targetX-4,travel)+'px,'+txL(905,targetY-2,travel)+'px) scale('+(1-.13*Math.sin(Math.PI*txP(f,222,230)))+')');
      const click=txP(f,224,238);txA('tx-click-ring',f>=224&&f<238?1-click:0);txT('tx-click-ring','translate('+(targetX-50)+'px,'+(targetY-50)+'px) scale('+(0.5+2.6*click)+')');
      txA('tx-recognition',txWindow(f,136,144,217,227));
      txA('tx-rec-date',txP(f,136,143));txT('tx-rec-date','translateY('+(100*(1-txE(txP(f,136,146))))+'px) rotate(-3deg)');
      txA('tx-rec-priority',txP(f,169,176));txT('tx-rec-priority','translateY('+(120*(1-txE(txP(f,169,179))))+'px) rotate(3deg)');
      txA('tx-result-type',txWindow(f,247,265,331,342));txT('tx-result-type','translateX('+(-160*(1-txE(txP(f,247,265))))+'px)');
      txA('tx-bottom-tape',txWindow(f,74,86,476,486));txT('tx-tape-text','translateX('+(-((f*10)%810))+'px)');
      for(let i=0;i<14;i++){
        txT('tx-speed-'+i,'translate('+(((f*75+i*269)%2500)-400)+'px,'+(105+i*70)+'px) rotate(-7deg) scaleX('+(1+(i%3)*.35)+')');
      }
      txA('tx-speed-lines',(txWindow(f,56,62,85,92)+txWindow(f,220,225,241,249)+txWindow(f,329,337,353,360))*.8);
      let px=560,py=395,ps=1,pr=-4;
      if(f<362){let p=txIO(txP(f,329,362));px=txL(571,514,p);py=txL(407,374,p);ps=txL(.68,1,p);pr=txL(0,-4,p);}
      else if(f<404){const p=txP(f,362,403);px=514+26*p;py=374-13*p;pr=-4+2*p;}
      else{let p=txE(txP(f,403,422));px=540+1550*p;py=361-560*p;pr=-2+24*p;}
      txA('tx-paper-match',txWindow(f,330,340,414,423));txT('tx-paper-match','translate('+px+'px,'+py+'px) scale('+ps+') rotate('+pr+'deg)');
      txA('tx-payoff',txWindow(f,334,341,407,417));
      txA('tx-captured',1-txP(f,402,409));txT('tx-captured','translateX('+(-200*(1-txE(txP(f,336,348))))+'px)');
      txA('tx-carried',1-txP(f,402,409));txT('tx-carried','translateX('+(350*(1-txE(txP(f,346,361))))+'px)');
      txA('tx-headspace',0);
      txA('tx-word-cascade',txWindow(f,404,410,474,486));
      for(let i=0;i<3;i++){const start=405+i*11.25,p=txE(txP(f,start,start+10));const run=txP(f,start+10,476);txT('tx-cascade-'+i,'translateX('+((1-p)*((i%2)?-1600:1600)-(i%2?110:230)*run)+'px)');}
      const burst=f<337?225:f<483?338:484,age=f-burst,particleWindow=age>=0&&age<42?1-txP(age,28,42):0;
      txA('tx-particles',particleWindow);
      for(let i=0;i<28;i++){const a=i*2.399963229728653,velocity=11+(i%7)*2.4;const x=(burst===225?1696:960)+Math.cos(a)*age*velocity;const y=(burst===225?609:540)+Math.sin(a)*age*velocity+age*age*.12;txT('tx-particle-'+i,'translate('+x+'px,'+y+'px) rotate('+(i*47+age*(i%2?7:-9))+'deg) scale('+(0.8+(i%4)*.23)+')');}
      txA('tx-cta',txP(f,478,487));txA('tx-cta-ticker',txP(f,482,489));
      txT('tx-brand','translateY('+(90*(1-txE(txP(f,477,489))))+'px) scale('+(1+.008*beat)+')');
      txT('tx-cta-button','translateY('+(90*(1-txE(txP(f,481,494))))+'px) scale('+(1+.012*beat)+') rotate('+(.45*Math.sin(f*.16))+'deg)');
      txT('tx-cta-ticker-text','translateX('+(-((f-478)*9))+'px)');
    }
  `,
  reviewFrames: [0, 11, 23, 45, 55, 68, 82, 106, 117, 135, 153, 168, 193, 220, 225, 239, 270, 301, 329, 345, 368, 397, 416, 438, 471, 492, 516, 539],
  notes: [
    'Manually authored extreme art-direction test, not an automatic URL-engine output. Original launch-todoist.ts is preserved.',
    '18 seconds, 30 fps, deterministic 160 BPM motion grid; no full-screen strobe, CSS animation, timers, randomness or source screenshot pixels.',
    'Native desktop UI follows the preserved official Todoist Quick Add video: typed Meet with Ada tomorrow at 14 p1, recognized date/P1, clicked red Add arrow, then the same task in Inbox with Tomorrow 14:00.',
    'P1 is shown as an unfilled red priority circle, never as completion. Tomorrow stays in Inbox; no Today claim. Editorial surrounding strips are not added product tasks.',
    'Readably held result F270–337; CTA F484–539. Major visual accents F0/68/135/225/270/338/405/484.',
    'Source/provenance: .local/launch-todoist-sourcepack-20261003, official public desktop demonstration. Simplified HTML/SVG reconstruction with illustrative task content; no account interaction.',
  ],
};
