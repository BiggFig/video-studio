# Extreme launch-film exploration — 3 October 2026

The user requested the polar opposite of the previous restrained films: fast,
loud, obnoxious, crowded motion, and attention-grabbing music. This batch keeps
the three original 24-second films and adds separate 18-second extreme cuts.
The live `/launch-tests` gallery leads with the new cuts and places each original
under an expandable comparison.

## Creative choices

- Linear: industrial electro, acid/violet typography, fractured UI layers,
  hard camera changes, and a source-grounded request → draft pull request.
- Tally: acid yellow/pink/cobalt, flying paper and form fields, hyperpop direction,
  illustrative contact-form submission → documented thank-you copy.
- Todoist: task tornado, red/black/chartreuse, oversized Quick Add, rapid typing,
  date/priority recognition, actual Add control → matching task in Inbox.

All picture content is authored HTML/SVG on the existing pinned GSAP/Hyperframes
engine. These remain manually art-directed creative studies. They do not establish
that the automatic URL-only pipeline succeeds. Source research and the limitations
recorded in `LAUNCH-TRIALS-2026-10-03.md` still apply. The UI is reconstructed, and
no real third-party form, issue, pull request, or task is submitted.

Energy comes from composition, continuous object motion, cut timing, moving
typography, and sound design. The cuts do not intentionally use full-screen strobe
effects. Actual product results get brief legible holds while surrounding objects
continue moving. Native video controls require the viewer to start playback.

## Audio

One new instrumental ElevenLabs music generation per film, requested at 18 seconds
and 160 BPM. The requested tempo is a creative direction, not a measured guarantee
about the generated music. Original, deterministic synthesized kick/snare/hats,
impacts, zips, and whooshes are placed on a real 160 BPM timing grid. The music and
original sound design are mixed to a target of −12 LUFS / −1.5 dBTP, compared with
the originals' target of −17 LUFS. No sampled recordings or reference soundtracks
are reused. Final measurements are recorded with each local export.

The extreme mix does not slow the score to fill a silent tail; original percussion
continues through the final beat. Provider source bytes, hashes, paid request
reservation, usage ledger, and synthesized PCM master are retained separately.
Audio measurements and successful playback are not a listening review.

## Reproduction

```text
node --env-file-if-exists=.env.local --import tsx scripts/score-launch-studies.ts linear --extreme --run-paid
node --import tsx scripts/render-launch-study.ts linear --extreme --render
```

Use `tally` or `todoist` for the other cuts. Omitting `--extreme` preserves the
original study files, output directories, prompts, and mix path. Preview is the
default; `--finish` reuses an existing rendered picture only when its saved HTML
matches the current source exactly. Workspaces are `.local/launch-extreme-20261003`.

Each export checks deterministic seeks, strict full-picture/final decoding,
native 1920×1080 dimensions, 540 frames at 30 fps, and sampled
HTML-versus-decoded export similarity. That similarity check measures renderer
fidelity, not how exciting the film is or how closely it resembles a reference.

## Review notes

All 27 Tally and 28 Todoist decoded review frames received a separate visual
review, including full-size input, confirmation, result and CTA frames. Tally has
a deliberate four-frame near-black submit-button wipe at 11.0 seconds; it is a
transition, not a missing scene. The duplicate forms and confirmations are
editorial graphics. Todoist's priority circle remains unfilled, and its Tomorrow
task is saved in Inbox.

An earlier Linear preview's extended 16-rewind diagnostic found Chromium raster-edge variation at
frame zero (927 decorative edge pixels, 0.045% of the image) and two pixels at the
last frame, while the DOM and product text/layout matched. A straight ticker and
explicit hidden-section reset improved repeatability. The shared three-point
preflight gate is unchanged. Its measured pass must not be described as proof
that every extended pixel hash matches.

The first Linear export also exposed a separate, material mismatch: the renderer
substituted arrow/utility symbol fonts, changing the width of repeated text runs.
The film now uses explicit SVG symbol geometry. The failed comparison results and
picture are retained locally; the export similarity threshold was not lowered.

No normal-speed visual playback review or listening review is claimed from these
sampled-frame checks and audio measurements. Viewer preference between the two
creative extremes remains the purpose of this comparison.

## Completed export checks

All three final files are 18-second 1920×1080 H.264/yuv420p MP4s with 540 frames
at 30 fps and AAC stereo audio. Strict full decoding passed, as did the unchanged
nine shared rewind comparisons. All 85 sampled decoded frames were visually
reviewed; Tally and Todoist received an independent agent review.

| Film | Minimum export SSIM | Measured LUFS | True peak dBTP | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Linear | 0.989856 | -13.49 | -1.15 | `94970725120fd79b5589464b62c41250ca88146a942398ec8d4ed94f6008ea46` |
| Tally | 0.982375 | -13.54 | -1.15 | `55419e2eedde1cfb016f18f796aab34ca3581300aeeb37e40e316937f0bcb9ee` |
| Todoist | 0.993807 | -13.42 | -1.21 | `937a934794b9e8e093de5327d4715ccdaec86e0e0295c845000fa450d6d7e5a8` |

No final mix has a detected silence interval of at least one second at -45 dB.
Typecheck, production build and diff checks passed. The local gallery passed
six-player play/seek checks, byte-for-byte media validation, range requests,
desktop layout checks and a 390px phone-width overflow check. The three original
MP4 hashes still match the previous release. These checks cover this static-film
iteration; no new paid automatic URL-generation acceptance run was performed.
