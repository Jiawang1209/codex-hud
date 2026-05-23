import path from "node:path";
import type { HudConfig } from "./config.js";
import type { CodexInfo } from "./sources/codex.js";
import { readCodexInfo } from "./sources/codex.js";
import type { GitSnapshot, HudSnapshot } from "./types.js";
import { readGitSnapshot } from "./sources/git.js";
import { readLatestSessionSignals, type SessionSignals } from "./sources/session.js";

export interface CreateHudSnapshotOptions {
  cwd?: string;
  config: HudConfig;
  codexInfo?: Partial<CodexInfo>;
  git?: GitSnapshot;
  sessionSignals?: SessionSignals;
}

export async function createHudSnapshot(options: CreateHudSnapshotOptions): Promise<HudSnapshot> {
  const cwd = options.cwd ?? process.cwd();
  const [codexInfo, git] = await Promise.all([
    options.codexInfo ? Promise.resolve(options.codexInfo) : readCodexInfo(options.config),
    options.git ? Promise.resolve(options.git) : readGitSnapshot(cwd),
  ]);
  const sessionSignals = options.sessionSignals
    ?? await readLatestSessionSignals(codexInfo.codexHome ?? options.config.codexHome ?? "", cwd);

  return {
    model: codexInfo.model,
    reasoningEffort: codexInfo.reasoningEffort,
    cwd,
    projectName: projectName(cwd, options.config.pathLevels),
    git,
    context: sessionSignals.context,
    usage: sessionSignals.usage,
    tools: sessionSignals.tools,
    todos: sessionSignals.todos,
    warnings: [],
  };
}

function projectName(cwd: string, pathLevels: number): string {
  const normalized = path.resolve(cwd);
  const parts = normalized.split(path.sep).filter(Boolean);
  return parts.slice(-pathLevels).join("/") || path.parse(normalized).root;
}
