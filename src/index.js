/**
 * Gemini API Proxy — Cloudflare Worker v3
 * Smart Key Manager + Daily Report + Instant Alerts
 */

import { sendTelegram, formatDailyReport, formatAlert } from "./telegram.js";
import { saveDailyReport, saveAlert, getRecentReports, getRecentAlerts } from "./db.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKOFF_SCHEDULE    = [30, 60, 120, 300, 3600];
const CIRCUIT_BREAKER_THRESHOLD = 5;
const DAILY_QUOTA_SOFT   = 1400;
const DAILY_QUOTA_HARD   = 1480;

// Alert dedup TTL (giây) — không gửi cùng 1 loại alert trong khoảng này
const ALERT_COOLDOWN = {
  all_keys_down:   1800,  // 30 phút
  circuit_breaker: 3600,  // 1 giờ per key
  pool_critical:    900,  // 15 phút
};

// ─── CORS ─────────────────────────────────────────────────────────────────────

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  const ok = allowed === "*" || origin === allowed;
  return {
    "Access-Control-Allow-Origin": ok ? (origin || "*") : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Proxy-Secret",
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

function isKeyAvailable(state) {
  const now = Date.now();
  if (state.status === "dead") {
    // Auto-recover sau cooldown
    if (now >= state.cooldown_until && state.cooldown_until > 0) {
      state.status = "active";
    } else {
      return false;
    }
  }
  if (state.status === "cooling" && now < state.cooldown_until) return false;
  if (state.status === "cooling" && now >= state.cooldown_until) state.status = "active";
  if (state.requests_today >= DAILY_QUOTA_HARD) return false;
  return true;
}

function pressureScore(state) {
  const quotaRatio  = state.requests_today / DAILY_QUOTA_SOFT;
  const freshBonus  = (Date.now() - state.last_used) > 60000 ? -5 : 0;
  return quotaRatio * 100 + state.backoff_level * 5 + freshBonus;
}

async function loadAllStates(env, keyCount) {
  const states = [];
  for (let i = 0; i < keyCount; i++) {
    const state = await getKeyState(env.KEY_STATE, i);
    states.push({ index: i, state });
  }
  return states;
}

async function selectKeys(env, keyCount) {
  const all = await loadAllStates(env, keyCount);
  const available = all.filter(({ state }) => isKeyAvailable(state));

  if (available.length === 0) {
    const cooling = all.filter(s => s.state.status === "cooling" || s.state.status === "dead");
    const soonestMs = cooling.reduce(
      (min, s) => Math.min(min, s.state.cooldown_until),
      Infinity
    );
    return {
      keys: [],
      all,
      retryAfterMs: soonestMs === Infinity ? 60000 : Math.max(0, soonestMs - Date.now()),
    };
  }

  available.sort((a, b) => pressureScore(a.state) - pressureScore(b.state));
  return { keys: available, all, retryAfterMs: 0 };
}

// ─── State Updaters ───────────────────────────────────────────────────────────

async function handleSuccess(kv, index, state) {
  state.status = "active";
  state.consecutive_failures = 0;
  state.backoff_level = Math.max(0, state.backoff_level - 1);
  state.requests_today += 1;
  state.last_used = Date.now();
  state.total_success += 1;
  await setKeyState(kv, index, state);
}

async function handleRateLimit(kv, index, state, retryAfterSec) {
  const backoffSec = BACKOFF_SCHEDULE[Math.min(state.backoff_level, BACKOFF_SCHEDULE.length - 1)];
  const cooldownSec = Math.max(retryAfterSec || 0, backoffSec);

  state.status = "cooling";
  state.cooldown_until = Date.now() + cooldownSec * 1000;
  state.backoff_level = Math.min(state.backoff_level + 1, BACKOFF_SCHEDULE.length - 1);
  state.consecutive_failures = 0;
  state.requests_today += 1;
  state.last_used = Date.now();
  state.total_rate_limited += 1;

  console.log(`Key ${index + 1} cooling ${cooldownSec}s (backoff lv${state.backoff_level})`);
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

    // Đếm keys còn available sau khi key này dead
    const remaining = [];
    for (let i = 0; i < keyCount; i++) {
      if (i === index) continue;
      const s = await getKeyState(env.KEY_STATE, i);
      if (isKeyAvailable(s)) remaining.push(i);
    }

    // Alert: circuit breaker
    await dispatchAlert(env, "circuit_breaker", {
      keyIndex: index,
      consecutiveFailures: state.consecutive_failures,
      availableCount: remaining.length,
      totalCount: keyCount,
    });

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
  const targetUrl = `https://generativelanguage.googleapis.com${targetPath}?key=${apiKey}`;

  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  return fetch(new Request(targetUrl, {
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
    const available = isKeyAvailable({ ...state });
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

async function handleStatus(env, keyCount, cors) {
  const summary = await buildPoolSummary(env, keyCount);
  return new Response(JSON.stringify(summary, null, 2), {
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

async function handleProxy(request, env, keyCount, cors) {
  const { keys, all, retryAfterMs } = await selectKeys(env, keyCount);

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

  // Thử từng key
  for (const { index, state } of keys) {
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
      await handleSuccess(env.KEY_STATE, index, state);
      const body = await response.arrayBuffer();
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
      await handleRateLimit(env.KEY_STATE, index, state, retryAfter);
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
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);
    const keyCount = parseInt(env.GEMINI_KEY_COUNT || "1", 10);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Optional auth
    if (env.PROXY_SECRET) {
      const secret = request.headers.get("X-Proxy-Secret");
      if (secret !== env.PROXY_SECRET) {
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
      return handleProxy(request, env, keyCount, cors);
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