-- D1 Schema cho Gemini Key Monitor

-- Lịch sử daily report
CREATE TABLE IF NOT EXISTS daily_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT    NOT NULL,          -- "2024-05-28"
  report_time TEXT    NOT NULL,          -- ISO timestamp
  pool_health TEXT    NOT NULL,          -- "3/3" | "2/3" ...
  total_requests_today INTEGER DEFAULT 0,
  keys_snapshot TEXT  NOT NULL,          -- JSON array of key states
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Lịch sử alerts
CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type  TEXT    NOT NULL,          -- "all_keys_down" | "circuit_breaker" | "pool_critical"
  key_index   INTEGER,                   -- null nếu không liên quan đến key cụ thể
  message     TEXT    NOT NULL,
  sent_to_telegram INTEGER DEFAULT 0,   -- 0 | 1
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_reports_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_alerts_type  ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_time  ON alerts(created_at);