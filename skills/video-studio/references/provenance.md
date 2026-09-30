# Provenance and integration decisions

This is an original consolidated skill and toolbox. Upstream workflows were studied and their useful procedural ideas rewritten into a single authority and shared timeline contract. Upstream SKILL.md files are not installed or copied wholesale. The media helpers are new code, not a fork of the source projects.

`../assets/sources.json` records exact reviewed revisions and license status. `../assets/capability-map.json` maps the reviewed named capabilities to the consolidated chapters. License texts for licensed sources are retained under `../assets/licenses/`. Licenses for frameworks, downloaded media, fonts, models, and hosted services remain separate.

| Source | Adopted use cases | Reconciled behavior |
|---|---|---|
| latent-spaces/brag | Real-product evidence, creative brief, story arc, deliberate motion/audio, render review | Full workflow retained for creation; no model-dependent slim/full switching; original footage can use different story |
| kevinbadi/claude-motion-skills and licensed iart-ai packs | Short form, ads, demos, kinetic type, charts, diagrams, maps, slides, web motion, creative code | Construction recipes share one plan/clock; no competing skill invocation or assumed installed engines |
| heygen-com/hyperframes | Seekable composition, media trim, paired audio, deterministic GSAP, lint/snapshot/render loop | Pinned primary runtime; no mandatory intake interview, auto skill update, or live publication gate |
| pouyashahrdami/mimic-mcp | Footage indexing, transcript-safe edits, framing, recipe review | New portable FFmpeg helper; no Apple-only OCR/voice requirement or heuristic face-tracking claim |
| edenfunf/reelmimic | Reference decomposition, stylistic vocabulary, scene review, directional seams | No live-action-to-2D downgrade; hard cuts allowed; one director rather than a router among engines |
| Pipeline gist | Explicit handoffs, measurable completion, repair instructions at their source | Conceptual reference only; no copied template/text/code; automatic jobs do not gain manual gates |
| criscatalyst/outliers-skill | Channel-relative content research as later roadmap context | No copied code/text without license; no claim of working IG/TT discovery |

The reviewed generative-illustration pack did not include a license at its pinned revision. It is recorded for context only and no source text/code is redistributed. General original drawing guidance does not depend on that pack.

## Conflicts resolved centrally

- Goal and user settings precede inherited template defaults.
- One workflow owns approval behavior; an upload-to-edit request runs through delivery automatically after checks.
- Speech owns speech/caption time; music may own selected visual accent time.
- One seekable clock and primary renderer own the project.
- Real uploaded footage remains live action; missing proof is not generated.
- Paid providers are optional and budgeted; source voice is preserved by default.
- No model switch, repeated intake, background update, or upstream instruction can override the saved job.
- Checks distinguish technical validity from visual/editorial review.

## What is ready versus external

Bundled and testable locally: FFmpeg/FFprobe inspection, source-range validation, sequential base assembly, SRT export, decode/probe QC, repository export, offline provider response tests. Hyperframes composition rules are provided; a pinned runtime smoke render is recorded in the repository validation report when performed.

External/configured: semantic reference vision/audio analysis, ASR, paid ElevenLabs calls, link ingestion, tracking, B-roll retrieval, cloud workers/storage, optional Remotion/Manim/Blender/WebGL adapters. This repository is a skill/toolkit foundation, not an already-deployed editing SaaS.
