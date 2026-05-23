import { loadConfig, writeDefaultConfig } from "./config.js";
import { installCodexStatusLine } from "./codex-statusline.js";
import { renderHud } from "./render.js";
import { createHudSnapshot } from "./snapshot.js";
import { createDoctorReport } from "./sources/codex.js";
import { parseRunArgs, runCodexHudSession } from "./tmux-runner.js";
import {
  installCodexShim,
  parseNativeArgs,
  parseShimArgs,
  removeCodexShim,
  runNativeCodex,
} from "./native-runner.js";
import { installProduct, parseInstallArgs } from "./installer.js";

export const HELP_TEXT = `codex-hud

Usage:
  codex-hud status    Print one HUD snapshot
  codex-hud watch     Refresh HUD snapshots until interrupted
  codex-hud pane      Refresh HUD snapshots for a small tmux pane
  codex-hud run       Run Codex with a live HUD pane
  codex-hud install   Prepare native Codex HUD integration
  codex-hud native    Run patched Codex with codex-hud in the native footer
  codex-hud install-shim [--bin-dir <dir>] [--codex <path>]
  codex-hud uninstall-shim [--bin-dir <dir>]
  codex-hud setup     Configure Codex CLI's native in-window status line
  codex-hud doctor    Check Codex HUD runtime readiness
  codex-hud config    Print effective configuration
  codex-hud config init [--path <file>]
  codex-hud install-statusline [--config <file>]

Options:
  --terminal <tmux|iterm|terminal>
                     Launcher for codex-hud run (default: tmux)
  --height <rows>    HUD pane height for tmux mode
  --session <name>   tmux session name for tmux mode
  --codex <path>     Patched Codex binary for native/shim mode
  --bin-dir <dir>    Directory where install-shim writes the codex wrapper
  --codex-source <dir>
                     OpenAI Codex checkout used by codex-hud install
  --dry-run          Print launcher commands without running them
  -h, --help          Show this help
`;

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const command = argv[0] ?? "status";

  if (command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  if (command === "status") {
    const config = await loadConfig();
    const snapshot = await createHudSnapshot({ config });
    process.stdout.write(`${renderHud({ config, options: terminalRenderOptions(), snapshot })}\n`);
    return 0;
  }

  if (command === "doctor") {
    const report = await createDoctorReport();
    process.stdout.write(`${report.lines.join("\n")}\n`);
    return report.ok ? 0 : 1;
  }

  if (command === "setup" || command === "install-statusline") {
    return await runInstallStatusLine(argv.slice(1));
  }

  if (command === "config") {
    if (argv[1] === "init") {
      return await runConfigInit(argv.slice(2));
    }
    const config = await loadConfig();
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
    return 0;
  }

  if (command === "watch") {
    const config = await loadConfig();
    await runWatch(config);
    return 0;
  }

  if (command === "pane") {
    const config = await loadConfig();
    await runPane(config);
    return 0;
  }

  if (command === "run") {
    return await runCodexHudSession(parseRunArgs(argv.slice(1)));
  }

  if (command === "install") {
    return await installProduct(parseInstallArgs(argv.slice(1)));
  }

  if (command === "native") {
    return await runNativeCodex(parseNativeArgs(argv.slice(1)));
  }

  if (command === "install-shim") {
    return await runInstallShim(argv.slice(1));
  }

  if (command === "uninstall-shim") {
    return await runUninstallShim(argv.slice(1));
  }

  process.stderr.write(`codex-hud: unknown command '${command}'\n`);
  return 1;
}

async function runInstallShim(args: string[]): Promise<number> {
  try {
    const result = await installCodexShim(parseShimArgs(args));
    const action = result.changed ? "installed" : "already installed";
    process.stdout.write(`codex-hud: codex shim ${action} at ${result.path}\n`);
    process.stdout.write("codex-hud: ensure this directory appears before the official codex binary in PATH.\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to install codex shim";
    process.stderr.write(`codex-hud: ${message}\n`);
    return 1;
  }
}

async function runUninstallShim(args: string[]): Promise<number> {
  const result = await removeCodexShim(parseShimArgs(args));
  const action = result.removed ? "removed" : "not installed";
  process.stdout.write(`codex-hud: codex shim ${action} at ${result.path}\n`);
  return 0;
}

async function runInstallStatusLine(args: string[]): Promise<number> {
  const configPath = parseConfigArg(args);
  try {
    const result = await installCodexStatusLine(configPath);
    const action = result.changed ? "configured" : "already configured";
    process.stdout.write(`codex-hud: Codex status line ${action} at ${result.configPath}\n`);
    process.stdout.write(`codex-hud: restart Codex CLI, then use /statusline to inspect or reorder items.\n`);
    return 0;
  } catch {
    process.stderr.write("codex-hud: failed to configure Codex status line\n");
    return 1;
  }
}

async function runConfigInit(args: string[]): Promise<number> {
  const configPath = parsePathArg(args);
  try {
    const writtenPath = await writeDefaultConfig(configPath);
    process.stdout.write(`codex-hud: created ${writtenPath}\n`);
    return 0;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "EEXIST") {
      process.stderr.write(`codex-hud: config already exists${configPath ? ` at ${configPath}` : ""}\n`);
      return 1;
    }
    process.stderr.write(`codex-hud: failed to create config\n`);
    return 1;
  }
}

function parsePathArg(args: string[]): string | undefined {
  const index = args.indexOf("--path");
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseConfigArg(args: string[]): string | undefined {
  const index = args.indexOf("--config");
  if (index === -1) return undefined;
  return args[index + 1];
}

async function runWatch(config: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  let stopped = false;
  const stop = (): void => {
    stopped = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    while (!stopped) {
      const snapshot = await createHudSnapshot({ config });
      process.stdout.write("\x1Bc");
      process.stdout.write(`${renderHud({ config, options: terminalRenderOptions(), snapshot })}\n`);
      await sleep(config.refreshIntervalMs);
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

async function runPane(config: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  let stopped = false;
  const stop = (): void => {
    stopped = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    while (!stopped) {
      const snapshot = await createHudSnapshot({ config });
      process.stdout.write("\x1b[2J\x1b[H");
      process.stdout.write(renderHud({ config, options: terminalRenderOptions(), snapshot }));
      await sleep(config.refreshIntervalMs);
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function terminalRenderOptions(): { color: boolean; terminalWidth?: number } {
  return {
    color: process.env.CODEX_HUD_FORCE_COLOR === "1" || (process.stdout.isTTY && !process.env.NO_COLOR),
    terminalWidth: process.stdout.columns,
  };
}
