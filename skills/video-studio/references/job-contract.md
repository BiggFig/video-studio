# Shared job contract

One job directory:
```
job.json                 request, mode, settings, budgets; no secrets
assets/                  originals, screenshots, generated intermediates
analysis/                probes, frames, transcripts, style.json
plan.json                authoritative asset/timeline contract
STORYBOARD.md            human-readable projection of the same plan
project/                 one primary renderer project
renders/                 draft.mp4, final.mp4, poster.jpg
qc.json                  checks, issues, repairs
result.json              status, outputs, assumptions, cost, versions
```

`job.json` includes job_id, request, mode edit/create, inputs, reference, output preferences, provider configuration, budgets, and automatic (true for upload-to-edit SaaS). Never store keys here.

Use integer timeline frames at integer fps (24/25/30/50/60 in v1). Source offsets are seconds. Frame intervals are half-open [start,end). Base scenes cover output contiguously. Extra graphics/captions/audio/transition layers do not redefine base duration. Source consumption = duration_frames / fps × playback_rate. Crossfades need real handles or explicitly planned held frames. Effects describe overlap, stacking, and implementation. FFmpeg roughcut refuses effects.

See `../assets/plan-example.json`. Required fields:
- version: 1; job_id; mode edit/create; renderer hyperframes/ffmpeg/remotion.
- output: width, height, fps, duration_frames.
- assets: id, path, kind video/image/audio, usage output/reference, rights; measured duration_seconds/has_audio when applicable.
- scenes: id, start_frame, duration_frames, asset_id, source_in_seconds, playback_rate, preserve_audio, fit contain/cover, purpose, reference_technique, effects.
- captions: text, start_frame, end_frame; optional words/style.
- audio: asset_id, start_frame, duration_frames, source_in_seconds, playback_rate, gain_db, role.

Assets are local files relative to plan.json or absolute within the job directory. Arbitrary remote URLs never enter the renderer. Reference assets are analysis-only and cannot be used as output media. Materialize generated graphics as image/video before validation. The helper independently probes sources rather than trusting manifest duration/audio claims.

Preserve-audio scenes imply source audio; do not duplicate them in audio. Map actual ASR/TTS word times through kept intervals: for source word time w, kept source start s, timeline start T, rate r, output time = T + (w-s)/r. Clip words to retained intervals, then listen around crossing edits. Captions are on final timeline, not raw-source time.

qc.json: status passed/needs_review/failed; technical, visual, speech/caption, reference checks; findings, repairs, evidence. Unperformed checks are not_checked. result.json: job_id, status (completed/needs_review/needs_input/failed/cancelled), outputs/storage keys, assumptions, unmet requests, observed costs, renderer/model/skill versions, QC path.

Only the director modifies plan.json. Bounded helpers return artifacts/findings for specific IDs, without racing to rewrite the plan.
