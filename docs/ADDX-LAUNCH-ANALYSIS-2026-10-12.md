# ADDX launch-video analysis — 12 October 2026

The next improvement should be a **shot director between scripting and rendering**. Our engine already reconstructs UI and moves a camera. What is missing is deliberate control over which part of the product owns the frame, how that changes inside a workflow, and how the same object carries meaning into the next shot.

This is a research and implementation proposal. Production code, generation settings and deployments were not changed in this pass.

## Collection and coverage

The current [ADDX launch page](https://addxstudio.com/launch) contains seven featured films, four campaign films and an agency hero video. Testimonials were excluded. The campaign parameter in the supplied link mentions Nexus; the retrieved page did not identify a Nexus portfolio film. The hero's public metadata identifies it as the agency's VSL, not a Nexus demo.

Eight portfolio films were downloaded or recovered from our previously verified cache. Together they contain **516.98 seconds** of material. I inspected **516 full-duration one-fps samples**, then **213 additional samples at four or five fps** across nine selected action/transition windows. There are **163 annotated view ranges**. Boundaries are approximate, typically within one second in the overview and 0.2–0.25 seconds in the detailed windows. This is not an every-native-frame audit, an audio listening review, or advertising-performance evidence.

Full copies, page HTML, download logs, hashes, probe metadata, contact sheets and a playable scene atlas are retained privately in `.local/addx-20261012/`. The atlas uses the downloaded originals and supports timestamp navigation. No reference videos were republished on our public site.

| Film | Length | Available evidence |
|---|---:|---|
| CraftedStays | 51.48s | Fresh 1080p download; full overview; two detailed windows |
| ClickUp | 58.05s | Previously verified 1080p file of the same embedded YouTube ID; full overview and new detail window |
| Oblist | 38.64s | Fresh 1080p download; full overview and detailed reveal |
| SOVRA FM | 52.18s | Fresh 1080p download; full overview and detailed action/result |
| Commas | 35.05s | Fresh 720p embedded MP4; full overview and detailed checkout |
| Merit / Echo | 57.86s | Fresh 720p embedded MP4; full overview and detailed credit-object sequence |
| Goosework | 70.49s | Fresh 720p embedded MP4; full overview and detailed email sequence |
| Morphic | 153.24s | Fresh 720p embedded MP4; full overview and detailed draft/send sequence |
| Elyxir, Loud Commerce, Scale AI | — | Public metadata available; both selected high-resolution and ordinary combined media requests returned HTTP 403. Not visually analyzed in this pass. |
| Agency hero | — | Metadata available; media requests returned HTTP 403. Excluded from the portfolio findings. |

## What is consistent—and what is not

**They design attention at the shot level.** The film selects an input, a button, a result or a single phrase as the primary subject. Application chrome disappears when it is not needed. A workflow can contain several camera setups without becoming several unrelated scenes. ClickUp's input, composer and submit views at roughly 15–18s are the clearest compact example. SOVRA's 20–26s sequence makes the same distinction.

**The action has a visible consequence.** Commas keeps a webinar visible while an offer changes into checkout, processing and confirmation. The viewer can see the commercial difference without relying on a second explanatory paragraph. A convincing sequence needs the same example data and recognizable objects across its states; an attractive success card alone does not establish causality.

**A brand has a visual vocabulary, beyond its colors.** CraftedStays repeats rings, flutes and the cabin. SOVRA uses artwork, ribbons and a small character. Goosework repeats a dock and character cards. Echo uses a hexagonal mark, a credit voucher and connected infrastructure. These choices relate to each film's idea. A generic glowing orb on every customer's video would miss the lesson.

**Contrast has several dimensions.** Small-to-large, dense-to-empty, flat-to-dimensional, product-to-person and motion-to-stillness all create emphasis. Some films also switch dark and light. SOVRA largely stays dark; Oblist deliberately delays its visual release. Neither supports a rule that every film needs repeated bright flashes or constant high-speed motion.

**Foreground and background do different jobs.** The subject can hold while a gradient, landscape, lighting effect or secondary object continues moving. Cursor travel, text, object arrival and camera travel are offset in time. A single entrance animation applied to an entire panel cannot produce that layering.

**Several films use ingredients outside HTML UI.** ClickUp, Commas, Echo and Morphic contain filmed people; other examples use photography, dimensional objects or scenic backgrounds. We can compose licensed or user-supplied media inside HTML, but should not promise that CSS gradients reproduce their materials or that an arbitrary URL supplies those assets.

**There is no universal duration or formula.** The inspected software-led films range from about 35 to 70 seconds, while Morphic is a 153-second founder narrative. Oblist is a furniture film built around anticipation. Our 18-second social cuts should borrow selected mechanisms, not compress every reference topic into the same length. The page's view counts and viral marketing language do not establish paid conversion performance.

## What our code already does

The October 5 showcase films are manually directed compositions in `studies/launch-*-social.ts`. They demonstrate what the renderer can draw; they do not prove that the automatic planner can choose equivalent direction.

The automatic path already includes:

- Source-bound research, reconstructed UI elements and illustrative states.
- A creative brief and concept selection in `worker/creative-direction.ts`.
- Immutable source-bound shot recipes in `worker/shot-recipes.ts`.
- An action-following camera in `worker/ui-camera.ts`.
- Deterministic frame evaluation, UI continuity checks and export QA.

The current constraints that matter visually:

| Current behavior | Implication | Proposed change |
|---|---|---|
| `expectedUiCamera` uses the union of action-target bounds, caps zoom at 1.45 and returns wide after the last action | It preserves context but limits extreme control close-ups and editorial reframing | Explicit shot-specific focus groups; separate establishment, input, commit and result framing |
| `ShotRecipe` primarily binds role, template, asset and visual kind | Selecting a valid recipe does not design the shot's composition | Add a bounded director record describing subject, framing, copy role, motion layers and exit |
| Directed motion has reusable entrances and broad concept choices | Many products inherit a similar reveal rhythm | Product-specific visual-system selection and a shot contrast plan |
| `cut`, `iris`, `lift`, `expand` transitions use generic geometry; animated transitions are capped at 12 frames | Boundaries seldom inherit an actual button, card or result object | Add identity-bound object transitions and masks; retain plain cuts where clearer |
| UI elements are reconstructed into a common document style system | Accurate state does not automatically imply expressive art direction | Treat presentation layers separately from the immutable product state |

Do not solve this by removing the zoom cap globally, allowing arbitrary model-written JavaScript, or weakening reading and source checks. Introduce a new versioned shot contract and validate the intended framing instead.

## Implementation batch

### D1 — A director pass before rendering (P0)

Extend the grounded brief with audience moment, visual argument, recurring subject, material family and intended contrast. Compile a sequence of shots with `job`, `subjectIds`, `framing`, `copyRole`, `actionWindow`, `resultHold`, `layers` and `exit`. Keep references to existing source facts and UI states. Version the saved contract so resumed jobs retain their original behavior.

**Done when:** every shot explains what the viewer should notice and why the next view follows; the planner cannot satisfy direction with an unrelated decorative object. A storyboard preview shows the actual planned composition before a paid final render.

### D2 — Explicit semantic camera shots (P0; depends on D1)

Extend `worker/ui-camera.ts` with bounded establishment, detail, action and result shots. Frame selected element groups instead of the union of all future action targets. Allow irrelevant chrome outside a close-up while preserving the active control, cursor and necessary context. Use independent framing for landscape, feed and vertical.

**Done when:** one reconstructed UI can reproduce the grammar “input close-up → context → commit close-up → result” without a state reset. Validate essential bounds, effective type size, forward/backward seek determinism and complete result holds at each aspect ratio.

### D3 — Objects that survive transitions (P0; depends on D1–D2)

Introduce a trusted shared-object transition between adjacent shots. Bind both ends to the same entity and explicit states. Support position/scale/mask changes, a panel becoming a close-up, and a result moving into a new layout. Keep semantic identity separate from decorative motif identity. A label morph must not imply an undocumented product operation.

**Done when:** no duplicate ghost labels, unexplained value changes, disappearing results or fabricated success. The departing object and arriving object can be traced in the saved plan and decoded frames.

### D4 — A small library of visual systems (P1; depends on D1)

Start with editorial typography, product workbench, diagram/relationship, photographic stage and human-plus-product. Each system defines restrained materials, shadows, depth, mask styles and typography hierarchy. Choose from product evidence and available media, not a random reference brand. Optional dimensional assets need known provenance and deterministic rendering.

**Done when:** three unrelated brands have recognizably different composition and material choices even in grayscale, while their palettes and real interface identity remain intact. Do not distribute reference client assets as templates.

### D5 — Independent tracks and planned contrast (P1; depends on D1–D3)

Give copy, cursor, product state, camera and secondary material separate tracks on the same frame clock. Plan a few meaningful contrast changes; preserve quiet proof. Starting design targets, not measured reference averages: roughly 0.25–0.7s camera moves, brief editorial punctuation, and complete 1.5–3s result holds where copy permits. Existing reading requirements override these targets.

**Done when:** muted phone-size review identifies the action before the result; background motion never competes with essential proof. Review dense transition samples as well as isolated keyframes. Audio accents can follow validated events in a later listening-reviewed pass.

### D6 — Asset-aware research (P1; feeds D1 and D4)

Research the actual control/state/result and the customer's desired situation. Collect real product identity, typography, public demos and permissioned media. Record whether a human payoff, product photo or dimensional asset actually exists. Use a graphic consequence when footage is unavailable rather than implying we filmed a customer.

**Done when:** the director knows which visual options are available before selecting a concept; every product behavior and supplied media asset retains its provenance.

### D7 — Placement composition, including landscape (P1; depends on D2–D5)

Carry one story through separately directed 16:9, 4:5 and 9:16 framing. Preserve a landscape master for site/demo use; produce placement-specific social editions. Reposition subjects and change shot choices rather than center-cropping a completed movie. Retain the current metadata, decode, fidelity and audio checks.

**Done when:** the same action/result is readable in all three formats, with no hidden CTA or framing-induced false state. The current six social showcase files are not substitutes for a newly directed landscape version.

### D8 — Prove the automatic path (P0 acceptance; depends on D1–D7)

Use one existing brand as a controlled motion comparison, then three previously unused URLs as generalization tests. Save research, storyboard, director plan and final exports. Compare the same script, soundtrack, length and format when evaluating direction alone. Reject improvements that exist only in manually authored study code.

**Done when:** the automatic path produces source-valid, coherent action/result stories and passes deterministic/technical checks; at least four of five unfamiliar reviewers can identify audience, action, result and CTA without explanation. That comprehension threshold is a proposed gate, not a completed result. Paid effectiveness requires a separate experiment with agreed activation metrics and spend.

## How this changes our next three films

| Film | Specific direction to prototype | Keep |
|---|---|---|
| Linear | Make the issue the traveling subject: establish it, isolate delegation, follow it into a clearly draft result, then reframe for review | Issue identity, draft status, human review, brand palette |
| Tally | Isolate one missing piece of enquiry information, show the relevant form action in close-up, then make the completed answer the payoff | Separate build/publish/submit actions; no suggestion that DMs were automatically imported |
| Todoist | Follow the same sentence from interruption to input, separate the date/priority transformations, then settle on the saved pending task | Exact task/date/priority continuity; no claim that the proposal was sent |

The first prototype should test D2 and D3 on one workflow using the existing renderer. More music intensity, saturated replacement colors or extra decorative particles would not answer the gap found here.

## View-by-view evidence

The following view ranges are visual observations, not verified claims about the advertised products. The private atlas provides the source video and clickable timestamps for each row. The scene listing is generated from the retained annotation record; unavailable films are never treated as inspected.

<!-- SCENE_TABLES -->

### CraftedStays

[Original source](https://www.youtube.com/watch?v=prcwCUzqnwA) · 51.48s · 1920×1080

A recognizable property remains the anchor while framing, interface and surrounding material change.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:02.0 | Property / promise | Cabin landscape establishes the customerâ€™s desirable end product. |
| 00:02.0–00:04.0 | Before / device | The property becomes a conventional booking website inside a monitor. |
| 00:04.0–00:06.0 | Transformation | A redesigned site replaces it; colored flutes surround the screen. |
| 00:06.0–00:08.0 | Social response | Reaction bubbles accumulate around the same monitor. |
| 00:08.0–00:10.0 | Brand transition | Repeated dimensional rings resolve into the product identity. |
| 00:10.0–00:13.0 | Editorial bridge | Short category copy travels through the fluted visual environment. |
| 00:13.0–00:15.0 | Action close-up | An oversized booking button and cursor punctuate the proposition. |
| 00:15.0–00:17.0 | Connection diagram | Cursor connects a property-management label to the brand mark. |
| 00:17.0–00:20.0 | Product result | Listing cards populate and remain readable while framing changes. |
| 00:20.0–00:22.0 | Analysis introduction | The original cabin returns with an analysis message. |
| 00:22.0–00:25.0 | Report close-up | Forecast details expand into a complete report. |
| 00:25.0–00:27.0 | Benefit / report | The report moves aside for a concise strategic benefit. |
| 00:27.0–00:28.2 | Control selection | An isolated toolbar introduces the assistant through its named control. |
| 00:28.2–00:31.8 | Input sequence | Assistant opens; camera approaches typing, then retreats after submission. |
| 00:31.8–00:33.0 | Generated result | The cabin site returns as the demonstrated output. |
| 00:33.0–00:35.0 | Second instruction | A floating command requests a change to the same site. |
| 00:35.0–00:37.0 | Updated website | Monitor reveals the revised hero and celebratory accents. |
| 00:37.0–00:40.0 | Type punctuation | Large traveling text introduces a discovery problem. |
| 00:40.0–00:45.0 | Outcome visualization | Visitor cursors surround the site; booking labels stack beside it. |
| 00:45.0–00:48.0 | Benefit sequence | Three sparse statements replace the dense product imagery. |
| 00:48.0–00:51.5 | Brand / close | Dimensional rings repeat, then settle into logo and URL. |

### ClickUp

[Original source](https://youtu.be/VFzmZBERFQ4) · 58.05s · 1920×1080

A single workflow receives several camera setups; the benefit then becomes a human action.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:03.0 | Type hook | Compressed phrases establish the argument against a bright field. |
| 00:03.0–00:06.0 | Brand assembly | Logo pieces assemble through a branded color wash. |
| 00:06.0–00:07.0 | Counterstatement | Short copy resets the frame before the product reveal. |
| 00:07.0–00:09.0 | Type texture | Repeated words become a patterned field around a central mark. |
| 00:09.0–00:12.0 | Hero object | Dimensional flower grows, followed by a dark version reveal. |
| 00:12.0–00:14.0 | Identity hold | The product name settles against darkness. |
| 00:14.0–00:15.0 | Promise | Sparse copy links the mark to memory. |
| 00:15.0–00:16.2 | Input close-up | Typing dominates the frame; surrounding application chrome is omitted. |
| 00:16.2–00:17.2 | Composer context | Camera reveals the complete composer and retained query. |
| 00:17.2–00:18.0 | Commit close-up | Camera isolates the submit control and approaching cursor. |
| 00:18.0–00:20.0 | Processing | A compact status pill replaces the composer. |
| 00:20.0–00:22.0 | Context expansion | Workspace panels surround the same central product motif. |
| 00:22.0–00:23.0 | Result | Panels contract into a compact output view. |
| 00:23.0–00:25.0 | Benefit typography | Large text and the flower motif introduce autonomous work. |
| 00:25.0–00:31.0 | Human payoff | The graphic appears on a laptop; a person closes it and leaves. |
| 00:31.0–00:34.0 | Second workflow | A model control opens its menu in close-up. |
| 00:34.0–00:38.0 | Editorial options | Model names become typography before returning to the selection. |
| 00:38.0–00:43.0 | Broader context | Copy, integrations and the central motif develop connected context. |
| 00:43.0–00:48.0 | Collaboration | Named cursors lead camera movement through workspace details. |
| 00:48.0–00:58.1 | Conclusion | Sparse benefit copy resolves into a restrained logo hold. |

### Oblist

[Original source](https://www.youtube.com/watch?v=N-WftcsNjPA) · 38.64s · 1920×1080

The deliberate exception: anticipation and negative space make the later product imagery feel larger.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:03.0 | Interruption | Small centered type interrupts the viewer against warm empty space. |
| 00:03.0–00:04.0 | Question setup | A short question replaces the first phrase. |
| 00:04.0–00:07.0 | Kinetic sentence | Words build, scatter and regroup through changing positions. |
| 00:07.0–00:09.0 | Situation | The sentence invokes a visitor entering a home. |
| 00:09.0–00:12.0 | Pause | Minimal incremental wording slows the cadence deliberately. |
| 00:12.0–00:13.0 | Object glimpse | A furniture photograph briefly interrupts the typography. |
| 00:13.0–00:15.0 | Visual question | An image stack appears between separated words. |
| 00:15.0–00:19.0 | Suspense | Conditional wording develops through restrained holds. |
| 00:19.0–00:23.3 | Resolution | A short conclusion finishes the question before the visual release. |
| 00:23.3–00:26.7 | Material reveal | Type gives way to a softly lit wall; camera reveals furniture below. |
| 00:26.7–00:33.0 | Product series | Furniture swaps while split words maintain a stable visual scaffold. |
| 00:33.0–00:38.0 | Brand / approach | Large identity overlays a chair as the camera approaches. |
| 00:38.0–00:38.6 | End | The frame resolves to darkness. |

### SOVRA FM

[Original source](https://youtu.be/16xygqeHet0) · 52.18s · 1920×1080

The camera treats the prompt, button, progress and album as different shots of one causal sequence.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:02.0 | Object interruption | Music tile follows a ribbon into an abrupt typographic interruption. |
| 00:02.0–00:06.0 | Problem | A music-listening claim builds beside the same artwork. |
| 00:06.0–00:09.0 | Existing behavior | Playlist cards fan out and slide past the cursor. |
| 00:09.0–00:12.0 | Queue | A queue appears, extending into a moving track list. |
| 00:12.0–00:15.0 | Repetition metaphor | Nested purple pills expand through three repetitive-listening ideas. |
| 00:15.0–00:17.0 | Reset | Sparse text creates anticipation before the demonstration. |
| 00:17.0–00:20.0 | Input context | A glowing prompt field appears and accepts an example. |
| 00:20.0–00:21.6 | Input close-up | Camera advances across the completed prompt toward the action. |
| 00:21.6–00:22.8 | Commit | The cursor approaches and presses the isolated create control. |
| 00:22.8–00:25.2 | Progress | The interface becomes a compact generation status. |
| 00:25.2–00:27.0 | Result reveal | Finished status yields to an album cover and emerging disc. |
| 00:27.0–00:29.0 | Value statement | Short copy links the album to originality. |
| 00:29.0–00:32.0 | Character metaphor | A small glowing character introduces the presenter concept. |
| 00:32.0–00:35.0 | Reactive system | Labeled ribbons move around the character. |
| 00:35.0–00:38.0 | Second action | A face card and upload control demonstrate another input. |
| 00:38.0–00:40.0 | Personal consequence | Sparse personal-benefit phrases replace the interface. |
| 00:40.0–00:43.0 | Alternatives | Familiar music-service symbols are selected and dismissed. |
| 00:43.0–00:46.0 | Positioning | Short statements define the personal broadcast idea. |
| 00:46.0–00:52.2 | Brand / action | Product identity and a concise action settle for the ending. |

### Commas

[Original source](https://framerusercontent.com/assets/dYPTBha6wImMpdjsXYgHKvcAQ.mp4) · 35.05s · 1280×720

The checkout remains inside the webinar frame, making the promised difference visibly concrete.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:01.0 | Familiar category | Short copy introduces a familiar webinar format. |
| 00:01.0–00:02.0 | Human context | A presenter appears inside a live-video interface. |
| 00:02.0–00:04.0 | Contrast reset | Darkness cuts to a bright field carrying the differentiating promise. |
| 00:04.0–00:04.4 | Identity | The logo resolves before the product demonstration. |
| 00:04.4–00:05.6 | Offer close-up | An offer panel enters beside the still-visible presenter. |
| 00:05.6–00:07.8 | Checkout | An inline payment form replaces the offer in the same panel. |
| 00:07.8–00:09.4 | Processing | Button action leads to an order-processing state. |
| 00:09.4–00:10.4 | Confirmation | Success appears without leaving the webinar composition. |
| 00:10.4–00:13.0 | Host context | Camera pulls out to the larger host workspace. |
| 00:13.0–00:15.0 | Editorial bridge | Scenic background and oversized cursor introduce another delivery mode. |
| 00:15.0–00:17.0 | Live option | A live presenter appears inside a compact frame. |
| 00:17.0–00:19.0 | Recorded option | Short copy introduces prerecorded delivery. |
| 00:19.0–00:22.0 | Authoring action | Editor closes in on scheduled events and a poll. |
| 00:22.0–00:24.0 | Live result | Group video and poll results reveal the eventâ€™s destination. |
| 00:24.0–00:26.0 | Commercial payoff | Sales panel appears beside a concise consequence. |
| 00:26.0–00:28.0 | Alternative outcome | The film introduces booking calls instead of immediate payment. |
| 00:28.0–00:31.0 | Booking proof | An appointment calendar appears alongside the webinar. |
| 00:31.0–00:35.1 | Brand / close | A short invitation resolves into the identity over landscape. |

### Merit Systems / Echo

[Original source](https://framerusercontent.com/assets/ntH0cHb4iyMJalEZ7Ai8hcRc.mp4) · 57.86s · 1280×720

The founder supplies a human anchor while repeated credit, lock and network objects explain an abstract system.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:02.0 | Founder | A presenter establishes the opening setting. |
| 00:02.0–00:05.0 | Type emphasis | Oversized words move around the presenter. |
| 00:05.0–00:06.0 | Identity | A clean mark introduces the product. |
| 00:06.0–00:08.0 | Market context | A moving wall of website panels expands the frame. |
| 00:08.0–00:11.0 | Abstract problem | Orb and graph imagery introduce friction. |
| 00:11.0–00:15.0 | Infrastructure | Service symbols and a lock orbit a luminous ring. |
| 00:15.0–00:16.0 | Cost object | An invoice becomes the focal object. |
| 00:16.0–00:18.0 | Type punctuation | Short temporal wording bridges back to the presenter. |
| 00:18.0–00:23.4 | Mechanism setup | Presenter and an overlaid code fragment introduce implementation. |
| 00:23.4–00:24.6 | Action metaphor | A file enters an isolated codebase target. |
| 00:24.6–00:27.0 | Credit reveal | A voucher rises beneath the target and approaches camera. |
| 00:27.0–00:29.0 | Persistent-object change | The voucher keeps its silhouette while labels and symbols change. |
| 00:29.0–00:33.0 | Responsibility field | Large repeated labels move behind the presenter. |
| 00:33.0–00:34.0 | Proof setup | Sparse copy introduces a transaction panel. |
| 00:34.0–00:39.0 | Product detail | Transaction values and explanatory elements occupy a tilted panel. |
| 00:39.0–00:43.0 | System diagram | A central branded disc connects to service symbols. |
| 00:43.0–00:47.0 | Example applications | Two scenic application examples broaden the use case. |
| 00:47.0–00:49.0 | Founder return | The presenter regains the complete frame. |
| 00:49.0–00:52.0 | Destination | Large URL typography directs the viewer. |
| 00:52.0–00:57.9 | Payoff / close | Presenterâ€™s concluding message yields to a stable identity. |

### Goosework

[Original source](https://framerusercontent.com/assets/02SgX2GImjuDBi9aRuZUzRBMrc.mp4) · 70.49s · 1280×720

A repeated application dock organizes multiple workflows; close-ups select one meaningful control at a time.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:02.0 | Input context | A prompt appears over a landscape. |
| 00:02.0–00:10.0 | Task examples | Camera approaches successive concrete example requests. |
| 00:10.0–00:12.0 | Workspace | A full interface briefly establishes the task destination. |
| 00:12.0–00:16.0 | Introduction | Character cards bridge sparse text into product identity. |
| 00:16.0–00:18.0 | Channel navigation | A dock introduces familiar communication channels. |
| 00:18.0–00:22.0 | First channel | A message is composed before the complete chat workspace appears. |
| 00:22.0–00:24.0 | Channel switch | The dock returns and selects another channel. |
| 00:24.0–00:26.0 | Second message | A compact chat example develops into a sent request. |
| 00:26.0–00:29.0 | Mobile channel | Dock selection leads to a phone close-up. |
| 00:29.0–00:32.0 | Mobile result | The same message appears as a sent bubble. |
| 00:32.0–00:32.8 | Email selection | The dock isolates the mail application. |
| 00:32.8–00:34.0 | Compose action | A floating button receives the cursor. |
| 00:34.0–00:38.0 | Email construction | A composing window enters while the button remains beside it. |
| 00:38.0–00:42.0 | Status rhythm | Three sparse processing words change with soft color fields. |
| 00:42.0–00:46.0 | Execution proof | Workspace tasks and progress become the focus. |
| 00:46.0–00:51.0 | Result context | The camera returns to fuller task and schedule views. |
| 00:51.0–00:58.0 | Capability vocabulary | Character cards, labels and panels inventory the working environment. |
| 00:58.0–01:01.0 | Memory benefit | Returning character imagery introduces remembered context. |
| 01:01.0–01:06.0 | Human consequence | A chat-style response promises less supervision. |
| 01:06.0–01:10.5 | CTA | A concise invitation and destination conclude the film. |

### Morphic

[Original source](https://framerusercontent.com/assets/I8yybATGsZpKSFPcvqQmziadO28.mp4) · 153.24s · 1280×720

A long founder narrative earns an emotional payoff; this is a different format from a short software ad.

| Approximate range | View | What appears / changes |
|---|---|---|
| 00:00.0–00:07.0 | Domestic scene | Window-side conversation; the family context begins. |
| 00:07.0–00:12.0 | Distance | A corridor wide shot changes perspective. |
| 00:12.0–00:14.0 | Return | Window-side setting resumes. |
| 00:14.0–00:17.0 | Work setting | A second person approaches a laptop. |
| 00:17.0–00:25.0 | Conversation coverage | Close, side and wide working shots alternate. |
| 00:25.0–00:30.0 | Response | The window-side conversation returns. |
| 00:30.0–00:33.0 | Founder address | Direct-to-camera explanation replaces the dramatized scene. |
| 00:33.0–00:35.0 | Scale emphasis | Large numerals emphasize accumulated experience. |
| 00:35.0–00:39.0 | Memory imagery | Family photos gather inside a brain-like object. |
| 00:39.0–00:41.0 | Problem | The presenter returns before a diagram. |
| 00:41.0–00:49.0 | Loss metaphor | Document symbols converge into a retirement folder. |
| 00:49.0–01:00.0 | Broader relevance | Presenter, industry symbols and archival-style imagery alternate. |
| 01:00.0–01:04.0 | Industry field | Symbols accumulate around the presenter. |
| 01:04.0–01:06.0 | Fragmentation | Meeting and chat interfaces briefly interrupt. |
| 01:06.0–01:18.0 | Explanation | The presenter develops the disconnected-context problem. |
| 01:18.0–01:21.0 | Identity reveal | An enclosing object releases the product mark. |
| 01:21.0–01:25.0 | Product context | Interface panels enter over a landscape. |
| 01:25.0–01:27.0 | Presenter bridge | Brief return to direct address. |
| 01:27.0–01:33.0 | Agent introduction | A capability card leads into a prompt. |
| 01:33.0–01:37.0 | Integration setup | Presenter and service symbols introduce connections. |
| 01:37.0–01:43.0 | Connection examples | A single input swaps platform labels. |
| 01:43.0–01:50.0 | Context graph | Edges assemble around the presenter. |
| 01:50.0–01:57.0 | Task selection | A compact list leads into application details. |
| 01:57.0–02:02.2 | Drafting | Presenter and expanding message share the frame. |
| 02:02.2–02:04.0 | Send emphasis | Message persists while scenery and a send control enter. |
| 02:04.0–02:07.0 | Consequence | Presenter returns to explain reduced administration. |
| 02:07.0–02:10.0 | Type interruption | Short instruction alternates dark and light. |
| 02:10.0–02:14.0 | Presenter | Explanation resumes. |
| 02:14.0–02:18.0 | Ownership metaphor | Product mark receives an enclosing transparent form. |
| 02:18.0–02:23.0 | Resolution | Presenter and family imagery reconnect the narrative. |
| 02:23.0–02:26.0 | Emotional payoff | Sparse text resolves the opening concern. |
| 02:26.0–02:33.2 | Identity / CTA | Logo, positioning and demo destination settle. |
