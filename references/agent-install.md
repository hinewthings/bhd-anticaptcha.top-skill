# Install for coding agents

`bhd-anticaptcha` follows the [Agent Skills](https://agentskills.io/) convention: a directory containing `SKILL.md` with YAML frontmatter (`name`, `description`) plus optional scripts and references.

The directory name **must** be `bhd-anticaptcha` so it matches the frontmatter name.

## Quick install

### Universal user folder

```bash
git clone https://github.com/hinewthings/bhd-anticaptcha.top-skill.git ~/.agents/skills/bhd-anticaptcha
```

```powershell
git clone https://github.com/hinewthings/bhd-anticaptcha.top-skill.git "$env:USERPROFILE\.agents\skills\bhd-anticaptcha"
```

This single location is read by Codex, Oh My Pi, DeepSeek Harness, and Antigravity workspaces (when the repository is opened as a workspace).

### Automatic installer

```bash
node ~/.agents/skills/bhd-anticaptcha/scripts/install.mjs --target auto
```

```powershell
node "$env:USERPROFILE\.agents\skills\bhd-anticaptcha\scripts\install.mjs" --target auto
```

`--target auto` always installs `agents`, then adds `claude`, `antigravity`, and `omp` when their config folders exist.

```bash
node scripts/install.mjs --target all
node scripts/install.mjs --target agents,claude
node scripts/install.mjs --project --target agents,claude,omp
node scripts/install.mjs --target claude --force
node scripts/install.mjs --target claude --link
node scripts/install.mjs --dry-run
```

The installer copies by default, refuses to overwrite without `--force`, and supports symlinks/junctions with `--link`.

## Path matrix

| Agent | User scope | Project scope |
|---|---|---|
| **Codex** | `~/.agents/skills/` | `<repo>/.agents/skills/` |
| **Claude Code** | `~/.claude/skills/` | `<repo>/.claude/skills/` |
| **Google Antigravity** | `~/.gemini/config/skills/` | `<repo>/.agents/skills/` |
| **Oh My Pi (OMP)** | `~/.omp/agent/skills/` | `<repo>/.omp/skills/` |
| **DeepSeek Harness (DSH)** | `~/.agents/skills/` | `<repo>/.agents/skills/` |
| Generic Agent Skills host | folder containing `SKILL.md` | same |

Additional paths read by specific tools:

- **Antigravity CLI**: `~/.gemini/antigravity-cli/skills/` and `~/.gemini/skills/` are also read. Legacy global path `~/.gemini/antigravity/skills/` still works.
- **Oh My Pi**: also discovers Claude (`.claude/skills`), Codex/Agents (`.agents/skills`), OpenCode, and GitHub (`.github/skills`) layouts.
- **Codex**: older releases used `~/.codex/skills/`; current releases use `~/.agents/skills/`. Prefer `.agents`.

References:

- Codex skills: <https://developers.openai.com/codex/skills>
- Claude Code skills: <https://code.claude.com/docs/en/agent-sdk/skills>
- Antigravity skills: <https://antigravity.google/docs/skills>
- Oh My Pi skills: <https://github.com/can1357/oh-my-pi/blob/main/docs/skills.md>

## Invoking the skill

Agents discover skills at session start. After installing, **restart or start a new session**, then ask explicitly:

```text
Use the bhd-anticaptcha skill to solve the reCAPTCHA on this page.
```

Per agent:

- **Claude Code**: the skill appears in the Skill tool catalog; ask for `bhd-anticaptcha` by name.
- **Codex**: mention `bhd-anticaptcha` in the prompt; Codex also supports `AGENTS.md` instructions that name the skill.
- **Antigravity**: ask the agent to use the `bhd-anticaptcha` skill; workspace skills are discovered from `.agents/skills`.
- **Oh My Pi**: `/skill:bhd-anticaptcha` or a normal prompt naming the skill. OMP exposes `skill://bhd-anticaptcha/SKILL.md`.
- **DSH**: the skill joins the session skill catalog; invoke it by name.

You do not have to rely on skill discovery: every agent can run the CLI directly.

```bash
node ~/.agents/skills/bhd-anticaptcha/scripts/anticaptcha.mjs balance
```

## Verify

```bash
node ~/.agents/skills/bhd-anticaptcha/scripts/anticaptcha.mjs --version
node ~/.agents/skills/bhd-anticaptcha/scripts/anticaptcha.mjs doctor
```

`doctor` reports Node version, base URL, key source (masked), and balance.

## Optional: put `bhd-anticaptcha` on PATH

```bash
cd ~/.agents/skills/bhd-anticaptcha
npm link
bhd-anticaptcha --version
```

Or use the bundled launchers:

- `bin/bhd-anticaptcha` (macOS/Linux/WSL)
- `bin/bhd-anticaptcha.cmd` (Windows)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skill not listed | Confirm the path is `<root>/bhd-anticaptcha/SKILL.md` (one level under `skills/`, not nested deeper) and restart the session |
| Codex rejects the skill | Keep frontmatter to `name` and `description` only; the bundled `SKILL.md` already does |
| `bhd-anticaptcha: command not found` | Use `node <skill>/scripts/anticaptcha.mjs`, or run `npm link` |
| Agent cannot see `ANTICAPTCHA_API_KEY` | Save the key with `config set-key`; GUI-launched agents may not inherit shell env |
| `MISSING_API_KEY` | Set the env var or run `config set-key` |
| `NETWORK_ERROR` | Allow outbound HTTPS to `anticaptcha.top`; check proxy/firewall |
| `node: fetch is not defined` | Node is older than 18; upgrade |
| Wrong token / site rejects it | Match `pageurl`, proxy IP, and User-Agent; solve immediately before submitting |
| Duplicate installs | Prefer one location; `--link` keeps a single source of truth |

## Uninstall

Remove the skill folder from each location where it was installed:

```bash
rm -rf ~/.agents/skills/bhd-anticaptcha
rm -rf ~/.claude/skills/bhd-anticaptcha
rm -rf ~/.gemini/config/skills/bhd-anticaptcha
rm -rf ~/.omp/agent/skills/bhd-anticaptcha
```

Do not remove the whole `skills/` directory; other skills may live there.
