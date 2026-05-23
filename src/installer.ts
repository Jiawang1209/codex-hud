import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defaultShimBinDir, installCodexShim } from "./native-runner.js";
import { shellQuote } from "./tmux-runner.js";

export interface ProductInstallOptions {
  dryRun: boolean;
  codexSource?: string;
  binDir?: string;
}

export interface ProductInstallPlan {
  codexSource: string;
  codexBinary: string;
  shimPath: string;
  commands: string[][];
}

export function parseInstallArgs(args: string[]): ProductInstallOptions {
  let dryRun = false;
  let codexSource: string | undefined;
  let binDir: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--codex-source" && args[index + 1]) {
      codexSource = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--bin-dir" && args[index + 1]) {
      binDir = args[index + 1];
      index += 1;
    }
  }

  return { dryRun, codexSource, binDir };
}

export function defaultCodexSource(): string {
  return path.join(os.homedir(), ".codex-hud", "native", "openai-codex");
}

export function buildInstallPlan(options: ProductInstallOptions): ProductInstallPlan {
  const codexSource = options.codexSource ?? defaultCodexSource();
  const codexBinary = path.join(codexSource, "codex-rs", "target", "debug", "codex");
  const binDir = options.binDir ?? defaultShimBinDir();

  return {
    codexSource,
    codexBinary,
    shimPath: path.join(binDir, "codex"),
    commands: [
      ["git", "clone", "--depth", "1", "--branch", "rust-v0.131.0", "https://github.com/openai/codex.git", codexSource],
      ["git", "apply", "patches/codex-cli-command-statusline.patch"],
      ["cargo", "build", "-p", "codex-cli"],
    ],
  };
}

export type PatchAction = "apply" | "already-applied" | "conflict";

export function patchActionFromChecks(canApply: boolean, canReverseApply: boolean): PatchAction {
  if (canApply) return "apply";
  if (canReverseApply) return "already-applied";
  return "conflict";
}

export async function installProduct(options: ProductInstallOptions): Promise<number> {
  const plan = buildInstallPlan(options);

  if (options.dryRun) {
    process.stdout.write(`${installPlanText(plan)}\n`);
    return 0;
  }

  if (!existsSync(plan.codexSource)) {
    await mkdir(path.dirname(plan.codexSource), { recursive: true });
    const code = await spawnInherited(plan.commands[0][0], plan.commands[0].slice(1), process.cwd());
    if (code !== 0) return code;
  }

  const patchCode = await applyBundledPatch(plan.codexSource);
  if (patchCode !== 0) return patchCode;

  const buildCode = await spawnInherited("cargo", ["build", "-p", "codex-cli"], path.join(plan.codexSource, "codex-rs"));
  if (buildCode !== 0) return buildCode;

  const shim = await installCodexShim({ binDir: options.binDir, codexPath: plan.codexBinary });
  const action = shim.changed ? "installed" : "already installed";
  process.stdout.write(`codex-hud: native Codex adapter ready at ${plan.codexBinary}\n`);
  process.stdout.write(`codex-hud: codex shim ${action} at ${shim.path}\n`);
  process.stdout.write("codex-hud: run `codex` to launch Codex with the native HUD.\n");
  return 0;
}

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function applyBundledPatch(codexSource: string): Promise<number> {
  const patchPath = path.join(packageRoot(), "patches", "codex-cli-command-statusline.patch");
  const canApply = (await spawnQuiet("git", ["apply", "--check", patchPath], codexSource)) === 0;
  const canReverseApply = (await spawnQuiet("git", ["apply", "--reverse", "--check", patchPath], codexSource)) === 0;
  const action = patchActionFromChecks(canApply, canReverseApply);

  if (action === "already-applied") {
    process.stdout.write("codex-hud: native Codex patch already applied\n");
    return 0;
  }
  if (action === "conflict") {
    process.stderr.write(`codex-hud: cannot apply native Codex patch in ${codexSource}\n`);
    process.stderr.write("codex-hud: try a clean Codex checkout or pass --codex-source to another directory.\n");
    return 1;
  }

  return await spawnInherited("git", ["apply", patchPath], codexSource);
}

function installPlanText(plan: ProductInstallPlan): string {
  return [
    "codex-hud install plan:",
    `  codex source: ${plan.codexSource}`,
    `  codex binary: ${plan.codexBinary}`,
    `  shim path: ${plan.shimPath}`,
    "  commands:",
    ...plan.commands.map((command) => `    ${command.map(shellQuote).join(" ")}`),
  ].join("\n");
}

function spawnInherited(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function spawnQuiet(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: "ignore" });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
