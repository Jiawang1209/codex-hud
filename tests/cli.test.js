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

test("codex-hud config prints JSON config", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "config"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.layout, "compact");
});

test("codex-hud unknown command exits non-zero", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "nope"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown command/);
});
