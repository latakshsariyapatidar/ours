import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { initialize, q, pool } from "./db.js";
import { auth, csrf, protect, authRoutes, initToken } from "./auth.js";
import { uploadRoutes } from "./uploads.js";
import { routes } from "./routes.js";
import { recover, startWorker, stopWorker } from "./worker.js";
await initialize();
if (!(await q("SELECT 1 FROM users LIMIT 1")).rowCount) await initToken();
const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "blob:", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests:
          process.env.COOKIE_SECURE === "true" ? [] : null,
      },
    },
    strictTransportSecurity:
      process.env.COOKIE_SECURE === "true" ? undefined : false,
  }),
);
app.use((req, res, next) => {
  req.id = randomUUID();
  res.set("X-Request-ID", req.id);
  res.set("Cache-Control", "no-store");
  next();
});
app.get("/api/health", async (req, res) => {
  await q("SELECT 1");
  res.json({ ok: true });
});
app.use(cookieParser());
app.use(express.json({ limit: "128kb" }));
app.use(auth);
app.use("/api", csrf);
authRoutes(app);
app.use("/api", protect);
uploadRoutes(app);
routes(app);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use((e, req, res, next) => {
  if (res.headersSent) return next(e);
  const status =
    e instanceof ZodError
      ? 400
      : e.status || (["23505", "23503", "22P02"].includes(e.code) ? 400 : 500);
  const message =
    e instanceof ZodError
      ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : status < 500
        ? e.message
        : "The server could not finish this request. Please try again.";
  console.error(
    JSON.stringify({
      event: "request_error",
      requestId: req.id,
      status,
      code: e.code,
      message: status >= 500 ? e.message : undefined,
    }),
  );
  res.status(status).json({ error: message, requestId: req.id });
});
const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log(
    JSON.stringify({
      event: "listening",
      port: Number(process.env.PORT || 3000),
    }),
  ),
);
server.requestTimeout = 120000;
await recover();
startWorker();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    server.close();
    await stopWorker();
    await pool.end();
    process.exit(0);
  });
