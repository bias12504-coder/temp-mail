const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = (process.env.MAIL_DOMAIN || "gmail.com").toLowerCase();
const MAILGUN_SIGNING_KEY = process.env.MAILGUN_SIGNING_KEY || "";
const TTL_HOURS = Number(process.env.TTL_HOURS || 24);
const MAX_INBOXES = Number(process.env.MAX_INBOXES || 1000);
const MAX_MESSAGES_PER_INBOX = Number(process.env.MAX_MESSAGES_PER_INBOX || 50);

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, "data.json");

function load() {
  try { return JSON.parse(fs.readFileSync(dbFile, "utf8")); }
  catch { return { inboxes: {} }; }
}
let db = load();

function save() {
  const tmp = dbFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, dbFile);
}

function cleanup() {
  const now = Date.now();
  for (const [id, box] of Object.entries(db.inboxes)) {
    if (box.expiresAt <= now) delete db.inboxes[id];
    else box.messages = (box.messages || []).filter(m => now - m.receivedAt < TTL_HOURS * 3600000);
  }
  save();
}
setInterval(cleanup, 10 * 60 * 1000).unref();

function randomLocal() {
  const a = ["luna","bea","bia","nina","mimi","fairy","star","pink","cloud","angel","nova","dream"];
  const b = ["mail","box","love","sky","moon","heart","fox","cat","star","zone"];
  const n = crypto.randomInt(100, 9999);
  return `${a[crypto.randomInt(a.length)]}${b[crypto.randomInt(b.length)]}${n}`;
}
function token() { return crypto.randomBytes(18).toString("hex"); }

function findBoxByAddress(address) {
  const a = String(address || "").toLowerCase().trim();
  return Object.values(db.inboxes).find(x => x.address === a);
}

function safeText(v) {
  return String(v || "").slice(0, 100000);
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/inboxes", (req, res) => {
  cleanup();
  if (Object.keys(db.inboxes).length >= MAX_INBOXES) {
    return res.status(503).json({ error: "Limite de caixas atingido. Tente novamente mais tarde." });
  }

  let local = randomLocal();
  while (findBoxByAddress(`${local}@${DOMAIN}`)) local = randomLocal();

  const id = crypto.randomBytes(12).toString("hex");
  const accessToken = token();
  const now = Date.now();
  db.inboxes[id] = {
    id,
    address: `${local}@${DOMAIN}`,
    token: accessToken,
    createdAt: now,
    expiresAt: now + TTL_HOURS * 3600000,
    messages: []
  };
  save();

  res.json({
    id,
    address: db.inboxes[id].address,
    token: accessToken,
    expiresAt: db.inboxes[id].expiresAt
  });
});

app.get("/api/inboxes/:id", (req, res) => {
  const box = db.inboxes[req.params.id];
  if (!box || box.token !== req.query.token) return res.status(404).json({ error: "Caixa não encontrada." });
  res.json({
    address: box.address,
    expiresAt: box.expiresAt,
    messages: (box.messages || []).map(({ id, sender, from, subject, receivedAt, bodyPlain }) =>
      ({ id, sender, from, subject, receivedAt, bodyPlain }))
  });
});

app.delete("/api/inboxes/:id", (req, res) => {
  const box = db.inboxes[req.params.id];
  if (!box || box.token !== req.query.token) return res.status(404).json({ error: "Caixa não encontrada." });
  delete db.inboxes[req.params.id];
  save();
  res.json({ ok: true });
});

/*
  Mailgun inbound route:
  POST https://SEU-RAILWAY-DOMAIN/webhooks/mailgun
  Configure Mailgun Route:
  match_recipient(".*@SEU_DOMINIO")
  -> forward("https://SEU-RAILWAY-DOMINIO/webhooks/mailgun")
*/
app.post("/webhooks/mailgun", (req, res) => {
  if (MAILGUN_SIGNING_KEY) {
    const sig = req.body.signature || "";
    const timestamp = req.body.timestamp || "";
    const tokenValue = req.body.token || "";
    const expected = crypto
      .createHmac("sha256", MAILGUN_SIGNING_KEY)
      .update(timestamp + tokenValue)
      .digest("hex");
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.status(406).send("invalid signature");
    }
  }

  const recipient = String(req.body.recipient || "").toLowerCase().trim();
  const box = findBoxByAddress(recipient);
  if (!box) return res.status(406).send("unknown recipient");

  const message = {
    id: crypto.randomBytes(10).toString("hex"),
    sender: safeText(req.body.sender || req.body.from),
    from: safeText(req.body.from),
    subject: safeText(req.body.subject || "(sem assunto)"),
    bodyPlain: safeText(req.body["body-plain"]),
    bodyHtml: safeText(Array.isArray(req.body["body-html"]) ? req.body["body-html"].join("\n") : req.body["body-html"]),
    receivedAt: Date.now()
  };

  box.messages = box.messages || [];
  box.messages.unshift(message);
  box.messages = box.messages.slice(0, MAX_MESSAGES_PER_INBOX);
  save();
  res.sendStatus(200);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Temp Mail running on port ${PORT}; domain=${DOMAIN}`);
});
