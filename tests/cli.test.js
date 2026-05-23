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
