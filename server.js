const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const requestLog = new Map();
const LEADS_FILE = process.env.COPE_LEADS_FILE || path.join(__dirname, "data", "leads.jsonl");
const PROMOS_FILE = process.env.COPE_PROMOS_FILE || path.join(__dirname, "data", "promos.jsonl");
const PROMO_CODE = String(process.env.COPE_PROMO_CODE || "COPEFREE7").trim();
const PROMO_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

function corsHeaders(res) {
  const allowedOrigin = process.env.COPE_ALLOWED_ORIGIN || "*";
  res.set({
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store"
  });
}

function send(res, status, payload) {
  corsHeaders(res);
  return res.status(status).json(payload);
}

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(forwarded || req.ip || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip);

  if (!entry || now >= entry.resetAt) {
    requestLog.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true };
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return false;

  return messages.every(message =>
    message &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length > 0 &&
    message.content.length <= 4000
  );
}

function validateLead(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";

  if (!name || name.length > 120) return null;
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (comment.length > 2000) return null;
  if (!/^[A-Za-z0-9._:-]{16,200}$/.test(deviceId)) return null;

  return { name, email, comment, deviceId, submittedAt: new Date().toISOString() };
}

function validateDeviceId(deviceId) {
  return typeof deviceId === "string" && /^[A-Za-z0-9._:-]{16,200}$/.test(deviceId.trim());
}

async function appendJsonLine(file, value) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.appendFile(file, JSON.stringify(value) + "\n", "utf8");
}

async function saveLead(lead) {
  await appendJsonLine(LEADS_FILE, lead);
}

async function savePromo(promo) {
  await appendJsonLine(PROMOS_FILE, promo);
}

async function findPromoByDevice(deviceId) {
  try {
    const text = await fs.promises.readFile(PROMOS_FILE, "utf8");
    const rows = text.split("\n").filter(Boolean);
    for (let i = rows.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(rows[i]);
        if (row.deviceId === deviceId) return row;
      } catch (_) {}
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return null;
}

async function activatePromo(deviceId, email) {
  const existing = await findPromoByDevice(deviceId);
  if (existing && Number(existing.expiresAt) > Date.now()) {
    return existing;
  }

  const activatedAt = Date.now();
  const promo = {
    deviceId,
    email,
    code: PROMO_CODE,
    activatedAt,
    expiresAt: activatedAt + PROMO_DURATION_MS,
    createdAt: new Date(activatedAt).toISOString()
  };
  await savePromo(promo);
  return promo;
}

async function callAnthropic(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error = new Error("Anthropic API is not configured on the server.");
    error.status = 500;
    throw error;
  }

  if (!validateMessages(body.messages)) {
    const error = new Error("Invalid conversation payload.");
    error.status = 400;
    throw error;
  }

  const requestBody = {
    model: process.env.COPE_MODEL || "claude-opus-4-8",
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 500, 1), 1000),
    messages: body.messages
  };

  if (typeof body.system === "string" && body.system.length <= 6000) {
    requestBody.system = body.system;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Anthropic API error:", response.status, data);
    const error = new Error("Cope AI could not respond right now.");
    error.status = 502;
    throw error;
  }

  return data;
}

app.options("/api/cope-ai", (req, res) => {
  corsHeaders(res);
  return res.status(204).end();
});

app.options("/api/lead", (req, res) => {
  corsHeaders(res);
  return res.status(204).end();
});

app.options("/api/access", (req, res) => {
  corsHeaders(res);
  return res.status(204).end();
});

app.get("/api/access", async (req, res) => {
  const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : "";
  if (!validateDeviceId(deviceId)) return send(res, 400, { error: "Invalid device identifier." });

  try {
    const promo = await findPromoByDevice(deviceId);
    const expiresAt = promo ? Number(promo.expiresAt) : 0;
    return send(res, 200, {
      active: expiresAt > Date.now(),
      expiresAt: expiresAt || null
    });
  } catch (error) {
    console.error("Access check error:", error);
    return send(res, 500, { error: "Access status could not be checked." });
  }
});

app.post("/api/cope-ai", async (req, res) => {
  const rate = checkRateLimit(getClientIP(req));
  if (!rate.allowed) {
    return send(res, 429, { error: "Too Many Requests", retryAfter: rate.retryAfter });
  }

  try {
    const result = await callAnthropic(req.body || {});
    return send(res, 200, result);
  } catch (error) {
    console.error("Cope AI error:", error);
    return send(res, error.status || 500, {
      error: error.message || "Cope AI is temporarily unavailable."
    });
  }
});

app.post("/api/lead", async (req, res) => {
  const rate = checkRateLimit(getClientIP(req));
  if (!rate.allowed) {
    return send(res, 429, { error: "Too Many Requests", retryAfter: rate.retryAfter });
  }

  const lead = validateLead(req.body || {});
  if (!lead) {
    return send(res, 400, { error: "Name, valid email, and a valid device identifier are required; comment is optional and limited to 2,000 characters." });
  }

  try {
    const existingPromo = await findPromoByDevice(lead.deviceId);
    const promo = await activatePromo(lead.deviceId, lead.email);
    if (!existingPromo) await saveLead(lead);

    return send(res, 201, {
      ok: true,
      promoCode: promo.code,
      activatedAt: promo.activatedAt,
      expiresAt: promo.expiresAt,
      durationDays: 7
    });
  } catch (error) {
    console.error("Lead/promo error:", error);
    return send(res, 500, { error: "Lead submission or promo activation could not be completed." });
  }
});

app.get("/health", (req, res) => {
  return res.status(200).json({ service: "cope-ai", status: "ok" });
});

app.use(express.static(__dirname, { extensions: ["html"] }));

app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(__dirname + "/index.html");
  }
  return send(res, 404, { error: "Not found." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cope / Toastid Cloud backend listening on port ${PORT}`);
});
