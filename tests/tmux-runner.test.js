import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTmuxAttachArgs,
  buildTmuxNewSessionArgs,
  buildTmuxSplitArgs,
  buildITermAppleScript,
  buildMacTerminalAppleScript,
  parseRunArgs,
  shellQuote,
} from "../dist/tmux-runner.js";

test("parseRunArgs forwards Codex args after --", () => {
  const parsed = parseRunArgs([
    "--terminal",
    "iterm",
    "--session",
    "work",
    "--height",
    "5",
    "--",
    "--model",
    "gpt-5.5",
    "hello",
  ]);

  assert.equal(parsed.sessionName, "work");
  assert.equal(parsed.height, 5);
  assert.equal(parsed.dryRun, false);
  assert.equal(parsed.terminal, "iterm");
  assert.deepEqual(parsed.codexArgs, ["--model", "gpt-5.5", "hello"]);
});

test("parseRunArgs uses safe defaults", () => {
  const parsed = parseRunArgs([]);

  assert.match(parsed.sessionName, /^codex-hud-/);
  assert.equal(parsed.height, 4);
  assert.equal(parsed.terminal, "tmux");
  assert.deepEqual(parsed.codexArgs, []);
});

test("shellQuote protects spaces and quotes", () => {
  assert.equal(shellQuote("simple"), "simple");
  assert.equal(shellQuote("hello world"), "'hello world'");
  assert.equal(shellQuote("it's"), "'it'\\''s'");
});

test("tmux new-session args start Codex in the top pane", () => {
  const args = buildTmuxNewSessionArgs({
    cwd: "/tmp/my project",
    codexArgs: ["--model", "gpt-5.5"],
    sessionName: "codex-hud-test",
  });

  assert.deepEqual(args.slice(0, 6), ["new-session", "-d", "-s", "codex-hud-test", "-c", "/tmp/my project"]);
  assert.equal(args.at(-1), "codex --model gpt-5.5");
});

test("tmux split args launch the HUD pane with fixed height", () => {
  const args = buildTmuxSplitArgs({
    cwd: "/tmp/codex-hud",
    height: 4,
    sessionName: "codex-hud-test",
  });

  assert.deepEqual(args, [
    "split-window",
    "-v",
    "-l",
    "4",
    "-t",
    "codex-hud-test:0.0",
    "-c",
    "/tmp/codex-hud",
    "codex-hud pane",
  ]);
});

test("tmux attach args select the generated session", () => {
  assert.deepEqual(buildTmuxAttachArgs("codex-hud-test"), ["attach-session", "-t", "codex-hud-test"]);
});

test("iTerm AppleScript opens Codex and a HUD split pane", () => {
  const script = buildITermAppleScript({
    cwd: "/tmp/my project",
    codexArgs: ["--model", "gpt-5.5"],
    sessionName: "unused",
  });

  assert.match(script, /tell application "iTerm2"/);
  assert.match(script, /split horizontally with default profile/);
  assert.match(script, /cd '\/tmp\/my project' && codex --model gpt-5.5/);
  assert.match(script, /cd '\/tmp\/my project' && codex-hud pane/);
});

test("macOS Terminal AppleScript opens separate Codex and HUD commands", () => {
  const script = buildMacTerminalAppleScript({
    cwd: "/tmp/codex-hud",
    codexArgs: ["--sandbox", "danger-full-access"],
    sessionName: "unused",
  });

  assert.match(script, /tell application "Terminal"/);
  assert.match(script, /codex --sandbox danger-full-access/);
  assert.match(script, /codex-hud pane/);
});
