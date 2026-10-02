import test from "node:test";
import assert from "node:assert/strict";
import { SCRIPT_OUTPUT_SCHEMA, UI_OUTPUT_SCHEMA, UI_TRANSPORT_VERSION, scriptOutputConfig, constrainedScriptSchema, constrainedUiSchema, type ScriptConstraints, type UiDesignConstraints } from "./model-format";

type Schema = { type?: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; anyOf?: Schema[]; enum?: string[]; $ref?: string; $defs?: Record<string, Schema> };
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
    for (const policy of [undefined, "research-v1", "quality-review-v1"]) assert.equal(scriptOutputConfig(model, true, policy), undefined);
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
  assert.deepEqual(keyed.required, constraints.targets.map(target => target.id));
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
    assert.deepEqual(properties.states.items!.properties!.sourceAssetId.enum, target.sourceAssetIds);
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
