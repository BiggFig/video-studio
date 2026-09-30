# MVP verification — September 30, 2026

## Release status

The web application and infrastructure are deployed. **The full MVP acceptance gate has not passed.** `BETA_ACCEPTING_JOBS=false` prevents paid customer work until provider access and the remaining checks are complete. Do not invite testers on the strength of synthetic renderer results alone.

## Checks performed

| Area | Evidence and result |
| --- | --- |
| Build | Next.js production build passed locally and on Vercel, including all web/API/worker callback routes. |
| TypeScript | Strict application and worker typecheck passed. |
| Default test suite | 31 tests passed, zero failed; eight live/media/browser cases are opt-in rather than silently counted as passed. Includes audio-timing, runtime-pin, provider-budget, document-policy, and concurrent capture-budget checks. |
| Ingestion failures | The opt-in ingestion suite passed all 15 checks. Actual local FFprobe rejected corrupt visual/reference bytes; FFmpeg created an audio-only reference that was rejected; Chromium rejected an unreachable product; actual DNS/HTTP failures produced reference guidance or retryable private-upload errors. Binary/UTF-8/header/text-length policies were exercised directly. PDF parser rejection/textless extraction were simulated, explicitly labelled; actual Poppler parsing remains unverified locally. |
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
| Inaccessible URL, unusable PRD/assets, failed reference | Actual local browser, media-parser, DNS/HTTP, and direct text-policy failures passed. PDF parser failures were simulated because local Poppler is unavailable; deployment-wide failure delivery remains pending the cloud/access gates. |
| Worker interruption and safe resume | Database lease recovery and interrupted-audio no-double-charge unit tests passed; full interrupted cloud worker run pending. |
| Cross-user upload/output access denial | Database, storage, and internal callback isolation tests passed; browser-to-browser finished output check pending. |
| Owner preview and downloaded final MP4 | Authenticated browser acceptance test and real delivered output pending. |
| All quality checks on actual output | Implemented as fail-closed; full provider-backed semantic/audio review not yet verified. |
| Actual total cost and publishability | Usage/request IDs recorded; monetary cost remains null until billing reconciliation. No quality/cost/speed promises made. |

## Reproduction

`npm test` runs offline/security tests. To run the isolated database and private storage integrations, set `STUDIO_DB_INTEGRATION=1` or `STUDIO_STORAGE_INTEGRATION=1`, load the project's `.env.local`, and run the corresponding test with Node and `--import tsx`. They create temporary test records/objects and clean them afterward.

`npx tsx worker/smoke-render.ts --out .worker-smoke` runs the actual renderer using clearly synthetic sources. Its output folder is ignored by Git and Vercel. `worker/smoke-sandbox.ts` repeats the test in the configured snapshot, subject to explicit source-upload authorization. No test sets a customer job to ready using fixture results.

Set `STUDIO_INGEST_INTEGRATION=1` and run `npx tsx --test worker/ingest.test.ts` to exercise the local media/browser/network failure cases. This requires FFmpeg/FFprobe and installed Playwright Chromium. The tests deliberately never call paid providers. PDF parser stubs are labelled and do not certify real Poppler behavior.

The earlier toolkit validation is preserved in [VALIDATION.md](VALIDATION.md). It concerns the original broader toolkit and must not be interpreted as certification of the new SaaS pipeline.
