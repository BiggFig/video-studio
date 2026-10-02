# Local reference motion laboratory

Start with [the results and coverage report](../docs/reference-replication-results.md). These are manually authored, silent visual studies; they are not automatic URL-to-video outputs or production templates.

From the repository root:

```powershell
node --import tsx scripts/render-motion-study.ts original --render
node --import tsx scripts/render-motion-study.ts elevenlabs --render
node --import tsx scripts/render-motion-study.ts clickup --render
node --import tsx scripts/render-motion-study.ts reception --render
node --import tsx scripts/preview-motion-studies.ts
```

The source films must already exist at the local paths recorded in each study. Original media and generated artifacts remain in ignored `.local` directories; they are not distributed with the source code. The final command opens a local server and prints its URL. It does not publish anything.

Omit `--render` to inspect authored HTML frames without exporting. Use `--finish` only to regenerate comparisons after a completed export; the runner rejects changed HTML and requires a full rerender. The generated composition waits for local assets and exposes `await window.__studioReady; await window.__studio.seekFrame(123)`. Every exported picture is derived from an integer frame, not wall-clock playback.

`types.ts` describes a study, `composition.ts` supplies the GSAP/Hyperframes shell, and `viewer.ts` supplies the synchronized review page. Study scripts are static trusted repository code. Do not feed arbitrary provider-generated JavaScript into this local runner.
