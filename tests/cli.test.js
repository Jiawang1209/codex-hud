import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

test("codex-hud --help prints available commands", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /codex-hud/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /doctor/);
  assert.match(result.stdout, /watch/);
  assert.match(result.stdout, /run/);
  assert.match(result.stdout, /pane/);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /native/);
  assert.match(result.stdout, /install-shim/);
  assert.match(result.stdout, /setup/);
});

test("codex-hud config prints JSON config", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "config"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.layout, "expanded");
});

test("codex-hud config init writes default config to explicit path", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-cli-"));
  const configPath = path.join(dir, "config.json");

  try {
    const result = spawnSync(process.execPath, ["dist/index.js", "config", "init", "--path", configPath], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /created/);
    const parsed = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(parsed.layout, "expanded");
    assert.equal(parsed.display.showTools, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codex-hud config init does not overwrite existing config", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-cli-"));
  const configPath = path.join(dir, "config.json");

  try {
    spawnSync(process.execPath, ["dist/index.js", "config", "init", "--path", configPath], {
      encoding: "utf8",
    });
    const result = spawnSync(process.execPath, ["dist/index.js", "config", "init", "--path", configPath], {
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /already exists/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codex-hud setup configures Codex native status line", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-cli-"));
  const configPath = path.join(dir, "config.toml");
  await writeFile(configPath, "model = \"gpt-5.5\"\n", "utf8");

  try {
    const result = spawnSync(process.execPath, ["dist/index.js", "setup", "--config", configPath], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Codex status line configured/);
    const written = await readFile(configPath, "utf8");
    assert.match(written, /\[tui\]/);
    assert.match(written, /"context-used"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codex-hud native dry-run prints patched Codex launch command", () => {
  const result = spawnSync(process.execPath, [
    "dist/index.js",
    "native",
    "--codex",
    "/tmp/patched codex",
    "--dry-run",
    "--",
    "--model",
    "gpt-5.5",
  ], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /'\/tmp\/patched codex'/);
  assert.match(result.stdout, /tui.status_line=/);
  assert.match(result.stdout, /--model gpt-5.5/);
});

test("codex-hud status honors CODEX_HUD_FORCE_COLOR", () => {
  const { NO_COLOR: _noColor, ...env } = process.env;
  const result = spawnSync(process.execPath, ["dist/index.js", "status"], {
    encoding: "utf8",
    env: {
      ...env,
      CODEX_HUD_FORCE_COLOR: "1",
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /\x1b\[/);
});

test("codex-hud install-shim installs codex wrapper into explicit bin dir", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-cli-"));

  try {
    const result = spawnSync(process.execPath, [
      "dist/index.js",
      "install-shim",
      "--bin-dir",
      dir,
      "--codex",
      "/tmp/patched-codex",
    ], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /codex shim installed/);
    const written = await readFile(path.join(dir, "codex"), "utf8");
    assert.match(written, /codex-hud native/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codex-hud unknown command exits non-zero", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "nope"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown command/);
});
