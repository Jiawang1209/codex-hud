---
name: codex-hud
description: Use when the user wants to inspect, configure, or run Codex HUD for Codex CLI terminal telemetry.
---

# Codex HUD

Codex HUD is a terminal HUD for Codex CLI sessions. It is currently packaged as a standalone CLI plus this Codex plugin wrapper.

## Commands

From the repository root:

```bash
npm install
npm run build
node dist/index.js status
node dist/index.js run
node dist/index.js setup
node dist/index.js doctor
node dist/index.js config
node dist/index.js config init
node dist/index.js watch
```

After package installation, use:

```bash
codex-hud status
codex-hud run
codex-hud native
codex-hud install-shim
codex-hud uninstall-shim
codex-hud setup
codex-hud doctor
codex-hud config
codex-hud config init
codex-hud watch
```

Default `codex-hud status` output uses the expanded HUD style:

```text
[gpt-5.5 medium] │ codex-hud git:(main*)
Context ████░░░░░░ 42% │ Usage ███████░░░ 68% (3h 24m / 5h) │ Weekly █████████░ 86% (6d 29m / 7d)
Todos 2/5 │ Exec active, Plan x2
```

## Configuration

Codex HUD uses `~/.codex-hud/config.json`. Users can customize display order, visibility, git details, and Claude HUD-like colors:

```json
{
  "language": "zh",
  "lineLayout": "expanded",
  "pathLevels": 2,
  "elementOrder": ["model", "project", "context", "usage", "weekly", "tools", "todos"],
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true,
    "showFileStats": false
  },
  "display": {
    "showModel": true,
    "showProject": true,
    "showGit": true,
    "showContext": true,
    "showUsage": true,
    "showWeekly": true,
    "showTools": true,
    "showTodos": true
  },
  "colors": {
    "model": "magenta",
    "project": "cyan",
    "git": "magenta",
    "gitBranch": "cyan",
    "context": "yellow",
    "usage": "magenta",
    "weekly": "magenta",
    "label": "dim",
    "custom": "#FF6600"
  }
}
```

Use `codex-hud config init` to create the default config. Existing legacy keys such as `layout`, `display.usage`, and `display.tools` remain supported.

Use `codex-hud run` to launch Codex in a tmux session with a persistent HUD pane:

```bash
codex-hud run
codex-hud run -- --model gpt-5.5 --sandbox danger-full-access
codex-hud run --session my-work --height 5
codex-hud run --terminal iterm
codex-hud run --terminal terminal
```

`codex-hud pane` is the internal refresh command used by the HUD pane/window. `--terminal tmux` is the portable default; `--terminal iterm` uses iTerm2 split panes; `--terminal terminal` uses macOS Terminal.app sessions.

## Auto-Launch Model

Use `codex-hud install-shim` when the user wants `codex` itself to open with Codex HUD automatically:

```bash
codex-hud install-shim --codex /path/to/patched/codex
codex
```

The shim writes a reversible wrapper at `~/.local/bin/codex`:

```bash
codex-hud native --codex /path/to/patched/codex -- "$@"
```

`codex-hud native` launches the patched Codex binary with command-backed status-line config:

```bash
-c 'tui.status_line=["command: codex-hud status"]'
```

Remove the wrapper with:

```bash
codex-hud uninstall-shim
```

This requires `~/.local/bin` to appear before the official Codex binary in `PATH`. The shim refuses to overwrite a non-Codex-HUD `codex` file in that directory.

## Current Integration Model

Run `codex-hud setup` to configure Codex CLI's native in-window status line in `~/.codex/config.toml`. This uses Codex's supported `[tui].status_line` built-in items:

- `model-with-reasoning`
- `task-progress`
- `current-dir`
- `git-branch`
- `context-used`
- `five-hour-limit`
- `weekly-limit`
- `fast-mode`

Restart Codex CLI after setup. Users can run `/statusline` inside Codex to inspect or reorder these items.

Claude HUD uses Claude Code's command-backed `statusLine` API. Codex CLI 0.131.0 does not currently expose an equivalent arbitrary command provider, so the richer `codex-hud status/watch` renderer remains the stable CLI core and future native integration point.

The upstream command-backed status-line proposal is documented in `docs/upstream/codex-command-backed-statusline.md`.

## Safety

Codex HUD reads local configuration, git metadata, and environment signals. It should not upload data or parse private transcript message bodies for the MVP.
