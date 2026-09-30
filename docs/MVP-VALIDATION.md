# MVP verification — September 30, 2026

## Release status

The web application and infrastructure are deployed. **The full MVP acceptance gate has not passed.** `BETA_ACCEPTING_JOBS=false` prevents paid customer work until provider access and the remaining checks are complete. Do not invite testers on the strength of synthetic renderer results alone.

## Checks performed

| Area | Evidence and result |
| --- | --- |
| Build | Next.js production build passed locally and on Vercel, including all web/API/worker callback routes. |
| TypeScript | Strict application and worker typecheck passed. |
| Unit tests | 22 tests passed, zero failed; two live integration suites are opt-in rather than silently counted as passed. Includes audio-timing, runtime-pin, and durable provider-budget checks. |
| Database | Actual Neon isolated-schema tests passed: single-use invitation races, idempotent submissions, quota races, owner isolation, per-user concurrency, lease recovery, stale callbacks, retry cap, and cumulative artifact reservation budgets. |
| Storage | Actual private Blob tests passed: scoped upload, private unauthenticated denial, ownership checks, overwrite denial, metadata/byte verification, misleading extension rejection. Exact temporary objects and test schema were cleaned. |
| Worker callbacks | Actual handler tests passed for prepare → scoped Blob upload → grant completion → authenticated retrieval; invalid owner/token/path denied; reserved infrastructure checkpoint fields rejected. |
| Renderer | Actual 10-second synthetic H.264/AAC files rendered and fully decoded on Windows at 1920×1080, 1080×1920, and 1080×1080. Decoded landscape/vertical frames visually inspected. These are synthetic fixtures, never customer outputs. |
| Product capture | Real public `https://linear.app` captured successfully: accessible product text and four real screenshots. This verifies capture, not the complete URL-to-delivery workflow. |
| Public interface | Desktop light/dark, mobile 390px and 320px layouts checked; no horizontal overflow or console errors. Invalid invitation recovery and unauthenticated studio redirect checked. |
| Deployed access | Canonical production page loaded in browser. Session reports configured and generation disabled; unauthenticated jobs, media, and cron requests returned 401. |
| Worker image | Linux Vercel snapshot built successfully with FFmpeg, Poppler, Python, browser/fonts, and pinned Node dependencies. Source upload/render execution in that snapshot awaits specific authorization. |
| Model access | Actual gateway request reached Vercel but returned 403 `no_providers_available`: the account's free gateway tier did not allow the configured Claude model. No paid end-to-end result claimed. |

## Outstanding acceptance matrix

| PRD acceptance case | Status |
| --- | --- |
| Real public URL only → finished launch MP4 | Pending working Claude and ElevenLabs access. Capture alone passed. |
| Real PRD + screenshots → finished feature demo | Pending providers and complete run. |
| Default landscape and explicit vertical | Renderer ratios passed; grounded provider-backed outputs pending. |
| Reference affects style without media reuse | Contract/unit exclusion checks passed; real reference end-to-end run pending. |
| Inaccessible URL, unusable PRD/assets, failed reference | URL/file boundary tests passed; representative worker failure runs pending. |
| Worker interruption and safe resume | Database lease recovery and interrupted-audio no-double-charge unit tests passed; full interrupted cloud worker run pending. |
| Cross-user upload/output access denial | Database, storage, and internal callback isolation tests passed; browser-to-browser finished output check pending. |
| Owner preview and downloaded final MP4 | Authenticated browser acceptance test and real delivered output pending. |
| All quality checks on actual output | Implemented as fail-closed; full provider-backed semantic/audio review not yet verified. |
| Actual total cost and publishability | Usage/request IDs recorded; monetary cost remains null until billing reconciliation. No quality/cost/speed promises made. |

## Reproduction

`npm test` runs offline/security tests. To run the isolated database and private storage integrations, set `STUDIO_DB_INTEGRATION=1` or `STUDIO_STORAGE_INTEGRATION=1`, load the project's `.env.local`, and run the corresponding test with Node and `--import tsx`. They create temporary test records/objects and clean them afterward.

`npx tsx worker/smoke-render.ts --out .worker-smoke` runs the actual renderer using clearly synthetic sources. Its output folder is ignored by Git and Vercel. `worker/smoke-sandbox.ts` repeats the test in the configured snapshot, subject to explicit source-upload authorization. No test sets a customer job to ready using fixture results.

The earlier toolkit validation is preserved in [VALIDATION.md](VALIDATION.md). It concerns the original broader toolkit and must not be interpreted as certification of the new SaaS pipeline.
