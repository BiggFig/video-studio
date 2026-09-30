import { del, list } from "@vercel/blob";
import { query } from "./db";

async function purgePrefix(prefix: string, exact = false): Promise<{ removed: number; done: boolean }> {
  const page = await list({ prefix, limit: 500 });
  const blobs = page.blobs.filter(blob => exact ? blob.pathname === prefix : blob.pathname.startsWith(prefix));
  if (blobs.length) await del(blobs.map(blob => blob.url));
  return { removed: blobs.length, done: !page.hasMore };
}

/** Bounded, idempotent cleanup; failed storage deletion leaves DB records for retry. */
export async function cleanupExpiredJobs(batchSize = 5) {
  const report = { jobs: 0, uploads: 0, objects: 0 };
  const jobs = await query<{ id: string }>("SELECT id FROM studio_jobs WHERE expires_at<=now() ORDER BY expires_at LIMIT $1", [Math.max(1, Math.min(10, batchSize))]);
  for (const job of jobs) {
    // Revoke the lease before removing an interrupted worker's expired workspace.
    await query("UPDATE studio_jobs SET status='cancelled',lease_token=NULL,lease_expires_at=NULL,worker_id=NULL WHERE id=$1 AND expires_at<=now()", [job.id]);
    const purge = await purgePrefix(`jobs/${job.id}/`); report.objects += purge.removed;
    if (purge.done) { await query("DELETE FROM studio_jobs WHERE id=$1 AND expires_at<=now()", [job.id]); report.jobs++; }
  }
  const uploads = await query<{ id: string; pathname: string }>("SELECT id,pathname FROM studio_uploads WHERE expires_at<=now() ORDER BY expires_at LIMIT $1", [Math.max(1, Math.min(50, batchSize * 5))]);
  for (const upload of uploads) {
    const purge = await purgePrefix(upload.pathname, true); report.objects += purge.removed;
    if (purge.done) { await query("DELETE FROM studio_uploads WHERE id=$1 AND expires_at<=now()", [upload.id]); report.uploads++; }
  }
  await query("DELETE FROM studio_sessions WHERE expires_at<=now()");
  // Keep redeemed bootstrap invites: deleting one would make its env token usable again.
  await query("DELETE FROM studio_rate_limits WHERE expires_at<=now()");
  return report;
}
