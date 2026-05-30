/**
 * Gemini API Proxy — Cloudflare Worker v3
 * Smart Key Manager + Daily Report + Instant Alerts
 */

import { sendTelegram, formatDailyReport, formatAlert } from "./telegram.js";
import { saveDailyReport, saveAlert, getRecentReports, getRecentAlerts, saveApiCall, getRecentApiCalls } from "./db.js";
import { getDashboardHtml } from "./dashboard.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKOFF_SCHEDULE    = [30, 60, 120, 300, 3600];
const CIRCUIT_BREAKER_THRESHOLD = 5;

// Daily quota per key — dựa trên free tier thực tế (worst-case ~250 RPD cho flash)
// Soft: cảnh báo sớm, Hard: ngắt key
const DAILY_QUOTA_SOFT   = 200;
const DAILY_QUOTA_HARD   = 240;

// Alert dedup TTL (giây) — không gửi cùng 1 loại alert trong khoảng này
const ALERT_COOLDOWN = {
  all_keys_down:   1800,  // 30 phút
  circuit_breaker: 3600,  // 1 giờ per key
  pool_critical:    900,  // 15 phút
};

// ─── Gemini Model Catalog (Free Tier — cập nhật 05/2026) ─────────────────────

const GEMINI_MODELS = [
  // ── 🌟 Featured / Latest Generation (Stable) ──
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    tier: "free",
    status: "stable",
    rpm: 15, rpd: 1500, tpm: 1_000_000,
    context_window: 1_048_576,
    note: "Latest flagship Flash model (Released May 2026). 4x faster than other frontier models with massive reasoning leap.",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    tier: "free",
    status: "stable",
    rpm: 15, rpd: 1500, tpm: 1_000_000,
    context_window: 1_048_576,
    note: "Generally Available (GA) as of May 2026. Highly optimized for speed, massive scale, and low cost.",
  },

  // ── 🛠️ Premium Reasoning & Stable Production ──
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    tier: "free",
    status: "stable",
    rpm: 10, rpd: 250, tpm: 250_000,
    context_window: 1_048_576,
    note: "Stable 2.5 generation daily driver. Supported until October 2026.",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    tier: "free",
    status: "stable",
    rpm: 15, rpd: 1000, tpm: 250_000,
    context_window: 1_048_576,
    note: "Stable cost-efficient model. Highly generous RPD on 2.5 generation.",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    tier: "free",
    status: "stable",
    rpm: 5, rpd: 100, tpm: 250_000,
    context_window: 1_048_576,
    note: "Premium reasoning stable workhorse for deep analysis. Low limits on free tier.",
  },

  // ── 🧪 Frontier Preview & Multimodal Specialized ──
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro (Preview)",
    tier: "free",
    status: "preview",
    rpm: 5, rpd: 100, tpm: 250_000,
    context_window: 1_048_576,
    note: "Google's most powerful reasoning model. Built for advanced coding agents and complex multi-step tasks.",
  },
  {
    id: "gemini-3.1-flash-live-preview",
    name: "Gemini 3.1 Flash Live (Preview)",
    tier: "free",
    status: "preview",
    rpm: 15, rpd: 1500, tpm: 1_000_000,
    context_window: 131_072,
    note: "Live API optimized for low-latency, real-time streaming audio-to-audio conversation.",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash (Preview)",
    tier: "free",
    status: "preview",
    rpm: 15, rpd: 1500, tpm: 1_000_000,
    context_window: 1_048_576,
    note: "Frontier performance at flash pricing. Free tier input/output preview snapshot.",
  },
  {
    id: "gemini-3.1-flash-image",
    name: "Gemini 3.1 Flash Image",
    tier: "free",
    status: "stable",
    rpm: 10, rpd: 500, tpm: null,
    context_window: null,
    note: "Optimized for pro-level generation and search-grounded image accuracy at Flash speed.",
  },

  // ── 🔄 Aliases (Dynamic routing to latest stable) ──
  {
    id: "gemini-flash-latest",
    name: "Gemini Flash (Latest Alias)",
    tier: "free",
    status: "alias",
    rpm: null, rpd: null, tpm: null,
    context_window: null,
    note: "Alias — resolves to the latest stable Flash model (currently gemini-3.5-flash).",
  },
  {
    id: "gemini-flash-lite-latest",
    name: "Gemini Flash Lite (Latest Alias)",
    tier: "free",
    status: "alias",
    rpm: null, rpd: null, tpm: null,
    context_window: null,
    note: "Alias — resolves to the latest stable Flash Lite model (currently gemini-3.1-flash-lite).",
  },

  // ── 🧠 Gemma Family (Open Source Weights — Generous Free Tier) ──
  {
    id: "gemma-4-31b-it",
    name: "Gemma 4 31B IT",
    tier: "free",
    status: "stable",
    rpm: 16, rpd: 1500, tpm: null,
    context_window: 262_144,
    note: "State-of-the-art open weights model. Excellent for local deployment, advanced reasoning, and coding.",
  },
  {
    id: "gemma-4-26b-a4b-it",
    name: "Gemma 4 26B A4B IT",
    tier: "free",
    status: "stable",
    rpm: 16, rpd: 1500, tpm: null,
    context_window: 262_144,
    note: "Architectural variant of Gemma 4 optimized for specific reasoning pipelines.",
  },
  {
    id: "gemma-3-27b",
    name: "Gemma 3 27B",
    tier: "free",
    status: "stable",
    rpm: 30, rpd: 14_400, tpm: null,
    context_window: 32_768,
    note: "Strongest Gemma 3 variant with massive 14,400 daily requests allocation.",
  },
  {
    id: "gemma-3-12b",
    name: "Gemma 3 12B",
    tier: "free",
    status: "stable",
    rpm: 30, rpd: 14_400, tpm: null,
    context_window: 32_768,
    note: "Perfect sweet spot between low-resource execution and conversational intelligence.",
  },

  // ── 🗺️ Embedding & Vector Matrix ──
  {
    id: "gemini-embedding-001",
    name: "Gemini Embedding 001",
    tier: "free",
    status: "stable",
    rpm: 5, rpd: 100, tpm: null,
    context_window: 2048,
    note: "Production stable retrieval model for semantic search and RAG mapping.",
  },
  {
    id: "gemini-embedding-2-preview",
    name: "Gemini Embedding 2 (Preview)",
    tier: "free",
    status: "preview",
    rpm: 10, rpd: 500, tpm: null,
    context_window: null,
    note: "Next-gen multimodal embedding engine. Maps text, images, video, audio, and PDFs into a unified space.",
  }
];

// Paid-only models (liệt kê để client biết mà tránh)
const PAID_ONLY_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
  "imagen-3",
  "imagen-4",
  "veo-2",
  "veo-3.1",
];

// ─── CORS ─────────────────────────────────────────────────────────────────────

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  const ok = allowed === "*" || origin === allowed;
  return {
    "Access-Control-Allow-Origin": ok ? (origin || "*") : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Proxy-Secret, x-goog-api-key, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── KV Helpers ───────────────────────────────────────────────────────────────

function defaultKeyState() {
  return {
    status: "active",
    cooldown_until: 0,
    backoff_level: 0,
    consecutive_failures: 0,
    requests_today: 0,
    stats_date: "",
    last_used: 0,
    total_success: 0,
    total_rate_limited: 0,
    total_errors: 0,
    model_states: {}, // modelId -> { status, cooldown_until, backoff_level }
  };
}

function todayVN() {
  // Vietnam UTC+7
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

async function getKeyState(kv, index) {
  try {
    const raw = await kv.get(`key_state:${index}`);
    if (!raw) return defaultKeyState();
    const state = { ...defaultKeyState(), ...JSON.parse(raw) };
    if (!state.model_states) {
      state.model_states = {};
    }
    // Reset daily counter nếu sang ngày mới (VN time)
    const today = todayVN();
    if (state.stats_date !== today) {
      state.requests_today = 0;
      state.stats_date = today;
    }
    return state;
  } catch {
    return defaultKeyState();
  }
}

async function setKeyState(kv, index, state) {
  try {
    await kv.put(`key_state:${index}`, JSON.stringify(state), {
      expirationTtl: 86400 * 7,
    });
  } catch (e) {
    console.error(`KV write key_state:${index}:`, e.message);
  }
}

// ─── Alert Dedup ──────────────────────────────────────────────────────────────

async function shouldSendAlert(kv, alertType) {
  try {
    const val = await kv.get(`alert_sent:${alertType}`);
    return val === null; // null = belum pernah / sudah expire → boleh kirim
  } catch {
    return true;
  }
}

async function markAlertSent(kv, alertType) {
  const ttl = ALERT_COOLDOWN[alertType.split(":")[0]] || 1800;
  try {
    await kv.put(`alert_sent:${alertType}`, "1", { expirationTtl: ttl });
  } catch (e) {
    console.error(`KV markAlertSent ${alertType}:`, e.message);
  }
}

// ─── Alert Dispatcher ─────────────────────────────────────────────────────────

async function dispatchAlert(env, type, data) {
  const dedupKey = data.keyIndex !== undefined ? `${type}:${data.keyIndex}` : type;

  const canSend = await shouldSendAlert(env.KEY_STATE, dedupKey);
  if (!canSend) {
    console.log(`Alert ${dedupKey} suppressed (cooldown active)`);
    return;
  }

  const message = formatAlert(type, data);

  // Gửi Telegram
  const sent = await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message);

  // Lưu D1
  await saveAlert(env.DB, type, data.keyIndex ?? null, message, sent);

  // Đánh dấu đã gửi
  await markAlertSent(env.KEY_STATE, dedupKey);

  console.log(`Alert dispatched: ${dedupKey}, telegram: ${sent}`);
}

// ─── Key Pool ─────────────────────────────────────────────────────────────────

/**
 * Pure check — trả về true/false mà KHÔNG mutate state.
 * Dùng cho counting, summary, v.v.
 */
/**
 * Pure check — trả về true/false mà KHÔNG mutate state.
 * Dùng cho counting, summary, v.v.
 */
function isKeyAvailableCheck(state, modelId) {
  const now = Date.now();
  if (state.status === "dead") {
    if (now >= state.cooldown_until && state.cooldown_until > 0) {
      return true; // sẽ recover — nhưng không mutate ở đây
    }
    return false;
  }
  if (state.status === "cooling" && now < state.cooldown_until) return false;
  if (state.requests_today >= DAILY_QUOTA_HARD) return false;

  if (modelId && state.model_states && state.model_states[modelId]) {
    const ms = state.model_states[modelId];
    if (ms.status === "cooling" && now < ms.cooldown_until) {
      return false;
    }
  }
  return true;
}

/**
 * Check + mutate: recover key nếu hết cooldown.
 * Chỉ dùng trong selectKeys (nơi state sau đó được persist qua handleSuccess/handleRateLimit/handleError).
 */
function isKeyAvailable(state, modelId) {
  const now = Date.now();
  if (state.status === "dead") {
    if (now >= state.cooldown_until && state.cooldown_until > 0) {
      state.status = "active";
      state.consecutive_failures = 0;
      state.backoff_level = 0;
      state.model_states = {};
    } else {
      return false;
    }
  }
  if (state.status === "cooling" && now < state.cooldown_until) return false;
  if (state.status === "cooling" && now >= state.cooldown_until) state.status = "active";
  if (state.requests_today >= DAILY_QUOTA_HARD) return false;

  if (modelId && state.model_states && state.model_states[modelId]) {
    const ms = state.model_states[modelId];
    if (ms.status === "cooling" && now < ms.cooldown_until) {
      return false;
    }
    if (ms.status === "cooling" && now >= ms.cooldown_until) {
      ms.status = "active";
    }
  }
  return true;
}

function pressureScore(state, modelId) {
  const quotaRatio  = state.requests_today / DAILY_QUOTA_SOFT;
  const freshBonus  = (Date.now() - state.last_used) > 60000 ? -5 : 0;
  
  let modelBackoff = 0;
  if (modelId && state.model_states && state.model_states[modelId]) {
    modelBackoff = state.model_states[modelId].backoff_level || 0;
  }
  
  return quotaRatio * 100 + (state.backoff_level + modelBackoff) * 5 + freshBonus;
}

async function loadAllStates(env, keyCount) {
  const states = [];
  for (let i = 0; i < keyCount; i++) {
    const state = await getKeyState(env.KEY_STATE, i);
    states.push({ index: i, state });
  }
  return states;
}

async function selectKeys(env, keyCount, modelId) {
  const all = await loadAllStates(env, keyCount);
  const available = all.filter(({ state }) => isKeyAvailable(state, modelId));

  if (available.length === 0) {
    const cooling = all.filter(s => {
      if (s.state.status === "cooling" || s.state.status === "dead") return true;
      if (modelId && s.state.model_states?.[modelId]?.status === "cooling") return true;
      return false;
    });
    
    const soonestMs = cooling.reduce((min, s) => {
      let cooldowns = [];
      if (s.state.cooldown_until > 0) cooldowns.push(s.state.cooldown_until);
      if (modelId && s.state.model_states?.[modelId]?.cooldown_until > 0) {
        cooldowns.push(s.state.model_states[modelId].cooldown_until);
      }
      if (cooldowns.length === 0) return min;
      return Math.min(min, ...cooldowns);
    }, Infinity);

    return {
      keys: [],
      all,
      retryAfterMs: soonestMs === Infinity ? 60000 : Math.max(0, soonestMs - Date.now()),
    };
  }

  available.sort((a, b) => pressureScore(a.state, modelId) - pressureScore(b.state, modelId));
  return { keys: available, all, retryAfterMs: 0 };
}

// ─── State Updaters ───────────────────────────────────────────────────────────

async function handleSuccess(kv, index, state, modelId) {
  state.status = "active";
  state.consecutive_failures = 0;
  state.backoff_level = Math.max(0, state.backoff_level - 1);
  state.requests_today += 1;
  state.last_used = Date.now();
  state.total_success += 1;

  if (modelId) {
    if (!state.model_states) state.model_states = {};
    if (state.model_states[modelId]) {
      const ms = state.model_states[modelId];
      ms.status = "active";
      ms.cooldown_until = 0;
      ms.backoff_level = Math.max(0, ms.backoff_level - 1);
    }
  }

  await setKeyState(kv, index, state);
}

async function handleRateLimit(kv, index, state, retryAfterSec, modelId) {
  const now = Date.now();
  const backoffLevel = modelId ? (state.model_states?.[modelId]?.backoff_level || 0) : state.backoff_level;
  const backoffSec = BACKOFF_SCHEDULE[Math.min(backoffLevel, BACKOFF_SCHEDULE.length - 1)];
  const cooldownSec = Math.max(retryAfterSec || 0, backoffSec);
  const cooldownUntil = now + cooldownSec * 1000;

  if (modelId) {
    if (!state.model_states) state.model_states = {};
    if (!state.model_states[modelId]) {
      state.model_states[modelId] = { status: "active", cooldown_until: 0, backoff_level: 0 };
    }
    const ms = state.model_states[modelId];
    ms.status = "cooling";
    ms.cooldown_until = cooldownUntil;
    ms.backoff_level = Math.min(backoffLevel + 1, BACKOFF_SCHEDULE.length - 1);
    console.log(`Key ${index + 1} model ${modelId} cooling ${cooldownSec}s (backoff lv${ms.backoff_level})`);
  } else {
    state.status = "cooling";
    state.cooldown_until = cooldownUntil;
    state.backoff_level = Math.min(state.backoff_level + 1, BACKOFF_SCHEDULE.length - 1);
    console.log(`Key ${index + 1} cooling ${cooldownSec}s (backoff lv${state.backoff_level})`);
  }

  state.consecutive_failures = 0;
  state.requests_today += 1;
  state.last_used = now;
  state.total_rate_limited += 1;

  await setKeyState(kv, index, state);
}

async function handleError(env, index, state, keyCount) {
  state.consecutive_failures += 1;
  state.requests_today += 1;
  state.last_used = Date.now();
  state.total_errors += 1;

  if (state.consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.status = "dead";
    state.cooldown_until = Date.now() + 3600 * 1000;
    await setKeyState(env.KEY_STATE, index, state);

    // Đếm keys còn available sau khi key này dead (dùng pure check, không mutate)
    const remaining = [];
    for (let i = 0; i < keyCount; i++) {
      if (i === index) continue;
      const s = await getKeyState(env.KEY_STATE, i);
      if (isKeyAvailableCheck(s)) remaining.push(i);
    }

    // Alert: circuit breaker
    await dispatchAlert(env, "circuit_breaker", {
      keyIndex: index,
      consecutiveFailures: state.consecutive_failures,
      availableCount: remaining.length,
      totalCount: keyCount,
    });

    // Alert: all_keys_down nếu không còn key nào
    if (remaining.length === 0) {
      await dispatchAlert(env, "all_keys_down", {
        keyCount,
        soonestRecoverySec: 3600,
      });
    }

    // Alert: pool critical nếu chỉ còn 1
    if (remaining.length === 1) {
      const coolingKeys = [];
      for (let i = 0; i < keyCount; i++) {
        if (i === remaining[0]) continue;
        coolingKeys.push(i);
      }
      const soonestSec = 3600; // worst case
      await dispatchAlert(env, "pool_critical", {
        lastKeyIndex: remaining[0],
        coolingKeys,
        soonestRecoverySec: soonestSec,
      });
    }
  } else {
    await setKeyState(env.KEY_STATE, index, state);
  }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

async function proxyToGemini(request, apiKey) {
  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/proxy/, "");

  // Xây target URL: giữ nguyên query params gốc từ client (ví dụ ?alt=sse cho streaming)
  const targetUrl = new URL(`https://generativelanguage.googleapis.com${targetPath}`);
  for (const [k, v] of url.searchParams) {
    if (k !== "key") {           // không cho client override key
      targetUrl.searchParams.set(k, v);
    }
  }
  targetUrl.searchParams.set("key", apiKey);

  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("Content-Type") || "application/json");

  return fetch(new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.method !== "GET" ? await request.text() : undefined,
  }));
}

// ─── Build Pool Summary (dùng chung cho status + daily report) ───────────────

async function buildPoolSummary(env, keyCount) {
  const now = Date.now();
  const keys = [];
  let totalRequests = 0;
  let availableCount = 0;

  for (let i = 0; i < keyCount; i++) {
    const state = await getKeyState(env.KEY_STATE, i);
    const available = isKeyAvailableCheck(state);
    if (available) availableCount++;
    totalRequests += state.requests_today;

    const cooldownRemaining = state.cooldown_until > now
      ? Math.ceil((state.cooldown_until - now) / 1000)
      : 0;

    keys.push({
      index: i,
      status: state.status,
      available,
      requests_today: state.requests_today,
      quota_pct: Math.round(state.requests_today / DAILY_QUOTA_SOFT * 100),
      backoff_level: state.backoff_level,
      cooldown_remaining_s: cooldownRemaining,
      total_success: state.total_success,
      total_rate_limited: state.total_rate_limited,
      total_errors: state.total_errors,
      model_states: state.model_states || {},
    });
  }

  return {
    date: todayVN(),
    poolHealth: { available: availableCount, total: keyCount },
    totalRequests,
    keys,
  };
}

// ─── Scheduled Handler (Cron) ─────────────────────────────────────────────────

async function handleScheduled(env) {
  const keyCount = parseInt(env.GEMINI_KEY_COUNT || "1", 10);
  console.log("Running scheduled daily report...");

  const summary = await buildPoolSummary(env, keyCount);

  // Lưu D1
  await saveDailyReport(env.DB, summary);

  // Format và gửi Telegram
  const message = formatDailyReport(summary);
  await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message);

  console.log("Daily report sent. Pool:", `${summary.poolHealth.available}/${summary.poolHealth.total}`);
}

// ─── HTTP Handlers ────────────────────────────────────────────────────────────

async function handleDashboardHtml(cors) {
  const html = getDashboardHtml();
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

async function handleStatus(env, keyCount, cors) {
  const summary = await buildPoolSummary(env, keyCount);
  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function handleModels(cors) {
  const now = new Date().toISOString().slice(0, 10);
  const payload = {
    updated: "2026-05-29",
    note: "Free tier limits per project (not per key). Quota resets at midnight Pacific Time.",
    free_models: GEMINI_MODELS.map(m => {
      const isExpired = m.deprecated_date && m.deprecated_date <= now;
      return {
        ...m,
        available: !isExpired,
        proxy_path: m.id.startsWith("gemini-embedding")
          ? `/proxy/v1beta/models/${m.id}:embedContent`
          : `/proxy/v1beta/models/${m.id}:generateContent`,
      };
    }),
    paid_only: PAID_ONLY_MODELS,
    proxy_daily_quota: {
      soft_limit: DAILY_QUOTA_SOFT,
      hard_limit: DAILY_QUOTA_HARD,
      note: "Per-key aggregate across all models. Key paused when reaching hard limit.",
    },
  };
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleHistory(env, cors) {
  const [reports, alerts] = await Promise.all([
    getRecentReports(env.DB, 7),
    getRecentAlerts(env.DB, 24),
  ]);
  return new Response(JSON.stringify({ reports, alerts }, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleAdminReset(env, keyCount, cors, pathname) {
  const idx = parseInt(pathname.split("/").pop(), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= keyCount) {
    return new Response(JSON.stringify({ error: "Invalid key index" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  await setKeyState(env.KEY_STATE, idx, defaultKeyState());
  return new Response(JSON.stringify({ ok: true, message: `Key ${idx + 1} reset` }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
}

function extractModelId(pathname) {
  const match = pathname.match(/models\/([^:/]+)/);
  return match ? match[1] : "default";
}

async function logApiCallAsync(db, modelId, keyIndex, response) {
  if (!db) return;
  try {
    const clone = response.clone();
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedTokens = 0;

    const contentType = clone.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const reader = clone.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }

      const usageMatches = [...buffer.matchAll(/"usageMetadata"\s*:\s*\{([^}]+)\}/g)];
      if (usageMatches.length > 0) {
        const lastUsageContent = usageMatches[usageMatches.length - 1][1];
        const promptMatch = lastUsageContent.match(/"promptTokenCount"\s*:\s*(\d+)/);
        const candidatesMatch = lastUsageContent.match(/"candidatesTokenCount"\s*:\s*(\d+)/);
        const cachedMatch = lastUsageContent.match(/"cachedContentTokenCount"\s*:\s*(\d+)/);

        if (promptMatch) inputTokens = parseInt(promptMatch[1], 10);
        if (candidatesMatch) outputTokens = parseInt(candidatesMatch[1], 10);
        if (cachedMatch) cachedTokens = parseInt(cachedMatch[1], 10);
      }
    } else {
      const text = await clone.text();
      try {
        const json = JSON.parse(text);
        if (json.usageMetadata) {
          inputTokens = json.usageMetadata.promptTokenCount || 0;
          outputTokens = json.usageMetadata.candidatesTokenCount || 0;
          cachedTokens = json.usageMetadata.cachedContentTokenCount || 0;
        }
      } catch (e) {
        const promptMatch = text.match(/"promptTokenCount"\s*:\s*(\d+)/);
        const candidatesMatch = text.match(/"candidatesTokenCount"\s*:\s*(\d+)/);
        const cachedMatch = text.match(/"cachedContentTokenCount"\s*:\s*(\d+)/);
        if (promptMatch) inputTokens = parseInt(promptMatch[1], 10);
        if (candidatesMatch) outputTokens = parseInt(candidatesMatch[1], 10);
        if (cachedMatch) cachedTokens = parseInt(cachedMatch[1], 10);
      }
    }

    if (inputTokens > 0 || outputTokens > 0) {
      await saveApiCall(db, {
        modelId,
        inputTokens,
        outputTokens,
        cachedTokens,
        statusCode: response.status,
        keyIndex
      });
    }
  } catch (err) {
    console.error("D1 logApiCallAsync failed:", err.message);
  }
}

async function handleApiCalls(request, env, cors) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const startTime = url.searchParams.get("startTime");
  const endTime = url.searchParams.get("endTime");

  const calls = await getRecentApiCalls(env.DB, { limit, startTime, endTime });
  return new Response(JSON.stringify({ success: true, calls }, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleProxy(request, env, keyCount, cors, ctx) {
  const url = new URL(request.url);
  const modelId = extractModelId(url.pathname);
  const { keys, all, retryAfterMs } = await selectKeys(env, keyCount, modelId);

  // Tất cả keys đều unavailable
  if (keys.length === 0) {
    const retrySec = Math.ceil((retryAfterMs || 60000) / 1000);

    await dispatchAlert(env, "all_keys_down", {
      keyCount,
      soonestRecoverySec: retrySec,
    });

    return new Response(
      JSON.stringify({ error: "All API keys unavailable", retry_after_seconds: retrySec }),
      {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(retrySec) },
      }
    );
  }

  // Chỉ còn 1 key — cảnh báo sớm
  if (keys.length === 1 && all.length > 1) {
    const coolingKeys = all
      .filter(({ index }) => index !== keys[0].index)
      .map(({ index }) => index);
    const soonest = all
      .filter(s => s.state.cooldown_until > 0)
      .reduce((min, s) => Math.min(min, s.state.cooldown_until), Infinity);
    const soonestSec = soonest === Infinity ? 3600 : Math.ceil((soonest - Date.now()) / 1000);

    await dispatchAlert(env, "pool_critical", {
      lastKeyIndex: keys[0].index,
      coolingKeys,
      soonestRecoverySec: Math.max(0, soonestSec),
    });
  }

  // Thử từng key (giới hạn tối đa 3 keys mỗi request và delay 1s giữa các lần thử để tránh loop dồn dập)
  let attempts = 0;
  const maxAttempts = Math.min(3, keys.length);

  for (const { index, state } of keys) {
    if (attempts >= maxAttempts) {
      break;
    }
    attempts++;

    // Trì hoãn 1 giây trước khi thử key tiếp theo
    if (attempts > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const apiKey = env[`GEMINI_KEY_${index + 1}`];
    if (!apiKey) continue;

    let response;
    try {
      response = await proxyToGemini(request.clone(), apiKey);
    } catch (err) {
      console.error(`Key ${index + 1} fetch error:`, err.message);
      await handleError(env, index, state, keyCount);
      continue;
    }

    if (response.status === 200) {
      await handleSuccess(env.KEY_STATE, index, state, modelId);
      const responseCloneForLogging = response.clone();
      const body = await response.arrayBuffer();

      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(logApiCallAsync(env.DB, modelId, index + 1, responseCloneForLogging));
      } else {
        logApiCallAsync(env.DB, modelId, index + 1, responseCloneForLogging);
      }

      return new Response(body, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "X-Key-Index": String(index + 1),
        },
      });
    }

    if (response.status === 429 || response.status === 503) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "0", 10);
      await handleRateLimit(env.KEY_STATE, index, state, retryAfter, modelId);
      continue;
    }

    // Lỗi request (400, 401, 500...) — không retry
    await handleError(env, index, state, keyCount);
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        ...cors,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "X-Key-Index": String(index + 1),
      },
    });
  }

  return new Response(
    JSON.stringify({ error: "All keys rate limited. Try again later." }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60" } }
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default {
  // HTTP requests
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);
    const keyCount = parseInt(env.GEMINI_KEY_COUNT || "1", 10);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Serves the simple web dashboard
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/dashboard")) {
      return handleDashboardHtml(cors);
    }

    // Optional auth
    if (env.PROXY_SECRET) {
      const secret = request.headers.get("X-Proxy-Secret") || request.headers.get("x-goog-api-key") || url.searchParams.get("key");
      let authHeader = request.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        authHeader = authHeader.slice(7);
      }
      const isAuthenticated = (secret === env.PROXY_SECRET) || (authHeader === env.PROXY_SECRET);
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    const path = url.pathname;

    // GET /proxy/status
    if (request.method === "GET" && path === "/proxy/status") {
      return handleStatus(env, keyCount, cors);
    }

    // GET /proxy/history
    if (request.method === "GET" && path === "/proxy/history") {
      return handleHistory(env, cors);
    }

    // GET /proxy/api-calls
    if (request.method === "GET" && path === "/proxy/api-calls") {
      return handleApiCalls(request, env, cors);
    }

    // GET /proxy/models — catalog of available Gemini models + rate limits
    if (request.method === "GET" && path === "/proxy/models") {
      return handleModels(cors);
    }

    // POST /proxy/admin/reset-key/:n
    if (request.method === "POST" && path.startsWith("/proxy/admin/reset-key/")) {
      return handleAdminReset(env, keyCount, cors, path);
    }

    // POST /proxy/admin/test-report  (manual trigger daily report)
    if (request.method === "POST" && path === "/proxy/admin/test-report") {
      await handleScheduled(env);
      return new Response(JSON.stringify({ ok: true, message: "Report sent" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // POST /proxy/**  → main proxy
    if (request.method === "POST") {
      return handleProxy(request, env, keyCount, cors, ctx);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  },

  // Cron trigger — chạy mỗi ngày lúc 23:00 UTC = 06:00 VN
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};