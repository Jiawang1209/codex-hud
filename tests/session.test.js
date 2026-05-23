import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  findLatestSessionFile,
  parseSessionJsonl,
} from "../dist/sources/session.js";

test("parseSessionJsonl extracts context, usage, tools, and todos without reading message bodies", () => {
  const text = [
    JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        call_id: "call_1",
      },
    }),
    JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call_1",
        output: "not used by parser",
      },
    }),
    JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call",
        name: "update_plan",
        call_id: "call_2",
        arguments: JSON.stringify({
          plan: [
            { step: "Scaffold CLI", status: "completed" },
            { step: "Parse session", status: "in_progress" },
            { step: "Polish docs", status: "pending" },
          ],
        }),
      },
    }),
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: { total_tokens: 50000 },
          model_context_window: 200000,
        },
        rate_limits: {
          primary: {
            used_percent: 68,
            window_minutes: 300,
          },
        },
      },
    }),
  ].join("\n");

  const parsed = parseSessionJsonl(text);

  assert.deepEqual(parsed.context, { label: "Context", percent: 25 });
  assert.deepEqual(parsed.usage, { label: "5h", percent: 68 });
  assert.deepEqual(parsed.todos, {
    completed: 1,
    total: 3,
    current: "Parse session",
  });
  assert.deepEqual(parsed.tools, [
    { name: "Exec", status: "completed", count: 1 },
    { name: "Plan", status: "active", count: 1 },
  ]);
});

test("parseSessionJsonl uses last token usage for context before cumulative session usage", () => {
  const text = JSON.stringify({
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { total_tokens: 800000 },
        last_token_usage: { total_tokens: 50000 },
        model_context_window: 200000,
      },
    },
  });

  const parsed = parseSessionJsonl(text);

  assert.deepEqual(parsed.context, { label: "Context", percent: 25 });
});

test("parseSessionJsonl tolerates malformed lines", () => {
  const parsed = parseSessionJsonl("{not-json\n\n");

  assert.deepEqual(parsed.tools, []);
  assert.deepEqual(parsed.todos, { completed: 0, total: 0 });
});

test("parseSessionJsonl summarizes only recent tool calls when limited", () => {
  const lines = [];
  for (let index = 0; index < 10; index += 1) {
    lines.push(JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        call_id: `exec_${index}`,
      },
    }));
    lines.push(JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: `exec_${index}`,
        output: "not used",
      },
    }));
  }
  lines.push(JSON.stringify({
    type: "response_item",
    payload: {
      type: "function_call",
      name: "update_plan",
      call_id: "plan_1",
    },
  }));

  const parsed = parseSessionJsonl(lines.join("\n"), { recentToolCallLimit: 3 });

  assert.deepEqual(parsed.tools, [
    { name: "Exec", status: "completed", count: 2 },
    { name: "Plan", status: "active", count: 1 },
  ]);
});

test("findLatestSessionFile returns newest jsonl recursively", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-sessions-"));
  const olderDir = path.join(dir, "2026", "05", "22");
  const newerDir = path.join(dir, "2026", "05", "23");
  await mkdir(olderDir, { recursive: true });
  await mkdir(newerDir, { recursive: true });
  const older = path.join(olderDir, "older.jsonl");
  const newer = path.join(newerDir, "newer.jsonl");
  await writeFile(older, "{}\n", "utf8");
  await writeFile(newer, "{}\n", "utf8");

  try {
    const latest = await findLatestSessionFile(path.join(dir));
    assert.equal(latest, newer);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("findLatestSessionFile prefers newest session matching cwd", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-sessions-"));
  const sessionDir = path.join(dir, "2026", "05", "23");
  await mkdir(sessionDir, { recursive: true });
  const matching = path.join(sessionDir, "matching.jsonl");
  const other = path.join(sessionDir, "other.jsonl");
  await writeFile(
    matching,
    JSON.stringify({
      type: "session_meta",
      payload: { cwd: "/tmp/current-project" },
    }) + "\n",
    "utf8",
  );
  await writeFile(
    other,
    JSON.stringify({
      type: "session_meta",
      payload: { cwd: "/tmp/other-project" },
    }) + "\n",
    "utf8",
  );

  try {
    const latest = await findLatestSessionFile(dir, "/tmp/current-project");
    assert.equal(latest, matching);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
