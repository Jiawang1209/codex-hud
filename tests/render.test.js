import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHud } from "../dist/render.js";
import { DEFAULT_CONFIG } from "../dist/config.js";

test("renderHud renders compact snapshot with core signals", () => {
  const output = renderHud({
    config: DEFAULT_CONFIG,
    snapshot: {
      model: "gpt-5.5",
      reasoningEffort: "medium",
      cwd: "/tmp/codex-hud",
      projectName: "codex-hud",
      git: {
        branch: "main",
        isDirty: true,
        ahead: 0,
        behind: 0,
      },
      context: { label: "Context", percent: 42 },
      usage: { label: "5h", percent: 68 },
      tools: [
        { name: "Bash", status: "active" },
        { name: "Edit", status: "completed", count: 2 },
      ],
      todos: { completed: 2, total: 5, current: "Build CLI scaffold" },
      warnings: [],
    },
  });

  assert.equal(
    output,
    "[gpt-5.5 medium] | codex-hud git:(main*) | Context 42% | 5h 68% | Todos 2/5 | Bash active, Edit x2",
  );
});

test("renderHud renders expanded snapshot across multiple lines", () => {
  const output = renderHud({
    config: { ...DEFAULT_CONFIG, layout: "expanded" },
    snapshot: {
      model: "gpt-5.5",
      cwd: "/tmp/codex-hud",
      projectName: "codex-hud",
      tools: [],
      todos: { completed: 0, total: 0 },
      warnings: [],
    },
  });

  assert.equal(output, "[gpt-5.5] | codex-hud");
});
