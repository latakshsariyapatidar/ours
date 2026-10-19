import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { q, tx, root } from "./db.js";
import { fail, validOffset } from "./core.js";
import { digest, validateFile, mediaPath, ensureSpace } from "./media.js";
export function uploadRoutes(app) {
  app.post("/api/uploads", async (req, res) => {
    const body = z
      .object({
        filename: z.string().min(1).max(255),
        size: z
          .number()
          .int()
          .positive()
          .max(Number(process.env.MAX_UPLOAD_BYTES || 52428800)),
      })
      .parse(req.body);
    await ensureSpace(body.size);
    if (
      Number(
        (
          await q(
            "SELECT count(*) FROM upload_sessions WHERE user_id=$1 AND state='uploading'",
            [req.user.id],
          )
        ).rows[0].count,
      ) >= 50
    )
      fail(429, "Finish or cancel existing uploads first");
    const id = randomUUID();
    await fs.writeFile(mediaPath("temporary", id), "", {
      flag: "wx",
      mode: 0o600,
    });
    await q(
      "INSERT INTO upload_sessions(id,user_id,filename,size) VALUES($1,$2,$3,$4)",
      [id, req.user.id, body.filename, body.size],
    );
    res.status(201).json({ id, offset: 0 });
  });
  app.get("/api/uploads/:id", async (req, res) => {
    const item = (
      await q("SELECT * FROM upload_sessions WHERE id=$1 AND user_id=$2", [
        req.params.id,
        req.user.id,
      ])
    ).rows[0];
    if (!item) fail(404, "Upload not found");
    res.json(item);
  });
  app.patch("/api/uploads/:id", async (req, res) => {
    await tx(async (c) => {
      const item = (
        await c.query(
          "SELECT * FROM upload_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE",
          [req.params.id, req.user.id],
        )
      ).rows[0];
      if (!item || item.state !== "uploading")
        fail(409, "Upload is no longer open");
      const size = Number(req.get("content-length"));
      const offset = Number(req.get("upload-offset"));
      if (!Number.isSafeInteger(size) || size < 1 || size > 2 * 1024 * 1024)
        fail(413, "Each chunk must be at most 2 MB");
      validOffset(Number(item.offset_bytes), offset, size, Number(item.size));
      await ensureSpace(size);
      const file = mediaPath("temporary", item.id);
      await fs.truncate(file, offset);
      let seen = 0;
      const guard = new Transform({
        transform(chunk, enc, cb) {
          seen += chunk.length;
          cb(seen > size ? new Error("Chunk too large") : null, chunk);
        },
      });
      await pipeline(
        req,
        guard,
        createWriteStream(file, { flags: "r+", start: offset }),
      );
      if (seen !== size) fail(400, "Incomplete chunk; retry it");
      await c.query("UPDATE upload_sessions SET offset_bytes=$2 WHERE id=$1", [
        item.id,
        offset + seen,
      ]);
      res.json({ offset: offset + seen });
    });
  });
  app.post("/api/uploads/:id/complete", async (req, res) => {
    const result = await tx(async (c) => {
      const item = (
        await c.query(
          "SELECT * FROM upload_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE",
          [req.params.id, req.user.id],
        )
      ).rows[0];
      if (!item) fail(404, "Upload not found");
      if (item.state === "completed")
        return { photoId: item.photo_id, duplicate: true };
      if (Number(item.size) !== Number(item.offset_bytes))
        fail(409, "Upload is incomplete");
      const file = mediaPath("temporary", item.id);
      const type = await validateFile(file);
      const sha = await digest(file);
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [sha]);
      const duplicate = (
        await c.query("SELECT id,deleted_at FROM photos WHERE sha256=$1", [sha])
      ).rows[0];
      let id = duplicate?.id;
      if (duplicate?.deleted_at)
        fail(409, "This photo is in Trash. Restore it before uploading again.");
      if (!id) {
        id = randomUUID();
        await c.query(
          "INSERT INTO photos(id,filename,mime,sha256,size,capture_local,uploader) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            item.filename,
            type.mime,
            sha,
            item.size,
            new Date().toISOString().slice(0, 19),
            req.user.id,
          ],
        );
        await fs.copyFile(file, mediaPath("originals", id), 1);
        await c.query(
          "INSERT INTO processing_jobs(id,photo_id) VALUES($1,$2)",
          [randomUUID(), id],
        );
      }
      await c.query(
        "UPDATE upload_sessions SET state='completed',photo_id=$2 WHERE id=$1",
        [item.id, id],
      );
      return { photoId: id, duplicate: !!duplicate };
    });
    await fs.unlink(mediaPath("temporary", req.params.id)).catch(() => {});
    res.json(result);
  });
  app.delete("/api/uploads/:id", async (req, res) => {
    const result = await q(
      "DELETE FROM upload_sessions WHERE id=$1 AND user_id=$2 AND state='uploading' RETURNING id",
      [req.params.id, req.user.id],
    );
    if (result.rowCount)
      await fs.unlink(mediaPath("temporary", req.params.id)).catch(() => {});
    res.json({ ok: true });
  });
}
