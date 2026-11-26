# Token captcha types

These types use the two-step flow: `POST /in.php` → task id, then poll `GET /res.php`.

The CLI wraps both steps:

```bash
bhd-anticaptcha <preset> [options]
# or
bhd-anticaptcha token --method METHOD --param key=value
```

## Common options

| CLI flag | API field | Notes |
|---|---|---|
| `--key` | `key` | Or `ANTICAPTCHA_API_KEY` |
| `--proxy "ip:port:user:pass"` | `proxy` | Same-IP requirement |
| `--proxy-type http\|https\|socks5` | `proxyType` | GeeTest docs mention `socks` in one place; prefer `socks5` |
| `--proxy-address HOST` | `proxyAddress` | |
| `--proxy-port PORT` | `proxyPort` | |
| `--proxy-login USER` | `proxyLogin` | |
| `--proxy-password PASS` | `proxyPassword` | |
| `--user-agent UA` | `userAgent` / `useragent` | Turnstile uses lowercase `useragent` |
| `--param k=v` | arbitrary | Repeatable; wins over preset fields |
| `--body JSON` | arbitrary | Advanced JSON merge |
| `--timeout SEC` | — | Solve deadline, default 180 |
| `--interval SEC` | — | Poll interval, default 2 |

---

## reCAPTCHA v2

Method: `userrecaptcha`

Identify: a `g-recaptcha` div with `data-sitekey`, or an iframe whose URL contains `/recaptcha/api2/anchor`.

```bash
bhd-anticaptcha recaptcha2 \
  --sitekey 6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ- \
  --url https://www.google.com/recaptcha/api2/demo
```

| API field | Required | Notes |
|---|---|---|
| `googlekey` | yes | The `data-sitekey` value |
| `pageurl` | yes | Exact page URL |
| `invisible` | no | `1` when the iframe URL has `size=invisible` |
| `enterprise` | no | `1` when the page loads `enterprise.js` instead of `api.js` |

Result: a token string. Inject:

```js
document.getElementById('g-recaptcha-response').value = token;
// or, for callback-based widgets:
myCallback(token);
```

Find the callback via `data-callback`, `grecaptcha.render(..., {callback})`, or `___grecaptcha_cfg.clients[0].aa.l.callback`.

If the page uses `display:none` on the textarea, set the value with JS rather than trying to type into it.

---

## reCAPTCHA v2 Enterprise

Method: `userrecaptcha` plus `enterprise: 1`.

```bash
bhd-anticaptcha recaptcha2 --sitekey KEY --url URL --enterprise
```

Result and injection are identical to v2. The only difference is the `enterprise` flag.

---

## reCAPTCHA v3

Method: `userrecaptcha`, `version: "v3"`.

Identify: `api.js?render=SITEKEY`, or `___grecaptcha_cfg.clients[100000]`, or `grecaptcha.execute(...)`.

```bash
bhd-anticaptcha recaptcha3 --sitekey KEY --url URL --action login
```

| API field | Required | Notes |
|---|---|---|
| `googlekey` | yes | Sitekey from `render=` |
| `pageurl` | yes | Exact page URL |
| `version` | yes | Must be `v3` |
| `action` | no | Defaults to `validate_captcha` |
| `enterprise` | no | `1` for Enterprise |

Result: token string. The site may expect it in a hidden field such as `g-recaptcha-response-100000`, in a POST body, or through a JS callback. Inspect the site's network request and mirror it.

---

## reCAPTCHA v3 Enterprise

Method: `userrecaptcha`, `version: "v3"`, `enterprise: 1`.

```bash
bhd-anticaptcha recaptcha3 --sitekey KEY --url URL --action login --enterprise
```

Result and injection are the same as v3.

---

## hCaptcha

Method: `hcaptcha`

Identify: `<div class="h-captcha" data-sitekey="...">` or an iframe from `hcaptcha.com`.

```bash
bhd-anticaptcha hcaptcha --sitekey d121ad2d-b38b-4398-84ec-acd9633d5119 --url https://example.com
```

| API field | Required | Notes |
|---|---|---|
| `sitekey` | yes | `data-sitekey` value |
| `pageurl` | yes | Exact page URL |
| `invisible` | no | `1` when the iframe URL has `size=invisible` |

Result: token string. Inject into **both** fields when present:

```js
document.getElementById('h-captcha-response').value = token;
document.getElementById('g-recaptcha-response').value = token;
```

Then submit the form or call the widget callback.

---

## Cloudflare Turnstile

Method: `turnstile`

Identify: `cf-turnstile` div, `data-sitekey` starting with `0x`, or `challenges.cloudflare.com/turnstile`.

```bash
bhd-anticaptcha turnstile --sitekey 0x4AAAAAAAEwzhD6pyKkgXC0 --url https://example.com
```

| API field | Required | Notes |
|---|---|---|
| `sitekey` | yes | `data-sitekey` |
| `pageurl` | yes | Exact page URL |
| `action` | Challenge only | From `data-action` or `Turnstile.render` |
| `data` | Challenge only | cData from `Turnstile.render` |
| `pagedata` | Challenge only | chlPageData |
| `useragent` | Challenge only | Modern desktop UA (lowercase field) |
| `userAgent` | no | Some deployments accept this too |

Result for Turnstile is usually a token string; for Challenge it can be a JSON object/string:

```json
{ "token": "0.z95PTvjFvCW...", "cf_clearance": null }
```

Inject the token into:

```js
document.querySelector('[name="cf-turnstile-response"]').value = token;
```

For a Cloudflare Challenge, set `cf_clearance` as a cookie when the result provides it. A `cf_clearance` value is tied to the IP and User-Agent used to solve it, so reuse the same proxy/UA.

---

## GeeTest v3

Method: `geetest`

Identify: a script from `geetest.com` containing `gt=` and `challenge=`, or an `initGeetest` call with those values.

```bash
bhd-anticaptcha geetest3 --gt 022397c99c9f646f6477822485f30404 --challenge 52f990c29c603c9cbaa5beb773b627be --url https://www.geetest.com/en/demo
```

| API field | Required | Notes |
|---|---|---|
| `gt` | yes | Static site identifier |
| `challenge` | yes | Dynamic; expires quickly |
| `pageurl` | yes | Exact page URL |
| `api_server` | no | For example `api-na.geetest.com` |

Result object:

```json
{
  "challenge": "0f759dd1ea6c4wc76cedc2991039ca4f23",
  "validate": "6275e26419211d1f526e674d97110e15"
}
```

Send **both** `challenge` and `validate` in the site's verification request. A challenge is single-use and expires; if the API returns `ERROR_TOKEN_EXPIRED`, fetch a fresh `challenge` and solve again.

---

## GeeTest v4

Method: `geetest_v4`

Identify: a GeeTest v4 script containing `captcha_id=`.

```bash
bhd-anticaptcha geetest4 --captcha-id fcd636b4514bf7ac4143922550b3008b --url https://www.geetest.com/en/adaptive-captcha-demo
```

| API field | Required | Notes |
|---|---|---|
| `captcha_id` | yes | From the v4 script URL |
| `pageurl` | yes | Exact page URL |

Result object:

```json
{
  "captcha_id": "fcd636b4514bf7ac4143922550b3008b",
  "captcha_output": "rF8vMuXmInfq...",
  "gen_time": "1702645283",
  "lot_number": "4741122537184ea9a42d0aece03d7562",
  "pass_token": "7a6c4754b0fc..."
}
```

Send the whole object to the site's verify endpoint. Do not send only `pass_token`.

---

## FunCaptcha / Arkose Labs

Method: `funcaptcha`

Identify: `data-pkey`, an `fc-token` input, or an iframe from `arkoselabs.com` / `funcaptcha.com`.

```bash
bhd-anticaptcha funcaptcha --publickey 3117BF26-4762-4F5A-8ED9-A85E69209A46 --url https://example.com
```

| API field | Required | Notes |
|---|---|---|
| `publickey` | yes | `pk` value or `data-pkey` |
| `pageurl` | yes | Exact page URL |
| `surl` | no | `surl` parameter found on the page |
| `data[key]` | no | Extra blob values, e.g. `--param "data[blob]=..."` |

Result: a long token string. Inject into the `fc-token` input, then submit the form or trigger the site's callback.

---

## Proxies

The docs support two styles:

```json
{ "proxy": "103.124.95.45:8686:user:pass" }
```

or separate fields:

```json
{
  "proxyType": "http",
  "proxyAddress": "103.124.95.45",
  "proxyPort": "8686",
  "proxyLogin": "user",
  "proxyPassword": "pass"
}
```

Use the same proxy IP for solving and for the target request. For `cf_clearance`, the User-Agent must also match.

---

## Result handling cheat sheet

| Method | `result` | What to send to the site |
|---|---|---|
| `userrecaptcha` | string | `g-recaptcha-response` |
| `hcaptcha` | string | `h-captcha-response` and `g-recaptcha-response` |
| `turnstile` | string or `{token, cf_clearance}` | `cf-turnstile-response`, and/or `cf_clearance` cookie |
| `geetest` | `{challenge, validate}` | both fields |
| `geetest_v4` | object | all five fields |
| `funcaptcha` | string | `fc-token` |

For GeeTest/Turnstile v3-style flows, `bhd-anticaptcha ... --format plain` prints only the convenience `token`, which may be `validate` for GeeTest. Use JSON output when you need the full object.
