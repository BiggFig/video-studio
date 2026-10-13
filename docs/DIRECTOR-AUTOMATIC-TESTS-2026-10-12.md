# Automatic director acceptance — 2026-10-12

**Current result: 0 automatic passes.** Fresh v21 Resend passed research, source-bound UI and workflow review, but stopped before audio/render when its first-scene audience/headline overlapped the UI viewport by 3.86 pixels. Its canonical 14.6-second plan starts typing at 1.40 seconds, changes the result at 2.83 seconds and names Resend in the first headline. Plausible stopped during research after its one correction still selected an unsupported filter result despite capturing usable row-count evidence. Neither run produced a new video. Existing older drafts and the six authored Tally exports are not automatic URL passes. See the [workflow report](WORKFLOW-RECONSTRUCTION-2026-10-12.md) for exact evidence.

## Retained three-product batch: v7

Frozen runtime SHA-256: `3caef2aedc037b1ee7972f73a63c19bf648bd4ded069a2e216bc9a6830aa26a2`. Workspaces are retained under `.local/director-openrouter-v7/.local/`; none was resumed under changed code.

| Product | Recorded stop | Measured model usage | Audio/video |
|---|---|---|---|
| Plausible | A relevant guide supplied three additional UI images, but research chose an already-applied filter. Reconstruction fabricated an empty initial view and failed the observed-state check (`production_stage_changed`). | 4 calls; 75,270 input / 6,093 output tokens | None |
| Baserow | The selector's complete 295-character explanation exceeded its then-current 240-character bound before the selected guide was fetched (`production_stage_changed`). | 1 call; 12,042 input / 144 output tokens | None |
| Resend | UI documentation and scripting completed. Both bounded workflow reviews rejected a company-name change to Resend that retained “The ACME Team” in the sign-off (`workflow_incoherent`). | 6 calls; 90,424 input / 8,604 output tokens | None |

The fresh v8 Plausible run reached UI generation and received HTTP 400; independent inspection also found an invalid source-count proposal. Baserow reached UI generation after one research correction and proposed an unsupported publish result. Neither produced audio or video; measured usage and source findings are in the workflow reconstruction report. No new Resend run is implied by the v8 revision. The existing job limits remain unchanged. These local provider tests also do not verify the production queue, private storage or owner-access path.

The sections below preserve the earlier Anthropic/Gateway access investigation.

## Pinned execution

- Runtime: `.local/director-runtime-v2`.
- Runtime SHA-256: `f034adbe950aaf4347b6b31449321b5743e90f6062533535829c1fceb4cc55fa` for every attempt below.
- Each attempt retained the existing limits: 10 model calls, 200,000 input tokens, 30,000 output tokens, 2 audio generations, 2 repairs, 1,800 seconds, and 300 seconds maximum output duration.
- Initial setup folders `plausible`, `resend`, and `baserow` failed dependency doctor before provider initialization because `python3` resolved to the Windows Store alias. Those folders remain intact. Process-local `PYTHON_PATH` then selected installed Python 3.12.10; doctor verified FFmpeg/FFprobe 8.1.
- Gateway attempts were explicitly authorized **new authentication-recovery attempts**, not resumes. They used the same Claude Sonnet 4.6 model through the worker's existing Gateway route, existing credits, and unchanged runtime code. No credit was purchased or account setting changed.

## Attempts

Workspaces below are relative to `.local/director-runtime-v2/.local/`. Every row has one reserved model call, zero measured input/output tokens, zero audio generations, and no completed research, UI, script, director, or video stage.

| Source | Workspace | Provider | Start (UTC) | Research result | Retained input/output reservation | Provider cost evidence |
|---|---|---|---|---|---|---|
| [Plausible](https://plausible.io/) | `plausible-ready` | Direct Anthropic | 16:05:00 | HTTP 401 | 58,120 / 3,500 | No usage receipt; billing unverified |
| [Resend](https://resend.com/) | `resend-ready` | Direct Anthropic | 16:05:07 | HTTP 401 | 45,493 / 3,500 | No usage receipt; billing unverified |
| [Baserow](https://baserow.io/) | `baserow-ready` | Direct Anthropic | 16:05:07 | HTTP 401 | 56,602 / 3,500 | No usage receipt; billing unverified |
| [Plausible](https://plausible.io/) | `plausible-gateway` | Vercel AI Gateway | 16:13:12 | HTTP 403 | 58,120 / 3,500 | Gateway logs: $0, no reported usage |
| [Resend](https://resend.com/) | `resend-gateway` | Vercel AI Gateway | 16:13:22 | HTTP 403 | 47,950 / 3,500 | Gateway logs: $0, no reported usage |
| [Baserow](https://baserow.io/) | `baserow-gateway` | Vercel AI Gateway | 16:13:21 | HTTP 403 | 56,602 / 3,500 | Gateway logs: $0, no reported usage |

Each folder preserves `acceptance-result.json`, provenance, artifact hashes, stage history, `ledger.json`, source captures, and the reserved research/budget records. Zero measured usage is not a release of the retained reservations. None was cleared or rewritten.

## Sanitized access diagnosis

The refreshed OIDC token matched the linked project/team and authenticated read-only model and credit requests (HTTP 200). The live catalog contained exact slug `anthropic/claude-sonnet-4.6`; available Gateway credit was approximately $4.9974. OIDC is supported by the [Gateway Messages API](https://vercel.com/docs/ai-gateway/sdks-and-apis/anthropic-messages-api).

The [Gateway logs](https://vercel.com/noahs-projects-f69e6462/~/ai-gateway/logs) showed all three generation failures routing to Claude Platform on AWS with HTTP 403, $0 cost, and no usage. The [Plausible request](https://vercel.com/noahs-projects-f69e6462/~/ai-gateway/logs?selectedLogId=gen_01M4RE7RSWKNFV85TPRF2C3412) is `gen_01M4RE7RSWKNFV85TPRF2C3412`, started `2026-10-12T16:13:23.644Z`; read-only generation lookup confirmed cost 0 and finish reason `error`. Its upstream routing details were unavailable.

Read-only settings inspection found provider/model allowlists and ZDR disabled, no configured BYOK keys, and no visible verification notice. One authorized diagnostic sent an empty Messages body with no model or messages, making inference impossible. It returned HTTP 400 `invalid_request_error` for missing `model`; it did not establish the original 403 cause. No further generation was attempted.

Sanitized supporting records are in the runtime root: `gateway-access-summary.json`, `gateway-generation-lookup.json`, and `gateway-invalid-request-diagnostic.json`. Credential files are ignored and intentionally excluded from this report.

## Recovery boundary

Read-only validation confirmed the Plausible saved manifest is intact. Normal resume preserves the original deadline but stops with `model_reservation_unresolved`; the reserved, incomplete research stage also prevents repeated generation. Refreshing credentials alone cannot resume these attempts under the pinned runtime. No safeguards were bypassed.

The user subsequently supplied an OpenRouter credential. Its independently verified route and new bounded attempts are recorded in the linked recovery report. The earlier Anthropic/Gateway failures remain retained and unresolved; no old reservation or deadline was reset.
