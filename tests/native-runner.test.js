import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  buildNativeCodexArgs,
  buildShimScript,
  defaultShimBinDir,
  installCodexShim,
  parseNativeArgs,
  removeCodexShim,
} from "../dist/native-runner.js";

test("parseNativeArgs forwards Codex args after --", () => {
  const parsed = parseNativeArgs([
    "--codex",
    "/tmp/patched-codex",
    "--dry-run",
    "--",
    "--model",
    "gpt-5.5",
  ]);

  assert.equal(parsed.codexPath, "/tmp/patched-codex");
  assert.equal(parsed.dryRun, true);
  assert.deepEqual(parsed.codexArgs, ["--model", "gpt-5.5"]);
});

test("buildNativeCodexArgs injects command-backed HUD status line", () => {
  assert.deepEqual(buildNativeCodexArgs(["--model", "gpt-5.5"]), [
    "-c",
    'tui.status_line=["command: codex-hud status"]',
    "--model",
    "gpt-5.5",
  ]);
});

test("buildNativeCodexArgs uses the cmd shim for command-backed HUD on Windows", () => {
  assert.deepEqual(buildNativeCodexArgs(["--model", "gpt-5.5"], { platform: "win32" }), [
    "-c",
    'tui.status_line=["command: codex-hud.cmd status"]',
    "--model",
    "gpt-5.5",
  ]);
});

test("buildShimScript delegates codex to codex-hud native", () => {
  const script = buildShimScript({ codexPath: "/tmp/patched codex" });

  assert.match(script, /^#!\/bin\/sh/);
  assert.match(script, /codex-hud native --codex '\/tmp\/patched codex' -- "\$@"/);
});

test("buildShimScript creates a Windows cmd wrapper that avoids the PowerShell ps1 shim", () => {
  const script = buildShimScript({ codexPath: "C:\\Users\\me\\codex.exe", platform: "win32" });

  assert.match(script, /^@echo off/);
  assert.match(script, /codex-hud\.cmd native --codex "C:\\Users\\me\\codex\.exe" -- %\*/);
});

test("defaultShimBinDir uses npm global shim directory on Windows", () => {
  assert.equal(
    defaultShimBinDir({
      env: { APPDATA: "C:\\Users\\me\\AppData\\Roaming" },
      platform: "win32",
    }),
    "C:\\Users\\me\\AppData\\Roaming/npm",
  );
});

test("installCodexShim writes a reversible codex shim", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-shim-"));

  try {
    const result = await installCodexShim({ binDir: dir, codexPath: "/tmp/patched-codex" });

    assert.equal(result.changed, true);
    assert.equal(result.path, path.join(dir, "codex"));
    const script = await readFile(result.path, "utf8");
    assert.match(script, /codex-hud shim/);
    assert.match(script, /--codex \/tmp\/patched-codex/);

    const second = await installCodexShim({ binDir: dir, codexPath: "/tmp/patched-codex" });
    assert.equal(second.changed, false);

    const removed = await removeCodexShim({ binDir: dir });
    assert.equal(removed.removed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("installCodexShim writes codex.cmd on Windows", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-shim-"));

  try {
    const result = await installCodexShim({
      binDir: dir,
      codexPath: "C:\\Users\\me\\codex.exe",
      platform: "win32",
    });

    assert.equal(result.changed, true);
    assert.equal(result.path, path.join(dir, "codex.cmd"));
    const script = await readFile(result.path, "utf8");
    assert.match(script, /codex-hud shim/);
    assert.match(script, /codex-hud\.cmd native/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("installCodexShim backs up and replaces an existing official codex shim", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-shim-"));

  try {
    const shimPath = path.join(dir, "codex.cmd");
    const backupPath = path.join(dir, "codex.cmd.codex-hud-backup");
    const officialShim = "@echo off\r\nnode codex.js %*\r\n";
    await writeFile(shimPath, officialShim, "utf8");

    const result = await installCodexShim({
      binDir: dir,
      codexPath: "C:\\Users\\me\\codex.exe",
      platform: "win32",
    });

    assert.equal(result.changed, true);
    assert.match(await readFile(shimPath, "utf8"), /codex-hud\.cmd native/);
    assert.equal(await readFile(backupPath, "utf8"), officialShim);

    const removed = await removeCodexShim({ binDir: dir, platform: "win32" });
    assert.equal(removed.removed, true);
    assert.equal(await readFile(shimPath, "utf8"), officialShim);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
