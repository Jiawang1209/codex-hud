# Installation

## Recommended Native HUD

```bash
npm install -g codex-hud
codex-hud install
codex
```

`codex-hud install` prepares the complete native bundle:

- downloads a clean Codex CLI source checkout under `~/.codex-hud/native/openai-codex`
- applies the bundled command-backed status-line patch
- builds the patched Codex binary
- installs a reversible `codex` shim in `~/.local/bin`

After that, users run `codex` normally and Codex HUD is injected into the native Codex footer.

## Verify

```bash
codex-hud doctor
```

The doctor output should report the `codex-hud` binary, `codex` shim, patched Codex binary, and native status command.

## Custom Paths

```bash
codex-hud install --codex-source ~/src/openai-codex --bin-dir ~/.local/bin
```

Use this when you already keep a Codex source checkout somewhere else or need a custom shim directory.

## Fallback Without Native Adapter

```bash
codex-hud run
```

This opens Codex with an external HUD pane using tmux, iTerm2, or Terminal.app. It does not require the patched Codex native adapter.
