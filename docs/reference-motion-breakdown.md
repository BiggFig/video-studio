# Reference film and reusable production direction

The user-supplied reference is a 1920 × 1080 H.264 film at 30 fps with 660 decoded video frames. Picture duration is exactly 22 seconds; the MP4 container lasts 22.066667 seconds and includes 48 kHz stereo AAC. SHA-256: `e8cfda523e628d371daea22fa7fbd1b29e7cb0a4ca1ab48c383a8048f3ac5dd6`.

All 660 frames were extracted and visually inspected in sequential contact sheets. An accompanying local frame viewer, CSV, and JSON index describe every frame. Frame numbers below are zero-based; boundaries are visually observed. The precise font, easing functions, and musical timing were not independently identified. Audio metadata is measured; a listening check is not claimed.

## Frame-by-frame motion groups

Consecutive frames that perform the same action are grouped here. The local CSV supplies one row per frame.

| Frames | Time | Observation and reusable function |
| --- | --- | --- |
| 0 | 0.000s | Single-frame flash of a later comparison scene. Treat as an export artifact, not a desired opening. |
| 1–10 | 0.033–0.333s | A browser-shaped stage appears on a white canvas. |
| 11–18 | 0.367–0.600s | The problem headline fades in; the tab count reaches two. |
| 19–24 | 0.633–0.800s | Third tab and matching headline count. |
| 25–30 | 0.833–1.000s | Fourth tab and matching headline count. |
| 31–37 | 1.033–1.233s | Fifth tab and matching headline count. |
| 38–43 | 1.267–1.433s | Sixth tab and matching headline count. |
| 44–50 | 1.467–1.667s | Seventh tab and matching headline count. |
| 51–74 | 1.700–2.467s | Eight-tab problem state holds. The scene communicates one specific frustration. |
| 75–79 | 2.500–2.633s | Headline fades before the transition. |
| 80–87 | 2.667–2.900s | A black circle expands from the center to cover the canvas. |
| 88–90 | 2.933–3.000s | Dark stage clears before the brand reveal. |
| 91–104 | 3.033–3.467s | Wordmark characters reveal in sequence with a small rise/scale. |
| 105–116 | 3.500–3.867s | Short positioning line fades in below the brand. |
| 117–130 | 3.900–4.333s | Five small circular badges enter sequentially. |
| 131–172 | 4.367–5.733s | Brand, positioning, and badges hold. |
| 173–182 | 5.767–6.067s | The black composition lifts upward to expose the white demonstration stage. |
| 183–195 | 6.100–6.500s | Benefit headline settles, then an input bar appears. |
| 196–240 | 6.533–8.000s | Prompt types into the input; pointer approaches submit. |
| 241–247 | 8.033–8.233s | Submit interaction and anticipation pause. |
| 248–260 | 8.267–8.667s | Three result cards rise and fade in from left to right. |
| 261–288 | 8.700–9.600s | Results progressively appear inside the cards. |
| 289–307 | 9.633–10.233s | Results hold; pointer approaches the preferred answer. |
| 308–317 | 10.267–10.567s | Selected answer turns dark and gains a small emphasis badge. |
| 318–357 | 10.600–11.900s | Completed comparison holds to show the benefit. |
| 358–363 | 11.933–12.100s | Old content fades while the next heading arrives. |
| 364–377 | 12.133–12.567s | Capability heading and three category controls appear. |
| 378–397 | 12.600–13.233s | Three columns expand and their items reveal in a stagger. |
| 398–461 | 13.267–15.367s | Complete feature overview holds. |
| 462–466 | 15.400–15.533s | Overview exits before the offer. |
| 467–471 | 15.567–15.700s | Offer heading appears first. |
| 472–486 | 15.733–16.200s | Three price cards enter; the middle card is dark. |
| 487–507 | 16.233–16.900s | Short reassurance lines appear below the offer. |
| 508–553 | 16.933–18.433s | Offer holds for reading. |
| 554–563 | 18.467–18.767s | Center card content fades while its panel grows. |
| 564–569 | 18.800–18.967s | Dark panel expands to fill the screen. |
| 570–571 | 19.000–19.033s | Clear closing stage. |
| 572–587 | 19.067–19.567s | Wordmark reveals in sequence. |
| 588–594 | 19.600–19.800s | Positioning line appears. |
| 595–600 | 19.833–20.000s | Compact high-contrast offer/CTA pill appears. |
| 601–659 | 20.033–21.967s | Brand and action hold through the final frame. |

## What transfers to other products

The reusable structure is **problem → brand → proof → capabilities → supported offer or additional proof → action**. It is not a mandate to fabricate a tab counter, comparison interface, price table, or provider badges for unrelated products.

The primary visual language is a near-white canvas, black brand moments, a single bold sans-serif family, centered layouts, generous whitespace, restrained rounded panels, a small number of sequential reveals, and enough stillness to read the result. Approximate reference colors and motion windows live in `worker/reference-style.json`. Each submission supplies its own brand, copy, factual claims, and actual source assets.

Use genuine recordings or captured states for product interactions. A screenshot can be staged or emphasized, but it cannot establish that a control was clicked or that a new state exists. When workflow evidence is unavailable, use real source imagery and clearly informational feature graphics. Do not render invented controls as a product demonstration. An offer requires explicit source pricing or a verified free offer. Otherwise the story uses another concrete benefit or proof beat.

## Production contract

1. **Research.** Collect accessible source text and real visuals. Record the product identity, supported audience/problem/value, capabilities, evidence, offer, CTA, and unknowns. Persist exact source fact IDs, visual IDs, provenance, and hashes.
2. **Script.** Write concise on-screen copy with a purpose for each beat. Bind every claim and card to a verified fact; bind every product visual to an actual asset. Select supported scene and transition types. Persist the script before composing.
3. **Compose.** Compile bounded scene data into trusted local HTML, CSS, and a paused GSAP timeline. A single frame clock controls all reveals and transitions. Model-generated executable JavaScript is not accepted. Fonts and assets are local; the editable composition is retained.
4. **Render.** Produce the actual motion sequence at the requested aspect and 30 fps. Preserve complete meaningful original speech. Compose original instrumental music/SFX using the existing measured audio pipeline.
5. **Verify.** Inspect actual exported frame holds and seams, real-media fidelity, source-grounded copy, text bounds, deterministic seeking, full-file decode, exact timeline, and audio requirements. Delivery still requires all mandatory checks. A render preview is not a passed quality report.

Aim for 20–28 seconds when the source can support concise copy. Reading holds and meaningful source speech take precedence over matching 22 seconds exactly. Limited accessible evidence produces an explicit limitation or input request; it does not authorize invented product behavior. Existing per-job spending, repair, and execution limits remain in force.
