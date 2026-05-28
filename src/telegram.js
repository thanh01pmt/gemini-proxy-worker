/**
 * telegram.js — Gửi message qua Telegram Bot API
 */

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Gửi message Telegram
 * @param {string} botToken  - từ TELEGRAM_BOT_TOKEN secret
 * @param {string} chatId    - từ TELEGRAM_CHAT_ID var
 * @param {string} text      - nội dung (hỗ trợ HTML)
 */
export async function sendTelegram(botToken, chatId, text) {
  if (!botToken || !chatId) {
    console.warn("Telegram not configured — skipping notification");
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Telegram send failed:", err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram fetch error:", e.message);
    return false;
  }
}

// ─── Message Formatters ───────────────────────────────────────────────────────

export function formatDailyReport(summary) {
  const { date, poolHealth, totalRequests, keys } = summary;

  const healthIcon = poolHealth.available === poolHealth.total ? "✅" : 
                     poolHealth.available === 0 ? "🔴" : "⚠️";

  let lines = [
    `🔑 <b>Gemini Key Pool — Báo cáo ngày ${date}</b>`,
    ``,
    `${healthIcon} Pool: <b>${poolHealth.available}/${poolHealth.total} keys hoạt động</b>`,
    `📊 Tổng requests hôm nay: <b>${totalRequests.toLocaleString()}</b>`,
    ``,
    `<b>Chi tiết từng key:</b>`,
  ];

  for (const k of keys) {
    const icon = k.status === "active" ? "✅" :
                 k.status === "dead"   ? "🔴" : "⚠️";
    const quota = `${k.requests_today} req (${k.quota_pct}%)`;
    const backoff = k.backoff_level > 0 ? ` | backoff lv${k.backoff_level}` : "";
    const cooldown = k.cooldown_remaining_s > 0
      ? ` | resume: ${formatDuration(k.cooldown_remaining_s)}`
      : "";

    lines.push(`${icon} <code>KEY ${k.index + 1}</code>  ${k.status.padEnd(8)} | ${quota}${backoff}${cooldown}`);
  }

  // Cảnh báo
  const warnings = [];
  for (const k of keys) {
    if (k.quota_pct >= 80) warnings.push(`⚠️ KEY ${k.index + 1} đã dùng ${k.quota_pct}% quota hôm nay`);
    if (k.total_rate_limited >= 10) warnings.push(`⚠️ KEY ${k.index + 1} bị rate limit ${k.total_rate_limited} lần`);
    if (k.status === "dead") warnings.push(`🔴 KEY ${k.index + 1} đang dead (circuit breaker)`);
  }

  if (warnings.length > 0) {
    lines.push(``, `<b>Cảnh báo:</b>`);
    lines.push(...warnings);
  }

  lines.push(``, `<i>Báo cáo tự động lúc 06:00 (GMT+7)</i>`);
  return lines.join("\n");
}

export function formatAlert(type, data) {
  switch (type) {
    case "all_keys_down":
      return [
        `🚨 <b>ALERT: Toàn bộ API keys không khả dụng!</b>`,
        ``,
        `Tất cả ${data.keyCount} Gemini keys đều đang bị rate limit hoặc dead.`,
        `Requests đang bị từ chối.`,
        ``,
        `⏱ Key gần recover nhất: <b>${formatDuration(data.soonestRecoverySec)}</b>`,
        ``,
        `<i>Dùng /proxy/status để xem chi tiết.</i>`,
      ].join("\n");

    case "circuit_breaker":
      return [
        `🔴 <b>ALERT: Circuit Breaker — KEY ${data.keyIndex + 1} bị dead</b>`,
        ``,
        `KEY ${data.keyIndex + 1} đã gặp <b>${data.consecutiveFailures} lỗi liên tiếp</b>.`,
        `Tạm dừng sử dụng key này trong <b>1 giờ</b>.`,
        ``,
        `Pool còn lại: <b>${data.availableCount}/${data.totalCount} keys hoạt động</b>`,
        ``,
        `Để reset thủ công: <code>POST /proxy/admin/reset-key/${data.keyIndex + 1}</code>`,
      ].join("\n");

    case "pool_critical":
      return [
        `⚠️ <b>ALERT: Pool sắp cạn — chỉ còn 1 key hoạt động</b>`,
        ``,
        `Chỉ còn <b>KEY ${data.lastKeyIndex + 1}</b> đang active.`,
        `Nếu key này bị rate limit, toàn bộ requests sẽ bị từ chối.`,
        ``,
        `Keys đang cooling: ${data.coolingKeys.map(i => `KEY ${i + 1}`).join(", ")}`,
        `Key gần recover: <b>${formatDuration(data.soonestRecoverySec)}</b>`,
      ].join("\n");

    default:
      return `⚠️ Alert: ${type}\n${JSON.stringify(data)}`;
  }
}

function formatDuration(seconds) {
  if (seconds <= 0) return "ngay bây giờ";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`;
  return `${Math.ceil(seconds / 3600)} giờ`;
}