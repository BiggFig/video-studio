/** Provider grammar handles shape only; the production compiler still checks all source bindings and limits. */
type Schema = Record<string, unknown>;
export interface ScriptConstraints { maxScenes?: number; recipeIds?: string[]; assetIds: string[]; roleEvidenceIds: Record<string, string[]>; selectedFactIds: string[]; uiDocuments?: { id: string; elementIds: string[]; editableElementIds: string[]; stateIds: string[]; capabilityFactIds: string[] }[]; creativeDirection?: { concepts: { concept: "focus" | "connect" | "consolidate"; evidenceIds: string[] }[] } }
export interface UiDesignConstraints { requireLaunchResult?: true; seedReview?: { seedSha256: string; slotIds: string[] }; targets: { id: string; sourceAssetIds: string[]; capabilityFactIds: string[]; sourceValueDerivation?: true; literalPreview?: true }[] }
export interface WorkflowConstraints { contextSha256: string; sceneIds: string[]; version?: 1 | 2; obligationIds?: string[]; taskEntitlementVersion?: 1 | 2 }
export interface GuideSelectionConstraints { guideIds: string[]; sourceAssetIds: string[] }
export const FLAT_SCRIPT_TRANSPORT_VERSION = "flat-script-v1";
export const DIRECTED_SCRIPT_TRANSPORT_VERSION = "flat-script-v2";
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
export function scriptOutputConfig(model: string, direct: boolean, policy?: string, constraints?: ScriptConstraints, uiConstraints?: UiDesignConstraints, workflowConstraints?: WorkflowConstraints, guideConstraints?: GuideSelectionConstraints) {
  const supported = /^claude-(?:sonnet-4-6|opus-4-6)(?:-|$)/.test(model) || (policy === "workflow-coherence-v2" && /^claude-(?:sonnet|opus)-4-5(?:-\d{8})?$/.test(model));
  if (!direct || !["script-v1", "ui-design-v1", "workflow-coherence-v1", "workflow-coherence-v2", "guide-selection-v1"].includes(policy || "") || !supported) return undefined;
  if (policy === "guide-selection-v1") {
    if (!guideConstraints) throw new Error("Guide selection requires observed source and catalog IDs");
    return { format: { type: "json_schema", schema: guideSelectionOutputSchema(guideConstraints) } };
  }
  if (policy === "workflow-coherence-v1" || policy === "workflow-coherence-v2") {
    if (!workflowConstraints) throw new Error("Workflow review grammar requires bound scene identities");
    const version = policy === "workflow-coherence-v1" ? 1 : 2;
    if (workflowConstraints.version && workflowConstraints.version !== version) throw new Error("Workflow grammar differs from its review policy");
    return { format: { type: "json_schema", schema: workflowOutputSchema({ ...workflowConstraints, version }) } };
  }
  return { format: { type: "json_schema", schema: policy === "ui-design-v1" ? uiConstraints ? constrainedUiSchema(uiConstraints) : UI_OUTPUT_SCHEMA : constraints ? constrainedScriptSchema(constraints) : SCRIPT_OUTPUT_SCHEMA } };
}

/** URLs never enter the output grammar; a locally verified catalog resolves IDs. */
export function guideSelectionOutputSchema(constraints: GuideSelectionConstraints): Schema {
  for (const ids of [constraints.guideIds, constraints.sourceAssetIds]) {
    if (!ids.length || ids.length > 300 || new Set(ids).size !== ids.length || ids.some(id => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) throw new Error("Invalid guide-selection identities");
  }
  return object({
    version: { type: "integer", enum: [1] }, decision: choice("capture-guide", "use-current", "insufficient"),
    guideId: { ...choice("", ...constraints.guideIds), description: "Choose one exact observed guide ID for capture-guide; otherwise empty." },
    sourceAssetIds: { ...array(choice(...constraints.sourceAssetIds)), description: "One or two existing UI candidates whose workflow needs this guide; empty for noncapture decisions." },
    intent: { ...text, description: "Proposed narrow demonstration, at most 160 characters; not an approved claim. Empty for noncapture." },
    missingEvidence: array(choice("control", "action", "result")),
    reason: { ...text, description: "Aim for one sentence of at most 160 characters; hard maximum 480 characters. Explain relevance or the specific missing evidence; never promise an unobserved result." },
  });
}

/** Compact grammar; complete coverage and per-scene action/element ownership are checked locally. */
export function workflowOutputSchema(constraints: WorkflowConstraints): Schema {
  if (!/^[a-f0-9]{64}$/.test(constraints.contextSha256) || !constraints.sceneIds.length || constraints.sceneIds.length > 10 || new Set(constraints.sceneIds).size !== constraints.sceneIds.length || constraints.sceneIds.some(id => !/^scene-[1-9][0-9]?$/.test(id))) throw new Error("Invalid workflow review identities");
  if (constraints.version !== undefined && ![1, 2].includes(constraints.version)) throw new Error("Invalid workflow grammar version");
  if (constraints.version !== 1) {
    const ids = constraints.obligationIds;
    if (!ids?.length || ids.length > 8 || new Set(ids).size !== ids.length || ids.some(id => !/^scene-[1-9][0-9]?-(?:task|(?:content|causal)-[1-6]|outcome-[1-9][0-9]?)$/.test(id))) throw new Error("Invalid workflow obligation identities");
    if (constraints.taskEntitlementVersion !== undefined && ![1, 2].includes(constraints.taskEntitlementVersion)) throw new Error("Unsupported workflow task entitlement contract");
    if (constraints.taskEntitlementVersion === 2) {
      const promises = ids.filter(id => /-(?:task|outcome-[1-9][0-9]?)$/.test(id));
      if (!promises.length) throw new Error("Missing bound workflow promise identities");
      return object({ contextSha256: choice(constraints.contextSha256), assessments: { ...array(object({ obligationId: choice(...ids), status: choice("supported", "contradictory", "uncertain"), reason: { ...text, description: "Assess the complete bound proposition, at most 240 characters. An action added is not execution of that action." } })), description: `Exactly ${ids.length} assessments, one per obligation.` }, taskEntitlementVersion: { type: "integer", enum: [2] }, tasks: { ...array(object({ obligationId: choice(...promises), promiseExcerpt: { ...text, description: "Exact decisive excerpt from this obligation's own visible beat only; at most 160 characters." }, requiredResult: choice("inspect", "query", "selection", "committed-change"), resultAnswer: choice("visible-result", "preparation-only", "uncertain"), postconditionIds: array({ ...text, description: "Exact candidate IDs from the bound UI scene. A changed value alone does not prove the promised outcome." }) })), description: `Exactly ${promises.length} answers, one per task/outcome obligation. A weaker UI headline cannot satisfy the following outcome.` } });
    }
    if (ids.some(id => id.includes("-outcome-"))) throw new Error("Outcome obligations require the per-promise entitlement contract");
    return object({ contextSha256: choice(constraints.contextSha256), assessments: { ...array(object({ obligationId: choice(...ids), status: choice("supported", "contradictory", "uncertain"), reason: { type: "string", description: "Answer this specific meaning or cause question, preferably 8–12 words/about 80 characters; hard maximum 240 characters. Not an edit inventory." } })), description: `Exactly ${ids.length} assessments, one per required obligation; never omit or duplicate one.` }, ...(constraints.taskEntitlementVersion === 1 ? { taskEntitlementVersion: { type: "integer", enum: [1] }, tasks: { ...array(object({ sceneId: choice(...constraints.sceneIds), promiseExcerpt: { type: "string", description: "Exact decisive visible promise excerpt, at most 160 characters. Include a following outcome's stronger promise when present." }, requiredResult: choice("inspect", "query", "selection", "committed-change"), resultAnswer: choice("visible-result", "preparation-only", "uncertain"), postconditionIds: array({ type: "string", description: "Exact result candidate IDs from this scene; empty if no material committed result is visible." }) })), description: `Exactly ${constraints.sceneIds.length} independent task/result answers. Choosing an option is not completing the operation it prepares. All IDs are locally verified.` } } : {}) });
  }
  return object({ contextSha256: choice(constraints.contextSha256), scenes: array(object({ sceneId: choice(...constraints.sceneIds), passed: { type: "boolean" } })), findings: { ...array(object({ severity: choice("major", "critical"), sceneId: choice(...constraints.sceneIds), actionId: choice("initial", "action-1", "action-2", "action-3", "action-4", "action-5", "action-6", "final"), elementIds: array(text), code: choice("context_contradiction", "causal_mismatch", "claim_overreach", "unsupported_result"), message: text })), description: "At most three concrete blocking findings, each message at most 320 characters; cite 1–4 actual visible element IDs. Empty for a pass." } });
}

/** Bind narrative choices in the grammar, before the semantic compiler checks actual claims. */
export function constrainedScriptSchema(constraints: ScriptConstraints): Schema {
  if (constraints.maxScenes !== undefined && (!Number.isSafeInteger(constraints.maxScenes) || constraints.maxScenes < 2 || constraints.maxScenes > 8)) throw new Error("Invalid script scene allowance");
  if (constraints.recipeIds && (!constraints.creativeDirection || !constraints.uiDocuments?.length)) throw new Error("Shot recipes require the directed UI grammar");
  if (constraints.uiDocuments?.length) return describeSceneAllowance(flatUiScriptSchema(constraints), constraints.maxScenes);
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
  return describeSceneAllowance(schema, constraints.maxScenes);
}

// Anthropic does not document maxItems support. The compiler enforces this
// bound for every transport; supported schema descriptions guide generation.
function describeSceneAllowance(schema: Schema, maxScenes?: number): Schema {
  if (maxScenes !== undefined) ((schema.properties as Record<string, Schema>).scenes).description = `At most ${maxScenes} scenes. The compiler rejects more before rendering; all mandatory story roles must fit within this allowance.`;
  return schema;
}

/** Flatten presentation/action alternatives while keeping role+fact choices coupled in one enum. */
function flatUiScriptSchema(constraints: ScriptConstraints): Schema {
  const documents = constraints.uiDocuments!;
  if (!constraints.assetIds.length || !constraints.selectedFactIds.length || !["mechanism", "outcome", "cta"].every(role => constraints.roleEvidenceIds[role]?.length)) throw new Error("Script grammar requires verified sources and story roles");
  if (documents.some(document => !document.elementIds.length || !document.stateIds.length || !document.capabilityFactIds.length)) throw new Error("UI script grammar requires documented element/state/capability IDs");
  const schema = structuredClone(SCRIPT_OUTPUT_SCHEMA) as any, scene = schema.properties.scenes.items;
  delete scene.properties.storyRole; delete scene.properties.evidenceId;
  scene.properties.storyEvidence = choice(...Object.entries(constraints.roleEvidenceIds).flatMap(([role, ids]) => ids.map(id => `${role}:${id}`)));
  scene.properties.assetId = choice(...constraints.assetIds);
  scene.required = Object.keys(scene.properties);
  schema.properties.transportVersion = choice(constraints.creativeDirection ? DIRECTED_SCRIPT_TRANSPORT_VERSION : FLAT_SCRIPT_TRANSPORT_VERSION);
  schema.required.push("transportVersion");
  const nullableId = (values: string[]) => choice("", ...new Set(values));
  const action = object({
    kind: choice("pointer", "click", "type", "select", "state"),
    atFrame: { type: "integer", description: "At least30; sequential and non-overlapping." },
    durationFrames: { type: "integer", description: "Click at least6, type at least12, other actions at least1." },
    targetId: nullableId(documents.flatMap(document => document.elementIds)), stateId: nullableId(documents.flatMap(document => document.stateIds)),
    text: { type: "string", description: "Empty except for type; at most160 characters." }, evidenceId: choice(...new Set(documents.flatMap(document => document.capabilityFactIds))),
  });
  scene.properties.presentation = object({
    template: choice("hook", "brand", "proof", "features", "offer", "cta"), theme: choice("light", "dark"), transition: choice("cut", "iris", "lift", "expand"),
    cards: array(object({ title: text, body: text, evidenceId: choice(...constraints.selectedFactIds) })),
    visual: object({
      kind: choice("none", "showcase", "focus", "panels", "connections", "ui-demo"), regionId: text,
      secondaryAssetId: nullableId(constraints.assetIds), secondaryEvidenceId: nullableId(constraints.selectedFactIds),
      nodes: array(object({ label: text, evidenceId: choice(...constraints.selectedFactIds) })),
      documentId: nullableId(documents.map(document => document.id)), actions: array(action),
    }),
  });
  if (constraints.creativeDirection) {
    const concepts = constraints.creativeDirection.concepts;
    if (!concepts.length || concepts.length > 3 || new Set(concepts.map(value => value.concept)).size !== concepts.length || concepts.some(value => !["focus", "connect", "consolidate"].includes(value.concept) || !value.evidenceIds.length || value.evidenceIds.some(id => !constraints.selectedFactIds.includes(id)))) throw new Error("Creative direction requires distinct supported concepts and verified facts");
    schema.properties.creativeDirection = object({ concept: choice(...concepts.map(value => value.concept)), evidenceId: choice(...new Set(concepts.flatMap(value => value.evidenceIds))) });
    schema.required.push("creativeDirection");
    scene.properties.direction = object({ job: choice("hook", "context", "action", "result", "payoff", "cta"), motion: choice("reveal", "focus", "connect", "consolidate", "hold") });
    scene.required.push("direction");
  }
  if (constraints.recipeIds) {
    const ids = constraints.recipeIds;
    if (!ids.length || ids.length > 64 || new Set(ids).size !== ids.length || ids.some(id => !/^shot-[a-f0-9]{24}$/.test(id))) throw new Error("Invalid trusted shot recipe IDs");
    schema.properties.transportVersion = choice("flat-script-v3");
    delete scene.properties.assetId; delete scene.properties.storyEvidence;
    scene.properties.recipeId = choice(...ids);
    const old = scene.properties.presentation.properties;
    scene.properties.presentation = object({ theme: old.theme, transition: old.transition, cards: old.cards, nodes: old.visual.properties.nodes, actions: old.visual.properties.actions });
    scene.required = Object.keys(scene.properties);
  }
  return schema;
}

const rect = object({ x: { type: "number" }, y: { type: "number" }, width: { type: "number", description: "Strictly positive; never zero, including initially hidden elements." }, height: { type: "number", description: "Strictly positive; never zero, including initially hidden elements." } });
const ids = array(text), basis = { ...choice("source-ui", "example-content"), description: "Provenance, not editability: exact source text stays source-ui, including sample user content. Only newly authored harmless content is example-content; never invented controls, metrics or success labels." };
export const UI_TRANSPORT_VERSION = "ui-document-v2";
/** Shape grammar only: source fidelity, references, finite bounds and payload limits remain compiler checks. */
export const UI_OUTPUT_SCHEMA = object({
  transportVersion: choice(UI_TRANSPORT_VERSION), coordinateSpace: { ...choice("normalized", "pixels"), description: "Unit of ALL element.rect values. normalized means 0–1 fractions; pixels means integer coordinates inside each document.viewport. sourceRect ALWAYS remains normalized 0–1." },
  sufficientEvidence: { type: "boolean" }, reason: text,
  documents: array(object({
    id: text, sourceAssetIds: ids, capabilityFactIds: ids, viewport: object({ width: { type: "integer" }, height: { type: "integer" } }),
    styles: array(object({ id: text, fill: text, color: text, borderColor: text, fontSize: { type: "number" }, fontWeight: { type: "integer" }, radius: { type: "number" } })),
    elements: array(object({ id: text, type: { ...choice("panel", "text", "button", "input", "textarea", "tab", "list-item", "icon", "node", "edge"), description: "Preserve the actual primitive. Editable input is input/textarea; static code is text. Edges connect node elements only, never buttons or labels; do not retype a control to satisfy an edge." }, rect, styleId: text, selectedStyleId: { ...text, description: "Only a selected appearance actually visible in a source; selecting an ID without this style does not change its rendering." }, text, textBasis: basis, sourceAssetId: text, sourceRect: rect, initiallyVisible: { type: "boolean", description: "Visibility in the first observed source state. Preserve already-visible results in the chosen region; never hide them to manufacture a before/after change." }, fromId: { ...text, description: "Only for edge: ID of an actual element whose type is node." }, toId: { ...text, description: "Only for edge: a different actual node element ID. Never a button, tab, text or panel." } }, ["fromId", "toId", "selectedStyleId"])),
    states: array(object({ id: text, basis: { ...choice("observed", "illustrative"), description: "Observed is a faithful snapshot of a supplied source, including its visible results. Any authored change of content/visibility is illustrative and needs capability evidence; it is not a second observed screenshot." }, sourceAssetId: text, evidenceIds: ids, visibleElementIds: { ...ids, description: "Complete snapshot within the chosen source region. Source text later reused in an illustrative state must be visible in an observed state or exact selected captured DOM text." }, selectedElementIds: ids, textValues: array(object({ elementId: text, text, textBasis: basis })) }, ["sourceAssetId"])),
  })),
});

/** Each target has its own provenance namespace. Exact, distinct array membership remains a compiler gate. */
export function constrainedUiSchema(constraints: UiDesignConstraints): Schema {
  const targets = constraints.targets;
  const unique = (values: string[]) => values.length === new Set(values).size && values.every(value => typeof value === "string" && value.length > 0);
  if (!targets.length || targets.length > 2 || !unique(targets.map(target => target.id))) throw new Error("UI grammar requires distinct verified target IDs");
  if (constraints.seedReview) {
    const { seedSha256, slotIds } = constraints.seedReview;
    if (targets.length !== 1 || !targets[0].literalPreview || !/^[a-f0-9]{64}$/.test(seedSha256) || slotIds.length > 16 || !unique(slotIds) || slotIds.some(id => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw new Error("Invalid literal-preview seed review identities");
    return object({ transportVersion: choice("ui-literal-review-v1"), seedSha256: choice(seedSha256), sufficientEvidence: { type: "boolean" }, reason: { ...text, description: "One specific sentence, maximum 480 characters; refuse if the source does not support the locked demonstration." }, presentation: { ...array(object({ slotId: choice(...(slotIds.length ? slotIds : ["no-presentation-slots"])), color: { ...text, description: "Exact source color #RRGGBB; transparent only for explicitly permitted fill slots." } })), description: slotIds.length ? "On approval include every missing slot once; on refusal return []. Never override locked fields." : "No missing presentation values: always return []." } });
  }
  const legacy = structuredClone(UI_OUTPUT_SCHEMA) as any, document = legacy.properties.documents.items;
  const definitions = {
    uiRect: document.properties.elements.items.properties.rect,
    uiStyle: document.properties.styles.items,
    uiTextValue: document.properties.states.items.properties.textValues.items,
  };
  const documents = Object.fromEntries(targets.map(target => {
    if (!target.sourceAssetIds.length || target.sourceAssetIds.length > 2 || !unique(target.sourceAssetIds) || !target.capabilityFactIds.length || target.capabilityFactIds.length > 4 || !unique(target.capabilityFactIds)) throw new Error("UI grammar requires distinct verified source and capability IDs");
    if (target.sourceValueDerivation && target.literalPreview) throw new Error("UI grammar requires one distinct result derivation per target");
    const variant = structuredClone(document), properties = variant.properties;
    properties.id = choice(target.id);
    properties.sourceAssetIds = { ...array(choice(...target.sourceAssetIds)), description: "Include every listed source ID exactly once; never add another source." };
    properties.capabilityFactIds = { ...array(choice(...target.capabilityFactIds)), description: "Include every listed capability ID exactly once; never borrow another target's facts." };
    properties.elements.items.properties.sourceAssetId = choice(...target.sourceAssetIds);
    // Optional keys multiply branches inside repeated element/state objects.
    // A single empty-string transport sentinel decodes to the same absent field;
    // nonempty values still pass the unchanged document/source validators.
    for (const key of ["fromId", "toId", "selectedStyleId"]) {
      properties.elements.items.properties[key].description += " Use an empty string when absent; never null.";
    }
    properties.elements.items.required = Object.keys(properties.elements.items.properties);
    properties.elements.items.properties.rect = { $ref: "#/$defs/uiRect", description: "Use the declared coordinateSpace consistently: normalized 0–1, or integer viewport pixels. The complete rectangle must fit inside viewport." };
    properties.elements.items.properties.sourceRect = { $ref: "#/$defs/uiRect", description: "Always normalized 0–1 relative to the original source image; never viewport pixels." };
    properties.styles.items = { $ref: "#/$defs/uiStyle" };
    properties.states.items.properties.sourceAssetId = { ...choice("", ...target.sourceAssetIds), description: "Use the actual source ID for observed snapshots. For an illustrative state with no source snapshot, use an empty string, never null." };
    properties.states.items.required = Object.keys(properties.states.items.properties);
    properties.states.items.properties.evidenceIds = array(choice(...target.capabilityFactIds));
    properties.states.items.properties.textValues.items = { $ref: "#/$defs/uiTextValue" };
    if (target.literalPreview) {
      // The witness already determines these references. Repeating a nested
      // binding and trigger exceeds the provider grammar limit even with one
      // optional target key. The decoder may derive references only from unique
      // exact element/state matches; it never changes provider-authored content.
      properties.elements.items.properties.type = choice("panel", "text");
      properties.states.description = "Exactly two complete snapshots: one observed before state and one illustrative after state. Only the witnessed code and preview text change. Preserve all exact context. Do not supply previewBinding or terminalResult; their redundant references are derived locally only when every match is unambiguous.";
    } else if (target.sourceValueDerivation) {
      // The same exact-match adapter derives the selected row's redundant IDs.
      // Keep all observed and illustrative content explicit for local validation.
      properties.states.description = "Exactly two complete snapshots: one observed before state and one illustrative after state. Only the existing summary changes to the witnessed row count. Preserve the exact metric label, row, summary label and context. Do not supply sourceValueDerivations or terminalResult; redundant references are derived locally only from unique exact matches.";
    } else if (constraints.requireLaunchResult) {
      properties.terminalResult = object({ version: { type: "integer", enum: [1] }, beforeStateId: { ...text, description: "State containing the actual supported confirmation control and its complete input context." }, afterStateId: { ...text, description: "Distinct state with the persistent consequence of that exact confirmation, consistent with its inputs and surrounding labels." }, confirmationElementId: { ...text, description: "ID of a visible source-supported button, list-item, tab or node that actually confirms this operation. Static text/code, opening a setup menu and selecting a tool are not completion." }, resultElementIds: { ...ids, description: "1–4 persistent nonempty noneditable text element IDs, outside queries/choices; never a button, toggle, input or node. Already-visible content is not a new result. No invented status label or unrelated source example." }, evidenceIds: array(choice(...target.capabilityFactIds)) });
      variant.required.push("terminalResult");
    }
    return [target.id, variant];
  }));
  // An unbounded array of large document unions exceeds the provider's compiled grammar limit.
  // Known target keys remove that union while preserving target-specific provenance enums.
  // Refusal needs no fabricated document. Keys are optional only in the provider
  // grammar; readUiDraft still requires every exact target when evidence is true.
  const documentsById = { ...object(documents, Object.keys(documents)), description: "When sufficientEvidence is false, return {} and explain the missing evidence in reason. When true, include every assigned target exactly once, with its complete document and required fields. Partial successful responses are rejected." };
  return { ...object({ transportVersion: choice(UI_TRANSPORT_VERSION), coordinateSpace: structuredClone((UI_OUTPUT_SCHEMA as any).properties.coordinateSpace), sufficientEvidence: { type: "boolean", description: "False when the actual source cannot support the requested workflow; return an empty documentsById instead of inventing a document." }, reason: text, documentsById }), $defs: definitions };
}
