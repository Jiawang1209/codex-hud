# Productized Native Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Codex HUD as a complete product that can install the HUD CLI, prepare a patched Codex native adapter, install a reversible `codex` shim, and expose the same workflow through a Codex plugin marketplace.

**Architecture:** Keep `codex-hud` as the product entrypoint. Add a native adapter manager that can find/build/use a patched Codex checkout, then wire it through `codex-hud install`, `codex-hud doctor`, and the existing shim/native commands. Keep the patched Codex source separate from the npm package, but make its installation automatic and invisible to users.

**Tech Stack:** TypeScript ESM CLI, Node.js child process/file APIs, npm package scripts, Codex plugin manifest/marketplace JSON, patched OpenAI Codex Rust source in a sibling checkout.

---

### Task 1: Add Product Install Command

**Files:**
- Modify: `src/cli.ts`
- Create: `src/installer.ts`
- Test: `tests/installer.test.js`
- Modify: `tests/cli.test.js`

- [ ] **Step 1: Write failing installer tests**

Add tests that assert `parseInstallArgs`, `buildInstallPlan`, and `installProduct` support dry-run and explicit paths.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  buildInstallPlan,
  parseInstallArgs,
} from "../dist/installer.js";

test("parseInstallArgs supports dry-run and explicit native source", () => {
  const parsed = parseInstallArgs([
    "--dry-run",
    "--codex-source",
    "/tmp/openai-codex",
    "--bin-dir",
    "/tmp/bin",
  ]);

  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.codexSource, "/tmp/openai-codex");
  assert.equal(parsed.binDir, "/tmp/bin");
});

test("buildInstallPlan points at patched Codex binary and shim destination", () => {
  const plan = buildInstallPlan({
    codexSource: "/tmp/openai-codex",
    binDir: "/tmp/bin",
    dryRun: true,
  });

  assert.equal(plan.codexSource, "/tmp/openai-codex");
  assert.equal(plan.codexBinary, "/tmp/openai-codex/codex-rs/target/debug/codex");
  assert.equal(plan.shimPath, "/tmp/bin/codex");
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `dist/installer.js` does not exist.

- [ ] **Step 3: Implement minimal installer module**

Create `src/installer.ts` with these exports:

```ts
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { installCodexShim, defaultShimBinDir } from "./native-runner.js";

export interface ProductInstallOptions {
  dryRun: boolean;
  codexSource?: string;
  binDir?: string;
}

export interface ProductInstallPlan {
  codexSource: string;
  codexBinary: string;
  shimPath: string;
  commands: string[][];
}

export function parseInstallArgs(args: string[]): ProductInstallOptions {
  let dryRun = false;
  let codexSource: string | undefined;
  let binDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") dryRun = true;
    if (arg === "--codex-source" && args[index + 1]) codexSource = args[++index];
    if (arg === "--bin-dir" && args[index + 1]) binDir = args[++index];
  }
  return { dryRun, codexSource, binDir };
}

export function defaultCodexSource(): string {
  return path.join(os.homedir(), ".codex-hud", "native", "openai-codex");
}

export function buildInstallPlan(options: ProductInstallOptions): ProductInstallPlan {
  const codexSource = options.codexSource ?? defaultCodexSource();
  const codexBinary = path.join(codexSource, "codex-rs", "target", "debug", "codex");
  const binDir = options.binDir ?? defaultShimBinDir();
  return {
    codexSource,
    codexBinary,
    shimPath: path.join(binDir, "codex"),
    commands: [
      ["git", "clone", "--depth", "1", "--branch", "rust-v0.131.0", "https://github.com/openai/codex.git", codexSource],
      ["cargo", "build", "-p", "codex-cli"],
    ],
  };
}
```

- [ ] **Step 4: Wire `codex-hud install` into CLI**

Modify `src/cli.ts`:

```ts
import { installProduct, parseInstallArgs } from "./installer.js";
```

Add help text:

```text
codex-hud install   Prepare native Codex HUD integration
```

Add command branch:

```ts
if (command === "install") {
  return await installProduct(parseInstallArgs(argv.slice(1)));
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
```

Expected: PASS for new installer tests and existing suite.

---

### Task 2: Make Native Adapter Patch Reproducible

**Files:**
- Create: `patches/codex-cli-command-statusline.patch`
- Modify: `src/installer.ts`
- Test: `tests/installer.test.js`
- Modify: `docs/native-codex-cli-patch.md`

- [ ] **Step 1: Write failing test for patch command sequence**

Add:

```js
test("buildInstallPlan applies bundled Codex patch before building", () => {
  const plan = buildInstallPlan({
    codexSource: "/tmp/openai-codex",
    dryRun: true,
  });

  assert.deepEqual(plan.commands[1], ["git", "apply", "patches/codex-cli-command-statusline.patch"]);
  assert.deepEqual(plan.commands[2], ["cargo", "build", "-p", "codex-cli"]);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because patch command is not in the plan.

- [ ] **Step 3: Export current Codex patch**

From `/Users/liuyue/Desktop/Github_repos/openai-codex` run:

```bash
git diff -- codex-rs/tui/src/bottom_pane/chat_composer.rs \
  codex-rs/tui/src/bottom_pane/chat_composer/footer_state.rs \
  codex-rs/tui/src/bottom_pane/footer.rs \
  codex-rs/tui/src/bottom_pane/mod.rs \
  codex-rs/tui/src/chatwidget/status_controls.rs \
  codex-rs/tui/src/chatwidget/status_surfaces.rs \
  > /Users/liuyue/Desktop/Github_repos/codex-hud/patches/codex-cli-command-statusline.patch
```

- [ ] **Step 4: Update install plan to apply patch**

Modify `buildInstallPlan()` command list:

```ts
commands: [
  ["git", "clone", "--depth", "1", "--branch", "rust-v0.131.0", "https://github.com/openai/codex.git", codexSource],
  ["git", "apply", "patches/codex-cli-command-statusline.patch"],
  ["cargo", "build", "-p", "codex-cli"],
],
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

---

### Task 3: Product Doctor Checks

**Files:**
- Modify: `src/sources/codex.ts`
- Modify: `src/cli.ts`
- Test: `tests/doctor.test.js`

- [ ] **Step 1: Write failing doctor tests**

Add tests that expect doctor output to mention:

```text
codex-hud binary
codex shim
patched Codex
native status command
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because doctor only checks Codex/Node readiness today.

- [ ] **Step 3: Extend doctor report**

Add checks for:

```ts
which codex-hud
which codex
~/.local/bin/codex contains "codex-hud shim"
resolved patched Codex path exists
```

Doctor should emit actionable lines:

```text
✓ codex-hud binary found
✓ codex shim installed at ~/.local/bin/codex
✓ patched Codex found at ...
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

---

### Task 4: Marketplace Packaging

**Files:**
- Create/modify: `plugins/codex-hud/.codex-plugin/plugin.json`
- Create/modify: `plugins/codex-hud/skills/codex-hud/SKILL.md`
- Modify: `.agents/plugins/marketplace.json`
- Test: plugin validation command

- [ ] **Step 1: Create distributable plugin folder**

Copy the plugin wrapper into `plugins/codex-hud` so the marketplace source path is real:

```text
plugins/codex-hud/.codex-plugin/plugin.json
plugins/codex-hud/skills/codex-hud/SKILL.md
```

- [ ] **Step 2: Update marketplace source**

Ensure `.agents/plugins/marketplace.json` points to:

```json
{
  "name": "codex-hud",
  "source": {
    "source": "local",
    "path": "./plugins/codex-hud"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Engineering"
}
```

- [ ] **Step 3: Validate plugin**

Run:

```bash
python3 /Users/liuyue/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex-hud
```

Expected: validation succeeds.

---

### Task 5: Release Readiness

**Files:**
- Modify: `package.json`
- Create: `docs/installation.md`
- Create: `docs/plugin-marketplace.md`
- Create: `docs/release.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE` if missing

- [ ] **Step 1: Add package scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "npm run build && node --test",
    "prepack": "npm run build",
    "pack:check": "npm test && npm pack --dry-run"
  }
}
```

- [ ] **Step 2: Add installation docs**

Create `docs/installation.md` with:

```markdown
# Installation

## Recommended

```bash
npm install -g codex-hud
codex-hud install
codex
```

## Fallback without native adapter

```bash
codex-hud run
```
```

- [ ] **Step 3: Add plugin marketplace docs**

Create `docs/plugin-marketplace.md` with:

```markdown
# Codex Plugin Marketplace

```bash
codex plugin marketplace add owner/codex-hud --ref main
codex plugin add codex-hud@codex-hud-marketplace
```
```

- [ ] **Step 4: Add release docs**

Create `docs/release.md` with:

```markdown
# Release

```bash
npm run pack:check
npm publish --access public
```
```

- [ ] **Step 5: Run release checks**

Run:

```bash
npm run pack:check
```

Expected: tests pass and npm dry-run includes `dist/`, docs, plugin files, and patches.

---

### Self-Review

- Spec coverage: The plan covers unified install, native adapter patch reproduction, shim, plugin marketplace, docs, and release checks.
- Placeholder scan: No unresolved placeholders are present in command behavior. Repository owner in marketplace docs must be replaced with the final GitHub owner before publishing.
- Type consistency: Installer uses `ProductInstallOptions`, `ProductInstallPlan`, `installCodexShim`, and `defaultShimBinDir` consistently.
