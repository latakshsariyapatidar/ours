import assert from "node:assert/strict";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:18080";
let cookie = "",
  csrf = "";
async function call(url, method = "GET", body, headers = {}) {
  const r = await fetch(base + "/api" + url, {
    method,
    headers: {
      Cookie: cookie,
      "X-CSRF-Token": csrf,
      "Content-Type": "application/json",
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : Buffer.isBuffer(body)
          ? body
          : JSON.stringify(body),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  const d = (r.headers.get("content-type") || "").includes("json")
    ? await r.json()
    : Buffer.from(await r.arrayBuffer());
  if (d.csrf) csrf = d.csrf;
  return { status: r.status, data: d };
}
assert.equal(
  (
    await call("/auth/login", "POST", {
      email: "owner@ours.test",
      password: "ours-integration-password-2026",
    })
  ).status,
  200,
);
const results = [];
async function ready(id) {
  for (let i = 0; i < 80; i++) {
    const p = (await call("/photos/" + id)).data;
    if (p.status === "ready" || p.status === "failed") return p;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Processing timeout");
}
async function upload(bytes, name) {
  const u = await call("/uploads", "POST", {
    filename: name,
    size: bytes.length,
  });
  assert.equal(u.status, 201, JSON.stringify(u));
  for (let off = 0; off < bytes.length; off += 1048576) {
    const chunk = bytes.subarray(off, off + 1048576);
    assert.equal(
      (
        await call("/uploads/" + u.data.id, "PATCH", chunk, {
          "Content-Type": "application/octet-stream",
          "Upload-Offset": String(off),
        })
      ).status,
      200,
    );
  }
  const done = await call("/uploads/" + u.data.id + "/complete", "POST");
  assert.equal(done.status, 200, JSON.stringify(done));
  return done.data.photoId;
}
const input = await sharp({
  create: { width: 100, height: 60, channels: 3, background: "#315a78" },
})
  .withMetadata({ orientation: 6 })
  .jpeg()
  .toBuffer();
const id = await upload(input, "orientation.jpg");
const oriented = await ready(id);
assert.equal(oriented.width, 60);
assert.equal(oriented.height, 100);
const preview = await call(`/media/${id}/preview`);
const pm = await sharp(preview.data).metadata();
assert.equal(pm.width, 60);
assert.equal(pm.height, 100);
assert.equal(pm.exif, undefined);
assert.deepEqual((await call(`/media/${id}/original`)).data, input);
results.push("EXIF orientation and stripped preview");
const chunks = await call("/uploads", "POST", {
  filename: "resume.jpg",
  size: input.length,
});
const first = input.subarray(0, 100);
assert.equal(
  (
    await call(`/uploads/${chunks.data.id}`, "PATCH", first, {
      "Content-Type": "application/octet-stream",
      "Upload-Offset": "0",
    })
  ).status,
  200,
);
assert.equal(
  (
    await call(`/uploads/${chunks.data.id}`, "PATCH", first, {
      "Content-Type": "application/octet-stream",
      "Upload-Offset": "0",
    })
  ).status,
  409,
);
assert.equal(
  (await call(`/uploads/${chunks.data.id}/complete`, "POST")).status,
  409,
);
assert.equal(
  Number((await call(`/uploads/${chunks.data.id}`)).data.offset_bytes),
  100,
);
assert.equal(
  (
    await call(`/uploads/${chunks.data.id}`, "PATCH", input.subarray(100), {
      "Content-Type": "application/octet-stream",
      "Upload-Offset": "100",
    })
  ).status,
  200,
);
assert.equal(
  (await call(`/uploads/${chunks.data.id}/complete`, "POST")).data.photoId,
  id,
);
results.push(
  "Interrupted/resumed chunks, replay rejection, completion idempotency",
);
assert.equal(
  (await call("/uploads", "POST", { filename: "huge.jpg", size: 999999999 }))
    .status,
  400,
);
assert.equal(
  (
    await call(
      "/photos/" + id,
      "PATCH",
      { featured: true },
      { Origin: "https://malicious.example" },
    )
  ).status,
  403,
);
assert.equal((await call("/media/%2e%2e%2fetc%2fpasswd/original")).status, 400);
results.push("Oversized files, foreign origin and path traversal blocked");
const dc = (args) =>
  execFileSync(
    "docker",
    [
      "compose",
      "-p",
      "ours-test",
      "-f",
      "compose.yaml",
      "-f",
      "compose.test.yaml",
      "exec",
      "-T",
      "api",
      ...args,
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
dc([
  "node",
  "--input-type=module",
  "-e",
  "import sharp from 'sharp';await sharp({create:{width:96,height:64,channels:3,background:'#789abc'}}).png().toFile('/tmp/ours-codec-test.png');",
]);
dc([
  "heif-enc",
  "-p",
  "x265:pools=1",
  "-p",
  "x265:frame-threads=1",
  "/tmp/ours-codec-test.png",
  "-o",
  "/tmp/ours-codec-test.heic",
]);
const heic = dc(["cat", "/tmp/ours-codec-test.heic"]);
const heicId = await upload(heic, "phone.heic");
assert.equal((await ready(heicId)).status, "ready");
assert.deepEqual((await call(`/media/${heicId}/original`)).data, heic);
results.push("Real HEIC encode/upload/decode and exact preservation");
for (const format of ["png", "webp", "avif", "gif"]) {
  const data = await sharp({
    create: { width: 48, height: 64, channels: 3, background: "#6b9a88" },
  })
    .toFormat(format)
    .toBuffer();
  const photoId = await upload(data, "format." + format);
  assert.equal((await ready(photoId)).status, "ready");
  assert.deepEqual((await call(`/media/${photoId}/original`)).data, data);
}
results.push("PNG, WebP, AVIF and GIF actual codec round trips");
const large = await sharp({
  create: { width: 6000, height: 4000, channels: 3, background: "#875c7e" },
})
  .jpeg()
  .toBuffer();
const largeId = await upload(large, "24-megapixel.jpg");
assert.equal((await ready(largeId)).status, "ready");
results.push("24-megapixel image under container memory limit");
const broken = input.subarray(0, 80);
const brokenId = await upload(broken, "corrupted.jpg");
assert.equal((await ready(brokenId)).status, "failed");
assert.deepEqual((await call(`/media/${brokenId}/original`)).data, broken);
results.push(
  "Corrupt JPEG fails visibly after bounded retry; original remains downloadable",
);
const peak = Number(
  dc(["cat", "/sys/fs/cgroup/memory.peak"]).toString().trim(),
);
const current = Number(
  dc(["cat", "/sys/fs/cgroup/memory.current"]).toString().trim(),
);
await fs.mkdir("evidence", { recursive: true });
await fs.writeFile(
  "evidence/edge-cases.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      passed: results,
      apiPeakBytes: peak,
      apiCurrentBytes: current,
      apiLimitBytes: 384 * 1024 * 1024,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { passed: results, apiPeakMiB: Math.round(peak / 1048576) },
    null,
    2,
  ),
);
