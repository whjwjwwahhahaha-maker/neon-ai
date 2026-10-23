require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.AI_API_KEY;
const BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const DAILY_LIMIT = Math.max(0, Number.parseInt(process.env.DAILY_MESSAGE_LIMIT || "100", 10));
const MAX_OUTPUT_TOKENS = Math.max(64, Number.parseInt(process.env.MAX_OUTPUT_TOKENS || "1200", 10));
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  "You are a helpful, honest AI assistant. Answer clearly and adapt to the user's language.";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const usage = new Map();
function usageFor(ip) {
  const day = new Date().toISOString().slice(0, 10);
  let record = usage.get(ip);
  if (!record || record.day !== day) {
    record = { day, count: 0 };
    usage.set(ip, record);
  }
  return record;
}
function clientIp(req) {
  // For deployment behind a trusted proxy, configure Express proxy trust appropriately.
  return req.ip || req.socket.remoteAddress || "unknown";
}

app.get("/api/config", (_req, res) => {
  res.json({
    model: MODEL,
    dailyLimit: DAILY_LIMIT,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    providerConfigured: Boolean(API_KEY && API_KEY !== "put_your_api_key_here")
  });
});

app.get("/api/usage", (req, res) => {
  const record = usageFor(clientIp(req));
  res.json({
    used: record.count,
    dailyLimit: DAILY_LIMIT,
    remaining: DAILY_LIMIT > 0 ? Math.max(0, DAILY_LIMIT - record.count) : null
  });
});

app.post("/api/chat", async (req, res) => {
  if (!API_KEY || API_KEY === "put_your_api_key_here") {
    return res.status(503).json({ error: "API belum dikonfigurasi. Isi AI_API_KEY di file .env, lalu restart server." });
  }

  const ip = clientIp(req);
  const record = usageFor(ip);
  if (DAILY_LIMIT > 0 && record.count >= DAILY_LIMIT) {
    return res.status(429).json({ error: `Batas penggunaan website tercapai (${DAILY_LIMIT} pesan per hari untuk alamat jaringan ini). Ubah DAILY_MESSAGE_LIMIT di .env jika diperlukan.` });
  }

  const messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return res.status(400).json({ error: "Format pesan tidak valid (maksimal 40 pesan konteks)." });
  }

  const cleanMessages = [];
  for (const message of messages) {
    if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") continue;
    const content = message.content.trim().slice(0, 12000);
    if (content) cleanMessages.push({ role: message.role, content });
  }
  if (!cleanMessages.length || cleanMessages[cleanMessages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Pesan terakhir harus berasal dari pengguna." });
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...cleanMessages],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = data?.error?.message || data?.message || `Provider API error (${response.status})`;
      return res.status(response.status === 429 ? 429 : 502).json({ error: providerMessage });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({ error: "Provider tidak mengembalikan teks jawaban. Periksa nama model dan kompatibilitas API." });
    }
    record.count += 1;
    res.json({
      answer: answer.trim(),
      model: data.model || MODEL,
      usage: {
        used: record.count,
        dailyLimit: DAILY_LIMIT,
        remaining: DAILY_LIMIT > 0 ? Math.max(0, DAILY_LIMIT - record.count) : null
      }
    });
  } catch (error) {
    res.status(502).json({ error: `Gagal menghubungi provider AI: ${error.message}` });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Neon AI berjalan di http://localhost:${PORT}`);
  if (!API_KEY || API_KEY === "put_your_api_key_here") {
    console.warn("API key belum diatur. Isi AI_API_KEY di .env.");
  }
});