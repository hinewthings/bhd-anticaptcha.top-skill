#!/usr/bin/env node
/**
 * Offline smoke test: starts a local mock of anticaptcha.top and drives the CLI.
 * No real API key and no balance are used.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts', 'anticaptcha.mjs');
const INSTALLER = path.join(ROOT, 'scripts', 'install.mjs');

let pollCount = 0;
let neverReady = false;
let lastCreate = null;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (url.pathname === '/api/getbalance') {
      const key = url.searchParams.get('apikey');
      if (key !== 'test') {
        return send(200, { success: false, message: 'Api key không chính xác' });
      }
      return send(200, { success: true, message: 'Thành công', balance: 149204 });
    }
    if (url.pathname === '/api/getservice') {
      return send(200, {
        success: true,
        message: 'Thành công',
        data: [
          { type: 11, name: 'ReCaptcha V2', price: 33 },
          { type: 15, name: 'HCaptcha', price: 32 },
        ],
      });
    }
    if (url.pathname === '/in.php') {
      const payload = JSON.parse(body || '{}');
      lastCreate = payload;
      if (payload.key !== 'test') {
        return send(200, { status: 0, request: 'Apikey incorrect' });
      }
      return send(200, { status: 1, request: 'TASK1' });
    }
    if (url.pathname === '/res.php') {
      if (neverReady) {
        return send(200, { status: 0, request: 'CAPCHA_NOT_READY' });
      }
      pollCount += 1;
      if (pollCount < 2) {
        return send(200, { status: 0, request: 'CAPCHA_NOT_READY' });
      }
      return send(200, { status: 1, request: 'TOKEN_ABC' });
    }
    if (url.pathname === '/api/captcha') {
      const payload = JSON.parse(body || '{}');
      if (payload.apikey !== 'test') {
        return send(200, { success: false, message: 'Api key không chính xác', captcha: '' });
      }
      return send(200, {
        success: true,
        message: 'Thành công',
        captcha: '764NHK',
        base64img: 'AAA',
      });
    }
    send(404, { error: 'not found' });
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

const baseEnv = { ...process.env, ANTICAPTCHA_BASE_URL: BASE, ANTICAPTCHA_API_KEY: 'test' };
delete baseEnv.ANTICAPTCHA_KEY;
delete baseEnv.ANTICAPTCHA_TOP_API_KEY;

function run(args, env = {}) {
  return runFull(args, { ...baseEnv, ...env });
}

function runFull(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // Leave json null and let the assertion show stdout.
      }
      resolve({ code, stdout, stderr, json });
    });
  });
}

let failures = 0;
function check(condition, label, detail = '') {
  if (condition) {
    process.stdout.write(`ok   - ${label}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL - ${label}${detail ? `\n       ${detail}` : ''}\n`);
  }
}

function reset() {
  pollCount = 0;
  neverReady = false;
  lastCreate = null;
}

try {
  reset();
  const balance = await run(['balance']);
  check(balance.code === 0 && balance.json?.balance === 149204, 'balance returns the account balance', balance.stdout);

  const services = await run(['services']);
  check(
    services.code === 0 && services.json?.count === 2 && services.json?.services?.[0]?.type === 11,
    'services returns the live service list',
    services.stdout,
  );

  reset();
  const token = await run(['recaptcha2', '--sitekey', 'SITEKEY', '--url', 'https://example.com', '--interval', '0.05']);
  check(
    token.code === 0 &&
      token.json?.ok === true &&
      token.json?.taskId === 'TASK1' &&
      token.json?.token === 'TOKEN_ABC' &&
      lastCreate?.method === 'userrecaptcha' &&
      lastCreate?.googlekey === 'SITEKEY' &&
      lastCreate?.pageurl === 'https://example.com' &&
      lastCreate?.json === 1,
    'recaptcha2 creates a task and polls until ready',
    token.stdout,
  );

  reset();
  const plain = await run([
    'hcaptcha',
    '--sitekey',
    'SITEKEY',
    '--url',
    'https://example.com',
    '--interval',
    '0.05',
    '--format',
    'plain',
  ]);
  check(plain.code === 0 && plain.stdout.trim() === 'TOKEN_ABC', 'plain format prints only the token', plain.stdout);

  reset();
  const turnstile = await run([
    'turnstile',
    '--sitekey',
    'SITEKEY',
    '--url',
    'https://example.com',
    '--action',
    'managed',
    '--data',
    'CDATA',
    '--pagedata',
    'PAGEDATA',
    '--user-agent',
    'UA-TEST',
    '--interval',
    '0.05',
  ]);
  check(
    turnstile.code === 0 &&
      lastCreate?.method === 'turnstile' &&
      lastCreate?.useragent === 'UA-TEST' &&
      lastCreate?.pagedata === 'PAGEDATA' &&
      lastCreate?.action === 'managed',
    'turnstile maps action/data/pagedata/user-agent to the API fields',
    turnstile.stdout,
  );

  reset();
  const image = await run(['image', '--file', makePng(), '--type', '14']);
  check(
    image.code === 0 && image.json?.captcha === '764NHK' && image.json?.base64img === undefined,
    'image captcha returns text and omits base64img',
    image.stdout,
  );

  reset();
  const invalid = await run(['balance'], { ANTICAPTCHA_API_KEY: 'bad' });
  check(
    invalid.code === 1 && invalid.json?.error?.code === 'INVALID_API_KEY',
    'invalid key maps to INVALID_API_KEY',
    invalid.stdout,
  );

  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bhd-anticaptcha-test-'));
  const noKeyEnv = { ...baseEnv, USERPROFILE: tmpHome, HOME: tmpHome };
  delete noKeyEnv.ANTICAPTCHA_API_KEY;
  const missing = await runFull(['balance'], noKeyEnv);
  check(
    missing.code === 2 && missing.json?.error?.code === 'MISSING_API_KEY',
    'missing key exits with code 2',
    missing.stdout,
  );

  const setKey = await runFull(['config', 'set-key', 'test'], noKeyEnv);
  check(
    setKey.code === 0 && fs.existsSync(path.join(tmpHome, '.anticaptcha.json')),
    'config set-key writes the config file',
    setKey.stdout,
  );
  const show = await runFull(['config', 'show'], noKeyEnv);
  check(
    show.code === 0 && show.json?.apiKey?.present === true && show.json?.apiKey?.masked === '****',
    'config show reports a masked key',
    show.stdout,
  );
  const fromConfig = await runFull(['balance'], noKeyEnv);
  check(
    fromConfig.code === 0 && fromConfig.json?.balance === 149204,
    'balance uses the saved config key',
    fromConfig.stdout,
  );

  reset();
  neverReady = true;
  const timeout = await run([
    'turnstile',
    '--sitekey',
    'SITEKEY',
    '--url',
    'https://example.com',
    '--interval',
    '0.05',
    '--timeout',
    '0.3',
  ]);
  check(
    timeout.code === 3 && timeout.json?.error?.code === 'SOLVE_TIMEOUT',
    'solve timeout exits with code 3',
    timeout.stdout,
  );

  const raw = await run(['raw', '--path', '/api/getbalance']);
  check(raw.code === 0 && raw.json?.response?.balance === 149204, 'raw GET injects apikey', raw.stdout);

  const doctor = await run(['doctor']);
  check(doctor.code === 0 && doctor.json?.apiReachable === true, 'doctor checks balance', doctor.stdout);

  const installer = spawn(process.execPath, [INSTALLER, '--dry-run', '--target', 'agents', '--project', '--json'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let installerOut = '';
  installer.stdout.on('data', (chunk) => {
    installerOut += chunk;
  });
  const installerCode = await new Promise((resolve) => installer.on('close', resolve));
  let installerJson = null;
  try {
    installerJson = JSON.parse(installerOut);
  } catch {
    // The assertion will show the raw output.
  }
  check(
    installerCode === 0 && installerJson?.targets?.[0]?.status === 'would-install',
    'installer dry-run reports would-install',
    installerOut,
  );

  fs.rmSync(tmpHome, { recursive: true, force: true });
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function makePng() {
  const file = path.join(os.tmpdir(), `bhd-captcha-${process.pid}.png`);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=',
    'base64',
  );
  fs.writeFileSync(file, png);
  return file;
}

if (failures) {
  process.stdout.write(`\n${failures} test(s) failed\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\nall tests passed\n');
}
