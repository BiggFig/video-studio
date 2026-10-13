import test from "node:test";
import assert from "node:assert/strict";
import { SCRIPT_OUTPUT_SCHEMA, UI_OUTPUT_SCHEMA, UI_TRANSPORT_VERSION, scriptOutputConfig, constrainedScriptSchema, constrainedUiSchema, guideSelectionOutputSchema, type ScriptConstraints, type UiDesignConstraints } from "./model-format";

type Schema = { type?: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; anyOf?: Schema[]; enum?: string[]; $ref?: string; $defs?: Record<string, Schema> };

test("guide grammar only permits observed identities and leaves no URL or extra instruction field", () => {
  const constraints = { guideIds: ["guide-1", "guide-2"], sourceAssetIds: ["product-image-0"] };
  const schema = guideSelectionOutputSchema(constraints) as Schema;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, Object.keys(schema.properties!));
  assert.deepEqual(schema.properties!.guideId.enum, ["", "guide-1", "guide-2"]);
  assert.deepEqual(schema.properties!.sourceAssetIds.items!.enum, ["product-image-0"]);
  assert.equal(schema.properties!.url, undefined);
  assert.deepEqual(scriptOutputConfig("claude-sonnet-4-6", true, "guide-selection-v1", undefined, undefined, undefined, constraints)?.format.schema, schema);
  assert.throws(() => scriptOutputConfig("claude-sonnet-4-6", true, "guide-selection-v1"), /requires observed/);
  for (const guideIds of [[], ["guide-1", "guide-1"], ["https://other.example/guide"]]) assert.throws(() => guideSelectionOutputSchema({ ...constraints, guideIds }), /Invalid/);
});
const constraints: ScriptConstraints = {
  assetIds: ["product-panel-0", "product-panel-1", "capture-1", "brand-logo-0"],
  selectedFactIds: ["fact-2", "fact-8", "fact-9", "fact-10", "fact-16"],
  roleEvidenceIds: { problem: ["fact-10", "fact-8"], product: ["fact-2", "fact-8", "fact-9", "fact-10", "fact-16"], mechanism: ["fact-10", "fact-16"], outcome: ["fact-8", "fact-9"], differentiator: ["fact-8", "fact-2"], cta: ["fact-8"] },
};

test("directed transport adds bounded concept and shot data without grammar alternatives", () => {
  const directed: ScriptConstraints = { ...constraints, uiDocuments: [{ id: "editor", elementIds: ["input"], editableElementIds: ["input"], stateIds: ["initial", "result"], capabilityFactIds: ["fact-10"] }], creativeDirection: { concepts: [{ concept: "focus", evidenceIds: ["fact-10"] }] } };
  const schema = constrainedScriptSchema(directed) as Schema;
  assert.deepEqual(schema.properties!.transportVersion.enum, ["flat-script-v2"]);
  assert.deepEqual(schema.properties!.creativeDirection.properties!.evidenceId.enum, ["fact-10"]);
  assert.deepEqual(schema.properties!.creativeDirection.properties!.concept.enum, ["focus"]);
  assert.ok(schema.properties!.scenes.items!.required!.includes("direction"));
  let unions = 0; const inspect = (node: Schema) => { if (node.anyOf) unions++; if (node.items) inspect(node.items); Object.values(node.properties || {}).forEach(inspect); }; inspect(schema);
  assert.equal(unions, 0);
  assert.throws(() => constrainedScriptSchema({ ...directed, creativeDirection: { concepts: [{ concept: "focus", evidenceIds: ["fact-999"] }] } }), /verified facts/);
  assert.throws(() => constrainedScriptSchema({ ...directed, creativeDirection: { concepts: [] } }), /verified facts/);
  delete directed.creativeDirection;
  assert.deepEqual((constrainedScriptSchema(directed) as Schema).properties!.transportVersion.enum, ["flat-script-v1"]);
});

test("script grammar closes every object and requires all nonoptional fields", () => {
  let objects = 0;
  function inspect(schema: Schema, path = "script") {
    if (schema.type === "object") {
      objects++;
      assert.equal(schema.additionalProperties, false, path);
      const optional = path === "script.scenes[]" ? ["storyRole"] : path === "script.scenes[].presentation" ? ["cards", "visual"] : [];
      assert.deepEqual(schema.required, Object.keys(schema.properties!).filter(key => !optional.includes(key)), path);
      for (const [key, child] of Object.entries(schema.properties!)) inspect(child, `${path}.${key}`);
    }
    if (schema.items) inspect(schema.items, `${path}[]`);
    schema.anyOf?.forEach((child, i) => inspect(child, `${path}.variant${i}`));
  }
  inspect(SCRIPT_OUTPUT_SCHEMA);
  assert.equal(objects, 9);
});

test("script grammar rejects nullable still defaults and the invented outgoing property", () => {
  const root = SCRIPT_OUTPUT_SCHEMA as Schema;
  const scene = root.properties!.scenes.items!, properties = scene.properties!;
  assert.equal(properties.assetId.type, "string");
  assert.equal(properties.detail.type, "string");
  assert.equal(properties.sourceInSeconds.type, "number");
  const presentation = properties.presentation;
  assert.ok(presentation.required!.includes("transition"));
  assert.equal(presentation.properties!.outgoing, undefined);
  assert.equal(presentation.additionalProperties, false);
});

test("structured script output is restricted to supported direct model transports and script policy", () => {
  for (const model of ["claude-sonnet-4-6", "claude-opus-4-6", "claude-sonnet-4-6-20260101"]) {
    assert.deepEqual(scriptOutputConfig(model, true, "script-v1"), { format: { type: "json_schema", schema: SCRIPT_OUTPUT_SCHEMA } });
    assert.equal(scriptOutputConfig(model, false, "script-v1"), undefined);
    for (const policy of [undefined, "research-v1", "research-v2", "quality-review-v1"]) assert.equal(scriptOutputConfig(model, true, policy), undefined);
  }
  for (const model of ["claude-sonnet-4-5", "claude-haiku-4-5", "anthropic/claude-sonnet-4.6", "claude-sonnet-4-60", "fixture-model"]) assert.equal(scriptOutputConfig(model, true, "script-v1"), undefined);
});

test("constrained outcome grammar rejects the actual failed fact-16 binding while allowing researched outcome facts", () => {
  const base = JSON.stringify(SCRIPT_OUTPUT_SCHEMA), schema = constrainedScriptSchema(constraints) as Schema;
  const variants = schema.properties!.scenes.items!.anyOf!;
  const allowed = (storyRole: string, evidenceId: string) => variants.some(variant => variant.properties!.storyRole.enum!.includes(storyRole) && variant.properties!.evidenceId.enum!.includes(evidenceId));
  assert.equal(allowed("outcome", "fact-16"), false);
  assert.equal(allowed("outcome", "fact-8"), true);
  assert.equal(allowed("outcome", "fact-9"), true);
  assert.equal(allowed("mechanism", "fact-16"), true);
  assert.equal(allowed("cta", "fact-16"), false);
  assert.equal(allowed("invented-role", "fact-8"), false);
  for (const variant of variants) assert.ok(variant.required!.includes("storyRole"));
  assert.equal(JSON.stringify(SCRIPT_OUTPUT_SCHEMA), base);
  assert.deepEqual(scriptOutputConfig("claude-sonnet-4-6", true, "script-v1", constraints)?.format.schema, schema);
});

test("constrained schema references resolve, all objects stay closed, and optional/union counts remain bounded", () => {
  const schema = constrainedScriptSchema(constraints) as Schema;
  let optional = 0, unions = 0, alternatives = 0, objects = 0, references = 0;
  function inspect(node: Schema) {
    if (node.$ref) {
      references++;
      assert.match(node.$ref, /^#\/\$defs\/[a-z]+$/);
      assert.ok(schema.$defs![node.$ref.slice("#/$defs/".length)]);
    }
    if (node.type === "object") {
      objects++;
      assert.equal(node.additionalProperties, false);
      assert.equal(new Set(node.required).size, node.required!.length);
      assert.ok(node.required!.every(key => Object.hasOwn(node.properties!, key)));
      optional += Object.keys(node.properties!).filter(key => !node.required!.includes(key)).length;
      Object.values(node.properties!).forEach(inspect);
    }
    if (node.items) inspect(node.items);
    if (node.anyOf) { unions++; alternatives += node.anyOf.length; node.anyOf.forEach(inspect); }
    Object.values(node.$defs || {}).forEach(inspect);
  }
  inspect(schema);
  assert.equal(references, 6); assert.equal(objects, 14);
  assert.equal(optional, 2); assert.ok(optional <= 24);
  assert.equal(unions, 2); assert.equal(alternatives, 10); assert.ok(alternatives <= 16);
});

test("all source asset, card, panel and connection-node choices stay inside verified enums", () => {
  const schema = constrainedScriptSchema(constraints) as Schema;
  for (const scene of schema.properties!.scenes.items!.anyOf!) assert.deepEqual(scene.properties!.assetId.enum, constraints.assetIds);
  const presentation = schema.$defs!.presentation;
  assert.deepEqual(presentation.properties!.cards.items!.properties!.evidenceId.enum, constraints.selectedFactIds);
  const visuals = presentation.properties!.visual.anyOf!;
  const panels = visuals.find(variant => variant.properties!.kind.enum!.includes("panels"))!;
  assert.deepEqual(panels.properties!.secondaryAssetId.enum, constraints.assetIds);
  assert.deepEqual(panels.properties!.secondaryEvidenceId.enum, constraints.selectedFactIds);
  const connections = visuals.find(variant => variant.properties!.kind.enum!.includes("connections"))!;
  assert.deepEqual(connections.properties!.nodes.items!.properties!.evidenceId.enum, constraints.selectedFactIds);
  assert.throws(() => constrainedScriptSchema({ ...constraints, assetIds: [] }), /verified source IDs/);
  assert.throws(() => constrainedScriptSchema({ ...constraints, selectedFactIds: [] }), /verified source IDs/);
  for (const role of ["mechanism", "outcome", "cta"]) assert.throws(() => constrainedScriptSchema({ ...constraints, roleEvidenceIds: { ...constraints.roleEvidenceIds, [role]: [] } }), /verified story roles/);
});

test("UI design grammar keeps each target's sources and state capabilities in its own namespace", () => {
  const constraints: UiDesignConstraints = { targets: [
    { id: "wikilink-autocomplete", sourceAssetIds: ["product-panel-0"], capabilityFactIds: ["fact-10", "fact-12"] },
    { id: "graph-view", sourceAssetIds: ["product-panel-1"], capabilityFactIds: ["fact-16"] },
  ] };
  const before = JSON.stringify({ schema: UI_OUTPUT_SCHEMA, constraints }), schema = constrainedUiSchema(constraints) as Schema;
  for (const current of [schema, UI_OUTPUT_SCHEMA as Schema]) {
    assert.ok(current.required!.includes("transportVersion"));
    assert.ok(current.required!.includes("coordinateSpace"));
    assert.deepEqual(current.properties!.transportVersion.enum, [UI_TRANSPORT_VERSION]);
    assert.deepEqual(current.properties!.coordinateSpace.enum, ["normalized", "pixels"]);
  }
  const keyed = schema.properties!.documentsById;
  // An empty object is representable for an honest refusal. The compiler still
  // requires complete exact coverage for every successful document response.
  assert.deepEqual(keyed.required, []);
  assert.equal(keyed.additionalProperties, false);
  assert.equal(schema.properties!.documents, undefined);
  const variants = constraints.targets.map(target => keyed.properties![target.id]);
  assert.equal(variants.length, 2);
  for (let index = 0; index < variants.length; index++) {
    const properties = variants[index].properties!, target = constraints.targets[index];
    assert.deepEqual(properties.id.enum, [target.id]);
    assert.deepEqual(properties.sourceAssetIds.items!.enum, target.sourceAssetIds);
    assert.deepEqual(properties.capabilityFactIds.items!.enum, target.capabilityFactIds);
    assert.deepEqual(properties.elements.items!.properties!.sourceAssetId.enum, target.sourceAssetIds);
    assert.deepEqual(properties.states.items!.properties!.sourceAssetId.enum, ["", ...target.sourceAssetIds]);
    assert.deepEqual(properties.states.items!.properties!.evidenceIds.items!.enum, target.capabilityFactIds);
  }
  const graph = variants[1].properties!;
  assert.equal(graph.capabilityFactIds.items!.enum!.includes("fact-10"), false);
  assert.equal(graph.states.items!.properties!.evidenceIds.items!.enum!.includes("fact-10"), false);
  assert.equal(graph.elements.items!.properties!.sourceAssetId.enum!.includes("product-panel-0"), false);
  assert.deepEqual(scriptOutputConfig("claude-sonnet-4-6", true, "ui-design-v1", undefined, constraints)?.format.schema, schema);
  assert.deepEqual(scriptOutputConfig("claude-sonnet-4-6", true, "ui-design-v1")?.format.schema, UI_OUTPUT_SCHEMA);
  assert.equal(JSON.stringify({ schema: UI_OUTPUT_SCHEMA, constraints }), before);
  let unions = 0, references = 0;
  const inspect = (node: Schema) => {
    if (node.type === "object") { assert.equal(node.additionalProperties, false); Object.values(node.properties!).forEach(inspect); }
    if (node.items) inspect(node.items);
    if (node.anyOf) { unions++; node.anyOf.forEach(inspect); }
    if (node.$ref) { references++; assert.ok(schema.$defs![node.$ref.slice("#/$defs/".length)]); }
    Object.values(node.$defs || {}).forEach(inspect);
  };
  inspect(schema);
  assert.equal(unions, 0); assert.equal(references, 8);
  assert.throws(() => constrainedUiSchema({ targets: [] }), /verified target IDs/);
  assert.throws(() => constrainedUiSchema({ targets: [constraints.targets[0], constraints.targets[0]] }), /verified target IDs/);
  assert.throws(() => constrainedUiSchema({ targets: [{ ...constraints.targets[0], capabilityFactIds: [] }] }), /verified source and capability IDs/);
  assert.throws(() => constrainedUiSchema({ targets: [{ ...constraints.targets[0], sourceAssetIds: ["same", "same"] }] }), /verified source and capability IDs/);
});

test("two-document script grammar is flat while role citations remain indivisible verified choices", () => {
  const ui = ["editor", "graph"].map(id => ({ id, elementIds: [`${id}-input`, `${id}-button`], editableElementIds: [`${id}-input`], stateIds: [`${id}-initial`, `${id}-result`], capabilityFactIds: ["fact-10", "fact-16"] }));
  const schema = constrainedScriptSchema({ ...constraints, uiDocuments: ui }) as Schema;
  const scene = schema.properties!.scenes.items!, presentation = scene.properties!.presentation;
  assert.deepEqual(schema.properties!.transportVersion.enum, ["flat-script-v1"]);
  assert.ok(scene.properties!.storyEvidence.enum!.includes("mechanism:fact-16"));
  assert.ok(!scene.properties!.storyEvidence.enum!.includes("outcome:fact-16"));
  assert.equal(scene.properties!.storyRole, undefined); assert.equal(scene.properties!.evidenceId, undefined);
  assert.deepEqual(presentation.properties!.visual.properties!.documentId.enum, ["", "editor", "graph"]);
  let unions = 0, optional = 0;
  const inspect = (node: Schema) => {
    if (node.type === "object") { assert.equal(node.additionalProperties, false); optional += Object.keys(node.properties!).filter(key => !node.required!.includes(key)).length; Object.values(node.properties!).forEach(inspect); }
    if (node.items) inspect(node.items); if (node.anyOf) { unions++; node.anyOf.forEach(inspect); }
  };
  inspect(schema); assert.equal(unions, 0); assert.equal(optional, 0);
});


test("correction scene allowance uses supported grammar descriptions and rejects invalid bounds",()=>{
  for(const uiDocuments of[undefined,[{id:"editor",elementIds:["input"],editableElementIds:["input"],stateIds:["initial"],capabilityFactIds:["fact-10"]}]]){
    const schema=constrainedScriptSchema({...constraints,uiDocuments,maxScenes:5}) as any;
    assert.match(schema.properties.scenes.description,/At most 5 scenes/);
    assert.equal(schema.properties.scenes.maxItems,undefined);
  }
  for(const maxScenes of[1,9,2.5,NaN])assert.throws(()=>constrainedScriptSchema({...constraints,maxScenes}),/scene allowance/);
});

test("literal preview grammar omits redundant references while preserving authored content, provenance and sparse refusal", () => {
  const literal = { id: "preview", sourceAssetIds: ["code-preview"], capabilityFactIds: ["fact-2", "fact-3"], literalPreview: true as const };
  const ordinary = { id: "form", sourceAssetIds: ["form-source"], capabilityFactIds: ["fact-8"] };
  const constraints: UiDesignConstraints = { targets: [literal, ordinary], requireLaunchResult: true };
  const initial = JSON.stringify({ constraints, schema: UI_OUTPUT_SCHEMA });
  const schema = constrainedUiSchema(constraints) as Schema, documents = schema.properties!.documentsById;
  const preview = documents.properties!.preview, form = documents.properties!.form;
  assert.deepEqual(documents.required, []); // Refusal still needs no fabricated document.
  assert.equal(documents.additionalProperties, false);
  assert.equal(preview.properties!.previewBinding, undefined); assert.equal(preview.properties!.terminalResult, undefined);
  assert.equal(preview.properties!.sourceValueDerivations, undefined);
  assert.deepEqual(preview.required, ["id", "sourceAssetIds", "capabilityFactIds", "viewport", "styles", "elements", "states"]);
  assert.deepEqual(preview.properties!.elements.items!.properties!.type.enum, ["panel", "text"]);
  assert.deepEqual(preview.properties!.elements.items!.properties!.sourceAssetId.enum, literal.sourceAssetIds);
  assert.deepEqual(preview.properties!.states.items!.properties!.evidenceIds.items!.enum, literal.capabilityFactIds);
  assert.ok(preview.properties!.states.items!.required!.includes("textValues"));
  assert.ok(preview.properties!.elements.items!.required!.includes("sourceRect"));
  assert.equal(form.properties!.previewBinding, undefined);
  assert.deepEqual(form.properties!.terminalResult.properties!.version.enum, [1]);
  assert.ok(form.properties!.terminalResult.properties!.confirmationElementId);
  assert.equal(form.properties!.terminalResult.properties!.trigger, undefined);
  let optional = 0;
  const inspect = (node: Schema) => {
    assert.equal(node.anyOf, undefined);
    if (node.type === "object") { assert.equal(node.additionalProperties, false); assert.ok(node.required!.every(key => Object.hasOwn(node.properties!, key))); optional += Object.keys(node.properties!).filter(key => !node.required!.includes(key)).length; Object.values(node.properties!).forEach(inspect); }
    if (node.items) inspect(node.items);
    if (node.$ref) assert.ok(schema.$defs![node.$ref.slice("#/$defs/".length)]);
    Object.values(node.$defs || {}).forEach(inspect);
  };
  inspect(schema); assert.equal(optional, 2);
  assert.deepEqual(scriptOutputConfig("claude-sonnet-4-6", true, "ui-design-v1", undefined, constraints)?.format.schema, schema);
  assert.equal(JSON.stringify({ constraints, schema: UI_OUTPUT_SCHEMA }), initial);
  const noLaunch = constrainedUiSchema({ targets: [literal] }) as Schema;
  assert.equal(noLaunch.properties!.documentsById.properties!.preview.properties!.terminalResult, undefined);
  assert.throws(() => constrainedUiSchema({ targets: [{ ...literal, sourceValueDerivation: true }] }), /one distinct result derivation/);
});

test("derived native transports are smaller than ordinary UI while retaining all authored content fields", () => {
  // Structural comparison only: provider compilation still needs real acceptance.
  const target = { id: "synthetic-target", sourceAssetIds: ["synthetic-source"], capabilityFactIds: ["fact-1", "fact-2", "fact-3", "fact-4"] };
  const ordinary = constrainedUiSchema({ targets: [target], requireLaunchResult: true }) as Schema;
  const count = (node: Schema): { objects: number; properties: number } => {
    const totals = { objects: node.type === "object" ? 1 : 0, properties: Object.keys(node.properties || {}).length };
    for (const child of [...Object.values(node.properties || {}), ...Object.values(node.$defs || {}), ...(node.items ? [node.items] : [])]) { const nested = count(child); totals.objects += nested.objects; totals.properties += nested.properties; }
    return totals;
  };
  for (const marker of [{ literalPreview: true as const }, { sourceValueDerivation: true as const }]) {
    const schema = constrainedUiSchema({ targets: [{ ...target, ...marker }], requireLaunchResult: true }) as Schema;
    assert.ok(count(schema).objects < count(ordinary).objects);
    assert.ok(count(schema).properties < count(ordinary).properties);
    assert.ok(JSON.stringify(schema).length < JSON.stringify(ordinary).length);
    assert.deepEqual(schema.$defs, ordinary.$defs);
    const reduced = structuredClone(schema.properties!.documentsById.properties![target.id]);
    for (const field of ["terminalResult", "previewBinding", "sourceValueDerivations"]) assert.equal(reduced.properties![field], undefined);
    const plain = structuredClone(ordinary.properties!.documentsById.properties![target.id]);
    delete plain.properties!.terminalResult; plain.required = plain.required!.filter(key => key !== "terminalResult");
    if ("literalPreview" in marker) plain.properties!.elements.items!.properties!.type = { type: "string", enum: ["panel", "text"] };
    delete (reduced.properties!.states as Schema & { description?: string }).description;
    assert.deepEqual(reduced, plain, "no authored content field is omitted or rewritten by grammar reduction");
    const noLaunch = constrainedUiSchema({ targets: [{ ...target, ...marker }] }) as Schema;
    assert.equal(noLaunch.properties!.documentsById.properties![target.id].properties!.terminalResult, undefined);
  }
});

test("all repeated UI grammar fields are required; only sparse-refusal target keys remain optional", () => {
  const base = JSON.stringify(UI_OUTPUT_SCHEMA);
  for (const variant of [{}, { sourceValueDerivation: true as const }, { literalPreview: true as const }]) {
    const target = { id: "synthetic-target", sourceAssetIds: ["synthetic-source"], capabilityFactIds: ["fact-1"], ...variant };
    const schema = constrainedUiSchema({ targets: [target], requireLaunchResult: true }) as Schema;
    let optional = 0;
    const inspect = (node: Schema) => {
      if (node.type === "object") { optional += Object.keys(node.properties!).filter(key => !node.required!.includes(key)).length; assert.equal(node.additionalProperties, false); Object.values(node.properties!).forEach(inspect); }
      if (node.items) inspect(node.items); assert.equal(node.anyOf, undefined); Object.values(node.$defs || {}).forEach(inspect);
    };
    inspect(schema); assert.equal(optional, 1);
    const keyed = schema.properties!.documentsById, doc = keyed.properties![target.id], element = doc.properties!.elements.items!, state = doc.properties!.states.items!;
    assert.deepEqual(keyed.required, []);
    assert.deepEqual(element.required, Object.keys(element.properties!)); assert.deepEqual(state.required, Object.keys(state.properties!));
    for (const field of ["fromId", "toId", "selectedStyleId"]) { assert.equal(element.properties![field].type, "string"); assert.match((element.properties![field] as any).description, /empty string when absent/); }
    assert.deepEqual(state.properties!.sourceAssetId.enum, ["", "synthetic-source"]);
    assert.deepEqual(element.properties!.sourceAssetId.enum, ["synthetic-source"]); // Never make actual element provenance optional.
  }
  assert.equal(JSON.stringify(UI_OUTPUT_SCHEMA), base);
});
