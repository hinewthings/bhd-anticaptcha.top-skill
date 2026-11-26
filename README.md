# bhd-anticaptcha

Skill giải captcha qua **[anticaptcha.top](https://anticaptcha.top)** cho mọi coding agent: Codex, Claude Code, Google Antigravity, Oh My Pi (OMP), DeepSeek Harness (DSH) và các agent đọc chuẩn `SKILL.md`.

- **Zero dependency**: một file Node.js 18+ (`scripts/anticaptcha.mjs`), không cần `npm install`.
- **Gọi nhanh**: `bhd-anticaptcha recaptcha2 --sitekey ... --url ...` → nhận token trong một lệnh.
- **Tự poll**: tạo task rồi chờ kết quả, tự xử lý `CAPCHA_NOT_READY`.
- **JSON sạch**: stdout chỉ có JSON; log/polling đi stderr; API key không bao giờ bị in ra.
- **Đa nền tảng**: Windows, macOS, Linux; tự nhận diện và cài cho nhiều agent.

Tài liệu gốc API: <https://docs2.anticaptcha.top/> · [`llms.txt`](https://docs2.anticaptcha.top/llms.txt)

---

## 1. Cài đặt nhanh (30 giây)

### Cách A — clone trực tiếp vào thư mục skill chung (khuyên dùng)

Đường dẫn `~/.agents/skills` được Codex, DSH, Antigravity (workspace) và nhiều agent khác đọc; OMP còn có đường dẫn native `~/.omp/agent/skills` (installer tự xử lý).

**PowerShell (Windows):**

```powershell
git clone https://github.com/hinewthings/bhd-anticaptcha.top-skill.git "$env:USERPROFILE\.agents\skills\bhd-anticaptcha"
```

**macOS / Linux / WSL:**

```bash
git clone https://github.com/hinewthings/bhd-anticaptcha.top-skill.git ~/.agents/skills/bhd-anticaptcha
```

### Cách B — clone ở đâu cũng được, rồi chạy installer

```powershell
git clone https://github.com/hinewthings/bhd-anticaptcha.top-skill.git D:\tools\bhd-anticaptcha
node D:\tools\bhd-anticaptcha\scripts\install.mjs --target auto
```

Installer sẽ cài vào các thư mục agent đang có trên máy:

| Target | Vị trí |
|---|---|
| `agents` | `~/.agents/skills/bhd-anticaptcha` (Codex, OMP, DSH, Antigravity workspace) |
| `claude` | `~/.claude/skills/bhd-anticaptcha` |
| `antigravity` | `~/.gemini/config/skills/bhd-anticaptcha` |
| `omp` | `~/.omp/agent/skills/bhd-anticaptcha` |

```bash
node scripts/install.mjs --target all          # cài tất cả
node scripts/install.mjs --target agents,claude
node scripts/install.mjs --project --target agents,claude,omp   # cài vào project hiện tại
node scripts/install.mjs --target claude --force                # ghi đè bản cũ
node scripts/install.mjs --target claude --link                 # symlink/junction thay vì copy
```

### Cách C — có lệnh `bhd-anticaptcha` trên PATH (tuỳ chọn)

```bash
cd bhd-anticaptcha
npm link
bhd-anticaptcha --version
```

Không có `npm link` vẫn dùng được bằng:

```bash
node ~/.agents/skills/bhd-anticaptcha/scripts/anticaptcha.mjs --help
```

---

## 2. Lấy API key và cấu hình

1. Đăng ký / đăng nhập <https://anticaptcha.top>.
2. Vào mục **API Key** để tạo key.
3. Đặt key theo một trong các cách:

```powershell
# Windows PowerShell — chỉ có hiệu lực trong session hiện tại
$env:ANTICAPTCHA_API_KEY = "your-key"
```

```bash
# macOS / Linux / WSL
export ANTICAPTCHA_API_KEY="your-key"
```

Hoặc lưu cố định (file `~/.anticaptcha.json`, quyền 600):

```bash
bhd-anticaptcha config set-key YOUR_KEY
bhd-anticaptcha config show
```

Thứ tự ưu tiên: `--key` → `ANTICAPTCHA_API_KEY` → `ANTICAPTCHA_KEY` → `~/.anticaptcha.json`.

Kiểm tra:

```bash
bhd-anticaptcha balance
bhd-anticaptcha doctor
```

---

## 3. Dùng nhanh

### reCAPTCHA v2

```bash
bhd-anticaptcha recaptcha2 \
  --sitekey 6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ- \
  --url https://www.google.com/recaptcha/api2/demo
```

Kết quả:

```json
{
  "ok": true,
  "command": "recaptcha2",
  "method": "userrecaptcha",
  "taskId": "24380427",
  "type": "token",
  "token": "03AFcWeA7OjvYPKyn4iQv-7qnAFn6CxB6v50IQnQN_7Hng3OLKglKV...",
  "result": "03AFcWeA7OjvYPKyn4iQv-7qnAFn6CxB6v50IQnQN_7Hng3OLKglKV..."
}
```

Chỉ lấy token cho script:

```bash
TOKEN=$(bhd-anticaptcha recaptcha2 --sitekey KEY --url URL --format plain)
```

### Các loại phổ biến

```bash
# reCAPTCHA v3 (+ Enterprise)
bhd-anticaptcha recaptcha3 --sitekey KEY --url URL --action login
bhd-anticaptcha recaptcha3 --sitekey KEY --url URL --action login --enterprise

# hCaptcha
bhd-anticaptcha hcaptcha --sitekey KEY --url URL

# Cloudflare Turnstile
bhd-anticaptcha turnstile --sitekey KEY --url URL

# Cloudflare Challenge (cần action + data + pagedata + user-agent)
bhd-anticaptcha turnstile --sitekey KEY --url URL \
  --action managed --data CDATA --pagedata PAGEDATA \
  --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

# GeeTest v3 / v4
bhd-anticaptcha geetest3 --gt GT --challenge CHALLENGE --url URL
bhd-anticaptcha geetest4 --captcha-id CAPTCHA_ID --url URL

# FunCaptcha / Arkose
bhd-anticaptcha funcaptcha --publickey PK --url URL

# Captcha ảnh (file hoặc URL/base64)
bhd-anticaptcha image --file captcha.png --type 14
bhd-anticaptcha image --image "https://example.com/captcha.png" --type 14

# Captcha ảnh toàn số (tránh 0 thành O)
bhd-anticaptcha image --file captcha.png --type 14 --numeric

# Audio captcha
bhd-anticaptcha audio --file audio.mp3
```

### Proxy (khi site yêu cầu cùng IP)

```bash
bhd-anticaptcha recaptcha2 --sitekey KEY --url URL \
  --proxy "103.124.95.45:8686:user:pass"
```

Hoặc tách riêng:

```bash
--proxy-type http --proxy-address 103.124.95.45 --proxy-port 8686 \
--proxy-login user --proxy-password pass
```

### API thô / loại chưa có preset

```bash
# Gọi bất kỳ endpoint nào, tự inject key
bhd-anticaptcha raw --path /in.php \
  --body '{"method":"hcaptcha","sitekey":"KEY","pageurl":"https://example.com"}'

# Các loại recognition trên /api/captcha
bhd-anticaptcha recognize --type 25 --param pageurl=https://example.com
```

---

## 4. Skill dùng chung cho nhiều agent

Chi tiết đầy đủ ở [`references/agent-install.md`](references/agent-install.md). Tóm tắt:

| Agent | Thư mục đọc skill |
|---|---|
| **Codex** | `~/.agents/skills/` hoặc `<repo>/.agents/skills/` |
| **Claude Code** | `~/.claude/skills/` hoặc `<repo>/.claude/skills/` |
| **Google Antigravity** | `<repo>/.agents/skills/`; global `~/.gemini/config/skills/` |
| **Oh My Pi (OMP)** | `~/.omp/agent/skills/`, `<repo>/.omp/skills/`; cũng đọc `.agents/skills/` |
| **DeepSeek Harness (DSH)** | `~/.agents/skills/` |
| Agent khác | Trỏ tới thư mục chứa `SKILL.md` theo chuẩn Agent Skills |

Cách gọi:

- **Claude Code / Codex / Antigravity / DSH**: yêu cầu agent dùng skill `bhd-anticaptcha` (skill tự xuất hiện trong catalog sau khi khởi động lại session).
- **Oh My Pi**: `/skill:bhd-anticaptcha` hoặc yêu cầu trực tiếp.
- **Mọi agent**: có thể chạy CLI trực tiếp bằng `node .../scripts/anticaptcha.mjs` mà không cần cơ chế skill.

---

## 5. Cấu trúc repo

```text
bhd-anticaptcha.top-skill/
├─ SKILL.md                      # entrypoint cho agent (name + description + workflow)
├─ README.md                     # tài liệu cho người dùng
├─ package.json                  # bin + test script (không publish npm)
├─ agents/
│  └─ openai.yaml                # metadata interface cho Codex
├─ bin/
│  ├─ bhd-anticaptcha            # launcher cho macOS/Linux
│  └─ bhd-anticaptcha.cmd        # launcher cho Windows
├─ scripts/
│  ├─ anticaptcha.mjs            # CLI chính, zero dependency
│  └─ install.mjs                # cài skill cho nhiều agent
├─ references/
│  ├─ api.md                     # endpoint, auth, polling, mã lỗi
│  ├─ captcha-types.md           # tham số từng loại token
│  ├─ recognition-types.md       # image/audio/AWF/recognition
│  └─ agent-install.md           # đường dẫn cài cho từng agent
└─ tests/
   └─ smoke.mjs                  # test với mock server, không tốn balance
```

---

## 6. Lỗi thường gặp

| Mã | Ý nghĩa | Cách xử lý |
|---|---|---|
| `MISSING_API_KEY` | Chưa có key | Đặt `ANTICAPTCHA_API_KEY` hoặc `config set-key` |
| `INVALID_API_KEY` | Key sai | Kiểm tra lại key trên anticaptcha.top |
| `INSUFFICIENT_BALANCE` | Hết số dư | Nạp thêm, rồi `bhd-anticaptcha balance` |
| `SOLVE_TIMEOUT` | Quá thời gian chờ | Tăng `--timeout 300`; kiểm tra task trên dashboard |
| `TOKEN_EXPIRED` | GeeTest challenge hết hạn | Lấy `challenge` mới rồi giải lại |
| `NETWORK_ERROR` | Không kết nối được | Kiểm tra mạng/proxy/firewall |
| `HTTP_ERROR` | HTTP 4xx/5xx | Xem status trong `error.details` |

Lưu ý:

- **Không retry `in.php` tự động** — mỗi task có thể bị tính phí. CLI đã poll `res.php` giúp bạn.
- **Token hết hạn nhanh** (thường ~120 giây) — giải xong dùng ngay.
- **Sai IP/User-Agent** là nguyên nhân phổ biến nhất khiến token bị site từ chối; truyền proxy/UA khớp với trình duyệt.

---

## 7. Bảo mật

- Không commit `~/.anticaptcha.json` hoặc biến môi trường chứa key.
- CLI không in key; lỗi chỉ hiển thị message từ API.
- Key lưu trong `~/.anticaptcha.json` với mode `600` (trên Windows, quyền file phụ thuộc ACL của user).
- Chỉ dùng cho mục đích hợp pháp, tuân thủ điều khoản của trang web mục tiêu.

---

## 8. Phát triển / test

```bash
node tests/smoke.mjs
# hoặc
npm test
```

Test dùng mock server nội bộ, không gọi API thật và không tốn balance.

## License

MIT © 2026 hinewthings
