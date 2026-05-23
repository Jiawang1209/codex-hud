import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCodexConfigText, parseCodexVersion } from "../dist/sources/codex.js";
import { createHudSnapshot } from "../dist/snapshot.js";
import { DEFAULT_CONFIG } from "../dist/config.js";

test("parseCodexConfigText extracts model and reasoning effort", () => {
  const parsed = parseCodexConfigText('model = "gpt-5.5"\nmodel_reasoning_effort = "medium"\n');

  assert.equal(parsed.model, "gpt-5.5");
  assert.equal(parsed.reasoningEffort, "medium");
});

test("parseCodexVersion extracts version from codex output", () => {
  assert.equal(parseCodexVersion("codex-cli 0.131.0\n"), "0.131.0");
  assert.equal(parseCodexVersion("unexpected"), undefined);
});

test("createHudSnapshot builds fallback snapshot from cwd", async () => {
  const snapshot = await createHudSnapshot({
    cwd: "/tmp/codex-hud",
    config: DEFAULT_CONFIG,
    codexInfo: {
      model: "gpt-5.5",
      reasoningEffort: "medium",
      version: "0.131.0",
    },
    git: {
      branch: "main",
      isDirty: false,
      ahead: 0,
      behind: 0,
    },
  });

  assert.equal(snapshot.projectName, "codex-hud");
  assert.equal(snapshot.model, "gpt-5.5");
  assert.equal(snapshot.reasoningEffort, "medium");
  assert.equal(snapshot.git?.branch, "main");
  assert.deepEqual(snapshot.tools, []);
  assert.deepEqual(snapshot.todos, { completed: 0, total: 0 });
});
