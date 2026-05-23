import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  buildNativeCodexArgs,
  buildShimScript,
  installCodexShim,
  parseNativeArgs,
  removeCodexShim,
} from "../dist/native-runner.js";

test("parseNativeArgs forwards Codex args after --", () => {
  const parsed = parseNativeArgs([
    "--codex",
    "/tmp/patched-codex",
    "--dry-run",
    "--",
    "--model",
    "gpt-5.5",
  ]);

  assert.equal(parsed.codexPath, "/tmp/patched-codex");
  assert.equal(parsed.dryRun, true);
  assert.deepEqual(parsed.codexArgs, ["--model", "gpt-5.5"]);
});

test("buildNativeCodexArgs injects command-backed HUD status line", () => {
  assert.deepEqual(buildNativeCodexArgs(["--model", "gpt-5.5"]), [
    "-c",
    'tui.status_line=["command: codex-hud status"]',
    "--model",
    "gpt-5.5",
  ]);
});

test("buildShimScript delegates codex to codex-hud native", () => {
  const script = buildShimScript({ codexPath: "/tmp/patched codex" });

  assert.match(script, /^#!\/bin\/sh/);
  assert.match(script, /codex-hud native --codex '\/tmp\/patched codex' -- "\$@"/);
});

test("installCodexShim writes a reversible codex shim", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-shim-"));

  try {
    const result = await installCodexShim({ binDir: dir, codexPath: "/tmp/patched-codex" });

    assert.equal(result.changed, true);
    assert.equal(result.path, path.join(dir, "codex"));
    const script = await readFile(result.path, "utf8");
    assert.match(script, /codex-hud shim/);
    assert.match(script, /--codex \/tmp\/patched-codex/);

    const second = await installCodexShim({ binDir: dir, codexPath: "/tmp/patched-codex" });
    assert.equal(second.changed, false);

    const removed = await removeCodexShim({ binDir: dir });
    assert.equal(removed.removed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("installCodexShim refuses to overwrite a non-codex-hud codex binary", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "codex-hud-shim-"));

  try {
    await writeFile(path.join(dir, "codex"), "#!/bin/sh\necho official codex\n", "utf8");

    await assert.rejects(
      installCodexShim({ binDir: dir, codexPath: "/tmp/patched-codex" }),
      /already exists/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
