import fs from "node:fs/promises";
import { q, tx, root } from "./db.js";
import { processPhoto, makeExport, mediaPath } from "./media.js";
import { purgePhoto } from "./routes.js";
let stopping = false,
  timer,
  busy = false,
  lastClean = 0;
export async function recover() {
  await q(
    "UPDATE processing_jobs SET state='retrying' WHERE state='processing'",
  );
  await q("UPDATE export_jobs SET state='pending' WHERE state='processing'");
}
async function cleanup() {
  const expired = (
    await q(
      "DELETE FROM upload_sessions WHERE created_at<now()-interval '24 hours' RETURNING id",
    )
  ).rows;
  for (const u of expired)
    await fs.unlink(mediaPath("temporary", u.id)).catch(() => {});
  const trash = (
    await q(
      "SELECT id FROM photos WHERE deleted_at<now()-($1||' days')::interval",
      [Number(process.env.TRASH_DAYS || 30)],
    )
  ).rows;
  for (const p of trash) await purgePhoto(p.id);
  const exports = (
    await q(
      "DELETE FROM export_jobs WHERE created_at<now()-interval '24 hours' RETURNING id",
    )
  ).rows;
  for (const e of exports)
    await fs.unlink(mediaPath("exports", e.id)).catch(() => {});
  await q("DELETE FROM sessions WHERE expires_at<now()");
  // Reconcile files left by a crash before a DB commit; never delete a referenced original.
  for (const name of await fs.readdir(`${root}/originals`)) {
    if (!/^[0-9a-f-]{36}$/.test(name)) continue;
    const s = await fs.stat(mediaPath("originals", name));
    if (
      Date.now() - s.mtimeMs > 86400000 &&
      !(await q("SELECT 1 FROM photos WHERE id=$1", [name])).rowCount
    )
      await fs.unlink(mediaPath("originals", name));
  }
}
async function tick() {
  if (stopping) return;
  busy = true;
  try {
    const job = await tx(
      async (c) =>
        (
          await c.query(
            "UPDATE processing_jobs SET state='processing',attempts=attempts+1,updated_at=now() WHERE id=(SELECT id FROM processing_jobs WHERE state IN ('pending','retrying') AND (state='pending' OR updated_at<now()-interval '20 seconds') ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *",
          )
        ).rows[0],
    );
    if (job) {
      try {
        const p = (await q("SELECT * FROM photos WHERE id=$1", [job.photo_id]))
          .rows[0];
        if (p) await processPhoto(p);
        await q(
          "UPDATE processing_jobs SET state='completed',updated_at=now() WHERE id=$1",
          [job.id],
        );
      } catch (e) {
        const final = job.attempts >= 3;
        console.error(
          JSON.stringify({
            event: "processing_failed",
            job: job.id,
            message: e.message,
          }),
        );
        await q(
          "UPDATE processing_jobs SET state=$2,error=$3,updated_at=now() WHERE id=$1",
          [
            job.id,
            final ? "failed" : "retrying",
            String(e.message).slice(0, 500),
          ],
        );
        await q("UPDATE photos SET status=$2,error=$3 WHERE id=$1", [
          job.photo_id,
          final ? "failed" : "pending",
          final
            ? "Could not decode this image. Retry or download the original."
            : null,
        ]);
      }
    } else {
      const exp = (
        await q(
          "UPDATE export_jobs SET state='processing',updated_at=now() WHERE id=(SELECT id FROM export_jobs WHERE state='pending' ORDER BY created_at LIMIT 1) RETURNING *",
        )
      ).rows[0];
      if (exp) {
        try {
          await makeExport(exp);
          await q(
            "UPDATE export_jobs SET state='completed',updated_at=now() WHERE id=$1",
            [exp.id],
          );
        } catch (e) {
          await q(
            "UPDATE export_jobs SET state='failed',error='Export failed. Check the draft and try again.',updated_at=now() WHERE id=$1",
            [exp.id],
          );
          console.error(
            JSON.stringify({
              event: "export_failed",
              job: exp.id,
              message: e.message,
            }),
          );
        }
      }
    }
    if (Date.now() - lastClean > 3600000) {
      await cleanup();
      lastClean = Date.now();
    }
  } catch (e) {
    console.error(
      JSON.stringify({ event: "worker_error", message: e.message }),
    );
  } finally {
    busy = false;
    if (!stopping) timer = setTimeout(tick, 2000);
  }
}
export function startWorker() {
  tick();
}
export async function stopWorker() {
  stopping = true;
  clearTimeout(timer);
  while (busy) await new Promise((r) => setTimeout(r, 100));
}
