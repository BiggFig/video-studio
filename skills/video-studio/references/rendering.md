# Rendering

One primary project owns time. FFmpeg prepares media; other engines create intermediates.

## Hyperframes

Candidate pinned version: hyperframes@0.8.97. Use Node22+, FFmpeg, headless browser. Install local CLI, not upstream skills. Confirm flags against pinned CLI help. Initialize with `HYPERFRAMES_SKIP_SKILLS=1 npx hyperframes init <project> --non-interactive` or preserve existing initialization. In v0.8.97 the --skip-skills flag is temporarily ignored; the environment variable is required to avoid upstream skill installation. For a newly scaffolded project replace the generated workflow instructions in CLAUDE.md/AGENTS.md with a pointer to this skill. Preserve existing user-authored instructions in existing projects.

Root is directly in index.html body, not a template. Match data-composition-id to window.__timelines key; data-width/height match canvas, root width/height 100%, opaque background. One paused GSAP timeline per composition, registered after assets/fonts are ready. Use local font declarations and local GSAP bundle. No play/timers/wall clock. Subcomposition templates follow pinned runtime rules; top-level root does not.

For a five-second range starting at source second2:
```html
<div id="root" data-composition-id="main" data-width="1080" data-height="1920" data-duration="5" style="width:100%;height:100%;background:#111">
  <div id="picture" style="position:absolute;inset:0">
    <video id="take1" src="assets/raw.mp4" class="clip" data-start="0" data-duration="5" data-media-start="2" data-track-index="0" muted playsinline></video>
  </div>
  <audio id="speech1" src="assets/raw.mp4" data-start="0" data-duration="5" data-media-start="2" data-track-index="10"></audio>
</div>
```
Apply CSS sizing/fit and locally bundled gsap before this JS:
```javascript
const tl = gsap.timeline({paused:true});
tl.to('#picture', {scale:1.05, duration:5, ease:'none'}, 0);
window.__timelines = window.__timelines || {};
window.__timelines.main = tl;
```

Do not tween timed .clip visibility/autoAlpha; animate inner elements. No timed video inside a timed parent. No crossorigin on media. Avoid CSS/GSAP transform collisions. For later repeated targets use fromTo immediateRender:false. Each source range gets its own video and matching audio. Mute video to prevent duplicate audio. Match playback rate/source offsets. Preprocess freeze/reverse/speed ramps unless verified automation exists.

Audio data-volume is linear 10^(gain_db/20) within limits. Fades/ducking use data-automation volume lanes with clip-local seconds. A lane and GSAP volume tween cannot both own volume. Crossfades need real overlap/handles, stacking, inner opacity and paired audio fade. Keep stage opaque.

In initialized project:
```bash
npx hyperframes lint
npx hyperframes check
npx hyperframes snapshot --at 0,2.5,4.9
npx hyperframes render --quality draft --output ../renders/draft.mp4
npx hyperframes render --quality delivery --output ../renders/final.mp4
```
Times come from actual holds/seams. Inspect images. doctor --json may exit0 on failure; gate on payload ok. No automatic skills update or upstream interview.

## FFmpeg

Bundled roughcut accurately decodes sequential video/image ranges to fixed canvas/fps, keeps requested source audio, supports constant speed and contain/cover. It refuses effects/captions/extra audio to avoid silently dropping styling. Use primary compositor or a verified filtergraph for complete styled output.

Normalize VFR/rotation if needed. Stream-copy cuts are not assumed frame-exact. Use H264/yuv420p/AAC/faststart for common MP4 playback. Render final from originals. Arguments are arrays, never interpolated shell strings from users. Full decode/probe checks follow export.

## Other engines

Existing Remotion project may remain primary with frame-based interpolation, deterministic seeds, explicit media props. Its current commercial runtime license is separate from MIT skill instructions and must be resolved by deployment. Manim/Blender/Three/canvas produce intermediate clips matching required timing/canvas. Only advertise an adapter after installed dependencies and real smoke renders pass. These recipes do not install those engines.
