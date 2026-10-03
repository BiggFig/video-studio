# Product motion revision — 3 October 2026

The prior extreme studies failed the creative brief: louder music and unrelated
bright colors did not make the product explanation more compelling. This revision
changes the visual choreography while retaining each prior soundtrack unchanged.
The gallery starts muted so the picture has to carry the story.

## Direction

The product supplies the moving objects. A sentence becomes a task, a document
becomes a form, an issue becomes a draft pull request. The same subject persists
through each transformation, rather than disappearing behind decorative activity.
Fast travel and changes of scale alternate with readable action/result holds.
Peripheral motion stops when attention needs to settle on a product outcome.

Brand identity constrains the palette. Linear's official brand page prefers
monochrome; Tally's editor is white/ink with its actual control accents; Todoist
uses its red with neutral surfaces. Product-specific evidence and editorial
reconstruction limits are recorded in each study's notes and direction document.
No invented neon palette, ornamental ticker, confetti, or crowds of fake results.

The review asks whether the audience can follow the product category, input,
action and result with no audio. It also checks that movement changes the main
composition rather than decorating an otherwise static demo. Technical export
similarity is a separate check and is not treated as a creative quality score.

## Reproduction

```text
node --import tsx scripts/render-launch-study.ts linear --motion
node --import tsx scripts/render-launch-study.ts linear --motion --render
```

Use `tally` or `todoist` for the other films. Outputs are in
`.local/launch-motion-20261003/<product>`. The flag selects separate studies and
does not alter the previous original/extreme render paths. The current public
extreme MP4 is the retained AAC soundtrack source; its SHA-256 is recorded in
each export manifest. No new paid music or model call is required.

These are manually art-directed HTML/SVG studies rendered by the pinned
GSAP/Hyperframes engine. They are illustrative reconstructions, not recordings
of actual third-party operations or proof that automatic URL generation meets
this direction. This batch does not modify the production generation worker.

## Verification

All three exports have 540 frames at 30 fps, 1920×1080 H.264/yuv420p picture and
AAC stereo audio. Full decoding passes. All 78 HTML/export comparisons exceed
the unchanged .97 SSIM gate, and all nine final shared exact rewind checks pass.

| Film | Sampled export frames | Minimum SSIM | Final MP4 SHA-256 |
| --- | ---: | ---: | --- |
| Linear | 26 | 0.996661 | `ed0c4214b2da52b66885cbdadca8ace0060e9f76a753908a73df12fd38fee213` |
| Tally | 27 | 0.999097 | `dbeff16e9d06527fe735483e6c934a5302140e73babb241cabe7dee2d702d980` |
| Todoist | 25 | 0.997957 | `2f08464b3ec2730c02b9a0ef13ba2ebef69b2a7e0293a2dea9c5729e5a221f8a` |

Each final AAC stream is byte-identical to that product's preceding extreme cut,
verified by hashing the compressed audio independently of the MP4 container.
Both container and AAC source hashes are retained in each result manifest.
No new paid provider calls were made. This holds audio constant for comparison;
the previous sound cues were not retimed to the new picture.

Independent agents reviewed 90 decoded samples per film at 5 fps, plus full-size
action/result frames. This covered 270 silent sequence samples. The review found
no material UI continuity, palette or settled-frame legibility blocker. Brief
transition caveats remain: Linear has a near-empty charcoal reframe around
6.8–7.2 seconds; Tally's Publish reframe is mostly white around 10.4 seconds;
Todoist's Add-to-Inbox handoff is pale around 10.2–10.6 seconds. Result and CTA
holds are intentionally calmer than the transitions.

The Todoist preview initially exposed two rounded-border edge pixels changing
one color-channel level during a rewind, while DOM/state/geometry matched. An
equivalent SVG surface replaced the CSS border paint. Four fresh browser sessions
then passed 12 exact checks, followed by the shared final export checks. The
failed diagnostic evidence is retained locally. The runner now saves failing
rewind images and a failed preflight record before throwing; no threshold was
relaxed or successful status carried forward from a failed run.

Typecheck and production build pass. The local gallery passes nine-player
default-mute/play/seek checks, exact media hashes, poster availability, streaming
range requests, and desktop/phone overflow and error-overlay checks. At a
390-pixel viewport, the introduction, cards and footer retain their 16-pixel
side margins. Three new players also pass automated full-duration muted
playback checks. These are technical
playback checks; sampled visual review does not establish normal-speed human
viewing or a listening review.
