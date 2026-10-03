import type { MotionStudy } from './types';
import { todoistStudy as motionStudy } from './launch-todoist-motion';

/** Original ad-study hook; the approved action film remains an unchanged source. */
export const todoistStudy: MotionStudy = {
  ...motionStudy,
  id: 'todoist-hook',
  title: 'Todoist — don’t keep it in your head',
  reviewFrames: [0, 8, 15, 30, 42, 53, 60, 75, 90, 105, 129, 180, 229, 248, 269, 291, 306, 312, 318, 337, 364, 388, 414, 465, 492, 539],
  notes: [
    ...motionStudy.notes,
    'Hook iteration informed by interface-grammarly-paper: its observed 0–0.5s foreground obstruction clears to the person and relevant writing problem. Here original typography clears to a real task sentence; no reference footage, faces, copy, or soundtrack is reused.',
    'Also informed by interface-figma-options: observed 0–2.5s outcome object and 2.5–4.5s cursor-led entry into its editable UI. The same four Todoist word objects persist from the opening thought into Quick Add, instead of cutting to an unrelated title card.',
    'F0 has a complete readable problem statement. F0–15 slides the actual task strip 100px into place while the headline stays fixed; F36–55 clears the heading, F35–86 carries the same sentence into Quick Add. Native input replaces those identical landed word objects at F91.',
    'The 18-second duration, actual task/date/P1/save/result sequence, brand palette and late CTA stay the same. Composer border remains the rewind-stable SVG from the approved motion study. The saved result is still in Inbox, and its red priority circle is not a completed checkmark.',
    'After the actual Add click at F289, the macro composer holds through F301 and cuts at F302 to the fully settled saved Inbox row. This direct result cut replaces the pale morph; task text, Tomorrow 14:00 and the unfilled P1 circle persist. This is editorial staging of the documented save, not a claim about literal native animation.',
    'Research is sampled-frame visual criticism, not an ad-performance or listening assessment. This is manually authored creative work, not automatic URL-engine acceptance.',
  ],
  html: `${motionStudy.html}
    <div id="th-paper" aria-hidden="true"><svg viewBox="0 0 1710 150" preserveAspectRatio="none"><rect x=".5" y=".5" width="1709" height="149" rx="11.5" fill="#fff" stroke="#ded8d0"/></svg></div>
    <div id="th-hook"><div id="th-first">Don’t keep it</div><div id="th-second">in your head.<svg viewBox="0 0 1000 18" preserveAspectRatio="none" aria-hidden="true"><path d="M4 11C260 2 675 3 996 8" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg></div></div>
    <div id="th-caption">MAKE ROOM FOR WHAT MATTERS.</div>
  `,
  css: `${motionStudy.css}
    #th-hook{position:absolute;left:116px;top:201px;z-index:12;pointer-events:none;font-size:147px;line-height:1.03;letter-spacing:-7.5px;font-weight:640;transform-origin:0 0;color:#25221e}
    #th-first,#th-second{white-space:nowrap;transform-origin:left center}#th-second{position:relative;color:#de483a}#th-second>svg{position:absolute;left:3px;right:0;bottom:-17px;width:100%;height:18px;transform-origin:left center}
    #th-paper{position:absolute;left:0;top:0;width:1710px;height:150px;transform-origin:left top;z-index:8;box-shadow:0 14px 38px #47382a10;border-radius:12px}#th-paper>svg{width:100%;height:100%}
    #th-caption{position:absolute;left:120px;top:849px;font-size:21px;letter-spacing:2.5px;font-weight:490;color:#858078;z-index:12}
  `,
  script: `${motionStudy.script}
    const thBaseDraw=draw;
    draw=function(frame){
      const f=Math.max(0,Math.min(539,frame));
      // Retain the completed Add click, then cut directly to its fully settled result.
      // Both sides are complete source-study states, with no ghosted interpolation.
      thBaseDraw(f>=302&&f<328?328:f>=296&&f<302?296:f);
      const travel=tmS(tmP(f,35,86)),clear=tmE(tmP(f,36,55)),arrival=tmE(tmP(f,0,15));
      tmO('tm-thought-label',0);tmO('tm-intro-foot',0);
      tmO('th-hook',1-clear);tmM('th-hook',0,-94*clear);
      tmM('th-first',0,0);tmM('th-second',0,0);
      tmQ('th-second').querySelector('svg').style.transform='scaleX('+(.14+.86*tmE(tmP(f,0,19)))+')';
      tmO('th-caption',1-tmP(f,27,45));tmM('th-caption',0,8*(1-tmE(tmP(f,0,18))));
      const surface=tmQ('tm-composer-surface').getBoundingClientRect();
      tmO('th-paper',1-tmP(f,62,80));
      tmM('th-paper',tmL(106-100*(1-arrival),surface.x,travel),tmL(613+34*(1-arrival),surface.y,travel));
      tmQ('th-paper').style.width=tmL(1710,surface.width,travel)+'px';
      tmQ('th-paper').style.height=tmL(150,surface.height,travel)+'px';
      let left=151;
      for(let i=0;i<4;i++){
        const word=tmQ('tm-word-'+i),target=tmQ('tm-native-'+i).getBoundingClientRect();
        if(f<91){
          word.style.fontSize=tmL(70,44,travel)+'px';word.style.letterSpacing=tmL(-2.5,-1.25,travel)+'px';word.style.fontWeight=String(tmL(520,480,travel));word.style.lineHeight='1.2';
          word.style.color=i===1&&f<72?'#de483a':'#25221e';
          tmM('tm-word-'+i,tmL(left-100*(1-arrival),target.x,travel),tmL(648+34*(1-arrival),target.y,travel));
          // The starting row uses fixed source-word geometry, so later word positions do not depend on seek history.
          left+=[478,333,160,70][i]+22;
        }
      }
      tmQ('tm-window').style.clipPath='none';
    };
  `,
};
