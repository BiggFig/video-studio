import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { splitSql } from "../db/split-sql";
import { query } from "../lib/server/db";
import { claimNextJob, checkpointJob, createJob, failJob, heartbeatJob, ownedJob, recordJobArtifact, reserveJobArtifact } from "../lib/server/jobs";
import { ownedUpload, prepareUpload } from "../lib/server/uploads";

test("Postgres isolation, invite consumption, submission races and lease recovery", { skip: process.env.STUDIO_DB_INTEGRATION !== "1" }, async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for the opt-in integration test.");
  const originalUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalActiveLimit = process.env.BETA_MAX_ACTIVE_JOBS;
  const admin = neon(originalUrl);
  const schemaName = `studio_test_${randomUUID().replaceAll("-", "")}`;
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  try {
    await admin.transaction([admin.query(`CREATE SCHEMA ${schemaName}`), admin.query(`SET LOCAL search_path TO ${schemaName}, public`), ...splitSql(schema).map(statement => admin.query(statement))]);
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.STUDIO_DB_TEST_SCHEMA = schemaName;
    process.env.BETA_MAX_ACTIVE_JOBS = "2";
    const path = await query<{ current_schema: string }>("SELECT current_schema()");
    assert.equal(path[0].current_schema, schemaName, "Integration tests must never use the app schema.");

    const users = await query<{ id: string }>("INSERT INTO studio_users(email,name,job_allowance) VALUES('first@example.org','First',10),('second@example.org','Second',10) RETURNING id");
    const [first, second] = users.map(user => user.id);
    await query("INSERT INTO studio_invitations(token_hash,email,name,expires_at) VALUES('test-invite','invite@example.org','Invite',now()+interval '1 hour')");
    const redemptions = await Promise.allSettled([query("SELECT * FROM studio_redeem_invitation('test-invite','session-one')"), query("SELECT * FROM studio_redeem_invitation('test-invite','session-two')")]);
    assert.equal(redemptions.filter(result => result.status === "fulfilled").length, 1, "Invitation must be single-use under concurrent calls");
    assert.equal((await query<{ count: string }>("SELECT count(*) FROM studio_sessions"))[0].count, "1");

    const input = { mode: "url", productUrl: "https://vercel.com", videoType: "launch", format: "auto", uploadIds: [], idempotencyKey: randomUUID() };
    const duplicate = await Promise.all([createJob(first, input), createJob(first, input)]);
    assert.equal(duplicate[0].id, duplicate[1].id, "Duplicate clicks should return one durable job");
    await assert.rejects(createJob(first, { ...input, format: "9:16" }), /already used/);
    await assert.rejects(ownedJob(duplicate[0].id, second), /could not be found/);
    const reservation = await prepareUpload(first, { name: "screen.png", size: 32, contentType: "image/png", kind: "asset" });
    await assert.rejects(ownedUpload(reservation.id, second), /could not be found/);
    await assert.rejects(createJob(second, { ...input, idempotencyKey: randomUUID(), uploadIds: [reservation.id] }), /unavailable/);

    const competing = await Promise.allSettled([createJob(first, { ...input, idempotencyKey: randomUUID() }), createJob(first, { ...input, idempotencyKey: randomUUID() })]);
    assert.equal(competing.filter(result => result.status === "fulfilled").length, 1, "Owner active-job limit must hold across simultaneous inserts");
    const owners = await query<{ jobs_used: number }>("SELECT jobs_used FROM studio_users WHERE id=$1", [first]);
    assert.equal(owners[0].jobs_used, 2, "Idempotent retries must not consume the beta allowance twice");

    const claims = await Promise.all([claimNextJob({ workerId: "test-a", globalConcurrency: 2 }), claimNextJob({ workerId: "test-b", globalConcurrency: 2 })]);
    assert.equal(claims.filter(Boolean).length, 1, "Per-user running concurrency must be enforced atomically");
    const claimed = claims.find(Boolean)!;
    assert.ok(claimed.lease_token);
    const artifact = (suffix: string, size: number) => ({ pathname: `jobs/${claimed.id}/${suffix}/ledger.json`, url: `https://test.private.blob.vercel-storage.com/jobs/${claimed.id}/${suffix}/ledger.json`, size, contentType: "application/json" });
    const earlier = artifact("first", 32), later = artifact("second", 33);
    const one = await reserveJobArtifact(claimed.id, claimed.lease_token!, { ...earlier, path: "ledger.json" });
    await assert.rejects(recordJobArtifact(claimed.id, claimed.lease_token!, "ledger.json", { ...earlier, size: 99 }, one.grantId), /reserved upload/);
    await recordJobArtifact(claimed.id, claimed.lease_token!, "ledger.json", earlier, one.grantId);
    const two = await reserveJobArtifact(claimed.id, claimed.lease_token!, { ...later, path: "ledger.json" });
    await recordJobArtifact(claimed.id, claimed.lease_token!, "ledger.json", later, two.grantId);
    const replayed = await recordJobArtifact(claimed.id, claimed.lease_token!, "ledger.json", earlier, one.grantId);
    assert.equal(replayed.artifacts["ledger.json"].pathname, later.pathname, "Replayed completions must not restore stale checkpoint data");
    const reservations = await Promise.allSettled(["large-a", "large-b", "large-c"].map(suffix => reserveJobArtifact(claimed.id, claimed.lease_token!, { path: `${suffix}.mp4`, pathname: `jobs/${claimed.id}/${suffix}.mp4`, size: 800 * 1024 * 1024, contentType: "video/mp4" })));
    assert.equal(reservations.filter(result => result.status === "fulfilled").length, 2, "Concurrent uncommitted uploads must count toward the job storage budget");
    await checkpointJob(claimed.id, claimed.lease_token!, "planning", { paidAudio: { music: "saved-artifact" } });
    await query("UPDATE studio_jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [claimed.id]);
    const recovered = await claimNextJob({ workerId: "recovery" });
    assert.equal(recovered?.id, claimed.id);
    assert.notEqual(recovered?.lease_token, claimed.lease_token);
    assert.deepEqual(recovered?.checkpoint, { paidAudio: { music: "saved-artifact" } });
    assert.equal(recovered?.attempts, 2);
    await assert.rejects(heartbeatJob(claimed.id, claimed.lease_token!), /no longer owns/);
    await assert.rejects(recordJobArtifact(recovered!.id, recovered!.lease_token!, "ledger.json", later, two.grantId), /reserved upload/);
    await assert.rejects(reserveJobArtifact(recovered!.id, recovered!.lease_token!, { path: "retry.mp4", pathname: `jobs/${claimed.id}/retry.mp4`, size: 800 * 1024 * 1024, contentType: "video/mp4" }), /storage budget/);
    await failJob(recovered!.id, recovered!.lease_token!, { code: "TEST_TRANSIENT", message: "Temporary failure", action: "Retry", retryable: true, maxAttempts: 2 });
    const failed = await ownedJob(recovered!.id, first);
    assert.equal(failed.status, "failed", "Attempt limit must prevent unbounded paid retries");
    assert.equal(failed.quality_passed, false);
    const nextJob = await claimNextJob({ workerId: "count-cap" });
    assert.ok(nextJob?.lease_token);
    await query("INSERT INTO studio_artifact_reservations(job_id,lease_token,relative_path,pathname,size,content_type) SELECT $1::uuid,$2::uuid,'x-'||n::text,'jobs/'||$1::uuid::text||'/x-'||n::text,1,'application/json' FROM generate_series(1,400) AS n", [nextJob.id, nextJob.lease_token]);
    await assert.rejects(reserveJobArtifact(nextJob.id, nextJob.lease_token, { path: "excess.json", pathname: `jobs/${nextJob.id}/excess.json`, size: 1, contentType: "application/json" }), /storage budget/);
  } finally {
    process.env.DATABASE_URL = originalUrl;
    if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV; else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    if (originalActiveLimit === undefined) delete process.env.BETA_MAX_ACTIVE_JOBS; else process.env.BETA_MAX_ACTIVE_JOBS = originalActiveLimit;
    delete process.env.STUDIO_DB_TEST_SCHEMA;
    // Only the exact generated test schema is removed; real app data is untouched.
    await admin.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  }
});
