import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import exifr from "exifr";
import { fileTypeFromFile } from "file-type";
import archiver from "archiver";
import { q, tx, root } from "./db.js";
import { safePath, resolveDate, fail } from "./core.js";
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 16 });
const exec = promisify(execFile);
export const mediaPath = (kind, id) => safePath(root, kind, id);
export const maxPixels = Number(process.env.MAX_IMAGE_PIXELS || 60000000);
export async function digest(file) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
export async function validateFile(file) {
  const type = await fileTypeFromFile(file);
  if (
    !type ||
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/avif",
      "image/gif",
    ].includes(type.mime)
  )
    fail(415, "Choose a JPEG, PNG, WebP, HEIC, AVIF or GIF image");
  return type;
}
export async function imageInput(photo) {
  const file = mediaPath("originals", photo.id);
  if (["image/heic", "image/heif"].includes(photo.mime)) {
    const out = mediaPath("temporary", photo.id) + ".jpg";
    try {
      const info = await exec("heif-info", [file], {
        timeout: 10000,
        maxBuffer: 65536,
      });
      const dimensions = [...info.stdout.matchAll(/image:\s*(\d+)x(\d+)/g)];
      if (
        !dimensions.length ||
        dimensions.some((m) => Number(m[1]) * Number(m[2]) > maxPixels)
      )
        fail(422, "HEIC dimensions exceed the configured safe decoding limit");
      await exec("heif-convert", [file, out], {
        timeout: 60000,
        maxBuffer: 65536,
      });
      return { file: out, cleanup: () => fs.unlink(out).catch(() => {}) };
    } catch {
      await fs.unlink(out).catch(() => {});
      fail(422, "This HEIC image cannot be decoded by the installed codec");
    }
  }
  return { file, cleanup: async () => {} };
}
export async function processPhoto(photo) {
  const input = await imageInput(photo);
  try {
    const img = sharp(input.file, {
      limitInputPixels: maxPixels,
      failOn: "warning",
    }).timeout({ seconds: 60 });
    const info = await img.metadata();
    const metadata =
      (await exifr
        .parse(mediaPath("originals", photo.id), {
          translateValues: true,
          reviveValues: false,
          gps: true,
          tiff: true,
          exif: true,
          icc: true,
        })
        .catch(() => null)) || {};
    const date = resolveDate(metadata, new Date(photo.uploaded_at));
    await img
      .clone()
      .rotate()
      .resize({
        width: 480,
        height: 480,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 76 })
      .toFile(mediaPath("thumbnails", photo.id) + ".part");
    await img
      .clone()
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 86 })
      .toFile(mediaPath("previews", photo.id) + ".part");
    await fs.rename(
      mediaPath("thumbnails", photo.id) + ".part",
      mediaPath("thumbnails", photo.id),
    );
    await fs.rename(
      mediaPath("previews", photo.id) + ".part",
      mediaPath("previews", photo.id),
    );
    await tx(async (c) => {
      await c.query(
        "INSERT INTO photo_metadata(photo_id,data) VALUES($1,$2) ON CONFLICT(photo_id) DO UPDATE SET data=$2",
        [
          photo.id,
          JSON.stringify({
            ...metadata,
            format: info.format,
            colorSpace: info.space,
            orientation: info.orientation,
          }),
        ],
      );
      await c.query(
        "UPDATE photos SET width=$2,height=$3,capture_local=CASE WHEN capture_source='corrected' THEN capture_local ELSE $4 END,capture_source=CASE WHEN capture_source='corrected' THEN capture_source ELSE $5 END,capture_offset=$6,status='ready',error=NULL WHERE id=$1",
        [
          photo.id,
          info.autoOrient?.width || info.width,
          info.autoOrient?.height || info.height,
          date.local,
          date.source,
          date.offset,
        ],
      );
    });
  } finally {
    await input.cleanup();
  }
}
export async function makeExport(job) {
  const draft = (
    await q("SELECT * FROM studio_drafts WHERE id=$1", [job.draft_id])
  ).rows[0];
  if (!draft || draft.version !== job.version)
    fail(409, "Draft changed; request a new export");
  const photos = (
    await q(
      "SELECT p.* FROM studio_draft_photos d JOIN photos p ON p.id=d.photo_id WHERE d.draft_id=$1 AND p.deleted_at IS NULL AND p.status='ready' ORDER BY d.position",
      [draft.id],
    )
  ).rows;
  if (!photos.length) fail(400, "The draft has no available photos");
  const dir = mediaPath("temporary", job.id);
  await fs.mkdir(dir, { recursive: true });
  try {
    const sizes = {
      "1:1": [1080, 1080],
      "4:5": [1080, 1350],
      "3:4": [1080, 1440],
      "1.91:1": [1080, 566],
    };
    const [width, height] = sizes[draft.ratio];
    for (let i = 0; i < photos.length; i++) {
      const input = await imageInput(photos[i]);
      try {
        await sharp(input.file, { limitInputPixels: maxPixels })
          .rotate()
          .resize(width, height, { fit: draft.fit, background: "#ffffff" })
          .jpeg({ quality: 92 })
          .toFile(`${dir}/${String(i + 1).padStart(2, "0")}.jpg`);
      } finally {
        await input.cleanup();
      }
    }
    await fs.writeFile(
      `${dir}/caption.txt`,
      [draft.caption, draft.hashtags].filter(Boolean).join("\n\n"),
    );
    const archive = archiver("zip", { zlib: { level: 1 } });
    const completed = pipeline(
      archive,
      createWriteStream(mediaPath("exports", job.id) + ".part"),
    );
    archive.directory(dir, false);
    await archive.finalize();
    await completed;
    await fs.rename(
      mediaPath("exports", job.id) + ".part",
      mediaPath("exports", job.id),
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
export async function storage() {
  const stat = await fs.statfs(root);
  const sizes = {};
  for (const folder of [
    "originals",
    "thumbnails",
    "previews",
    "temporary",
    "exports",
  ]) {
    let size = 0;
    for (const f of await fs.readdir(`${root}/${folder}`, {
      withFileTypes: true,
    })) {
      if (f.isFile())
        size += (await fs.stat(`${root}/${folder}/${f.name}`)).size;
    }
    sizes[folder] = size;
  }
  return {
    capacity: stat.blocks * stat.bsize,
    available: stat.bavail * stat.bsize,
    ...sizes,
    database: Number(
      (await q("SELECT pg_database_size(current_database()) AS size")).rows[0]
        .size,
    ),
    reserve: Number(process.env.MIN_FREE_BYTES || 536870912),
  };
}
export async function ensureSpace(bytes) {
  const s = await fs.statfs(root);
  if (
    s.bavail * s.bsize <
    Number(process.env.MIN_FREE_BYTES || 536870912) + bytes * 3
  )
    fail(
      507,
      "Storage is nearly full. Back up and free space before uploading.",
    );
}
