# Changelog

## Unreleased

- Add Windows native shim support with `codex.cmd` and `codex-hud.cmd status` for command-backed HUD injection.
- Document the difference between Codex CLI built-in status-line items and the exact `codex-hud status` renderer.

## 0.1.1

- Clarify npm, source, and Marketplace installation paths in the README.
- Normalize the npm binary path generated during publish.

## 0.1.0

- Add Codex HUD CLI with `status`, `watch`, `doctor`, `config`, `setup`, `run`, `native`, and shim commands.
- Add configurable Claude HUD-like colors, expanded multi-line layout, git, context, usage, weekly usage, tools, and todos display.
- Add `codex-hud install` to prepare the native patched Codex adapter and install a reversible `codex` shim.
- Bundle the Codex CLI command-backed status-line patch for reproducible native HUD setup.
- Add Codex plugin marketplace packaging under `plugins/codex-hud`.
