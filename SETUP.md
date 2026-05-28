# Setup Guide — Gemini Proxy Worker v3

## Bước 1 — Cài đặt & Login

```bash
npm install -g wrangler
wrangler login
```

---

## Bước 2 — Tạo Telegram Bot

1. Nhắn tin với **@BotFather** trên Telegram
2. Gõ `/newbot` → đặt tên → nhận **BOT_TOKEN**
3. Nhắn tin bất kỳ cho bot vừa tạo
4. Mở URL sau để lấy CHAT_ID:
   ```
   https://api.telegram.org/bot{BOT_TOKEN}/getUpdates
   ```
   Tìm trường `"id"` trong `"chat"` object

---

## Bước 3 — Tạo KV Namespace

```bash
wrangler kv namespace create KEY_STATE
```
Copy `id` → paste vào `wrangler.toml`

---

## Bước 4 — Tạo D1 Database

```bash
wrangler d1 create gemini-key-monitor
```
Copy `database_id` → paste vào `wrangler.toml`

Khởi tạo schema:
```bash
wrangler d1 execute gemini-key-monitor --file=./schema.sql
```

---

## Bước 5 — Upload Secrets

```bash
wrangler secret put GEMINI_KEY_1        # paste key 1
wrangler secret put GEMINI_KEY_2        # paste key 2
wrangler secret put GEMINI_KEY_3        # paste key 3
wrangler secret put TELEGRAM_BOT_TOKEN  # paste bot token
wrangler secret put PROXY_SECRET        # tự đặt chuỗi ngẫu nhiên
```

---

## Bước 6 — Cập nhật wrangler.toml

```toml
GEMINI_KEY_COUNT = "3"                           # số keys
ALLOWED_ORIGIN   = "https://your-app.pages.dev"  # domain của bạn
TELEGRAM_CHAT_ID = "123456789"                   # chat ID vừa lấy
```

---

## Bước 7 — Deploy

```bash
wrangler deploy
```

---

## Bước 8 — Test

```bash
# Xem trạng thái pool
curl https://gemini-proxy.YOUR.workers.dev/proxy/status \
  -H "X-Proxy-Secret: your-secret"

# Test gửi report Telegram ngay
curl -X POST https://gemini-proxy.YOUR.workers.dev/proxy/admin/test-report \
  -H "X-Proxy-Secret: your-secret"

# Xem lịch sử reports + alerts (7 ngày)
curl https://gemini-proxy.YOUR.workers.dev/proxy/history \
  -H "X-Proxy-Secret: your-secret"

# Reset key bị dead
curl -X POST https://gemini-proxy.YOUR.workers.dev/proxy/admin/reset-key/2 \
  -H "X-Proxy-Secret: your-secret"
```

---

## Endpoints đầy đủ

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/proxy/v1beta/models/...` | Proxy đến Gemini |
| GET | `/proxy/status` | Trạng thái pool realtime |
| GET | `/proxy/history` | Reports + alerts 7 ngày |
| POST | `/proxy/admin/reset-key/:n` | Reset key n về active |
| POST | `/proxy/admin/test-report` | Trigger report thủ công |

---

## Alert Types & Cooldown

| Alert | Trigger | Cooldown |
|-------|---------|----------|
| 🚨 `all_keys_down` | Tất cả keys unavailable | 30 phút |
| 🔴 `circuit_breaker` | 1 key dead (5 lỗi liên tiếp) | 1 giờ / key |
| ⚠️ `pool_critical` | Chỉ còn 1 key active | 15 phút |

---

## Gọi từ Frontend

```javascript
const res = await fetch(
  "https://gemini-proxy.YOUR.workers.dev/proxy/v1beta/models/gemini-2.0-flash:generateContent",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Proxy-Secret": "your-secret",
    },
    body: JSON.stringify(payload),
  }
);
```