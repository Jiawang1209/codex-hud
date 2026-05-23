# Codex Plugin Marketplace

Codex HUD ships both as an npm CLI package and as a Codex plugin wrapper. The plugin teaches Codex how to inspect, configure, and run the HUD workflow.

## Local Marketplace

From this repository:

```bash
python3 /Users/liuyue/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex-hud
codex plugin marketplace add /path/to/codex-hud
codex plugin add codex-hud@codex-hud-marketplace
```

The marketplace entry points at:

```text
./plugins/codex-hud
```

## Repository Marketplace

When this repository is published, users should be able to add the marketplace from the GitHub repository:

```bash
codex plugin marketplace add Jiawang1209/codex-hud --ref main
codex plugin add codex-hud@codex-hud-marketplace
```

Adjust `Jiawang1209/codex-hud` if the final GitHub owner or repository name changes.

## Product Install From Plugin

The plugin does not replace the CLI package. It guides the user to install the product runtime:

```bash
npm install -g codex-hud
codex-hud install
codex
```

This keeps the executable HUD, native Codex adapter, patch, and shim in the npm product while exposing setup and diagnostics through Codex's plugin marketplace.
