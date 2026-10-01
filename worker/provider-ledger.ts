import { z } from "zod";
import type { Ledger } from "./types";

const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const seconds = z.number().finite().nonnegative();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().min(1).max(512);
const receipt = z.object({
  provider: z.enum(["anthropic", "vercel-ai-gateway", "elevenlabs"]),
  operation: z.string().min(1).max(128),
  requestId: identifier.nullable(),
  units: seconds,
  unit: z.enum(["tokens", "seconds"]),
  model: identifier.optional(),
  songId: identifier.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.provider === "elevenlabs") {
    if (value.unit !== "seconds") context.addIssue({ code: "custom", message: "Audio receipt must use seconds" });
  } else if (value.unit !== "tokens" || !Number.isSafeInteger(value.units) || !value.model) {
    context.addIssue({ code: "custom", message: "Model receipt needs integer token units and a model" });
  }
});
const audioPath = z.string().regex(/^assets\/(music|sfx)-[a-f0-9]{16}\.mp3$/);
const audioEntry = z.discriminatedUnion("status", [
  z.object({ status: z.literal("reserved"), path: audioPath, hash: z.literal("") }).strict(),
  z.object({ status: z.literal("completed"), path: audioPath, hash: digest }).strict(),
]);
const ledgerSchema = z.object({
  modelCalls: counter,
  inputTokens: counter,
  outputTokens: counter,
  reservedInputTokens: counter,
  reservedOutputTokens: counter,
  audioGenerations: counter,
  asrSeconds: seconds,
  providerRequests: z.array(receipt),
  audio: z.record(digest, audioEntry),
}).strict().superRefine((value, context) => {
  for (const [key, audio] of Object.entries(value.audio)) {
    if (!audio.path.endsWith(`-${key.slice(0, 16)}.mp3`)) context.addIssue({ code: "custom", path: ["audio", key, "path"], message: "Audio path does not match its reservation key" });
  }
});

/** Persisted accounting is authoritative: never coerce, default, or repair it during restore. */
export function parseProviderLedger(value: unknown): Ledger {
  return ledgerSchema.parse(value);
}
