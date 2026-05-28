import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDoctorReport,
  resolveCommandArgs,
  versionCommandArgs,
} from "../dist/sources/codex.js";

test("createDoctorReport reports missing codex binary", async () => {
  const report = await createDoctorReport({
    resolveCodexPath: async () => undefined,
    readCodexVersion: async () => undefined,
    codexHome: "/tmp/missing-codex-home",
  });

  assert.equal(report.codexCli.found, false);
  assert.equal(report.ok, false);
  assert.match(report.lines.join("\n"), /Codex CLI: not found/);
});

test("createDoctorReport reports detected codex binary and version", async () => {
  const report = await createDoctorReport({
    resolveCodexPath: async () => "/usr/local/bin/codex",
    readCodexVersion: async () => "0.131.0",
    codexHome: "/tmp/codex-home",
  });

  assert.equal(report.codexCli.found, true);
  assert.equal(report.codexCli.version, "0.131.0");
  assert.equal(report.ok, true);
  assert.match(report.lines.join("\n"), /Codex CLI: 0.131.0/);
});

test("createDoctorReport reports native bundle readiness", async () => {
  const report = await createDoctorReport({
    resolveCodexPath: async () => "/tmp/bin/codex",
    readCodexVersion: async () => "0.131.0",
    resolveCodexHudPath: async () => "/tmp/bin/codex-hud",
    codexHome: "/tmp/codex-home",
    shimPath: "/tmp/bin/codex",
    readTextFile: async () => [
      "#!/bin/sh",
      "# codex-hud shim",
      "exec codex-hud native --codex /tmp/openai-codex/codex-rs/target/debug/codex -- \"$@\"",
      "",
    ].join("\n"),
    pathExists: async (target) => target === "/tmp/openai-codex/codex-rs/target/debug/codex",
  });

  assert.equal(report.codexHud.found, true);
  assert.equal(report.codexShim.installed, true);
  assert.equal(report.patchedCodex.found, true);
  assert.equal(report.nativeStatusCommand.configured, true);
  assert.match(report.lines.join("\n"), /codex-hud binary found/);
  assert.match(report.lines.join("\n"), /codex shim installed/);
  assert.match(report.lines.join("\n"), /patched Codex found/);
  assert.match(report.lines.join("\n"), /native status command configured/);
});

test("createDoctorReport detects a Windows cmd shim", async () => {
  const report = await createDoctorReport({
    resolveCodexPath: async () => "C:\\Users\\me\\bin\\codex.cmd",
    resolveCodexHudPath: async () => "C:\\Users\\me\\bin\\codex-hud.cmd",
    readCodexVersion: async () => "0.131.0",
    codexHome: "C:\\Users\\me\\.codex",
    shimPath: "C:\\Users\\me\\bin\\codex.cmd",
    readTextFile: async () => [
      "@echo off",
      "REM codex-hud shim",
      "codex-hud.cmd native --codex \"C:\\Users\\me\\codex.exe\" -- %*",
      "",
    ].join("\n"),
    pathExists: async () => true,
  });

  assert.equal(report.codexShim.installed, true);
  assert.equal(report.patchedCodex.path, "C:\\Users\\me\\codex.exe");
  assert.equal(report.nativeStatusCommand.configured, true);
});

test("resolveCommandArgs uses where.exe on Windows", () => {
  assert.deepEqual(resolveCommandArgs("codex", "win32"), {
    command: "where.exe",
    args: ["codex"],
  });
  assert.deepEqual(resolveCommandArgs("codex", "linux"), {
    command: "sh",
    args: ["-c", "command -v codex"],
  });
});

test("versionCommandArgs runs npm cmd shims through cmd.exe on Windows", () => {
  assert.deepEqual(versionCommandArgs("codex", "win32"), {
    command: "cmd.exe",
    args: ["/C", "codex", "--version"],
  });
  assert.deepEqual(versionCommandArgs("codex", "linux"), {
    command: "codex",
    args: ["--version"],
  });
});

test("createDoctorReport uses Windows defaults for shim and patched Codex paths", async () => {
  const report = await createDoctorReport({
    codexHome: "C:\\Users\\me\\.codex",
    env: {
      APPDATA: "C:\\Users\\me\\AppData\\Roaming",
      USERPROFILE: "C:\\Users\\me",
    },
    platform: "win32",
    readTextFile: async () => undefined,
    resolveCodexHudPath: async () => "C:\\Users\\me\\AppData\\Roaming\\npm\\codex-hud.cmd",
    resolveCodexPath: async () => "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
    readCodexVersion: async () => "0.134.0",
    pathExists: async () => false,
  });

  assert.equal(report.codexShim.path, "C:\\Users\\me\\AppData\\Roaming/npm/codex.cmd");
  assert.equal(report.patchedCodex.path, "C:\\Users\\me/Desktop/Github_repos/openai-codex/codex-rs/target/debug/codex.exe");
});
