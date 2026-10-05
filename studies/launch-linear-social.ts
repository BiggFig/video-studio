import type { MotionStudy } from './types';

const mark = (id: string) => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="32" cy="32" r="29"/></clipPath></defs><g clip-path="url(#${id})" fill="currentColor"><path d="M3 3h58v58H3z"/><path d="M-9 15L49 73M-9 26L38 73M-9 37L27 73M-9 48L16 73" stroke="var(--mark-cut,#08090a)" stroke-width="4.8"/></g></svg>`;
const arrow = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 16h22M18 7l9 9-9 9"/></svg>';
const chevron = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m8 12 8 8 8-8"/></svg>';
const branch = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="8" cy="6" r="3"/><circle cx="24" cy="9" r="3"/><circle cx="8" cy="26" r="3"/><path d="M8 9v14M24 12c0 9-16 2-16 11"/></svg>';

/** Two explicit placement layouts. All text is authored DOM, never a cropped desktop recording. */
function makeLinearSocial(feed: boolean): MotionStudy {
  const L = feed ? {
    height: 1350, brandY: 124, titleY: 230, hookSize: 88,
    issueY: 570, issueHeight: 478, issueTitleY: 92, detailsY: 257, ownerY: 357,
    issueTitle: 'Search skips<br>archived issues', draftY: 643, draftHeight: 438,
    resultIssueY: 500, proofY: 617, ctaY: 990, footY: 1150,
    closeY: 320, closeSize: 106,
  } : {
    height: 1920, brandY: 304, titleY: 404, hookSize: 86,
    issueY: 742, issueHeight: 360, issueTitleY: 84, detailsY: 223, ownerY: 253,
    issueTitle: 'Search skips<br>archived issues', draftY: 800, draftHeight: 322,
    resultIssueY: 662, proofY: 744, ctaY: 1036, footY: 1180,
    closeY: 512, closeSize: 106,
  };
  return {
    id: `linear-social-${feed ? 'feed' : 'reels'}`,
    title: `Linear — keep the context (${feed ? '4:5 feed' : '9:16 Reels'})`,
    width: 1080, height: L.height, fps: 30, durationFrames: 540,
    reference: { path: '', startSeconds: 0, durationSeconds: 18 },
    reviewFrames: [0, 12, 24, 59, 65, 80, 87, 90, 103, 121, 134, 149, 155, 168, 174, 185, 194, 195, 207, 220, 250, 294, 307, 325, 355, 388, 396, 400, 407, 414, 433, 460, 474, 481, 510, 539],
    notes: [
      'Manually authored HTML/SVG social creative. This is an unofficial illustrative demonstration and not verified automatic URL generation, a live authenticated session, or measured advertising performance.',
      'Verified 2026-10-05: https://linear.app/docs/linear-agent ; https://linear.app/docs/assigning-issues ; https://linear.app/docs/coding-sessions ; https://linear.app/brand . Official assignment and coding-session images were inspected at .local/linear-social/assignment.png and coding.png.',
      'Coding sessions work from issue context and configured repository access. Current docs describe a draft PR that a person checks before review/approval. They require workspace coding-session setup, GitHub access and AI credits on eligible plans. This film does not promise availability on a free plan or without setup.',
      'The illustrative ENG-142 issue and draft title adapt the archived-search example in Coding sessions documentation. Identifier, owner label You, compact menu and PR content are staged examples. No claim that this exact bug was actually fixed. No invented tested, merged, saved-time or completed status.',
      'UI is a mobile-legible editorial reconstruction of issue context, human assignee, agent delegation and linked draft PR. It is not a recording of a native mobile interface. Oversized typography, moving sheets, menu position, grouping and camera choreography are editorial staging; agent selection and human ownership are documented product behavior.',
      'Native-inspired assignment hierarchy keeps You as human assignee and Linear as agent. The pointer selects Linear in the agent chooser. The subsequent coding and PR transition is explicitly time-compressed, not instantaneous execution.',
      'Hook: Still copying bugs into an AI chat? Recognizable developer friction precedes product explanation. The same issue object stays in the composition through delegated context and draft result.',
      '0.00–2.00s: the bug report arrives on a lateral move and settles; the question and compact Issue to draft PR promise remain fully readable from frame zero. A ghosted generic chat sheet behind it is an editorial symbol of duplicate context, not Linear UI.',
      '2.00–2.90s: the competing chat sheet is stripped away and the same issue snaps square into the single workflow. Start with the issue names the alternative.',
      '2.90–5.60s: deliberate pointer movement opens the agent picker and selects Linear. The visible assignee remains You. The action label is Delegate in Linear.',
      '5.60–6.50s: the same issue condenses to its retained context strip. A short labelled Coding session interval separates the action and draft reveal; bottom note states time compressed.',
      '6.50–9.83s: a single dark-to-Mercury-White reveal and quick assembly resolve into a clear hold: Draft PR. Your review. The draft stays attached to ENG-142; You remain the owner. No merge button or completion mark.',
      '9.83–12.97s: the camera grouping opens the same draft card and enlarges its human-review line. Your review. Your decision. makes responsibility explicit while draft identity and issue link stay visible. This is editorial emphasis, not an invented application control.',
      '12.97–15.60s: Review the work. Keep the context. names the consequence. The draft exits before issue, draft and human owner assemble as a readable path. From 15.60–15.90s the preceding text exits before the closing copy enters.',
      '15.90–18.00s: Explore Linear Agent and linear.app enter and settle by 16.47s in the placement-safe area. Existing audio is retained by the renderer; the full story is designed for muted playback.',
      feed ? '4:5 layout is independently composed: upper brand lockup, taller issue and draft panels, expanded properties, and separated consequence stack. It is not a crop or uniform scale of the Reels version.' : '9:16 layout keeps essential text and controls within x80–1000 and y290–1230. Outside that region, only a faint editorial grid and large unlabelled panel contours move.',
      'Brand palette uses Mercury White #F4F5F8, Nordic Gray #222326 and observed near-black #08090A. No added neon. Logo geometry is a manually authored monochrome approximation, not modified official artwork.',
      'All frame state derives solely from the requested frame: no random values, timers, CSS animations, external assets, or live requests.',
    ],
    html: `<div id="ls-ground"></div><div id="ls-light"></div><div id="ls-grid"></div>
      <div id="ls-bleed-a"></div><div id="ls-bleed-b"></div>
      <div id="ls-brand">${mark('ls-mark')}<b>Linear</b><span>For product teams</span></div>
      <div id="ls-title">Still copying bugs<br>into an AI chat?</div>
      <div id="ls-chat"><span>New chat</span><i></i><i></i><div>Paste the context…</div></div>
      <div id="ls-issue">
        <div id="ls-issue-meta"><span class="ls-status"></span><b>ENG-142</b><span id="ls-context-label">ISSUE</span></div>
        <div id="ls-issue-title">${L.issueTitle}</div>
        <div id="ls-issue-detail"><span>Include archived</span><b>On</b></div>
        <div id="ls-owner"><span class="ls-person">Y</span><span>You</span><span id="ls-owner-word">Assignee</span></div>
        <div id="ls-agent-control"><span class="ls-agent-branch"></span><span id="ls-agent-value">Choose agent</span>${chevron}</div>
        <div id="ls-agent-menu"><span>AGENTS</span><div id="ls-agent-choice">${mark('ls-agent-logo')}<b>Linear</b><span id="ls-select-mark">${arrow}</span></div></div>
      </div>
      <svg id="ls-cursor" viewBox="0 0 50 60" aria-hidden="true"><path d="M5 4L42 32L26 35L36 52L27 57L17 39L6 49Z" fill="#f4f5f8" stroke="#08090a" stroke-width="2.6" stroke-linejoin="round"/></svg>
      <div id="ls-working"><div id="ls-working-rail"><i></i></div><span>Coding session</span></div>
      <div id="ls-draft"><div id="ls-draft-meta">${branch}<b>Draft PR</b><span>ENG-142</span></div><div id="ls-draft-title">Respect archived<br>search</div><div id="ls-draft-owner"><span class="ls-person">Y</span><span>You review the changes</span></div></div>
      <div id="ls-proof"><div><span>01</span><b>The issue</b><small>ENG-142</small></div><div><span>02</span><b>The draft</b><small>For review</small></div><div><span>03</span><b>You</b><small>Still the owner</small></div></div>
      <div id="ls-close"><div>Less handoff.<br>More context.</div><span>With Linear Agent.</span></div>
      <div id="ls-cta"><span>Explore Linear Agent</span>${arrow}</div><div id="ls-url">linear.app</div>
      <div id="ls-promise"><span>Issue</span>${arrow}<span>draft PR</span></div>
      <div id="ls-note">Illustrative demo · time compressed</div>`,
    css: `
      #stage{background:#08090a;color:#f4f5f8;letter-spacing:-.04em;font-weight:500;--mark-cut:#08090a}
      svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      #ls-ground,#ls-light,#ls-grid{position:absolute;inset:0}#ls-ground{background:#08090a}#ls-light{background:#f4f5f8;transform-origin:left top}#ls-grid{opacity:.14;background:linear-gradient(90deg,transparent 99px,#686e782e 100px,transparent 101px,transparent 979px,#686e782e 980px,transparent 981px),linear-gradient(0deg,transparent 49.9%,#686e782e 50%,transparent 50.1%)}
      #ls-bleed-a,#ls-bleed-b{position:absolute;left:80px;top:${feed ? 40 : 1330}px;width:920px;height:490px;border:2px solid #aeb5c116;border-radius:36px;transform-origin:center;pointer-events:none}#ls-bleed-b{left:140px;top:${feed ? 970 : 1400}px}
      #ls-brand{position:absolute;left:100px;top:${L.brandY}px;right:100px;display:flex;gap:16px;align-items:center;font-size:48px;line-height:1.1;z-index:20;letter-spacing:-.04em}#ls-brand>svg{width:44px;height:44px;stroke:none}#ls-brand b{font-weight:570}#ls-brand>span{font-size:38px;color:#a4a8b1;margin-left:auto;letter-spacing:-.03em}
      #ls-title{position:absolute;left:100px;top:${L.titleY}px;width:880px;font-size:${L.hookSize}px;line-height:1.03;letter-spacing:-.068em;font-weight:570;z-index:10;transform-origin:left top}
      #ls-chat{position:absolute;left:0;top:0;width:820px;height:335px;background:#17191d;border:2px solid #3e434d;border-radius:24px;padding:30px 40px;transform-origin:center;box-sizing:border-box;color:#8d949e;font-size:40px}#ls-chat>span{font-size:38px}#ls-chat i{display:block;height:8px;width:70%;margin-top:24px;background:#41464f;border-radius:5px}#ls-chat i:nth-of-type(2){width:44%;margin-top:17px}#ls-chat>div{margin-top:28px;border:2px solid #343a43;border-radius:16px;padding:20px 28px;font-size:40px}
      #ls-issue{position:absolute;left:0;top:0;width:880px;height:${L.issueHeight}px;background:#151618;border:2px solid #42464f;border-radius:24px;box-shadow:0 24px 65px #0005;transform-origin:0 0;color:#f4f5f8;z-index:6;overflow:visible}
      #ls-issue-meta{position:absolute;left:38px;right:38px;top:29px;display:flex;align-items:center;gap:14px;font-size:38px;color:#b7bfcb;letter-spacing:-.02em}#ls-issue-meta b{font-weight:500}.ls-status{display:inline-block;width:26px;height:26px;border:2px solid #a7afbd;border-radius:50%;flex:none;background:conic-gradient(#a7afbd 0 70deg,transparent 70deg)}#ls-context-label{margin-left:auto;font-size:38px;letter-spacing:.02em;color:#818b98}
      #ls-issue-title{position:absolute;left:38px;right:34px;top:${L.issueTitleY}px;font-size:${feed ? 63 : 61}px;line-height:1.06;letter-spacing:-.055em;font-weight:550}
      #ls-issue-detail{position:absolute;left:38px;right:38px;top:${L.detailsY}px;display:flex;align-items:center;gap:16px;font-size:40px;color:#aeb6c2;letter-spacing:-.025em}#ls-issue-detail b{margin-left:auto;border:2px solid #515964;border-radius:8px;padding:2px 16px;font-size:38px;font-weight:500;color:#e2e6ed}
      #ls-owner{position:absolute;left:38px;top:${L.ownerY}px;display:flex;gap:13px;align-items:center;font-size:42px;letter-spacing:-.025em}.ls-person{display:inline-flex;width:42px;height:42px;align-items:center;justify-content:center;background:#3c434d;color:#e5e9f0;border-radius:50%;font-size:28px;font-weight:600;flex:none}#ls-owner-word{font-size:38px;margin-left:18px;color:#969fac}
      #ls-agent-control{position:absolute;left:400px;right:38px;top:${L.ownerY - 5}px;display:flex;gap:14px;align-items:center;padding:8px 14px;border:2px solid #535b68;border-radius:12px;font-size:39px;background:#222326;line-height:1.1;letter-spacing:-.03em;transform-origin:center}#ls-agent-control>svg{width:29px;height:29px;margin-left:auto;flex:none}.ls-agent-branch{width:18px;height:23px;border-left:2px solid #7c8695;border-bottom:2px solid #7c8695;border-radius:0 0 0 10px;flex:none}
      #ls-agent-menu{position:absolute;right:38px;top:${L.ownerY - 158}px;width:422px;height:157px;background:#26282d;border:2px solid #606876;border-radius:16px;box-shadow:0 20px 50px #0008;box-sizing:border-box;overflow:hidden;z-index:15;transform-origin:right bottom}#ls-agent-menu>span{display:block;font-size:30px;color:#a2adbc;letter-spacing:.08em;padding:16px 22px 8px}#ls-agent-choice{display:flex;align-items:center;gap:15px;padding:12px 20px;font-size:46px;line-height:1;background:#353942;margin:0 9px;border-radius:8px}#ls-agent-choice>svg{width:41px;height:41px;stroke:none;--mark-cut:#353942}#ls-agent-choice b{font-weight:530}#ls-select-mark{margin-left:auto;display:flex}#ls-select-mark svg{width:36px;height:36px}
      #ls-cursor{position:absolute;left:0;top:0;width:47px;height:57px;transform-origin:5px 4px;z-index:25}
      #ls-working{position:absolute;left:145px;top:${L.proofY + 65}px;width:790px;text-align:center;font-size:46px;color:#d0d6e0;letter-spacing:-.03em}#ls-working-rail{height:5px;background:#353b44;overflow:hidden;margin-bottom:28px;border-radius:4px}#ls-working-rail>i{display:block;width:250px;height:5px;background:#d0d6e0}
      #ls-draft{position:absolute;left:100px;top:${L.draftY}px;width:880px;height:${L.draftHeight}px;border:2px solid #626976;border-radius:24px;background:#222326;box-shadow:0 26px 56px #15161824;transform-origin:center;color:#f4f5f8;z-index:8;overflow:hidden}#ls-draft-meta{position:absolute;left:34px;right:34px;top:27px;display:flex;align-items:center;gap:13px;font-size:40px;line-height:1.1;color:#d0d6e0}#ls-draft-meta>svg{width:37px;height:37px}#ls-draft-meta b{font-weight:540}#ls-draft-meta>span{margin-left:auto;font-size:38px;color:#b2bac6}#ls-draft-title{position:absolute;left:35px;top:${feed ? 112 : 88}px;font-size:${feed ? 76 : 67}px;line-height:1.03;letter-spacing:-.055em;font-weight:560}#ls-draft-owner{position:absolute;left:35px;bottom:25px;display:flex;align-items:center;gap:13px;font-size:40px;color:#c6ccd5;letter-spacing:-.025em}
      #ls-proof{position:absolute;left:100px;top:${L.proofY}px;width:880px;color:#222326;z-index:12}#ls-proof>div{position:relative;display:flex;align-items:center;gap:20px;height:${feed ? 116 : 100}px;border-top:2px solid #aeb5c166;transform-origin:left center}#ls-proof>div:last-child{border-bottom:2px solid #aeb5c166}#ls-proof span{font-size:38px;color:#737c89;letter-spacing:0;width:60px}#ls-proof b{font-weight:540;font-size:54px}#ls-proof small{font-size:38px;color:#626c79;margin-left:auto;letter-spacing:-.025em}
      #ls-close{position:absolute;left:100px;top:${L.closeY}px;width:900px;z-index:15;color:#222326}#ls-close>div{font-size:${L.closeSize}px;line-height:1;letter-spacing:-.066em;font-weight:580}#ls-close>span{display:block;margin-top:38px;font-size:48px;letter-spacing:-.04em;color:#66717e}
      #ls-cta{position:absolute;left:100px;top:${L.ctaY}px;width:880px;height:106px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:#222326;border-radius:15px;color:#f4f5f8;z-index:20;box-sizing:border-box;font-size:53px;letter-spacing:-.04em;transform-origin:left center}#ls-cta>svg{width:44px;height:44px}#ls-url{position:absolute;left:100px;top:${L.ctaY - 66}px;font-size:42px;letter-spacing:-.025em;color:#606b79;z-index:20}
      #ls-promise{position:absolute;left:100px;top:${L.footY}px;z-index:30;display:flex;gap:19px;align-items:center;font-size:40px;letter-spacing:-.02em;line-height:1.1;color:#d0d6e0}#ls-promise svg{width:35px;height:35px}
      #ls-note{position:absolute;left:100px;top:${L.footY}px;z-index:30;font-size:34px;letter-spacing:-.02em;line-height:1.1;color:#8f99a7}
    `,
    script: `
      function draw(frame){
        const f=Math.max(0,Math.min(539,Math.round(frame)));
        const el=id=>document.getElementById(id),clamp=v=>Math.max(0,Math.min(1,v));
        const p=(a,b)=>clamp((f-a)/(b-a)),ease=t=>1-Math.pow(1-t,4),smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
        const a=(id,v)=>{el(id).style.opacity=String(clamp(v));el(id).style.visibility=v<=0?'hidden':'visible';};
        const move=(id,x,y,scale=1,rotation=0)=>{el(id).style.transform='translate('+x+'px,'+y+'px) rotate('+rotation+'deg) scale('+scale+')';};
        const intro=ease(p(0,18)),simplify=ease(p(60,78)),delegate=ease(p(87,100)),context=ease(p(169,189)),reveal=ease(p(195,214)),review=smooth(p(295,316)),consequence=ease(p(389,410)),close=ease(p(468,487));
        const light=f>=195?1:0;el('ls-light').style.clipPath='inset(0 '+((1-light)*100)+'% 0 0)';
        el('ls-brand').style.color=light>.6?'#222326':'#f4f5f8';el('ls-brand').style.setProperty('--mark-cut',light>.6?'#f4f5f8':'#08090a');el('ls-brand').lastElementChild.style.color=light>.6?'#626c79':'#a4a8b1';el('ls-note').style.color=light>.6?'#636e7d':'#8f99a7';
        move('ls-bleed-a',80*Math.sin(f/90),-20*f/539,1+f/2300,-7+f/100);move('ls-bleed-b',-50*Math.sin(f/105),15*f/539,1.06,-2-f/120);a('ls-bleed-a',1);a('ls-bleed-b',1);
        // Headline changes are hard editorial cuts with a brief travel into a stable hold.
        const title=f<60?'Still copying bugs<br>into an AI chat?':f<87?'Start with<br>the issue.':f<168?'Delegate<br>in Linear.':f<195?'Same issue.<br>Full context.':f<295?'Draft PR.<br>Your review.':f<389?'Your review.<br>Your decision.':'Review the work.<br>Keep the context.';
        el('ls-title').innerHTML=title;el('ls-title').style.color=light>.6?'#222326':'#f4f5f8';el('ls-title').style.fontSize=(f>=389?${feed ? 86 : 83}:${L.hookSize})+'px';
        const cut=f>=389?389:f>=295?295:f>=195?195:f>=168?168:f>=87?87:f>=60?60:-60;const settle=1-ease(clamp((f-cut)/11));move('ls-title',0,18*settle);a('ls-title',1-p(468,474));
        move('ls-chat',135+mix(80,0,intro)+300*simplify,${L.issueY - 125}+mix(55,0,intro)-20*simplify,1,5+8*simplify);a('ls-chat',.72*(1-simplify));
        let ix=mix(130,100,intro),iy=${L.issueY}+mix(40,0,intro),ir=mix(-2,-1,intro),ih=${L.issueHeight};
        ix=mix(ix,100,simplify);iy=mix(iy,${L.issueY - 20},simplify);ir=mix(ir,0,simplify);
        iy=mix(iy,${L.resultIssueY},context)-28*review;ih=mix(ih,110,context)-12*review;
        move('ls-issue',ix,iy-24*consequence,1,ir);el('ls-issue').style.height=ih+'px';el('ls-issue').style.boxShadow='0 '+mix(24,8,context)+'px '+mix(65,28,context)+'px #0005';a('ls-issue',1-p(389,395));
        // Exit a text state before the next one enters the same space: no ghost labels.
        a('ls-issue-title',f<169?1:0);a('ls-issue-detail',f<87?1:0);a('ls-owner',f<169?delegate:0);a('ls-agent-control',f<169?delegate:0);
        el('ls-context-label').textContent=f>=168?'CONTEXT':'ISSUE';el('ls-agent-value').textContent=f>=155?'Linear':'Choose agent';el('ls-agent-control').style.background=f>=155?'#3a4049':'#222326';
        const click=f>=123&&f<129?Math.sin(Math.PI*(f-123)/6):f>=150&&f<156?Math.sin(Math.PI*(f-150)/6):0;move('ls-agent-control',0,0,1-.035*click);
        const menuIn=ease(p(129,137)),menuOut=ease(p(155,163));a('ls-agent-menu',menuIn*(1-menuOut)*(1-context));move('ls-agent-menu',0,10*(1-menuIn),.97+.03*menuIn);
        const aim=ease(p(104,122)),choose=ease(p(141,149));let cx=mix(960,795,aim),cy=mix(${L.issueY + 360},${L.issueY - 20 + L.ownerY + 23},aim);cx=mix(cx,705,choose);cy=mix(cy,${L.issueY - 20 + L.ownerY - 56},choose);move('ls-cursor',cx,cy,1-.12*click);a('ls-cursor',p(104,110)*(1-p(157,163)));
        a('ls-working',p(176,182)*(1-p(190,195)));move('ls-working',0,15*(1-context));move('ls-working-rail',0,0);el('ls-working-rail').firstElementChild.style.transform='translateX('+mix(-230,800,p(176,195))+'px)';
        a('ls-draft',f>=195?1-p(389,395):0);move('ls-draft',0,35*(1-reveal)-35*review,.92+.08*reveal,-3*(1-reveal));el('ls-draft').style.height=(${L.draftHeight}+35*review)+'px';el('ls-draft-owner').style.fontSize=(40+11*review)+'px';el('ls-draft-owner').style.color=f>=295?'#f4f5f8':'#c6ccd5';
        // The draft title remains labelled Draft PR; no completion or merge state exists.
        a('ls-proof',f>=396?1-p(468,474):0);move('ls-proof',0,30*(1-consequence)-35*close);
        Array.from(el('ls-proof').children).forEach((row,index)=>{const q=ease(clamp((f-396-index*6)/18));row.style.opacity=String(q);row.style.transform='translateX('+(45*(1-q))+'px)';});
        a('ls-close',p(477,487));move('ls-close',0,30*(1-close));a('ls-cta',p(478,490));move('ls-cta',0,18*(1-ease(p(478,490))));a('ls-url',p(481,494));
        a('ls-promise',f<60?1:0);a('ls-note',f>=60?1:0);
      }
    `,
  };
}

export const linearStudy = makeLinearSocial(false);
export const linearFeedStudy = makeLinearSocial(true);
