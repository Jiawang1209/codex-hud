import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  CODEX_HUD_STATUS_LINE_ITEMS,
  buildCodexStatusLineToml,
  installCodexStatusLine,
} from "../dist/codex-statusline.js";

test("buildCodexStatusLineToml creates a tui table when config is empty", () => {
  const output = buildCodexStatusLineToml("");

  assert.match(output, /\[tui\]/);
  assert.match(output, /status_line = \[/);
  assert.match(output, /"model-with-reasoning"/);
  assert.match(output, /"git-branch"/);
  assert.match(output, /"weekly-limit"/);
});

test("buildCodexStatusLineToml replaces an existing multiline status_line", () => {
  const output = buildCodexStatusLineToml(`model = "gpt-5.5"

[tui]
status_line = [
  "model-with-reasoning",
]

[features]
goals = true
`);

  assert.equal((output.match(/status_line = \[/g) ?? []).length, 1);
  assert.match(output, /"context-used"/);
  assert.match(output, /\[features\]\ngoals = true/);
});

test("installCodexStatusLine writes Codex config and reports changed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-statusline-"));
  const configPath = path.join(dir, "config.toml");
  await writeFile(configPath, "model = \"gpt-5.5\"\n", "utf8");

  try {
    const result = await installCodexStatusLine(configPath);
    const written = await readFile(configPath, "utf8");

    assert.equal(result.changed, true);
    assert.deepEqual(result.items, CODEX_HUD_STATUS_LINE_ITEMS);
    assert.match(written, /\[tui\]/);
    assert.match(written, /"five-hour-limit"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("installCodexStatusLine is idempotent", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-statusline-"));
  const configPath = path.join(dir, "config.toml");

  try {
    await installCodexStatusLine(configPath);
    const result = await installCodexStatusLine(configPath);

    assert.equal(result.changed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
