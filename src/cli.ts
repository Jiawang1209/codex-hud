import { loadConfig } from "./config.js";
import { renderHud } from "./render.js";
import { createHudSnapshot } from "./snapshot.js";
import { createDoctorReport } from "./sources/codex.js";

export const HELP_TEXT = `codex-hud

Usage:
  codex-hud status    Print one HUD snapshot
  codex-hud watch     Refresh HUD snapshots until interrupted
  codex-hud doctor    Check Codex HUD runtime readiness
  codex-hud config    Print effective configuration

Options:
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

  if (command === "config") {
    const config = await loadConfig();
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
    return 0;
  }

  if (command === "watch") {
    const config = await loadConfig();
    await runWatch(config);
    return 0;
  }

  process.stderr.write(`codex-hud: unknown command '${command}'\n`);
  return 1;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function terminalRenderOptions(): { color: boolean; terminalWidth?: number } {
  return {
    color: process.stdout.isTTY && !process.env.NO_COLOR,
    terminalWidth: process.stdout.columns,
  };
}
