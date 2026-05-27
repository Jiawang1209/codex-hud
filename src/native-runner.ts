import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { shellQuote } from "./tmux-runner.js";

export interface NativeOptions {
  codexArgs: string[];
  codexPath?: string;
  dryRun: boolean;
}

export interface ShimOptions {
  binDir?: string;
  codexPath?: string;
  platform?: NodeJS.Platform;
}

export interface ShimResult {
  changed: boolean;
  path: string;
}

export interface RemoveShimResult {
  path: string;
  removed: boolean;
}

const HUD_STATUS_LINE_CONFIG = 'tui.status_line=["command: codex-hud status"]';
const WINDOWS_HUD_STATUS_LINE_CONFIG = 'tui.status_line=["command: codex-hud.cmd status"]';
const SHIM_MARKER = "codex-hud shim";

export function parseNativeArgs(args: string[]): NativeOptions {
  const separatorIndex = args.indexOf("--");
  const wrapperArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  const codexArgs = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);
  let codexPath: string | undefined;
  let dryRun = false;

  for (let index = 0; index < wrapperArgs.length; index += 1) {
    const arg = wrapperArgs[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--codex" && wrapperArgs[index + 1]) {
      codexPath = wrapperArgs[index + 1];
      index += 1;
    }
  }

  return { codexArgs, codexPath, dryRun };
}

export function parseShimArgs(args: string[]): ShimOptions {
  let binDir: string | undefined;
  let codexPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bin-dir" && args[index + 1]) {
      binDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--codex" && args[index + 1]) {
      codexPath = args[index + 1];
      index += 1;
    }
  }

  return { binDir, codexPath };
}

export function buildNativeCodexArgs(
  codexArgs: string[],
  options: Pick<ShimOptions, "platform"> = {},
): string[] {
  const statusLineConfig = isWindows(options.platform) ? WINDOWS_HUD_STATUS_LINE_CONFIG : HUD_STATUS_LINE_CONFIG;
  return ["-c", statusLineConfig, ...codexArgs];
}

export function resolveNativeCodexPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  if (process.env.CODEX_HUD_CODEX_PATH) return process.env.CODEX_HUD_CODEX_PATH;
  return path.join(
    os.homedir(),
    "Desktop",
    "Github_repos",
    "openai-codex",
    "codex-rs",
    "target",
    "debug",
    "codex",
  );
}

export async function runNativeCodex(options: NativeOptions): Promise<number> {
  const codexPath = resolveNativeCodexPath(options.codexPath);
  const args = buildNativeCodexArgs(options.codexArgs);

  if (options.dryRun) {
    process.stdout.write(`${[codexPath, ...args].map(shellQuote).join(" ")}\n`);
    return 0;
  }

  return await spawnInherited(codexPath, args, {
    ...process.env,
    CODEX_HUD_FORCE_COLOR: "1",
  });
}

export function defaultShimBinDir(): string {
  return path.join(os.homedir(), ".local", "bin");
}

export function buildShimScript(options: { codexPath: string; platform?: NodeJS.Platform }): string {
  if (isWindows(options.platform)) {
    return [
      "@echo off",
      `REM ${SHIM_MARKER}`,
      `codex-hud.cmd native --codex ${quoteCmdArg(options.codexPath)} -- %*`,
      "",
    ].join("\r\n");
  }

  return [
    "#!/bin/sh",
    `# ${SHIM_MARKER}`,
    `exec codex-hud native --codex ${shellQuote(options.codexPath)} -- "$@"`,
    "",
  ].join("\n");
}

export async function installCodexShim(options: ShimOptions = {}): Promise<ShimResult> {
  const binDir = options.binDir ?? defaultShimBinDir();
  const shimPath = path.join(binDir, isWindows(options.platform) ? "codex.cmd" : "codex");
  const codexPath = resolveNativeCodexPath(options.codexPath);
  const script = buildShimScript({ codexPath, platform: options.platform });

  await mkdir(binDir, { recursive: true });
  const existing = await readOptionalFile(shimPath);
  if (existing !== undefined) {
    if (!existing.includes(SHIM_MARKER)) {
      throw new Error(`codex already exists at ${shimPath}`);
    }
    if (existing === script) {
      return { changed: false, path: shimPath };
    }
  }

  await writeFile(shimPath, script, "utf8");
  await chmod(shimPath, 0o755);
  return { changed: true, path: shimPath };
}

export async function removeCodexShim(options: Pick<ShimOptions, "binDir" | "platform"> = {}): Promise<RemoveShimResult> {
  const binDir = options.binDir ?? defaultShimBinDir();
  const shimPath = path.join(binDir, isWindows(options.platform) ? "codex.cmd" : "codex");
  const existing = await readOptionalFile(shimPath);
  if (existing === undefined || !existing.includes(SHIM_MARKER)) {
    return { path: shimPath, removed: false };
  }

  await rm(shimPath, { force: true });
  return { path: shimPath, removed: true };
}

function isWindows(platform: NodeJS.Platform | undefined): boolean {
  return (platform ?? process.platform) === "win32";
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function spawnInherited(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
