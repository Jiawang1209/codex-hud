import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ProgressSnapshot, TodoSnapshot, ToolActivity } from "../types.js";

export interface SessionSignals {
  context?: ProgressSnapshot;
  usage?: ProgressSnapshot;
  tools: ToolActivity[];
  todos: TodoSnapshot;
}

export interface ParseSessionOptions {
  recentToolCallLimit?: number;
}

const DEFAULT_RECENT_TOOL_CALL_LIMIT = 12;

interface RolloutLine {
  type?: string;
  payload?: {
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    info?: {
      total_token_usage?: {
        total_tokens?: number;
      };
      model_context_window?: number;
    };
    rate_limits?: {
      primary?: {
        used_percent?: number;
        window_minutes?: number;
      } | null;
      secondary?: {
        used_percent?: number;
        window_minutes?: number;
      } | null;
    };
  };
}

interface ToolState {
  name: string;
  status: ToolActivity["status"];
  lastIndex: number;
}

export async function readLatestSessionSignals(codexHome: string, cwd?: string): Promise<SessionSignals> {
  const sessionsDir = path.join(codexHome, "sessions");
  const latest = await findLatestSessionFile(sessionsDir, cwd);
  if (!latest) return emptySignals();

  try {
    return parseSessionJsonl(await readFile(latest, "utf8"));
  } catch {
    return emptySignals();
  }
}

export function parseSessionJsonl(text: string, options: ParseSessionOptions = {}): SessionSignals {
  const toolsByCall = new Map<string, ToolState>();
  let context: ProgressSnapshot | undefined;
  let usage: ProgressSnapshot | undefined;
  let todos: TodoSnapshot = { completed: 0, total: 0 };
  let lineIndex = 0;

  for (const line of text.split(/\r?\n/)) {
    lineIndex += 1;
    if (!line.trim()) continue;

    let entry: RolloutLine;
    try {
      entry = JSON.parse(line) as RolloutLine;
    } catch {
      continue;
    }

    const payload = entry.payload;
    if (!payload) continue;

    if (payload.type === "function_call" && payload.call_id && payload.name) {
      toolsByCall.set(payload.call_id, {
        name: displayToolName(payload.name),
        status: "active",
        lastIndex: lineIndex,
      });
      if (payload.name === "update_plan") {
        todos = parseUpdatePlanTodos(payload.arguments) ?? todos;
      }
      continue;
    }

    if (isCompletionPayload(payload.type) && payload.call_id) {
      const tool = toolsByCall.get(payload.call_id);
      if (tool) {
        tool.status = payload.type === "patch_apply_end" ? "completed" : "completed";
        tool.lastIndex = lineIndex;
      }
      continue;
    }

    if (payload.type === "token_count") {
      const totalTokens = payload.info?.total_token_usage?.total_tokens;
      const contextWindow = payload.info?.model_context_window;
      if (validPositiveNumber(totalTokens) && validPositiveNumber(contextWindow)) {
        context = {
          label: "Context",
          percent: Math.round((totalTokens / contextWindow) * 100),
        };
      }

      const primary = payload.rate_limits?.primary;
      if (validPercent(primary?.used_percent)) {
        usage = {
          label: formatRateLimitWindow(primary?.window_minutes),
          percent: primary.used_percent,
        };
      }
    }
  }

  return {
    context,
    usage,
    tools: summarizeTools(toolsByCall, normalizeRecentLimit(options.recentToolCallLimit)),
    todos,
  };
}

export async function findLatestSessionFile(sessionsDir: string, cwd?: string): Promise<string | undefined> {
  const files = await listJsonlFiles(sessionsDir);
  if (files.length === 0) return undefined;

  const targetCwd = cwd ? normalizePath(cwd) : undefined;
  let latest: { file: string; mtimeMs: number } | undefined;
  let latestMatching: { file: string; mtimeMs: number } | undefined;
  for (const file of files) {
    try {
      const info = await stat(file);
      if (!latest || info.mtimeMs > latest.mtimeMs || (info.mtimeMs === latest.mtimeMs && file > latest.file)) {
        latest = { file, mtimeMs: info.mtimeMs };
      }
      if (targetCwd && await sessionFileMatchesCwd(file, targetCwd)) {
        if (
          !latestMatching
          || info.mtimeMs > latestMatching.mtimeMs
          || (info.mtimeMs === latestMatching.mtimeMs && file > latestMatching.file)
        ) {
          latestMatching = { file, mtimeMs: info.mtimeMs };
        }
      }
    } catch {
      continue;
    }
  }
  return latestMatching?.file ?? latest?.file;
}

function emptySignals(): SessionSignals {
  return {
    tools: [],
    todos: { completed: 0, total: 0 },
  };
}

async function listJsonlFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
  return files;
}

function isCompletionPayload(type: string | undefined): boolean {
  return type === "function_call_output"
    || type === "custom_tool_call_output"
    || type === "mcp_tool_call_end"
    || type === "patch_apply_end";
}

function summarizeTools(toolsByCall: Map<string, ToolState>, recentToolCallLimit: number): ToolActivity[] {
  const byName = new Map<string, { active: number; completed: number; lastIndex: number }>();
  const recentTools = Array.from(toolsByCall.values())
    .sort((a, b) => b.lastIndex - a.lastIndex)
    .slice(0, recentToolCallLimit);

  for (const tool of recentTools) {
    const current = byName.get(tool.name) ?? { active: 0, completed: 0, lastIndex: 0 };
    if (tool.status === "active") current.active += 1;
    else current.completed += 1;
    current.lastIndex = Math.max(current.lastIndex, tool.lastIndex);
    byName.set(tool.name, current);
  }

  return Array.from(byName.entries())
    .sort((a, b) => b[1].lastIndex - a[1].lastIndex)
    .slice(0, 4)
    .reverse()
    .map(([name, counts]) => ({
      name,
      status: counts.active > 0 ? "active" : "completed",
      count: counts.active + counts.completed,
    }));
}

function normalizeRecentLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_RECENT_TOOL_CALL_LIMIT;
  }
  return Math.min(value, 100);
}

function parseUpdatePlanTodos(argumentsJson: string | undefined): TodoSnapshot | undefined {
  if (!argumentsJson) return undefined;

  try {
    const parsed = JSON.parse(argumentsJson) as { plan?: Array<{ step?: unknown; status?: unknown }> };
    if (!Array.isArray(parsed.plan)) return undefined;
    const total = parsed.plan.length;
    const completed = parsed.plan.filter((item) => item.status === "completed").length;
    const current = parsed.plan.find((item) => item.status === "in_progress")?.step;
    return {
      completed,
      total,
      current: typeof current === "string" ? current : undefined,
    };
  } catch {
    return undefined;
  }
}

function displayToolName(name: string): string {
  const normalized = name.split(".").pop() ?? name;
  const known: Record<string, string> = {
    exec_command: "Exec",
    write_stdin: "Stdin",
    update_plan: "Plan",
    apply_patch: "Patch",
    view_image: "Image",
    js: "Node",
  };
  if (known[normalized]) return known[normalized];
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, "");
}

function formatRateLimitWindow(windowMinutes: number | undefined): string {
  if (!validPositiveNumber(windowMinutes)) return "Usage";
  if (windowMinutes % 1440 === 0) return `${windowMinutes / 1440}d`;
  if (windowMinutes % 60 === 0) return `${windowMinutes / 60}h`;
  return `${windowMinutes}m`;
}

function validPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

async function sessionFileMatchesCwd(file: string, targetCwd: string): Promise<boolean> {
  const sessionCwd = await readSessionCwd(file);
  if (!sessionCwd) return false;
  return pathsOverlap(normalizePath(sessionCwd), targetCwd);
}

async function readSessionCwd(file: string): Promise<string | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return undefined;
  }

  for (const line of text.split(/\r?\n/).slice(0, 80)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as { type?: string; payload?: { cwd?: unknown } };
      if ((entry.type === "session_meta" || entry.type === "turn_context") && typeof entry.payload?.cwd === "string") {
        return entry.payload.cwd;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function normalizePath(value: string): string {
  return path.resolve(value);
}

function pathsOverlap(sessionCwd: string, targetCwd: string): boolean {
  return sessionCwd === targetCwd || isWithin(sessionCwd, targetCwd) || isWithin(targetCwd, sessionCwd);
}

function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}
