import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const CODEX_HUD_STATUS_LINE_ITEMS = [
  "model-with-reasoning",
  "task-progress",
  "current-dir",
  "git-branch",
  "context-used",
  "five-hour-limit",
  "weekly-limit",
  "fast-mode",
] as const;

export interface CodexStatusLineInstallResult {
  configPath: string;
  changed: boolean;
  items: readonly string[];
}

export function resolveCodexConfigPath(explicitPath?: string, homeDir: string = os.homedir()): string {
  return explicitPath ?? path.join(homeDir, ".codex", "config.toml");
}

export async function installCodexStatusLine(configPath?: string): Promise<CodexStatusLineInstallResult> {
  const resolvedPath = resolveCodexConfigPath(configPath);
  const existing = await readOptionalText(resolvedPath);
  const next = buildCodexStatusLineToml(existing);

  if (next !== existing) {
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, next, "utf8");
  }

  return {
    configPath: resolvedPath,
    changed: next !== existing,
    items: CODEX_HUD_STATUS_LINE_ITEMS,
  };
}

export function buildCodexStatusLineToml(input: string): string {
  const normalized = input.length > 0 && !input.endsWith("\n") ? `${input}\n` : input;
  const lines = normalized.split("\n");
  const tuiRange = findTableRange(lines, "tui");
  const statusLineToml = formatStatusLine();

  if (!tuiRange) {
    const prefix = normalized.trimEnd();
    return `${prefix}${prefix ? "\n\n" : ""}[tui]\n${statusLineToml}\n`;
  }

  const existingRange = findKeyRange(lines, tuiRange.start + 1, tuiRange.end, "status_line");
  if (existingRange) {
    const nextLines = [
      ...lines.slice(0, existingRange.start),
      ...statusLineToml.split("\n"),
      ...lines.slice(existingRange.end),
    ];
    return joinTomlLines(nextLines);
  }

  const nextLines = [
    ...lines.slice(0, tuiRange.start + 1),
    ...statusLineToml.split("\n"),
    ...lines.slice(tuiRange.start + 1),
  ];
  return joinTomlLines(nextLines);
}

function formatStatusLine(): string {
  const items = CODEX_HUD_STATUS_LINE_ITEMS.map((item) => `  "${item}",`).join("\n");
  return `status_line = [\n${items}\n]`;
}

function findTableRange(lines: string[], tableName: string): { start: number; end: number } | undefined {
  const header = `[${tableName}]`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return undefined;

  const nextTable = lines.findIndex((line, index) => index > start && /^\s*\[[^\]]+\]\s*$/.test(line));
  return {
    start,
    end: nextTable === -1 ? lines.length : nextTable,
  };
}

function findKeyRange(
  lines: string[],
  start: number,
  end: number,
  key: string,
): { start: number; end: number } | undefined {
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const keyStart = lines.findIndex((line, index) => index >= start && index < end && keyPattern.test(line));
  if (keyStart === -1) return undefined;

  if (!lines[keyStart].includes("[") || lines[keyStart].includes("]")) {
    return { start: keyStart, end: keyStart + 1 };
  }

  const keyEnd = lines.findIndex((line, index) => index > keyStart && index < end && /^\s*\]/.test(line));
  return { start: keyStart, end: keyEnd === -1 ? end : keyEnd + 1 };
}

function joinTomlLines(lines: string[]): string {
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

async function readOptionalText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
