# Original FilmLoop reference: complete native-frame study

The supplied file is **22.000 seconds of picture, 660 decoded frames, 1920 × 1080, 30 fps**. I inspected all 27 sequential contact sheets, covering every decoded frame 0–659, then enlarged native-resolution frames 55, 83, 145, 179, 332, 420, 510 and 640 to inspect typography, UI and transition geometry. This is an independent visual pass, not a sample at one frame per second.

Source: `C:\Users\Noah\Documents\WhatsApp Video 2026-09-29 at 6.53.16 PM.mp4`. The copied reference is `.local/reference-replication/original/reference.mp4`; both have SHA-256 `e8cfda523e628d371daea22fa7fbd1b29e7cb0a4ca1ab48c383a8048f3ac5dd6` and 2,686,271 bytes. The container lasts 22.066667 seconds. H.264 picture has a first presentation timestamp of **0.066667 seconds**: this document uses **decoded-frame-relative time, f / 30**, while the sheet labels retain the original timestamps. Do not mistake that two-frame timestamp offset for two missing frames.

The ignored analysis directory contains the copied original, FFprobe metadata, every lossless native PNG (`frames/frame_000000.png` through `frame_000659.png`), per-frame hashes/PTS in `frames.json` and `frames.csv`, all 27 sheets, quantitative `measurements.json`, and `provenance.json`. Each sheet contains 25 consecutive frames at 384 × 216 per cell; the final sheet contains frames 650–659. `inspection.json` lists the exact inspected sheets and enlarged frames. `frame-study.csv` maps every frame to the intervals below. No decoded frame was skipped or resampled.

The three most useful continuous sequences to reconstruct are:

1. **Frames 1–104:** accumulating browser tabs, the matching numeric headline, and a center iris into a character-by-character brand reveal.
2. **Frames 183–357:** one prompt types, a pointer submits it, three answers arrive in a stagger, and the pointer selects one result that becomes the high-contrast winner.
3. **Frames 472–602:** a middle price card is distinguished, credits count upward, then that same dark panel grows into the full closing screen.

## Every-frame action map

Ranges are inclusive and cover all 660 frames exactly once. Boundary times are frame-relative. Several entrances overlap; the description names the most visible event, not a claim that all other elements are stationary.

| Frames | Relative interval | Visible event |
| --- | --- | --- |
| 0 | 0.000–0.033 s | One-frame flash of the later completed comparison. It appears to be an export/start-state artifact; intent is unknown. |
| 1–10 | 0.033–0.367 s | White browser shell with dark chrome; first tab resolves. |
| 11–18 | 0.367–0.633 s | Headline fades up; second tab appears, counter changes one frame later. Third tab begins at the end. |
| 19–24 | 0.633–0.833 s | Counter shows three; fourth tab starts entering at frame 24. |
| 25–31 | 0.833–1.067 s | Four-tab count; fifth tab starts at frame 31. |
| 32–37 | 1.067–1.267 s | Five-tab count; next tab appears before the next numeric change. |
| 38–44 | 1.267–1.500 s | Six-tab count; seventh tab enters. |
| 45–51 | 1.500–1.733 s | Seven-tab count; eighth tab enters. |
| 52–74 | 1.733–2.500 s | Eight-tab state holds, active URL `lumalabs.ai`. |
| 75–79 | 2.500–2.667 s | Problem headline fades almost completely. |
| 80–87 | 2.667–2.933 s | Central black circle accelerates outward. Chrome fades and its tab positions converge as the browser subtly shrinks. |
| 88–90 | 2.933–3.033 s | Clear near-black canvas. |
| 91–104 | 3.033–3.500 s | `FilmLoop.AI` characters reveal from left to right, with opacity and short vertical/scale settling. |
| 105–116 | 3.500–3.900 s | Tagline `Make AIs compete. You win.` fades up. |
| 117–130 | 3.900–4.367 s | Five white provider discs scale into place sequentially. |
| 131–172 | 4.367–5.767 s | Brand composition holds without a camera move. |
| 173–185 | 5.767–6.200 s | The entire black composition translates upward. White canvas is uncovered; the next heading/composer begin before the last dark strip leaves. |
| 186–196 | 6.200–6.567 s | Comparison heading/composer finish settling; placeholder and caret are visible. |
| 197–235 | 6.567–7.867 s | Prompt appears one or occasionally two characters per frame. Pointer enters below/right and travels to submit. |
| 236–240 | 7.867–8.033 s | Full prompt holds; pointer aligns over submit. |
| 241–247 | 8.033–8.267 s | Submit button turns black; short anticipation pause before answers. |
| 248–258 | 8.267–8.633 s | Three white result cards rise/fade left to right, initially showing ellipsis/loading dots. |
| 259–288 | 8.633–9.633 s | Result quotes type in, with later starts for the second/third card. |
| 289–293 | 9.633–9.800 s | All three completed answers hold. |
| 294–307 | 9.800–10.267 s | Pointer descends diagonally from submit into the third result and pauses. |
| 308–317 | 10.267–10.600 s | Third card turns gray then near-black, slightly scales up; text becomes white and `Winner` pill appears. Other answers lose contrast. |
| 318–354 | 10.600–11.833 s | Selected answer holds; pointer fades during this hold. |
| 355–363 | 11.833–12.133 s | Heading exits first, then composer and cards. Capability heading starts appearing before the previous cards fully leave. |
| 364–377 | 12.133–12.600 s | Capability headline and three category selectors fade/rise in; chevrons point down. |
| 378–393 | 12.600–13.133 s | Selectors open left to right; white menus grow downward, chevrons rotate, rows stagger in. |
| 394–460 | 13.133–15.367 s | Three complete capability lists hold. No pointer click is shown for this opening sequence. |
| 461–468 | 15.367–15.633 s | Heading and menu columns fade in a stagger while the offer heading arrives. |
| 469–471 | 15.633–15.733 s | Offer heading becomes readable before the cards. |
| 472–479 | 15.733–16.000 s | Starter, Pro, Power cards fade/rise left to right; Pro is black and elevated slightly. |
| 480–498 | 16.000–16.633 s | Monthly credit counts visibly increment toward 10,000 / 20,000 / 50,000. |
| 499–507 | 16.633–16.933 s | Counts finish settling; rollover and extra-credit reassurance pills enter. |
| 508–553 | 16.933–18.467 s | Offer holds for reading. |
| 554–559 | 18.467–18.667 s | The middle card’s contents fade, retaining its dark surface; other content remains. |
| 560–568 | 18.667–18.967 s | That dark surface expands from the Pro card’s rectangle to the canvas; surrounding heading/cards fade. |
| 569–571 | 18.967–19.067 s | Black closing canvas, no copy. |
| 572–585 | 19.067–19.533 s | Wordmark characters reveal again. |
| 586–595 | 19.533–19.867 s | Tagline fades in below the brand. |
| 596–602 | 19.867–20.100 s | White `Plans from $9.99/mo` pill scales from a small center dash to full size. |
| 603–659 | 20.100–22.000 s | Full closing composition holds to the final frame. |

## Design measurements and reconstruction specification

Coordinates below are approximate rendered-pixel bounds at 1920 × 1080, generally within a few pixels. Text ink bounds differ from CSS line boxes. RGB values are sampled from decoded frames; compression and color conversion produce nearby variations.

**Canvas and material.** Dominant light background is RGB 249/248/250 (`#f9f8fa`); panels are white. The first brand stage is RGB 12/12/12 (`#0c0c0c`), the closing stage is black. Chrome is approximately RGB 27/26/28 and 42/41/43. The film uses flat opaque surfaces, thin borders and broad faint shadows. There is no observed glass refraction, metallic material, volumetric lighting, perspective orbit, extruded text or physical 3D object. Recreating those would change this reference rather than improve fidelity. Depth is conveyed by shadow, overlap, scale and contrast.

**Typography.** A heavy geometric sans carries the headline/wordmark; supporting UI copy is regular or medium. Exact font identity is unverified. Wordmark ink spans approximately x431–1490, around 200 px type; headlines are roughly 76 px, bold, tightly tracked and single-line. Browser pain copy is approximately 108 px. Tagline is about 58 px, gray. Body UI ranges from 20–43 px; menu rows are around 32 px. One family and stable baselines unify the whole film. The authored study uses the existing local Geist font as an explicit approximation, not an asserted font match.

**Browser shot.** Shell: x120/y96, 1680 × 888, radius about 23 px. Dark chrome ends around y276. Address field is inset with pill ends. Browser dots are monochrome gray. Tab widths compress as more tabs appear. Headline reads `Still juggling N AI tabs?` and changes discretely; it does not scramble. The reference briefly has a new tab before the headline count increments. Maintain this small causal delay. Headline center remains fixed while the tab strip becomes crowded. A subtle shrinking/fading browser supports the iris; it is not a dolly through a 3D scene.

**Brand shot.** White `FilmLoop.AI` centered, gray tagline below, five white 96 px discs with 28 px gaps at y740. Disc centers are approximately x712,836,960,1084,1208. Logos have small purple/blue accents; the rest is monochrome. The wordmark’s letters reveal individually without reflowing the centered final line. Keep all letter widths reserved from frame zero. Badge entrances are staggered by roughly 2–3 frames, settle, then hold.

**Comparison UI.** Headline top about y175. Composer x210/y300, 1500 × 176, radius about35. Prompt is `Write a tagline for a coffee shop on the moon`. It contains three model chips and a model selector; submit is a small circular up-arrow at the right. Results are three 480 × 350 cards at x210/720/1230, y533, separated by 30 px. Preserve exact local positions while text types. The three quotes are `Great coffee. Zero atmosphere.`, `Every table has an Earth view.`, and `One small sip for man.` The final right card grows approximately 3.2%, goes dark, gains a `Winner` pill and white text. Other cards remain present with reduced contrast. The pointer travels from below the stage to submit, then diagonally down-left to the winning answer. The interaction needs actual intermediate DOM text/state, not a panned screenshot.

**Capability lists.** Three 480 px columns at the same x positions. Selectors at y300 are 88 px high with 21 px corners. Menus begin y410, with 29 px corners and modest gray shadows. Header labels use small uppercase tracking; rows combine 54 px pale logo discs and 32 px text. The first list is taller: five rows versus three. Opening is an authored sequence; no visible click should be invented. All rows stay still long enough to scan.

**Offer and closing.** Side cards are approximately 440 × 452 at x264/1216, y310. Pro is centered at x740/y296, with roughly 1.03× scale and white text. Cards use about 41 px corners; prices are about 82 px. The credit numbers animate while headings/prices remain fixed. Two small reassurance pills sit near y822. Transition identity comes from the middle card itself growing—not an unrelated full-screen rectangle appearing. Its contents disappear before its surface expands. Final wordmark/tagline hold above a 472 × 91 white pill near x724/y680. Preserve the final readable stillness.

## Timing, easing and camera

The exact original animation library/curves cannot be inferred from compressed frames. The following transition geometry is directly measured; the authored study reproduces these sample positions rather than claiming an exact recovered easing function.

| Motion | Native samples | Interpretation |
| --- | --- | --- |
| Center iris | Frames80–86: black center-row radii ≈5.5,30.5,87.5,190,351.5,585.5,827.5 px | Strong accelerating growth; a linear scale ramp would look wrong. It covers horizontal edges at87 and the whole canvas at88. |
| Black-stage lift | Frames173–183: translation y≈−4,−20,−57,−124,−228,−380,−584,−768,−900,−988,−1041 px | A whole composition moving upward with an acceleration/deceleration curve. All brand elements stay attached. |
| Card expansion | Frame562 `(655,258,610,532)`;563 `(563,221,794,610)`;564 `(419,164,1082,732)`;565 `(244,94,1432,880)`;566 `(122,45,1676,984)`;567 `(48,16,1824,1046)`;568 `(10,0,1900,1079)`;569 full canvas | Rectangle width/height and position interpolate together. Corner radius reduces as the card becomes the background. |

Other motions use short ease-out entrances, low-amplitude position changes and discrete text counts. The authored interpolation is an approximation. There is **no independent camera trajectory** in the observed original: the viewport is frontal and stationary. The perceived push occurs when a selected card scales and when a rectangle fills the canvas. Preserve this restraint rather than adding unsupported rotation or parallax.

## Authored study and limits

`studies/original.ts` exports the full 22-second `originalStudy` for the shared GSAP/Hyperframes study runner. HTML/SVG creates every visible element. `draw(frame)` fully derives visibility, typed text, selection, counts, position and size from the supplied integer frame; seeking backward does not replay clicks or depend on elapsed wall time. The original video is referenced only for separate comparison. The study does not load any reference pixels.

Known approximations: exact font identification remains open; provider symbols are manually drawn vectors; some fine chrome spacing and transient tab convergence are approximated. The source’s first-frame comparison flash is intentionally omitted and documented. Native visual inspection does not establish sound timing: audio was not listened to in this study, and the picture reconstruction does not claim an audio match. Final rendered similarity still requires comparing actual exported frames and playback; source extraction and valid TypeScript alone do not establish a faithful render.
