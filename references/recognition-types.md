# Recognition captcha types (`/api/captcha`)

Image-to-text, audio, Amazon AWF, and the recognition families use a **single request** to `POST /api/captcha`. There is no polling.

```bash
bhd-anticaptcha image --file captcha.png --type 14
bhd-anticaptcha audio --file audio.mp3
bhd-anticaptcha recognize --type 25 --pageurl https://example.com
bhd-anticaptcha recognize --type 26 --file shopee.png
```

## Request contract

```json
{
  "apikey": "YOUR_KEY",
  "type": 14,
  "img": "https://example.com/captcha.png"
}
```

| Field | Required | Meaning |
|---|---|---|
| `apikey` | yes | API key |
| `type` | yes | Service type from the tables below |
| `img` | image types | Image URL, raw base64, or `data:image/...;base64,...` |
| `audio` | audio type | Audio URL or base64 |
| `calc` | no | `1` for math captcha |
| `numeric` | no | `1` to force digits (avoids `0` → `O`) |
| `casesensitive` | no | `1` for case-sensitive answers |
| `pageurl` | AWF/recognition | Page URL |
| `websitekey` | AWF | `key` value from page source |
| `context` | AWF | `context` value |
| `iv` | AWF | `iv` value |
| `captcha_script` | AWF | URL of `captcha.js` |
| `challenge_script` | AWF | URL of `challenge.js` |

Other recognition families may require extra type-specific fields. Pass them with `--param key=value`.

## Response

```json
{
  "success": true,
  "message": "Thành công",
  "captcha": "764NHK",
  "base64img": "/9j/4AAQSkZJRg..."
}
```

The CLI prints `captcha` (and `type`), and omits `base64img` unless you add `--include-base64`.

Failure messages include `Api key không chính xác` and `Số xu không đủ`.

---

## Image-to-text types

Use `--file` for a local image, `--image` for a URL/base64 value, and `--type` for the kind.

| Type | Service |
|---|---|
| `0` | Generic image-to-text (other) |
| `1` | MyViettel |
| `3` | MyVina / MyVNPT |
| `5` | BotDetect |
| `6` | Facebook / Instagram |
| `7` | Garena |
| `8` | Ngọc Rồng Online (NRO) |
| `9` | Vietcombank personal |
| `14` | **Auto-detect image-to-text (default)** |
| `18` | MBBank personal |
| `19` | VietinBank personal (send SVG) |
| `28` | Electronic invoice lookup |
| `29` | Taxpayer information lookup |
| `30` | Invoice information lookup |
| `31` | BIDV online registration |
| `32` | Agribank SJC gold purchase |
| `33` | Vietcombank DigiBiz SME |
| `34` | Discord App (digits only) |
| `38` | MSB personal |
| `39` | Size 120×50 |
| `40` | BIDV personal |
| `48` | MyViettel (new) |
| `49` | MBBank enterprise |
| `50` | Visa / “Thị thực” (300×50) |
| `55` | Size 338×117 |
| `56` | Image-to-text by text color |
| `58` | Math captcha |
| `59` | ACB |
| `60` | Size 60×20 |
| `61` | Size 183×60 |

Notes:

- **Type 14** is the safest default for ordinary text-in-image captchas.
- Use `--numeric` when the answer is all digits; it prevents `0`/`O` confusion.
- Use `--calc` (and often type `58`) for arithmetic captchas; the answer should be the computed number.
- Type `19` expects the actual SVG markup, not a bitmap.
- For types with a fixed size, match the documented size before sending; upscaling a tiny captcha usually hurts accuracy.

```bash
bhd-anticaptcha image --file vcb.png --type 9
bhd-anticaptcha image --file math.png --type 58 --calc
bhd-anticaptcha image --image "data:image/png;base64,iVBOR..." --type 14
```

---

## Audio captcha — type `62`

```bash
bhd-anticaptcha audio --file audio.mp3
# or
bhd-anticaptcha recognize --type 62 --audio "https://example.com/audio.mp3"
```

The result is text, for example `Mã của bạn là 564654`. Extract the code the site expects, not necessarily the whole phrase.

---

## Amazon AWF — type `25`

```bash
bhd-anticaptcha recognize --type 25 \
  --pageurl https://norway-meetup.aws.wslab.no/ \
  --param websitekey=AQIDAH... \
  --param context=eUbRs0... \
  --param iv=EkQvKQB+S1AAAAqc \
  --param captcha_script=https://.../captcha.js \
  --param challenge_script=https://.../challenge.js
```

`websitekey`, `context`, `iv`, `captcha_script`, and `challenge_script` are needed when the page returns HTTP 405/202 to the solver and cannot be fetched directly.

Result: an `aws-waf-token` cookie value. Set it as the `aws-waf-token` cookie for the target domain, then continue the flow with the same IP/User-Agent.

---

## Recognition families

These use type-specific payloads (usually images/screenshots plus dimensions). Get exact field names from the linked docs page before solving.

| Type | Family | Docs |
|---|---|---|
| `26` | Shopee Slider | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/shopee-slider-captcha.md> |
| `27` | FunCaptcha Images Recognition | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/funcaptcha-recognize.md> |
| `41` | TikTok slider — Web | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/tiktok-keo-tha-web-+-app.md> |
| `42` | TikTok select 2 objects — Web | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/tiktok-chon-2-doi-tuong-web+app.md> |
| `43` | TikTok rotate object — Web | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/tiktok-xoay-doi-tuong-web.md> |
| `44` | TikTok slider — App | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/tiktok-keo-tha-app.md> |
| `45` | TikTok select 2 objects — App | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/tiktok-chon-2-doi-tuong-app.md> |
| `46` | Zalo drag — App | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/zalo-keo-tha-app.md> |
| `47` | Zalo select images — Web | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/zalo-chon-hinh-anh-web.md> |
| `51` | reCAPTCHA images — Web | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/recaptcha-images-recognition-web.md> |
| `52` | GeeTest images | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/geetest-captcha-recognition.md> |
| `53` | reCAPTCHA images — mobile | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/recaptcha-images-recognition-mobile-hoac-app.md> |
| `54` | Zalo select images — App | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/zalo-chon-hinh-anh-mobile-hoac-app.md> |
| `57` | TikTok rotate — App/phone | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/tiktok-xoay-doi-tuong-app.md> |
| `63` | Generic slide captcha | <https://docs2.anticaptcha.top/api-giai-captcha/api-giai-captcha-recognition/slider-captcha.md> |

The recognition families return coordinates/selection data rather than text. The CLI prints the full `captcha` value as JSON, for example:

```json
{
  "ok": true,
  "command": "recognize",
  "type": 26,
  "captcha": { "..." : "..." }
}
```

Use `recognize --type N --param k=v` and inspect the JSON. If a type needs a field the CLI does not map, `--param` passes it through unchanged.

---

## Live prices

Prices and availability change. Query them instead of hardcoding:

```bash
bhd-anticaptcha services
```

The response includes `type`, `name`, and `price` for every service.

## Choosing the right endpoint

| You have | Use |
|---|---|
| A sitekey + page URL (reCAPTCHA/hCaptcha/Turnstile/GeeTest/FunCaptcha) | `/in.php` via a token preset |
| An image file/URL | `/api/captcha` via `image` or `recognize` |
| Audio file/URL | `/api/captcha` via `audio` |
| A screenshot of a slider/selection captcha | `/api/captcha` via `recognize --type ...` |
| An unknown payload | `raw --path /api/captcha --body JSON` |
