import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveDate,
  safePath,
  validateOrder,
  materialChange,
  requireOwner,
  validOffset,
  hash,
} from "../server/core.js";
test("capture date preserves local wall clock and explicit offset", () => {
  assert.deepEqual(
    resolveDate({
      DateTimeOriginal: "2025:12:24 18:42:06",
      OffsetTimeOriginal: "+05:30",
    }),
    {
      local: "2025-12-24T18:42:06",
      source: "DateTimeOriginal",
      offset: "+05:30",
    },
  );
  assert.equal(
    resolveDate({ DateTimeOriginal: "2025:12:24 18:42:06" }).offset,
    null,
  );
});
test("invalid capture date falls back honestly", () => {
  assert.equal(
    resolveDate({ DateTimeOriginal: "2025:02:31 12:00:00" }).source,
    "upload",
  );
  assert.equal(
    resolveDate({ DateTimeOriginal: new Date("invalid") }).source,
    "upload",
  );
  assert.equal(
    resolveDate({ DateTimeOriginal: "bad" }, new Date("2026-01-01T00:00:00Z"))
      .source,
    "upload",
  );
  assert.equal(
    resolveDate({ CreateDate: "2025:10:01 12:00:00" }).source,
    "CreateDate",
  );
});
test("paths reject traversal and unsupported media classes", () => {
  assert.throws(() => safePath("/data", "originals", "../../etc/passwd"));
  assert.throws(() =>
    safePath("/data", "config", "00000000-0000-4000-8000-000000000000"),
  );
});
test("ordering rejects duplicates, unsafe IDs and oversized carousels", () => {
  const a = "00000000-0000-4000-8000-000000000000";
  assert.deepEqual(validateOrder([a], 20), [a]);
  assert.throws(() => validateOrder([a, a], 20));
  assert.throws(() => validateOrder(["../../x"], 20));
  assert.throws(() => validateOrder([a], 0));
});
test("material changes invalidate approvals; title and notes alone do not", () => {
  const old = {
    caption: "us",
    hashtags: "#us",
    ratio: "4:5",
    fit: "contain",
    title: "A",
  };
  assert.equal(
    materialChange(old, { ...old, title: "B" }, ["a"], ["a"]),
    false,
  );
  assert.equal(
    materialChange(old, { ...old, caption: "new" }, ["a"], ["a"]),
    true,
  );
  assert.equal(materialChange(old, old, ["a", "b"], ["b", "a"]), true);
  assert.equal(
    materialChange(old, { ...old, fit: "cover" }, ["a"], ["a"]),
    true,
  );
});
test("owner authorization denies missing and regular accounts", () => {
  assert.throws(() => requireOwner(null));
  assert.throws(() => requireOwner({ owner: false }));
  assert.doesNotThrow(() => requireOwner({ owner: true }));
});
test("upload offsets reject replay, overflow and empty chunks", () => {
  assert.equal(validOffset(10, 10, 5, 15), 15);
  assert.throws(() => validOffset(10, 0, 5, 15));
  assert.throws(() => validOffset(10, 10, 6, 15));
  assert.throws(() => validOffset(0, 0, 0, 15));
});
test("byte duplicates have equal SHA256 irrespective of filename", () => {
  assert.equal(hash(Buffer.from("ours")), hash(Buffer.from("ours")));
  assert.notEqual(hash("ours"), hash("ours!"));
});
