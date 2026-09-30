# Video Studio

One agent skill for reference-style footage editing and video creation. It consolidates BRAG's creative workflow, motion-design recipes, reference analysis, sound, and render review into one plan and one set of instructions.

## Start

Requirements: Python 3.10+, FFmpeg/FFprobe. For motion composition: Node22+, pinned Hyperframes and a browser. Copy `skills/video-studio` to your agent's supported skills folder, or ask Claude Code in this repository to read `CLAUDE.md`. Do not install the upstream packs too.

Example requests:
- “Edit assets/raw.mp4 like assets/reference.mp4. Keep my voice and add captions.”
- “Turn this product URL and these screenshots into a 20-second launch video.”
- “Turn this PRD and supplied images into a narrated explainer.”

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
