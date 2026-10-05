import type { MotionStudy } from './types';

const icon = (name: string) => {
  const paths: Record<string, string> = {
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
    flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
    inbox: '<path d="M4 4h16v16H4zM4 14h5l2 3h2l2-3h5"/>',
    arrow: '<path d="M4 12h16M13 5l7 7-7 7"/>',
    up: '<path d="M12 20V4M5 11l7-7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.plus}</svg>`;
};
const mark = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor"/><g stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l10 6 26-15M15 31l10 6 26-15M15 43l10 6 26-15"/></g></svg>';

function createTodoistSocial(feed: boolean): MotionStudy {
  const l = feed
    ? { height: 1350, brand: 125, heading: 234, note: 605, laptop: 825, editor: 513, title: 565, tokens: 644, chips: 756, footer: 914, result: 554, resultTitle: 674, resultDate: 750, benefit: 1030, endHeading: 250, endBrand: 650, cta: 900, url: 1030 }
    : { height: 1920, brand: 312, heading: 425, note: 785, laptop: 1018, editor: 708, title: 759, tokens: 839, chips: 952, footer: 1108, result: 747, resultTitle: 867, resultDate: 943, benefit: 1140, endHeading: 443, endBrand: 805, cta: 1040, url: 1165 };
  return {
    id: feed ? 'todoist-social-feed' : 'todoist-social',
    title: 'Todoist — laptop closed, brain still open',
    width: 1080, height: l.height, fps: 30, durationFrames: 540,
    reference: { path: '', startSeconds: 0, durationSeconds: 18 },
    reviewFrames: [0, 8, 18, 38, 64, 65, 84, 99, 100, 106, 118, 125, 129, 144, 150, 159, 164, 184, 202, 208, 216, 230, 246, 263, 286, 303, 330, 365, 421, 452, 474, 539],
    notes: [
      'Original manually authored social creative, not an official Todoist ad or automatic URL-generation acceptance. 18 seconds, 30fps. No performance claim.',
      'Official current sources checked October 5, 2026: https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz and https://www.todoist.com/help/todoist/features/set-a-priority-in-todoist-Wy82Jp. Natural-language dates/times and p1 are documented on Beginner. https://www.todoist.com/ uses Start for free. Task and client situation are illustrative.',
      'Observed official-site palette retained from the prior captured brand evidence: red #DE483A, ink #25221E, near-white #FEFDFC. Functional priority red #BD4B40 follows the preserved official source. Warm grays are neutral. Local Geist approximates the typography; no claim to be the original Graphik font.',
      'Laptop closed. Brain still open. is an audience situation, not a health claim. The same Send proposal task persists from the intrusive thought, through typed tomorrow at 9am p1, into saved Inbox. An empty red priority circle never becomes a completion check. No notification/reminder or automatic sending is claimed.',
      'F0–64 interruption hook; F65–99 same task enters Quick Add; F100–129 date/time resolves into date control; F144–164 p1 resolves into priority control; F184–208 pointer and decisive Add press; F216 complete saved task; F246 Scheduled proof; F286 Prioritized proof; F330 Off your mind consequence; F422–539 brand and Start for free CTA.',
      'Dramatic contrast: fast intrusion and closing lid, readable pause, causal token flights, one click and immediate complete result, restrained hold, then one directional exit. No flashing, decorative swarms, unrelated metrics, or repetitive camera zooms.',
      feed ? 'Native 1080×1350 feed arrangement: separate card, typography and CTA coordinates; not a crop of the Reels film. Essential content constrained to x80–1000/y110–1200.' : 'Native 1080×1920 vertical arrangement. Essential content constrained to x80–1000/y290–1230, deliberately clear of platform header/footer controls. Decorative paper/laptop may extend beyond it.',
      'Every draw assigns every dynamic value from frame alone. No CSS animations, timers, random state, asynchronous media, or source pixels. Token flights are editorial explanations of the documented parse and save, not literal interface recordings.',
    ],
    html: `
      <div id="ts-paper"></div><div id="ts-margin-top"></div><div id="ts-margin-bottom"></div>
      <div id="ts-brand">${mark}<span>todoist</span></div>
      <div id="ts-hook" class="ts-headline"><div>Laptop closed.</div><strong>Brain still open.</strong></div>
      <div id="ts-laptop"><div id="ts-screen"><div class="ts-screen-line"></div><div class="ts-screen-line short"></div><div class="ts-screen-line"></div></div><div id="ts-base"><i></i></div></div>
      <div id="ts-thought-label">ONE MORE THING.</div>
      <div id="ts-input-panel"><svg viewBox="0 0 840 470" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="838" height="468" rx="23" fill="#fff" stroke="#ddd6ce" stroke-width="2"/></svg></div>
      <div id="ts-input-title">Send proposal</div>
      <div id="ts-input-date">tomorrow at 9am</div><div id="ts-input-priority">p1</div>
      <div id="ts-edit-heading" class="ts-headline">Capture it<br>in one sentence.</div>
      <div id="ts-quick-label">QUICK ADD</div>
      <div id="ts-date-chip" class="ts-chip">${icon('calendar')}<span id="ts-date-value">Date</span></div>
      <div id="ts-priority-chip" class="ts-chip">${icon('flag')}<span id="ts-priority-value">Priority</span></div>
      <div id="ts-edit-footer"><span>${icon('inbox')}Inbox</span><div id="ts-add">${icon('up')}</div></div>
      <div id="ts-date-flight">tomorrow at 9am</div><div id="ts-priority-flight">p1</div>
      <div id="ts-cursor"><svg viewBox="0 0 48 60" aria-hidden="true"><path d="M5 3L42 32L26 34L37 50L29 56L19 39L8 51Z" fill="#25221e" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></div>
      <div id="ts-click-ring"></div>
      <div id="ts-saved-heading" class="ts-headline"><div>Captured.</div><strong id="ts-scheduled-heading">Scheduled.</strong></div>
      <div id="ts-inbox-panel"><div class="ts-inbox-top">${icon('inbox')}<b>Inbox</b><span>1</span></div><div class="ts-inbox-line"></div><div id="ts-add-task">${icon('plus')}Add task</div></div>
      <div id="ts-saved-title"><i id="ts-open-circle"></i><span>Send proposal</span></div>
      <div id="ts-saved-date">${icon('calendar')}<span>Tomorrow 09:00</span></div>
      <div id="ts-proof-priority">${icon('flag')}<span>P1</span></div>
      <div id="ts-consequence">Off your mind.</div>
      <div id="ts-end"><div id="ts-end-heading" class="ts-headline">Get tomorrow<br><strong>out of your head.</strong></div><div id="ts-end-brand">${mark}<span>todoist</span></div><div id="ts-cta">Start for free ${icon('arrow')}</div><div id="ts-url">todoist.com</div></div>
    `,
    css: `
      #stage{background:#fefdfc;color:#25221e;font-family:Studio,Arial,sans-serif;isolation:isolate}#stage svg{display:block}#ts-paper{position:absolute;inset:0;background:linear-gradient(150deg,#fefdfc 35%,#f5f1eb 100%)}#ts-margin-top,#ts-margin-bottom{position:absolute;left:-200px;width:1480px;height:2px;background:#e7e2dc;transform:rotate(-8deg)}#ts-margin-top{top:${feed ? -25 : 155}px}#ts-margin-bottom{top:${feed ? 1300 : 1520}px}
      #ts-brand{position:absolute;left:112px;top:${l.brand}px;display:flex;align-items:center;gap:15px;color:#de483a;font-size:48px;font-weight:720;letter-spacing:-1.6px}#ts-brand svg{width:48px;height:48px}.ts-headline{position:absolute;left:110px;top:${l.heading}px;width:870px;font-size:${feed ? 86 : 89}px;line-height:1.04;font-weight:600;letter-spacing:-4.7px}.ts-headline strong{font-weight:640;color:#de483a}#ts-hook div,#ts-hook strong{display:block;white-space:nowrap}#ts-hook{z-index:12}
      #ts-laptop{position:absolute;left:165px;top:${l.laptop}px;width:750px;height:230px;perspective:1500px;z-index:1}#ts-screen{position:absolute;left:80px;top:-240px;width:590px;height:270px;background:#eae5dd;border:10px solid #6a655e;border-radius:20px 20px 6px 6px;transform-origin:center bottom;overflow:hidden;box-shadow:0 15px 26px #25221e12}.ts-screen-line{height:9px;border-radius:5px;background:#d0c9bf;margin:37px 35px 0;width:430px}.ts-screen-line.short{width:230px;margin-top:24px}.ts-screen-line:last-child{margin-top:24px;width:350px}#ts-base{position:absolute;left:0;top:31px;width:750px;height:17px;border-radius:2px 2px 35px 35px;background:#aaa399;border-bottom:5px solid #7e776e}#ts-base i{position:absolute;left:294px;width:160px;height:5px;background:#7e776e;border-radius:0 0 10px 10px}
      #ts-thought-label{position:absolute;left:160px;top:${l.note - 55}px;font-size:32px;letter-spacing:2.2px;font-weight:590;color:#726a61;z-index:8}#ts-input-panel{position:absolute;left:120px;top:0;width:840px;height:470px;border-radius:24px;box-shadow:0 24px 60px #47382a18;transform-origin:420px 130px;z-index:3}#ts-input-panel>svg{width:100%;height:100%}
      #ts-input-title{position:absolute;left:160px;top:0;font-size:61px;line-height:1.1;letter-spacing:-2px;font-weight:610;transform-origin:left top;z-index:8;white-space:nowrap}#ts-input-date,#ts-input-priority{position:absolute;left:160px;top:0;font-size:47px;line-height:1.2;letter-spacing:-1.35px;color:#de483a;font-weight:480;z-index:8;transform-origin:left top;white-space:nowrap}#ts-input-priority{left:601px;color:#a34c41}#ts-edit-heading{z-index:10}#ts-quick-label{position:absolute;left:158px;top:${l.editor - 46}px;font-size:30px;letter-spacing:2.4px;font-weight:600;color:#726a61;z-index:7}
      .ts-chip{position:absolute;top:${l.chips}px;left:160px;height:68px;display:flex;align-items:center;gap:12px;padding:0 16px;border:2px solid #e1dcd5;border-radius:11px;font-size:40px;line-height:1;letter-spacing:-1px;white-space:nowrap;color:#797268;background:#fff;z-index:8;transform-origin:left center}.ts-chip svg{width:37px;height:37px;flex:none}#ts-date-chip{width:449px}#ts-priority-chip{left:658px;width:220px}
      #ts-edit-footer{position:absolute;left:121px;top:${l.footer - 51}px;width:838px;height:100px;background:#fcfbf9;border-top:2px solid #eee9e2;border-radius:0 0 22px 22px;z-index:5}#ts-edit-footer>span{position:absolute;left:39px;top:26px;display:flex;align-items:center;gap:14px;font-size:38px;color:#797268}#ts-edit-footer>span svg{width:38px;height:38px}#ts-add{position:absolute;right:29px;top:11px;width:76px;height:76px;display:grid;place-items:center;background:#d94332;color:#fff;border-radius:50%;transform-origin:center}#ts-add svg{width:43px;height:43px}#ts-date-flight,#ts-priority-flight{position:absolute;left:0;top:0;font-size:47px;line-height:1.2;font-weight:480;letter-spacing:-1.35px;white-space:nowrap;color:#de483a;z-index:14;transform-origin:left top}
      #ts-cursor{position:absolute;left:0;top:0;width:49px;height:62px;z-index:21;transform-origin:5px 3px;filter:drop-shadow(0 2px 2px #0002)}#ts-click-ring{position:absolute;left:845px;top:${l.footer - 50}px;width:76px;height:76px;border:4px solid #de483a;border-radius:50%;z-index:20;transform-origin:center}
      #ts-saved-heading{z-index:10}#ts-saved-heading strong{display:block}#ts-inbox-panel{position:absolute;left:120px;top:${l.result}px;width:840px;height:335px;background:#fff;border:2px solid #e3ddd6;border-radius:23px;box-shadow:0 14px 42px #47382a0a;z-index:3}.ts-inbox-top{position:absolute;left:38px;right:38px;top:29px;display:flex;align-items:center;gap:15px;font-size:40px}.ts-inbox-top svg{width:35px;height:35px;color:#6e685e}.ts-inbox-top b{font-weight:640;letter-spacing:-1px}.ts-inbox-top>span{font-size:31px;color:#92897e}.ts-inbox-line{position:absolute;left:38px;right:38px;top:258px;height:1px;background:#e7e2dc}#ts-add-task{position:absolute;left:38px;top:278px;display:flex;align-items:center;gap:15px;font-size:33px;color:#888074}#ts-add-task svg{width:30px;height:30px;color:#de483a}
      #ts-saved-title{position:absolute;left:159px;top:${l.resultTitle}px;display:flex;align-items:center;gap:23px;font-size:57px;line-height:1.15;letter-spacing:-1.9px;font-weight:530;z-index:8}#ts-open-circle{width:37px;height:37px;border:3px solid #bd4b40;border-radius:50%;background:#fff;display:block;flex:none}#ts-saved-date{position:absolute;left:220px;top:${l.resultDate}px;display:flex;align-items:center;gap:12px;color:#a66d31;font-size:39px;letter-spacing:-.8px;z-index:8}#ts-saved-date svg{width:34px;height:34px}#ts-proof-priority{position:absolute;left:749px;top:${l.resultDate}px;display:flex;align-items:center;gap:10px;color:#bd4b40;font-size:39px;z-index:8}#ts-proof-priority svg{width:35px;height:35px}#ts-consequence{position:absolute;left:111px;top:${l.benefit}px;font-size:70px;line-height:1.03;letter-spacing:-3px;font-weight:600;color:#de483a;z-index:12}
      #ts-end{position:absolute;inset:0;background:#fefdfc;z-index:30}#ts-end-heading{top:${l.endHeading}px;font-size:86px;letter-spacing:-4.4px;line-height:1.06}#ts-end-brand{position:absolute;left:113px;top:${l.endBrand}px;display:flex;align-items:center;gap:20px;color:#de483a;font-size:109px;line-height:1;font-weight:720;letter-spacing:-4.3px}#ts-end-brand svg{width:95px;height:95px}#ts-cta{position:absolute;left:113px;top:${l.cta}px;width:602px;height:104px;background:#de483a;border-radius:16px;color:#fff;display:flex;align-items:center;justify-content:center;gap:28px;font-size:49px;font-weight:570;letter-spacing:-1.1px}#ts-cta svg{width:40px;height:40px}#ts-url{position:absolute;left:114px;top:${l.url}px;font-size:37px;letter-spacing:.2px;color:#756d62}
    `,
    script: `
      const tsL=${JSON.stringify(l)};
      const tsQ=id=>document.getElementById(id),tsP=(f,a,b)=>Math.max(0,Math.min(1,(f-a)/(b-a))),tsMix=(a,b,p)=>a+(b-a)*p,tsE=p=>1-Math.pow(1-p,4),tsS=p=>p*p*(3-2*p);
      const tsO=(id,a)=>{const el=tsQ(id);el.style.opacity=String(Math.max(0,Math.min(1,a)));el.style.visibility=a>0?'visible':'hidden';};
      const tsM=(id,x=0,y=0,s=1,r=0)=>{tsQ(id).style.transform='translate('+x+'px,'+y+'px) scale('+s+') rotate('+r+'deg)';};
      function draw(frame){
        const f=Math.max(0,Math.min(539,frame)),arrive=tsE(tsP(f,0,13)),lift=tsS(tsP(f,65,84)),end=tsE(tsP(f,422,444));
        const editor=f>=65&&f<216,saved=f>=216&&f<444;
        tsO('ts-brand',1-end);tsM('ts-brand');
        tsO('ts-hook',1-tsE(tsP(f,54,65)));tsM('ts-hook',0,-35*tsE(tsP(f,54,65)));
        tsO('ts-laptop',1-tsP(f,53,65));tsM('ts-laptop',0,0);tsQ('ts-screen').style.transform='rotateX('+(-82*tsE(tsP(f,0,20)))+'deg)';
        tsO('ts-thought-label',1-tsP(f,54,65));tsM('ts-thought-label',0,10*(1-arrive));
        tsO('ts-input-panel',f<216?1:0);tsM('ts-input-panel',-64*(1-arrive),tsMix(tsL.note,tsL.editor,lift),1,-5*(1-arrive));tsQ('ts-input-panel').style.height=tsMix(225,470,lift)+'px';
        tsO('ts-input-title',f<216?1:0);tsM('ts-input-title',-64*(1-arrive),tsMix(tsL.note+42,tsL.title,lift),1,-3*(1-arrive));
        tsO('ts-input-date',f<100?1:0);tsM('ts-input-date',-64*(1-arrive),tsMix(tsL.note+125,tsL.tokens,lift),1,-3*(1-arrive));
        tsO('ts-input-priority',f<144?1:0);tsM('ts-input-priority',-64*(1-arrive),tsMix(tsL.note+125,tsL.tokens,lift),1,-3*(1-arrive));
        tsO('ts-edit-heading',editor?1:0);tsM('ts-edit-heading',0,16*(1-tsE(tsP(f,65,76))));
        tsO('ts-quick-label',editor?tsP(f,66,81):0);tsM('ts-quick-label');
        const controls=editor?tsP(f,72,88):0,dateReady=f>=129,priorityReady=f>=164;
        tsO('ts-date-chip',controls);tsM('ts-date-chip',0,7*(1-tsE(tsP(f,122,133))));tsQ('ts-date-chip').style.color=dateReady?'#a66d31':'#797268';tsQ('ts-date-chip').style.borderColor=dateReady?'#dbc9ae':'#e1dcd5';tsQ('ts-date-value').textContent=dateReady?'Tomorrow 09:00':'Date';
        tsO('ts-priority-chip',controls);tsM('ts-priority-chip',0,7*(1-tsE(tsP(f,158,170))));tsQ('ts-priority-chip').style.color=priorityReady?'#bd4b40':'#797268';tsQ('ts-priority-value').textContent=priorityReady?'P1':'Priority';
        // Each token has one visible owner, and its destination clears before landing.
        tsO('ts-date-value',f>=115&&f<129?0:1);tsO('ts-priority-value',f>=151&&f<164?0:1);
        tsO('ts-edit-footer',controls);tsM('ts-edit-footer');
        const dateFlight=tsS(tsP(f,100,129));tsO('ts-date-flight',f>=100&&f<129?1:0);tsM('ts-date-flight',tsMix(160,222,dateFlight),tsMix(tsL.tokens,tsL.chips+12,dateFlight)-42*Math.sin(Math.PI*dateFlight),tsMix(1,.82,dateFlight));
        const priorityFlight=tsS(tsP(f,144,164));tsO('ts-priority-flight',f>=144&&f<164?1:0);tsM('ts-priority-flight',tsMix(601,722,priorityFlight),tsMix(tsL.tokens,tsL.chips+12,priorityFlight)-43*Math.sin(Math.PI*priorityFlight),tsMix(1,.83,priorityFlight));
        const click=tsP(f,202,208);tsM('ts-add',0,0,f>=202&&f<208?1-.12*Math.sin(Math.PI*click):1);const cursor=tsE(tsP(f,184,202));tsO('ts-cursor',f>=184&&f<215?1:0);tsM('ts-cursor',tsMix(985,883,cursor),tsMix(tsL.footer+110,tsL.footer-10,cursor),1);
        tsO('ts-click-ring',f>=204&&f<215?1-tsP(f,204,215):0);tsM('ts-click-ring',0,0,1+tsP(f,204,215)*.6);
        tsO('ts-inbox-panel',saved?1:0);tsM('ts-inbox-panel',0,0);
        tsO('ts-saved-title',saved?1:0);tsM('ts-saved-title',0,0);tsO('ts-saved-date',saved?1:0);tsM('ts-saved-date',0,0);tsO('ts-proof-priority',saved?1:0);tsM('ts-proof-priority',0,0);
        tsO('ts-saved-heading',saved?1:0);tsM('ts-saved-heading',0,0);tsO('ts-scheduled-heading',tsE(tsP(f,246,255)));tsM('ts-scheduled-heading',0,18*(1-tsE(tsP(f,246,255))));
        tsQ('ts-consequence').textContent=f<330?'Prioritized.':'Off your mind.';const payoff=f<330?tsE(tsP(f,286,297))*(1-tsP(f,322,330)):tsE(tsP(f,330,341));tsO('ts-consequence',saved?payoff:0);tsM('ts-consequence',0,18*(1-tsE(tsP(f,f<330?286:330,f<330?297:341))));
        tsO('ts-end',f>=422?1:0);tsM('ts-end',1080*(1-end),0);tsM('ts-end-heading');tsM('ts-end-brand');tsM('ts-cta',0,13*(1-tsE(tsP(f,445,461))));tsM('ts-url');
      }
    `,
  };
}

export const todoistStudy = createTodoistSocial(false);
export const todoistFeedStudy = createTodoistSocial(true);
