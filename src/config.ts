import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type HudLayout = "compact" | "expanded";
export type HudLanguage = "en" | "zh";
export type HudElement =
  | "model"
  | "project"
  | "tools"
  | "context"
  | "usage"
  | "weekly"
  | "memory"
  | "environment"
  | "agents"
  | "todos"
  | "sessionTime";
export type HudColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "dim"
  | `#${string}`;

export interface HudConfig {
  layout: HudLayout;
  lineLayout: HudLayout;
  language: HudLanguage;
  refreshIntervalMs: number;
  pathLevels: 1 | 2 | 3;
  codexHome?: string;
  elementOrder: HudElement[];
  gitStatus: {
    enabled: boolean;
    showDirty: boolean;
    showAheadBehind: boolean;
    showFileStats: boolean;
  };
  display: {
    showModel: boolean;
    showProject: boolean;
    showGit: boolean;
    showContext: boolean;
    showUsage: boolean;
    showWeekly: boolean;
    showTools: boolean;
    showAgents: boolean;
    showTodos: boolean;
    showConfigCounts: boolean;
    showDuration: boolean;
    showMemoryUsage: boolean;
    showSession: boolean;
  };
  colors: {
    barFilled: string;
    barEmpty: string;
    context: HudColor;
    usage: HudColor;
    weekly: HudColor;
    warning: HudColor;
    usageWarning: HudColor;
    critical: HudColor;
    model: HudColor;
    project: HudColor;
    git: HudColor;
    gitBranch: HudColor;
    tools: HudColor;
    todos: HudColor;
    label: HudColor;
    barGood: HudColor;
    barWarning: HudColor;
    barCritical: HudColor;
    custom: HudColor;
  };
}

export const DEFAULT_CONFIG: HudConfig = {
  layout: "expanded",
  lineLayout: "expanded",
  language: "en",
  refreshIntervalMs: 1000,
  pathLevels: 1,
  elementOrder: ["model", "project", "context", "usage", "weekly", "todos", "tools"],
  gitStatus: {
    enabled: true,
    showDirty: true,
    showAheadBehind: true,
    showFileStats: false,
  },
  display: {
    showModel: true,
    showProject: true,
    showGit: true,
    showContext: true,
    showUsage: true,
    showWeekly: true,
    showTools: true,
    showAgents: true,
    showTodos: true,
    showConfigCounts: true,
    showDuration: true,
    showMemoryUsage: true,
    showSession: true,
  },
  colors: {
    barFilled: "█",
    barEmpty: "░",
    context: "yellow",
    usage: "magenta",
    weekly: "magenta",
    warning: "yellow",
    usageWarning: "magenta",
    critical: "red",
    model: "magenta",
    project: "cyan",
    git: "magenta",
    gitBranch: "cyan",
    tools: "cyan",
    todos: "yellow",
    label: "dim",
    barGood: "green",
    barWarning: "yellow",
    barCritical: "red",
    custom: "#FF6600",
  },
};

type JsonObject = Record<string, unknown>;

export function resolveConfigPath(explicitPath?: string, homeDir: string = os.homedir()): string {
  return explicitPath ?? path.join(homeDir, ".codex-hud", "config.json");
}

export async function loadConfig(configPath?: string): Promise<HudConfig> {
  const resolvedPath = resolveConfigPath(configPath);

  try {
    const raw = await readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return mergeConfig(isObject(parsed) ? parsed : {});
  } catch {
    return mergeConfig({});
  }
}

export async function writeDefaultConfig(configPath?: string): Promise<string> {
  const resolvedPath = resolveConfigPath(configPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return resolvedPath;
}

export function mergeConfig(input: JsonObject): HudConfig {
  const displayInput = isObject(input.display) ? input.display : {};
  const colorsInput = isObject(input.colors) ? input.colors : {};

  return {
    layout: validLayout(input.lineLayout) ? input.lineLayout : validLayout(input.layout) ? input.layout : DEFAULT_CONFIG.layout,
    lineLayout: validLayout(input.lineLayout) ? input.lineLayout : validLayout(input.layout) ? input.layout : DEFAULT_CONFIG.lineLayout,
    language: input.language === "zh" || input.language === "en" ? input.language : DEFAULT_CONFIG.language,
    refreshIntervalMs: validInterval(input.refreshIntervalMs)
      ? input.refreshIntervalMs
      : DEFAULT_CONFIG.refreshIntervalMs,
    pathLevels: validPathLevels(input.pathLevels)
      ? input.pathLevels
      : DEFAULT_CONFIG.pathLevels,
    codexHome: typeof input.codexHome === "string" && input.codexHome.trim().length > 0
      ? input.codexHome
      : undefined,
    elementOrder: validElementOrder(input.elementOrder) ? input.elementOrder : DEFAULT_CONFIG.elementOrder,
    gitStatus: {
      enabled: boolOrDefault((isObject(input.gitStatus) ? input.gitStatus : {}).enabled, DEFAULT_CONFIG.gitStatus.enabled),
      showDirty: boolOrDefault((isObject(input.gitStatus) ? input.gitStatus : {}).showDirty, DEFAULT_CONFIG.gitStatus.showDirty),
      showAheadBehind: boolOrDefault((isObject(input.gitStatus) ? input.gitStatus : {}).showAheadBehind, DEFAULT_CONFIG.gitStatus.showAheadBehind),
      showFileStats: boolOrDefault((isObject(input.gitStatus) ? input.gitStatus : {}).showFileStats, DEFAULT_CONFIG.gitStatus.showFileStats),
    },
    display: {
      showModel: boolOrDefault(displayInput.showModel ?? displayInput.model, DEFAULT_CONFIG.display.showModel),
      showProject: boolOrDefault(displayInput.showProject, DEFAULT_CONFIG.display.showProject),
      showGit: boolOrDefault(displayInput.showGit ?? displayInput.git, DEFAULT_CONFIG.display.showGit),
      showContext: boolOrDefault(displayInput.showContext ?? displayInput.context, DEFAULT_CONFIG.display.showContext),
      showUsage: boolOrDefault(displayInput.showUsage ?? displayInput.usage, DEFAULT_CONFIG.display.showUsage),
      showWeekly: boolOrDefault(displayInput.showWeekly, DEFAULT_CONFIG.display.showWeekly),
      showTools: boolOrDefault(displayInput.showTools ?? displayInput.tools, DEFAULT_CONFIG.display.showTools),
      showAgents: boolOrDefault(displayInput.showAgents, DEFAULT_CONFIG.display.showAgents),
      showTodos: boolOrDefault(displayInput.showTodos ?? displayInput.todos, DEFAULT_CONFIG.display.showTodos),
      showConfigCounts: boolOrDefault(displayInput.showConfigCounts, DEFAULT_CONFIG.display.showConfigCounts),
      showDuration: boolOrDefault(displayInput.showDuration, DEFAULT_CONFIG.display.showDuration),
      showMemoryUsage: boolOrDefault(displayInput.showMemoryUsage, DEFAULT_CONFIG.display.showMemoryUsage),
      showSession: boolOrDefault(displayInput.showSession ?? displayInput.session, DEFAULT_CONFIG.display.showSession),
    },
    colors: {
      barFilled: validBarChar(colorsInput.barFilled)
        ? colorsInput.barFilled
        : DEFAULT_CONFIG.colors.barFilled,
      barEmpty: validBarChar(colorsInput.barEmpty)
        ? colorsInput.barEmpty
        : DEFAULT_CONFIG.colors.barEmpty,
      context: colorOrDefault(colorsInput.context, DEFAULT_CONFIG.colors.context),
      usage: colorOrDefault(colorsInput.usage, DEFAULT_CONFIG.colors.usage),
      weekly: colorOrDefault(colorsInput.weekly, DEFAULT_CONFIG.colors.weekly),
      warning: colorOrDefault(colorsInput.warning, DEFAULT_CONFIG.colors.warning),
      usageWarning: colorOrDefault(colorsInput.usageWarning, DEFAULT_CONFIG.colors.usageWarning),
      critical: colorOrDefault(colorsInput.critical, DEFAULT_CONFIG.colors.critical),
      model: colorOrDefault(colorsInput.model, DEFAULT_CONFIG.colors.model),
      project: colorOrDefault(colorsInput.project, DEFAULT_CONFIG.colors.project),
      git: colorOrDefault(colorsInput.git, DEFAULT_CONFIG.colors.git),
      gitBranch: colorOrDefault(colorsInput.gitBranch, DEFAULT_CONFIG.colors.gitBranch),
      tools: colorOrDefault(colorsInput.tools, DEFAULT_CONFIG.colors.tools),
      todos: colorOrDefault(colorsInput.todos, DEFAULT_CONFIG.colors.todos),
      label: colorOrDefault(colorsInput.label, DEFAULT_CONFIG.colors.label),
      barGood: colorOrDefault(colorsInput.barGood, DEFAULT_CONFIG.colors.barGood),
      barWarning: colorOrDefault(colorsInput.barWarning, DEFAULT_CONFIG.colors.barWarning),
      barCritical: colorOrDefault(colorsInput.barCritical, DEFAULT_CONFIG.colors.barCritical),
      custom: colorOrDefault(colorsInput.custom, DEFAULT_CONFIG.colors.custom),
    },
  };
}

function validLayout(value: unknown): value is HudLayout {
  return value === "expanded" || value === "compact";
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function validInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 60000;
}

function validPathLevels(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

function validBarChar(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 4;
}

const VALID_ELEMENTS = new Set<HudElement>([
  "model",
  "project",
  "tools",
  "context",
  "usage",
  "weekly",
  "memory",
  "environment",
  "agents",
  "todos",
  "sessionTime",
]);

function validElementOrder(value: unknown): value is HudElement[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && VALID_ELEMENTS.has(item as HudElement));
}

function colorOrDefault(value: unknown, fallback: HudColor): HudColor {
  if (typeof value !== "string") return fallback;
  if (isNamedColor(value) || /^#[0-9A-Fa-f]{6}$/.test(value)) return value as HudColor;
  return fallback;
}

function isNamedColor(value: string): value is Exclude<HudColor, `#${string}`> {
  return [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "gray",
    "dim",
  ].includes(value);
}
