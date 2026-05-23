import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInstallPlan,
  patchActionFromChecks,
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

test("buildInstallPlan applies bundled Codex patch before building", () => {
  const plan = buildInstallPlan({
    codexSource: "/tmp/openai-codex",
    dryRun: true,
  });

  assert.deepEqual(plan.commands[1], ["git", "apply", "patches/codex-cli-command-statusline.patch"]);
  assert.deepEqual(plan.commands[2], ["cargo", "build", "-p", "codex-cli"]);
});

test("patchActionFromChecks treats reverse-applicable patch as already installed", () => {
  assert.equal(patchActionFromChecks(true, false), "apply");
  assert.equal(patchActionFromChecks(false, true), "already-applied");
  assert.equal(patchActionFromChecks(false, false), "conflict");
});
