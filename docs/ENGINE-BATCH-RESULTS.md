# Engine batch validation — 2 October 2026

Implementation and ownership are tracked in [the ticket batch](ENGINE-BATCH-2026-10.md). Creative acceptance uses [the export review rubric](ENGINE-CREATIVE-REVIEW.md). These results distinguish deterministic tests, authored fixtures, fresh provider runs and production deployment.

## Integrated checks

The integrated suite passed 365 tests, with 21 environment-specific integration tests skipped. Type checking and the production build passed. A separate opt-in browser/media run passed all 34 tests, including five integration cases skipped by the default suite. The new UI inspector's separate opt-in suite passed all 11 tests, including five browser cases skipped by default. Database/storage, PDF and other unrelated opt-in checks were not rerun for this batch. Targeted tests cover research/source bindings, compact UI documentation, creative direction, legacy compatibility, repair continuity, camera bounds in three aspect ratios, sound scheduling and benchmark attribution. Independent agent review found and resolved a sound-repair issue: the generated effect now remains available when one repair removes all scheduled cues and another restores them.

## Renderer evidence

The manually authored directed Obsidian fixture is saved at `.local/vs204-directed-fixture/project/motion-0/picture.mp4`: 1920×1080, 693 frames, 23.1 seconds, silent. Thirteen layout/UI-state/camera checks and ten decoded-frame comparisons passed, with SSIM .987530–.996175 against the browser render. Full decode and deterministic repeated seeking passed. Thirty-two exported action, hold and cut frames were inspected. This validates rendering mechanics, not automatic creative generation, listening, or reference equivalence.

Observed limitations remain: softer CSS materials than the references' volumetric objects, a repeated orb, a dense source note excerpt, and a slightly soft captured wordmark. Focus choreography was exported; connection/consolidation and source-identity continuity have unit coverage but still need separate export review.

## Actual source matrix

| Case | Test performed | Observed result | What remains unproven |
| --- | --- | --- | --- |
| Obsidian | Fresh provider-backed URL pipeline | Trial 2 reached a complete audiovisual draft with UI defects. Trial 5 passed research, documentation and scripting on first responses, then found actual UI text clipping before audio | Complete automatic quality pass and creative quality |
| Excalidraw | Public capture and structural readiness only, no model calls | Three assets, one UI candidate and 25 DOM elements; recognizable empty canvas and tools | Supported audience/workflow/outcome research and performed drawing/result |
| Example.com | Public capture and structural readiness only, no model calls | Two generic viewports, no product UI or workflow | Automatic semantic insufficient-evidence decision; structural readiness alone correctly does not claim product proof |

Capture observations are retained in `.local/engine-batch-capture-excalidraw-1790957245997` and `.local/engine-batch-capture-insufficient-1790957280803`. Excalidraw's captured brand metadata includes a description that the current source-fact catalog does not use; the capture-only test does not invent missing capability claims.

## Fresh automatic trial 1

Workspace: `.local/engine-batch-acceptance-20261002`. Runtime hash: `c4d59c24c48fd519d7898f998839b08e39191ee144f7759cc006117f334ab7f2`.

The research response needed its existing bounded correction for a region/parent fact mismatch. Both subsequent UI documents validated: the note-linking document used 2,068 output tokens and the graph document used 3,451, within the shared 6,000 allowance. This reaches beyond the previous truncated-document failure.

The five-scene script selected a focus region owned by a different source image and omitted the required outcome role. Its correction did not start: the fixed four-review reserve plus a full correction would have required 30,035 output tokens against the unchanged 30,000 limit. The run ended `needs_review` with 5 model calls, 60,770 input tokens, 13,035 output tokens and zero audio generations. No MP4 or delivered-quality pass was produced. Original responses, stage hashes and ledger remain intact.

The read-only benchmark reporter correctly returns `automaticLocalPass: false`. It also rejects manually authored fixtures, assisted retained-response recoveries, missing stage artifacts, modified hashes and incomplete required QC. A local pass can never certify production queue/storage access or subjective design preference.

The implemented correction addresses source/region selection, explicit outcome roles and review reservation proportional to a locally enforced corrected-scene ceiling. A five-scene correction reserves three full reviews: 13,035 consumed + 5,000 correction + 9,000 review output tokens = 27,035 within the same 30,000 limit. The compiler rejects excess corrected scenes, including legacy transports, before render or QC; this is not solely prompt guidance. New rejection diagnostics persist before budget checks, without consuming a retry slot. No provider limits or failed artifacts changed.

## Fresh automatic trial 2

Workspace: `.local/engine-batch-acceptance-20261002b`. Runtime hash: `3f9cfa940adc1619f3df96b4c953924d4fce6a4954642fde7dcf4bd9cf950f48`.

Research passed on its first response. Both UI documents validated using 1,941 and 3,230 output tokens. The initial script chose an incompatible source treatment; its bounded correction ran and validated within the unchanged budget. Both generated audio assets completed. The untouched automatic draft is `renders/draft-0.mp4`, 1920×1080, 827 frames, 27.5667 seconds, 4,080,553 bytes.

The run reached delivered-file review but did not complete it. Two paid review responses used 62,229 input tokens. The second response contradicted its own major UI-fidelity finding with a passing fidelity flag; reserving a schema re-review plus remaining work exceeded the conservative remaining allowance. The run ended `needs_review`, with 7 model calls, 130,760 input tokens, 14,311 output tokens, two audio generations and 27.566667 ASR seconds. No completed `qc.json` or final acceptance pass exists.

Independent agent inspection of 46 decoded frames confirmed important defects rather than merely an accounting failure: the graph's small, dense circular network was replaced by four oversized rounded squares and three connections; two named state changes had identical effective styles; the typing demonstration retyped its initial value. Audience/product copy and sampled scene boundaries were readable/clean. The fourth shot used a small marketing-page screenshot and the repeated orb remained visually dominant. Frame inspection did not include normal-speed playback or human listening. Original draft and plan hashes were unchanged by inspection.

Followup corrections focus the documented workflow, reject interactions without observable change, and resolve structurally valid review contradictions only by changing the implicated pass flag to failed. They never clear a blocking finding or promote this draft. A compact, source-bound network primitive is a possible later renderer extension; it is not implemented or certified by this batch.

## Fresh automatic trial 3

Workspace: `.local/engine-batch-acceptance-20261002c`. The fresh run stopped at the first UI document after two model calls, 20,040 input tokens and 4,796 output tokens, without generating audio. The diagnostic artifact identified viewport pixel coordinates in `element.rect` where the canonical contract requires normalized coordinates. Source rectangles were correctly normalized. Nothing was truncated or manually corrected into a successful job.

Research again chose two targets despite advisory guidance, including a broad editor/sidebar/graph overview. Followup work makes the fresh default scope a single required research selection, retaining the older two-target contract for historical data. It also adds explicit UI transport coordinate units; only declared, bounded pixel rectangles may be converted into canonical normalized geometry. Undeclared pixel data remains invalid. These are contract changes for fresh jobs, not changes to the retained failure.

The exact original trial 3 response still fails. A separate in-memory copy with explicit version and pixel units compiles all 11 elements with exact per-axis normalization; source rectangles, other fields and original artifact hashes remain unchanged. Fresh research now rejects a second target or mechanism outside the chosen target. An independent review also corrected future-call reservation to six for this fresh single-target path, preserving historical v3/v2 reservations and output ceilings. Exact-cap and one-call-short regressions pass.

## Fresh automatic trial 4

Workspace: `.local/engine-batch-acceptance-20261002d`. Runtime hash: `f89c5026ff2ec70c7f808bebc881f148b9333b9ed7f0c99838fe3132de2e93f2`.

Research and UI documentation both passed on their first responses. Research chose one wikilink autocomplete workflow. Its complete UI document has 11 elements, seven styles and three states in a 500×385 design viewport. Together these stages consumed 20,446 input and 4,585 output tokens, demonstrating that the single-workflow and coordinate changes crossed the earlier failure point within the existing allowance.

The initial script used focus regions with incompatible source/fact bindings. Its existing bounded correction ran, but compilation stopped at the creative-concept execution binding. The run ended `needs_review` / `invalid_generated_script`, with four model calls, 53,598 input tokens, 8,192 output tokens and zero audio generations. There is no export or delivered-file QC. The benchmark correctly reports `automaticLocalPass: false`; original responses and stage hashes remain intact.

Offline review identified a false concept rejection: the matching source fact was executed by meaningful UI actions, but the validator considered only the scene's main fact. The corrected validator counts only validated, supported, effective UI actions, never bare document membership or pointer movement. The unchanged response still correctly fails for independent errors: scene 1 combines a hook template with a proof-only showcase, and scene 4 pairs `product-panel-1` with unsupported `fact-8`. Expanded correction diagnostics report both together. Original response SHA-256 remains `9d51ee60d14eca4dc74c8e9d80f2ca9af4a18634e9781ccffaa9b8cc6d44783c`; this offline check is not an automatic recovery or acceptance pass.

Fresh scripts now use `flat-script-v3` and select trusted shot recipes instead of independently choosing the role, source, fact, template and visual treatment. The bounded catalogue persists at `analysis/shot-recipes.json`; its digest and selected recipe IDs remain bound through script, plan, correction, repair and restart. Historical transports retain their original path. On the unchanged trial-4 evidence, 36 recipes occupy 6,581 bytes and the provider schema 4,733 bytes with no grammar unions. Both failed combinations are absent, while both focus facts remain executable. This removes those invalid structural choices; copy, action meaning, duration and delivered quality still require their own checks.

A separate source-text review confirmed that the composed result `[[I think therefore I am]]` was not literally observed in trial 4. Fresh UI responses now require illustrative source-ui strings to match observed visible text or exact selected-source DOM text. Newly composed results remain allowed as explicitly illustrative example-content. Later-revealed base examples also count toward reading time. Retained responses are not rewritten or retroactively relabeled.

## Fresh automatic trial 5

Workspace: `.local/engine-batch-acceptance-20261002e`. Runtime hash: `7c89be5df749bd4655c7e3517262139e8e40d4dbe2fdad253f69affaeb00e74e`.

Research, UI documentation and the new recipe-based script all passed their first responses. The catalogue contained 39 verified choices; the script identified writers developing interconnected ideas, introduced Obsidian, and demonstrated wikilink entry, choice and result. The source, script, plan and catalogue hashes all verify. This crossed the previous script-binding failure without using a correction call.

The actual browser preflight then found a clipped paragraph in the documented UI. At frame 324 its element had 103 usable pixels of height but needed 137; the final line extended 32.2 pixels below its box. The same clipping occurred at frames 295 and 490. State identity and camera bounds passed. Independent inspection confirmed a genuine layout error, not a font-loading or state-check defect. A separate diagnostic copy increasing the logical box height from 48 to 72 fitted the unchanged text and font; it was not substituted into the failed job.

The untouched run ended `needs_review` / `ui_state_mismatch`, with three model calls, 38,500 input tokens, 6,436 output tokens and zero audio generations. There is no export or delivered-file QC. The benchmark correctly returns `automaticLocalPass: false`. Followup work checks complete UI states in the real browser immediately after documentation, before scripting, and permits one complete measured-layout correction within the original UI output allowance. The final scene/camera preflight remains required.

The implemented inspector uses the production font, trusted HTML/CSS and state resolver. It checks every declared state in both permitted UI scene layouts, saves bounded measured diagnostics and failure images, blocks browser networking and stops on unavailable or invalid measurements. Actual Chromium tests cover landscape, portrait, square, selected styles, text overrides, inert markup, non-text SVG edges and failures beyond diagnostic truncation. The saved trial-5 document fails in all six state/layout combinations; the isolated height-only copy passes, with the original source hash unchanged. Fresh generation cannot bypass these checks by omitting its transport version; historical compilation and completed-stage loads keep their prior behavior.

Correction tests verify exact provider preflight before the durable attempt marker, one attempt only, shared 6,000-token accounting across targets, preserved future script/review reservations, and no paid correction for schema, provenance, unavailable measurement, uncertain provider or exhausted-budget failures. This is a validated repair mechanism, not a claim that the failed trial recovered automatically.

## Repeatable checks

Run `npm test`, `npm run typecheck`, and `npm run build` for the default regression and deployment checks. The optional browser/media checks use `STUDIO_UI_SOURCE_INTEGRATION=1`, `STUDIO_RESEARCH_CAPTURE_INTEGRATION=1`, and `STUDIO_MEDIA_INTEGRATION=1` with `node --import tsx --test worker/ui-sources.test.ts worker/url-research.test.ts worker/pipeline.test.ts`. These require the local browser/media dependencies; they do not invoke paid creative providers.

Run the early-layout browser suite with `STUDIO_UI_LAYOUT_INTEGRATION=1` and `node --import tsx --test worker/ui-document-layout.test.ts`. Add `STUDIO_UI_LAYOUT_TRIAL5=1` only when the retained local trial-5 workspace exists; that regression reads the original and checks a separate in-memory counterfactual without rewriting it.

A real provider trial is explicitly opt-in: `node --env-file=.env.local --import tsx scripts/acceptance-local.ts --run-paid --url https://obsidian.md/ --workspace .local/<new-run-name>`. Configure the existing Python/media dependencies and provider credentials locally. Use a new workspace after a runtime change, retain every failed run, and freeze worker/skill files for the run's duration. Existing call, token, audio, repair and wall-time limits remain enforced.

After a run, `node --import tsx scripts/engine-benchmark.ts .local/<run-name>` produces a read-only benchmark report without calling providers. A passed benchmark still requires independent creative review and separate production delivery verification.
