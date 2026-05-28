# Codex HUD

Codex HUD is a terminal heads-up display for Codex CLI sessions. It surfaces the signals you usually need while working with an agent: model, reasoning effort, project, git branch, context usage, five-hour usage, weekly usage, active tools, and task progress.

```text
[gpt-5.5 medium] │ codex-hud git:(main*)
Context ████░░░░░░ 42% │ Usage ███████░░░ 68% (resets in 3h 17m) │ Weekly █████████░ 86% (resets in 6d 10h)
Todos 2/5 │ Exec active, Plan x2
```

Codex HUD is intentionally local-first. It reads Codex config, Codex session metadata, and git metadata from your machine. It does not upload data or need to display private message bodies.

## Install

Follow the steps in order. If Node.js/npm or Codex CLI is already installed, skip that step.

### 1. Set Up npm

Codex HUD is distributed through npm and requires Node.js 18 or newer.

macOS:

```bash
brew install node
```

Linux, Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y nodejs npm
```

Windows, PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Verify:

```bash
npm --version
```

### 2. Install Codex CLI

Codex HUD is built for Codex CLI. If this works, skip this step:

```bash
codex --version
```

Install Codex CLI with one of the official options:

```bash
npm install -g @openai/codex
```

macOS users can also use Homebrew:

```bash
brew install --cask codex
```

See the official OpenAI Codex README for current Codex CLI install options and release binaries:

```text
https://github.com/openai/codex#installing-and-running-codex-cli
```

### 3. Install Codex HUD

Install the package:

```bash
npm install -g @jiawang1209/codex-hud
```

Then install the native HUD adapter. This is the important step that makes the normal `codex` command use the full Codex HUD footer. `codex-hud setup` is only a fallback and does not install this adapter.

| Environment | Shim | Footer command |
| --- | --- | --- |
| macOS/Linux/WSL | `codex` | `codex-hud status` |
| Windows PowerShell/CMD | `codex.cmd` | `codex-hud.cmd status` |

After `codex-hud install`, the bottom footer uses the same renderer as `codex-hud status`, so the style and rate-limit data match across macOS, Linux, WSL, and native Windows.

### macOS or Linux

Install prerequisites:

macOS:

```bash
brew install git rust tmux
```

Linux, Debian/Ubuntu:

```bash
sudo apt install -y git cargo tmux
```

Install the native adapter and launch Codex:

```bash
codex-hud install
codex-hud doctor
codex
```

If `codex` still resolves to the official binary after install, put `~/.local/bin` before the existing Codex binary in `PATH`.

### Windows PowerShell or CMD

Use this path when your prompt shows Windows paths such as `C:\Users\<you>\...`.

Install prerequisites:

```powershell
winget install Git.Git Rustlang.Rustup
```

Install the native adapter and launch Codex:

```powershell
codex-hud.cmd install
codex-hud.cmd doctor
where.exe codex
codex.cmd
```

`where.exe codex` should list the Codex HUD shim first, usually under `C:\Users\<you>\AppData\Roaming\npm\codex.cmd`. `codex-hud install` backs up an existing official `codex.cmd`, installs its own shim, and restores the backup during `codex-hud uninstall-shim`.

Do not use `codex-hud setup` for this goal. `setup` only configures Codex CLI's built-in status line and will not make `codex.cmd` use the full Codex HUD footer.

### WSL

Use this path when you are inside WSL Ubuntu/Debian and paths look like `/home/<you>/...`. Treat WSL as Linux, not as native Windows.

Install prerequisites:

```bash
sudo apt update
sudo apt install -y git cargo tmux
```

Install the native adapter and launch Codex:

```bash
codex-hud install
which codex
codex-hud doctor
codex
```

`which codex` should point to the WSL/Linux shim, usually under `~/.local/bin/codex`. Do not put the Windows `codex.cmd` path into WSL, and do not use the WSL shim from PowerShell.

## Built-In Status Line Fallback

Use this only if you cannot build the native adapter. It does not make `codex` use the full Codex HUD renderer.

```bash
codex-hud setup
codex
```

This fallback configures Codex CLI's supported native status-line items. It is useful, but the style and rate-limit percentages can differ from `codex-hud status`.

## HUD Pane Mode

Use a live HUD pane alongside Codex:

```bash
codex-hud run
```

Pass Codex arguments after `--`:

```bash
codex-hud run -- --model gpt-5.5 --sandbox danger-full-access
```

Terminal launchers:

```bash
codex-hud run --terminal tmux
codex-hud run --terminal iterm
codex-hud run --terminal terminal
```

`tmux` is the portable default. `iterm` and `terminal` are macOS launchers.

## Commands

| Command | Purpose |
| --- | --- |
| `codex-hud status` | Print one HUD snapshot. |
| `codex-hud watch` | Refresh the HUD until interrupted. |
| `codex-hud run` | Launch Codex with a persistent HUD pane. |
| `codex-hud install` | Recommended: build the native adapter and make `codex` use the full Codex HUD footer. |
| `codex-hud setup` | Fallback only: configure Codex CLI's built-in status line without installing the full HUD adapter. |
| `codex-hud native` | Launch a patched Codex binary with command-backed HUD output. |
| `codex-hud doctor` | Check Codex, Node.js, shim, native adapter, and config readiness. |
| `codex-hud config` | Print the effective Codex HUD config. |
| `codex-hud config init` | Create `~/.codex-hud/config.json`. |

Remove the auto-launch shim:

```bash
codex-hud uninstall-shim
```

## Configuration

Create a config file:

```bash
codex-hud config init
```

Default path:

```text
~/.codex-hud/config.json
```

Minimal example:

```json
{
  "layout": "expanded",
  "pathLevels": 2,
  "elementOrder": ["model", "project", "context", "usage", "weekly", "todos", "tools"],
  "display": {
    "showContext": true,
    "showUsage": true,
    "showWeekly": true
  },
  "colors": {
    "context": "yellow",
    "usage": "magenta",
    "weekly": "magenta"
  }
}
```

`layout` can be `expanded` or `compact`. `elementOrder` controls HUD section order. Colors support common ANSI names such as `cyan`, `magenta`, `yellow`, `red`, `green`, `gray`, `dim`, and truecolor hex values such as `#FF6600`.

## Install From Source

Use this when testing the latest GitHub version:

```bash
git clone https://github.com/Jiawang1209/codex-hud.git
cd codex-hud
npm install
npm run build
npm link
```

Then follow the same environment-specific native install step as above:

```bash
codex-hud install
codex-hud doctor
codex
```

## Data Sources

Codex HUD reads:

- `~/.codex/config.toml` for model and reasoning effort.
- `~/.codex/sessions/**/*.jsonl` for token counters, rate limits, tool activity, and plan progress.
- `git` for branch and dirty state.
- `codex --version` for diagnostics.

Session parsing uses structured metadata such as event types, tool names, token counters, rate-limit counters, and plan status. It avoids displaying private transcript message bodies.

## Docs

- [Installation details](docs/installation.md)
- [Native Codex CLI patch](docs/native-codex-cli-patch.md)
- [Plugin marketplace wrapper](docs/plugin-marketplace.md)
- [Release checklist](docs/release.md)
- [Upstream command-backed status-line proposal](docs/upstream/codex-command-backed-statusline.md)

## Plugin Wrapper

This repository includes a Codex plugin wrapper in `.codex-plugin/` and `plugins/codex-hud/`. The plugin gives Codex-side guidance and marketplace metadata; the terminal HUD runtime still comes from the `codex-hud` CLI installed through npm or from source.

## Privacy

Codex HUD reads local Codex configuration, local Codex session metadata, and local git metadata. It does not upload data.

## License

MIT
