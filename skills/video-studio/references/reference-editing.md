# Reference analysis and footage editing

## Build evidence

Obtain actual reference media through the configured ingestion adapter. IG/TT downloads are not guaranteed; reference upload is the fallback. Record screen UI/black bars and crop analysis appropriately. No successful metadata lookup means you watched the video.

Probe reference and raw footage. Sample regular frames and candidate cuts; listen to audio. Proxies support analysis; final rendering uses originals. `video_tool.py inspect` produces probe.json, a contact sheet, and heuristic silence/cut logs. Scene detector outputs are candidates, not semantic edits.

Transcribe speech with actual word timestamps using configured ASR. Index source ranges, complete thoughts, take quality, visible actions, subjects, framing, and useful B-roll. Do not infer words from stills or claim brightness heuristics are face tracking.

Write style.json with canvas, shot timing distribution, opening device, narrative functions, crop/subject placement, typography, caption grouping, palette, motion families, transitions, and sound accents. Each observation includes source time and measured/estimated status. Approximate uncertain font/BPM measurements honestly.

## Construct the edit

Keep best complete takes. Remove false starts/dead air where meaning survives. Silence can be intentional. Preserve negations, caveats, contractions, names, numbers, and breathing needed for natural speech. Optional crutch-word removal is checked by listening.

Map raw material to reference FUNCTIONS: hook, evidence, explanation, reaction, payoff. Apply pacing/visual grammar to the user's content. Reordering cannot create a different claim. Do not append a product CTA to editorial footage because a promo recipe includes one.

Inspect subjects across time for vertical cropping. Use a stable safe crop, an available tracker, or fit/letterbox. Check eyes, hands, demo object, speaker changes. Normalize rotation/VFR when the runtime requires it. Do not promise automatic face tracking without an actual tracker.

Plan cut/crop/zoom/hold/freeze/overlay/caption/B-roll/transition/speed explicitly. Source speech speed stays unchanged unless asked; synchronize audio and remap words if changed. Graphics emphasize specific meaning. B-roll must match the topic and can retain original speech underneath.

## Compare to reference

Review opening, representative shot lengths, cuts, caption density/placement, palette, motion direction/energy, and sound balance. Explain deviations caused by footage. No fabricated exact-match score. Transfer craft rather than reference characters, claims, soundtrack, or brand. Requested reproduction still uses authorized assets under the ingestion policy.
