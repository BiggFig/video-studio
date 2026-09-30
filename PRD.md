# Video Studio: Simple MVP PRD

Status: agreed core scope, private beta  
Updated: September 30, 2026

## Goal

Turn supplied content into a finished, downloadable video through one submission. Serve creators, brands, agencies, and SaaS/app teams. The product supports a broad audience; marketing campaigns can target different groups.

## Two creation modes

| Mode | Required inputs | Result |
|---|---|---|
| Edit footage | One raw video and a reference video upload or supported reference link | User footage edited using the reference's pacing, framing, captions, motion, and sound style |
| Create a promo | A product URL alone, or a PRD plus uploaded assets | A promotional video using real product information, visuals, motion, on-screen copy, music, and sound effects |

URL-based promos must work without additional asset uploads when usable product content is accessible. A PRD requires assets. A reference is required for footage editing. An optional promo reference is a proposed default to confirm, not a required extra step.

## User flow

1. Choose Edit footage or Create a promo.
2. Supply the required inputs.
3. Leave format on Auto or select an output format.
4. Click Generate.
5. See processing status.
6. Preview and download the finished MP4.

No chat, required free-text prompt, follow-up interview, revision requests, or timeline editor in the MVP. The system makes creative decisions from the supplied inputs.

## Output and audio

- Finished video length: up to five minutes. Choose the actual length from the reference or supplied content; five minutes is a ceiling.
- Format: match the reference automatically when present, with a selector to override it. Promo default and selector options remain to be finalized.
- Preserve original speech when editing raw footage.
- Use ElevenLabs for suitable music and sound effects. Prefer instrumental background music so new vocals are not introduced.
- On-screen copy and captions are allowed. New spoken scripts, AI voiceover, and voice replacement are excluded from the beta.
- Export a playable MP4 and retain the editable project internally.

## Beta scope

Free, private beta for invited testers. No public self-serve launch, subscriptions, payments, or billing UI. Exact invitation/access mechanism is an implementation decision.

Use the repository's single Video Studio skill and shared plan. Run each job in an isolated workspace. Analyze inputs, compose, render, review, and deliver automatically. No manual storyboard approval.

## Completion criteria

- Both input modes produce a real downloadable video.
- Output stays within five minutes and honors the selected format.
- Footage edits preserve speech meaning and use the reference's important style traits.
- Promos use supported product facts and supplied or captured visuals.
- Video, audio, captions, and layout pass actual checks before completion.
- Invalid files, unreachable references, inaccessible product content, and failed jobs receive clear errors. Request missing inputs through the submission form, not a conversational agent interview.
- Track failures, processing time, and actual job cost during the beta. Keep uploads and outputs private.

## Later

- Multiple raw clips per job.
- Scriptwriting and AI voiceover.
- User B-roll libraries and automatic tagging.
- Reference discovery and content planning.
- Revisions and public paid plans.

## Remaining decisions before implementation

- Maximum raw-upload file size and source duration.
- Promo default aspect ratio and available format options.
- Whether promos accept an optional reference.
- Per-job cost/time limits and file retention.

Implementation note: the current toolkit contains TTS and SFX helpers; music generation still needs its adapter. Verify live ingestion and provider integrations before beta access. ElevenLabs Music API reference: https://elevenlabs.io/docs/api-reference/music/compose
