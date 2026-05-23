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

test("createHudSnapshot includes session-derived signals", async () => {
  const snapshot = await createHudSnapshot({
    cwd: "/tmp/codex-hud",
    config: DEFAULT_CONFIG,
    codexInfo: {
      model: "gpt-5.5",
      reasoningEffort: "medium",
      version: "0.131.0",
    },
    sessionSignals: {
      context: { label: "Context", percent: 25 },
      usage: { label: "5h", percent: 68, windowMinutes: 300 },
      weekly: { label: "Weekly", percent: 86, windowMinutes: 10080 },
      tools: [{ name: "Exec", status: "completed", count: 2 }],
      todos: { completed: 1, total: 3, current: "Parse session" },
    },
  });

  assert.deepEqual(snapshot.context, { label: "Context", percent: 25 });
  assert.deepEqual(snapshot.usage, { label: "5h", percent: 68, windowMinutes: 300 });
  assert.deepEqual(snapshot.weekly, { label: "Weekly", percent: 86, windowMinutes: 10080 });
  assert.deepEqual(snapshot.tools, [{ name: "Exec", status: "completed", count: 2 }]);
  assert.deepEqual(snapshot.todos, {
    completed: 1,
    total: 3,
    current: "Parse session",
  });
});
