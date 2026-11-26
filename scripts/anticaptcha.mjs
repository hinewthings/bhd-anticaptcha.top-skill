#!/usr/bin/env node
/**
 * bhd-anticaptcha — zero-dependency CLI for anticaptcha.top
 *
 * Docs: https://docs2.anticaptcha.top/
 * Node: >=18 (global fetch)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0';
const DEFAULT_BASE_URL = 'https://anticaptcha.top';
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(os.homedir(), '.anticaptcha.json');
const INT_FIELDS = new Set([
  'json',
  'invisible',
  'enterprise',
  'numeric',
  'calc',
  'casesensitive',
  'type',
]);

const USAGE = `bhd-anticaptcha ${VERSION} — anticaptcha.top captcha solver

Usage:
  bhd-anticaptcha <command> [options]

Commands:
  balance                         Show account balance
  services                        List services and prices
  doctor                          Check Node, key, base URL and balance

  token --method METHOD           Generic token task (/in.php + /res.php)
  recaptcha2 --sitekey K --url U  reCAPTCHA v2 (add --invisible / --enterprise)
  recaptcha3 --sitekey K --url U  reCAPTCHA v3 (--action, --enterprise)
  hcaptcha   --sitekey K --url U  hCaptcha
  turnstile  --sitekey K --url U  Cloudflare Turnstile/Challenge
  geetest3   --gt G --challenge C --url U
  geetest4   --captcha-id ID --url U
  funcaptcha --publickey PK --url U

  image --file PATH --type 14     Image captcha (also --image URL/base64)
  audio --file PATH               Audio captcha (type 62)
  recognize --type N              Generic /api/captcha payload
  raw --path /in.php --body JSON  Raw API escape hatch

  config set-key KEY              Save key to ~/.anticaptcha.json
  config show                     Show key source (masked)
  config path                     Print config path

Global options:
  --key <key>                     API key (or ANTICAPTCHA_API_KEY)
  --base-url <url>                API origin (default https://anticaptcha.top)
  --timeout <seconds>             Solve timeout (default 180)
  --interval <seconds>            Poll interval (default 2)
  --format json|plain             Output format (default json)
  --verbose                       Progress on stderr
  -h, --help                      Show this help
  -V, --version                   Show version

Examples:
  bhd-anticaptcha balance
  bhd-anticaptcha recaptcha2 --sitekey 6Le... --url https://example.com/login
  bhd-anticaptcha image --file captcha.png --type 14 --numeric
  TOKEN=$(bhd-anticaptcha hcaptcha --sitekey KEY --url URL --format plain)

Docs: https://docs2.anticaptcha.top/
`;

class CliError extends Error {
  constructor(code, message, details = undefined, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.details = details;
    this.exitCode = exitCode;
  }
}

function usageError(message, hint = undefined) {
  return new CliError('USAGE_ERROR', message, hint ? { hint } : undefined, 2);
}

function toCamel(name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const opts = { positionals: [], params: {}, query: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      opts.positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '-V') {
      opts.version = true;
      continue;
    }
    if (arg.startsWith('--')) {
      let name = arg.slice(2);
      let value;
      const eq = name.indexOf('=');
      if (eq >= 0) {
        value = name.slice(eq + 1);
        name = name.slice(0, eq);
      } else if (i + 1 < argv.length && (!argv[i + 1].startsWith('-') || argv[i + 1] === '-')) {
        value = argv[i + 1];
        i += 1;
      } else {
        value = true;
      }
      const key = toCamel(name);
      if (key === 'apiKey' || key === 'apikey') {
        opts.key = value;
      } else if (key === 'param' || key === 'query') {
        if (typeof value !== 'string' || !value.includes('=')) {
          throw usageError(`--${name} expects key=value`, `Example: --${name} pageurl=https://example.com`);
        }
        const at = value.indexOf('=');
        opts[key][value.slice(0, at)] = value.slice(at + 1);
      } else {
        opts[key] = value;
      }
      continue;
    }
    if (arg.startsWith('-') && arg.length > 1) {
      throw usageError(`Unknown option: ${arg}`);
    }
    opts.positionals.push(arg);
  }
  return opts;
}

function getBaseUrl(opts) {
  const configured = readConfig();
  const raw =
    opts.baseUrl ||
    process.env.ANTICAPTCHA_BASE_URL ||
    configured?.baseUrl ||
    DEFAULT_BASE_URL;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw usageError('Invalid --base-url value');
  }
  return raw.trim().replace(/\/+$/, '');
}

function parseSeconds(value, fallback, flag, minimum) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw usageError(`${flag} must be a positive number of seconds`);
  }
  return Math.max(minimum, number);
}

function timeoutMs(opts) {
  return Math.round(parseSeconds(opts.timeout, 180, '--timeout', 0.1) * 1000);
}

function intervalMs(opts) {
  return Math.round(parseSeconds(opts.interval, 2, '--interval', 0.05) * 1000);
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function readConfigStrict() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('expected a JSON object');
    }
    return data;
  } catch (error) {
    throw new CliError(
      'CONFIG_INVALID',
      `Cannot parse ${CONFIG_PATH}: ${error.message}`,
      { hint: 'Fix or delete the file, or run: bhd-anticaptcha config set-key YOUR_KEY' },
      2,
    );
  }
}

function resolveApiKey(opts, { required = true } = {}) {
  if (typeof opts.key === 'string' && opts.key.trim()) {
    return { key: opts.key.trim(), source: '--key' };
  }
  for (const name of ['ANTICAPTCHA_API_KEY', 'ANTICAPTCHA_KEY', 'ANTICAPTCHA_TOP_API_KEY']) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) {
      return { key: value.trim(), source: name };
    }
  }
  const config = readConfig();
  if (config?.apiKey && typeof config.apiKey === 'string' && config.apiKey.trim()) {
    return { key: config.apiKey.trim(), source: CONFIG_PATH };
  }
  if (!required) return null;
  throw new CliError(
    'MISSING_API_KEY',
    'No anticaptcha.top API key found.',
    {
      hint: 'Set ANTICAPTCHA_API_KEY, pass --key, or run: bhd-anticaptcha config set-key YOUR_KEY',
    },
    2,
  );
}

function maskKey(key) {
  const text = String(key || '');
  if (!text) return '';
  if (text.length <= 8) return '*'.repeat(text.length);
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function isRetryableCode(code) {
  return ['NETWORK_ERROR', 'SERVER_ERROR', 'RATE_LIMITED', 'REQUEST_TIMEOUT'].includes(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(opts, message) {
  if (opts.verbose) process.stderr.write(`[bhd-anticaptcha] ${message}\n`);
}

async function httpRequest(url, { method = 'GET', body, headers = {}, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const requestHeaders = { accept: 'application/json', ...headers };
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await response.text();
    let data = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // Keep plain text (some endpoints reply "OK|..." even with json=1).
      }
    }
    if (!response.ok) {
      const detail = typeof data === 'string' ? data.slice(0, 500) : data;
      if (response.status === 429) {
        throw new CliError('RATE_LIMITED', 'Rate limited by anticaptcha.top (HTTP 429).', { status: 429, response: detail }, 4);
      }
      if (response.status >= 500) {
        throw new CliError('SERVER_ERROR', `anticaptcha.top returned HTTP ${response.status}.`, { status: response.status, response: detail }, 4);
      }
      throw new CliError('HTTP_ERROR', `anticaptcha.top returned HTTP ${response.status}.`, { status: response.status, response: detail }, 4);
    }
    return data;
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (error?.name === 'AbortError') {
      throw new CliError('REQUEST_TIMEOUT', `Request timed out after ${timeout} ms.`, { timeout }, 4);
    }
    throw new CliError('NETWORK_ERROR', `Network error: ${error.message}`, undefined, 4);
  } finally {
    clearTimeout(timer);
  }
}

function buildUrl(baseUrl, pathname) {
  if (/^https?:\/\//i.test(pathname)) return new URL(pathname);
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\/+/, ''), base);
}

async function getJson(baseUrl, pathname, query = {}, { timeout = 30000 } = {}) {
  const url = buildUrl(baseUrl, pathname);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return httpRequest(url, { method: 'GET', timeout });
}

async function postJson(baseUrl, pathname, body, { timeout = 30000 } = {}) {
  return httpRequest(buildUrl(baseUrl, pathname), { method: 'POST', body, timeout });
}

function apiError(message, details = undefined) {
  const text =
    typeof message === 'string'
      ? message
      : message == null
        ? 'Unknown API error'
        : JSON.stringify(message);
  const lower = text.toLowerCase();
  let code = 'API_ERROR';
  if (
    /apikey|api key|api_key/.test(lower) &&
    /(incorrect|invalid|không chính xác|khong chinh xac)/.test(lower)
  ) {
    code = 'INVALID_API_KEY';
  } else if (/balance not enough|insufficient|số xu không đủ|so xu khong du|số dư không đủ|so du khong du/.test(lower)) {
    code = 'INSUFFICIENT_BALANCE';
  } else if (/id does not exist|task.*not found|không tìm thấy/.test(lower)) {
    code = 'TASK_NOT_FOUND';
  } else if (/token_expired|token expired|hết hạn/.test(lower)) {
    code = 'TOKEN_EXPIRED';
  } else if (/not_ready|not ready/.test(lower)) {
    code = 'TASK_NOT_READY';
  }
  const hints = {
    INVALID_API_KEY: 'Check the key on anticaptcha.top (API Key page).',
    INSUFFICIENT_BALANCE: 'Top up your anticaptcha.top balance, then run: bhd-anticaptcha balance',
    TASK_NOT_FOUND: 'The task id is unknown or expired; create a new task.',
    TOKEN_EXPIRED: 'The captcha challenge expired before it was solved; fetch a fresh challenge.',
    TASK_NOT_READY: 'The task is still processing; wait and poll again.',
  };
  return new CliError(code, text, { ...(details || {}), ...(hints[code] ? { hint: hints[code] } : {}) }, 1);
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function flagInt(value) {
  if (value == null) return undefined;
  if (value === true) return 1;
  if (value === false) return 0;
  const text = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return 1;
  if (['0', 'false', 'no', 'off'].includes(text)) return 0;
  return 1;
}

function parseJsonObject(value, flag) {
  try {
    const data = JSON.parse(String(value));
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('expected a JSON object');
    }
    return data;
  } catch (error) {
    throw new CliError('INVALID_JSON', `${flag} must be a JSON object: ${error.message}`, undefined, 2);
  }
}

function parseIntStrict(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw usageError(`${flag} must be an integer`);
  return number;
}

function fileToBase64(file) {
  let buffer;
  try {
    buffer = file === '-' ? fs.readFileSync(0) : fs.readFileSync(path.resolve(String(file)));
  } catch (error) {
    throw new CliError('FILE_NOT_FOUND', `Cannot read ${file}: ${error.message}`, undefined, 2);
  }
  if (!buffer.length) throw new CliError('EMPTY_FILE', `${file} is empty.`, undefined, 2);
  if (buffer.length > 20 * 1024 * 1024) {
    throw new CliError('FILE_TOO_LARGE', `${file} is larger than 20 MB.`, undefined, 2);
  }
  return buffer.toString('base64');
}

function resolveImageInput(value) {
  const text = String(value);
  if (/^https?:\/\//i.test(text) || /^data:/i.test(text)) return text;
  if (fs.existsSync(path.resolve(text))) return fileToBase64(text);
  return text; // Assume the caller passed raw base64.
}

function parseCreateResponse(data) {
  if (typeof data === 'string') {
    const text = data.trim();
    if (text.startsWith('OK|')) return text.slice(3).trim();
    throw apiError(text);
  }
  if (data && typeof data === 'object') {
    if (Number(data.status) === 1 && data.request != null) return String(data.request);
    throw apiError(data.request ?? data.message ?? data.error ?? 'Failed to create task');
  }
  throw new CliError('INVALID_RESPONSE', 'Unexpected response from /in.php.', undefined, 1);
}

function parseResultResponse(data) {
  if (typeof data === 'string') {
    const text = data.trim();
    if (text.startsWith('OK|')) return { ready: true, value: text.slice(3) };
    if (/CAPT?CHA_NOT_READY/i.test(text)) return { ready: false, notReady: true, message: text };
    return { ready: false, notReady: false, message: text };
  }
  if (data && typeof data === 'object') {
    if (Number(data.status) === 1) {
      return { ready: true, value: data.request ?? data.result ?? data.solution ?? null };
    }
    const message = String(data.request ?? data.message ?? data.error ?? 'Unknown task error');
    if (/CAPT?CHA_NOT_READY/i.test(message)) {
      return { ready: false, notReady: true, message };
    }
    return { ready: false, notReady: false, message };
  }
  throw new CliError('INVALID_RESPONSE', 'Unexpected response from /res.php.', undefined, 1);
}

function normalizeResult(raw) {
  let value = raw;
  if (typeof value === 'string') {
    const text = value.trim();
    if (
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'))
    ) {
      try {
        value = JSON.parse(text);
      } catch {
        // Keep the raw string.
      }
    }
  }
  let token = null;
  if (typeof value === 'string') {
    token = value;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of [
      'token',
      'g-recaptcha-response',
      'h-captcha-response',
      'cf-turnstile-response',
      'validate',
      'captcha',
      'cookie',
    ]) {
      if (typeof value[key] === 'string' && value[key]) {
        token = value[key];
        break;
      }
    }
  }
  return { result: value, token };
}

async function waitForResult({ baseUrl, key, taskId, solveTimeout, pollInterval, opts }) {
  const deadline = Date.now() + solveTimeout;
  let lastStatus = '';
  let failures = 0;
  while (Date.now() < deadline) {
    const wait = Math.min(pollInterval, Math.max(50, deadline - Date.now()));
    await sleep(wait);
    if (Date.now() > deadline) break;
    let data;
    try {
      data = await getJson(
        baseUrl,
        '/res.php',
        { key, id: taskId, json: 1 },
        { timeout: Math.min(30000, Math.max(1000, deadline - Date.now())) },
      );
      failures = 0;
    } catch (error) {
      if (isRetryableCode(error.code) && ++failures < 4) {
        log(opts, `poll error (${error.code}); retrying`);
        continue;
      }
      throw error;
    }
    const parsed = parseResultResponse(data);
    if (parsed.ready) return parsed.value;
    lastStatus = parsed.message;
    if (!parsed.notReady) throw apiError(parsed.message, { taskId });
    log(opts, `task ${taskId}: ${parsed.message}`);
  }
  throw new CliError(
    'SOLVE_TIMEOUT',
    `Task ${taskId} was not ready within ${Math.round(solveTimeout / 1000)}s.`,
    {
      taskId,
      lastStatus,
      hint: 'Increase --timeout (for example --timeout 300), or check the task in the anticaptcha.top dashboard.',
    },
    3,
  );
}

function print(value, opts = {}) {
  if (opts.format === 'plain') {
    const scalar = value.token ?? value.captcha ?? value.balance ?? value.result;
    const output = scalar == null ? value : scalar;
    process.stdout.write(`${typeof output === 'string' ? output : JSON.stringify(output)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function addCommonTokenOptions(opts, payload, method) {
  if (opts.proxy != null) payload.proxy = String(opts.proxy);
  if (opts.proxyType != null) payload.proxyType = String(opts.proxyType);
  if (opts.proxyAddress != null) payload.proxyAddress = String(opts.proxyAddress);
  if (opts.proxyPort != null) payload.proxyPort = String(opts.proxyPort);
  if (opts.proxyLogin != null) payload.proxyLogin = String(opts.proxyLogin);
  if (opts.proxyPassword != null) payload.proxyPassword = String(opts.proxyPassword);
  const userAgent = opts.userAgent ?? opts.useragent;
  if (userAgent != null) {
    if (method === 'turnstile') payload.useragent = String(userAgent);
    else payload.userAgent = String(userAgent);
  }
}

const TOKEN_PRESETS = {
  token: {
    method: '',
    build: () => ({}),
    required: [],
    hint: 'Pass --method and --param key=value, for example: --method hcaptcha --param sitekey=... --param pageurl=...',
  },
  recaptcha2: {
    method: 'userrecaptcha',
    required: ['googlekey', 'pageurl'],
    build: (opts) => ({
      googlekey: opts.sitekey ?? opts.siteKey ?? opts.googlekey,
      pageurl: opts.url ?? opts.pageurl,
      invisible: flagInt(opts.invisible),
      enterprise: flagInt(opts.enterprise),
    }),
    hint: 'Example: bhd-anticaptcha recaptcha2 --sitekey 6Le... --url https://example.com/login',
  },
  recaptcha3: {
    method: 'userrecaptcha',
    required: ['googlekey', 'pageurl'],
    build: (opts) => ({
      googlekey: opts.sitekey ?? opts.siteKey ?? opts.googlekey,
      pageurl: opts.url ?? opts.pageurl,
      version: 'v3',
      action: opts.action,
      enterprise: flagInt(opts.enterprise),
    }),
    hint: 'Example: bhd-anticaptcha recaptcha3 --sitekey 6Le... --url https://example.com --action login',
  },
  hcaptcha: {
    method: 'hcaptcha',
    required: ['sitekey', 'pageurl'],
    build: (opts) => ({
      sitekey: opts.sitekey ?? opts.siteKey,
      pageurl: opts.url ?? opts.pageurl,
      invisible: flagInt(opts.invisible),
    }),
    hint: 'Example: bhd-anticaptcha hcaptcha --sitekey d121... --url https://example.com',
  },
  turnstile: {
    method: 'turnstile',
    required: ['sitekey', 'pageurl'],
    build: (opts) => ({
      sitekey: opts.sitekey ?? opts.siteKey,
      pageurl: opts.url ?? opts.pageurl,
      action: opts.action,
      data: opts.data,
      pagedata: opts.pageData ?? opts.pagedata,
      useragent: opts.userAgent ?? opts.useragent,
    }),
    hint: 'For Cloudflare Challenge also pass --action, --data, --pagedata and --user-agent.',
  },
  geetest3: {
    method: 'geetest',
    required: ['gt', 'challenge', 'pageurl'],
    build: (opts) => ({
      gt: opts.gt,
      challenge: opts.challenge,
      pageurl: opts.url ?? opts.pageurl,
      api_server: opts.apiServer ?? opts.api_server,
    }),
    hint: 'Example: bhd-anticaptcha geetest3 --gt ... --challenge ... --url https://example.com',
  },
  geetest4: {
    method: 'geetest_v4',
    required: ['captcha_id', 'pageurl'],
    build: (opts) => ({
      captcha_id: opts.captchaId ?? opts.captcha_id ?? opts.captchaid,
      pageurl: opts.url ?? opts.pageurl,
    }),
    hint: 'Example: bhd-anticaptcha geetest4 --captcha-id ... --url https://example.com',
  },
  funcaptcha: {
    method: 'funcaptcha',
    required: ['publickey', 'pageurl'],
    build: (opts) => ({
      publickey: opts.publickey ?? opts.publicKey,
      pageurl: opts.url ?? opts.pageurl,
      surl: opts.surl,
    }),
    hint: 'Example: bhd-anticaptcha funcaptcha --publickey ... --url https://example.com',
  },
};

function coerceIntFields(payload) {
  for (const key of Object.keys(payload)) {
    if (!INT_FIELDS.has(key)) continue;
    const value = payload[key];
    if (value === undefined || value === null || value === '') continue;
    const number = Number(value === true ? 1 : value === false ? 0 : value);
    if (Number.isFinite(number)) payload[key] = Math.trunc(number);
  }
}

async function cmdToken(opts, presetName) {
  const preset = TOKEN_PRESETS[presetName];
  if (!preset) throw usageError(`Unknown token preset: ${presetName}`);
  const method = String(opts.method || preset.method || '').trim();
  if (!method) {
    throw usageError('Missing --method', preset.hint);
  }
  const { key } = resolveApiKey(opts);
  const baseUrl = getBaseUrl(opts);
  const payload = { key, method, ...stripUndefined(preset.build(opts)) };
  addCommonTokenOptions(opts, payload, method);
  Object.assign(payload, opts.params || {});
  if (opts.body !== undefined) Object.assign(payload, parseJsonObject(opts.body, '--body'));
  coerceIntFields(payload);
  payload.key = key;
  payload.method = method;
  if (payload.json == null) payload.json = 1;

  const missing = preset.required.filter(
    (field) => payload[field] === undefined || payload[field] === null || payload[field] === '',
  );
  if (missing.length) {
    throw new CliError(
      'MISSING_PARAMETER',
      `Missing required parameter(s): ${missing.join(', ')}`,
      { hint: preset.hint },
      2,
    );
  }

  log(opts, `creating ${method} task via ${baseUrl}`);
  const create = await postJson(baseUrl, '/in.php', payload, { timeout: 30000 });
  const taskId = parseCreateResponse(create);
  log(opts, `task ${taskId} created; polling every ${Math.round(intervalMs(opts))} ms`);

  const raw = await waitForResult({
    baseUrl,
    key,
    taskId,
    solveTimeout: timeoutMs(opts),
    pollInterval: intervalMs(opts),
    opts,
  });
  const { result, token } = normalizeResult(raw);
  print(
    {
      ok: true,
      command: presetName,
      method,
      taskId,
      type: 'token',
      token: token ?? null,
      result,
    },
    opts,
  );
}

async function fetchBalance(key, opts) {
  const baseUrl = getBaseUrl(opts);
  const data = await getJson(baseUrl, '/api/getbalance', { apikey: key });
  if (data && typeof data === 'object' && data.success === false) {
    throw apiError(data.message ?? 'Balance request failed');
  }
  if (!data || typeof data !== 'object') {
    throw new CliError('INVALID_RESPONSE', 'Unexpected response from /api/getbalance.', { response: data }, 1);
  }
  const balance = Number(data.balance);
  if (!Number.isFinite(balance)) {
    throw new CliError('INVALID_RESPONSE', 'Unexpected response from /api/getbalance.', { response: data }, 1);
  }
  return { ...data, balance };
}

async function cmdBalance(opts) {
  const { key } = resolveApiKey(opts);
  const data = await fetchBalance(key, opts);
  print(
    {
      ok: true,
      command: 'balance',
      balance: data.balance,
      message: data.message ?? null,
    },
    opts,
  );
}

async function cmdServices(opts) {
  const data = await getJson(getBaseUrl(opts), '/api/getservice');
  if (data && typeof data === 'object' && data.success === false) {
    throw apiError(data.message ?? 'Service request failed');
  }
  const services = Array.isArray(data?.data) ? data.data : data?.data ?? data;
  print(
    {
      ok: true,
      command: 'services',
      count: Array.isArray(services) ? services.length : undefined,
      services,
      message: data?.message ?? null,
    },
    opts,
  );
}

async function cmdDoctor(opts) {
  const baseUrl = getBaseUrl(opts);
  const keyInfo = resolveApiKey(opts, { required: false });
  const result = {
    ok: true,
    command: 'doctor',
    version: VERSION,
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    baseUrl,
    configPath: CONFIG_PATH,
    apiKey: keyInfo
      ? { present: true, source: keyInfo.source, masked: maskKey(keyInfo.key) }
      : { present: false, source: null },
  };
  if (!keyInfo) {
    result.hint = 'Set ANTICAPTCHA_API_KEY or run: bhd-anticaptcha config set-key YOUR_KEY';
  } else {
    try {
      const data = await fetchBalance(keyInfo.key, opts);
      result.apiReachable = true;
      result.balance = data.balance;
      result.message = data.message ?? null;
    } catch (error) {
      result.apiReachable = false;
      result.error = { code: error.code, message: error.message };
    }
  }
  print(result, opts);
}

async function cmdImage(opts) {
  const { key } = resolveApiKey(opts);
  const baseUrl = getBaseUrl(opts);
  const type = parseIntStrict(opts.type ?? 14, '--type');
  let img;
  if (opts.file != null) img = fileToBase64(opts.file);
  else if (opts.image != null) img = resolveImageInput(opts.image);
  else if (opts.url != null) img = String(opts.url);
  else if (opts.positionals[0]) img = resolveImageInput(opts.positionals[0]);
  if (!img) {
    throw usageError('Missing image', 'Pass --file PATH, --image URL_OR_BASE64, or a positional file path.');
  }
  const payload = { apikey: key, type, img, ...(opts.params || {}) };
  if (flagInt(opts.calc) === 1) payload.calc = 1;
  if (flagInt(opts.numeric) === 1) payload.numeric = 1;
  if (flagInt(opts.caseSensitive ?? opts.casesensitive) === 1) payload.casesensitive = 1;
  coerceIntFields(payload);
  log(opts, `solving image captcha type ${type}`);
  const data = await postJson(baseUrl, '/api/captcha', payload, { timeout: 60000 });
  if (!data || typeof data !== 'object' || data.success !== true || data.captcha == null) {
    throw apiError(data?.message ?? 'Captcha was not solved', { response: data });
  }
  const output = {
    ok: true,
    command: 'image',
    type,
    captcha: data.captcha,
    message: data.message ?? null,
  };
  if (opts.includeBase64 === true && data.base64img) output.base64img = data.base64img;
  print(output, opts);
}

async function cmdAudio(opts) {
  const { key } = resolveApiKey(opts);
  const baseUrl = getBaseUrl(opts);
  let audio;
  if (opts.file != null) audio = fileToBase64(opts.file);
  else if (opts.audio != null) audio = String(opts.audio);
  else if (opts.url != null) audio = String(opts.url);
  else if (opts.positionals[0]) audio = resolveImageInput(opts.positionals[0]);
  if (!audio) {
    throw usageError('Missing audio', 'Pass --file PATH or --audio URL_OR_BASE64.');
  }
  const payload = { apikey: key, type: 62, audio, ...(opts.params || {}) };
  coerceIntFields(payload);
  log(opts, 'solving audio captcha');
  const data = await postJson(baseUrl, '/api/captcha', payload, { timeout: 60000 });
  if (!data || typeof data !== 'object' || data.success !== true || data.captcha == null) {
    throw apiError(data?.message ?? 'Captcha was not solved', { response: data });
  }
  print(
    {
      ok: true,
      command: 'audio',
      type: 62,
      captcha: data.captcha,
      message: data.message ?? null,
    },
    opts,
  );
}

async function cmdRecognize(opts) {
  const { key } = resolveApiKey(opts);
  const baseUrl = getBaseUrl(opts);
  const type = parseIntStrict(opts.type ?? (opts.audio != null ? 62 : 14), '--type');
  const payload = { apikey: key, type, ...(opts.params || {}) };
  if (opts.file != null) payload.img = fileToBase64(opts.file);
  if (opts.image != null) payload.img = resolveImageInput(opts.image);
  if (opts.audio != null) payload.audio = String(opts.audio);
  if (opts.url != null && payload.img === undefined && payload.audio === undefined) {
    payload.img = String(opts.url);
  }
  if (opts.pageurl != null) payload.pageurl = String(opts.pageurl);
  if (opts.websitekey != null) payload.websitekey = String(opts.websitekey);
  if (opts.websiteKey != null) payload.websitekey = String(opts.websiteKey);
  if (opts.context != null) payload.context = String(opts.context);
  if (opts.iv != null) payload.iv = String(opts.iv);
  if (opts.captchaScript != null) payload.captcha_script = String(opts.captchaScript);
  if (opts.challengeScript != null) payload.challenge_script = String(opts.challengeScript);
  if (flagInt(opts.calc) === 1) payload.calc = 1;
  if (flagInt(opts.numeric) === 1) payload.numeric = 1;
  if (flagInt(opts.caseSensitive ?? opts.casesensitive) === 1) payload.casesensitive = 1;
  coerceIntFields(payload);
  log(opts, `solving recognition type ${type}`);
  const data = await postJson(baseUrl, '/api/captcha', payload, { timeout: 60000 });
  if (!data || typeof data !== 'object' || data.success !== true || data.captcha == null) {
    throw apiError(data?.message ?? 'Captcha was not solved', { response: data });
  }
  const output = {
    ok: true,
    command: 'recognize',
    type,
    captcha: data.captcha,
    message: data.message ?? null,
  };
  if (opts.includeBase64 === true && data.base64img) output.base64img = data.base64img;
  print(output, opts);
}

async function cmdRaw(opts) {
  const keyInfo = resolveApiKey(opts, { required: false });
  const key = keyInfo?.key;
  const baseUrl = getBaseUrl(opts);
  const pathname = String(opts.path ?? opts.endpoint ?? '').trim();
  if (!pathname) {
    throw usageError('Missing --path', 'Example: bhd-anticaptcha raw --path /in.php --body \'{"method":"hcaptcha",...}\'');
  }
  const method = String(
    opts.method ||
      (/getbalance|getservice|res\.php/i.test(pathname) ? 'GET' : 'POST'),
  ).toUpperCase();
  const body = { ...(opts.params || {}) };
  if (opts.body !== undefined) Object.assign(body, parseJsonObject(opts.body, '--body'));
  const query = { ...(opts.query || {}) };

  if (/\/in\.php/i.test(pathname)) {
    if (key && body.key == null) body.key = key;
  } else if (/\/api\/captcha/i.test(pathname)) {
    if (key && body.apikey == null) body.apikey = key;
  } else if (/\/res\.php/i.test(pathname)) {
    if (key && query.key == null) query.key = key;
    if (opts.id != null && query.id == null) query.id = String(opts.id);
    if (query.json == null) query.json = 1;
  } else if (/\/api\/getbalance/i.test(pathname)) {
    if (key && query.apikey == null) query.apikey = key;
  }

  let url;
  if (/^https?:\/\//i.test(pathname)) url = new URL(pathname);
  else url = buildUrl(baseUrl, pathname);
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }

  log(opts, `raw ${method} ${pathname}`);
  const data = await httpRequest(url, {
    method,
    body: method === 'GET' ? undefined : body,
    timeout: 60000,
  });
  if (data && typeof data === 'object' && (data.success === false || Number(data.status) === 0)) {
    const error = apiError(data.message ?? data.request ?? 'Raw request failed');
    error.details = { ...(error.details || {}), response: data };
    throw error;
  }
  print({ ok: true, command: 'raw', path: pathname, response: data }, opts);
}

async function cmdConfig(opts) {
  const action = opts.positionals[0] || 'show';
  if (action === 'path') {
    print({ ok: true, command: 'config', path: CONFIG_PATH }, opts);
    return;
  }
  if (action === 'show') {
    const config = readConfigStrict();
    let source = null;
    let value = null;
    if (typeof opts.key === 'string' && opts.key.trim()) {
      source = '--key';
      value = opts.key.trim();
    } else {
      for (const name of ['ANTICAPTCHA_API_KEY', 'ANTICAPTCHA_KEY', 'ANTICAPTCHA_TOP_API_KEY']) {
        if (process.env[name]?.trim()) {
          source = name;
          value = process.env[name].trim();
          break;
        }
      }
      if (!source && config?.apiKey) {
        source = CONFIG_PATH;
        value = String(config.apiKey);
      }
    }
    print(
      {
        ok: true,
        command: 'config',
        path: CONFIG_PATH,
        apiKey: {
          present: Boolean(source),
          source,
          masked: value ? maskKey(value) : null,
        },
        baseUrl: getBaseUrl(opts),
      },
      opts,
    );
    return;
  }
  if (action === 'set-key') {
    const key = opts.positionals[1] || (typeof opts.key === 'string' ? opts.key : '');
    if (!key.trim()) {
      throw usageError('Missing key', 'Usage: bhd-anticaptcha config set-key YOUR_KEY');
    }
    const config = readConfigStrict() || {};
    config.apiKey = key.trim();
    if (typeof opts.baseUrl === 'string' && opts.baseUrl.trim()) {
      config.baseUrl = opts.baseUrl.trim().replace(/\/+$/, '');
    }
    config.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    try {
      fs.chmodSync(CONFIG_PATH, 0o600);
    } catch {
      // Windows may not support POSIX modes; ACLs still apply.
    }
    print(
      {
        ok: true,
        command: 'config',
        action: 'set-key',
        path: CONFIG_PATH,
        masked: maskKey(key.trim()),
      },
      opts,
    );
    return;
  }
  throw usageError(`Unknown config action: ${action}`, 'Use: config set-key KEY | config show | config path');
}

function printHelp() {
  process.stdout.write(USAGE);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.version) {
    process.stdout.write(`bhd-anticaptcha ${VERSION}\n`);
    return;
  }
  const command = opts.positionals.shift() || 'help';
  if (opts.help || command === 'help') {
    printHelp();
    return;
  }
  if (opts.format != null && !['json', 'plain'].includes(String(opts.format))) {
    throw usageError('--format must be "json" or "plain"');
  }

  switch (command) {
    case 'balance':
      await cmdBalance(opts);
      return;
    case 'services':
    case 'service':
      await cmdServices(opts);
      return;
    case 'doctor':
      await cmdDoctor(opts);
      return;
    case 'token':
    case 'solve':
      await cmdToken(opts, 'token');
      return;
    case 'recaptcha2':
    case 'recaptcha-v2':
    case 'recaptcha':
      await cmdToken(opts, 'recaptcha2');
      return;
    case 'recaptcha3':
    case 'recaptcha-v3':
      await cmdToken(opts, 'recaptcha3');
      return;
    case 'hcaptcha':
    case 'h-captcha':
      await cmdToken(opts, 'hcaptcha');
      return;
    case 'turnstile':
    case 'cloudflare':
      await cmdToken(opts, 'turnstile');
      return;
    case 'geetest3':
    case 'geetest':
    case 'geetest-v3':
      await cmdToken(opts, 'geetest3');
      return;
    case 'geetest4':
    case 'geetest-v4':
      await cmdToken(opts, 'geetest4');
      return;
    case 'funcaptcha':
    case 'funcaptcha-token':
    case 'arkose':
      await cmdToken(opts, 'funcaptcha');
      return;
    case 'image':
    case 'img':
      await cmdImage(opts);
      return;
    case 'audio':
      await cmdAudio(opts);
      return;
    case 'recognize':
    case 'recognition':
    case 'captcha':
      await cmdRecognize(opts);
      return;
    case 'raw':
    case 'request':
      await cmdRaw(opts);
      return;
    case 'config':
    case 'configure':
      await cmdConfig(opts);
      return;
    default:
      throw usageError(`Unknown command: ${command}`, 'Run: bhd-anticaptcha --help');
  }
}

main().catch((error) => {
  const cliError =
    error instanceof CliError
      ? error
      : new CliError('INTERNAL_ERROR', error?.message || String(error), undefined, 1);
  const output = {
    ok: false,
    error: {
      code: cliError.code,
      message: cliError.message,
    },
  };
  if (cliError.details) output.error.details = cliError.details;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (process.env.ANTICAPTCHA_DEBUG) {
    process.stderr.write(`${error?.stack || error}\n`);
  }
  process.exitCode = cliError.exitCode;
});
