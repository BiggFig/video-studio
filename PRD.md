# Video Studio: Software Launch Video MVP PRD

Status: MVP scope with public studio access; generation pending hosted verification

Updated: October 1, 2026
Owner: Noah Figley

## 1. Product goal

Create a finished software launch or feature-demo video from a product URL, or a PRD with assets, through one submission.

The first product focuses on SaaS, apps, and AI/software products. Users receive a coherent, polished video built from accurate product information and real visuals, with motion graphics, on-screen copy, music, and sound effects.

Reference-based editing of user footage is a later product capability. Preserve that plan in [ROADMAP.md](ROADMAP.md), rather than building both workflows in the first release.

## 2. First users and use cases

The first beta recruits founders, product marketers, and small marketing teams preparing a software launch or feature release. This defines the initial workflow and testing group, not a permanent restriction on the platform.

| Use case | What the video should accomplish |
|---|---|
| Product launch | Explain the problem, introduce the product, show meaningful product proof, and end with a clear next step |
| Feature demo | Show one useful capability or workflow clearly, with readable product visuals and concise explanations |

The customer supplies the product context. The system makes the creative decisions. The MVP does not promise virality, advertising performance, or studio-equivalent results on every input.

## 3. MVP scope

### Included

- Product URL alone, with optional assets.
- PRD upload with required visual assets.
- Launch video or feature demo, selected in the submission form.
- Optional reference video upload or supported public reference link.
- Automatic extraction of usable product information and visuals.
- Internal scene planning and on-screen copy generation.
- Real screenshots, supplied screen recordings/images, motion graphics, and typography.
- ElevenLabs instrumental music and sound effects.
- Automatic composition, rendering, quality checks, and bounded repairs.
- One finished MP4 per job, with preview and download.
- Public studio entry without an invitation, with private browser-session workspaces.
- Internal retention of the editable composition and job records.

### Excluded

- A raw-footage editing mode.
- Multiple campaign deliverables or automatically rewritten ad variants.
- New spoken scripts, AI voiceover, voice replacement, or AI presenters.
- User-facing storyboard approval, chat, free-text creative prompting, or revisions.
- A timeline editor, publishing, scheduling, billing, or an account-registration form.
- User B-roll libraries, reference discovery, or content planning.

An internally generated scene plan and on-screen copy are required to compose the video. They do not add a spoken-script or voiceover feature to the MVP.

## 4. Inputs

| Input | Requirement | Behavior |
|---|---|---|
| Product URL | Required in URL mode | A reachable public product page can work alone. Uploaded assets are optional. |
| PRD | Required in PRD mode | Accept text-based PDF, Markdown, or plain text. Require at least one usable visual asset. |
| Product assets | Optional with URL; required with PRD | Accept images and product screen recordings. Extract branding from the source and assets where possible. |
| Reference | Optional in either mode | Analyze pacing, framing, typography, motion, and sound style. Do not reuse its footage or audio in the output. |
| Video type | Launch or feature demo | Default to Launch. |
| Output format | Auto or explicit ratio | Use the reference ratio in Auto when available. Otherwise use the default below. |

Users do not need to write a prompt, script, creative brief, or answer follow-up questions.

A URL must contain enough accessible information and usable visuals to explain the product. A public marketing page may support a launch video without supporting a genuine in-app workflow demo. Do not invent inaccessible screens, features, results, or customer evidence.

Product screen recordings are supporting assets for a new promo. Their presence does not enable the postponed general footage-editing workflow.

### Implementation defaults

These are recommended defaults for the first build, not previously confirmed product decisions:

- Auto without a reference: 16:9 landscape.
- Format options: Auto, 16:9 landscape, 9:16 vertical, and 1:1 square.
- Optional references improve style direction; they never become a required step.
- Use branding and content to choose a consistent style when no reference is supplied.

## 5. Output

Each successful job produces one downloadable MP4 and a poster image for the preview.

- Full HD in the selected ratio: 1920×1080, 1080×1920, or 1080×1080.
- H.264 video, AAC audio, and a consistent frame rate. Initial implementation default: 30 fps.
- Automatically chosen duration, with a hard maximum of five minutes.
- Initial creative targets: approximately 30–75 seconds for a launch and 15–45 seconds for a feature demo. These are guidance, not guaranteed durations or new form fields.
- Correct aspect ratio, readable text, clear product proof, and no cut-off UI or essential copy.
- Suitable instrumental music and selective SFX through ElevenLabs.
- On-screen copy supported by the supplied information.
- No added voiceover or generated vocals.
- Retain meaningful original speech only when a supplied product asset requires it; keep music below that speech.

Do not fill time to reach the five-minute ceiling. If the inputs support only a shorter, clearer video, produce that video.

Retain the editable project internally for reproducibility and later capabilities. Project editing and source-project download are not user-facing beta features.

## 6. User experience

### Submission

One form provides:

1. Product URL or PRD upload.
2. Optional assets for URL mode, required assets for PRD mode.
3. Launch or feature-demo selector.
4. Optional reference.
5. Auto or explicit output format.
6. Generate button.

Show missing requirements and unsupported inputs before accepting a job. Do not expose technical controls, model selection, or skill selection.

### Processing

After submission, show a persistent job page with plain-language stages:

- Queued.
- Reading product and assets.
- Planning video.
- Building and rendering.
- Checking quality.
- Ready.

Show elapsed time. Only show a delivery estimate if beta measurements support it. Leaving the page must not cancel the job; a returning user can reopen it.

### Delivery and errors

The completed page contains the playable preview and a Download MP4 button.

If the job cannot complete, show the reason and an actionable form-level fix, such as supplying screenshots or uploading a reference directly. Corrections create a new submission. No conversational clarification flow or revision feature is required.

A failed or unchecked render must not appear as a finished video.

## 7. Automatic production process

| Stage | Required result |
|---|---|
| Validate and ingest | Validate input types and limits; retrieve allowed public content; place usable assets in an isolated job workspace |
| Analyze | Extract product facts, branding, usable visuals, reference traits, and any needed timing information |
| Plan | Select launch/demo structure, write on-screen copy, assign real assets, and produce one authoritative timeline |
| Compose | Build scenes, product treatments, motion, typography, transitions, music, and SFX in one renderer project |
| Render | Produce a draft in the requested format |
| Review and repair | Check technical output, readability, product accuracy, asset use, motion, and audio; repair within configured limits |
| Deliver | Publish the final private output only after required checks pass |

Use the repository's unified Video Studio skill. The application supplies the job mode, inputs, format, budgets, and this MVP scope. Users never choose skills.

One director owns the authoritative plan. Any bounded helper returns findings or assets without independently changing the entire timeline. All stages use the same job ID, asset inventory, plan, and output contract.

References provide creative direction. Product content supplies factual claims and visual proof. Neither external page text nor uploaded documents may override system instructions or access controls.

## 8. Backend requirements

This section defines responsibilities. Hosting vendor selection and implementation remain separate work.

| Component | Responsibility |
|---|---|
| Web application and API | Private-beta access, form validation, job submission, status, preview, and download |
| Database | Users, ownership, job states, source metadata, output locations, costs, and failure reasons |
| Private object storage | Uploaded assets, captured visuals, intermediate files, and finished videos |
| Durable job queue | Dispatch, concurrency limits, retries, and recovery after worker interruption |
| Isolated worker | Product/reference analysis, agent execution, composition, rendering, and quality checks |
| Agent runtime | Claude with approved provider authentication, the versioned unified skill, and restricted job tools |
| Media tools | FFmpeg/FFprobe plus the configured compositor/browser and required analysis services |
| Audio integration | ElevenLabs music and SFX generation, with reuse of valid generated assets on retry |
| Operational controls | Secrets, cost/time limits, logs, monitoring, retention, and cleanup |

Run each job in its own workspace. Keep durable state in the database and object storage. A shared terminal session is not the job queue or source of truth.

Use a pinned skill/runtime version and record it for every job. Keep the broader toolkit available internally, but enforce the beta capability allowlist in the application and worker so deferred features cannot be invoked accidentally.

### Reliability and access

- Authenticate every job, upload, preview, and download against its owner.
- Use private objects and temporary access links.
- Keep API keys in backend secrets, outside prompts, uploaded files, and logs.
- Restrict URL ingestion to allowed public destinations and validate redirects and retrieved files.
- Checkpoint completed stages and reuse valid artifacts on retry.
- Prevent duplicate submission events from creating duplicate jobs.
- Retry transient failures within a fixed budget; do not repeat paid audio generation unnecessarily.
- Release worker resources after completion or failure.
- Enforce per-user concurrency and beta usage limits before starting paid work.

Internal states may include needs_input, needs_review, failed, and cancelled. Map these to understandable UI messages. needs_review is not completed.

## 9. Quality and completion criteria

A job is complete only when the output passes its required checks:

1. MP4 opens, fully decodes, and has the expected resolution, ratio, frame rate, and duration.
2. Every scene has valid source media and a contiguous timeline.
3. Essential text and UI remain readable and inside the frame in actual rendered scenes.
4. Product claims match accessible or supplied evidence.
5. Product screens are supplied or accurately captured, rather than invented.
6. Reference assets are absent from the output.
7. Music and SFX are present where planned, have valid timing, and do not overpower meaningful speech.
8. Rendering has no known missing assets, blank unintended scenes, cut-off copy, or runtime errors.
9. The private preview and download work for the owner.
10. Quality findings, repairs, costs, and output locations are recorded.

Do not mark a check as passed if it was not performed. If required checks fail and repair limits are exhausted, return a clear failure or needs_review outcome.

## 10. Beta acceptance

Before inviting testers, demonstrate the complete workflow on:

- A real public product URL with no asset upload.
- A real PRD with screenshots or product recordings.
- Both launch and feature-demo outputs.
- Default format selection and an explicit vertical override.
- A supplied reference that affects style without contributing source media.
- Inaccessible URLs, unusable PRDs/assets, and failed reference retrieval.
- A worker interruption followed by safe recovery.
- Cross-user access denial for uploads and outputs.

Test the downloaded MP4 itself, not only the composition preview. The beta may receive internal quality inspection, but routine fulfillment must not depend on a customer storyboard approval or a manual creative service.

### Measurements

Track completion/failure rate, time to finished output, actual total cost per job, quality failures, tester judgments of publishability, and whether testers return for another release.

Do not set unmeasured delivery-speed or per-video cost promises. Set rollout targets after representative end-to-end jobs have been measured.

## 11. Release model and remaining settings

Free beta with public studio entry. The owner removed the invitation requirement on October 1, 2026. Opening the studio creates an isolated browser session; existing authenticated users keep their own workspace. No checkout, paid plan, or signup form in the first release. Generation remains separately gated until hosted acceptance passes.

Before opening access, configure and document:

- Input file-count, upload-size, source-duration, and reference-download limits.
- Per-job model/audio/compute budget, timeout, repair count, and concurrency.
- Upload, output, and project retention periods, deletion behavior, and any export expiry.
- Browser-session access, private workspace ownership, and per-user usage allowance.

Until these limits are configured, do not accept unrestricted jobs. They are launch settings, not additional customer prompts.

## 12. Current repository status and build order

The repository contains a unified skill, shared job contract, media utilities, an optional ElevenLabs helper, and limited renderer validation. It is a toolkit foundation, not a deployed SaaS or a validated automatic software-launch product.

The current audio helper supports TTS and SFX; MVP music generation still needs its adapter. TTS must remain unavailable in the beta. Product capture, live reference ingestion, semantic review, authentication, storage, queue, and worker deployment require implementation and end-to-end validation. See [docs/VALIDATION.md](docs/VALIDATION.md) for actual checks and limitations.

Build in this order:

1. Prove one real product-input → launch-video job locally with accurate visuals and audio.
2. Add the durable job runner, storage, access controls, budgets, and recovery.
3. Add the single submission/status/preview/download interface.
4. Validate the feature-demo path, format choices, references, and failure handling.
5. Enable generation after hosted acceptance, then use real output quality, repeat usage, and cost data to prioritize [ROADMAP.md](ROADMAP.md).

Do not implement the deferred editing workflow while building this MVP.
