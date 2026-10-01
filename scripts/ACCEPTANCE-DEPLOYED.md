# Deployed acceptance: prepared, not authorized by this document

`acceptance-deployed.ts` defaults to an offline plan. It does not create accounts,
upload source, start workers, change Vercel settings, or contact providers in that
mode. Execution flags prevent accidents; they do not replace user authorization.
The outstanding account and Sandbox approvals must be resolved before executing
those actions. This harness never uploads worker source or opens generation.

The currently proposed identity is one temporary **non-admin, two-submission**
account. A second identity is disabled by default. The optional
`provision-second` phase requires separate approval and gives that identity zero
submission allowance. Existing isolated-schema ownership tests are partial
evidence until an approved second deployed identity is used.
The optional zero-allowance invitation uses trusted, precisely scoped database
administration through the server helper. The public `/api/admin/invites` API
requires at least one allowed submission and does **not** support zero.

All state, invitation codes, cookies, and downloads are stored under the ignored
`.local/deployed-acceptance/` directory. Never print, attach, or commit `state.json`.
`report.json` contains safe check summaries; a missing or deferred check is not a
pass. The script does not use or consume the real owner's bootstrap invitation.

## Reviewed phases

Every command below except `plan` is an execution example to use **only after its
particular actions are approved**. Supply the exact deployed HTTPS origin during
provisioning. Subsequent phases use that saved origin and exact generated QA IDs.

```powershell
node --import tsx scripts/acceptance-deployed.ts --phase plan

# Approved primary account creation and single-use redemption only:
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase provision --origin https://YOUR-DEPLOYMENT --execute

# Optional: outside the single-account approval, requires separate authorization.
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase provision-second --execute --second-identity-approved
```

Before enabling paid acceptance, prepare and review the exact Vercel rollback to
`BETA_ACCEPTING_JOBS=false` plus redeployment. Keep production closed until the
approved worker source is present, the matching snapshot is configured, and that
rollback is ready. Generation enablement is a separate operator action; this
script refuses `submit` while the deployed session reports `acceptingJobs=false`.
It never inserts jobs directly into the database to bypass that gate. If any
acceptance phase fails after enablement, restore the closed-beta setting and
redeploy immediately; retain the failed evidence. The final `confirm-closed`
phase verifies the deployed state and must succeed before cleanup is complete.

Place intentional product inputs below `.local/deployed-acceptance/inputs/`, and
place the case specs below `.local/deployed-acceptance/`. Input paths are relative
to the inputs directory. The runner refuses paths escaping that directory.

Example `url-launch.json`:

```json
{"mode":"url","productUrl":"https://YOUR-REAL-PRODUCT","videoType":"launch","format":"auto","files":[]}
```

Example `prd-feature-demo.json`:

```json
{"mode":"prd","videoType":"feature-demo","format":"9:16","files":[{"path":"product/prd.md","kind":"prd","contentType":"text/markdown"},{"path":"product/screen.png","kind":"asset","contentType":"image/png"},{"path":"product/reference.mp4","kind":"reference","contentType":"video/mp4"}]}
```

Use real approved product evidence; a supplied reference must remain analysis-only.
Submission uses the real prepare/direct-private-upload/complete routes, then the
real job API. Each saved case has one durable idempotency key, and repeating the
submit request must return the same job. Two accepted submissions exhaust this
primary account's allowance, even if one fails. Do not reset the allowance to hide
a failed acceptance case; stop and review any further paid attempts separately.
Each upload reservation ID is saved before transfer. Retries verify that same
immutable reservation and require the original file checksum; they do not invent
a new reservation after an ambiguous transfer failure.

```powershell
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase submit --case url-launch --spec url-launch.json --execute --allow-paid
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase status --execute
# Submit the PRD case only after the first finishes, respecting deployed concurrency.
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase submit --case prd-feature-demo --spec prd-feature-demo.json --execute --allow-paid
```

Recovery is a separately approved, single interruption. It is permitted only on
the recorded QA job's first rendering/checking attempt after the ledger records
both generated audio assets as completed. The script stops only that job's exact
recorded sandbox, never a guessed sandbox or another owner's worker. It does not
expire leases manually, force ready state, or dispatch unrelated work. Allow the
normal 180-second lease expiry and minute cron to recover the job. `delivery`
then checks that attempts increased, the runtime digest stayed unchanged, and the
completed audio hashes and audio-generation count remained the same.

```powershell
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase interrupt --job RECORDED-QA-JOB-ID --execute --allow-interruption
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase status --execute
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase delivery --execute
```

Delivery requires actual ready/passed QC, owned byte-range preview, poster,
attachment download, and full FFmpeg audio/video decode of the downloaded MP4.
Set `FFMPEG_PATH` if it is not on PATH. It checks unauthenticated denial and, only
when separately provisioned, second-owner denial. Actual browser playback,
readability, reference influence and publishability still need the visual
acceptance review; successful byte delivery is not a claim that those were done.

## Cleanup

Restore and redeploy `BETA_ACCEPTING_JOBS=false` first. `revoke` expires only the
generated QA invitations, disables only matching non-admin QA users, revokes
their sessions, cancels their active jobs, and stops their recorded workers. It
retains job and media evidence. `purge` is a separate explicit cleanup phase that
also removes only those users' job/upload namespaces and corresponding rows.
It waits for the 15-minute upload-token window to pass (a 16-minute minimum) so
old in-flight grants cannot recreate objects immediately after cleanup. User
audit rows remain disabled. Production users, owner invitations and all other
Blob paths remain outside the cleanup scope.
If redemption committed but its response was lost before saving the user ID,
cleanup resolves only the exact generated QA email to a non-admin user before
revocation. FFmpeg verification runs with the worker's stripped media environment,
so API keys, tokens, database URLs and secrets are not inherited by the decoder.

```powershell
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase revoke --execute
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase confirm-closed --execute
# Only when removal of acceptance media is authorized and the token window elapsed:
node --env-file=.env.local --import tsx scripts/acceptance-deployed.ts --phase purge --execute
```

No live phase was run while preparing this harness. Record the user approvals and
actual check results separately; do not convert preparation into acceptance evidence.
