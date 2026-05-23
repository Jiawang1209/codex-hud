import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_CONFIG,
  loadConfig,
  mergeConfig,
  resolveConfigPath,
} from "../dist/config.js";

test("mergeConfig returns defaults for empty input", () => {
  const config = mergeConfig({});

  assert.equal(config.layout, "expanded");
  assert.equal(config.lineLayout, "expanded");
  assert.equal(config.language, "en");
  assert.equal(config.refreshIntervalMs, 1000);
  assert.equal(config.pathLevels, 1);
  assert.deepEqual(config.elementOrder, DEFAULT_CONFIG.elementOrder);
  assert.equal(config.gitStatus.enabled, true);
  assert.equal(config.display.showModel, true);
  assert.equal(config.display.showGit, true);
});

test("mergeConfig preserves valid user values", () => {
  const config = mergeConfig({
    language: "zh",
    lineLayout: "compact",
    refreshIntervalMs: 300,
    pathLevels: 3,
    codexHome: "/tmp/codex-home",
    elementOrder: ["project", "context", "weekly"],
    gitStatus: {
      enabled: false,
      showDirty: false,
      showAheadBehind: true,
    },
    display: {
      usage: false,
      showWeekly: false,
      tools: false,
    },
    colors: {
      model: "cyan",
      project: "yellow",
      custom: "#FF6600",
    },
  });

  assert.equal(config.layout, "compact");
  assert.equal(config.lineLayout, "compact");
  assert.equal(config.language, "zh");
  assert.equal(config.refreshIntervalMs, 300);
  assert.equal(config.pathLevels, 3);
  assert.equal(config.codexHome, "/tmp/codex-home");
  assert.deepEqual(config.elementOrder, ["project", "context", "weekly"]);
  assert.equal(config.gitStatus.enabled, false);
  assert.equal(config.gitStatus.showDirty, false);
  assert.equal(config.gitStatus.showAheadBehind, true);
  assert.equal(config.display.showUsage, false);
  assert.equal(config.display.showWeekly, false);
  assert.equal(config.display.showTools, false);
  assert.equal(config.display.showModel, DEFAULT_CONFIG.display.showModel);
  assert.equal(config.colors.model, "cyan");
  assert.equal(config.colors.project, "yellow");
  assert.equal(config.colors.custom, "#FF6600");
});

test("mergeConfig rejects invalid values", () => {
  const config = mergeConfig({
    layout: "wide",
    refreshIntervalMs: 10,
    pathLevels: 9,
    display: {
      model: "yes",
    },
    colors: {
      barFilled: "",
    },
  });

  assert.equal(config.layout, DEFAULT_CONFIG.layout);
  assert.equal(config.lineLayout, DEFAULT_CONFIG.lineLayout);
  assert.equal(config.refreshIntervalMs, DEFAULT_CONFIG.refreshIntervalMs);
  assert.equal(config.pathLevels, DEFAULT_CONFIG.pathLevels);
  assert.deepEqual(config.elementOrder, DEFAULT_CONFIG.elementOrder);
  assert.equal(config.display.showModel, DEFAULT_CONFIG.display.showModel);
  assert.equal(config.colors.barFilled, DEFAULT_CONFIG.colors.barFilled);
});

test("loadConfig falls back to defaults for invalid JSON", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-config-"));
  const configPath = path.join(dir, "config.json");
  await writeFile(configPath, "{not-json", "utf8");

  try {
    const config = await loadConfig(configPath);
    assert.equal(config.layout, DEFAULT_CONFIG.layout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig reads config file when present", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-config-"));
  const configPath = path.join(dir, "config.json");
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify({ layout: "expanded" }), "utf8");

  try {
    const config = await loadConfig(configPath);
    assert.equal(config.layout, "expanded");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolveConfigPath honors explicit path before home directory", () => {
  assert.equal(resolveConfigPath("/tmp/custom.json", "/tmp/home"), "/tmp/custom.json");
  assert.equal(resolveConfigPath(undefined, "/tmp/home"), "/tmp/home/.codex-hud/config.json");
});
