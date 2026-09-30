# Motion, typography, seams, captions

Define one system: canvas, safe rectangles, local fonts, hierarchy, palette, spacing, strokes, corner radii, motion vocabulary. Reuse tokens. Inspect actual brand/reference; product content is better than unrelated decorative cards. Actual fonts avoid changing text metrics.

Motion communicates cause, attention, or state: position/scale/opacity/mask/camera/drawing. Avoid constant idle wobble. Stillness helps accent a reveal. Fixed values and seeded randomness reproduce arbitrary seeks.

## Recipes on one clock

- Kinetic type: semantic units; quick stagger then reading hold; emphasize only important words.
- UI: real screenshot → cursor to actual control → click → real result → useful focal zoom.
- Lower third: accurate identity/title; hold then exit without hiding face/captions.
- Countdown/counter: derive value from frame, tabular numerals, exact endpoint, real deadline.
- Logo: preserve proportions/clear space and recognition.
- SVG/whiteboard: explanatory path order; nodes before connector edges.
- Comparison: equal scale, clear labels, shared anchor for match-cut when useful.
- Photo: deliberately varied focal paths; retain faces/objects.

## Seams

A continuous move can carry axis, direction, and perceived speed across a cut. Growing scale continues a push; shrinking continues a pull. Cut mid-motion only if content remains readable. Hard footage cuts are valid; do not impose continuous camera motion on all edits.

Choose cut/match-cut/slide/zoom-through/crossfade/rack-focus for content, usually one dominant family. Plan overlap, stacking, source handles, audio. An opaque stage prevents opacity-dip flashes. Inspect before/during/after each seam. A transition never hides the payoff or destroys speech.

## Captions

Use real ASR/TTS times mapped to final edit. Group short semantic phrases, sensible line breaks, typically up to two lines as a starting point. Word highlights require actual word timing. Measure actual rendered text, constrain width, inspect contrast/backplate and faces/platform controls. Safe areas vary; use configured platform overlays or conservative margins and inspect every aspect.

Check first/last words, names/numbers, sentence ends, overlaps, and edit boundaries. SRT is plain timed text; animated words live in the composition. Real-time CSS animations/timers/autoplay/requestAnimationFrame cannot drive export. Convert web interaction into the seekable frame clock. Hyperframes uses one paused GSAP timeline per composition and runtime-owned clip visibility.
