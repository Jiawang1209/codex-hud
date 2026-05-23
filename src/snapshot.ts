import path from "node:path";
import type { HudConfig } from "./config.js";
import type { CodexInfo } from "./sources/codex.js";
import { readCodexInfo } from "./sources/codex.js";
import type { GitSnapshot, HudSnapshot } from "./types.js";
import { readGitSnapshot } from "./sources/git.js";

export interface CreateHudSnapshotOptions {
  cwd?: string;
  config: HudConfig;
  codexInfo?: Partial<CodexInfo>;
  git?: GitSnapshot;
}

export async function createHudSnapshot(options: CreateHudSnapshotOptions): Promise<HudSnapshot> {
  const cwd = options.cwd ?? process.cwd();
  const [codexInfo, git] = await Promise.all([
    options.codexInfo ? Promise.resolve(options.codexInfo) : readCodexInfo(options.config),
    options.git ? Promise.resolve(options.git) : readGitSnapshot(cwd),
  ]);

  return {
    model: codexInfo.model,
    reasoningEffort: codexInfo.reasoningEffort,
    cwd,
    projectName: projectName(cwd, options.config.pathLevels),
    git,
    tools: [],
    todos: { completed: 0, total: 0 },
    warnings: [],
  };
}

function projectName(cwd: string, pathLevels: number): string {
  const normalized = path.resolve(cwd);
  const parts = normalized.split(path.sep).filter(Boolean);
  return parts.slice(-pathLevels).join("/") || path.parse(normalized).root;
}
