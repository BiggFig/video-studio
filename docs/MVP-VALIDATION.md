# MVP verification — September 30, 2026

## Release status

The web application and infrastructure are deployed. **The full MVP acceptance gate has not passed.** `BETA_ACCEPTING_JOBS=false` prevents paid customer work until the remaining checks are complete. Dedicated Claude and ElevenLabs credentials have been stored in encrypted project settings and verified against the actual providers. Do not invite testers on the strength of synthetic renderer results alone.

## Checks performed

| Area | Evidence and result |
| --- | --- |
| Build | Next.js production build passed locally and on Vercel, including all web/API/worker callback routes. |
| TypeScript | Strict application and worker typecheck passed. |
| Default test suite | 64 tests passed, zero failed; nine live/media/browser cases are opt-in rather than silently counted as passed. Includes source-fact binding, retained-plan validation, nullable review metadata, explicit reference-style success, verified local fixture transport and resume identity, audio-timing, runtime-pin, cumulative execution/repair budgets, provider-budget, document-policy, complete product-image extraction, and concurrent capture-budget checks. |
| Ingestion failures | The opt-in ingestion suite passed all 15 checks. Actual local FFprobe rejected corrupt visual/reference bytes; FFmpeg created an audio-only reference that was rejected; Chromium rejected an unreachable product; actual DNS/HTTP failures produced reference guidance or retryable private-upload errors. Binary/UTF-8/header/text-length policies were exercised directly. PDF parser rejection/textless extraction were simulated, explicitly labelled; actual Poppler parsing remains unverified locally. |
| Database | Actual Neon isolated-schema tests passed: single-use invitation races, idempotent submissions, quota races, owner isolation, per-user concurrency, lease recovery, stale callbacks, retry cap, and cumulative artifact reservation budgets. |
| Storage | Actual private Blob tests passed: scoped upload, private unauthenticated denial, ownership checks, overwrite denial, metadata/byte verification, misleading extension rejection. Exact temporary objects and test schema were cleaned. |
| Worker callbacks | Actual handler tests passed for prepare → scoped Blob upload → grant completion → authenticated retrieval; invalid owner/token/path denied; reserved infrastructure checkpoint fields rejected. |
| Renderer | Actual 10-second synthetic H.264/AAC files rendered and fully decoded on Windows at 1920×1080, 1080×1920, and 1080×1080. Decoded landscape/vertical frames visually inspected. These are synthetic fixtures, never customer outputs. |
| Product capture | Real public `https://linear.app` captured successfully: accessible product text and four real screenshots. This verifies capture, not the complete URL-to-delivery workflow. |
| Public interface | Desktop light/dark, mobile 390px and 320px layouts checked; no horizontal overflow or console errors. Invalid invitation recovery and unauthenticated studio redirect checked. |
| Deployed access | Canonical production page loaded in browser. Session reports configured and generation disabled; unauthenticated jobs, media, and cron requests returned 401. |
| Worker image | Linux Vercel snapshot built successfully with FFmpeg, Poppler, Python, browser/fonts, and pinned Node dependencies. Source upload/render execution in that snapshot awaits specific authorization. |
| Provider access | Direct Anthropic API returned 200 for `claude-sonnet-4-6`; ElevenLabs subscription API returned 200. Dedicated credentials are stored in encrypted Vercel settings. The earlier free Gateway restriction is bypassed through the configured direct Anthropic adapter. Actual music, SFX, Scribe and rendered review were subsequently exercised by the local acceptance runs below; production delivery remains pending. |
| First real planning attempt | A real URL-only Linear job ingested the page and called Claude once (15,337 input and 1,738 output tokens). Exact source grounding rejected concatenated/paraphrased evidence quotes and returned `needs_review`; no audio generation occurred. The failed attempt and usage ledger were retained locally. |
| Real audio and rendered draft | ElevenLabs generated instrumental music and SFX, and Scribe analyzed the rendered audio. A 32.33-second real-product draft rendered and fully decoded locally. Initial review exposed nullable review fields, final-frame timestamp sampling, and a source-image composition finding. Fixes passed focused checks, including actual final-frame ordinal extraction. Fresh review of all 20 decoded samples passed technical, timeline, readability, claims, reference exclusion, audio, and render integrity, but failed `real_visuals`. The next repair was prevented by the input budget before a new paid request. Final state: `needs_review`, never Ready. Aggregate: seven Claude calls, 155,528 input / 11,811 output tokens, exactly two audio generations, 32.333008 seconds of ASR. |
| Deployed acceptance preparation | An offline-first harness covers scoped temporary access, actual API submission, interruption/recovery, delivery, and revocation. Its path-isolation test passed. No live harness phase has run; the pending account and Sandbox authorizations still apply. |
| Real PRD, vertical format, and reference | Actual Claude analysis/planning/review, ElevenLabs music/SFX, and Scribe produced a 28.433333-second 1080×1920 H.264/AAC 30 fps MP4 from a grounded PRD and four actual public invitation-flow screenshots. A separate original silent 16:9 reference influenced palette, hierarchy, spacing and supported motion; all nine performed quality checks passed, including explicit style adoption and source exclusion. Five Claude calls used 96,173 input / 9,488 output tokens; exactly two audio generations and 28.433333 seconds of ASR. No semantic repair was required. A Windows UTF-8 validator fix preceded resumed rendering using the same paid plan/audio; all final quality review was fresh. Local bytes entered through a manifest-verified fixture reader, not production uploads. |
| Fresh URL-only Obsidian run | Automatic public-page ingestion collected 6,121 text characters, four viewport captures and one complete page-linked product screenshot, using 13 requests / 1,370,540 bytes. An actual 36.033333-second landscape draft rendered with two generated audio assets and Scribe analysis. All first-pass review batches ran; a major visual repetition finding triggered an automatic repair. Its non-rendered summary exceeded the schema limit, so the attempt stopped without a final video. Aggregate usage: five model calls, 112,064 input / 8,777 output tokens, two audio generations, 36.033333 seconds ASR. Actual raw repair, draft, review and usage remain retained; this is a failed acceptance, not a successful URL workflow. |
| Recovery fixes after acceptance | Offline tests prove that repair reservations precede paid work, survive retries, and block uncertain/extra repairs; server and worker enforce the original absolute execution deadline. Local resume verifies original input, fixture, runtime and recorded artifact hashes before any paid work. Only non-rendered summary/purpose/style notes are deterministically bounded; visible copy, facts, assets and timeline remain strictly validated. These fixes have not been substituted for another successful live acceptance run. |

## Outstanding acceptance matrix

| PRD acceptance case | Status |
| --- | --- |
| Real public URL only → finished launch MP4 | Linear failed its product-visual gate; Obsidian rendered and underwent complete first review but stopped while validating the automatic repair's internal metadata. A successful fully automatic run is still required. |
| Real PRD + screenshots → finished feature demo | Passed locally with actual providers and checked final MP4. Production upload/queue/delivery remains pending. |
| Default landscape and explicit vertical | Actual explicit vertical PRD output passed. Automatic landscape URL output still requires a successful run. |
| Reference affects style without media reuse | Passed locally on actual vertical output with an original landscape reference: separate performed/success flags and hash/source exclusion passed. Production transport remains pending. |
| Inaccessible URL, unusable PRD/assets, failed reference | Actual local browser, media-parser, DNS/HTTP, and direct text-policy failures passed. PDF parser failures were simulated because local Poppler is unavailable; deployment-wide failure delivery remains pending the cloud/access gates. |
| Worker interruption and safe resume | Database lease recovery and interrupted-audio no-double-charge unit tests passed; full interrupted cloud worker run pending. |
| Cross-user upload/output access denial | Database, storage, and internal callback isolation tests passed; browser-to-browser finished output check pending. |
| Owner preview and downloaded final MP4 | Authenticated browser acceptance test and real delivered output pending. |
| All quality checks on actual output | All nine checks performed and passed for the local PRD/reference output. A failed URL draft remains `needs_review`; it was not promoted or substituted with a fixture. |
| Actual total cost and publishability | Usage/request IDs recorded; monetary cost remains null until billing reconciliation. No quality/cost/speed promises made. |

## Reproduction

`npm test` runs offline/security tests. To run the isolated database and private storage integrations, set `STUDIO_DB_INTEGRATION=1` or `STUDIO_STORAGE_INTEGRATION=1`, load the project's `.env.local`, and run the corresponding test with Node and `--import tsx`. They create temporary test records/objects and clean them afterward.

`npx tsx worker/smoke-render.ts --out .worker-smoke` runs the actual renderer using clearly synthetic sources. Its output folder is ignored by Git and Vercel. `worker/smoke-sandbox.ts` repeats the test in the configured snapshot, subject to explicit source-upload authorization. No test sets a customer job to ready using fixture results.

Set `STUDIO_INGEST_INTEGRATION=1` and run `npx tsx --test worker/ingest.test.ts` to exercise the local media/browser/network failure cases. This requires FFmpeg/FFprobe and installed Playwright Chromium. The tests deliberately never call paid providers. PDF parser stubs are labelled and do not certify real Poppler behavior.

The earlier toolkit validation is preserved in [VALIDATION.md](VALIDATION.md). It concerns the original broader toolkit and must not be interpreted as certification of the new SaaS pipeline.
