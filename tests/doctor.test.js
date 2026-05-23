import { test } from "node:test";
import assert from "node:assert/strict";
import { createDoctorReport } from "../dist/sources/codex.js";

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
