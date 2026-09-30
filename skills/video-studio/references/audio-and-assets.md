# Audio, voice, and B-roll

Keep original speech by default. Pair source audio/video cuts. Listen around boundaries for clipped consonants, missing breaths, ticks. Tiny fades may help but cannot conceal missing syllables. Denoise/EQ only when needed.

## Optional ElevenLabs

`scripts/elevenlabs_audio.py tts` creates narration plus provider alignment; `sfx` creates short described effects. ELEVENLABS_API_KEY comes from environment/secret manager. Voice/model IDs are configured. Caller sets character/duration budgets and authorizes billed generation. Never include keys in prompts/files/logs/arguments.

Finalize script → generate → probe/listen → group actual character alignment into words → map into plan → fit holds. Preserve punctuation. No fabricated word timing. Missing optional credentials should not block original speech or silent work. A uploaded creator's voice is not replaced without instruction.

## Music/effects

Use user music or configured licensed library; record track/author/source/license/permitted use. Repository code licenses do not automatically cover sound assets. This skill bundles no commercial music. Reference soundtrack informs style, not output reuse.

Measure beats only when useful. Anchor a few meaningful reveals/cuts to hits; speech owns caption timing. Sparse SFX support actions rather than every text entrance. Voice sits above music. Measure true peaks/loudness and listen. If no target supplied, −14 LUFS integrated and ≤−1 dBTP are initial mix targets, not universal platform rules. Use actual measured two-pass normalization when required.

## B-roll records

Record id, tenant/storage key, media kind/duration/dimensions, creator/license/ownership, semantic tags, subjects/actions, framing/quality, available ranges. Tagging helpers return descriptions/confidence, not sensitive inferred facts. Retrieve by the actual scene claim, inspect frames, select source range and crop. Stock imagery must not imply fake evidence, endorsement, or function.

Asset preference: user footage → real product captures → configured licensed library → authorized generation. Everything enters the manifest before rendering. Missing proof goes needs_input, never invented replacement. Optional music can be omitted and recorded. Provider downloads become validated local files before rendering.
