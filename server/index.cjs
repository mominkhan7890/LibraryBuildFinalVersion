// Express + SQLite local LAN server.
// Dev: API on :4000, Vite client on :8080 (proxies /api here).
// Prod: serves built SPA from dist/ and API on :PORT (default 4000).
const express = require("express");
const cors = require("cors");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const db = require("./db.cjs");

const PORT = Number(process.env.PORT || 4000);
const IS_PROD = process.env.NODE_ENV === "production";
const MASTER_RESET_PASSWORD = "ProSensiaResetLibrary@2026";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true, dbPath: db.dbPath }));

// KV API
app.get("/api/kv", (_req, res) => res.json(db.all()));
app.get("/api/kv/:key", (req, res) => {
  const v = db.get(req.params.key);
  if (v === null) return res.status(404).json({ error: "Not found" });
  res.json({ key: req.params.key, value: v });
});
app.post("/api/kv", (req, res) => {
  const { key, value } = req.body || {};
  if (typeof key !== "string" || typeof value !== "string") {
    return res.status(400).json({ error: "key and value must be strings" });
  }
  db.set(key, value);
  res.json({ ok: true });
});
app.delete("/api/kv/:key", (req, res) => {
  db.remove(req.params.key);
  res.json({ ok: true });
});

// Master reset
app.post("/api/admin/reset", (req, res) => {
  const { password } = req.body || {};
  if (password !== MASTER_RESET_PASSWORD) {
    return res.status(401).json({ error: "Invalid master password" });
  }
  db.wipe();
  res.json({ ok: true });
});

// Static + SPA fallback in production
const distDir = path.resolve(__dirname, "..", "dist");
if (IS_PROD && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === "IPv4" && !i.internal) out.push(i.address);
    }
  }
  return out;
}

app.listen(PORT, "0.0.0.0", () => {
  const banner =
    "\n  Prosensia LMS — local server\n" +
    `  ────────────────────────────\n` +
    `  Local:      http://localhost:${PORT}\n` +
    lanAddresses().map((ip) => `  Network:    http://${ip}:${PORT}`).join("\n") +
    `\n  SQLite DB:  ${db.dbPath}\n` +
    (IS_PROD
      ? "  Mode:       production (serving dist/)\n"
      : "  Mode:       development — start vite separately, or use `npm run dev`\n");
  console.log(banner);
});
