# ClickUp: native-frame visual study

This is a visual audit of the downloaded ClickUp example linked from [ADDX Launch](https://addxstudio.com/launch), [original video](https://youtu.be/VFzmZBERFQ4). It is a private reference study, not an assertion that Video Studio generated the reference or offers ClickUp's features. Audio was **not listened to or audited**; no soundtrack, voiceover, beat synchronization, or sound-design conclusions follow from this document.

## Evidence and coverage

- Source: `.local/addx-reference/clickup.mp4`, SHA-256 `a16b0c34483a55a4197f720fc4f06f210ec768c2691626cc3afe800f647d07b8`.
- Video stream: AV1, 1920 × 1080, exactly 30 fps, **1,741 decoded frames**, zero-based F0–F1740. Last frame PTS 58.000s; video stream duration 58.033333s. Container duration includes a small audio tail.
- `.local/reference-replication/clickup/frames/`: all native decoded frames, lossless PNG, no sampling or frame interpolation.
- `sheets/contact-000.jpg` through `contact-087.jpg`: every frame, sequential 5 × 4 grids, each thumbnail 384 × 216 with native frame and timestamp. **All 88 sheets were visually inspected**, including duplicate/near-static holds. The last sheet contains only F1740.
- `probe.json`, `manifest.json`, `frames.csv`: decoder metadata, source provenance, PTS, and exact image paths.
- `shots.json`: 99 contiguous inclusive subshot ranges. `frame-audit.csv` and `frame-audit.json`: **every decoded frame mapped to a shot/subshot**, with its source image/contact sheet. There are no gaps or overlaps.
- `inspection.json`: inspected-sheet coverage and full-resolution keyframes. F448, F462, F500, F527, F560, F615, F677, F725 were additionally inspected at native resolution for material, UI copy, geometry, and layering.

Frame boundaries below are observed. Pixel bounds are approximate manual measurements from decoded native images, typically within 5–15px, not source project coordinates. Suggested easing functions are reconstruction choices consistent with displacement; the reference's actual keyframe curves, font, renderer, lens, and shaders cannot be recovered exactly from a compressed export.

## Three sequences worth reproducing first

1. **F449–540 / 14.967–18.033s:** the field begins as a deliberate macro crop, takes the viewer through actual typed intent, cuts to a full composer, then moves back into an even tighter submit crop. Query reveal starts F464; one-frame glyph increments run through F485. F486 is a hard composition change, not a long crossfade. The composer shrinks rapidly for 14 frames and holds. The biggest submit jump happens F513–518, followed by a restrained pink hover/activation glow F525–535. This hierarchy makes the action understandable and gives the click importance.
2. **F541–682 / 18.033–22.767s:** the tiny Thinking pill creates a quiet pause, then becomes a large four-point material surface amid multiple layers of work. Expansion begins F589, fills the canvas by approximately F599, and continues with small independent layer drifts. F647 jumps back to one artifact. New task and calendar cards appear at F658 and F669, an 11-frame cadence. The center label stays the attention anchor while scale and surrounding density change dramatically.
3. **F683–738 / 22.767–24.633s:** a single white reset frame, giant gradient lettering, and a scale reset at F708. Huge cropped flowers frame the now smaller “Agents work.” The edge objects establish depth without putting decoration over the words. At F739 the same graphic appears on the photographed laptop: a match-cut from graphic world into lived outcome, not a generic fade.

The manually authored study uses **F405–738 inclusive: 334 frames, 11.133333s**, including the preceding material/“It remembers.” beat. This is a focused reconstruction; it does not attempt the filmed person/laptop shot or the remaining 47 seconds. It uses HTML, CSS, and original SVG paths only. No reference frame, screenshot, or video pixel is used in the generated picture.

## Geometry, type, material, and camera

### White memory claim, F405–448

The flower begins larger, then rapidly recedes over ~15 frames. It is a volume-like six-lobed object, not six flat colored dots: cyan/blue top lobes, violet right, pink lower-right, orange lower-left, a warm gray/pink left lobe, and a white four-point pillow over the center. Broad curved highlights and fine edge light imply inflated/translucent material. At F448 the flower is approximately x715–1008, y313–601; the diffuse halo is much larger. “It remembers.” is x~680–1320, baseline~717, with a colored period. The full phrase settles by ~F432 and has 17 native frames to read. The apparent type is a tightly spaced geometric sans; Geist is a study substitution, not an identified reference font.

### Macro query and full composer, F449–540

At F462 the flower is ~250px wide at x178–431, y418–653. The field starts x627, y327 and extends beyond the right edge. Its visible height is ~424px, outer corner radius ~118px and gradient rim ~35px. The faint second contour and halo sit outside this rim. The pale placeholder is intentionally cropped. It is not a document-reading shot: the crop makes typing and rim material dominant.

The first caret-only frame is F463. Input text is near 126px in this macro view; each new glyph appears immediately, with no overlapping flying letters. At F486 a full white composer appears over a pink/orange/blue textured field. At F500 the composer is approximately x325–1593, y291–783, with ~65px corners. A small flower sits x410–478, y360–424; heading baseline~495, subtitle baseline~555. Heading ~49px, subtitle~41px, input~38px. The input frame is x385–1527, y610–722; icon order is @, document/sparkle, submit. These are three different semantic controls and must remain distinct.

By F527 the submit crop has card right edge~1455 and bottom~895. The send arrow is centered near x1144,y575; the input's right corner is x~1272. The cursor is black with a thin white outline and soft dark shadow. Its tip reaches the arrow before the pink glow is strongest. This is roughly a **2.8× view scale relative to F500**, not a slight Ken Burns move. The macro move is concentrated in 4–6 frames; the resulting crop remains for roughly 23 frames, giving the eye time to locate the action. A sharp scale ramp followed by long ease-out fits better than uniform slow zoom.

### Thinking and workspace landscape, F541–646

At F560 the white pill is about x743–1178,y459–613: width435,height154, radius~75. Flower width~80; “Thinking” type~48px. The halo extends hundreds of pixels past the pill, with colored light shifting around it. The pill initially appears larger and eases down while the label types over F542–560. The label then holds. At F585–588 it grows slightly in anticipation.

At F615 the central four-point pillow occupies roughly x520–1420,y100–950. It is neither a diamond with straight edges nor a simple rounded rectangle. Concave sides connect broad rounded points, with pearlescent pink/blue shading. The word is now ~68px and remains centered beside the flower. The surrounding UI comprises overlapping calendars, workload heatmaps, timeline bars, task lists, and small navigation/chat panels. Repeated views have different crops/scales and independent translation; the composition is dense at the edge and quiet in the middle. Foreground center is opaque enough to preserve label clarity. Several panels are intentionally cropped by the frame. Fine UI text is secondary evidence texture here; this is not a whole-screen walkthrough or a demand that every background row be readable at thumbnail size.

The expansion reaches most of its travel in the first ~10 frames (F589–599), then shifts into slow drift. The source does not use a scene-wide blur to hide every transition; major focal text remains sharp. To reconstruct, separate the stable center, rear diffuse color, several UI planes, and foreground soft material. A single screenshot scaled uniformly cannot reproduce this depth relationship.

### Artifact cards and benefit, F647–738

Artifacts move as cards with geometry, slight tilt, thin rims and shadows. The first appears at F647 on a small tilted plane and levels over roughly 8–10 frames. The task list replaces/overlaps it at F658, calendar at F669. Badges 05/10/15 and the same filename create continuity. At F677 the calendar card is approximately x465–1355,y271–794, corner radius~63; the top Thinking label is above, not on the card. “presentation-v2.ppt” is near x516,y845, while the flower/“Artifact” label is near x1193,y843. The “result” is these artifacts; there is no newly typed long answer paragraph in this span.

F683 is white. “Ag” begins F684, “Age” F685, “Agen” F687, “Agent” F690, “Agents” F695. The huge word spans much of the 1920px frame. F708 changes scale abruptly and adds white “work.” At F725 the combined line is about x510–1395,y466–583 (~150px type), with a broad muted pink/blue halo behind the white word. Multiple flowers crop deeply from top/bottom/corners. Their lobes cast no hard black shadows; broad light gradients and overlaps supply dimension. From F719–738 there is only modest movement, so the payoff is readable before the live-action cut.

## Rhythm and implementation implications

- The most important quality is **contrast of scale and density**: enormous type → small emblem → macro input → full card → macro submit → tiny pill → full-frame work → small artifact → huge type. A constant camera with uniform card slides misses this structure.
- Cuts at F486, F541, F647, F683, F708, F739 are decisive. Do not replace them all with 0.5-second dissolves; that removes the punctuation.
- Text modes are distinct: typewriter query, word-level claim entrances, per-glyph material logo construction, scattered model-name reassembly, and stable UI copy. One universal stagger treatment cannot substitute for all five.
- Saturated color is concentrated in atmospheric fields, marks, emphasis words, and activation. UI surfaces remain white with neutral text and thin gray controls.
- Background gradients are spatial, layered, and textured. A single two-stop linear gradient looks markedly flatter. The fine source texture is visible at native resolution; an authored deterministic noise field is an approximation.
- UI perspective has a narrative role in F1342–1439: cursor badges are foreground anchors while a tilted board moves beneath them. The task actually moves from Ready to Complete. This is an interaction with a visible outcome, not arbitrary panning across a still.
- The long final logo hold is intentional: the full mark finishes around F1616 and remains through F1700 before a 40-frame fade. Avoid spending the whole film on long holds, but reserve a clean ending.

## Complete shot/subshot map

All ranges are inclusive native frames; time end is exclusive. Per-frame CSV/JSON is in the ignored evidence directory above. The observations describe visible changes; they do not assert unseen product behavior or audio timing.

| ID | Native frames | Seconds | Observation |
|---|---:|---:|---|
| CU-001 | 0–11 | 0.000–0.400 | Bracketed Your glyph reveal |
| CU-002 | 12–24 | 0.400–0.833 | AI added; bracket makes room |
| CU-003 | 25–31 | 0.833–1.067 | Gradient forgets types |
| CU-004 | 32–47 | 1.067–1.600 | Old words dissolve into wire fragments; everything begins |
| CU-005 | 48–61 | 1.600–2.067 | everything. completes; prior words vanish |
| CU-006 | 62–88 | 2.067–2.967 | White text on expanding orange luminous wash |
| CU-007 | 89–95 | 2.967–3.200 | Right-to-left glyph removal |
| CU-008 | 96–113 | 3.200–3.800 | Full multicolor field; white pieces rotate into mark |
| CU-009 | 114–125 | 3.800–4.200 | White reset; gradient mark settles |
| CU-010 | 126–143 | 4.200–4.800 | Mark shifts left; wordmark builds from glyph parts |
| CU-011 | 144–167 | 4.800–5.600 | Wordmark hold and slight enlargement |
| CU-012 | 168–169 | 5.600–5.667 | Chevron rapidly scales through frame |
| CU-013 | 170–185 | 5.667–6.200 | Large white Ours doe types over saturated gradient |
| CU-014 | 186–202 | 6.200–6.767 | Hard scale reset to small gradient Ours doesn’t. |
| CU-015 | 203–219 | 6.767–7.333 | Gray glyph rows arrive in perspective; previous claim fades |
| CU-016 | 220–235 | 7.333–7.867 | ClickUp/Brain2 microtype texture fills frame |
| CU-017 | 236–245 | 7.867–8.200 | Outlined brain and gray bars enter |
| CU-018 | 246–276 | 8.200–9.233 | Orange/pink selection bars reveal across rows |
| CU-019 | 277–289 | 9.233–9.667 | Faceted flower grows and rotates toward camera |
| CU-020 | 290–307 | 9.667–10.267 | Petals round and fill most of height |
| CU-021 | 308–311 | 10.267–10.400 | Black outlined flower expands; bright flower extinguishes |
| CU-022 | 312–343 | 10.400–11.467 | Luminous stroke draws numeral2 inside nested outlines |
| CU-023 | 344–349 | 11.467–11.667 | Completed2 moves upper right |
| CU-024 | 350–364 | 11.667–12.167 | Brain2 wordmark and flower arrive |
| CU-025 | 365–384 | 12.167–12.833 | Glow brightens; logo recedes to smaller scale |
| CU-026 | 385–404 | 12.833–13.500 | Dark logo hold with floor-like colored glow |
| CU-027 | 405–420 | 13.500–14.033 | Cut white; flower shrinks into soft halo |
| CU-028 | 421–425 | 14.033–14.200 | It enters from below |
| CU-029 | 426–432 | 14.200–14.433 | remembers. appears and settles |
| CU-030 | 433–448 | 14.433–14.967 | Complete claim hold under material flower |
| CU-031 | 449–462 | 14.967–15.433 | Huge gradient-rim field slides in from right; placeholder cropped intentionally |
| CU-032 | 463–463 | 15.433–15.467 | Placeholder clears and orange caret appears |
| CU-033 | 464–485 | 15.467–16.200 | Summarize today’s tasks begins one glyph per frame; right crop remains |
| CU-034 | 486–499 | 16.200–16.667 | Hard cut to full composer over saturated texture; rapid scale-down |
| CU-035 | 500–508 | 16.667–16.967 | Readable full-query hold |
| CU-036 | 509–513 | 16.967–17.133 | Cursor enters; camera begins submit push |
| CU-037 | 514–518 | 17.133–17.300 | Extreme lower-right UI crop reached |
| CU-038 | 519–524 | 17.300–17.500 | Cursor approaches submit arrow |
| CU-039 | 525–535 | 17.500–17.867 | Submit becomes pink and glows |
| CU-040 | 536–540 | 17.867–18.033 | Submit color returns; camera holds before cut |
| CU-041 | 541–559 | 18.033–18.667 | Cut white; pill scales down while Thinking types |
| CU-042 | 560–584 | 18.667–19.500 | Pill holds with moving diffuse multicolor halo |
| CU-043 | 585–588 | 19.500–19.633 | Brief anticipation scale-up |
| CU-044 | 589–599 | 19.633–20.000 | Pill becomes four-point pillow; layered UI expands to edges |
| CU-045 | 600–634 | 20.000–21.167 | Full workspace landscape drifts behind center Thinking |
| CU-046 | 635–646 | 21.167–21.567 | Slight global enlargement prepares collapse |
| CU-047 | 647–657 | 21.567–21.933 | Cut to floating workload artifact; slight rotation levels |
| CU-048 | 658–668 | 21.933–22.300 | Task-list artifact rises in front; badge10 |
| CU-049 | 669–682 | 22.300–22.767 | Calendar artifact rises in front; badge15 |
| CU-050 | 683–683 | 22.767–22.800 | One white reset frame |
| CU-051 | 684–694 | 22.800–23.167 | Oversize gradient Agent types |
| CU-052 | 695–707 | 23.167–23.600 | Agents completes and luminous halo grows |
| CU-053 | 708–718 | 23.600–23.967 | Sudden scale-down to Agents work.; huge cropped flowers enter |
| CU-054 | 719–738 | 23.967–24.633 | Flower-border composition settles |
| CU-055 | 739–757 | 24.633–25.267 | Graphic match-cut into filmed laptop; camera pulls back |
| CU-056 | 758–775 | 25.267–25.867 | Person and desk enter broader composition |
| CU-057 | 776–814 | 25.867–27.167 | Hand reaches lid; slow continued camera retreat |
| CU-058 | 815–832 | 27.167–27.767 | Laptop closes |
| CU-059 | 833–845 | 27.767–28.200 | Closed laptop hold; copy starts behind person |
| CU-060 | 846–858 | 28.200–28.633 | You close the laptop. completes as person stands |
| CU-061 | 859–886 | 28.633–29.567 | Person stands and walks left |
| CU-062 | 887–906 | 29.567–30.233 | Person exits; full benefit sentence clears |
| CU-063 | 907–923 | 30.233–30.800 | Empty desk and sentence hold |
| CU-064 | 924–944 | 30.800–31.500 | Cut white; composer enters and camera pushes toward Max |
| CU-065 | 945–963 | 31.500–32.133 | Macro cursor move and button accent stroke |
| CU-066 | 964–979 | 32.133–32.667 | Menu grows upward; colored wipe labels stagger |
| CU-067 | 980–998 | 32.667–33.300 | Camera follows menu; model labels resolve |
| CU-068 | 999–1015 | 33.300–33.867 | Complete menu hold |
| CU-069 | 1016–1034 | 33.867–34.500 | Scattered letters assemble Claude over peach halo |
| CU-070 | 1035–1039 | 34.500–34.667 | Claude hold |
| CU-071 | 1040–1064 | 34.667–35.500 | Claude disperses; ChatGPT assembles over gray halo |
| CU-072 | 1065–1069 | 35.500–35.667 | ChatGPT hold |
| CU-073 | 1070–1094 | 35.667–36.500 | ChatGPT disperses; Gemini assembles over pink/blue halo |
| CU-074 | 1095–1107 | 36.500–36.933 | Gemini hold |
| CU-075 | 1108–1131 | 36.933–37.733 | Menu returns; Gemini selected; card recedes |
| CU-076 | 1132–1139 | 37.733–38.000 | It appears beside cycling model column |
| CU-077 | 1140–1199 | 38.000–40.000 | It picks hold; model identities cycle vertically |
| CU-078 | 1200–1224 | 40.000–40.833 | Your context. types at center over small halo |
| CU-079 | 1225–1238 | 40.833–41.300 | Large flower recedes; surrounding integration tiles arrive |
| CU-080 | 1239–1268 | 41.300–42.300 | Flower and integrations drift in airy depth |
| CU-081 | 1269–1291 | 42.300–43.067 | Every app. types and holds |
| CU-082 | 1292–1311 | 43.067–43.733 | Jason pill forms cursor corner and settles |
| CU-083 | 1312–1341 | 43.733–44.733 | Lucia joins; two cursor badges align |
| CU-084 | 1342–1387 | 44.733–46.267 | Tilted workload UI; named cursors move across bars |
| CU-085 | 1388–1407 | 46.267–46.933 | Cut to angled board; camera follows Lucia |
| CU-086 | 1408–1420 | 46.933–47.367 | Hire brilliant engineers card lifts and shifts toward Complete |
| CU-087 | 1421–1439 | 47.367–48.000 | Card settles in Complete; camera pulls back |
| CU-088 | 1440–1477 | 48.000–49.267 | Every teammate. types and holds |
| CU-089 | 1478–1488 | 49.267–49.633 | It enters on plain white |
| CU-090 | 1489–1499 | 49.633–50.000 | already appears |
| CU-091 | 1500–1505 | 50.000–50.200 | Gradient knows. types |
| CU-092 | 1506–1544 | 50.200–51.500 | It already knows. holds then begins scaling |
| CU-093 | 1545–1548 | 51.500–51.633 | Huge knows camera push; flower appears inside o |
| CU-094 | 1549–1568 | 51.633–52.300 | Macro typography holds around growing flower |
| CU-095 | 1569–1591 | 52.300–53.067 | Cut to rotating separated ClickUp mark pieces |
| CU-096 | 1592–1601 | 53.067–53.400 | Mark settles and moves left |
| CU-097 | 1602–1615 | 53.400–53.867 | Wordmark assembles from individual glyph parts |
| CU-098 | 1616–1700 | 53.867–56.700 | Clean wordmark hold with very slow recede |
| CU-099 | 1701–1740 | 56.700–58.033 | Whole image fades through gray to black |
