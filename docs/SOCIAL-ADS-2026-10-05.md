# Mobile social-ad revision — 5 October 2026

The user requested all four gaps from the creative assessment be addressed:
hooks, clear actions and consequences, dramatic contrast, and landscape-first
delivery. This release rebuilds the three stories and the comparison gallery.
It does not claim measured advertising performance.

## Delivered direction

| Product | Opening | Demonstrated action and consequence |
|---|---|---|
| Linear | Still copying bugs into an AI chat? | Select an agent on the issue, keep its context attached, and review the resulting draft PR. The draft first appears at 6.5 seconds after pacing review. |
| Tally | Still taking client briefs in DMs? | Build and publish a project-enquiry form, then show an illustrative respondent submit it. The same answers become a clearly labeled editorial example brief. No DM import is depicted. |
| Todoist | Laptop closed. Brain still open. | Capture one proposal task, recognize its date and priority, visibly press Add, then show the same pending task saved. No completion, sent proposal or reminder is claimed. |

Each is an original 18-second HTML/SVG composition, independently arranged for
1080×1920 Reels/Stories and 1080×1350 feed delivery. Critical messages and controls
are enlarged and placed in conservative platform-safe areas. Product-specific
colors remain; the prior hook cut's AAC audio is reused byte-for-byte.

Motion has a story role: intrusion or fragmented context creates tension; a
deliberate selection, publication or save establishes agency; a complete result
provides proof; a quieter hold communicates the consequence. The source-specific
facts, copy, timing and qualifications are in `docs/social-ads/`.

## Engine and gallery

- `studies/composition.ts` validates three supported canvases and emits matching
  CSS dimensions and renderer metadata.
- `scripts/render-launch-study.ts --social [--feed]` renders the new studies and
  verifies dimensions, complete decode, frame count, deterministic seeking,
  HTML/export fidelity and retained audio. `--dense-preview` adds five visual
  samples per second before export to catch transition problems early; it cannot
  be combined with a render or finish pass.
- `/launch-tests` has accessible format buttons, native muted players,
  per-format downloads, action/consequence explanations and the twelve previous
  landscape exports. Switching formats replaces the player rather than leaving
  hidden audio playing.
- Downloadable scripts and proposed organic/paid copy accompany a testing brief
  that measures qualified activation alongside attention. No campaign is launched.
- The reference portfolio and existing media remain. The production URL-generation
  worker's semantic contents are unchanged; these remain authored studies rather
  than automatic generation acceptance results.

## Review boundaries

Scene keyframes, dense decoded 5fps samples and selected full-size frames are
reviewed visually. Source facts are checked against current official product
documentation. The sampled review is not a human normal-speed listening test.
Browser playback checks establish technical delivery, not audience response.
The test brief explicitly calls for external comprehension and controlled
audience testing before a claim of advertising effectiveness.


## Final export measurements

All six exports pass complete decoding and preserve the previous hook audio.

| Film | Canvas | Fidelity samples | Minimum SSIM | SHA-256 |
|---|---|---:|---:|---|
| linear / reels | 1080×1920 | 36 | 0.993954 | `d464e7b41544d60c94ac19bfe881a48e5e4537f2e878e89f61c1698aaeb7aad9` |
| linear / feed | 1080×1350 | 36 | 0.993235 | `408d8a9cfa8cae7ea9c5b64858799e73e4dfe08a663cd0230221a445f342fe5e` |
| tally / reels | 1080×1920 | 28 | 0.994617 | `57c3281bc75399680e5946334a827f30f84b94416e59ab6302965aa46df7359f` |
| tally / feed | 1080×1350 | 28 | 0.994271 | `5b33924fd88878541789f3647a173c3604303e4216c9b8dd44a946a4c70aa5c1` |
| todoist / reels | 1080×1920 | 32 | 0.993114 | `a892cb74bffd47a7ff859210f299a11ff3573e4d6d3ba94f4dd6e74bedffb7ac` |
| todoist / feed | 1080×1350 | 32 | 0.992773 | `365c0844a7848586891e96731d7eb5a1ad6580ae9c695d8c4a4578a5b1e88fc4` |

192 HTML/export fidelity samples meet the unchanged 0.97 threshold; 18 exact rewind checks pass. The artists reviewed all 540 decoded 5fps samples across the six files, with independent cross-review and additional full-size action/result frames. Each file is 18 seconds, 540 frames, H.264/yuv420p with AAC stereo. This establishes technical and sampled visual QA, not external audience comprehension or advertising results.

## Release verification

The final production build and TypeScript check pass. Local browser verification
completed on 5 October at 20:11 UTC: all six new files play through and seek,
format changes work with the keyboard, the previous player stops, and each new
player starts paused and muted. The gallery fits 320, 390 and 1280 pixel viewports
without horizontal overflow or browser errors. The earlier Linear hook cut also
plays correctly from its comparison disclosure.

Local delivery checks verified exact file hashes for all eighteen videos and
their posters, MP4 byte-range responses and all four downloadable briefs. The
production worker bundle retains the same 96 semantic entries; the production
job-state check at 20:11 UTC found no active jobs or pending reservations.
