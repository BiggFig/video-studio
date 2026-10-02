# Reference reconstruction results — 2 October 2026

The earlier analysis missed both design detail and several directly embedded films. This pass downloaded the available sources, inspected every decoded frame of four films, and authored four actual HTML motion reconstructions. These are private visual studies, not new automatic production outputs.

## Watch the actual exports

Run `node --import tsx scripts/preview-motion-studies.ts` from the repository and open the printed local address. Each study has synchronized reference/reconstruction players, single-frame stepping, editable HTML, and downloadable MP4s. The combined comparison MP4 always labels the original on the left and our engine on the right.

| Study | Source frames inspected | Reconstructed source range, inclusive | Export | Breakdown |
| --- | ---: | --- | ---: | --- |
| Original WhatsApp / FilmLoop | 660 / 660 | 0–659 | 22.000 s | [Every shot and measured geometry](reference-original-frame-study.md) |
| ElevenAgents pricing film | 841 / 841 | 0–840 | 28.033 s | [Every shot and material/transition analysis](reference-elevenlabs-frame-study.md) |
| ClickUp | 1,741 / 1,741 | 405–738 | 11.133 s | [Complete 99-range frame map](reference-clickup-frame-study.md) |
| Reception.ai, directly embedded film | 986 / 986 | 396–985 | 19.667 s | [Complete frame map and continuity analysis](reference-reception-frame-study.md) |

Total inspection: **4,228 native frames**, in **208 contiguous contact sheets**, with selected native-resolution frames enlarged for measurements. Total authored output: **2,425 frames / 80.833 seconds**, all 1920 × 1080 at 30 fps. Frame coverage means every frame appeared in an inspected sheet; it does not mean every frame was individually enlarged. Decoded ordinal frame numbers are authoritative. The WhatsApp container starts at a nonzero presentation timestamp, so comparison clips are trimmed by frame number rather than an approximate timestamp seek.

Exports and full frame evidence are local under `.local/reference-replication/`; they are excluded from Git. Each render folder contains `replication.mp4`, `comparison.mp4`, `reference-selection.mp4`, `compare.html`, source/provenance metadata, the editable project, decoded validation frames, and QC results. Reference pixels appear only in the explicitly labeled original/comparison artifacts. The generated films contain authored HTML, CSS and SVG, without source-video or screenshot pixels.

## What was actually downloaded

The WhatsApp file was copied locally and hashed. The portfolio's YouTube-linked [ElevenAgents film](https://youtu.be/6rN-mTeMEl0) and [ClickUp film](https://youtu.be/VFzmZBERFQ4) were available. A renewed [Scale AI download](https://youtu.be/X3SwLoWErnI) returned HTTP 403, so it is not counted as inspected.

The supplied [ADDX page](https://addxstudio.com/launch) also contains six direct MP4s that the earlier investigation omitted. All six are now downloaded and hashed. The labels below identify the visible work in local evidence; the exact download URLs and hashes are retained in `.local/addx-reference/embedded/downloads.json`.

| Local label | Source | Coverage this pass |
| --- | --- | --- |
| Merit / Echo | [Direct MP4](https://framerusercontent.com/assets/ntH0cHb4iyMJalEZ7Ai8hcRc.mp4) | First 15 seconds sampled at 1 fps; no complete audit or reconstruction |
| Commas | [Direct MP4](https://framerusercontent.com/assets/dYPTBha6wImMpdjsXYgHKvcAQ.mp4) | First 15 seconds sampled at 1 fps; no complete audit or reconstruction |
| Viralt | [Direct MP4](https://framerusercontent.com/assets/3T3ovBTnLCl3iR8QOzS3JHathZg.mp4) | First 15 seconds sampled at 1 fps; no complete audit or reconstruction |
| Goosework | [Direct MP4](https://framerusercontent.com/assets/02SgX2GImjuDBi9aRuZUzRBMrc.mp4) | First 15 seconds sampled at 1 fps; no complete audit or reconstruction |
| Morphic | [Direct MP4](https://framerusercontent.com/assets/I8yybATGsZpKSFPcvqQmziadO28.mp4) | First 15 seconds sampled at 1 fps; no complete audit or reconstruction |
| Reception.ai / ElevenAgents | [Direct MP4](https://framerusercontent.com/assets/7XXS4fVreCCCjrEnTsaw16rYbp8.mp4) | Complete 986-frame audit; 19.667-second reconstruction |

This is not a claim that every video on ADDX was audited frame by frame. In particular, the directly embedded Reception film and the YouTube-linked ElevenAgents pricing film are different references.

## What the design study changed

**A screenshot is only evidence for a reconstruction.** ClickUp's composer, action button, thinking state, application planes and results were rebuilt as separate elements. The camera can enter the button and then reveal a larger workspace because those elements exist independently. The original WhatsApp film similarly uses actual typed strings, response states, cursor paths and card selection.

**Objects carry transitions.** In Reception, the warm circle becomes a luminous sphere, travels along a curved path into the chat avatar, and gives way to glass messages. Later, an outline becomes a card; three cards stretch together before flattening into the closing line. In the original film, the selected pricing card itself fills the canvas. A separate overlay or a generic fade loses that continuity.

**Material is part of the composition.** Fine rings, broad glow, dark cavities, translucent edges, gradient direction, grain and shadow softness substantially change the result. Our gradient approximations establish color and hierarchy, but do not reproduce the references' refraction, complex lighting or volumetric forms. Valid HTML animation alone is insufficient evidence of visual parity.

**Timing has several layers.** Text, object movement, material movement and camera movement rarely begin and stop together. Some transitions take only a few frames, while final product states hold for seconds. ClickUp's remaining weakness is particularly clear: the recreated workspace settles too soon, whereas the source continues to move through depth.

**Restraint is also designed.** The original WhatsApp film relies on careful scale, spacing, readable state changes and long holds. It does not benefit from adding arbitrary 3D movement. The ADDX examples require richer surfaces and camera choreography because those are present in the actual films.

## Verification and honest limits

The studies use the existing pinned Hyperframes / GSAP rendering runtime, through `worker/motion-cli.ts`. They are trusted, manually authored compositions that bypass the production slide templates. They do not prove that the planner can generate comparable work from an arbitrary URL.

All exports have the expected dimensions, frame counts, H.264 format and complete decode. Browser seeking is checked forward/backward for deterministic pixels. Selected decoded export frames are compared to their authored HTML at an unchanged SSIM threshold of 0.97. **That score verifies export integrity, not similarity to the reference.** A discovered Arial-to-Inter substitution in the renderer was fixed by explicitly using the bundled font; the threshold was not weakened.

The original study is comparatively close in layout and major transitions, with differences in typography, tiny symbols, some reveal timing and the intentionally omitted first-frame artifact. ElevenAgents still approximates orb refraction, tray cavities, network placement and trails. ClickUp still lacks the source's volumetric flower and type lighting, texture, precise camera continuation and panel density. Reception still approximates the flowing material and some bubble/card timing. These are visible design gaps, not merely export defects.

All four exports are **silent visual studies**. Audio was not listened to or reconstructed. No paid model/audio calls were made, no job budgets or provider limits were changed, and no production generation behavior or deployment was changed by this work.

The next production change needs to make a designed shot—not a screenshot card—the unit of planning: measured UI states; editable objects with stable identities; independent camera, type and material tracks; explicit paths connecting shots; and visual review of exported motion before acceptance. The authored studies now provide concrete regression references for that work.
