---
name: bhd-anticaptcha
description: Solve captchas with the anticaptcha.top API from any coding agent. Use when a page or task shows reCAPTCHA v2/v3/Enterprise, hCaptcha, Cloudflare Turnstile/Challenge, GeeTest v3/v4, FunCaptcha/Arkose, Amazon AWF, image-to-text, audio, or slider/recognition captcha, or when the user asks to "giải captcha", "bypass captcha", "solve this captcha", "get a captcha token", or needs a captcha token/cookie for browser automation. Zero-dependency CLI with balance check, task creation, polling, JSON output, and multi-agent install.
---

# bhd-anticaptcha

Fast captcha solving through [anticaptcha.top](https://anticaptcha.top) for coding agents. The CLI is a single zero-dependency Node.js file (Node 18+). It never prints your API key.

## Use this skill when

- A browser or API flow is blocked by reCAPTCHA, hCaptcha, Turnstile, GeeTest, FunCaptcha, Amazon AWF, image/audio captcha, or a slider/recognition captcha.
- The user says "giải captcha", "solve captcha", "get token", "bypass captcha", or "đăng nhập tự động" and a captcha blocks it.
- You need a `g-recaptcha-response`, `h-captcha-response`, `cf-turnstile-response`, `fc-token`, GeeTest payload, or `aws-waf-token` cookie.

Do **not** use it to solve captchas at scale, to evade access controls, or on sites where automation is prohibited.

## 0. Locate the CLI

Prefer the installed command:

```bash
bhd-anticaptcha --help
```

If it is not on `PATH`, run the script from this skill directory (`$SKILL_DIR` = directory containing this `SKILL.md`):

```bash
node "$SKILL_DIR/scripts/anticaptcha.mjs" --help
```

On Windows PowerShell:

```powershell
node "$env:USERPROFILE\.agents\skills\bhd-anticaptcha\scripts\anticaptcha.mjs" --help
```

## 1. Set the API key once

Create a key at <https://anticaptcha.top> → **API Key**. Then either:

```bash
export ANTICAPTCHA_API_KEY="your-key"        # macOS/Linux/WSL
```

```powershell
$env:ANTICAPTCHA_API_KEY = "your-key"        # current PowerShell session
```

or persist it locally (mode 600):

```bash
bhd-anticaptcha config set-key YOUR_KEY
```

The CLI resolves the key in this order: `--key` → `ANTICAPTCHA_API_KEY` → `ANTICAPTCHA_KEY` → `~/.anticaptcha.json`.

## 2. Fast path: pick the captcha type

| Page shows | Command |
|---|---|
| reCAPTCHA v2 checkbox | `bhd-anticaptcha recaptcha2 --sitekey KEY --url URL` |
| reCAPTCHA v2 invisible | add `--invisible` |
| reCAPTCHA v2 Enterprise | `bhd-anticaptcha recaptcha2 --sitekey KEY --url URL --enterprise` |
| reCAPTCHA v3 | `bhd-anticaptcha recaptcha3 --sitekey KEY --url URL --action ACTION` |
| reCAPTCHA v3 Enterprise | `bhd-anticaptcha recaptcha3 --sitekey KEY --url URL --action ACTION --enterprise` |
| hCaptcha | `bhd-anticaptcha hcaptcha --sitekey KEY --url URL` |
| Cloudflare Turnstile | `bhd-anticaptcha turnstile --sitekey KEY --url URL` |
| Cloudflare Challenge | `bhd-anticaptcha turnstile --sitekey KEY --url URL --action ACTION --data DATA --pagedata PAGEDATA --user-agent UA` |
| GeeTest v3 | `bhd-anticaptcha geetest3 --gt GT --challenge CH --url URL` |
| GeeTest v4 | `bhd-anticaptcha geetest4 --captcha-id ID --url URL` |
| FunCaptcha / Arkose | `bhd-anticaptcha funcaptcha --publickey PK --url URL` |
| Image captcha (file) | `bhd-anticaptcha image --file captcha.png --type 14` |
| Image captcha (URL/base64) | `bhd-anticaptcha image --image URL_OR_BASE64 --type 14` |
| Audio captcha | `bhd-anticaptcha audio --file audio.mp3` |
| Anything else on `/api/captcha` | `bhd-anticaptcha recognize --type N --param key=value` |

All commands print JSON by default:

```json
{
  "ok": true,
  "command": "recaptcha2",
  "method": "userrecaptcha",
  "taskId": "24380427",
  "type": "token",
  "token": "03AFcWeA...",
  "result": "03AFcWeA..."
}
```

Use `--format plain` when a shell script only needs the token/captcha text. Polling is automatic: the CLI waits until the task is ready (default timeout 180 s, poll every 2 s). Tune with `--timeout 300` and `--interval 1`.

## 3. Find the parameters

- **sitekey / googlekey**: search the page HTML for `data-sitekey`, `data-pkey`, `captcha_id`, `gt`/`challenge`, or the `render=` value in the reCAPTCHA `api.js` URL.
- **pageurl**: the exact URL in the browser address bar (including the query string), not the API endpoint.
- **action** (v3/Turnstile): search JS for `grecaptcha.execute(..., {action: "..."})` or `data-action`. If unknown, omit it; the API defaults to `validate_captcha`.
- **Turnstile Challenge**: `action`, `data` (cData), `pagedata` (chlPageData), and a modern desktop `useragent` are required.
- **GeeTest v3**: `gt` is static; `challenge` is dynamic and expires. Read both immediately before solving.
- **FunCaptcha**: `publickey` is the `pk` value in `fc-token` or `data-pkey`.

## 4. Inject the result

| Type | Where the value goes |
|---|---|
| reCAPTCHA v2/v3 | `document.getElementById("g-recaptcha-response").value = TOKEN;` then submit the form or call the callback (`___grecaptcha_cfg.clients[...]...callback(TOKEN)`) |
| hCaptcha | set the `h-captcha-response` **and** `g-recaptcha-response` textareas, then submit/callback |
| Turnstile | set the `cf-turnstile-response` input to the token, then submit/callback |
| Turnstile/Cloudflare Challenge | use `result.cf_clearance` as the `cf_clearance` cookie when present (and `result.token` where the site requires it) |
| GeeTest v3 | use `result.challenge` and `result.validate` in the site's verify request |
| GeeTest v4 | send `result` (`captcha_id`, `captcha_output`, `gen_time`, `lot_number`, `pass_token`) to the site's verify endpoint |
| FunCaptcha | set `#fc-token` to the token, then submit |
| Amazon AWF | set cookie `aws-waf-token` to the returned `captcha`/`token` value |
| Image/audio | type the returned `captcha` text into the input |

For browser automation, set the value and dispatch `input`/`change` events; setting only the DOM property may not notify React/Vue. Prefer the site's callback when one exists.

## 5. Rules and pitfalls

- **One task per captcha.** Creating a task costs balance; do not retry `in.php` blindly. Polling is already handled.
- **Tokens expire fast** (often around 120 s). Solve immediately before submitting; do not cache tokens.
- **Use the exact page URL and matching proxy/User-Agent.** A mismatched IP/UA is the most common cause of invalid tokens.
- **No proxy by default.** If the target site requires the same IP, pass `--proxy "ip:port:user:pass"` (or the `--proxy-type` / `--proxy-address` / `--proxy-port` / `--proxy-login` / `--proxy-password` flags).
- **Never print the API key.** The CLI redacts it; do not echo `ANTICAPTCHA_API_KEY` in logs or commit `~/.anticaptcha.json`.
- **Check balance first** when a task fails with `INSUFFICIENT_BALANCE`: `bhd-anticaptcha balance`.
- **Exit codes**: `0` success, `1` API/task error, `2` usage/config error, `3` solve timeout, `4` network/HTTP error.

## 6. Command reference

```text
bhd-anticaptcha balance
bhd-anticaptcha services
bhd-anticaptcha doctor

bhd-anticaptcha token --method userrecaptcha --param googlekey=KEY --param pageurl=URL
bhd-anticaptcha recaptcha2  --sitekey KEY --url URL [--invisible] [--enterprise]
bhd-anticaptcha recaptcha3  --sitekey KEY --url URL [--action ACTION] [--enterprise]
bhd-anticaptcha hcaptcha    --sitekey KEY --url URL [--invisible]
bhd-anticaptcha turnstile   --sitekey KEY --url URL [--action A] [--data D] [--pagedata P] [--user-agent UA]
bhd-anticaptcha geetest3    --gt GT --challenge CH --url URL [--api-server HOST]
bhd-anticaptcha geetest4    --captcha-id ID --url URL
bhd-anticaptcha funcaptcha  --publickey PK --url URL [--surl SURL]

bhd-anticaptcha image --file PATH --type 14 [--numeric] [--calc] [--case-sensitive]
bhd-anticaptcha audio --file PATH
bhd-anticaptcha recognize --type N [--image URL_OR_BASE64] [--file PATH] [--audio URL_OR_BASE64] [--param k=v]

bhd-anticaptcha raw --path /in.php --body '{"method":"...","...":"..."}'
bhd-anticaptcha config set-key KEY
bhd-anticaptcha config show
bhd-anticaptcha config path
```

Global options: `--key`, `--base-url`, `--timeout`, `--interval`, `--format json|plain`, `--verbose`, `--help`, `--version`.

## 7. References

Read only the file you need:

- [`references/api.md`](references/api.md) — endpoints, auth, polling, error codes, raw HTTP.
- [`references/captcha-types.md`](references/captcha-types.md) — every token method and parameter.
- [`references/recognition-types.md`](references/recognition-types.md) — image/audio/AWF types and recognition families.
- [`references/agent-install.md`](references/agent-install.md) — install paths for Codex, Claude Code, Antigravity, Oh My Pi, DSH, and generic agents.

Official docs: <https://docs2.anticaptcha.top/> · `llms.txt`: <https://docs2.anticaptcha.top/llms.txt>
