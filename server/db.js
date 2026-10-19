import pg from "pg";
import fs from "node:fs/promises";
export const root = process.env.STORAGE_PATH || "./data";
const password =
  process.env.DB_PASSWORD ||
  (process.env.SECRETS_PATH
    ? await fs.readFile(`${process.env.SECRETS_PATH}/db-password`, "utf8")
    : undefined);
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "ours",
  user: process.env.DB_USER || "ours",
  password: password?.trim(),
  max: 4,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
});
export const q = (sql, args = []) => pool.query(sql, args);
export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function initialize() {
  for (const kind of [
    "originals",
    "thumbnails",
    "previews",
    "temporary",
    "exports",
    "config",
  ])
    await fs.mkdir(`${root}/${kind}`, { recursive: true, mode: 0o700 });
  await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(87234)");
    await c.query(
      await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
  });
}
