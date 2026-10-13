# Director implementation — 12 October 2026

Working record for the approved 12-item task list. This document separates prepared artifacts, implementation, technical verification and external audience evidence. Status is provisional until supporting checks are recorded.

**Automatic acceptance: 0 passes.** V23 passed 792 tests, TypeScript and the production build, but all three fresh jobs stopped during UI validation. Source capture and request transport are improved; model output still fails specific presentation and workflow contracts. Source checkpoint `262636a` records the verified code. V24 work targets exact presentation choices and distinct source-bound demo compositions. The public alias remains on the earlier release, and the six authored Tally exports remain separate. See the [workflow report](WORKFLOW-RECONSTRUCTION-2026-10-12.md) and [acceptance record](DIRECTOR-AUTOMATIC-TESTS-2026-10-12.md).

## Reviewable pilot

`/direction-lab` presents a source-grounded Tally storyboard with eight selectable views, three placement sketches, six verified exports, earlier Tally comparators, implementation status, reference mechanisms and an experiment plan. The user approved the storyboard before final rendering on October 12. The new treatment and matched control are available in all three placements. All available players start muted and pause when their component is replaced.

`public/direction-lab/manifest.json` is the versioned public metadata source. The film schema contains source links and dates, planned times, focal subject, camera, action, consequence, continuity, per-placement media and baseline media. Other automatic-product outputs can be added to the same schema. Downloaded ADDX reference videos remain private.

The source story is taken from `docs/social-ads/tally.md`: scattered client information → document-style form creation → Publish → illustrative respondent submission → default thank-you → explicitly editorial example brief → create a free form. The same Ada / ada@example.com / A new landing page values persist. The opening uses three editorial question cards. The editor starts with the name field and project question already present; `/email` adds only the email field. “Build it like a doc.” remains on the Publish shot. “Ask once. Get the details.” remains through confirmation, and the CTA is “Create a free form” with tally.so. The video must not suggest messaging imports, an invented share modal, or a native Tally response dashboard.

The director pilot is budgeted at 24 seconds: hook 0–3; editor 3–10 (Publish close-up from 7.5s, click approximately 7.67–8.07s, followed by a hold); respondent 10–15.3; confirmation 15.3–18; example brief 18–21; CTA 21–24. Earlier social cuts last 18 seconds. The new/old comparison therefore evaluates the overall creative change. The matched 24-second control holds script, source media, UI geometry/actions/states, soundtrack, duration and placement fixed. Its changed variable is the complete director treatment: camera framing, composition, layer timing and materials. It does not isolate the contribution of any one mechanism.

## Checklist status

| Step | Current state | Required evidence to close |
|---|---|---|
| 1. Quality benchmark | Complete | Eight films, 729 frame samples and 163 annotated ranges; selected mechanisms are in the lab and ADDX research report. |
| 2. Tally pilot | Complete | Approved authored story rendered through the shared engine; six verified treatment/control exports. This is not automatic URL acceptance. |
| 3. Shot plan | Approved | User approved the eight-view storyboard before final rendering, October 12. |
| 4. Semantic camera | Complete | Source-bound context/input/commit/result targets, reserved readable holds, deterministic seeks and decoded-export checks. |
| 5. Persistent objects | Complete | Exact semantic state matching preserves objects; state replacement, hidden future controls and duplicate ghosts have regression coverage. |
| 6. Independent tracks | Complete | Camera, cursor, copy, UI and materials have separate timing on one clock; replay checks preserve DOM/state and render tolerance. |
| 7. Visual systems | Partial | Brand-based materials and layouts implemented. Tally uses paper, ink and observed blue controls with Geist fallback typography; richer source-media treatments remain unverified. |
| 8. URL integration | Implemented; end-to-end acceptance incomplete | V23 source capture and lossless requests passed technical checks; fresh jobs still stopped at UI validation. V22 Resend remains a rendered draft with only its first visual-review batch passed. |
| 9. Three placements | Complete | Separate 1920×1080, 1080×1350 and 1080×1920 treatment/control exports, 720 frames each. |
| 10. Review the pilot | Technical/visual checks complete; external evidence pending | Subjective listening and five distinct unfamiliar viewer responses still required. |
| 11. Generalization | Incomplete | Zero automatic passes. V23 Resend chose an out-of-range color; Plausible merged required source slots; Tally proposed a control absent from its starting state. All failures are retained without changed-code resumes. |
| 12. Publish and test | Pilot gallery live; audience test pending | Six approved exports and viewer form deployed. Audience outcomes remain pending; paid budget must be agreed before spend. |

## Comprehension collection

`/direction-lab/viewer` is separate from the explanatory storyboard. It supports version and placement selection and asks four open questions without giving the expected answers. Participant code, familiarity and viewing conditions are recorded. A response is saved only in browser storage; JSON download is provided, including a direct-download fallback if browser storage is unavailable. Responses are unscored. Neither agent simulations nor the project team qualify as the five unfamiliar viewers.

`public/direction-lab/test-plan.md` supplies the facilitator rubric, matched-variant requirements, proposed four-of-five comprehension gate and downstream activation measurement plan. No paid campaign, account change or spend is initiated by this implementation.

## Design and accessibility

Apple design skill applied to the review interface. Principles used: group related controls and progressively disclose details (Layout); preserve legible type and avoid truncation (Typography); use text as well as color for states, visible keyboard focus and controls at least 44px tall (Accessibility); use semantic page colors across light/dark appearances while retaining the Tally brand inside storyboard sketches (Color).

Review interface animations are avoided; films require explicit play and include native controls. The storyboard sketches are explanatory artifacts rather than screenshots of a generated final film.

## Verification

- Final full test suite: 528 tests, 493 passed, 35 intentional optional skips, zero failures. The successful run permitted loopback access required by the local HTTP fixture.
- All six public exports passed full decode, 720-frame/24-second dimension checks, source-plan/report binding, layout checks and 28 replay checks. Replays require identical DOM/state/geometry plus SSIM ≥ 0.97; minor Chromium antialiasing differences are retained in the reports rather than called byte-identical. Final decoded frame samples were visually inspected. Production SSIM thresholds were not relaxed.
- All six share the same authored script SHA-256 `04d49a54428ee3dc014cf89d0230fcbc36d3a0d75d34c73abb97ea8dbfda5067` and encoded AAC packet SHA-256 `5d6d5fcc91e497bf13679d55248235d2951d25ea2948588c29ad970dca8ef074`. Public per-export JSON contains verification metadata without private workspace paths. Matching audio and technical levels do not establish subjective listening quality.
- `npm run typecheck` passed after the initial implementation.
- An isolated browser check passed all 24 storyboard/placement combinations, muted playback and replacement, mobile width without horizontal overflow, dark appearance/reduced motion, pending export behavior, viewer answer separation, response persistence and JSON download. The saved response was explicitly synthetic UI verification in a disposable browser context; it is not comprehension evidence.
- Desktop, mobile storyboard, respondent close-up and dark-mode screenshots were captured under `.local/direction-lab-qa/`; desktop and mobile storyboard screenshots were visually inspected.
- The first Next development servers announced readiness but stalled before request handling in both Turbopack and webpack modes. Those task-owned servers were stopped. A private standalone preview bundles the exact React/CSS review components and serves them at `http://127.0.0.1:3108/direction-lab`; HTTP 200 and the browser checks were verified against this fallback.
- Final production build `npm run build -- --webpack` passed on October 12, including the prebuild worker bundler, TypeScript and all 20 static pages. Webpack compiled in 12.1 seconds; TypeScript completed in 3.0 seconds. All 97 bundled worker/skill files were compared with their current source and matched, including `worker/shot-director.ts`. Worker-bundle SHA-256: `3bca2a8bcb1c4783ef3fcf3674501f5cd56a337f1ee9ba236eb5d35b15034e86`. Build log: `.local/direction-lab-final-build.log`.
- The resulting Next production server on port 3109 passed actual-route checks for `/direction-lab` and `/direction-lab/viewer` with all six ready exports. Every player loaded the expected dimensions and 24-second duration, started muted, played, and sought to 15.8 and 23.8 seconds. Switching placement paused the previous detached players. Native Chromium sound controls were clicked to unmute and mute again; this verifies control behavior, not auditory listening. Both 390px and 375px layouts had no horizontal overflow; dark/reduced-motion presentation and synthetic viewer save/reload/JSON-download checks passed with zero page errors. Evidence: `.local/direction-lab-final-qa/result.json`, `native-controls.json` and screenshots. The global skip link was separately confirmed offscreen initially and after focus moved away; it appears only while keyboard-focused (`skip-link.json`).
- Step 12's status wording and the test-plan introduction received metadata-only edits after that build; media and application code were unchanged. The deployment build must compile that final text. Deployment verification, five unfamiliar viewer responses, paid performance evidence and subjective listening review remain separate requirements.
- Matched feed and vertical controls rendered at 1080×1350 and 1080×1920, each 720 frames at 30fps with full decode, layout and 28 replay checks. Eight decoded final MP4 frames per control were visually inspected; the corresponding `result.json` records `reviewedVideoSha256`, contact-sheet frames and the limits of that sampled review. Small UI labels in the wider control composition remain a comparison limitation. Audio packets are byte-identical to the owned 24-second source track; this establishes matching sound, not a listening review. Evidence: `.local/director-pilot-20261012/control-comparison.json`.
- A pilot-only shared-reference bug was corrected by cloning authored scenes before adding director metadata. The focused regression test proves control/treatment authored-script identity and saved-plan binding in all three placements. `scripts/director-repair-pilot-metadata.ts` corrected existing scripts only after regenerated plan JSON equaled each saved plan and its script binding matched. It did not rewrite plans, rendered videos or the automatic runtime. Repair history and hashes are recorded in `.local/director-pilot-20261012/authored-script-metadata-repair.json`.

## Provider recovery follow-up

The [OpenRouter recovery report](OPENROUTER-RECOVERY-2026-10-12.md) supersedes the original provider-access block. Real research and UI requests succeeded, compact research was verified, and that revision's suite passed 504 tests with 35 optional skips. Those earlier acceptance failures remain retained.

The [workflow reconstruction report](WORKFLOW-RECONSTRUCTION-2026-10-12.md) records the subsequent capture, planning and state-contract work. The completed v7 batch produced no audio or automatic video: Plausible reconstructed an unsupported empty starting screen, Baserow exceeded the guide explanation metadata bound, and Resend reached scripting but failed both bounded workflow reviews because its revised company name contradicted the retained sign-off. The explanation bound was corrected without truncating source data or increasing the 768-token selector cap. Fresh v8 Plausible and Baserow runs also stopped before rendering; the reconstruction report records their actual outcomes and the subsequent corrections. No automatic pass is inferred from unit tests, a completed intermediate stage or the six authored Tally exports.
