import type { Research } from "./research";
import type { Script } from "./scripting";

export interface SourceSpeedQualifierIssue {
  code: "unsupported_source_speed_qualifier";
  path: (string | number)[];
  evidenceId: string;
  family: "instant" | "immediate";
}

const families = [
  { family: "instant", pattern: /(?<![\p{L}\p{N}_])instant(?:ly)?(?![\p{L}\p{N}_])/iu },
  { family: "immediate", pattern: /(?<![\p{L}\p{N}_])immediate(?:ly)?(?![\p{L}\p{N}_])/iu },
] as const;

/** Lexical eligibility only: the same bound passage must still semantically support the claim. */
export function sourceSpeedQualifierIssues(scenes: readonly Pick<Script["scenes"][number], "headline" | "detail" | "evidenceId" | "presentation">[], research: Pick<Research, "facts">): SourceSpeedQualifierIssue[] {
  const facts = new Map(research.facts.map(fact => [fact.evidenceId, fact.quote]));
  const issues: SourceSpeedQualifierIssue[] = [];
  function check(text: string, evidenceId: string, path: (string | number)[]) {
    const quote = facts.get(evidenceId) || "";
    for (const { family, pattern } of families) {
      if (pattern.test(text) && !pattern.test(quote)) issues.push({ code: "unsupported_source_speed_qualifier", path, evidenceId, family });
    }
  }
  scenes.forEach((scene, index) => {
    const path = ["scenes", index];
    check(scene.headline, scene.evidenceId, [...path, "headline"]);
    check(scene.detail, scene.evidenceId, [...path, "detail"]);
    scene.presentation?.cards?.forEach((card, cardIndex) => {
      check(card.title, card.evidenceId, [...path, "presentation", "cards", cardIndex, "title"]);
      check(card.body, card.evidenceId, [...path, "presentation", "cards", cardIndex, "body"]);
    });
    const visual = scene.presentation?.visual;
    if (visual?.kind === "connections") visual.nodes.forEach((node, nodeIndex) => {
      check(node.label, node.evidenceId, [...path, "presentation", "visual", "nodes", nodeIndex, "label"]);
    });
  });
  return issues;
}
