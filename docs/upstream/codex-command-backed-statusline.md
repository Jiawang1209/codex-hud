# Feature Request: Command-Backed TUI Status Line for Codex CLI

## Summary

Please add a supported command-backed status line provider to Codex CLI, similar to Claude Code's `statusLine.command`.

Codex CLI already supports a useful fixed-item footer through `[tui].status_line`, with items such as `model-with-reasoning`, `current-dir`, `git-branch`, `context-used`, `five-hour-limit`, `weekly-limit`, and `fast-mode`. That works well for built-in telemetry, but it does not let plugins render custom multi-line HUDs, custom labels, ANSI styling, or derived session signals.

## Proposed Configuration

One possible TOML shape:

```toml
[tui.status_line]
type = "command"
command = "codex-hud status --statusline"
refresh_ms = 1000
```

Alternatively, Codex could keep the current array form for built-in items and add a separate command provider:

```toml
[tui.status_line_command]
command = "codex-hud status --statusline"
refresh_ms = 1000
```

## Input Contract

Codex would invoke the configured command with session/status JSON on stdin. A minimal payload could include:

```json
{
  "model": "gpt-5.5",
  "reasoning_effort": "medium",
  "cwd": "/path/to/project",
  "git_branch": "main",
  "git_dirty": true,
  "context_used_percent": 45,
  "rate_limits": {
    "primary": {
      "used_percent": 25,
      "window_minutes": 300
    },
    "secondary": {
      "used_percent": 40,
      "window_minutes": 10080
    }
  },
  "task_progress": {
    "completed": 2,
    "total": 5,
    "current": "Implement wrapper"
  },
  "active_tools": [
    { "name": "exec", "status": "active" }
  ]
}
```

## Output Contract

The command prints one or more lines to stdout. Codex renders that output in the TUI status area.

Example output:

```text
[gpt-5.5 medium] │ codex-hud git:(main*)
Context █████░░░░░ 45% │ Usage ██░░░░░░░░ 25% (1h 15m / 5h)
Todos 2/5 │ Exec active
```

## Why This Matters

Command-backed status lines would allow Codex plugins to provide high-signal, workflow-specific status displays without requiring users to fork Codex CLI or run external panes.

This would unlock:

- Plugin-rendered HUDs for context, usage, tool state, todos, git, and session health.
- Team-specific status banners and policy indicators.
- Compact terminal dashboards for users running multiple Codex sessions.
- Ecosystem parity with Claude Code statusline plugins while keeping Codex's built-in status line available for users who prefer it.

## Real Use Case

`codex-hud` currently ships:

- A standalone `codex-hud status` renderer.
- A `codex-hud run` tmux wrapper that approximates a persistent HUD.
- A `codex-hud setup` command that configures the best available native `[tui].status_line` built-in items.

The missing piece is a native Codex TUI provider that can call `codex-hud status` and render its output directly in the main Codex interface.

## Compatibility

This can be additive:

- Existing `[tui].status_line = [...]` behavior remains unchanged.
- Command-backed status lines are opt-in.
- Codex can impose timeout, max-line, and max-byte limits.
- Codex can strip unsupported control sequences while preserving common ANSI color codes if desired.
