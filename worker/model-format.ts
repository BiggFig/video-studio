/** Provider grammar handles shape only; the production compiler still checks all source bindings and limits. */
type Schema = Record<string, unknown>;
export interface ScriptConstraints { assetIds: string[]; roleEvidenceIds: Record<string, string[]>; selectedFactIds: string[]; uiDocuments?: { id: string; elementIds: string[]; editableElementIds: string[]; stateIds: string[]; capabilityFactIds: string[] }[] }
const text = { type: "string" };
const choice = (...values: string[]) => ({ type: "string", enum: values });
const object = (properties: Record<string, Schema>, optional: string[] = []): Schema => ({ type: "object", properties, required: Object.keys(properties).filter(key => !optional.includes(key)), additionalProperties: false });
const array = (items: Schema) => ({ type: "array", items });
const visual = { anyOf: [
  object({ kind: choice("showcase") }),
  object({ kind: choice("focus"), regionId: text }),
  object({ kind: choice("panels"), secondaryAssetId: text, secondaryEvidenceId: text }),
  object({ kind: choice("connections"), nodes: array(object({ label: text, evidenceId: text })) }),
] };
export const SCRIPT_OUTPUT_SCHEMA = object({
  sufficientEvidence: { type: "boolean" }, reason: text, product: text, summary: text,
  accent: { type: "string", description: "A six digit #RRGGBB color." }, background: choice("light", "dark"),
  musicPrompt: text, sfxPrompt: text, assumptions: array(text),
  scenes: array(object({
    storyRole: choice("problem", "product", "mechanism", "outcome", "differentiator", "cta"),
    assetId: { type: "string", description: "An actual selected source asset ID, including for typography-only scenes. Never null." },
    headline: text, detail: { type: "string", description: "Use an empty string when no detail is needed, never null." },
    evidenceId: text, durationSeconds: { type: "number" }, sourceInSeconds: { type: "number", description: "Use zero for still images." },
    preserveAudio: { type: "boolean" }, purpose: text, referenceTechnique: text,
    presentation: object({ template: choice("hook", "brand", "proof", "features", "offer", "cta"), theme: choice("light", "dark"), transition: choice("cut", "iris", "lift", "expand"), cards: array(object({ title: text, body: text, evidenceId: text })), visual }, ["cards", "visual"]),
  }, ["storyRole"])),
});
/** Only models with verified direct structured-output support use this transport option. */
export function scriptOutputConfig(model: string, direct: boolean, policy?: string, constraints?: ScriptConstraints) {
  if (!direct || !["script-v1", "ui-design-v1"].includes(policy || "") || !/^claude-(?:sonnet-4-6|opus-4-6)(?:-|$)/.test(model)) return undefined;
  return { format: { type: "json_schema", schema: policy === "ui-design-v1" ? UI_OUTPUT_SCHEMA : constraints ? constrainedScriptSchema(constraints) : SCRIPT_OUTPUT_SCHEMA } };
}

/** Bind narrative choices in the grammar, before the semantic compiler checks actual claims. */
export function constrainedScriptSchema(constraints: ScriptConstraints): Schema {
  const schema = structuredClone(SCRIPT_OUTPUT_SCHEMA) as any;
  const scene = schema.properties.scenes.items, presentation = scene.properties.presentation;
  if (!constraints.assetIds.length || !constraints.selectedFactIds.length) throw new Error("Script grammar requires verified source IDs");
  scene.properties.assetId = choice(...constraints.assetIds);
  presentation.properties.cards.items.properties.evidenceId = choice(...constraints.selectedFactIds);
  presentation.properties.visual.anyOf[2].properties.secondaryAssetId = choice(...constraints.assetIds);
  presentation.properties.visual.anyOf[2].properties.secondaryEvidenceId = choice(...constraints.selectedFactIds);
  presentation.properties.visual.anyOf[3].properties.nodes.items.properties.evidenceId = choice(...constraints.selectedFactIds);
  const uiVariants = constraints.uiDocuments?.map(document => {
    if (!document.elementIds.length || !document.stateIds.length || !document.capabilityFactIds.length) throw new Error("UI script grammar requires documented element/state/capability IDs");
    const timed = { atFrame: { type: "integer", description: "Start at or after frame 30, in sequential non-overlapping order." }, durationFrames: { type: "integer", description: "Positive duration in frames: click at least 6, type at least 12, other actions at least 1." }, evidenceId: choice(...document.capabilityFactIds) };
    const actions = [
      ...["pointer", "click", "select"].map(kind => object({ kind: choice(kind), ...timed, targetId: choice(...document.elementIds) })),
      ...(document.editableElementIds.length ? [object({ kind: choice("type"), ...timed, targetId: choice(...document.editableElementIds), text: { type: "string", description: "Illustrative input, at most 160 characters; prefer six words or fewer." } })] : []),
      object({ kind: choice("state"), ...timed, stateId: choice(...document.stateIds) }),
    ];
    return object({ kind: choice("ui-demo"), documentId: choice(document.id), actions: array({ anyOf: actions }) });
  });
  if (uiVariants?.length) presentation.properties.visual.anyOf.push(...uiVariants);
  // Reuse one presentation definition to keep grammar size and optional-key counts bounded.
  schema.$defs = { presentation };
  if (uiVariants?.length) {
    const uiPresentation = structuredClone(presentation);
    uiPresentation.properties.template = choice("proof");
    uiPresentation.properties.visual = { anyOf: uiVariants };
    delete uiPresentation.properties.cards;
    uiPresentation.required = [...uiPresentation.required, "visual"];
    schema.$defs.uiPresentation = uiPresentation;
  }
  scene.properties.presentation = { $ref: "#/$defs/presentation" };
  const roles = ["problem", "product", "mechanism", "outcome", "differentiator", "cta"];
  const variants = roles.filter(role => constraints.roleEvidenceIds[role]?.length).map(role => ({
    ...scene, required: [...scene.required, "storyRole"],
    properties: { ...scene.properties, storyRole: choice(role), evidenceId: choice(...constraints.roleEvidenceIds[role]), ...(role === "mechanism" && uiVariants?.length ? { presentation: { $ref: "#/$defs/uiPresentation" } } : {}) },
  }));
  if (!["mechanism", "outcome", "cta"].every(role => constraints.roleEvidenceIds[role]?.length)) throw new Error("Script grammar requires verified story roles");
  schema.properties.scenes.items = { anyOf: variants };
  return schema;
}

const rect = object({ x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } });
const ids = array(text), basis = choice("source-ui", "example-content");
/** Shape grammar only: source fidelity, references, finite bounds and payload limits remain compiler checks. */
export const UI_OUTPUT_SCHEMA = object({
  sufficientEvidence: { type: "boolean" }, reason: text,
  documents: array(object({
    id: text, sourceAssetIds: ids, capabilityFactIds: ids, viewport: object({ width: { type: "integer" }, height: { type: "integer" } }),
    styles: array(object({ id: text, fill: text, color: text, borderColor: text, fontSize: { type: "number" }, fontWeight: { type: "integer" }, radius: { type: "number" } })),
    elements: array(object({ id: text, type: choice("panel", "text", "button", "input", "textarea", "tab", "list-item", "icon", "node", "edge"), rect, styleId: text, text, textBasis: basis, sourceAssetId: text, sourceRect: rect, initiallyVisible: { type: "boolean" }, fromId: text, toId: text }, ["fromId", "toId"])),
    states: array(object({ id: text, basis: choice("observed", "illustrative"), sourceAssetId: text, evidenceIds: ids, visibleElementIds: ids, selectedElementIds: ids, textValues: array(object({ elementId: text, text, textBasis: basis })) }, ["sourceAssetId"])),
  })),
});
