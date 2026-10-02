import legacyDirection from "./reference-style.json";
import type { Plan } from "./types";

/** Visual direction derived from sampled Addx films; these are production aims, not claims of exact matching. */
export const launchDirection = {
  id: "causal-product-launch-v1",
  version: 1,
  source: {
    kind: "user-selected-visual-benchmark",
    inspection: "Sampled visual inspection of the Addx ElevenLabs 28-second and ClickUp 58-second films; docs/addx-reference-direction.md records provenance and limits. Sound was not audited; authoring tools and exact easing are unknown.",
  },
  target: {
    durationSeconds: [20, 28],
    description: "A product-specific causal story: a recognizable audience problem, early genuine identity, one focused input/action/result workflow, a concrete outcome and one held final CTA. A second workflow must add a distinct supported reason to care. There is no fixed scene count or mandatory feature/offer card.",
  },
  story: "Keep each workflow continuous through its final result; do not restart the initial UI in a new outcome scene. Use an editorial outcome beat or different proof when needed. Every beat must advance the same grounded argument.",
  design: {
    typography: "Sparse large editorial phrases punctuate focused product proof. Prefer distinct copy jobs over repeated claims or permanent dense explanation; respect the renderer's available hierarchy and all reading holds.",
    framing: "Establish recognizable context, direct attention to the actionable control, then hold the supported result. Camera direction is an intent implemented only through supported element-bound framing, never arbitrary model transforms.",
    branding: "Use observed product language, palette, genuine logo and source identity early. Do not reuse benchmark client claims, UI, clips or identity assets.",
  },
  motion: {
    rhythm: "Vary sparse type punctuation, deliberate UI action and stable result/CTA holds within the compiled timeline. Do not reproduce every topic of a longer benchmark in a short film.",
    interaction: "Motion explains a supported task: initial state, illustrative input, meaningful choice or action, visible documented result. Keep state continuity; never invent processing, backend success or capabilities.",
    transitions: "Prefer clear cuts or a supported iris/lift/expand that introduces an idea or reveals proof. A decorative transition is not required at every boundary; never hide the decisive action or result.",
    hold: "Finish actions and supported camera movement before complete readable result holds. Keep the final CTA stable. Required reading time and preserved speech outrank pacing targets.",
    limits: "Use trusted existing templates and deterministic frame timing. No bespoke 3D, physical simulation, arbitrary effects, numeric similarity, exact visual match, or unaudited sound-style promise is required or claimed.",
  },
} as const;

export const directionForContractVersion = (version: 1 | 2 | 3) => version === 3 ? launchDirection : legacyDirection;
export const usesCurrentLaunchDirection = (plan: Pick<Plan, "uiDocuments" | "production">) => !!plan.production?.uiSha256 || !!plan.uiDocuments?.length;
