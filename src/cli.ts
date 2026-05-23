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

  process.stdout.write("codex-hud: status command is not implemented yet\n");
  return 0;
}
