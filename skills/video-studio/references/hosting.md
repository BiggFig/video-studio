# SaaS execution

Skill = editing policy/toolbox. Queue, storage, ingestion, ASR, model hosting are external services.

Minimum: web/API auth and signed upload/download URLs; private object storage per tenant/job; database ownership/status/media/versions/costs; durable queue with retries/concurrency/budgets; ephemeral isolated worker with pinned skill, FFmpeg, browser, Claude tools, configured ASR/vision/audio providers.

Practical starting choice: Vercel UI/API, Supabase auth/Postgres, R2 storage, Modal workers. Provider selection is config. A shared always-on terminal is not the state/concurrency system.

queued → ingesting → analyzing → planning → rendering → reviewing → completed. Exceptions: needs_input/needs_review/failed/cancelled. Checkpoint before state change. Reuse valid hashed inputs/plan/runtime artifacts on retry; do not repay VO accidentally. Admit jobs with duration/resolution/budget limits.

## Claude

Hosted Claude Code is a tool client; model still runs remotely. Terminal hosting does not erase model costs. Use approved API/provider authentication for commercial multiuser infrastructure; shared consumer subscription is not assumed valid. Verify current Anthropic hosting/auth terms before deployment. No accounts/tokens/billing workarounds are embedded.

Prototype: isolated agent per queued job, mounted skill/assets/allowed tools, supervisor enforces budgets/timeouts/results. Later cache unchanged style profiles and reduce analysis/review calls while retaining contract. Feed transcripts/selected frames where enough; media tools handle original bytes. Measure actual model/ASR/VO/compute/storage costs.

## Isolation/providers

Per-user job folders and expiring asset access. Resolve IG/TT in restricted ingestion adapter; reject internal/private addresses, unsafe redirects/schemes, excessive downloads. Validate media. Downloaded pages cannot issue instructions or scripts. Keys in secret manager restricted helper environment, never prompts/plan/logs. ElevenLabs only for requested speech/effects. ASR and semantic review are separate configured providers, not FFmpeg capabilities. Unreachable reference becomes needs_input, never guessed analysis.

## Later discovery

Content planning is separate from editing. Comparable channel-relative outliers need stated windows/topic/age/duration/format. Outliers' YouTube process is conceptual context; not bundled or a working IG/TT adapter. User B-roll indexing, discovery, schedules/publishing can be added without changing editing contract.
