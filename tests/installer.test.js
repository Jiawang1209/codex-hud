import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("buildInstallPlan points at Windows patched Codex binary and cmd shim", () => {
  const plan = buildInstallPlan({
    codexSource: "C:\\Users\\me\\openai-codex",
    binDir: "C:\\Users\\me\\bin",
    dryRun: true,
    platform: "win32",
  });

  assert.equal(plan.codexBinary, "C:\\Users\\me\\openai-codex/codex-rs/target/debug/codex.exe");
  assert.equal(plan.shimPath, "C:\\Users\\me\\bin/codex.cmd");
});

test("buildInstallPlan defaults to the npm global shim directory on Windows", () => {
  const plan = buildInstallPlan({
    codexSource: "C:\\Users\\me\\openai-codex",
    dryRun: true,
    env: { APPDATA: "C:\\Users\\me\\AppData\\Roaming" },
    platform: "win32",
  });

  assert.equal(plan.shimPath, "C:\\Users\\me\\AppData\\Roaming/npm/codex.cmd");
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

test("bundled Codex patch runs command-backed status lines through cmd.exe on Windows", async () => {
  const patch = await readFile("patches/codex-cli-command-statusline.patch", "utf8");

  assert.match(patch, /cfg!\(windows\)/);
  assert.match(patch, /Command::new\("cmd"\)/);
  assert.match(patch, /\.arg\("\/C"\)/);
  assert.match(patch, /Command::new\("sh"\)/);
});
