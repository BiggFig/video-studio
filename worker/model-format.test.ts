import test from "node:test";
import assert from "node:assert/strict";
import { SCRIPT_OUTPUT_SCHEMA, scriptOutputConfig, constrainedScriptSchema, type ScriptConstraints } from "./model-format";

type Schema = { type?: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; anyOf?: Schema[]; enum?: string[]; $ref?: string; $defs?: Record<string, Schema> };
const constraints: ScriptConstraints = {
  assetIds: ["product-panel-0", "product-panel-1", "capture-1", "brand-logo-0"],
  selectedFactIds: ["fact-2", "fact-8", "fact-9", "fact-10", "fact-16"],
  roleEvidenceIds: { problem: ["fact-10", "fact-8"], product: ["fact-2", "fact-8", "fact-9", "fact-10", "fact-16"], mechanism: ["fact-10", "fact-16"], outcome: ["fact-8", "fact-9"], differentiator: ["fact-8", "fact-2"], cta: ["fact-8"] },
};

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
