import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
export const token = () => randomBytes(32).toString("hex");
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export function safePath(root, kind, id) {
  if (
    !/^[0-9a-f-]{36}$/.test(id) ||
    !["originals", "thumbnails", "previews", "temporary", "exports"].includes(
      kind,
    )
  )
    fail(400, "Invalid storage identifier");
  return path.resolve(root, kind, id);
}
export function resolveDate(meta, fallback = new Date()) {
  for (const key of ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"]) {
    const raw = meta[key];
    if (!raw) continue;
    const value =
      raw instanceof Date
        ? Number.isFinite(raw.getTime())
          ? raw.toISOString().slice(0, 19)
          : ""
        : String(raw)
            .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
            .replace(" ", "T");
    if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) &&
      Number.isFinite(Date.parse(value.slice(0, 19) + "Z")) &&
      new Date(value.slice(0, 19) + "Z").toISOString().slice(0, 19) ===
        value.slice(0, 19) &&
      +value.slice(0, 4) >= 1800 &&
      +value.slice(0, 4) <= 2200
    )
      return {
        local: value.slice(0, 19),
        source: key,
        offset: validTimezone(
          meta.OffsetTimeOriginal || meta.OffsetTime || value.slice(19),
        ),
      };
  }
  return {
    local: fallback.toISOString().slice(0, 19),
    source: "upload",
    offset: "+00:00",
  };
}
function validTimezone(value) {
  if (value === "Z") return "+00:00";
  if (typeof value === "string" && /^[+-](0\d|1[0-4]):[0-5]\d$/.test(value))
    return value;
  return null;
}
export function validateOrder(ids, max) {
  if (
    !Array.isArray(ids) ||
    ids.length > max ||
    new Set(ids).size !== ids.length ||
    ids.some((x) => !/^[0-9a-f-]{36}$/.test(x))
  )
    fail(400, `Choose up to ${max} distinct photos`);
  return ids;
}
export function materialChange(old, next, oldIds, newIds) {
  return (
    ["caption", "hashtags", "ratio", "fit"].some((k) => old[k] !== next[k]) ||
    JSON.stringify(oldIds) !== JSON.stringify(newIds)
  );
}
export function requireOwner(user) {
  if (!user?.owner) fail(403, "Only the owner can do this");
}
export function validOffset(current, supplied, bytes, total) {
  if (current !== supplied)
    fail(409, "Upload offset changed; resume from the server offset");
  if (bytes < 1 || current + bytes > total)
    fail(400, "Chunk exceeds the expected file size");
  return current + bytes;
}
