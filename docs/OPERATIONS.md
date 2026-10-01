# Operating the beta

## Architecture

Next.js serves the public landing page, private browser-session studio, job library, and authenticated API on Vercel. Visitors enter without an invitation or signup form. Neon Postgres stores users, hashed sessions/invitations, upload ownership, quota counters, a leased job queue, checkpoints, and artifact reservations. All source, intermediate, and output objects use a **private** Vercel Blob store.

The cron route dispatches queued work every minute. Submission also dispatches with Next.js `after()`. Each job runs in a separate Vercel Sandbox restored from a prepared snapshot. The sandbox contains pinned Node dependencies, Chromium, FFmpeg/FFprobe, Python, Poppler, and fonts. The application writes a bundle containing only worker source, the unified skill, and the shared contract. It never bundles environment files into a worker.

Claude receives the versioned unified skill, grounded product evidence, and a constrained scene contract. It cannot run arbitrary tools or change application policy. ElevenLabs provides instrumental music, a selective sound effect, and speech analysis. There is no generated voiceover route. The renderer stores an editable JSON plan, scene HTML, composition metadata, rendered drafts, and quality evidence. Only a completed, checked job exposes preview/download routes to its owner.

## Setup

1. Install Node 24.x (the version required by `package.json`) and run `npm ci`.
2. Link this directory to a Vercel project with `vercel link`. Connect a Neon database and a **private** Blob store.
3. Copy `.env.example` to `.env.local`, or run `vercel env pull .env.local`. Set `APP_URL` to the deployment's canonical URL. For local development, use `http://127.0.0.1:3000`.
4. Supply random, independent 32-byte secrets for `SESSION_SECRET`, `WORKER_SECRET`, and `CRON_SECRET`. Supply a random bootstrap invitation and the owner's email. Never commit these values.
5. Configure `ANTHROPIC_API_KEY` or paid AI Gateway access. Gateway can use the deployment's Vercel OIDC identity; that identity alone does not provide model credits. Configure `ELEVENLABS_API_KEY` with music, sound-generation, and speech-to-text permissions/credits.
6. Run `npm run db:migrate`. Migration is repeatable; review schema changes before production rollout.
7. Run `node --env-file=.env.local --import tsx scripts/create-worker-snapshot.ts`, then set `WORKER_SNAPSHOT_ID` to the returned snapshot. This creates compute resources and installs dependencies from official package registries.
8. Run `npm test`, `npm run build`, then `vercel --prod`. The minute cron requires a Vercel plan supporting that schedule and Sandbox usage.
9. Keep `BETA_ACCEPTING_JOBS=false` until the acceptance matrix in `MVP-VALIDATION.md` has passed with actual provider-backed outputs. Enable it through Vercel environment settings and redeploy when ready.

`scripts/configure-project.ps1` is an optional setup helper for the linked project. It generates and retains local secrets in ignored `.local/project-settings.json`; inspect the canonical URL and settings before running it. Its environment updates affect production, preview, and development. Use separate databases/stores for independent preview testing in a broader rollout.

## Public entry and administrative access

`POST /api/auth/guest` opens a browser workspace without a code. It preserves any existing authenticated session; otherwise it creates one non-admin user and a 30-day signed HttpOnly session. A new guest has a lifetime allowance of three submissions. Same-origin checks and per-IP session-creation limits apply. Public access does not bypass upload/job ownership, quotas, admin checks, worker authentication, or `BETA_ACCEPTING_JOBS`.

The visitor's cookie is the access key to their private workspace. Another browser or clearing cookies opens a different workspace; signing out revokes the current session. There is no guest account recovery or cross-device sign-in. Guest creation limits reduce repeated session creation; they do not make a browser identity a verified person.

Administrative invitation redemption remains available through same-origin `POST /api/auth/redeem` with `{ "token": "OWNER_INVITATION" }`. The real `BETA_OWNER_INVITE_TOKEN` is single-use and never recreated after redemption; it is no longer required or requested by the public interface. `/invite` redirects to the studio. An authenticated owner can POST `/api/admin/invites` with JSON `{ "email": "tester@example.com", "name": "Tester", "jobAllowance": 20 }`, a same-origin header, and their session cookie. The response contains a seven-day single-use code. Deliver it privately through an approved channel. This application does not send email.

Sessions last 30 days. Sign-out revokes the current session. A new invitation can sign an existing invited user back in; it does not reset their allowance or consumed-job count. `job_allowance` sets the lifetime submission allowance when a user is first created, and `jobs_used` increments once for each accepted submission, including jobs that later fail. Repeated idempotent submissions do not increment it. Increase an existing user's allowance through trusted database administration. To revoke a user's access immediately, set `studio_users.disabled_at` through trusted administration and revoke that user's sessions. Never expose the bootstrap owner code through public entry.

## Configured limits

| Control | Default / deployed beta setting |
| --- | --- |
| File count | 12 per submission |
| Individual file | 250 MiB |
| Combined uploads | 500 MiB |
| Text PRD | 15 MiB; PDF, Markdown, or plain text |
| Reference | 100 MiB, 180 seconds; uploaded or direct public video URL |
| Public page capture | 55 MB reserved download budget, at most 4 concurrent downloads, 8 MB per resource and 500 requests; failed transfers conservatively consume their reservation |
| Product recording | 300 seconds |
| Running/queued jobs per tester | 1 deployed; configurable |
| New jobs per user per day | 3 deployed; also lifetime user allowance (three for new guests) |
| Global running workers | 2 |
| Queue attempts | 3 with bounded backoff |
| Sandbox | 4 vCPUs; one 30-minute execution window across all attempts, including setup and recovery waits |
| Claude requests | At most 10; input/output token budgets recorded |
| Audio generation | At most one music and one SFX request per job |
| Automatic repairs | At most 2 across all attempts, durably reserved before a paid repair |
| Artifact storage | 2 GiB cumulative reserved bytes and 400 reservations, including retries |
| Video | 30 fps, H.264/AAC, full HD; maximum 5 minutes |
| Submitted job source/project/output retention | 30 days from submission; reused uploads extend to the latest associated job expiry |
| Unsubmitted uploads | 1 day from upload reservation |

These are resource limits, not a dollar-cost guarantee. Provider request IDs, actual token/audio/ASR usage, worker timings, and output locations are retained. `cost_usd` remains null until provider and compute invoices are reconciled; it must never be presented as zero. Do not publish a measured cost estimate until representative jobs and billing have been reconciled.

Use the [operator measurement workflow](JOB-MEASUREMENTS.md) to record invoice-backed costs for every attempt and attributed publishability reviews. Its default commands are offline, unknown components keep the total unknown, and an optional explicit reconciliation can fill a terminal job's cost and retain review evidence without changing its readiness. Operator judgments remain distinct from tester feedback.

## Recovery and cleanup

Workers heartbeat every 25 seconds; leases expire after 180 seconds. Queue claims lock rows, enforce global and per-user concurrency, and reject callbacks from old leases. A recovered attempt stops its predecessor sandbox, restores stored artifacts, and reuses completed audio with checksum verification. A reserved audio request whose result was lost is held for review rather than charged again automatically.

Cron also removes expired objects in bounded batches using exact job/owner paths, then removes expired job/upload database records. Download availability ends at record expiry even if deletion has not run yet. Reserved artifacts and failed/intermediate drafts count toward job limits and retention. Expired sessions and rate-limit entries are pruned. Invitation records remain stored, including consumed bootstrap invitations, to prevent reuse. User records and lifetime `jobs_used` counters survive job retention.

Before allocating compute, dispatch records the SHA-256 of the bundled worker and skill files, the exact Sandbox snapshot ID, and a combined runtime digest. Retries use that recorded snapshot. A changed bundle or mismatched runtime digest holds the job for review before any new paid work; the worker also compares the digest in restored version records. Keep the original deployment and snapshot available when changing the worker protocol or skill.

Dispatch also records the original execution start and absolute deadline before allocating compute. Retries, setup and lease recovery consume that same window; changing configuration cannot extend an existing job. A worker cannot overwrite these server-owned fields. Jobs with an invalid or missing prior deadline fail closed, and fewer than 60 seconds remaining cannot start another worker. The worker independently honors the absolute deadline. Repair reservations are retained with the job; an interrupted reservation stops for review instead of repeating an uncertain paid repair.

Use Vercel function logs for API/dispatch failures, Sandbox logs for worker diagnostics, and `studio_jobs` for state, checkpoint, quality, lease, and failure details. Worker tokens are job- and lease-scoped. Never log raw provider responses, secrets, or source documents. A failed or unperformed quality check must remain `needs_review` or failed.

## Verification commands

```sh
npm test
npm run typecheck
npm run build
# Enable STUDIO_DB_INTEGRATION=1 for the isolated Neon test.
node --env-file=.env.local --import tsx --test tests/backend-database.test.ts
# Enable STUDIO_STORAGE_INTEGRATION=1 for the private Blob and worker-route test.
node --env-file=.env.local --import tsx --test tests/backend-storage.test.ts
# Enable STUDIO_INGEST_INTEGRATION=1 for local media/browser/network failures.
npx tsx --test worker/ingest.test.ts
npx tsx worker/smoke-render.ts --out .worker-smoke
```

Database integration tests are opt-in; inspect their required environment flag. They create an isolated test schema and clean it afterward. Renderer smoke uses clearly labelled synthetic media and does not prove Claude, ElevenLabs, real-product factual quality, or private delivery. Never put synthetic smoke files in a customer's finished library.
