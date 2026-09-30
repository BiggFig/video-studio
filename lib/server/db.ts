import { neon } from "@neondatabase/serverless";
import { requiredEnv } from "./config";

// HTTP queries are safe in both Vercel functions and administrative scripts.
export function database() { return neon(requiredEnv("DATABASE_URL")); }

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = database();
  const testSchema = process.env.NODE_ENV === "test" ? process.env.STUDIO_DB_TEST_SCHEMA : undefined;
  if (testSchema) {
    if (!/^studio_test_[a-f0-9]{32}$/.test(testSchema)) throw new Error("Invalid isolated database test schema");
    const result = await db.transaction([db.query(`SET LOCAL search_path TO ${testSchema}, public`), db.query(sql, params)]);
    return result[1] as T[];
  }
  return await db.query(sql, params) as T[];
}
