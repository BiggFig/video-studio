# Video Studio

A publicly accessible studio for turning a software product URL, or a PRD with visual assets, into one checked launch or feature-demo video. Opening the studio creates a private browser session without an invitation or signup form. The Next.js interface uses a quiet, responsive design with system typography, light/dark appearance, persistent progress, and private preview/download.

The application includes a Neon-backed durable queue, private Vercel Blob uploads, isolated Vercel Sandbox workers, Claude direction grounded in the unified Video Studio skill, an FFmpeg/browser compositor, ElevenLabs instrumental music/SFX, and bounded quality review and repairs.

**Current rollout:** the web application is deployed at [Video Studio](https://video-studio-vert-two.vercel.app). Anyone can open a private workspace. Claude and ElevenLabs are configured, and real URL-launch and PRD-feature-demo outputs passed local quality checks. Generation remains disabled pending hosted worker, recovery, and private-delivery verification. See [MVP validation](docs/MVP-VALIDATION.md) for actual evidence and remaining work.

## Application development

```sh
npm ci
# Configure .env.local from .env.example; keep secrets out of Git.
npm run db:migrate
npm run dev
npm test
npm run build
```

Use Node 24. Local development runs at `http://127.0.0.1:3000`. See [operations and deployment](docs/OPERATIONS.md) for providers, worker snapshot creation, invitations, limits, retention, recovery, and rollout. The [worker README](worker/README.md) documents its private callback protocol and reproducibility contract.

The repository also retains the broader unified agent toolkit described below. Its deferred capabilities are not exposed in the beta application.

## Product scope

Read [PRD.md](PRD.md) for the MVP: software launch and feature-demo videos from a product URL, or a PRD with assets. Public entry replaced the invitation requirement on October 1, 2026; workspace ownership remains private. General footage editing is deferred to [ROADMAP.md](ROADMAP.md). The toolkit includes broader capabilities; its examples do not enable those features in the beta.

## Standalone toolkit

Requirements: Python 3.10+, FFmpeg/FFprobe. For motion composition: Node22+, pinned Hyperframes and a browser. Copy `skills/video-studio` to your agent's supported skills folder, or ask Claude Code in this repository to read `CLAUDE.md`. Do not install the upstream packs too.

MVP examples:
- “Turn this product URL into a launch video using real product visuals, on-screen copy, music, and SFX.”
- “Turn this PRD and these screenshots into a feature demo.”

Broader toolkit example, deferred from the SaaS MVP:
- “Edit assets/raw.mp4 like assets/reference.mp4. Keep my voice and add captions.”

The skill performs intake → analysis → plan → composition → render/review → delivery. It chooses relevant reference chapters internally. All jobs use the same timeline/asset/output contract.

## Layout

- `skills/video-studio/SKILL.md`: single workflow and authority.
- `references/` inside the skill: consolidated techniques, rendering, audio, quality, and SaaS execution.
- `scripts/` inside the skill: media tooling, optional ElevenLabs helper, repeatable repository export.
- `assets/` inside the skill: example plan, source revisions, capability map, license notices.
- `tests/`: synthetic media smoke test; offline provider tests. No paid calls.
- `docs/VALIDATION.md`: checks actually performed and untested integrations.

## Local tools

```bash
python skills/video-studio/scripts/video_tool.py doctor
python skills/video-studio/scripts/video_tool.py inspect /path/input.mp4 --out /path/analysis
python skills/video-studio/scripts/video_tool.py validate /path/job/plan.json
python skills/video-studio/scripts/video_tool.py roughcut /path/job/plan.json --out /path/job/renders/draft.mp4
python skills/video-studio/scripts/video_tool.py verify /path/job/renders/final.mp4 --plan /path/job/plan.json
python tests/smoke.py
```

Copy `assets/plan-example.json` into a job directory and supply real local assets before validation. The example references a user file; it is not a bundled sample. Jobs live outside the skill.

`roughcut` is base assembly and refuses captions/effects/extra audio. The agent must implement styled edits in a compositor. ASR, semantic reference review, IG/TT ingestion, and cloud infrastructure are configured integrations, not implemented by the skill text. Optional ElevenLabs calls incur provider charges. Advanced recipes do not install every renderer.

## Renderer dependencies

The candidate renderer is pinned in package.json. Run `npm install` in the worker/project and follow the skill's rendering chapter. No consumer Claude account or API key is distributed. Use approved provider authentication and per-job cost limits.

## Sources

See `skills/video-studio/references/provenance.md`, `assets/sources.json`, and source license notices. Source media, framework licenses, and service terms are separate. Unlicensed gist/Outliers/illustration material is conceptual context only, not vendored content.
