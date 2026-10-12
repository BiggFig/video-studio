# OpenRouter recovery — 12 October 2026

**Provider access recovered; automatic film acceptance remains 0/3.** The supplied credential belongs to OpenRouter. Real research and UI-documentation requests now succeed through its Anthropic Messages API using Claude Sonnet 4.6. All three products reached UI documentation; source and behavior validation stopped their generated documents before scripting, audio or rendering. The six approved Tally exports remain available and are not counted as automatic URL passes.

## Implementation

- Explicit `MODEL_PROVIDER` routing selects Anthropic, Vercel AI Gateway or OpenRouter. An invalid selector or missing selected credential fails closed. Existing installations without a selector retain their previous provider precedence.
- Production stores `OPENROUTER_API_KEY` as sensitive, with `OPENROUTER_MODEL=anthropic/claude-sonnet-4.6` and `MODEL_PROVIDER=openrouter`. Worker dispatch passes only the selected model credential. Old provider credentials are neither overwritten nor sent to OpenRouter.
- OpenRouter uses the native Messages endpoint, bounded thinking and supported structured output. Routing requires supported request parameters; redirects are rejected. Receipts record provider, model, request ID and measured usage without secrets or reasoning traces.
- Existing token reservations, uncertain-response blocks, future-review reserves, repair limits and deadlines remain enforced. No purchase, model fallback or budget increase was made.
- The first Plausible response exhausted its 3,500-token research allocation. The prompt contained competing compact-selection and broad-inventory instructions. The fix asks for concise selected evidence and a complete compact response, retaining every supplied source/image and all canonical validation. One fresh Plausible attempt verified complete research responses of 937 and 957 tokens, including the existing bounded source-binding correction.

## Retained execution evidence

All workspaces are ignored local artifacts. Each attempt retained 10 model calls, 200,000 input tokens, 30,000 output tokens, two audio generations, two repair passes, 1,800 seconds and a 300-second maximum film. Failed attempts were not resumed, cleared or rewritten. The final Plausible attempt used a new frozen runtime because its research prompt changed.

| Product / attempt | Runtime | Model calls | Input tokens | Output tokens | Terminal outcome |
|---|---|---:|---:|---:|---|
| Plausible, initial | `director-openrouter-v2` | 1 | 19,867 | 3,500 | Incomplete research JSON at the stage output limit |
| Resend | `director-openrouter-v2` | 3 | 44,628 | 7,566 | UI source-text provenance validation failed |
| Baserow | `director-openrouter-v2` | 3 | 47,942 | 9,012 | UI relationships did not connect documented source nodes |
| Plausible, compact research | `director-openrouter-v3` | 3 | 50,413 | 5,118 | Research completed; UI source-text provenance validation failed |

Runtime SHA-256 values:

- v2: `db998f681255c3d5c487e60054ce3424f23d43f6286a77ac9b6361fdb08d214b`
- v3: `39d02442eec79dcb7b9efaab1f709057d2fbe57372f2011d04719b3e461076f4`

Workspaces are `.local/<runtime>/.local/<product>`. Each retains provenance, source captures, raw model answers, request-budget audits, provider receipts, stage history, artifact hashes, result and read-only benchmark report. The reports correctly return `automaticLocalPass:false`; no manual rewrite was substituted for a generated result. All four attempts have zero audio generations and no rendered draft. Across these attempts the ledger records 162,850 input and 25,196 output tokens. Account credit decreased by $0.866490 to approximately $2.631496 during the isolated test interval; the credential's separate $50 cap is not available account credit.

## What the failures establish

**Resend:** the rejected welcome-preview strings are visible in the screenshot, but the model omitted them from its observed state and the bounded captured DOM inventory contains only early code fragments. That provenance mismatch is not evidence that those strings were invented. Separately, the proposed confirmation is static `return (` code, its result includes a button, and no editable element supports the proposed typing action. Merely changing provenance labels would not make this a valid demonstration.

**Baserow:** three edges incorrectly connect through an Add branch button. More substantively, the source already shows Live enabled, while the generated sequence invents a new “Automation is Live” success label. Its proposed result includes an empty toggle button and does not establish an actual publish/result change. Retyping the button as a node or relabeling the invented status would conceal the problem.

**Plausible:** compact research completed and its source-binding correction passed. Two rejected filter chips are copied from the source, but the model hides them initially and claims clicking Add filter produces them without selecting their conditions. Its new segment summary describes different filters, its metrics do not change, and it omits the chart while promising updated metrics/chart. The structural terminal check alone accepts the newly visible text; the independent source guard stops it. Relabeling text would not fix the unsupported interaction.

The remaining engineering work is reliable selection of an evidenced before/action/result workflow and faithful UI documentation. Source capture should distribute its bounded text inventory across useful interface regions. When sources do not establish a claimed completion, research must select another supported workflow or request evidence; it must not invent a success state. These are engine generalization failures, not outstanding API-key setup, and this release does not mark them complete.

## Verification and release

- Full suite: 539 tests, 504 passed, 35 optional skipped, zero failures.
- TypeScript and production webpack build passed; 98 worker/skill files are bundled.
- Independent review found no actionable credential-routing or budget-enforcement issues.
- The browser replay regression retains exact active DOM, state and geometry checks plus the existing production SSIM threshold. The investigated pixel difference was one channel level, SSIM 0.999903; no renderer or video was changed.
- Production configuration and deployment are verified separately from these local provider-backed tests. No new hosted queue/storage end-to-end pass, subjective listening, unfamiliar-viewer result or paid-ad performance is claimed.
