import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { splitSql } from "./split-sql";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running the migration.");
  const sql = neon(process.env.DATABASE_URL);
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await sql.transaction(splitSql(schema).map(statement => sql.query(statement)));
  console.log("Video Studio database schema is ready.");
}
main().catch(error => { console.error("Database migration failed:", error instanceof Error ? error.message : "Unknown database error"); process.exitCode = 1; });
