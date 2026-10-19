import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
const base = process.env.TEST_URL || "http://localhost:8080";
function account() {
  let cookie = "",
    csrf = "";
  return {
    async call(path, method = "GET", body, headers = {}) {
      const res = await fetch(base + "/api" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-CSRF-Token": csrf,
          ...headers,
        },
        body:
          body === undefined
            ? undefined
            : Buffer.isBuffer(body)
              ? body
              : JSON.stringify(body),
      });
      if (res.headers.get("set-cookie"))
        cookie = res.headers.get("set-cookie").split(";")[0];
      const type = res.headers.get("content-type") || "";
      const data = type.includes("json")
        ? await res.json()
        : Buffer.from(await res.arrayBuffer());
      if (data.csrf) csrf = data.csrf;
      return { status: res.status, data };
    },
  };
}
test("full two-person photo and Studio lifecycle against a real stack", async () => {
  const a = account(),
    b = account(),
    anonymous = account();
  let state = await a.call("/auth/state");
  const suffix = Date.now();
  const ownerEmail = process.env.TEST_OWNER_EMAIL || "owner@ours.test",
    password = process.env.TEST_PASSWORD || "ours-integration-password-2026";
  if (state.data.setup) {
    const setup =
      process.env.SETUP_TOKEN ||
      execFileSync(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          "api",
          "node",
          "scripts/admin.js",
          "setup-token",
        ],
        { encoding: "utf8" },
      ).trim();
    assert.equal(
      (
        await a.call("/auth/setup", "POST", {
          token: setup,
          name: "Alex",
          email: ownerEmail,
          password,
        })
      ).status,
      201,
    );
    const invitation = await a.call("/invitations", "POST");
    assert.equal(invitation.status, 201);
    assert.equal(
      (
        await b.call("/auth/join", "POST", {
          token: invitation.data.token,
          name: "Sam",
          email: "partner@ours.test",
          password,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await anonymous.call("/auth/join", "POST", {
          token: invitation.data.token,
          name: "Third",
          email: "third@ours.test",
          password,
        })
      ).status,
      409,
    );
  } else {
    assert.equal(
      (await a.call("/auth/login", "POST", { email: ownerEmail, password }))
        .status,
      200,
    );
    assert.equal(
      (
        await b.call("/auth/login", "POST", {
          email: "partner@ours.test",
          password,
        })
      ).status,
      200,
    );
  }
  assert.equal((await anonymous.call("/photos")).status, 401);
  assert.equal(
    (
      await a.call(
        "/albums",
        "POST",
        { title: "Forbidden" },
        { "X-CSRF-Token": "bad" },
      )
    ).status,
    403,
  );
  const jpeg = await sharp({
    create: {
      width: 120,
      height: 160,
      channels: 3,
      background: { r: suffix % 255, g: 80, b: 100 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: { Make: "Ours test", Model: "Camera" },
      IFD2: {
        DateTimeOriginal: "2025:12:24 18:42:06",
        OffsetTimeOriginal: "+05:30",
      },
    })
    .toBuffer();
  async function upload(actor, buffer, name) {
    const u = await actor.call("/uploads", "POST", {
      filename: name,
      size: buffer.length,
    });
    assert.equal(u.status, 201);
    assert.equal(
      (
        await actor.call(`/uploads/${u.data.id}`, "PATCH", buffer, {
          "Content-Type": "application/octet-stream",
          "Upload-Offset": "0",
        })
      ).status,
      200,
    );
    return actor.call(`/uploads/${u.data.id}/complete`, "POST");
  }
  const simultaneous = await Promise.all([
    upload(a, jpeg, "../../memory.jpg"),
    upload(b, jpeg, "same-bytes.jpg"),
  ]);
  assert.equal(simultaneous[0].data.photoId, simultaneous[1].data.photoId);
  assert.equal(simultaneous.filter((r) => r.data.duplicate).length, 1);
  const id = simultaneous[0].data.photoId;
  let p;
  for (let i = 0; i < 50; i++) {
    p = (await a.call(`/photos/${id}`)).data;
    if (p.status === "ready") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(p.status, "ready");
  assert.equal(p.width, 120);
  assert.equal(p.capture_local, "2025-12-24T18:42:06");
  assert.equal(p.capture_offset, "+05:30");
  assert.equal((await anonymous.call(`/media/${id}/original`)).status, 401);
  assert.deepEqual((await a.call(`/media/${id}/original`)).data, jpeg);
  assert.equal((await a.call(`/media/${id}/thumbnail`)).status, 200);
  assert.equal(
    (await upload(a, Buffer.from("not a photograph"), "pretend.jpg")).status,
    415,
  );
  const album = (
    await a.call("/albums", "POST", { title: "Integration " + suffix })
  ).data;
  assert.equal(
    (await a.call(`/albums/${album.id}/photos`, "PUT", { ids: [id] })).status,
    200,
  );
  assert.equal(
    (await b.call(`/photos?album=${album.id}`)).data.items.length,
    1,
  );
  await a.call(`/albums/${album.id}`, "DELETE");
  assert.equal((await a.call(`/photos/${id}`)).status, 200);
  await a.call(`/photos/${id}/favorite`, "PUT", { favorite: true });
  await b.call(`/photos/${id}/favorite`, "PUT", { favorite: true });
  assert.ok(
    (await a.call("/photos?favorite=both")).data.items.some((p) => p.id === id),
  );
  const d = (
    await a.call("/drafts", "POST", { title: "Our test story " + suffix })
  ).data;
  await b.call(`/drafts/${d.id}/suggestions`, "POST", { ids: [id] });
  let body = {
    version: 1,
    title: d.title,
    notes: "",
    caption: "Our first story ♥",
    hashtags: "#ours",
    ratio: "4:5",
    fit: "contain",
    photos: [id],
    status: "final_review",
    post_url: "",
  };
  assert.equal((await a.call(`/drafts/${d.id}`, "PUT", body)).status, 200);
  assert.equal((await b.call(`/drafts/${d.id}`, "PUT", body)).status, 409);
  assert.equal((await a.call(`/drafts/${d.id}/exports`, "POST")).status, 409);
  assert.equal(
    (await a.call(`/drafts/${d.id}/approve`, "POST", { version: 2 })).status,
    200,
  );
  assert.equal(
    (await b.call(`/drafts/${d.id}/approve`, "POST", { version: 2 })).status,
    200,
  );
  const job = (await a.call(`/drafts/${d.id}/exports`, "POST")).data;
  let result;
  for (let i = 0; i < 40; i++) {
    result = (await a.call(`/exports/${job.id}`)).data;
    if (result.state === "completed" || result.state === "failed") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(result.state, "completed");
  const zip = await a.call(`/exports/${job.id}/download`);
  assert.equal(zip.status, 200);
  assert.equal(zip.data.subarray(0, 2).toString(), "PK");
  body = {
    ...body,
    version: 2,
    caption: "A changed caption",
    status: "final_review",
  };
  assert.equal((await a.call(`/drafts/${d.id}`, "PUT", body)).status, 200);
  assert.equal((await a.call(`/drafts/${d.id}`)).data.approvals.length, 0);
  assert.equal((await a.call(`/exports/${job.id}/download`)).status, 409);
  assert.equal((await a.call(`/photos/${id}`, "DELETE")).status, 200);
  assert.equal((await b.call(`/media/${id}/original`)).status, 404);
  assert.equal((await a.call(`/photos/${id}/restore`, "POST")).status, 200);
  assert.deepEqual((await b.call(`/media/${id}/original`)).data, jpeg);
  await a.call("/auth/logout", "POST");
  assert.equal((await a.call("/photos")).status, 401);
});
