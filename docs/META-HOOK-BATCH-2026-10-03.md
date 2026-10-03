# Meta-reference hook studies — 3 October 2026

The user approved the brand-faithful product-motion direction and requested
stronger hooks informed by a substantial portfolio of Meta advertising examples.
This batch adds the research portfolio and three new visual cuts. The preceding
product-motion, extreme and original exports remain unchanged for comparison.

## Research delivered

The portfolio at `/ad-references` contains 12 selected software ads across
ClickUp, Notion, monday.com, Slack, Figma, Grammarly and Canva. There are 93
contiguous scene ranges, each with visible action, motion/edit, story purpose,
hook mechanism and an application to our own work. The site includes advertiser
and hook filters, expandable timelines, enlargeable storyboard excerpts and
attributed source links. JSON observations are the single source of truth in
`docs/meta-ad-research`; their Markdown companions preserve fuller research.

One selected Slack creative was observed directly in Meta Ad Library as Active,
ID 1787295452461737. The other 11 selected videos are public Motion archive
references; exact current Meta delivery was not independently established.
Direct Meta searches also exposed other current ads, which are not substituted
for proof about the selected archive creatives. Status labels preserve this
distinction. No result is presented as a proven advertising winner.

Researchers inspected decoded half-second samples across every selected file;
the six interface-team references also have quarter-second opening samples.
Scene boundaries are approximate, not frame-exact edit decisions. Source videos
and provenance are retained in ignored local research folders. The public page
contains limited, low-resolution six-frame criticism excerpts, not copied full
third-party videos. No campaign, purchase or paid generation was started.

## Applied direction

| Film | Opening | Applied reference mechanism |
| --- | --- | --- |
| Linear | Bug reported. Now what? | ClickUp's recognizable work question and monday.com's causal request-to-result sequence. The same issue arrives, contracts into a task and unfolds into the documented delegation flow. |
| Tally | Stop guessing. Start asking. | Figma's visible outcome object and object continuity. A finished form punches into view, then its own blocks fold into the editor before the sourced slash workflow. |
| Todoist | Don't keep it in your head. | Grammarly's obstruction-to-relevant-proof structure and Figma's continuous object. The actual task strip travels into Quick Add while the statement clears. |

All three retain their established brand palettes and documented product story.
Tally's Publish now cuts directly into the respondent form. Todoist's post-Add
transition cuts into the complete saved Inbox row, removing the pale intermediate
state. Linear shortens its send-to-result reframe. Result holds and CTAs remain
readable. These are original compositions; reference footage, people, brand
colors and claims were not transplanted into our films.

The reusable creative procedure is in `META-HOOK-PLAYBOOK.md`. This execution is
manually art-directed with the existing HTML/SVG/GSAP/Hyperframes engine; it is
not automatic URL-generation acceptance. The production generation worker and
its semantic bundle contents are unchanged.

## Export verification

Every film is 18 seconds, 540 frames, 1920×1080, 30 fps, H.264/yuv420p with stereo
AAC. All complete decoding checks and nine exact rewind checks pass. All 84
HTML/export sample comparisons exceed the unchanged .97 SSIM requirement.
Each compressed AAC stream is byte-identical to its preceding product-motion
cut, with no new audio/model call and no sound-cue retiming.

| Film | Export samples | Minimum SSIM | Final MP4 SHA-256 |
| --- | ---: | ---: | --- |
| Linear | 29 | 0.996771 | `21285d59adefb32585f32228996659244a928f72073d5b9a192fc740ca02e47e` |
| Tally | 29 | 0.998738 | `579211eb2e5faec60e12d74abf9131d7c14f9b5475373ab44ea43878461c9e08` |
| Todoist | 26 | 0.997928 | `42fa6f850002e881d30c72fb3dfd145f37278f87a11cc7df7e7f19e2c19cee4e` |

Final visual review covers all 270 decoded samples at 5 fps and full-size
action/result frames. No material blocker was found. Brief transition caveats
remain: Linear's dark send wipe around 6.8–7.0 seconds and fading small-label
overlap around 7.2–7.4; Todoist's closing crossfade around 15.8–16.0. Held results
and CTA frames are clean. Sampled review does not establish human normal-speed
viewing, listening quality or advertising effectiveness.

Production build and typecheck pass. Local production checks cover all 12
players' mute defaults, playback and seeking; all three new films also reach
the end of an automated full-duration muted playback without errors. These are
technical browser checks, separate from the sampled creative review. Media checks
confirm exact video hashes, streaming range support, posters and all 12 reference
images. Portfolio advertiser/hook
filtering, empty state, reset and expanded scene notes work at a phone viewport.
Desktop and phone checks found no horizontal overflow or error overlay.

Reproduce an export with:

```text
node --import tsx scripts/render-launch-study.ts linear --hook --render
```

Use `tally` or `todoist` for the other studies. The isolated workspace is
`.local/launch-hook-20261003/<product>`; old study sources and render variants
remain available.
