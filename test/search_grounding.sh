#!/bin/bash

# Cấu hình endpoint và secret
# Chạy local: http://localhost:8787
# Chạy production: https://gemini-proxy.makexyzfun.workers.dev
API_URL="https://gemini-proxy.makexyzfun.workers.dev"
PROXY_SECRET="cloudflare-gemini-proxy-Secret@123"
MODEL="gemini-2.5-flash"

echo "=== Gửi request kiểm thử Google Search Grounding qua Gemini Proxy ==="
echo "Endpoint: $API_URL"
echo "Model: $MODEL"
echo "------------------------------------------------------------------"

curl -X POST "$API_URL/proxy/v1beta/models/$MODEL:generateContent" \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Secret: $PROXY_SECRET" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Thời tiết Hà Nội hôm nay thế nào? Hãy cập nhật thông tin mới nhất và cho biết nguồn từ trang web nào."
          }
        ]
      }
    ],
    "tools": [
      {
        "google_search": {}
      }
    ]
  }'

echo ""
echo "------------------------------------------------------------------"
echo "Hoàn thành kiểm thử."
