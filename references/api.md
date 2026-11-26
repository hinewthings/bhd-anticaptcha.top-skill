# API reference (anticaptcha.top V2)

Official docs: <https://docs2.anticaptcha.top/> · index: <https://docs2.anticaptcha.top/llms.txt>

Base origin: `https://anticaptcha.top`

## Authentication

Every paid request needs your API key. Create it at <https://anticaptcha.top> → **API Key**.

- Token flow (`/in.php`): field `key`
- Recognition flow (`/api/captcha`): field `apikey`
- Balance (`/api/getbalance`): query parameter `apikey`
- Result (`/res.php`): query parameter `key`

The CLI resolves the key from `--key`, `ANTICAPTCHA_API_KEY`, `ANTICAPTCHA_KEY`, `ANTICAPTCHA_TOP_API_KEY`, or `~/.anticaptcha.json`.

## Endpoints

| Purpose | Method | Path | Key field |
|---|---|---|---|
| Balance | `GET` | `/api/getbalance?apikey=...` | `apikey` |
| Services / prices | `GET` | `/api/getservice` | none |
| Create token task | `POST` | `/in.php` | `key` |
| Poll token task | `GET` | `/res.php?key=...&id=...&json=1` | `key` |
| Image / audio / recognition | `POST` | `/api/captcha` | `apikey` |

All requests and responses are JSON unless noted. `Content-Type: application/json` is accepted by both POST endpoints.

## Balance

```http
GET https://anticaptcha.top/api/getbalance?apikey=YOUR_KEY
```

```json
{
  "success": true,
  "message": "Thành công",
  "balance": 149204
}
```

`balance` is an integer in the service's internal coin unit. Failure example:

```json
{ "success": false, "message": "Api key không chính xác" }
```

## Services

```http
GET https://anticaptcha.top/api/getservice
```

```json
{
  "success": true,
  "message": "Thành công",
  "data": [
    { "type": 11, "name": "ReCaptcha V2", "price": 30 },
    { "type": 15, "name": "HCaptcha", "price": 32 }
  ]
}
```

Use this endpoint for live prices. The `type` values are also used by `/api/captcha` for recognition services.

## Create a token task — `POST /in.php`

Request body (JSON):

```json
{
  "key": "YOUR_KEY",
  "method": "userrecaptcha",
  "googlekey": "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
  "pageurl": "https://www.google.com/recaptcha/api2/demo",
  "json": 1
}
```

Common fields:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `key` | string | yes | API key |
| `method` | string | yes | Task type (`userrecaptcha`, `hcaptcha`, `turnstile`, `geetest`, `geetest_v4`, `funcaptcha`) |
| `json` | int | no | `1` → JSON responses; `0` → text (default) |
| `pageurl` | string | usually | Exact page URL |
| `proxy` | string | no | `ip:port:user:pass` |
| `proxyType` | string | no | `http`, `https`, `socks5` |
| `proxyAddress` | string | no | Proxy host/IP |
| `proxyPort` | string | no | Proxy port |
| `proxyLogin` | string | no | Proxy username |
| `proxyPassword` | string | no | Proxy password |
| `userAgent` | string | no | Browser User-Agent used to load the captcha |

Response with `json=1`:

```json
{ "status": 1, "request": "24380427" }
```

Failure:

```json
{ "status": 0, "request": "Apikey incorrect" }
```

Text mode (`json=0` or omitted): `OK|24380427`.

The `request` value is the **task id**. Creating a task can charge your balance; do not retry blindly.

## Poll a token task — `GET /res.php`

```http
GET https://anticaptcha.top/res.php?key=YOUR_KEY&id=24380427&json=1
```

Processing:

```json
{ "status": 0, "request": "CAPCHA_NOT_READY" }
```

Success:

```json
{ "status": 1, "request": "03AFcWeA7OjvYPKyn4iQv-7qnAFn6CxB6v50IQnQN_7Hng3OLKglKV..." }
```

For GeeTest v3 the success `request` is an object:

```json
{
  "status": 1,
  "request": {
    "challenge": "0f759dd1ea6c4wc76cedc2991039ca4f23",
    "validate": "6275e26419211d1f526e674d97110e15"
  }
}
```

For Turnstile/Challenge it may be a **JSON string**:

```json
{
  "status": 1,
  "request": "{\"token\":\"0.z95PTvjFvCW...\",\"cf_clearance\":null}"
}
```

The CLI parses nested JSON strings and exposes both `result` (parsed) and `token` (convenience value).

Failure:

```json
{ "status": 0, "request": "Id does not exist" }
```

Text mode returns `OK|<result>` or `CAPCHA_NOT_READY`.

### Polling algorithm

1. `POST /in.php` → task id.
2. Sleep 1–2 s.
3. `GET /res.php?key=...&id=...&json=1`.
4. If `status == 1`, use `request`.
5. If `request` is `CAPCHA_NOT_READY` (note the API spelling) or `CAPTCHA_NOT_READY`, repeat.
6. If any other error, stop and report it.
7. Enforce a deadline (the CLI default is 180 s) to avoid endless polling.

## Recognition — `POST /api/captcha`

Used by image-to-text, audio, Amazon AWF, and the recognition families (TikTok, Zalo, Shopee, Geetest images, reCAPTCHA images, etc.).

Image example:

```json
{
  "apikey": "YOUR_KEY",
  "img": "https://example.com/captcha.png",
  "type": 14
}
```

`img` accepts a public image URL, raw base64, or a `data:image/...;base64,...` URI. For some types (for example VietinBank) it is an SVG string.

Success:

```json
{
  "success": true,
  "message": "Thành công",
  "captcha": "764NHK",
  "base64img": "/9j/4AAQSkZJRgABAgAAAQABAAsLDBkSEw8UHRofHh0aHBwgJC4nICI..."
}
```

Failure:

```json
{ "success": false, "message": "Số xu không đủ", "captcha": "" }
```

The CLI omits `base64img` by default; add `--include-base64` if you need it.

## Error messages

| API message | CLI code | Meaning |
|---|---|---|
| `Apikey incorrect` / `Api key không chính xác` | `INVALID_API_KEY` | Wrong or missing key |
| `Balance not enough` / `Số xu không đủ` | `INSUFFICIENT_BALANCE` | Top up the account |
| `Id does not exist` | `TASK_NOT_FOUND` | Bad/expired task id |
| `CAPCHA_NOT_READY` | — | Still processing; keep polling |
| `ERROR_TOKEN_EXPIRED` | `TOKEN_EXPIRED` | GeeTest challenge expired; fetch a new one |
| `ERROR_...` (other) | `API_ERROR` | Inspect the exact message |

## Charging and retry rules

- A successfully created task may be charged even if the result later fails or expires (for example GeeTest `ERROR_TOKEN_EXPIRED`).
- Never retry `POST /in.php` automatically after a timeout. Check the dashboard or create a new task only when you know the first one was not created.
- Polling `GET /res.php` is free; poll at 1–3 s intervals.
- Tokens are short-lived. Submit them to the target site immediately.

## Minimal curl examples

```bash
# Balance
curl "https://anticaptcha.top/api/getbalance?apikey=$ANTICAPTCHA_API_KEY"

# Create reCAPTCHA v2 task
curl -sS https://anticaptcha.top/in.php \
  -H 'content-type: application/json' \
  -d "{\"key\":\"$ANTICAPTCHA_API_KEY\",\"method\":\"userrecaptcha\",\"googlekey\":\"SITEKEY\",\"pageurl\":\"https://example.com\",\"json\":1}"

# Poll
curl "https://anticaptcha.top/res.php?key=$ANTICAPTCHA_API_KEY&id=TASK_ID&json=1"

# Image captcha
curl -sS https://anticaptcha.top/api/captcha \
  -H 'content-type: application/json' \
  -d "{\"apikey\":\"$ANTICAPTCHA_API_KEY\",\"type\":14,\"img\":\"https://example.com/captcha.png\"}"
```

## CLI escape hatch

For any endpoint or parameter not covered by a preset:

```bash
bhd-anticaptcha raw --path /in.php --body '{"method":"...","...":"..."}'
bhd-anticaptcha raw --path /api/captcha --body '{"type":26,"...":"..."}'
bhd-anticaptcha raw --path /res.php --id TASK_ID
```

The CLI injects the API key when it recognizes `/in.php`, `/res.php`, `/api/captcha`, or `/api/getbalance`.
