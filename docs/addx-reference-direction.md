# Addx launch-film direction

The user's latest visual benchmark is the [Addx launch portfolio](https://addxstudio.com/launch). This direction supersedes the earlier fixed six-beat reference as the creative benchmark. It does not change source-grounding, paid-work limits, original-speech rules, or delivery QC.

## What was actually inspected

Two complete public films were downloaded for local analysis from the exact links embedded in the portfolio, rather than inferred from their thumbnails. ElevenLabs was inspected at 1 fps across the whole film and at 4 fps in sequential contact sheets; ClickUp at 1 fps and 2 fps. The time ranges below are approximate, with 0.25–0.5 second sampling resolution. Selected shots were also examined at larger size. This is sampled visual inspection, not a claim to have watched every original frame continuously.

| Film | Public source | Downloaded duration | Local evidence |
| --- | --- | --- | --- |
| ElevenLabs feature film | [Addx's ElevenLabs video](https://youtu.be/6rN-mTeMEl0) | 28.054 s | `.local/addx-reference/elevenlabs.mp4`, `elevenlabs-motion-{0..3}.jpg` |
| ClickUp launch film | [Addx's ClickUp video](https://youtu.be/VFzmZBERFQ4) | 58.054 s | `.local/addx-reference/clickup.mp4`, `clickup-motion-{0..3}.jpg` |

The portfolio's [Scale AI film](https://youtu.be/X3SwLoWErnI) returned HTTP 403 for both the selected high-resolution stream and its ordinary combined format. An alternate [Elyxir film](https://www.youtube.com/watch?v=h9SkN-0lOTI) also returned 403. Neither is treated as inspected. Raw public page HTML, probe results, download metadata and SHA-256 provenance are retained in `.local/addx-reference/`.

**Sound was not audited.** Both downloaded files contain audio, but the available model interface explicitly does not support audio listening, and no provider transcription was requested. No claims about voiceover, music genre, sound effects or beat synchronization follow from this analysis. The files' motion suggests places where authored sound cues could help; that is a production proposal, not a listening observation.

## Observed visual structure

### ElevenLabs: one commercial idea made visual

| Approximate time | Observed treatment |
| --- | --- |
| 0–3.5 s | Currency glyphs switch, then become a dot-text symbol above dark stacked plates; small language labels orbit the subject. Scale and depth establish the pricing theme. |
| 3.75–5.5 s | Abrupt white editorial interjection; return to a dark price counter. The contrast interrupts the preceding rhythm. |
| 5.75–11.5 s | Plates accumulate one by one with small annotations. Each addition develops the same cost-stack argument instead of introducing a generic feature card. |
| 11.75–15.75 s | A green/blue luminous wash becomes a large orb, then contracts around the product identity. The orb carries the transition into the simplified offer. |
| 16.25–22.25 s | Shallow 3D trays separate and recombine around the orb; a compact connected system follows. Short benefit clauses accompany each change. |
| 22.5–28 s | Orb grows through the frame, returns as a small mark, then gives way to product identity and a stable final action. |

The film uses a consistent object vocabulary to explain one proposition. It contains little conventional application UI. This is evidence for concept-driven motion, not a requirement that every product receive the same orb/stack metaphor. [Actual film](https://youtu.be/6rN-mTeMEl0).

### ClickUp: claim, mechanism, outcome, broader relevance

| Approximate time | Observed treatment |
| --- | --- |
| 0–6.5 s | Short kinetic type, brand-color washes and a constructed logo reveal establish the argument and identity quickly. |
| 7–14.5 s | Typographic texture becomes a colorful product mark; a dark reveal punctuates the new version before a short memory claim. |
| 15–17.5 s | Close-up of an editable query, wider composer, then a much tighter view of the submit control. Cursor and submission form a causal sequence. |
| 18–22.5 s | A compact processing state expands into surrounding workspace views, then contracts into a result panel. The same visual center connects the shots. |
| 23–30.5 s | A benefit statement becomes the content on a filmed laptop. Pulling back reveals a person closing it and leaving: a concrete human outcome. |
| 31–39.5 s | Another close UI interaction opens a model selector; named alternatives become kinetic type, then return to the selector and a concise decision claim. |
| 40–48.5 s | Integration symbols, named collaborative cursors and moving workspace views broaden the story. Camera travel follows the relevant collaborators/content. |
| 49–58 s | Short concluding statement, a large type-driven transition, then a restrained logo hold and fade. |

The UI appears designed/composited for the film: selected controls and results dominate instead of presenting the entire application at constant scale. The exact authoring technique is unknown; these frames do not prove it was HTML, a live recording or a particular animation application. [Actual film](https://youtu.be/VFzmZBERFQ4).

## Reusable direction for this product

**Research and story.** Choose one narrow audience problem and one supported mechanism that changes an observable result. Research the exact controls, initial state, example input, decision, result and outcome before scripting. Select one primary workflow; a second workflow must add a different supported reason to care. Brand identity should arrive early, but there is no mandatory standalone brand card or six-template sequence. Keep one concluding action. Avoid filling slots with a pricing scene, three feature cards or a generic graph when the evidence does not call for them.

**Editorial rhythm.** Use a few semantic beats with multiple shots within the demonstration. Alternate short type punctuation with denser product action and a clear result hold. Suggested starting targets are 1–2 second text punctuation, 0.4–0.9 second camera moves, and 2–4 second readable demonstration/result shots. These are design targets, not permission to shorten the compiler's required reading time. A 20–28 second film can concentrate on one workflow; the 58-second ClickUp reference should not be squeezed into that duration by reproducing all its topics.

**UI choreography.** Reconstruct supported UI as editable DOM. Start with an actionable state, type a short example, show the relevant choice or control, commit the change, then show the supported result. Make the viewer's focal point change because the task advances. Every state/label/control remains bound to actual product evidence; illustrative input and actions remain recorded as such. Avoid camera movement that hides a state change. The screenshot is reference evidence, not the animated stage.

**Camera.** Establish enough context to recognize the product, push toward the input, reframe to the choice, and pull back to the resulting relationship or output. Prefer a sequence within one continuous UI stage over repeatedly reintroducing the same full panel. Camera framing should bind to validated element IDs/rectangles, not free-form model coordinates. Preserve state continuity when shots cut; a completed task must not reset to the initial UI just because the next scene begins.

**Typography.** Use large, very short editorial phrases as their own moments. During detailed UI actions, supporting copy should occupy less of the frame or disappear after its required hold. Avoid a permanent large headline above every shot. Accent a meaningful word or change in the story rather than decorating every sentence. Use the product's observed typography character, color palette and real identity assets within licensed/font and raster-resolution constraints.

**Transitions and identity.** Prefer a match in the subject across shots: control becomes result, result expands into workspace, product-colored surface becomes a brand reveal. Cuts and contrast resets can be more useful than a decorative transition on every boundary. Reuse one or two source-appropriate motifs; do not copy Addx clients' logos, clips, exact 3D objects, soundtrack or claims.

**Sound proposal, pending listening audit.** Preserve the current instrumental-only/no-new-TTS policy. Future authored cue timing should correspond to a visible submission, selection, reveal or result rather than one unrelated sound at an arbitrary scene boundary. Do not claim sound-style matching until the references have actually been heard.

## Gaps found at the initial audit

1. A `ui-demo` currently has one mostly fixed centered framing after its entrance. Typing and clicks work, but there is no input-to-control-to-result camera sequence. The major visual difference from ClickUp at 15–22.5 s is editorial framing, not the absence of another decorative transition.
2. Every scene carries the same large headline region. This creates a presentation-slide rhythm even when the inner UI changes. A dedicated type beat and a focused product shot need different copy hierarchy.
3. Separate scenes restart from the document's initial state. Our manual example reestablishes the original suggestions before restoring the completed link in the outcome shot. That interrupts causal continuity.
4. The source-specific identity is largely palette, logo and a general reveal. Reference motifs change in service of the product argument; our generic planes/connection diagram can add movement without explaining anything new.
5. The old default reference profile still describes a six-beat hook/brand/proof/features/offer/CTA film. That conflicts with this newer product-specific direction and risks rewarding template conformity in QC.

## Smallest practical next implementation

The first three changes below are the minimum material improvement; a general 3D system, generative footage or arbitrary model-written code is unnecessary.

1. **Add bounded camera shots to `ui-demo`.** Two or three trusted keyframes target existing element IDs (or the complete document), with integer start/duration, deterministic easing and a conservative zoom cap. Derive the camera from element bounds. Enforce visible targets, frame confinement, readable terminal holds and a valid full-document establishment. Derive every frame from the existing seek clock. Keep camera transforms on the UI container so text and cursor move together.
2. **Add a small copy-hierarchy choice.** Keep current headline behavior for legacy plans; new shots can choose a short full-screen editorial phrase or a compact supporting caption. The compiler still inventories every rendered word and reserves its reading hold. Do not let the model insert arbitrary CSS or bypass overflow checks.
3. **Preserve UI state across adjacent shots.** Prefer one document/action timeline with camera changes. If story roles require another scene, bind its starting state to the prior scene's validated final state rather than replaying `states[0]`. Never mutate the retained original document to achieve continuity.
4. **Replace the fixed six-beat creative instruction.** Ask the script for a causal workflow and a distinct visual purpose for each shot. Update the default reference/QC description to evaluate explanation, attention and continuity, while keeping factual, audio, source, technical and runtime gates. Do not silently increase stage/model/audio limits.

New camera endpoints and state boundaries must be included in deterministic export checks and the semantic sample inventory before paid calls are reserved. If added samples cannot fit the existing job budget, simplify the shot sequence. Apply existing no-screenshot-substitution, no-invented-capability and uncertain-paid-work safeguards unchanged.

For an Obsidian demonstration, a concrete direction would be: a brief problem about disconnected ideas → identify Obsidian while establishing a real note → move into the observed link query while typing → follow the documented suggestion and click → pull back to the resulting linked note/relationship → one download action. A graph payoff is appropriate only if its reconstructed source and resulting relationship are actually supported; a generic decorative network does not establish that proof.

The reference audit itself made no worker changes or paid provider calls and did not alter production jobs or prior acceptance artifacts.

## Subsequent implementation and limits

The draft now implements a causal version 3 direction profile, compact UI captions and deterministic camera framing derived from existing action targets. The camera establishes context and returns to a complete result hold; existing action samples verify its focus. Scripts are instructed to keep each workflow in one continuous scene through its result. General cross-scene state inheritance and arbitrary shot keyframes are not implemented.

A separate manually scripted camera demo passed export, frame comparison and alternate-format preflight checks. Automatic UI generation still needs a complete successful acceptance run before release. See [the validation record](UI-RECONSTRUCTION-VALIDATION.md) for the exact distinction between renderer evidence and automatic generation failures. These changes do not establish parity with the benchmark's bespoke art direction, 3D work, live-action photography or sound production.
