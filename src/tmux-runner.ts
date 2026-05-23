import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

export type TerminalLauncher = "tmux" | "iterm" | "terminal";

export interface RunOptions {
  codexArgs: string[];
  dryRun: boolean;
  height: number;
  sessionName: string;
  terminal: TerminalLauncher;
}

export interface TmuxCommandOptions {
  cwd: string;
  codexArgs?: string[];
  height?: number;
  sessionName: string;
}

const DEFAULT_HEIGHT = 4;

export function parseRunArgs(args: string[]): RunOptions {
  const separatorIndex = args.indexOf("--");
  const wrapperArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  const codexArgs = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);
  let dryRun = false;
  let height = DEFAULT_HEIGHT;
  let sessionName = `codex-hud-${Date.now()}`;
  let terminal: TerminalLauncher = "tmux";

  for (let index = 0; index < wrapperArgs.length; index += 1) {
    const arg = wrapperArgs[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--height" && wrapperArgs[index + 1]) {
      height = normalizeHeight(Number(wrapperArgs[index + 1]));
      index += 1;
      continue;
    }
    if (arg === "--session" && wrapperArgs[index + 1]) {
      sessionName = sanitizeSessionName(wrapperArgs[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--terminal" && wrapperArgs[index + 1]) {
      terminal = parseTerminal(wrapperArgs[index + 1]);
      index += 1;
    }
  }

  return {
    codexArgs,
    dryRun,
    height,
    sessionName,
    terminal,
  };
}

export async function runCodexHudSession(options: RunOptions, cwd: string = process.cwd()): Promise<number> {
  if (options.dryRun) {
    process.stdout.write(`${dryRunText(options, cwd)}\n`);
    return 0;
  }

  if (options.terminal === "iterm") {
    return await runAppleScript(buildITermAppleScript({ cwd, codexArgs: options.codexArgs, sessionName: options.sessionName }));
  }

  if (options.terminal === "terminal") {
    return await runAppleScript(buildMacTerminalAppleScript({
      cwd,
      codexArgs: options.codexArgs,
      sessionName: options.sessionName,
    }));
  }

  if (!commandExists("tmux")) {
    process.stderr.write("codex-hud: tmux is required for `codex-hud run`\n");
    process.stderr.write("codex-hud: install tmux, or use `codex-hud status` and `codex` separately.\n");
    return 1;
  }

  if (process.env.TMUX) {
    await spawnInherited("tmux", buildTmuxSplitArgs({
      cwd,
      height: options.height,
      sessionName: "",
      targetPane: undefined,
    }));
    return await spawnInherited("codex", options.codexArgs);
  }

  for (const args of tmuxLaunchCommands(options, cwd)) {
    const code = await spawnInherited("tmux", args);
    if (code !== 0) return code;
  }

  return 0;
}

export function dryRunText(options: RunOptions, cwd: string): string {
  if (options.terminal === "iterm") {
    return `osascript <<'APPLESCRIPT'\n${buildITermAppleScript({
      cwd,
      codexArgs: options.codexArgs,
      sessionName: options.sessionName,
    })}\nAPPLESCRIPT`;
  }

  if (options.terminal === "terminal") {
    return `osascript <<'APPLESCRIPT'\n${buildMacTerminalAppleScript({
      cwd,
      codexArgs: options.codexArgs,
      sessionName: options.sessionName,
    })}\nAPPLESCRIPT`;
  }

  const commands = tmuxLaunchCommands(options, cwd);
  return commands.map((command) => `tmux ${command.map(shellQuote).join(" ")}`).join("\n");
}

export function tmuxLaunchCommands(options: RunOptions, cwd: string): string[][] {
  return [
    buildTmuxNewSessionArgs({ cwd, codexArgs: options.codexArgs, sessionName: options.sessionName }),
    buildTmuxSplitArgs({ cwd, height: options.height, sessionName: options.sessionName }),
    ["select-pane", "-t", `${options.sessionName}:0.0`],
    buildTmuxAttachArgs(options.sessionName),
  ];
}

export function buildTmuxNewSessionArgs(options: TmuxCommandOptions): string[] {
  return [
    "new-session",
    "-d",
    "-s",
    options.sessionName,
    "-c",
    options.cwd,
    ["codex", ...(options.codexArgs ?? [])].map(shellQuote).join(" "),
  ];
}

export function buildTmuxSplitArgs(
  options: TmuxCommandOptions & { targetPane?: string },
): string[] {
  const args = [
    "split-window",
    "-v",
    "-l",
    String(options.height ?? DEFAULT_HEIGHT),
  ];
  const target = options.targetPane ?? (options.sessionName ? `${options.sessionName}:0.0` : undefined);
  if (target) {
    args.push("-t", target);
  }
  args.push("-c", options.cwd, "codex-hud pane");
  return args;
}

export function buildTmuxAttachArgs(sessionName: string): string[] {
  return ["attach-session", "-t", sessionName];
}

export function buildITermAppleScript(options: TmuxCommandOptions): string {
  const codexCommand = shellCommand(options.cwd, ["codex", ...(options.codexArgs ?? [])]);
  const hudCommand = shellCommand(options.cwd, ["codex-hud", "pane"]);
  return [
    'tell application "iTerm2"',
    "  activate",
    "  set newWindow to (create window with default profile)",
    "  tell current session of newWindow",
    `    write text ${appleScriptString(codexCommand)}`,
    "    set hudSession to (split horizontally with default profile)",
    "  end tell",
    "  tell hudSession",
    `    write text ${appleScriptString(hudCommand)}`,
    "  end tell",
    "end tell",
  ].join("\n");
}

export function buildMacTerminalAppleScript(options: TmuxCommandOptions): string {
  const codexCommand = shellCommand(options.cwd, ["codex", ...(options.codexArgs ?? [])]);
  const hudCommand = shellCommand(options.cwd, ["codex-hud", "pane"]);
  return [
    'tell application "Terminal"',
    "  activate",
    `  do script ${appleScriptString(codexCommand)}`,
    `  do script ${appleScriptString(hudCommand)}`,
    "end tell",
  ].join("\n");
}

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["-V"], { encoding: "utf8", stdio: "ignore" });
  return result.status === 0;
}

function spawnInherited(command: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function runAppleScript(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("osascript", [], { stdio: ["pipe", "inherit", "inherit"] });
    child.stdin.end(script);
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function normalizeHeight(value: number): number {
  if (!Number.isInteger(value) || value < 3) return DEFAULT_HEIGHT;
  return Math.min(value, 12);
}

function sanitizeSessionName(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || `codex-hud-${Date.now()}`;
}

function parseTerminal(value: string): TerminalLauncher {
  if (value === "iterm" || value === "terminal" || value === "tmux") return value;
  return "tmux";
}

function shellCommand(cwd: string, command: string[]): string {
  return `cd ${shellQuote(cwd)} && ${command.map(shellQuote).join(" ")}`;
}

function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
