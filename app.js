const $ = (id) => document.getElementById(id);
const welcome = $("welcome");
const messagesEl = $("messages");
const input = $("messageInput");
const sendBtn = $("sendBtn");
const historyList = $("historyList");
const sidebar = $("sidebar");
const STORAGE_KEY = "neon-ai-chats-v1";

let chats = [];
let activeChatId = null;
let busy = false;
let config = { model: "AI model", dailyLimit: 100 };
let usage = { used: 0, dailyLimit: 100, remaining: 100 };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function showToast(text) {
  const toast = $("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3500);
}
function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    chats = Array.isArray(saved) ? saved.filter(c => c && c.id && Array.isArray(c.messages)) : [];
  } catch { chats = []; }
}
function saveChats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 50))); }
  catch { showToast("Penyimpanan penuh. Hapus sebagian riwayat chat."); }
}
function activeChat() { return chats.find(c => c.id === activeChatId); }
function makeChat() {
  const chat = { id: uid(), title: "Chat baru", messages: [], updatedAt: Date.now() };
  chats.unshift(chat);
  activeChatId = chat.id;
  saveChats(); renderHistory(); renderChat();
  input.focus();
}
function renderHistory() {
  historyList.innerHTML = "";
  [...chats].sort((a,b) => b.updatedAt - a.updatedAt).forEach(chat => {
    const btn = document.createElement("button");
    btn.className = "history-item" + (chat.id === activeChatId ? " active" : "");
    btn.innerHTML = `<span class="history-icon">◈</span><span>${escapeText(chat.title || "Chat baru")}</span>`;
    btn.title = chat.title || "Chat baru";
    btn.addEventListener("click", () => {
      activeChatId = chat.id; renderHistory(); renderChat(); sidebar.classList.remove("open");
    });
    historyList.appendChild(btn);
  });
}
function renderChat() {
  const chat = activeChat();
  const hasMessages = Boolean(chat && chat.messages.length);
  welcome.style.display = hasMessages ? "none" : "block";
  messagesEl.classList.toggle("visible", hasMessages);
  messagesEl.innerHTML = "";
  if (!chat) return;
  chat.messages.forEach(m => appendMessage(m.role, m.content));
  scrollBottom();
}
function appendMessage(role, content, extraClass = "") {
  messagesEl.classList.add("visible");
  const row = document.createElement("div");
  row.className = `message ${role === "user" ? "user" : "assistant"}`;
  const avatar = role === "user" ? "U" : "✦";
  row.innerHTML = `<div class="message-avatar">${avatar}</div><div class="bubble ${extraClass}">${escapeText(content)}</div>`;
  messagesEl.appendChild(row);
  scrollBottom();
  return row;
}
function showTyping() {
  const row = document.createElement("div");
  row.className = "message assistant";
  row.id = "typingRow";
  row.innerHTML = `<div class="message-avatar">✦</div><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>`;
  messagesEl.appendChild(row); scrollBottom();
}
function scrollBottom() {
  requestAnimationFrame(() => { $("chatArea").scrollTop = $("chatArea").scrollHeight; });
}
function updateUsage(data) {
  if (data) usage = { ...usage, ...data };
  const limit = Number(usage.dailyLimit ?? config.dailyLimit ?? 0);
  $("usageText").textContent = limit > 0 ? `${usage.used || 0}/${limit}` : `${usage.used || 0}/∞`;
  const pct = limit > 0 ? Math.min(100, (Number(usage.used || 0) / limit) * 100) : 0;
  $("usageBar").style.width = `${pct}%`;
}
async function refreshConfig() {
  try {
    const [c, u] = await Promise.all([fetch("/api/config"), fetch("/api/usage")]);
    if (!c.ok || !u.ok) throw new Error("Tidak dapat membaca konfigurasi server.");
    config = await c.json(); usage = await u.json();
    $("modelLabel").textContent = config.model || "Model AI";
    $("connectionLabel").textContent = config.providerConfigured ? "Server AI siap" : "API key belum diatur";
    const dot = document.querySelector(".status-row .status-dot");
    dot.style.background = config.providerConfigured ? "#52e7ba" : "#ffbd69";
    dot.style.boxShadow = config.providerConfigured ? "0 0 10px #52e7ba88" : "0 0 10px #ffbd6988";
    updateUsage(usage);
    if (!config.providerConfigured) showToast("Isi AI_API_KEY di file .env agar chat AI bisa digunakan.");
  } catch {
    $("connectionLabel").textContent = "Server tidak terhubung";
    showToast("Server belum merespons. Pastikan npm start sedang berjalan.");
  }
}
function resizeInput() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 150) + "px"; }
async function sendMessage(text = input.value) {
  text = String(text).trim();
  if (!text || busy) return;
  if (!activeChat()) makeChat();
  const chat = activeChat();
  chat.messages.push({ role: "user", content: text });
  if (chat.messages.filter(m => m.role === "user").length === 1) chat.title = text.slice(0, 38) + (text.length > 38 ? "…" : "");
  chat.updatedAt = Date.now();
  saveChats(); renderHistory();
  welcome.style.display = "none";
  messagesEl.classList.add("visible");
  appendMessage("user", text);
  input.value = ""; resizeInput();
  busy = true; sendBtn.disabled = true; showTyping();
  try {
    const context = chat.messages.slice(-40).map(({role, content}) => ({role, content}));
    const response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: context })
    });
    const data = await response.json().catch(() => ({}));
    $("typingRow")?.remove();
    if (!response.ok) {
      appendMessage("assistant", data.error || `Permintaan gagal (${response.status}).`, "error");
      return;
    }
    chat.messages.push({ role: "assistant", content: data.answer });
    chat.updatedAt = Date.now();
    saveChats(); renderHistory();
    appendMessage("assistant", data.answer);
    updateUsage(data.usage);
  } catch (err) {
    $("typingRow")?.remove();
    appendMessage("assistant", `Tidak bisa menghubungi server. Periksa koneksi dan coba lagi. (${err.message})`, "error");
  } finally {
    busy = false; sendBtn.disabled = false; input.focus();
    refreshConfig();
  }
}
sendBtn.addEventListener("click", () => sendMessage());
input.addEventListener("input", resizeInput);
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
$("newChat").addEventListener("click", () => { makeChat(); sidebar.classList.remove("open"); });
$("topNew").addEventListener("click", makeChat);
$("clearHistory").addEventListener("click", () => {
  if (!chats.length) return showToast("Riwayat chat sudah kosong.");
  if (!confirm("Hapus semua riwayat chat yang tersimpan di browser ini?")) return;
  chats = []; activeChatId = null; saveChats(); renderHistory(); renderChat(); showToast("Riwayat chat dihapus.");
});
$("openSidebar").addEventListener("click", () => sidebar.classList.add("open"));
$("closeSidebar").addEventListener("click", () => sidebar.classList.remove("open"));
document.querySelectorAll(".suggestion").forEach(btn => btn.addEventListener("click", () => sendMessage(btn.dataset.prompt)));
loadChats();
if (chats.length) {
  activeChatId = [...chats].sort((a,b) => b.updatedAt - a.updatedAt)[0].id;
  renderHistory(); renderChat();
} else {
  renderHistory(); welcome.style.display = "block"; messagesEl.classList.remove("visible");
}
refreshConfig();
