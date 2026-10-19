import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { z } from "zod";
import archiver from "archiver";
import { q, tx } from "./db.js";
import { fail, validateOrder, materialChange, requireOwner } from "./core.js";
import { mediaPath, storage } from "./media.js";
const text = z.string().trim().max(5000);
const title = z.string().trim().min(1).max(160);
const ids = z.array(z.uuid()).max(100);
const max = Number(process.env.CAROUSEL_LIMIT || 20);
async function photo(id, trash = false) {
  const p = (
    await q(
      `SELECT * FROM photos WHERE id=$1 ${trash ? "" : "AND deleted_at IS NULL"}`,
      [id],
    )
  ).rows[0];
  if (!p) fail(404, "Photo not found");
  return p;
}
async function draft(id, c = { query: q }) {
  const d = (await c.query("SELECT * FROM studio_drafts WHERE id=$1", [id]))
    .rows[0];
  if (!d) fail(404, "Draft not found");
  return d;
}
export async function invalidatePhoto(c, id) {
  const drafts = (
    await c.query(
      "SELECT draft_id FROM studio_draft_photos WHERE photo_id=$1",
      [id],
    )
  ).rows;
  for (const row of drafts) {
    await c.query("DELETE FROM draft_approvals WHERE draft_id=$1", [
      row.draft_id,
    ]);
    await c.query(
      "UPDATE studio_drafts SET version=version+1,status=CASE WHEN status IN ('ready_to_post','final_review') THEN 'ready_to_curate' ELSE status END,updated_at=now() WHERE id=$1",
      [row.draft_id],
    );
  }
}
export async function purgePhoto(id) {
  await tx(async (c) => {
    await c.query("SELECT id FROM photos WHERE id=$1 FOR UPDATE", [id]);
    await invalidatePhoto(c, id);
    await c.query("DELETE FROM photos WHERE id=$1", [id]);
  });
  for (const kind of ["originals", "thumbnails", "previews"])
    await fs.unlink(mediaPath(kind, id)).catch(() => {});
}
export function routes(app) {
  app.get("/api/photos-download", async (req, res) => {
    const selected = ids.min(1).parse(String(req.query.ids || "").split(","));
    const list = [];
    for (const id of selected) list.push(await photo(id));
    res.attachment("ours-originals.zip");
    res.set("Cache-Control", "private, no-store");
    const archive = archiver("zip", { store: true });
    archive.on("error", () => res.destroy());
    res.on("close", () => archive.abort());
    archive.pipe(res);
    for (let i = 0; i < list.length; i++)
      archive.file(mediaPath("originals", list[i].id), {
        name: `${String(i + 1).padStart(2, "0")}-${list[i].filename.replace(/[\\/\r\n\x00-\x1f]/g, "_")}`,
      });
    await archive.finalize();
  });
  app.get("/api/photos", async (req, res) => {
    let params = [req.user.id];
    let where = [
      req.query.trash === "true"
        ? "p.deleted_at IS NOT NULL"
        : "p.deleted_at IS NULL",
    ];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };
    if (req.query.q)
      add("p.filename ILIKE '%'||?||'%'", String(req.query.q).slice(0, 200));
    if (req.query.album)
      add(
        "EXISTS(SELECT 1 FROM album_photos a WHERE a.photo_id=p.id AND a.album_id=?)",
        z.uuid().parse(req.query.album),
      );
    if (req.query.favorite === "mine")
      where.push(
        "EXISTS(SELECT 1 FROM favorites f WHERE f.photo_id=p.id AND f.user_id=$1)",
      );
    if (req.query.favorite === "partner")
      where.push(
        "EXISTS(SELECT 1 FROM favorites f WHERE f.photo_id=p.id AND f.user_id<>$1)",
      );
    if (req.query.favorite === "both")
      where.push("(SELECT count(*) FROM favorites f WHERE f.photo_id=p.id)=2");
    if (req.query.onThisDay === "true")
      where.push(
        "substring(p.capture_local,6,5)=to_char(now(),'MM-DD') AND substring(p.capture_local,1,4)<to_char(now(),'YYYY')",
      );
    if (req.query.new === "true")
      where.push(
        "p.uploader<>$1 AND NOT EXISTS(SELECT 1 FROM photo_views v WHERE v.photo_id=p.id AND v.user_id=$1)",
      );
    if (req.query.cursor) {
      let cursor;
      try {
        cursor = JSON.parse(
          Buffer.from(String(req.query.cursor), "base64url").toString(),
        );
      } catch {
        fail(400, "Invalid cursor");
      }
      const [date, id] = z.tuple([z.string().max(30), z.uuid()]).parse(cursor);
      params.push(date, id);
      where.push(
        `(p.capture_local,p.id)<($${params.length - 1},$${params.length})`,
      );
    }
    const result = (
      await q(
        `SELECT p.*,EXISTS(SELECT 1 FROM favorites f WHERE f.photo_id=p.id AND f.user_id=$1) AS favorite, (p.uploader<>$1 AND NOT EXISTS(SELECT 1 FROM photo_views v WHERE v.photo_id=p.id AND v.user_id=$1)) AS is_new FROM photos p WHERE ${where.join(" AND ")} ORDER BY p.capture_local DESC,p.id DESC LIMIT 49`,
        params,
      )
    ).rows;
    const more = result.length > 48;
    const items = result.slice(0, 48);
    res.json({
      items,
      next: more
        ? Buffer.from(
            JSON.stringify([items.at(-1).capture_local, items.at(-1).id]),
          ).toString("base64url")
        : null,
    });
  });
  app.get("/api/photos/:id", async (req, res) => {
    const p = await photo(req.params.id);
    const metadata =
      (await q("SELECT data FROM photo_metadata WHERE photo_id=$1", [p.id]))
        .rows[0]?.data || {};
    const comments = (
      await q(
        "SELECT c.*,u.name FROM photo_comments c JOIN users u ON u.id=c.user_id WHERE photo_id=$1 ORDER BY created_at",
        [p.id],
      )
    ).rows;
    await q(
      "INSERT INTO photo_views(user_id,photo_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, p.id],
    );
    res.json({ ...p, metadata, comments });
  });
  app.get("/api/media/:id/:kind", async (req, res) => {
    const p = await photo(
      req.params.id,
      req.params.kind === "thumbnail" && req.query.trash === "true",
    );
    const kinds = {
      original: "originals",
      thumbnail: "thumbnails",
      preview: "previews",
    };
    const kind = kinds[req.params.kind];
    if (!kind) fail(404, "Media not found");
    if (kind !== "originals" && p.status !== "ready")
      fail(409, "This photo is still processing");
    res.set("Cache-Control", "private, no-store");
    res.type(
      kind === "originals"
        ? p.mime
        : kind === "thumbnails"
          ? "image/webp"
          : "image/jpeg",
    );
    if (kind === "originals")
      res.attachment(p.filename.replace(/[\r\n/\\]/g, "_"));
    res.sendFile(mediaPath(kind, p.id), {}, (e) => {
      if (e && !res.headersSent)
        res.status(404).json({ error: "Media is unavailable" });
    });
  });
  app.patch("/api/photos/:id", async (req, res) => {
    await photo(req.params.id);
    const body = z
      .object({
        capture_local: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)
          .optional(),
        featured: z.boolean().optional(),
      })
      .parse(req.body);
    if (body.capture_local) {
      if (!Number.isFinite(Date.parse(body.capture_local)))
        fail(400, "Enter a valid date");
      await q(
        "UPDATE photos SET capture_local=$2,capture_source='corrected' WHERE id=$1",
        [req.params.id, body.capture_local],
      );
    }
    if (body.featured !== undefined)
      await q("UPDATE photos SET featured=$2 WHERE id=$1", [
        req.params.id,
        body.featured,
      ]);
    res.json({ ok: true });
  });
  app.put("/api/photos/:id/favorite", async (req, res) => {
    await photo(req.params.id);
    const body = z.object({ favorite: z.boolean() }).parse(req.body);
    if (body.favorite)
      await q(
        "INSERT INTO favorites(user_id,photo_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [req.user.id, req.params.id],
      );
    else
      await q("DELETE FROM favorites WHERE user_id=$1 AND photo_id=$2", [
        req.user.id,
        req.params.id,
      ]);
    res.json({ ok: true });
  });
  app.post("/api/photos/:id/comments", async (req, res) => {
    await photo(req.params.id);
    const body = z.object({ body: text.min(1) }).parse(req.body);
    res
      .status(201)
      .json(
        (
          await q(
            "INSERT INTO photo_comments(id,photo_id,user_id,body) VALUES($1,$2,$3,$4) RETURNING *",
            [randomUUID(), req.params.id, req.user.id, body.body],
          )
        ).rows[0],
      );
  });
  app.delete("/api/photos/:id", async (req, res) => {
    await photo(req.params.id);
    await tx(async (c) => {
      await invalidatePhoto(c, req.params.id);
      await c.query("UPDATE photos SET deleted_at=now() WHERE id=$1", [
        req.params.id,
      ]);
    });
    res.json({ ok: true });
  });
  app.post("/api/photos/:id/restore", async (req, res) => {
    await photo(req.params.id, true);
    await q("UPDATE photos SET deleted_at=NULL WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  });
  app.delete("/api/photos/:id/permanent", async (req, res) => {
    const p = await photo(req.params.id, true);
    if (!p.deleted_at) fail(409, "Move this photo to Trash first");
    await purgePhoto(p.id);
    res.json({ ok: true });
  });
  app.post("/api/photos/bulk-trash", async (req, res) => {
    const b = z.object({ ids: ids.min(1) }).parse(req.body);
    await tx(async (c) => {
      for (const id of b.ids) {
        await invalidatePhoto(c, id);
        await c.query(
          "UPDATE photos SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL",
          [id],
        );
      }
    });
    res.json({ ok: true, count: b.ids.length });
  });
  app.post("/api/photos/bulk-restore", async (req, res) => {
    const b = z.object({ ids: ids.min(1) }).parse(req.body);
    await q(
      "UPDATE photos SET deleted_at=NULL WHERE id=ANY($1::uuid[]) AND deleted_at IS NOT NULL",
      [b.ids],
    );
    res.json({ ok: true, count: b.ids.length });
  });
  app.post("/api/photos/bulk-permanent", async (req, res) => {
    const b = z.object({ ids: ids.min(1) }).parse(req.body);
    for (const id of b.ids) {
      const p = await photo(id, true);
      if (p.deleted_at) {
        await purgePhoto(p.id);
      }
    }
    res.json({ ok: true, count: b.ids.length });
  });
  app.post("/api/photos/:id/retry", async (req, res) => {
    await photo(req.params.id);
    await q(
      "UPDATE processing_jobs SET state='pending',attempts=0,error=NULL WHERE photo_id=$1 AND state='failed'",
      [req.params.id],
    );
    await q(
      "UPDATE photos SET status='pending',error=NULL WHERE id=$1 AND status='failed'",
      [req.params.id],
    );
    res.json({ ok: true });
  });
  app.get("/api/albums", async (req, res) =>
    res.json(
      (
        await q(
          "SELECT a.*,count(p.id)::int AS count,COALESCE((SELECT id FROM photos WHERE id=a.cover AND deleted_at IS NULL AND status='ready'),(array_agg(p.id ORDER BY p.capture_local DESC) FILTER(WHERE p.status='ready'))[1]) AS cover_id FROM albums a LEFT JOIN album_photos ap ON ap.album_id=a.id LEFT JOIN photos p ON p.id=ap.photo_id AND p.deleted_at IS NULL GROUP BY a.id ORDER BY a.created_at DESC",
        )
      ).rows,
    ),
  );
  app.post("/api/albums", async (req, res) => {
    const b = z
      .object({
        title,
        description: text.default(""),
        location: text.default(""),
        date: z.string().max(30).optional(),
      })
      .parse(req.body);
    res
      .status(201)
      .json(
        (
          await q(
            "INSERT INTO albums(id,title,description,location,date) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [randomUUID(), b.title, b.description, b.location, b.date],
          )
        ).rows[0],
      );
  });
  app.patch("/api/albums/:id", async (req, res) => {
    const b = z
      .object({
        title,
        description: text.default(""),
        location: text.default(""),
        date: z.string().max(30).nullable().optional(),
        cover: z.uuid().nullable().optional(),
      })
      .parse(req.body);
    if (b.cover) {
      await photo(b.cover);
      if (
        !(
          await q(
            "SELECT 1 FROM album_photos WHERE album_id=$1 AND photo_id=$2",
            [req.params.id, b.cover],
          )
        ).rowCount
      )
        fail(400, "Cover must belong to this album");
    }
    const result = await q(
      "UPDATE albums SET title=$2,description=$3,location=$4,date=$5,cover=$6 WHERE id=$1 RETURNING *",
      [req.params.id, b.title, b.description, b.location, b.date, b.cover],
    );
    if (!result.rowCount) fail(404, "Album not found");
    res.json(result.rows[0]);
  });
  app.put("/api/albums/:id/photos", async (req, res) => {
    const b = z
      .object({ ids, remove: z.boolean().default(false) })
      .parse(req.body);
    await tx(async (c) => {
      if (
        !(await c.query("SELECT 1 FROM albums WHERE id=$1", [req.params.id]))
          .rowCount
      )
        fail(404, "Album not found");
      for (const id of b.ids) {
        await photo(id);
        if (b.remove) {
          await c.query(
            "DELETE FROM album_photos WHERE album_id=$1 AND photo_id=$2",
            [req.params.id, id],
          );
          await c.query(
            "UPDATE albums SET cover=NULL WHERE id=$1 AND cover=$2",
            [req.params.id, id],
          );
        } else
          await c.query(
            "INSERT INTO album_photos(album_id,photo_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
            [req.params.id, id],
          );
      }
    });
    res.json({ ok: true });
  });
  app.delete("/api/albums/:id", async (req, res) => {
    await q("DELETE FROM albums WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  });
  app.get("/api/drafts", async (req, res) =>
    res.json(
      (
        await q(
          "SELECT d.*,(SELECT count(*)::int FROM studio_draft_photos p WHERE p.draft_id=d.id) AS count,(SELECT photo_id FROM studio_draft_photos p WHERE p.draft_id=d.id ORDER BY position LIMIT 1) AS cover FROM studio_drafts d ORDER BY updated_at DESC",
        )
      ).rows,
    ),
  );
  app.post("/api/drafts", async (req, res) => {
    const b = z.object({ title, notes: text.default("") }).parse(req.body);
    res
      .status(201)
      .json(
        (
          await q(
            "INSERT INTO studio_drafts(id,title,notes,creator) VALUES($1,$2,$3,$4) RETURNING *",
            [randomUUID(), b.title, b.notes, req.user.id],
          )
        ).rows[0],
      );
  });
  app.get("/api/drafts/:id", async (req, res) => {
    const d = await draft(req.params.id);
    const [photos, suggestions, comments, captions, songs, approvals] =
      await Promise.all([
        q(
          "SELECT p.*,dp.position FROM studio_draft_photos dp JOIN photos p ON p.id=dp.photo_id WHERE draft_id=$1 ORDER BY position",
          [d.id],
        ),
        q(
          "SELECT s.*,p.filename,p.status,p.deleted_at,u.name FROM studio_photo_suggestions s JOIN photos p ON p.id=s.photo_id JOIN users u ON u.id=s.user_id WHERE draft_id=$1 ORDER BY created_at",
          [d.id],
        ),
        q(
          "SELECT c.*,u.name FROM draft_comments c JOIN users u ON u.id=c.user_id WHERE draft_id=$1 ORDER BY created_at",
          [d.id],
        ),
        q(
          "SELECT c.*,u.name FROM caption_versions c JOIN users u ON u.id=c.user_id WHERE draft_id=$1 ORDER BY created_at DESC",
          [d.id],
        ),
        q(
          "SELECT s.*,u.name FROM song_suggestions s JOIN users u ON u.id=s.user_id WHERE draft_id=$1 ORDER BY created_at",
          [d.id],
        ),
        q(
          "SELECT a.*,u.name FROM draft_approvals a JOIN users u ON u.id=a.user_id WHERE draft_id=$1",
          [d.id],
        ),
      ]);
    res.json({
      ...d,
      photos: photos.rows,
      suggestions: suggestions.rows,
      comments: comments.rows,
      captions: captions.rows,
      songs: songs.rows,
      approvals: approvals.rows,
    });
  });
  app.put("/api/drafts/:id", async (req, res) => {
    const b = z
      .object({
        version: z.number().int(),
        title,
        notes: text,
        caption: text,
        hashtags: text,
        ratio: z.enum(["1:1", "4:5", "3:4", "1.91:1"]),
        fit: z.enum(["contain", "cover"]),
        photos: ids,
        status: z.enum([
          "collecting",
          "ready_to_curate",
          "final_review",
          "ready_to_post",
          "posted",
          "archived",
        ]),
        post_url: z
          .union([
            z.literal(""),
            z.url().regex(/^https:\/\/(www\.)?instagram\.com\//),
          ])
          .default(""),
      })
      .parse(req.body);
    validateOrder(b.photos, max);
    const result = await tx(async (c) => {
      await c.query("SELECT id FROM studio_drafts WHERE id=$1 FOR UPDATE", [
        req.params.id,
      ]);
      const d = await draft(req.params.id, c);
      if (d.version !== b.version)
        fail(
          409,
          "Your partner saved changes. Your edits are still here; reload and reconcile before saving.",
        );
      const oldIds = (
        await c.query(
          "SELECT photo_id FROM studio_draft_photos WHERE draft_id=$1 ORDER BY position",
          [d.id],
        )
      ).rows.map((p) => p.photo_id);
      for (const id of b.photos) {
        const p = await photo(id);
        if (p.status !== "ready")
          fail(409, "Wait for all selected photos to finish processing");
      }
      const material = materialChange(d, b, oldIds, b.photos);
      if (material)
        await c.query("DELETE FROM draft_approvals WHERE draft_id=$1", [d.id]);
      const approvals = Number(
        (
          await c.query(
            "SELECT count(*) FROM draft_approvals WHERE draft_id=$1",
            [d.id],
          )
        ).rows[0].count,
      );
      let status = b.status;
      if (material && ["ready_to_post", "posted"].includes(d.status))
        status = "ready_to_curate";
      if (
        ["ready_to_post", "posted"].includes(status) &&
        (approvals !== 2 || material)
      )
        fail(
          409,
          "Both of you must approve the current selection and caption first",
        );
      if (status === "final_review" && !b.photos.length)
        fail(400, "Choose at least one photo for final review");
      await c.query("DELETE FROM studio_draft_photos WHERE draft_id=$1", [
        d.id,
      ]);
      for (let i = 0; i < b.photos.length; i++)
        await c.query(
          "INSERT INTO studio_draft_photos(draft_id,photo_id,position) VALUES($1,$2,$3)",
          [d.id, b.photos[i], i],
        );
      if (d.caption !== b.caption && b.caption)
        await c.query(
          "INSERT INTO caption_versions(id,draft_id,user_id,body) VALUES($1,$2,$3,$4)",
          [randomUUID(), d.id, req.user.id, b.caption],
        );
      await c.query("UPDATE draft_approvals SET version=$2 WHERE draft_id=$1", [
        d.id,
        d.version + 1,
      ]);
      return (
        await c.query(
          "UPDATE studio_drafts SET title=$2,notes=$3,caption=$4,hashtags=$5,ratio=$6,fit=$7,status=$8,post_url=$9,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
          [
            d.id,
            b.title,
            b.notes,
            b.caption,
            b.hashtags,
            b.ratio,
            b.fit,
            status,
            b.post_url,
          ],
        )
      ).rows[0];
    });
    res.json(result);
  });
  app.post("/api/drafts/:id/suggestions", async (req, res) => {
    await draft(req.params.id);
    const b = z.object({ ids }).parse(req.body);
    await tx(async (c) => {
      for (const id of b.ids) {
        await photo(id);
        await c.query(
          "INSERT INTO studio_photo_suggestions(draft_id,photo_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [req.params.id, id, req.user.id],
        );
      }
    });
    res.json({ ok: true });
  });
  app.delete("/api/drafts/:id/suggestions/:photo", async (req, res) => {
    await q(
      "DELETE FROM studio_photo_suggestions WHERE draft_id=$1 AND photo_id=$2 AND user_id=$3",
      [req.params.id, req.params.photo, req.user.id],
    );
    res.json({ ok: true });
  });
  app.post("/api/drafts/:id/comments", async (req, res) => {
    await draft(req.params.id);
    const b = z
      .object({ body: text.min(1), photo_id: z.uuid().nullable().optional() })
      .parse(req.body);
    if (b.photo_id) await photo(b.photo_id);
    await q(
      "INSERT INTO draft_comments(id,draft_id,photo_id,user_id,body) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), req.params.id, b.photo_id, req.user.id, b.body],
    );
    res.status(201).json({ ok: true });
  });
  app.post("/api/drafts/:id/captions", async (req, res) => {
    await draft(req.params.id);
    const b = z.object({ body: text.min(1) }).parse(req.body);
    await q(
      "INSERT INTO caption_versions(id,draft_id,user_id,body) VALUES($1,$2,$3,$4)",
      [randomUUID(), req.params.id, req.user.id, b.body],
    );
    res.status(201).json({ ok: true });
  });
  app.post("/api/drafts/:id/songs", async (req, res) => {
    await draft(req.params.id);
    const b = z
      .object({
        title,
        artist: text.default(""),
        link: z
          .union([z.literal(""), z.url().regex(/^https:\/\//)])
          .default(""),
        notes: text.default(""),
      })
      .parse(req.body);
    await q(
      "INSERT INTO song_suggestions(id,draft_id,user_id,title,artist,link,notes) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        req.params.id,
        req.user.id,
        b.title,
        b.artist,
        b.link,
        b.notes,
      ],
    );
    res.status(201).json({ ok: true });
  });
  app.post("/api/drafts/:id/approve", async (req, res) => {
    const b = z.object({ version: z.number().int() }).parse(req.body);
    await tx(async (c) => {
      await c.query("SELECT id FROM studio_drafts WHERE id=$1 FOR UPDATE", [
        req.params.id,
      ]);
      const d = await draft(req.params.id, c);
      if (d.version !== b.version)
        fail(409, "Draft changed. Review the latest version first.");
      if (!["final_review", "ready_to_post"].includes(d.status))
        fail(409, "Move the draft to Final Review first");
      const p = (
        await c.query(
          "SELECT p.status,p.deleted_at FROM studio_draft_photos dp JOIN photos p ON p.id=dp.photo_id WHERE draft_id=$1",
          [d.id],
        )
      ).rows;
      if (!p.length || p.some((p) => p.deleted_at || p.status !== "ready"))
        fail(409, "All selected photos must be available");
      await c.query(
        "INSERT INTO draft_approvals(draft_id,user_id,version) VALUES($1,$2,$3) ON CONFLICT(draft_id,user_id) DO UPDATE SET version=$3,created_at=now()",
        [d.id, req.user.id, d.version],
      );
      if (
        Number(
          (
            await c.query(
              "SELECT count(*) FROM draft_approvals WHERE draft_id=$1",
              [d.id],
            )
          ).rows[0].count,
        ) === 2
      )
        await c.query(
          "UPDATE studio_drafts SET status='ready_to_post' WHERE id=$1",
          [d.id],
        );
    });
    res.json({ ok: true });
  });
  app.post("/api/drafts/:id/exports", async (req, res) => {
    const d = await draft(req.params.id);
    if (!["ready_to_post", "posted"].includes(d.status))
      fail(409, "Both of you must approve before exporting");
    const existing = (
      await q(
        "SELECT * FROM export_jobs WHERE draft_id=$1 AND version=$2 AND state IN ('pending','processing','completed') ORDER BY created_at DESC LIMIT 1",
        [d.id, d.version],
      )
    ).rows[0];
    if (existing) return res.json(existing);
    const job = (
      await q(
        "INSERT INTO export_jobs(id,draft_id,version) VALUES($1,$2,$3) RETURNING *",
        [randomUUID(), d.id, d.version],
      )
    ).rows[0];
    res.status(202).json(job);
  });
  app.get("/api/exports/:id", async (req, res) => {
    const job = (
      await q("SELECT * FROM export_jobs WHERE id=$1", [req.params.id])
    ).rows[0];
    if (!job) fail(404, "Export not found");
    res.json(job);
  });
  app.get("/api/exports/:id/download", async (req, res) => {
    const job = (
      await q(
        "SELECT e.* FROM export_jobs e JOIN studio_drafts d ON d.id=e.draft_id WHERE e.id=$1 AND e.version=d.version AND d.status IN ('ready_to_post','posted')",
        [req.params.id],
      )
    ).rows[0];
    if (!job || job.state !== "completed")
      fail(409, "Export is unavailable or the draft has changed");
    res.download(mediaPath("exports", job.id), "ours-carousel.zip");
  });
  app.get("/api/system", async (req, res) =>
    res.json({
      storage: await storage(),
      jobs: (
        await q(
          "SELECT state,count(*)::int FROM processing_jobs GROUP BY state",
        )
      ).rows,
      trashDays: Number(process.env.TRASH_DAYS || 30),
      maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 52428800),
      carouselLimit: max,
    }),
  );
  app.put("/api/settings", async (req, res) => {
    requireOwner(req.user);
    const b = z.object({ name: title }).parse(req.body);
    await q(
      "INSERT INTO application_settings(key,value) VALUES('name',$1) ON CONFLICT(key) DO UPDATE SET value=$1",
      [JSON.stringify(b.name)],
    );
    res.json({ ok: true });
  });
}
