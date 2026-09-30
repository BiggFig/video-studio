# Specialized constructions in the shared timeline

These recipes are not preinstalled engines. Check dependencies and render intermediates first.

## Data/decks/infographics

Use supplied data and explicit field/unit mapping. Design settled frame first. Declare scale, use zero baseline for bars unless truncation is obvious, stable IDs for rank interpolation. Round display apart from actual values; exact final counters match source. Reveal headline → primary statistic/chart → explanation → source. Inspect start/mid/final. Narration sets deck holds. Recompute per aspect.

## Diagrams/maps/math

Nodes precede edges; label relationships, anchor connectors, reveal arrows without occlusion. Whiteboard paths draw in teaching order. Isometric uses consistent geometry/camera. Maps require real coordinates/projection/boundaries, consistent data projection, dataset/tile attribution. Camera motion expresses a supported relationship. Math shows correct symbols and meaningful steps. Installed Manim may prerender a segment; a browser mock is not a Manim render.

## Web to video

GSAP/SVG/Lottie/React motion patterns supply stagger/reveal/morph/spatial behavior. Convert scroll/hover/click into authored functions of frame. Canvas redraw receives t=frame/fps. No live input, network timing, wall clock, or unseeded randomness. Bundle local dependencies; verify seeking. A separately requested web artifact preserves accessibility/reduced-motion independently of exported video.

## 3D/illustration/creative code

Real product models/materials matter for fidelity. WebGL/Blender require locked camera/lights/fps/seed/quality/local assets. Smoke-render before whole sequence. No silent 3D/live-action downgrade to 2D. Shader effects must seek deterministically.

Zero-asset canvas layers background → silhouette → detail → accents with fixed seed. Painted/crayon/cel/pixel/paper/line treatments share storyboard/time. Pixel art uses integer scaling, paper-cut consistent edge/shadow/light, whiteboard explanatory strokes. Validate source character/product consistency. Code-made music needs offline rendered WAV; real-time Web Audio callbacks do not automatically survive export.
