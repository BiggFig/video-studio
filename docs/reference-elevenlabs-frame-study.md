# ElevenLabs launch film — native-frame study

This is a visual audit of **every decoded frame**, followed by an authored replication specification. It supersedes the earlier sampled overview for this film. It does not claim to recover the original project, font, 3D scene, easing curves, or sound design.

**Scope clarification:** the page also contains a different directly embedded ElevenLabs film, subsequently downloaded as `.local/addx-reference/embedded/elevenlabs-embedded.mp4` (about 32.9 seconds). This document and `studies/elevenlabs.ts` cover only the 28-second YouTube-linked film identified below. They are not an audit or replication of the separate embedded film, or of all ElevenLabs work on the page.

## Evidence and inspection

- Public reference: [ElevenLabs film](https://youtu.be/6rN-mTeMEl0), featured on [Addx launch work](https://addxstudio.com/launch).
- Local immutable source: `.local/addx-reference/elevenlabs.mp4`.
- SHA-256: `657ff3b091d5451f57eae953b70e8e9a33d0e0a6fd5d67014416777de5f6baf9`.
- Native picture: **1920×1080, 30/1 fps, 841 frames**, f0000–f0840. Picture duration 28.033333 s; container duration 28.054 s. The small difference is not an extra picture frame.
- FFmpeg extracted every frame to lossless PNG with `-map 0:v:0 -fps_mode passthrough -start_number 0`; no sampling or frame-rate conversion.
- `.local/reference-replication/elevenlabs/frame-index.json` and `.csv` bind every frame to its decoded timestamp, PNG SHA-256, contact sheet, and cell.
- **All 43 sheets were visually inspected**, sheet-00 through sheet-42. Each sheet contains 20 consecutive frames in row-major order, 5×4, each picture 384×216 with a frame/time label. Last sheet contains f0840 only. Frames f0080, f0210, f0385, f0510, f0600, f0780 were additionally inspected at full source size for material/type detail.
- Automated threshold measurements are retained in `measured-bounds.json`, with code in `measure.py`. These are image-space measurements, not claims about the original camera.
- **Audio has not been heard or audited.** No tempo, beat sync, voice, instrument, or sound-effect assertion is made. The replication is silent.

All frame ranges below are **inclusive**, zero-based. Time at any frame is exactly `frame / 30`. Ranges cover f0000–f0840 once, without gaps.

## Complete frame coverage

| Frames | Time start–end | Observed visual event and motion |
|---|---|---|
| 0000–0019 | 0.000–0.633 | Near-black field. A tiny centered euro symbol grows into a small dark square. Fine construction-grid lines and green/blue glow rise from below. Fast initial scale, progressively slower settle. |
| 0020–0029 | 0.667–0.967 | Currency switches to yen at the same center; tile/grid persist. Camera/scale nearly steady. |
| 0030–0039 | 1.000–1.300 | Currency switches to rupee. Same light, scale, and registration. |
| 0040–0056 | 1.333–1.867 | Dollar replaces rupee. Gentle push accelerates strongly at f0054–0056; tile becomes the seed of the next object. |
| 0057–0079 | 1.900–2.633 | Tile changes into a thick dark slab, rotates in perspective, and extrudes into separated layers. Dollar becomes a dense square-dot glyph hovering above it. English, Japanese, then Chinese pill annotations arrive at different positions. |
| 0080–0099 | 2.667–3.300 | Push continues on dollar/stack. Upper layer fills lower half; lower planes extend past bottom. Pills remain attached to the object composition, not to a screen header. Their text finishes revealing. |
| 0100–0111 | 3.333–3.700 | Separation between dark planes increases; the stack travels upward toward the viewer. Dollar moves above the canvas at the end. Rapid spatial exit precedes a hard light cut. |
| 0112–0120 | 3.733–4.000 | Hard cut to warm-white field. Small centered “Well” appears with opacity/vertical settle. No card or retained object. |
| 0121–0144 | 4.033–4.800 | “usually,” joins to the right, beginning lighter/lower and settling dark on the baseline. The compact two-word phrase holds. |
| 0145–0171 | 4.833–5.700 | Hard cut to black. Horizontal glassy band with large `/MIN` and rolling values 0.11→0.10→0.09→0.08. Adjacent values above/below are faded, creating a masked odometer. |
| 0172–0184 | 5.733–6.133 | Price and unit split diagonally apart. A colored glass-like diamond slab enters the space between them. Line icons draw beside the labels; thin orbital rings appear. Large teal light wash emerges at right. |
| 0185–0212 | 6.167–7.067 | One slab holds in the center. Price band above-left, platform-fee/unit band below-right. Rings and icons finish drawing while the background light drifts. |
| 0213–0224 | 7.100–7.467 | Second slab drops/settles above the first; cream/yellow/green top versus blue/gold lower slab. A “stacked cost” annotation expands near upper right. |
| 0225–0259 | 7.500–8.633 | Two-layer stack holds with subtle continuous position/light change. Price, icon, and annotation hierarchy remain fixed. |
| 0260–0278 | 8.667–9.267 | Third slab enters above; stack redistributes vertically. “Commitment” and “book a demo” annotations reveal around it. |
| 0279–0343 | 9.300–11.433 | Completed three-layer cost diagram holds. There is no new scene each second: persistent material, moving teal wash, rings, and a slow camera/scale drift sustain it. |
| 0344–0367 | 11.467–12.233 | Diagram recedes and is engulfed by green/cream bloom. White vertical light forms appear through the central stack. Contrast collapses rather than a conventional crossfade. |
| 0368–0389 | 12.267–12.967 | Bright field becomes an oversized iridescent split sphere. Two curved sections rotate/close. Brand letters assemble over it; white medium/bold “Eleven” and lighter “Agents.” Sphere contracts rapidly from larger than the frame. |
| 0390–0397 | 13.000–13.233 | Shape resolves into a complete circle, still large, with green/yellow/cyan blurred material. Wordmark is fully readable across it. |
| 0398–0434 | 13.267–14.467 | Strong scale contraction to a small centered orb; enlarged soft colored ring/halo fills the background. Wordmark switches dark as the surrounding field turns light. Camera feels like a pull-back through the brand object. |
| 0435–0440 | 14.500–14.667 | Wordmark/orb fade into luminous color wash. This is a transitional veil, not a hold. |
| 0441–0458 | 14.700–15.267 | Small orb reappears high in a light price composition. Large numeric price counts down 0.14→0.08. Wordmark sits beneath. Text/objects settle upward from their entry positions. |
| 0459–0474 | 15.300–15.800 | Slash and “min” reveal after the number; “min” stays lighter gray. Orb continues subtle surface motion. |
| 0475–0486 | 15.833–16.200 | Price composition drifts down/out. Orb persists into the next physical metaphor. |
| 0487–0501 | 16.233–16.700 | Two white beveled trays enter from above at a common oblique angle. Small orb moves through/behind the upper tray. “No” then “minimums.” builds below, with gray-to-dark word emphasis. |
| 0502–0518 | 16.733–17.267 | Orb hangs in the gap and descends toward lower tray; upper tray remains offset above. “No minimums.” holds, then fades. Occlusion makes this feel spatial, not a stack of flat labels. |
| 0519–0534 | 17.300–17.800 | Second phrase builds “No”→“sales”→“call.” The orb passes through the lower tray while its surface/lip partially occludes it. |
| 0535–0557 | 17.833–18.567 | Orb emerges below lower tray. Tray assembly rises away; text remains until the exit. |
| 0558–0572 | 18.600–19.067 | New blue/cream dotted sphere appears on white. Concentric thin rings expand around it; black square nodes and connecting lines draw. “Full”→“voice” appears below. |
| 0573–0612 | 19.100–20.400 | “stack,” completes. Three-node polygon wraps around the sphere. Fine particle/latitude-like curved trails imply surface rotation. Small italic cost qualification stays below the claim. |
| 0613–0634 | 20.433–21.133 | “in”→“one”→“per-minute”→“rate.” extends the sentence on a second line. Additional nodes/edges appear, preserving the sphere as center. |
| 0635–0648 | 21.167–21.600 | Completed claim and network hold with slow sphere/orbit motion; clear hierarchy between main copy and fine qualification. |
| 0649–0678 | 21.633–22.600 | Cyan/green/gold wash expands over white while network shrinks/fades behind it. The same material transition echoes the earlier brand reveal. |
| 0679–0717 | 22.633–23.900 | Blurred large iridescent orb resolves and slowly contracts on white. It is a visual pause before identity, with no new copy. Contraction accelerates near the end. |
| 0718–0729 | 23.933–24.300 | Orb collapses into the middle of the assembling black wordmark. Left and right brand letter groups converge; sphere disappears once type completes. |
| 0730–0755 | 24.333–25.167 | Wordmark holds near center and gently settles to smaller final scale/position. |
| 0756–0764 | 25.200–25.467 | Pale outlined pill CTA rises/fades beneath the wordmark. |
| 0765–0840 | 25.500–28.000 | Final brand and CTA hold on warm white. No additional scene, logo, or motion distraction. |

## Measurements and confidence

**Directly measured:** dominant flat background is RGB(19,19,19), `#131313`, in the opening and price sequence; light field is RGB(244,242,240), `#f4f2f0`. CTA fill is approximately RGB(238,238,238). These are decoded delivery pixels and may differ from authoring values due encoding.

**Opening easing evidence:** thresholded central currency ink has height 12 px at f1, 64 at f5, 88 at f10, 98 at f15, 102 at f19. Center stays about (955,540). This supports a strong ease-out entrance, not constant-speed scale. During the later push the dollar ink grows 113 px at f40, 122 at f45, 140 at f50, 184 at f54, 250 at f56. The f55 threshold includes bright grid points, so its bounding box is excluded from a glyph-scale fit.

**Orb image-space contraction:** saturation-threshold colored bounds are about 1036×1024 px at f390; 958×970 at f394; 844×864 at f397; 466×466 at f400; 334×338 at f404; 278×286 at f410; 248×254 at f420. Halo contamination affects f398/f430, so those are not treated as orb-only dimensions. There is an especially fast contraction at f397–404 followed by a slow tail. Closing orb bounds: roughly 502×498 at f700, 434×426 at f710, 276×268 at f717, 164×162 at f719, 98×96 at f721, 64×58 at f723, 36×34 at f725, 16×22 at f727. Saturation bounds undercount soft edges but reveal timing clearly.

**Manually read at full resolution, approximate:** f210 single slab occupies about x785–1135/y410–686; its upper plane is a diamond, with a roughly 40 px-thick visible side wall. Price band is roughly x527–1190/y201–342. f80 dotted dollar occupies about x830–1115/y243–726; square-dot pitch is approximately 11 px with smaller filled squares. f510 tray group is around x765–1140/y110–715; small orb is about 115 px diameter near (947,473). f600 network sphere is around x826–1095/y242–510 with outer circle diameter near 630 px. f780 final wordmark spans about x652–1270/y454–520; CTA about x725–1195/y644–773. These estimates are suitable initial targets, not subpixel reconstruction claims.

**Unrecoverable from pictures alone:** original font identity; exact focal length; true 3D rotations/depth; light/material/shader settings; authoring software; cubic Bézier values. Perspective suggests tilted planes with shallow extrusion; CSS `rotateX`/`rotateZ`, layered SVG faces, gradients, masks, and soft shadows are an implementation hypothesis. The iridescent sphere has smoothly drifting colored lobes and a soft refractive-looking surface; a few static flat gradients would only approximate it. The network sphere includes dense curved point trails, not just a smooth gradient ball.

## Concrete replication choreography

The private study uses native 841-frame timing and one deterministic `draw(frame)` function. It uses authored DOM/SVG/procedural material only; source frames remain in the separately labelled comparison and never enter the generated composition. All state is derived from the requested frame, so reverse and repeated seeks must agree.

1. **Currency-to-stack, f0–111.** Seed a small centered tile on a fine grid. Change only its currency at 20/30/40. Fit the first scale track to the measured ease-out values; sharply accelerate f50–57. Replace the filled dollar with a square-dot mask at f57. Tilt/extrude seven rounded dark planes with 6–10 frame stagger and broad, low-contrast edge highlights. Add three attached language pills. Increase layer spacing and move the assembly up during the last 12 frames.
2. **Editorial reset and price mechanism, f112–343.** Hard cut to warm white and reveal two words over 9 frames. Hard cut at145 to the masked numeric wheel on black. At172 separate value/unit bands and reveal the first diamond slab; introduce second at213 and third at260. Keep the same visual construction while details accumulate. Glass side faces, subtle rings, tiny outlined annotations, a large drifting teal field, and real visual hierarchy matter more than bouncing whole cards.
3. **Light/material bridge, f344–440.** Scale diagram down while bloom grows. White luminous bars lead into a split orb. Join the orb halves, assemble type, then use the measured contraction curve to reveal large surrounding color. Preserve a clean text plane over the moving material.
4. **Simple price and spatial benefits, f441–557.** Small orb, descending numeric values, delayed unit, then vertically connected tray sequence. Make orb/tray ordering change at the observed crossings; a ball always painted in front would miss the mechanism. Move the same orb through both trays and change only the short benefit copy.
5. **Network synthesis, f558–678.** Render a dotted curved-surface sphere plus thin circles, square connection nodes, and progressively drawn edges. Two-stage sentence assembly shares timing with network growth. Keep qualification visually subordinate but visible. Fade through the recurring material wash.
6. **Identity, f679–840.** Use the measured orb-collapse curve; assemble brand around its center during718–729. Settle the wordmark, reveal one pill at756, hold cleanly to840.

The main transferable lesson is **a persistent object with changing explanatory function**. Its scale, material, occlusion, and attached labels change with the argument. It is not six unrelated templates with the same slide-in. The replication is an isolated study, not evidence that the automatic planner already produces this choreography, and not authorization to use ElevenLabs claims/branding in other customers' films.

## Inspection ledger

Sheets 00–05: f0000–0119; 06–11: f0120–0239; 12–17: f0240–0359; 18–23: f0360–0479; 24–29: f0480–0599; 30–35: f0600–0719; 36–41: f0720–0839; 42: f0840. All inspected in this audit. Full-resolution material checks listed above. No soundtrack audition. No provider calls. No production-runtime changes.

## Authored-study comparison

The first 38-frame HTML preflight was reviewed in three contact sheets against the complete source audit, then at full resolution for f145, f278, f385, f510, f534, f690, and f780. Comparison exposed fixable errors: the growing cost stack collided with the unit band and annotations; trays were oversized and obscured benefit copy; the numeric wheel lost its neighboring values; and the split orb closed too early. The study now separates cost layers within the measured central bounds, moves the price/unit bands apart as the third slab arrives, uses narrower projected SVG trays with independent lids and changing orb occlusion, retains neighboring odometer values before splitting, and postpones the orb join. The final price mask is removed once the band settles so the complete value remains opaque.

The latest local preflight passes with 38 rendered HTML frames and identical repeated/reverse seek samples at f0, f404, and f840. Evidence is `.local/reference-replication/renders/elevenlabs/preflight.json` and `frames/html-*.png`. This is a deterministic HTML verification, not yet full encoded-video verification.

Remaining visible deviations are material and geometry fidelity: the authored orb has broad layered color lobes instead of the source's intricate refraction; its split seam is more geometric; cost slab sides are more opaque; tray cavities are simulated gradient surfaces; fine icons and type outlines differ. Motion timing and compositional changes are authored from the native-frame audit, but no numerical visual-similarity claim is made. Sound remains unreviewed and absent.
