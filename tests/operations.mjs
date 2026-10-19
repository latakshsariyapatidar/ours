import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: "ours-test",
  COMPOSE_FILE:
    process.platform === "win32"
      ? "compose.yaml;compose.test.yaml"
      : "compose.yaml:compose.test.yaml",
  MSYS_NO_PATHCONV: "1",
};
const dc = (args, project = "ours-test") =>
  execFileSync("docker", ["compose", ...args], {
    env: {
      ...env,
      COMPOSE_PROJECT_NAME: project,
      TEST_PORT: project === "ours-restore" ? "18082" : "18080",
    },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
const sql =
  "SELECT json_build_object('users',(SELECT count(*) FROM users),'photos',(SELECT count(*) FROM photos),'albums',(SELECT count(*) FROM albums),'drafts',(SELECT count(*) FROM studio_drafts),'hashes',(SELECT string_agg(sha256,',' ORDER BY id) FROM photos))";
const snapshot = (project) =>
  dc(
    ["exec", "-T", "db", "psql", "-U", "ours", "-d", "ours", "-Atc", sql],
    project,
  ).trim();
const before = snapshot("ours-test");
assert.ok(JSON.parse(before).photos > 0);
console.log("Testing restart persistence");
dc(["restart", "api", "db"]);
dc(["up", "-d", "--wait"]);
assert.equal(snapshot("ours-test"), before);
await fs.mkdir("backups", { recursive: true });
const dest = path.resolve("backups", `restore-drill-${Date.now()}`);
const unixDest =
  process.platform === "win32"
    ? "/" + dest[0].toLowerCase() + dest.slice(2).replaceAll("\\", "/")
    : dest;
const bash =
  process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "sh";
console.log("Running actual backup script");
console.log(
  execFileSync(bash, ["scripts/backup.sh", unixDest], {
    env,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  }),
);
console.log("Running actual restore script into fresh ours-restore project");
console.log(
  execFileSync(bash, ["scripts/restore.sh", unixDest], {
    env: { ...env, COMPOSE_PROJECT_NAME: "ours-restore", TEST_PORT: "18082" },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  }),
);
dc(["up", "-d", "--wait"], "ours-restore");
assert.equal(snapshot("ours-restore"), before);
const base = "http://localhost:18082";
const login = await fetch(base + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "owner@ours.test",
    password: "ours-integration-password-2026",
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
const list = await (
  await fetch(base + "/api/photos", { headers: { Cookie: cookie } })
).json();
const first = list.items.find((p) => p.status === "ready");
assert.ok(first);
const original = await fetch(base + `/api/media/${first.id}/original`, {
  headers: { Cookie: cookie },
});
assert.equal(original.status, 200);
const { createHash } = await import("node:crypto");
assert.equal(
  createHash("sha256")
    .update(Buffer.from(await original.arrayBuffer()))
    .digest("hex"),
  first.sha256,
);
console.log(
  "PASS: restart persisted counts and hashes; backup manifest verified; fresh restore matches DB and exact original checksum.",
);
await fs.mkdir("evidence", { recursive: true });
await fs.writeFile(
  "evidence/restore.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      restart: true,
      backupChecksums: true,
      freshRestore: true,
      originalChecksum: true,
      counts: JSON.parse(before),
    },
    null,
    2,
  ),
);
