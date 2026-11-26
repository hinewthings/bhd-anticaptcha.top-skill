#!/usr/bin/env node
/**
 * Install bhd-anticaptcha into the skill directories used by common coding agents.
 * Safe by default: copies, refuses to overwrite unless --force is passed.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'bhd-anticaptcha';
const HOME = os.homedir();

const USAGE = `bhd-anticaptcha installer

Usage:
  node scripts/install.mjs [options]

Options:
  --target <list>   auto | all | agents,claude,antigravity,omp
                    (default: auto = agents + detected agents)
  --project         Install into the current project instead of user folders
  --link            Symlink/junction instead of copying
  --force           Replace an existing installation
  --dry-run         Show what would happen
  --json            Machine-readable output
  -h, --help        Show this help

Targets (user):
  agents        ~/.agents/skills/bhd-anticaptcha        Codex, OMP, DSH, Antigravity workspace
  claude        ~/.claude/skills/bhd-anticaptcha
  antigravity   ~/.gemini/config/skills/bhd-anticaptcha
  omp           ~/.omp/agent/skills/bhd-anticaptcha

Targets (--project):
  agents        <cwd>/.agents/skills/bhd-anticaptcha
  claude        <cwd>/.claude/skills/bhd-anticaptcha
  omp           <cwd>/.omp/skills/bhd-anticaptcha
`;

function parseArgs(argv) {
  const opts = {
    target: 'auto',
    project: false,
    link: false,
    force: false,
    dryRun: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--project') opts.project = true;
    else if (arg === '--link') opts.link = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--target') {
      opts.target = argv[++i];
      if (!opts.target) throw new Error('--target needs a value');
    } else if (arg.startsWith('--target=')) {
      opts.target = arg.slice('--target='.length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function roots(project = false) {
  if (project) {
    return {
      agents: path.join(process.cwd(), '.agents', 'skills'),
      claude: path.join(process.cwd(), '.claude', 'skills'),
      omp: path.join(process.cwd(), '.omp', 'skills'),
    };
  }
  return {
    agents: path.join(HOME, '.agents', 'skills'),
    claude: path.join(HOME, '.claude', 'skills'),
    antigravity: path.join(HOME, '.gemini', 'config', 'skills'),
    omp: path.join(HOME, '.omp', 'agent', 'skills'),
  };
}

function detectTargets(available, project = false) {
  if (project) return [...available];
  const targets = ['agents'];
  if (available.includes('claude') && fs.existsSync(path.join(HOME, '.claude'))) targets.push('claude');
  if (available.includes('antigravity') && fs.existsSync(path.join(HOME, '.gemini'))) targets.push('antigravity');
  if (available.includes('omp') && fs.existsSync(path.join(HOME, '.omp'))) targets.push('omp');
  return targets;
}

function parseTargets(value, available, project = false) {
  if (!value || value === 'auto') return detectTargets(available, project);
  if (value === 'all') return [...available];
  const requested = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const unknown = requested.filter((item) => !available.includes(item));
  if (unknown.length) {
    throw new Error(`Unknown target(s): ${unknown.join(', ')}. Available: ${available.join(', ')}`);
  }
  return [...new Set(requested)];
}

function copySkill(destination) {
  if (fs.existsSync(destination)) {
    if (!opts.force) return { status: 'exists' };
    if (path.basename(destination) !== SKILL_NAME) {
      throw new Error(`Refusing to remove unexpected path: ${destination}`);
    }
    if (opts.dryRun) return { status: 'would-replace' };
    fs.rmSync(destination, { recursive: true, force: true });
  }
  if (opts.dryRun) return { status: 'would-install' };

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (opts.link) {
    const target = fs.realpathSync(SOURCE);
    fs.symlinkSync(target, destination, process.platform === 'win32' ? 'junction' : 'dir');
  } else {
    fs.cpSync(SOURCE, destination, {
      recursive: true,
      filter: (source) => {
        const base = path.basename(source);
        return !['.git', '.github', 'node_modules', 'tests', '.DS_Store', '.gitignore'].includes(base);
      },
    });
  }
  return { status: opts.link ? 'linked' : 'installed' };
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  const available = Object.keys(roots(opts.project));
  const targets = parseTargets(opts.target, available, opts.project);
  const result = [];

  for (const target of targets) {
    const root = roots(opts.project)[target];
    if (!root) continue;
    const destination = path.join(root, SKILL_NAME);
    if (path.resolve(destination) === path.resolve(SOURCE)) {
      result.push({ target, path: destination, status: 'source' });
      continue;
    }
    try {
      const outcome = copySkill(destination);
      result.push({ target, path: destination, ...outcome });
    } catch (error) {
      result.push({ target, path: destination, status: 'error', error: error.message });
    }
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ ok: result.every((item) => item.status !== 'error'), targets: result }, null, 2)}\n`);
  } else {
    process.stdout.write(`bhd-anticaptcha installer\nSource: ${SOURCE}\n\n`);
    for (const item of result) {
      const icons = {
        installed: '+',
        linked: '+',
        exists: '!',
        source: '=',
        error: 'x',
        'would-install': '?',
        'would-replace': '?',
      };
      const icon = icons[item.status] || '-';
      process.stdout.write(`${icon} ${item.target.padEnd(12)} ${item.path}  [${item.status}]\n`);
      if (item.error) process.stdout.write(`  ${item.error}\n`);
    }
    process.stdout.write('\nNext: restart the agent session, then ask it to use the bhd-anticaptcha skill.\n');
    process.stdout.write('Verify: node "<installed>/scripts/anticaptcha.mjs" doctor\n');
  }

  if (result.some((item) => item.status === 'error')) process.exitCode = 1;
} catch (error) {
  if (opts?.json) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  } else {
    process.stderr.write(`error: ${error.message}\n\n${USAGE}`);
  }
  process.exitCode = 1;
}
