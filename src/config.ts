import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type HudLayout = "compact" | "expanded";

export interface HudConfig {
  layout: HudLayout;
  refreshIntervalMs: number;
  pathLevels: 1 | 2 | 3;
  codexHome?: string;
  display: {
    model: boolean;
    git: boolean;
    context: boolean;
    usage: boolean;
    tools: boolean;
    todos: boolean;
    session: boolean;
  };
  colors: {
    barFilled: string;
    barEmpty: string;
  };
}

export const DEFAULT_CONFIG: HudConfig = {
  layout: "compact",
  refreshIntervalMs: 1000,
  pathLevels: 1,
  display: {
    model: true,
    git: true,
    context: true,
    usage: true,
    tools: true,
    todos: true,
    session: true,
  },
  colors: {
    barFilled: "█",
    barEmpty: "░",
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

export function mergeConfig(input: JsonObject): HudConfig {
  const displayInput = isObject(input.display) ? input.display : {};
  const colorsInput = isObject(input.colors) ? input.colors : {};

  return {
    layout: input.layout === "expanded" || input.layout === "compact"
      ? input.layout
      : DEFAULT_CONFIG.layout,
    refreshIntervalMs: validInterval(input.refreshIntervalMs)
      ? input.refreshIntervalMs
      : DEFAULT_CONFIG.refreshIntervalMs,
    pathLevels: validPathLevels(input.pathLevels)
      ? input.pathLevels
      : DEFAULT_CONFIG.pathLevels,
    codexHome: typeof input.codexHome === "string" && input.codexHome.trim().length > 0
      ? input.codexHome
      : undefined,
    display: {
      model: boolOrDefault(displayInput.model, DEFAULT_CONFIG.display.model),
      git: boolOrDefault(displayInput.git, DEFAULT_CONFIG.display.git),
      context: boolOrDefault(displayInput.context, DEFAULT_CONFIG.display.context),
      usage: boolOrDefault(displayInput.usage, DEFAULT_CONFIG.display.usage),
      tools: boolOrDefault(displayInput.tools, DEFAULT_CONFIG.display.tools),
      todos: boolOrDefault(displayInput.todos, DEFAULT_CONFIG.display.todos),
      session: boolOrDefault(displayInput.session, DEFAULT_CONFIG.display.session),
    },
    colors: {
      barFilled: validBarChar(colorsInput.barFilled)
        ? colorsInput.barFilled
        : DEFAULT_CONFIG.colors.barFilled,
      barEmpty: validBarChar(colorsInput.barEmpty)
        ? colorsInput.barEmpty
        : DEFAULT_CONFIG.colors.barEmpty,
    },
  };
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
