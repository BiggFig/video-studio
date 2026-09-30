# Validation performed on 2026-09-30

## Passed

- Single discoverable SKILL.md, valid frontmatter, resolved supporting resource links.
- Actual FFmpeg media integration: video trim, 1.5x picture/audio rate, image scene, contain/cover, 30fps canvas, exact duration, zero-start timestamps, full-file decode, retained audio energy.
- Contact-sheet creation, scene and silence candidate extraction; semantic analysis/ASR explicitly not claimed.
- Exact SRT timing; invalid source bounds, reference reuse, noncontiguous scenes, outside-job paths, and unsupported styling rejected.
- ElevenLabs offline fixtures: TTS response/audio/alignment, SFX payload, missing-key and reuse guards. No paid calls.
- Independent agent created a real 4-second 180×320 draft and editable project using the skill; probed 120 frames and source/audio correspondence. Listening/playback limitations were recorded, rather than falsely marking final quality passed. Its timestamp-offset finding led to corrected shared assembly using PCM intermediates and one final AAC encode.
- Hyperframes 0.8.97: actual 2-second 320×180 mixed footage, original audio, local font/GSAP, animated label and subtle zoom. Lint had zero errors/warnings; browser/runtime/layout/contrast checks passed; MP4 render and full decode passed. Rendered contact sheet visually inspected. Chromium153 software screenshot capture; WebGL unavailable, no shader/3D certification implied.

## Not tested

Real customer/reference videos, live ElevenLabs billing/voice quality, ASR/semantic media-analysis provider, Instagram/TikTok downloads, face tracking, B-roll search, cloud storage/queue/worker deployment, optional Remotion/Manim/Blender/WebGL adapters, social publishing.

Synthetic media smoke tests verify implementation plumbing; they do not prove style transfer quality on arbitrary customer footage. Skill instructions need real provider/agent capabilities for semantic analysis and editorial review.

## Reproduce

`python tests/smoke.py` in the exported repository runs local media and offline provider tests. Optional Hyperframes check uses `skills/video-studio/scripts/hyperframes_smoke.py` with an installed CLI, GSAP bundle, font, and working browser. All test media is synthetic and stored outside the skill.
