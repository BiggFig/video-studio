import test from "node:test";
import assert from "node:assert/strict";
import { acceptingJobs } from "../lib/server/config";
import { workerModelEnvironment } from "../lib/server/model-environment";

test("job availability follows the selected model provider without credential fallback", t => {
  const configured = {DATABASE_URL:"mock",SESSION_SECRET:"s".repeat(32),BETA_ACCEPTING_JOBS:"true",BLOB_READ_WRITE_TOKEN:"mock",ELEVENLABS_API_KEY:"mock",APP_URL:"https://studio.example",WORKER_SECRET:"mock",WORKER_SNAPSHOT_ID:"mock",ANTHROPIC_API_KEY:"old-direct",MODEL_PROVIDER:"openrouter",OPENROUTER_API_KEY:"test-only",VERCEL:"1"};
  const names=[...Object.keys(configured),"AI_GATEWAY_API_KEY","VERCEL_OIDC_TOKEN"];
  const before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  t.after(()=>{for(const [name,value] of Object.entries(before)){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
  for(const name of names)delete process.env[name];
  Object.assign(process.env,configured);
  assert.equal(acceptingJobs(),true);
  delete process.env.OPENROUTER_API_KEY;
  assert.equal(acceptingJobs(),false,"explicit OpenRouter never falls back to stale direct/Vercel credentials");
  process.env.MODEL_PROVIDER="invalid";
  assert.equal(acceptingJobs(),false);
  process.env.MODEL_PROVIDER="vercel-ai-gateway";
  assert.equal(acceptingJobs(),true,"deployment can obtain fresh OIDC for explicit Gateway");
  process.env.MODEL_PROVIDER="anthropic";
  assert.equal(acceptingJobs(),true);
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(acceptingJobs(),false);
});

test("sandbox receives only its selected account and an explicit model route", async () => {
  const source={MODEL_PROVIDER:"openrouter",OPENROUTER_API_KEY:"openrouter-test",ANTHROPIC_API_KEY:"stale-test",AI_GATEWAY_API_KEY:"gateway-test",VERCEL_OIDC_TOKEN:"old-oidc",UNRELATED_SECRET:"excluded"};
  let oidcCalls=0;
  const oidc=async()=>{oidcCalls++;return "fresh-test-oidc";};
  assert.deepEqual(await workerModelEnvironment(source,oidc),{MODEL_PROVIDER:"openrouter",OPENROUTER_API_KEY:"openrouter-test",OPENROUTER_MODEL:"anthropic/claude-sonnet-4.6"});
  assert.equal(oidcCalls,0);
  await assert.rejects(workerModelEnvironment({...source,OPENROUTER_API_KEY:undefined},oidc),/OPENROUTER_API_KEY/);
  assert.equal(oidcCalls,0);
  assert.deepEqual(await workerModelEnvironment({...source,MODEL_PROVIDER:"vercel-ai-gateway",AI_GATEWAY_API_KEY:undefined},oidc),{MODEL_PROVIDER:"vercel-ai-gateway",AI_GATEWAY_MODEL:"anthropic/claude-sonnet-4.6",VERCEL_OIDC_TOKEN:"fresh-test-oidc"});
  assert.equal(oidcCalls,1);
  assert.deepEqual(await workerModelEnvironment({...source,MODEL_PROVIDER:"anthropic"},oidc),{MODEL_PROVIDER:"anthropic",ANTHROPIC_API_KEY:"stale-test",ANTHROPIC_MODEL:"claude-sonnet-4-6"});
  assert.equal(oidcCalls,1);
});
