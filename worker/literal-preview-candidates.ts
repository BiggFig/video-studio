import { createHash } from "node:crypto";
import type { UiSource } from "./ui-sources";

export interface LiteralPreviewCandidate {
  id: string; sourceAssetId: string;
  sourceElementIds: { code: string; template: string; output: string };
  codeText: string; propertyName: string; beforeLiteral: string; templateText: string; outputBefore: string;
  contextChoices: { elementId: string; text: string }[];
}

/** Static same-source string correspondences, not capability or interaction proof.
 * Never joins page-wide facts, strips markup/gutters, executes code, or proposes
 * an edited value. Incomplete code inventory simply yields no candidate. */
export function literalPreviewCandidates(sources: UiSource[], contextLimit: 3 | 4 = 3): LiteralPreviewCandidate[] {
  const candidates: LiteralPreviewCandidate[] = [];
  for (const source of [...sources].sort((a, b) => a.assetId.localeCompare(b.assetId)).slice(0, 3)) {
    if (source.basis !== "dom") continue;
    const elements = source.elements.slice(0, 48), lines = elements.filter(element => element.role === "text" && element.codeContainer && element.text && element.text.length <= 160);
    // Context is transported as exact text until the immutable seed binds its
    // source ID. Count the whole captured inventory, not just eligible contexts
    // or the first occurrence: an excluded sibling can still make a join ambiguous.
    const occurrences = new Map<string, number>();
    for (const element of source.elements) if (element.role === "text" && element.text) occurrences.set(element.text, (occurrences.get(element.text) || 0) + 1);
    const codeContainers = [...new Set(lines.map(element => element.codeContainer!))];
    // Ordinary inventory may include a shortened aggregate of a clipped pre or
    // its wrapper. It is not an independently observed context line. Only the
    // explicitly complete marked lines may supply code context; selector path
    // boundaries keep a separate preview sibling from being mistaken for code.
    const relatedToCode = (selector?: string) => !!selector && codeContainers.some(container => selector === container || container.startsWith(selector + " > ") || selector.startsWith(container + " > "));
    const assignments = lines.flatMap(element => {
      const match = /^([A-Za-z_$][A-Za-z0-9_$]{0,39})\s*=\s*(["'])([\p{L}\p{N}][\p{L}\p{N} ._-]{0,39})\2\s*[,;]?$/u.exec(element.text!);
      return match ? [{ element, propertyName: match[1], beforeLiteral: match[3] }] : [];
    });
    let sourceCount = 0;
    for (const assignment of assignments) {
      // Multiple declarations of the same name cannot establish which value
      // produced the preview, even when one happens to match the rendered text.
      if (assignments.filter(other => other.propertyName === assignment.propertyName && other.element.codeContainer === assignment.element.codeContainer).length !== 1) continue;
      const token = `{${assignment.propertyName}}`;
      for (const template of lines) {
        if (template.codeContainer !== assignment.element.codeContainer || template === assignment.element) continue;
        const parts = template.text!.split(token);
        if (parts.length !== 2 || /[<>{}]/.test(parts.join("")) || template.text!.includes("${") || !parts.join("").trim()) continue;
        const outputBefore = parts.join(assignment.beforeLiteral);
        if (outputBefore.length > 160) continue;
        const outputs = elements.filter(element => element.role === "text" && !element.codeContainer && element.text === outputBefore && element.selector && element.selector !== template.codeContainer && !element.selector.startsWith(template.codeContainer! + " > ") && !/(?:^| > )(?:pre|code)(?::[^ >]+)?(?: > |$)/.test(element.selector));
        if (outputs.length !== 1 || lines.filter(other => other.codeContainer === template.codeContainer && other.text === template.text).length !== 1) continue;
        if ([assignment.element.text!, template.text!, outputBefore].some(text => occurrences.get(text) !== 1)) continue;
        const eligibleContext = elements.filter(element => element.role === "text" && element.text && occurrences.get(element.text) === 1 && element.text.length < 160 && element !== assignment.element && element !== template && element !== outputs[0] && !element.text.includes(assignment.beforeLiteral) && !element.text.includes(assignment.propertyName) && (element.codeContainer ? element.codeContainer === template.codeContainer && (/^[A-Za-z_$][\w$]*\s*=\s*["'][\p{L}][\p{L}\p{N} ._-]*["']\s*[,;]$/u.test(element.text) || /^(?:const|function|class)\s+[A-Za-z_$]/.test(element.text)) : !relatedToCode(element.selector)));
        const contextChoices = eligibleContext.filter(element => !eligibleContext.some(parent => parent !== element && parent.selector && element.selector?.startsWith(parent.selector + " > ") && parent.text!.includes(element.text!) && parent.rect.x <= element.rect.x + .001 && parent.rect.y <= element.rect.y + .001 && parent.rect.x + parent.rect.width >= element.rect.x + element.rect.width - .001 && parent.rect.y + parent.rect.height >= element.rect.y + element.rect.height - .001))
          .sort((a, b) => Number(!a.codeContainer) - Number(!b.codeContainer) || a.rect.y - b.rect.y || a.rect.x - b.rect.x || a.id.localeCompare(b.id))
          // Fresh composition offers three unchanged anchors. Canonical source
          // verification explicitly retains the older four-anchor allowance;
          // it must not prune an already-selected legitimate witness.
          .slice(0, contextLimit).map(element => ({ elementId: element.id, text: element.text! }));
        // Offer only self-contained correspondences with at least one observed
        // unchanged context anchor; no page-wide label is filled in for one.
        if (!contextChoices.length) continue;
        const candidate = { sourceAssetId: source.assetId, sourceElementIds: { code: assignment.element.id, template: template.id, output: outputs[0].id }, codeText: assignment.element.text!, propertyName: assignment.propertyName, beforeLiteral: assignment.beforeLiteral, templateText: template.text!, outputBefore, contextChoices };
        candidates.push({ id: `literal-${createHash("sha256").update(JSON.stringify(candidate)).digest("hex").slice(0, 16)}`, ...candidate });
        if (++sourceCount >= 2 || candidates.length >= 4) break;
      }
      if (sourceCount >= 2 || candidates.length >= 4) break;
    }
    if (candidates.length >= 4) break;
  }
  return candidates;
}
