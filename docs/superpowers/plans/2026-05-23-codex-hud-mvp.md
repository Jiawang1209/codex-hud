# Codex HUD MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Codex HUD CLI plus a Codex plugin wrapper.

**Architecture:** The CLI collects local Codex, git, and workspace signals into a normalized `HudSnapshot`, then renders compact or expanded terminal output. The plugin wrapper packages setup guidance while the CLI remains usable independently and ready for future native statusline integration.

**Tech Stack:** TypeScript, Node.js 18+, Node built-in test runner, npm package scripts, Codex plugin manifest.

---

## File Structure

- `package.json`: package metadata, bin entry, build/test scripts.
- `tsconfig.json`: strict TypeScript settings targeting Node 18 ESM.
- `src/types.ts`: shared normalized HUD state interfaces.
- `src/config.ts`: defaults, config loading, validation, merge logic.
- `src/sources/git.ts`: git status collection.
- `src/sources/codex.ts`: Codex CLI/config/version detection.
- `src/snapshot.ts`: compose source data into `HudSnapshot`.
- `src/render.ts`: compact and expanded HUD renderers.
- `src/cli.ts`: command parsing and command implementations.
- `src/index.ts`: executable entrypoint.
- `tests/*.test.js`: Node test runner coverage against compiled `dist`.
- `.codex-plugin/plugin.json`: Codex plugin metadata.
- `skills/codex-hud/SKILL.md`: plugin-facing user guidance.
- `README.md`: user-facing project overview and commands.

## Task 1: TypeScript Package Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/cli.ts`
- Test: `tests/cli.test.js`

- [ ] **Step 1: Write the failing CLI help test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("codex-hud --help prints available commands", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /codex-hud/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /doctor/);
  assert.match(result.stdout, /watch/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli.test.js`

Expected: FAIL because package scripts and `dist/index.js` do not exist yet.

- [ ] **Step 3: Add minimal package and CLI help implementation**

Create `package.json`, `tsconfig.json`, `src/index.ts`, and `src/cli.ts` with a Node ESM CLI that recognizes `--help`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json src/index.ts src/cli.ts tests/cli.test.js
git commit -m "feat: scaffold codex hud cli"
```

## Task 2: Config Loading

**Files:**
- Create: `src/config.ts`
- Modify: `src/cli.ts`
- Test: `tests/config.test.js`

- [ ] **Step 1: Write failing config tests**

Test defaults, invalid JSON fallback, and explicit config values for `layout`, `refreshIntervalMs`, `pathLevels`, and display toggles.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config.test.js`

Expected: FAIL because `dist/config.js` does not exist.

- [ ] **Step 3: Implement config defaults and validation**

Implement `DEFAULT_CONFIG`, `mergeConfig`, `loadConfig`, and `resolveConfigPath`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/config.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/cli.ts tests/config.test.js
git commit -m "feat: add hud config loading"
```

## Task 3: Git Source and Renderer

**Files:**
- Create: `src/types.ts`
- Create: `src/sources/git.ts`
- Create: `src/render.ts`
- Test: `tests/render.test.js`

- [ ] **Step 1: Write failing render tests**

Test compact rendering with model, reasoning effort, project name, dirty git branch, context percentage, todo progress, and active tools.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/render.test.js`

Expected: FAIL because renderer and types do not exist.

- [ ] **Step 3: Implement normalized types, git source, and renderer**

Create small focused modules. The renderer must accept `HudSnapshot` and not read files directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/render.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/sources/git.ts src/render.ts tests/render.test.js
git commit -m "feat: render codex hud snapshots"
```

## Task 4: Codex Source, Snapshot, Status, and Doctor

**Files:**
- Create: `src/sources/codex.ts`
- Create: `src/snapshot.ts`
- Modify: `src/cli.ts`
- Test: `tests/snapshot.test.js`
- Test: `tests/doctor.test.js`

- [ ] **Step 1: Write failing snapshot and doctor tests**

Test model/reasoning extraction from sample config text, Codex version parsing, missing Codex diagnostics, and fallback snapshot behavior.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/snapshot.test.js tests/doctor.test.js`

Expected: FAIL because Codex source and snapshot modules do not exist.

- [ ] **Step 3: Implement Codex source and CLI commands**

Implement `status`, `doctor`, and `config` commands. `status` should print one compact HUD line by default.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/snapshot.test.js tests/doctor.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sources/codex.ts src/snapshot.ts src/cli.ts tests/snapshot.test.js tests/doctor.test.js
git commit -m "feat: add codex status and doctor sources"
```

## Task 5: Watch Mode and Plugin Wrapper

**Files:**
- Modify: `src/cli.ts`
- Create: `.codex-plugin/plugin.json`
- Create: `skills/codex-hud/SKILL.md`
- Modify: `README.md`
- Test: `tests/cli.test.js`

- [ ] **Step 1: Write failing CLI tests for unknown command and config output**

Extend CLI tests to verify unknown commands exit non-zero and `config` prints JSON.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/cli.test.js`

Expected: FAIL until command handling is complete.

- [ ] **Step 3: Implement watch command and plugin wrapper files**

Add interval-based watch rendering with Ctrl-C cleanup. Add plugin metadata and setup skill guidance.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run build
node dist/index.js doctor
node dist/index.js status
```

Expected: tests pass, build succeeds, doctor prints environment diagnostics, status prints one HUD line.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts .codex-plugin/plugin.json skills/codex-hud/SKILL.md README.md tests/cli.test.js
git commit -m "feat: add watch mode and codex plugin wrapper"
```

## Self-Review

- Spec coverage: CLI commands, config, normalized snapshot, rendering, diagnostics, plugin wrapper, tests, and docs are covered.
- Intentional deferral: Deep Codex session JSONL parsing is not in MVP Task 1-5; the first version leaves the source boundary ready for that work after the basic CLI is verified.
- Placeholder scan: no task depends on an undefined future API.
