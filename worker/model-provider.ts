import { PipelineError } from "./types";

export type ModelProviderName = "anthropic" | "vercel-ai-gateway" | "openrouter";
export interface ModelProvider {
  provider: ModelProviderName;
  model: string;
  endpoint: string;
  /** Server-only credential. Never persist or log this resolved object. */
  credential: string | undefined;
  direct: boolean;
}

/** Explicit selection never falls through to another account or provider. */
export function resolveModelProvider(env: Record<string, string | undefined>): ModelProvider {
  const selected = env.MODEL_PROVIDER;
  if (selected && !["anthropic", "vercel-ai-gateway", "openrouter"].includes(selected)) throw new PipelineError("provider_not_configured", "The selected model provider is not supported.", "Configure MODEL_PROVIDER as anthropic, vercel-ai-gateway, or openrouter.");
  const provider = (selected || (env.ANTHROPIC_API_KEY ? "anthropic" : env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN ? "vercel-ai-gateway" : env.OPENROUTER_API_KEY ? "openrouter" : "vercel-ai-gateway")) as ModelProviderName;
  if (provider === "anthropic") return { provider, model: env.ANTHROPIC_MODEL || "claude-sonnet-4-6", endpoint: "https://api.anthropic.com/v1/messages", credential: env.ANTHROPIC_API_KEY, direct: true };
  if (provider === "openrouter") return { provider, model: env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6", endpoint: "https://openrouter.ai/api/v1/messages", credential: env.OPENROUTER_API_KEY, direct: false };
  return { provider, model: env.AI_GATEWAY_MODEL || "anthropic/claude-sonnet-4.6", endpoint: "https://ai-gateway.vercel.sh/v1/messages", credential: env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN, direct: false };
}
