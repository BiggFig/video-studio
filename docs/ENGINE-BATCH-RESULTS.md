# Engine batch validation — 2 October 2026

Implementation and ownership are tracked in [the ticket batch](ENGINE-BATCH-2026-10.md). Creative acceptance uses [the export review rubric](ENGINE-CREATIVE-REVIEW.md). These results distinguish deterministic tests, authored fixtures, fresh provider runs and production deployment.

## Integrated checks

The integrated suite passed 327 tests, with 16 environment-specific integration tests skipped. Type checking and the production build passed. A separate opt-in browser/media run passed all 34 tests, including five integration cases skipped by the default suite. Database/storage, PDF and other unrelated opt-in checks were not rerun for this batch. Targeted tests cover research/source bindings, compact UI documentation, creative direction, legacy compatibility, repair continuity, camera bounds in three aspect ratios, sound scheduling and benchmark attribution. Independent agent review found and resolved a sound-repair issue: the generated effect now remains available when one repair removes all scheduled cues and another restores them.

## Renderer evidence

The manually authored directed Obsidian fixture is saved at `.local/vs204-directed-fixture/project/motion-0/picture.mp4`: 1920×1080, 693 frames, 23.1 seconds, silent. Thirteen layout/UI-state/camera checks and ten decoded-frame comparisons passed, with SSIM .987530–.996175 against the browser render. Full decode and deterministic repeated seeking passed. Thirty-two exported action, hold and cut frames were inspected. This validates rendering mechanics, not automatic creative generation, listening, or reference equivalence.

Observed limitations remain: softer CSS materials than the references' volumetric objects, a repeated orb, a dense source note excerpt, and a slightly soft captured wordmark. Focus choreography was exported; connection/consolidation and source-identity continuity have unit coverage but still need separate export review.

## Actual source matrix

| Case | Test performed | Observed result | What remains unproven |
| --- | --- | --- | --- |
| Obsidian | Fresh provider-backed URL pipeline | Research and both editable UI documents validated; creative brief persisted; initial script rejected, then correction budget preflight stopped | Complete automatic export, audiovisual QC and creative quality |
| Excalidraw | Public capture and structural readiness only, no model calls | Three assets, one UI candidate and 25 DOM elements; recognizable empty canvas and tools | Supported audience/workflow/outcome research and performed drawing/result |
| Example.com | Public capture and structural readiness only, no model calls | Two generic viewports, no product UI or workflow | Automatic semantic insufficient-evidence decision; structural readiness alone correctly does not claim product proof |

Capture observations are retained in `.local/engine-batch-capture-excalidraw-1790957245997` and `.local/engine-batch-capture-insufficient-1790957280803`. Excalidraw's captured brand metadata includes a description that the current source-fact catalog does not use; the capture-only test does not invent missing capability claims.

## Fresh automatic trial 1

Workspace: `.local/engine-batch-acceptance-20261002`. Runtime hash: `c4d59c24c48fd519d7898f998839b08e39191ee144f7759cc006117f334ab7f2`.

The research response needed its existing bounded correction for a region/parent fact mismatch. Both subsequent UI documents validated: the note-linking document used 2,068 output tokens and the graph document used 3,451, within the shared 6,000 allowance. This reaches beyond the previous truncated-document failure.

The five-scene script selected a focus region owned by a different source image and omitted the required outcome role. Its correction did not start: the fixed four-review reserve plus a full correction would have required 30,035 output tokens against the unchanged 30,000 limit. The run ended `needs_review` with 5 model calls, 60,770 input tokens, 13,035 output tokens and zero audio generations. No MP4 or delivered-quality pass was produced. Original responses, stage hashes and ledger remain intact.

The read-only benchmark reporter correctly returns `automaticLocalPass: false`. It also rejects manually authored fixtures, assisted retained-response recoveries, missing stage artifacts, modified hashes and incomplete required QC. A local pass can never certify production queue/storage access or subjective design preference.

The implemented correction addresses source/region selection, explicit outcome roles and review reservation proportional to a locally enforced corrected-scene ceiling. A five-scene correction reserves three full reviews: 13,035 consumed + 5,000 correction + 9,000 review output tokens = 27,035 within the same 30,000 limit. The compiler rejects excess corrected scenes, including legacy transports, before render or QC; this is not solely prompt guidance. New rejection diagnostics persist before budget checks, without consuming a retry slot. No provider limits or failed artifacts changed.
