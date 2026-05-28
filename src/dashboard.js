/**
 * dashboard.js — Trình bày giao diện Dashboard quản lý Pool Key Gemini Proxy
 */

export function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini Proxy Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --bg-primary: #08090f;
      --bg-secondary: #101119;
      --bg-card: rgba(20, 22, 33, 0.65);
      --bg-card-hover: rgba(28, 30, 45, 0.85);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.5);
      
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      
      --color-active: #10b981;
      --color-cooling: #f59e0b;
      --color-dead: #ef4444;
      --color-accent: #6366f1;
      --color-accent-glow: rgba(99, 102, 241, 0.15);
      --color-accent-hover: #4f46e5;
      
      --font-sans: 'Plus Jakarta Sans', 'Outfit', system-ui, -apple-system, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-primary);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(239, 68, 68, 0.04) 0%, transparent 45%);
      background-attachment: fixed;
      color: var(--text-primary);
      font-family: var(--font-sans);
      min-height: 100vh;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .glass {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
    }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      flex-wrap: wrap;
      gap: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1.5rem;
    }

    .brand-section h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-section p {
      color: var(--text-secondary);
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    .auth-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-wrapper i {
      position: absolute;
      left: 12px;
      color: var(--text-muted);
      width: 16px;
      height: 16px;
      pointer-events: none;
    }

    .input-secret {
      background: rgba(10, 11, 16, 0.6);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      padding: 0.65rem 1rem 0.65rem 2.5rem;
      font-family: inherit;
      font-size: 0.875rem;
      width: 260px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .input-secret:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    /* Buttons */
    .btn {
      background: var(--color-accent);
      color: #fff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
      font-family: inherit;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }

    .btn:hover {
      background: var(--color-accent-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      box-shadow: none;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: none;
      transform: none;
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--color-dead);
      box-shadow: none;
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.3);
      box-shadow: none;
      transform: none;
    }

    .btn-sm {
      padding: 0.45rem 0.9rem;
      font-size: 0.8rem;
      border-radius: 8px;
    }

    /* Grid Layout */
    .dashboard-content {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 2rem;
    }

    @media (max-width: 1024px) {
      .dashboard-content {
        grid-template-columns: 1fr;
      }
    }

    /* Stats Overview */
    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .stat-icon {
      background: rgba(99, 102, 241, 0.12);
      color: var(--color-accent);
      padding: 0.75rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-info h3 {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-info p {
      font-size: 1.5rem;
      font-weight: 700;
      margin-top: 0.15rem;
    }

    /* Keys Section */
    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }

    .section-title h2 {
      font-size: 1.15rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .key-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .key-card {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .key-card:hover {
      transform: translateY(-2px);
      border-color: rgba(99, 102, 241, 0.25);
      background-color: var(--bg-card-hover);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }

    .key-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .key-label {
      font-weight: 600;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Badge Statuses */
    .status-badge {
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      text-transform: uppercase;
    }

    .status-active {
      background: rgba(16, 185, 129, 0.1);
      color: var(--color-active);
      border: 1px solid rgba(16, 185, 129, 0.15);
    }

    .status-cooling {
      background: rgba(245, 158, 11, 0.1);
      color: var(--color-cooling);
      border: 1px solid rgba(245, 158, 11, 0.15);
    }

    .status-dead {
      background: rgba(239, 68, 68, 0.1);
      color: var(--color-dead);
      border: 1px solid rgba(239, 68, 68, 0.15);
    }

    /* Quota Slider / Progress */
    .quota-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .quota-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .bar-container {
      height: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 999px;
      overflow: hidden;
    }

    .fill-bar {
      height: 100%;
      border-radius: 999px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .fill-green {
      background: linear-gradient(90deg, #10b981, #059669);
    }

    .fill-orange {
      background: linear-gradient(90deg, #f59e0b, #d97706);
    }

    .fill-red {
      background: linear-gradient(90deg, #ef4444, #dc2626);
    }

    /* Stats Grid inside Key Card */
    .mini-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.6rem;
      border-radius: 8px;
      text-align: center;
    }

    .metric-item h4 {
      color: var(--text-muted);
      font-size: 0.65rem;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 0.1rem;
      letter-spacing: 0.025em;
    }

    .metric-item p {
      font-size: 0.85rem;
      font-weight: 700;
    }

    .key-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.25rem;
    }

    /* Sidebar Panels */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .panel-box {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-box h2 {
      font-size: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.75rem;
    }

    .control-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .control-actions .btn {
      justify-content: center;
    }

    /* Timelines */
    .log-container {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      max-height: 380px;
      overflow-y: auto;
      padding-right: 0.25rem;
    }

    .log-item {
      padding: 0.75rem;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.15);
      border-left: 3px solid var(--color-accent);
      font-size: 0.8rem;
    }

    .log-item.alert-all_keys_down { border-left-color: var(--color-dead); }
    .log-item.alert-circuit_breaker { border-left-color: var(--color-dead); }
    .log-item.alert-pool_critical { border-left-color: var(--color-cooling); }

    .log-header {
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
      font-size: 0.7rem;
      margin-bottom: 0.25rem;
      font-weight: 500;
    }

    .log-text {
      color: var(--text-primary);
      white-space: pre-line;
      word-break: break-all;
    }

    .report-card {
      padding: 0.75rem;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.15);
      font-size: 0.8rem;
      border-left: 3px solid #10b981;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .report-info {
      display: flex;
      justify-content: space-between;
      color: var(--text-secondary);
    }

    /* Pulser Dot */
    .pulser {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .pulser.status-active {
      background-color: var(--color-active);
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse-g 2s infinite;
    }
    .pulser.status-cooling {
      background-color: var(--color-cooling);
      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
      animation: pulse-y 2s infinite;
    }
    .pulser.status-dead {
      background-color: var(--color-dead);
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
      animation: pulse-r 2s infinite;
    }

    @keyframes pulse-g {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    @keyframes pulse-y {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(245, 158, 11, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
    }
    @keyframes pulse-r {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    /* Screen Overlay */
    .locker-overlay {
      position: fixed;
      inset: 0;
      background: var(--bg-primary);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .locker-card {
      width: 90%;
      max-width: 400px;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    }

    .locker-icon {
      width: 54px;
      height: 54px;
      background: rgba(99, 102, 241, 0.1);
      color: var(--color-accent);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
    }

    .locker-card h2 {
      font-size: 1.35rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }

    .locker-card p {
      color: var(--text-secondary);
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }

    /* Toast Notifications */
    .toast-box {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9999;
    }

    .toast-card {
      background: #141622;
      border-left: 4px solid var(--color-accent);
      color: var(--text-primary);
      padding: 0.9rem 1.25rem;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 260px;
      max-width: 380px;
      transform: translateX(120%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
    }

    .toast-card.slide-in {
      transform: translateX(0);
    }

    .toast-card.info-toast { border-left-color: var(--color-accent); }
    .toast-card.success-toast { border-left-color: var(--color-active); }
    .toast-card.error-toast { border-left-color: var(--color-dead); }

    /* Utilities */
    .empty-placeholder {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .spinner-box {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 3rem;
    }

    .loader {
      border: 3px solid rgba(255, 255, 255, 0.04);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border-left-color: var(--color-accent);
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .mini-spinner {
      border: 2px solid rgba(255, 255, 255, 0.1);
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border-left-color: #fff;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>

  <!-- Locker Screen -->
  <div id="lockerScreen" class="locker-overlay">
    <div class="locker-card glass">
      <div class="locker-icon">
        <i data-lucide="lock"></i>
      </div>
      <h2>Yêu cầu xác thực</h2>
      <p>Nhập mật khẩu proxy (PROXY_SECRET) để xem Dashboard.</p>
      <form id="lockerForm" class="control-actions">
        <div class="input-wrapper" style="margin-bottom: 0.5rem;">
          <i data-lucide="shield-check"></i>
          <input type="password" id="lockerSecretVal" class="input-secret" placeholder="Nhập PROXY_SECRET..." style="width: 100%; box-sizing: border-box;" required>
        </div>
        <button type="submit" class="btn">
          <i data-lucide="unlock"></i> Mở khóa
        </button>
      </form>
    </div>
  </div>

  <!-- App Wrapper -->
  <div class="container">
    <header>
      <div class="brand-section">
        <h1><i data-lucide="bot" style="color: var(--color-accent)"></i> Gemini Key Monitor</h1>
        <p>Hệ thống giám sát xoay vòng khóa API Gemini & Cảnh báo tức thì</p>
      </div>
      
      <div class="auth-section">
        <div class="input-wrapper">
          <i data-lucide="key"></i>
          <input type="password" id="topSecretVal" class="input-secret" placeholder="Mật khẩu PROXY_SECRET...">
        </div>
        <button id="saveSecretBtn" class="btn btn-secondary btn-sm" title="Lưu mật khẩu">
          <i data-lucide="save"></i> Lưu
        </button>
        <button id="logoutBtn" class="btn btn-danger btn-sm" title="Khóa Dashboard">
          <i data-lucide="log-out"></i> Khóa
        </button>
      </div>
    </header>

    <div class="dashboard-content">
      <!-- Main Content -->
      <main>
        <!-- Counters -->
        <div class="stats-container">
          <div class="stat-card glass">
            <div class="stat-icon"><i data-lucide="activity"></i></div>
            <div class="stat-info">
              <h3>Số Key Sẵn Sàng</h3>
              <p id="poolHealthCount">-- / --</p>
            </div>
          </div>
          
          <div class="stat-card glass">
            <div class="stat-icon"><i data-lucide="arrow-up-right"></i></div>
            <div class="stat-info">
              <h3>Tổng Request Hôm Nay</h3>
              <p id="totalRequestsCount">--</p>
            </div>
          </div>

          <div class="stat-card glass">
            <div class="stat-icon"><i data-lucide="calendar"></i></div>
            <div class="stat-info">
              <h3>Ngày Hệ Thống (VN)</h3>
              <p id="systemDateStr">--</p>
            </div>
          </div>
        </div>

        <!-- Key pool -->
        <section>
          <div class="section-title">
            <h2><i data-lucide="cpu" style="width: 18px; height: 18px; color: var(--color-accent)"></i> Trạng Thái Danh Sách Khóa (Key Pool)</h2>
            <button id="reloadBtn" class="btn btn-secondary btn-sm">
              <i data-lucide="refresh-cw"></i> Tải lại
            </button>
          </div>
          
          <div id="poolSpinner" class="spinner-box">
            <div class="loader"></div>
          </div>

          <div id="keyGrid" class="key-grid hidden">
            <!-- Dynamic components inserted here -->
          </div>
        </section>
      </main>

      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- Dashboard Controls -->
        <div class="panel-box glass">
          <h2><i data-lucide="sliders" style="width: 18px; height: 18px;"></i> Bảng Điều Khiển</h2>
          <div class="control-actions">
            <button id="sendTestReportBtn" class="btn">
              <i data-lucide="send"></i> Gửi Report Telegram Ngay
            </button>
          </div>
        </div>

        <!-- Alerts -->
        <div class="panel-box glass">
          <h2><i data-lucide="bell" style="width: 18px; height: 18px; color: var(--color-dead);"></i> Cảnh Báo Gần Đây (24h)</h2>
          <div id="alertsLog" class="log-container">
            <div class="empty-placeholder">
              <i data-lucide="shield-alert" style="width: 26px; height: 26px;"></i>
              <p>Chưa ghi nhận cảnh báo nào trong 24 giờ qua.</p>
            </div>
          </div>
        </div>

        <!-- Reports -->
        <div class="panel-box glass">
          <h2><i data-lucide="history" style="width: 18px; height: 18px;"></i> Lịch Sử Báo Cáo (7 ngày)</h2>
          <div id="reportsLog" class="log-container">
            <div class="empty-placeholder">
              <i data-lucide="archive" style="width: 26px; height: 26px;"></i>
              <p>Chưa có báo cáo ngày nào trong cơ sở dữ liệu.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <!-- Toast system -->
  <div id="toastBox" class="toast-box"></div>

  <script>
    const SOFT_LIMIT = 1400;
    const POLL_TIME = 10000; // 10s auto refresh

    const lockerScreen = document.getElementById('lockerScreen');
    const lockerForm = document.getElementById('lockerForm');
    const lockerSecretVal = document.getElementById('lockerSecretVal');
    
    const topSecretVal = document.getElementById('topSecretVal');
    const saveSecretBtn = document.getElementById('saveSecretBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const poolHealthCount = document.getElementById('poolHealthCount');
    const totalRequestsCount = document.getElementById('totalRequestsCount');
    const systemDateStr = document.getElementById('systemDateStr');
    
    const keyGrid = document.getElementById('keyGrid');
    const poolSpinner = document.getElementById('poolSpinner');
    const reloadBtn = document.getElementById('reloadBtn');
    
    const sendTestReportBtn = document.getElementById('sendTestReportBtn');
    const alertsLog = document.getElementById('alertsLog');
    const reportsLog = document.getElementById('reportsLog');
    const toastBox = document.getElementById('toastBox');

    let autoRefreshTimer = null;

    // Toast
    function triggerToast(text, status = 'info') {
      const toast = document.createElement('div');
      toast.className = \`toast-card \${status}-toast\`;
      
      let icon = 'info';
      if (status === 'success') icon = 'check-circle';
      if (status === 'error') icon = 'alert-triangle';
      
      toast.innerHTML = \`
        <i data-lucide="\${icon}"></i>
        <span>\${text}</span>
      \`;
      
      toastBox.appendChild(toast);
      lucide.createIcons();
      
      setTimeout(() => toast.classList.add('slide-in'), 10);
      
      setTimeout(() => {
        toast.classList.remove('slide-in');
        setTimeout(() => toast.remove(), 350);
      }, 3500);
    }

    // Secret storage
    function getStoredSecret() {
      return localStorage.getItem('gemini_proxy_pass') || '';
    }

    function updateAppSecret(pass) {
      if (pass) {
        localStorage.setItem('gemini_proxy_pass', pass);
        topSecretVal.value = pass;
        lockerSecretVal.value = pass;
        lockerScreen.classList.add('hidden');
        initTimer();
        fetchState();
      } else {
        localStorage.removeItem('gemini_proxy_pass');
        topSecretVal.value = '';
        lockerSecretVal.value = '';
        lockerScreen.classList.remove('hidden');
        killTimer();
      }
    }

    // API calls
    async function makeCall(route, config = {}) {
      const secret = getStoredSecret();
      if (!secret) {
        updateAppSecret('');
        throw new Error('Chưa cung cấp proxy secret.');
      }

      const headers = new Headers(config.headers || {});
      headers.set('X-Proxy-Secret', secret);
      
      const response = await fetch(route, { ...config, headers });
      
      if (response.status === 401) {
        updateAppSecret('');
        triggerToast('Mật khẩu proxy không hợp lệ (401)', 'error');
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const txt = await response.text();
        let message = 'Lỗi hệ thống';
        try {
          const body = JSON.parse(txt);
          message = body.error || message;
        } catch {}
        throw new Error(message);
      }

      return response.json();
    }

    // Fetch and display
    async function fetchState() {
      poolSpinner.classList.remove('hidden');
      try {
        await Promise.all([
          loadStatus(),
          loadHistory()
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        poolSpinner.classList.add('hidden');
        keyGrid.classList.remove('hidden');
      }
    }

    async function loadStatus() {
      try {
        const res = await makeCall('/proxy/status');
        renderStatus(res);
      } catch (err) {
        triggerToast('Lấy trạng thái pool thất bại: ' + err.message, 'error');
      }
    }

    async function loadHistory() {
      try {
        const res = await makeCall('/proxy/history');
        renderHistory(res);
      } catch (err) {
        triggerToast('Lấy lịch sử thất bại: ' + err.message, 'error');
      }
    }

    // Render logic
    function renderStatus(data) {
      if (!data) return;

      poolHealthCount.textContent = \`\${data.poolHealth.available} / \${data.poolHealth.total}\`;
      totalRequestsCount.textContent = data.totalRequests.toLocaleString();
      systemDateStr.textContent = data.date || '--';

      if (data.poolHealth.available === 0) {
        poolHealthCount.style.color = 'var(--color-dead)';
      } else if (data.poolHealth.available === 1 && data.poolHealth.total > 1) {
        poolHealthCount.style.color = 'var(--color-cooling)';
      } else {
        poolHealthCount.style.color = 'var(--color-active)';
      }

      keyGrid.innerHTML = '';
      if (!data.keys || data.keys.length === 0) {
        keyGrid.innerHTML = \`
          <div class="empty-placeholder" style="grid-column: 1 / -1;">
            <i data-lucide="key" style="width: 32px; height: 32px;"></i>
            <p>Không có key nào trong pool.</p>
          </div>
        \`;
        lucide.createIcons();
        return;
      }

      data.keys.forEach(k => {
        const pct = Math.min(100, Math.round((k.requests_today / SOFT_LIMIT) * 100));
        let barColor = 'fill-green';
        if (pct > 80) barColor = 'fill-orange';
        if (pct >= 100) barColor = 'fill-red';

        let badgeStyle = 'status-active';
        let badgeLabel = 'Đang hoạt động';
        let badgeIcon = 'check-circle';
        
        if (k.status === 'cooling') {
          badgeStyle = 'status-cooling';
          badgeLabel = \`Đang chờ (\${k.cooldown_remaining_s}s)\`;
          badgeIcon = 'hourglass';
        } else if (k.status === 'dead') {
          badgeStyle = 'status-dead';
          badgeLabel = 'Bị khóa/Lỗi';
          badgeIcon = 'x-octagon';
        } else if (!k.available) {
          badgeStyle = 'status-dead';
          badgeLabel = 'Hết hạn mức';
          badgeIcon = 'slash';
        }

        const card = document.createElement('div');
        card.className = 'key-card glass';
        card.innerHTML = \`
          <div class="key-card-header">
            <div class="key-label">
              <span class="pulser \${k.status === 'cooling' ? 'status-cooling' : (k.status === 'dead' ? 'status-dead' : 'status-active')}"></span>
              API Key #\${k.index + 1}
            </div>
            <span class="status-badge \${badgeStyle}">
              <i data-lucide="\${badgeIcon}" style="width: 12px; height: 12px;"></i> \${badgeLabel}
            </span>
          </div>

          <div class="quota-group">
            <div class="quota-meta">
              <span>Đã dùng hôm nay</span>
              <span>\${k.requests_today} / \${SOFT_LIMIT} (\${pct}%)</span>
            </div>
            <div class="bar-container">
              <div class="fill-bar \${barColor}" style="width: \${pct}%"></div>
            </div>
          </div>

          <div class="mini-metrics">
            <div class="metric-item">
              <h4>Thành công</h4>
              <p style="color: var(--color-active)">\${k.total_success || 0}</p>
            </div>
            <div class="metric-item">
              <h4>Chờ/Limit</h4>
              <p style="color: var(--color-cooling)">\${k.total_rate_limited || 0}</p>
            </div>
            <div class="metric-item">
              <h4>Lỗi</h4>
              <p style="color: var(--color-dead)">\${k.total_errors || 0}</p>
            </div>
          </div>

          <div class="key-footer">
            <button class="btn btn-secondary btn-sm reset-key-btn" data-id="\${k.index + 1}">
              <i data-lucide="rotate-ccw" style="width: 12px; height: 12px;"></i> Reset
            </button>
          </div>
        \`;
        
        keyGrid.appendChild(card);
      });

      // Bind reset actions
      document.querySelectorAll('.reset-key-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (confirm(\`Bạn có chắc chắn muốn reset trạng thái của API Key #\${id}?\`)) {
            await runReset(id);
          }
        });
      });

      lucide.createIcons();
    }

    function renderHistory(data) {
      if (!data) return;

      // Alerts
      alertsLog.innerHTML = '';
      if (!data.alerts || data.alerts.length === 0) {
        alertsLog.innerHTML = \`
          <div class="empty-placeholder">
            <i data-lucide="shield-check" style="width: 26px; height: 26px; color: var(--color-active);"></i>
            <p>Không có cảnh báo nào gần đây.</p>
          </div>
        \`;
      } else {
        data.alerts.forEach(a => {
          const item = document.createElement('div');
          item.className = \`log-item alert-\${a.alert_type}\`;
          
          let dateText = '--:--';
          if (a.created_at) {
            const time = new Date(a.created_at + ' UTC');
            dateText = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + time.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
          }

          item.innerHTML = \`
            <div class="log-header">
              <span>\${a.alert_type.toUpperCase()}</span>
              <span>\${dateText}</span>
            </div>
            <div class="log-text">\${a.message}</div>
          \`;
          alertsLog.appendChild(item);
        });
      }

      // Reports
      reportsLog.innerHTML = '';
      if (!data.reports || data.reports.length === 0) {
        reportsLog.innerHTML = \`
          <div class="empty-placeholder">
            <i data-lucide="folder" style="width: 26px; height: 26px;"></i>
            <p>Chưa lưu báo cáo ngày nào.</p>
          </div>
        \`;
      } else {
        data.reports.forEach(r => {
          const item = document.createElement('div');
          item.className = 'report-card';
          
          const time = new Date(r.report_time);
          const timeLabel = time.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          item.innerHTML = \`
            <div class="report-header">
              <span style="color: var(--color-active);">Ngày: \${r.report_date}</span>
              <span style="color: var(--text-muted); font-size: 0.75rem;">\${timeLabel}</span>
            </div>
            <div class="report-info">
              <span>Hạng pool: <strong>\${r.pool_health}</strong></span>
              <span>Requests: <strong>\${r.total_requests_today}</strong></span>
            </div>
          \`;
          reportsLog.appendChild(item);
        });
      }

      lucide.createIcons();
    }

    // Reset api action
    async function runReset(id) {
      try {
        const res = await makeCall(\`/proxy/admin/reset-key/\${id}\`, { method: 'POST' });
        triggerToast(res.message || \`Đã reset Key #\${id} về active.\`, 'success');
        fetchStatus();
      } catch (err) {
        triggerToast(\`Reset key thất bại: \` + err.message, 'error');
      }
    }

    // Test report trigger
    async function runTestReport() {
      const btn = sendTestReportBtn;
      const cachedHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="mini-spinner"></span> Đang gửi...';
      
      try {
        const res = await makeCall('/proxy/admin/test-report', { method: 'POST' });
        triggerToast(res.message || 'Đã gửi báo cáo thủ công qua Telegram.', 'success');
        fetchHistory();
      } catch (err) {
        triggerToast('Gửi báo cáo lỗi: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = cachedHtml;
        lucide.createIcons();
      }
    }

    // Timers
    function initTimer() {
      killTimer();
      autoRefreshTimer = setInterval(() => {
        if (getStoredSecret()) {
          loadStatus();
        }
      }, POLL_TIME);
    }

    function killTimer() {
      if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
      }
    }

    // Handlers
    lockerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      updateAppSecret(lockerSecretVal.value.trim());
    });

    saveSecretBtn.addEventListener('click', () => {
      const val = topSecretVal.value.trim();
      if (val) {
        updateAppSecret(val);
        triggerToast('Đã lưu mật khẩu proxy.', 'success');
      } else {
        triggerToast('Vui lòng điền mật khẩu.', 'error');
      }
    });

    logoutBtn.addEventListener('click', () => {
      updateAppSecret('');
      triggerToast('Đã khóa giao diện.', 'info');
    });

    reloadBtn.addEventListener('click', () => {
      fetchState();
      triggerToast('Đã tải lại dữ liệu mới nhất.', 'success');
    });

    sendTestReportBtn.addEventListener('click', runTestReport);

    // Initial state
    window.addEventListener('DOMContentLoaded', () => {
      const savedPass = getStoredSecret();
      if (savedPass) {
        updateAppSecret(savedPass);
      } else {
        lockerScreen.classList.remove('hidden');
      }
      lucide.createIcons();
    });
  </script>
</body>
</html>
`;
}
