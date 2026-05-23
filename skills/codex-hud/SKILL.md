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
node dist/index.js doctor
node dist/index.js config
node dist/index.js config init
node dist/index.js watch
```

After package installation, use:

```bash
codex-hud status
codex-hud doctor
codex-hud config
codex-hud config init
codex-hud watch
```

## Current Integration Model

Codex HUD does not assume a Claude-style command-backed statusline API. The CLI is the stable core. This plugin provides packaging, setup guidance, and a future integration point if Codex CLI exposes native custom statusline providers.

## Safety

Codex HUD reads local configuration, git metadata, and environment signals. It should not upload data or parse private transcript message bodies for the MVP.
