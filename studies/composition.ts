import type { MotionStudy } from './types';

export function validateStudy(study: MotionStudy) {
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(study.id)) throw new Error('Invalid study ID');
  if (study.width !== 1920 || study.height !== 1080 || study.fps !== 30) throw new Error('Studies use 1920 × 1080 at 30 fps');
  if (!Number.isSafeInteger(study.durationFrames) || study.durationFrames < 1 || study.durationFrames > 3600) throw new Error('Invalid duration');
  if (!study.reviewFrames.length || study.reviewFrames.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= study.durationFrames)) throw new Error('Review frame outside study');
  if (!Number.isFinite(study.reference.startSeconds) || study.reference.startSeconds < 0 || Math.abs(study.reference.durationSeconds - study.durationFrames / 30) > 1 / 30) throw new Error('Reference range must match study duration');
  if (/<\/?script/i.test(study.html) || /<\/script/i.test(study.script)) throw new Error('Embedded script tags are not supported');
}

/** Same local GSAP / Hyperframes clock as the product renderer, without slide templates. */
export function studyHtml(study: MotionStudy) {
  validateStudy(study);
  const title = study.title.replace(/[<>&"']/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<script src="assets/gsap.min.js"></script><style>
@font-face{font-family:Studio;src:url('assets/Geist.woff2') format('woff2');font-weight:100 900;font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#fff;font-family:Studio,Arial,sans-serif}#stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff}
${study.css}
</style></head><body><main id="stage" data-composition-id="main" data-width="1920" data-height="1080" data-fps="30" data-start="0" data-duration="${study.durationFrames / 30}">${study.html}</main>
<script>
${study.script}
window.__studioReady=(async()=>{
 await document.fonts.load('500 32px Studio');await document.fonts.ready;
 if(!document.fonts.check('500 32px Studio'))throw new Error('Study font did not load');
 await Promise.all(Array.from(document.images).map(image=>image.decode()));
 const clock={frame:0};
 const tl=gsap.timeline({paused:true});
 tl.to(clock,{frame:${study.durationFrames - 1},duration:${(study.durationFrames - 1) / 30},ease:'none',onUpdate:()=>draw(Math.round(clock.frame))},0);
 tl.set({}, {},${study.durationFrames / 30});
 tl.pause(0);draw(0);window.__timelines={main:tl};
 window.__studio={fps:30,durationFrames:${study.durationFrames},seekFrame:async(frame)=>{
  if(!Number.isInteger(frame)||frame<0||frame>=${study.durationFrames})throw new Error('Frame outside study');
  tl.seek(frame/30,false);draw(frame);return frame;
 }};
 return window.__studio;
})();
</script></body></html>`;
}
