import type { StudioLimits } from "../contracts";

function integer(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}

export function limits(): StudioLimits {
  return {
    maxFiles: integer("BETA_MAX_FILES", 12, 1, 30),
    maxFileBytes: integer("BETA_MAX_FILE_BYTES", 250 * 1024 * 1024, 1024, 1024 * 1024 * 1024),
    maxTotalBytes: integer("BETA_MAX_TOTAL_BYTES", 500 * 1024 * 1024, 1024, 2 * 1024 * 1024 * 1024),
    maxPrdBytes: integer("BETA_MAX_PRD_BYTES", 15 * 1024 * 1024, 1024, 30 * 1024 * 1024),
    maxReferenceBytes: integer("BETA_MAX_REFERENCE_BYTES", 100 * 1024 * 1024, 1024, 250 * 1024 * 1024),
    maxSourceDurationSeconds: integer("BETA_MAX_SOURCE_SECONDS", 300, 1, 600),
    maxReferenceDurationSeconds: integer("BETA_MAX_REFERENCE_SECONDS", 180, 1, 300),
    maxActiveJobs: integer("BETA_MAX_ACTIVE_JOBS", 2, 1, 5),
    maxJobsPerDay: integer("BETA_MAX_JOBS_PER_DAY", 5, 1, 20),
    retentionDays: integer("BETA_RETENTION_DAYS", 30, 1, 90),
  };
}

export function authConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32);
}

export function acceptingJobs() {
  const modelAuth = process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === "1" || process.env.VERCEL_OIDC_TOKEN;
  return authConfigured() && process.env.BETA_ACCEPTING_JOBS === "true" && Boolean(process.env.BLOB_READ_WRITE_TOKEN && modelAuth && process.env.ELEVENLABS_API_KEY && process.env.APP_URL && process.env.WORKER_SECRET && process.env.WORKER_SNAPSHOT_ID);
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
}
