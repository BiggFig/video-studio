# Editable UI reconstruction verification — October 2, 2026

## Scope

Fresh product research selects a supported workflow, a separate durable stage reconstructs editable UI data, and the script schedules trusted typing, pointer, selection and state transitions. Original sources remain review references. See [the pipeline contract](product-story-pipeline.md).

## Actual renderer evidence

A manually authored Obsidian fixture compiled through research v3, UI documentation, script and plan validation. Its 23.1-second, 1920×1080 output decoded all 693 frames. Eleven independently seeked hold/action comparisons matched the encoded video with SSIM from 0.998496 to 0.999804. Initial states, partial typing, the inline caret, click feedback and the resolved linked-note state were inspected. Portrait and square preflight checks passed.

Original source and reused audio hashes remained unchanged. This fixture used no model or audio-generation calls. It verifies the reconstruction renderer, not automatic research, scripting or semantic quality certification.

## Automated trial history

The first new isolated v3 URL trial stopped at research validation. Both responses exceeded the 240-character bound on non-authoritative documentation-goal notes. It consumed two model calls, 27,416 input tokens and 5,828 output tokens, with no audio generation. No historical job, production queue, guest allowance or deadline was modified.

Offline replay confirmed that bounding only those descriptive notes made both responses pass the complete original fact, source and capability validations. The raw responses remain unchanged. The future-run fix applies the same bounded-metadata handling already used for research summaries and descriptions.

## Release checks

The final default suite passed 265 tests with 16 optional integrations skipped, including metadata-bounding and exact hold/action export-inventory regressions. Actual collector/browser tests and renderer tests were run separately. The production application and bundled worker built successfully. The fresh automatic acceptance result will be recorded before release.

## Limits

The initial reconstruction path uses still UI sources and public DOM examples. A recording can remain source footage, but recording-derived editable reconstruction needs an explicit preview-source contract. The collector does not sign into products. Illustrative states demonstrate supported capabilities; they do not certify a live authenticated operation. No arbitrary-URL creative quality or premium production-quality guarantee follows from a single prototype.
