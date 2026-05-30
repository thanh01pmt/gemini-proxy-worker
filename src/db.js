/**
 * db.js — D1 helpers cho Gemini Key Monitor
 */

/**
 * Lưu daily report snapshot vào D1
 */
export async function saveDailyReport(db, summary) {
  if (!db) return;
  try {
    await db.prepare(`
      INSERT INTO daily_reports (report_date, report_time, pool_health, total_requests_today, keys_snapshot)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      summary.date,
      new Date().toISOString(),
      `${summary.poolHealth.available}/${summary.poolHealth.total}`,
      summary.totalRequests,
      JSON.stringify(summary.keys),
    ).run();
  } catch (e) {
    console.error("D1 saveDailyReport failed:", e.message);
  }
}

/**
 * Lưu alert vào D1
 */
export async function saveAlert(db, type, keyIndex, message, sentToTelegram) {
  if (!db) return;
  try {
    await db.prepare(`
      INSERT INTO alerts (alert_type, key_index, message, sent_to_telegram)
      VALUES (?, ?, ?, ?)
    `).bind(
      type,
      keyIndex ?? null,
      message,
      sentToTelegram ? 1 : 0,
    ).run();
  } catch (e) {
    console.error("D1 saveAlert failed:", e.message);
  }
}

/**
 * Lấy report lịch sử (mới nhất N ngày)
 */
export async function getRecentReports(db, days = 7) {
  if (!db) return [];
  try {
    const result = await db.prepare(`
      SELECT report_date, report_time, pool_health, total_requests_today, keys_snapshot
      FROM daily_reports
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(days).all();
    return result.results || [];
  } catch (e) {
    console.error("D1 getRecentReports failed:", e.message);
    return [];
  }
}

/**
 * Lấy alerts lịch sử (24h gần nhất)
 */
export async function getRecentAlerts(db, hours = 24) {
  if (!db) return [];
  try {
    const result = await db.prepare(`
      SELECT alert_type, key_index, message, sent_to_telegram, created_at
      FROM alerts
      WHERE created_at >= datetime('now', ?)
      ORDER BY created_at DESC
    `).bind(`-${hours} hours`).all();
    return result.results || [];
  } catch (e) {
    console.error("D1 getRecentAlerts failed:", e.message);
    return [];
  }
}

/**
 * Lưu API call info vào D1
 */
export async function saveApiCall(db, { modelId, inputTokens, outputTokens, cachedTokens, statusCode, keyIndex }) {
  if (!db) return;
  try {
    await db.prepare(`
      INSERT INTO api_calls (model_id, input_tokens, output_tokens, cached_tokens, status_code, key_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      modelId,
      inputTokens || 0,
      outputTokens || 0,
      cachedTokens || 0,
      statusCode || 0,
      keyIndex ?? null
    ).run();
  } catch (e) {
    console.error("D1 saveApiCall failed:", e.message);
  }
}

/**
 * Lấy danh sách API calls theo time range hoặc giới hạn số lượng
 */
export async function getRecentApiCalls(db, { limit = 100, startTime = null, endTime = null } = {}) {
  if (!db) return [];
  try {
    let query = `
      SELECT id, timestamp, model_id, input_tokens, output_tokens, cached_tokens, status_code, key_index
      FROM api_calls
    `;
    const params = [];
    if (startTime && endTime) {
      query += ` WHERE datetime(timestamp) BETWEEN datetime(?) AND datetime(?)`;
      params.push(startTime, endTime);
    } else if (startTime) {
      query += ` WHERE datetime(timestamp) >= datetime(?)`;
      params.push(startTime);
    } else if (endTime) {
      query += ` WHERE datetime(timestamp) <= datetime(?)`;
      params.push(endTime);
    }
    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const result = await db.prepare(query).bind(...params).all();
    return result.results || [];
  } catch (e) {
    console.error("D1 getRecentApiCalls failed:", e.message);
    return [];
  }
}