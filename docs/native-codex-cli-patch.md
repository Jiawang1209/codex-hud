# Native Codex CLI patch

`codex-hud run` can simulate a HUD in a split terminal, but a true in-window HUD needs Codex CLI itself to execute and render command-backed status output.

This repository currently tracks a local proof-of-concept patch against OpenAI Codex CLI `rust-v0.131.0` in:

```sh
/Users/liuyue/Desktop/Github_repos/openai-codex
```

The patch adds support for a `command:` item in `tui.status_line`. When present, Codex runs the command from the current session directory and renders stdout in the native bottom footer. Multi-line stdout is preserved, so `codex-hud status` can appear as a lower native HUD:

```text
[gpt-5.5 medium] │ codex-hud git:(feat/codex-hud-mvp*)
Context ███░░░░░░░ 31% │ Usage ░░░░░░░░░░ 0% (0m / 5h)
Todos 0/4 │ Stdin x5, Exec active
```

## Build

```sh
cd /Users/liuyue/Desktop/Github_repos/openai-codex/codex-rs
cargo build -p codex-cli
```

The patched binary is:

```sh
/Users/liuyue/Desktop/Github_repos/openai-codex/codex-rs/target/debug/codex
```

## Try it

Use a command-backed status line override when launching the patched binary:

```sh
/Users/liuyue/Desktop/Github_repos/openai-codex/codex-rs/target/debug/codex \
  -c 'tui.status_line=["command: codex-hud status"]'
```

For a persistent local test, add this to `~/.codex/config.toml` and launch the patched binary:

```toml
[tui]
status_line = ["command: codex-hud status"]
```

## Current state

- Implemented: command-backed native status line.
- Implemented: multi-line command stdout in the native bottom footer.
- Verified: `cargo test -p codex-tui status_line --lib`.
- Verified: `cargo build -p codex-cli`.

This is still a local fork patch, not an upstream Codex CLI feature. The next step is to turn the patch into a clean upstream PR proposal and keep `codex-hud run` as the fallback for users on stock Codex CLI.
