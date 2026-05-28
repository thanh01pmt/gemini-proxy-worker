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