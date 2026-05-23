import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});

test("codex-hud config prints JSON config", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "config"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.layout, "compact");
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
    assert.equal(parsed.layout, "compact");
    assert.equal(parsed.display.tools, true);
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

test("codex-hud unknown command exits non-zero", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "nope"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown command/);
});
