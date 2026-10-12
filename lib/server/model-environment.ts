import { resolveModelProvider } from "../../worker/model-provider";

/** Give a sandbox only its selected model credential, never every configured account. */
export async function workerModelEnvironment(source: Record<string,string|undefined>, getOidc: () => Promise<string>): Promise<Record<string,string>> {
  const model=resolveModelProvider(source);
  const env:Record<string,string>={MODEL_PROVIDER:model.provider};
  if(model.provider === "vercel-ai-gateway") {
    env.AI_GATEWAY_MODEL=model.model;
    if(source.AI_GATEWAY_API_KEY)env.AI_GATEWAY_API_KEY=source.AI_GATEWAY_API_KEY;
    else env.VERCEL_OIDC_TOKEN=await getOidc();
  } else {
    if(!model.credential)throw new Error(`Missing required configuration: ${model.provider === "openrouter" ? "OPENROUTER_API_KEY" : "ANTHROPIC_API_KEY"}`);
    const prefix=model.provider === "openrouter" ? "OPENROUTER" : "ANTHROPIC";
    env[`${prefix}_API_KEY`]=model.credential;
    env[`${prefix}_MODEL`]=model.model;
  }
  return env;
}
