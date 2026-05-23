# Codex HUD

Codex HUD is a real-time heads-up display for Codex CLI and Agent CLI workflows, showing context, tools, task progress, git state, and session signals directly in the terminal.

The first version ships with two layers:

- A Codex native status-line setup command that configures the in-window Codex CLI footer.
- A standalone `codex-hud status/watch` CLI core with richer session telemetry for development and future command-backed status-line support.

Codex HUD reads local Codex configuration, git metadata, and safe session-log metadata. It uses session event types, tool names, token counters, rate-limit counters, and plan status only; it does not need to display private message bodies.

## Install

```bash
npm install
npm run build
```

## Usage

```bash
node dist/index.js status
node dist/index.js run
node dist/index.js setup
node dist/index.js doctor
node dist/index.js config
node dist/index.js config init
node dist/index.js watch
```

When installed as a package, the binary is:

```bash
codex-hud status
codex-hud run
codex-hud install
codex-hud native
codex-hud install-shim
codex-hud uninstall-shim
codex-hud setup
codex-hud doctor
codex-hud config
codex-hud config init
codex-hud watch
```

Example output:

```text
[gpt-5.5 medium] │ codex-hud git:(main*)
Context ████░░░░░░ 42% │ Usage ███████░░░ 68% (3h 24m / 5h)
Todos 2/5 │ Exec active, Plan x2
```

## Commands

- `status`: print one HUD snapshot.
- `watch`: refresh the HUD until interrupted.
- `run`: launch Codex inside a tmux session with a live Codex HUD pane.
- `pane`: internal command used by `run` to refresh the HUD in a small pane.
- `install`: prepare the full native bundle: patched Codex checkout, build, and reversible `codex` shim.
- `native`: launch a patched Codex CLI binary with `codex-hud status` wired into the native footer.
- `install-shim`: install a reversible `codex` wrapper that launches `codex-hud native`.
- `uninstall-shim`: remove the `codex` wrapper installed by `install-shim`.
- `setup`: configure Codex CLI's native in-window `[tui].status_line` with HUD-like items.
- `install-statusline`: alias for `setup`; accepts `--config <file>` for testing or custom Codex config paths.
- `doctor`: check Codex CLI, `codex-hud`, shim, patched Codex, native status command, Codex home, and Node.js readiness.
- `config`: print the effective Codex HUD configuration.
- `config init`: create `~/.codex-hud/config.json` with default settings.

## Run Codex With A HUD Pane

For the closest current approximation of a Claude HUD-like persistent display, use:

```bash
codex-hud run
```

The default launcher uses `tmux`. It creates a tmux session with Codex in the main pane and a small live HUD pane underneath.

Pass Codex arguments after `--`:

```bash
codex-hud run -- --model gpt-5.5 --sandbox danger-full-access
```

Useful wrapper options:

```bash
codex-hud run --session my-work --height 5
codex-hud run --dry-run -- --model gpt-5.5
```

Terminal launcher options:

```bash
codex-hud run --terminal tmux
codex-hud run --terminal iterm
codex-hud run --terminal terminal
```

Launcher behavior:

- `tmux`: portable default, works inside Terminal.app, iTerm2, and most terminal emulators.
- `iterm`: macOS iTerm2 AppleScript launcher with a native horizontal split pane.
- `terminal`: macOS Terminal.app AppleScript launcher that opens separate Codex and HUD terminal sessions.

`codex-hud run` is intentionally a wrapper, not a Codex fork. It keeps Codex HUD usable today while the project tracks native command-backed status-line support upstream.

## Auto-Launch With `codex`

Recommended product install:

```bash
npm install -g codex-hud
codex-hud install
codex
```

`codex-hud install` clones a clean Codex CLI source checkout, applies the bundled native status-line patch, builds the patched Codex binary, and installs the reversible shim below.

For the Claude HUD-like experience where users keep typing `codex` and the HUD appears automatically, Codex HUD provides a reversible command shim:

```bash
codex-hud install-shim --codex /path/to/patched/codex
```

The shim writes a `codex` wrapper to `~/.local/bin/codex`. If `~/.local/bin` appears before the official Codex binary in `PATH`, then:

```bash
codex
```

will transparently run:

```bash
codex-hud native --codex /path/to/patched/codex -- "$@"
```

That native launcher starts the patched Codex binary with:

```bash
-c 'tui.status_line=["command: codex-hud status"]'
```

For this development machine, the current patched binary is:

```bash
/Users/liuyue/Desktop/Github_repos/openai-codex/codex-rs/target/debug/codex
```

Install the local shim with:

```bash
codex-hud install-shim \
  --codex /Users/liuyue/Desktop/Github_repos/openai-codex/codex-rs/target/debug/codex
```

Remove it and return to the official `codex` command with:

```bash
codex-hud uninstall-shim
```

`install-shim` refuses to overwrite an existing non-Codex-HUD `codex` file in the target bin directory. Use `--bin-dir <dir>` for testing or custom PATH layouts.

## Codex In-Window Status Line

Run:

```bash
codex-hud setup
```

This writes the closest currently supported Codex CLI native status line to `~/.codex/config.toml`:

```toml
[tui]
status_line = [
  "model-with-reasoning",
  "task-progress",
  "current-dir",
  "git-branch",
  "context-used",
  "five-hour-limit",
  "weekly-limit",
  "fast-mode",
]
```

Restart `codex` after running setup. Inside Codex you can also use `/statusline` to inspect or reorder the built-in items.

Claude HUD uses Claude Code's command-backed `statusLine` API, where the app invokes a plugin script directly in the prompt footer. Codex CLI 0.131.0 does not currently expose an equivalent command-backed status-line provider; its supported native integration is the fixed `tui.status_line` item list above. Codex HUD keeps the richer CLI renderer in place so it can become the status-line command as soon as Codex exposes that API.

The upstream feature request draft lives at:

```text
docs/upstream/codex-command-backed-statusline.md
```

There is also a local native Codex CLI proof-of-concept patch that adds
`tui.status_line = ["command: codex-hud status"]` support and preserves multi-line HUD output in
the native bottom footer. See:

```text
docs/native-codex-cli-patch.md
```

## Configuration

Codex HUD looks for config at:

```text
~/.codex-hud/config.json
```

Supported MVP keys include `layout`, `refreshIntervalMs`, `pathLevels`, `display`, `colors`, and `codexHome`. The default `layout` is `expanded`, which renders a Claude HUD-like multi-line display. Set `layout` to `compact` for a single-line output.

The configuration is intentionally close to Claude HUD-style customization. Example:

```json
{
  "language": "zh",
  "lineLayout": "expanded",
  "pathLevels": 2,
  "elementOrder": ["model", "project", "context", "usage", "weekly", "tools", "todos", "sessionTime"],
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
    "showAgents": true,
    "showTodos": true,
    "showConfigCounts": true,
    "showDuration": true,
    "showMemoryUsage": true
  },
  "colors": {
    "context": "yellow",
    "usage": "magenta",
    "weekly": "magenta",
    "warning": "yellow",
    "usageWarning": "magenta",
    "critical": "red",
    "model": "magenta",
    "project": "cyan",
    "git": "magenta",
    "gitBranch": "cyan",
    "label": "dim",
    "custom": "#FF6600"
  }
}
```

`elementOrder` controls the order of HUD sections. `colors` accepts named ANSI colors such as `cyan`, `magenta`, `yellow`, `red`, `green`, `dim`, and truecolor hex values like `#FF6600`.

Initialize the config file with:

```bash
codex-hud config init
```

## Data Sources

- `~/.codex/config.toml` for model and reasoning effort.
- `~/.codex/sessions/**/*.jsonl` for token counters, rate limits, tool activity, and plan progress. Codex HUD prefers the newest session whose recorded cwd overlaps the current project.
- `git` for branch and dirty state.
- `codex --version` for diagnostics.

Tool activity is summarized from the most recent tool calls rather than the entire session, so long-running sessions stay readable.
Context uses the latest token-count frame's `last_token_usage` when available, falling back to cumulative session usage only when needed.
Progress values render as bars, with terminal colors enabled automatically for TTY output and disabled when `NO_COLOR` is set.

## Plugin Wrapper

The repository includes `.codex-plugin/plugin.json` and `skills/codex-hud/SKILL.md`. The plugin wrapper documents how to install Codex HUD, configure the native Codex status line, and use the richer CLI renderer while Codex command-backed status-line support is not yet available.

## Marketplace

This repository includes a local marketplace snapshot at:

```text
.agents/plugins/marketplace.json
```

For local testing, add the marketplace snapshot from this repository and install `codex-hud` from it with Codex plugin commands.

```bash
codex plugin marketplace add /path/to/codex-hud
codex plugin list --marketplace codex-hud-marketplace
codex plugin add codex-hud@codex-hud-marketplace
```

The marketplace entry uses the standard Codex plugin layout path `./plugins/codex-hud`.

## Privacy

Codex HUD reads local Codex configuration, local Codex session metadata, and local git metadata. It does not upload data.

## License

MIT
