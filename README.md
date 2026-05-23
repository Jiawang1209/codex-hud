# Codex HUD

Codex HUD is a real-time heads-up display for Codex CLI and Agent CLI workflows, showing context, tools, task progress, git state, and session signals directly in the terminal.

The first version is intentionally built as a standalone CLI core plus a Codex plugin wrapper. That makes it useful today while keeping the path open for native Codex statusline integration later.

Codex HUD reads local Codex configuration, git metadata, and safe session-log metadata. It uses session event types, tool names, token counters, rate-limit counters, and plan status only; it does not need to display private message bodies.

## Install

```bash
npm install
npm run build
```

## Usage

```bash
node dist/index.js status
node dist/index.js doctor
node dist/index.js config
node dist/index.js watch
```

When installed as a package, the binary is:

```bash
codex-hud status
codex-hud doctor
codex-hud config
codex-hud watch
```

Example output:

```text
[gpt-5.5 medium] | codex-hud git:(main*) | Context ████░░░░░░ 42% | 5h ███████░░░ 68% | Todos 2/5 | Exec active, Plan x2
```

## Commands

- `status`: print one HUD snapshot.
- `watch`: refresh the HUD until interrupted.
- `doctor`: check Codex CLI, Codex home, and Node.js readiness.
- `config`: print the effective Codex HUD configuration.

## Configuration

Codex HUD looks for config at:

```text
~/.codex-hud/config.json
```

Supported MVP keys include `layout`, `refreshIntervalMs`, `pathLevels`, `display`, `colors`, and `codexHome`.

## Data Sources

- `~/.codex/config.toml` for model and reasoning effort.
- `~/.codex/sessions/**/*.jsonl` for token counters, rate limits, tool activity, and plan progress. Codex HUD prefers the newest session whose recorded cwd overlaps the current project.
- `git` for branch and dirty state.
- `codex --version` for diagnostics.

Tool activity is summarized from the most recent tool calls rather than the entire session, so long-running sessions stay readable.
Context uses the latest token-count frame's `last_token_usage` when available, falling back to cumulative session usage only when needed.
Progress values render as bars, with terminal colors enabled automatically for TTY output and disabled when `NO_COLOR` is set.

## Plugin Wrapper

The repository includes `.codex-plugin/plugin.json` and `skills/codex-hud/SKILL.md`. The plugin wrapper documents how to use the CLI today and gives us a clean place to add native Codex statusline support if Codex exposes a command-backed provider API.
