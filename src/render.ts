import type { HudColor, HudConfig, HudElement } from "./config.js";
import type { HudSnapshot, ProgressSnapshot, ToolActivity } from "./types.js";

export interface RenderOptions {
  color?: boolean;
  terminalWidth?: number;
}

export function renderHud({
  config,
  options = {},
  snapshot,
}: {
  config: HudConfig;
  options?: RenderOptions;
  snapshot: HudSnapshot;
}): string {
  const output = config.layout === "expanded"
    ? renderExpanded(config, snapshot, options)
    : renderCompact(config, snapshot, options);
  return truncateOutput(output, options.terminalWidth);
}

function renderCompact(config: HudConfig, snapshot: HudSnapshot, options: RenderOptions): string {
  return orderedParts(config, snapshot, options).join(" | ");
}

function renderExpanded(config: HudConfig, snapshot: HudSnapshot, options: RenderOptions): string {
  const separator = " │ ";
  const identity = orderedParts(config, snapshot, options, ["model", "project"]).join(separator);
  const progress = orderedParts(config, snapshot, options, ["context", "usage", "weekly"]).join(separator);
  const activity = orderedParts(config, snapshot, options, ["todos", "tools", "agents", "memory", "environment", "sessionTime"]).join(separator);

  return [identity, progress, activity].filter(Boolean).join("\n");
}

function orderedParts(
  config: HudConfig,
  snapshot: HudSnapshot,
  options: RenderOptions,
  allowed?: HudElement[],
): string[] {
  const allowedSet = allowed ? new Set(allowed) : undefined;
  return config.elementOrder
    .filter((element) => !allowedSet || allowedSet.has(element))
    .flatMap((element) => elementPart(element, config, snapshot, options));
}

function elementPart(
  element: HudElement,
  config: HudConfig,
  snapshot: HudSnapshot,
  options: RenderOptions,
): string[] {
  if (element === "model" && config.display.showModel && snapshot.model) {
    return [styleText(`[${[snapshot.model, snapshot.reasoningEffort].filter(Boolean).join(" ")}]`, config.colors.model, options)];
  }

  if (element === "project" && config.display.showProject) {
    let project = styleText(snapshot.projectName, config.colors.project, options);
    if (config.display.showGit && config.gitStatus.enabled && snapshot.git) {
      const dirty = config.gitStatus.showDirty && snapshot.git.isDirty ? "*" : "";
      const branch = styleText(`${snapshot.git.branch}${dirty}`, config.colors.gitBranch, options);
      let git = `git:(${branch})`;
      if (config.gitStatus.showAheadBehind && (snapshot.git.ahead > 0 || snapshot.git.behind > 0)) {
        git += ` +${snapshot.git.ahead}/-${snapshot.git.behind}`;
      }
      project += ` ${styleText(git, config.colors.git, options)}`;
    }
    return [project];
  }

  if (element === "context" && config.display.showContext && snapshot.context) {
    return [formatProgress(snapshot.context, "context", config, options)];
  }
  if (element === "usage" && config.display.showUsage && snapshot.usage) {
    return [formatProgress(snapshot.usage, "usage", config, options)];
  }
  if (element === "weekly" && config.display.showWeekly && snapshot.weekly) {
    return [formatProgress(snapshot.weekly, "weekly", config, options)];
  }
  if (element === "todos" && config.display.showTodos && snapshot.todos.total > 0) {
    return [styleText(`Todos ${snapshot.todos.completed}/${snapshot.todos.total}`, config.colors.todos, options)];
  }
  if (element === "tools" && config.display.showTools && snapshot.tools.length > 0) {
    return [styleText(snapshot.tools.map(formatTool).join(", "), config.colors.tools, options)];
  }
  return [];
}

function formatTool(tool: ToolActivity): string {
  if (tool.status === "active") {
    return `${tool.name} active`;
  }
  if (tool.count && tool.count > 1) {
    return `${tool.name} x${tool.count}`;
  }
  return tool.name;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatProgress(
  progress: ProgressSnapshot,
  kind: "context" | "usage" | "weekly",
  config: HudConfig,
  options: RenderOptions,
): string {
  const percent = clampPercent(progress.percent);
  const width = 10;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = `${config.colors.barFilled.repeat(filled)}${config.colors.barEmpty.repeat(empty)}`;
  const label = kind === "usage" && progress.windowMinutes ? "Usage" : progress.label;
  const windowText = kind === "usage" && progress.windowMinutes
    ? ` (${formatConsumedWindow(percent, progress.windowMinutes)} / ${progress.label})`
    : "";
  const labelColor = config.colors[kind];
  return `${styleText(label, labelColor, options)} ${colorizeBar(bar, percent, config, options)} ${colorizeBar(`${percent}%`, percent, config, options)}${windowText}`;
}

function formatConsumedWindow(percent: number, windowMinutes: number): string {
  return formatDurationMinutes(Math.round((percent / 100) * windowMinutes));
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function colorizeBar(value: string, percent: number, config: HudConfig, options: RenderOptions): string {
  if (!options.color) return value;
  const color = percent >= 85
    ? config.colors.barCritical
    : percent >= 70
      ? config.colors.barWarning
      : config.colors.barGood;
  return styleText(value, color, options);
}

function styleText(value: string, color: HudColor, options: RenderOptions): string {
  if (!options.color) return value;
  const open = ansiOpen(color);
  return open ? `${open}${value}\x1b[0m` : value;
}

function ansiOpen(color: HudColor): string | undefined {
  const named: Record<string, string> = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
    dim: "\x1b[2m",
  };
  if (named[color]) return named[color];
  const match = /^#([0-9A-Fa-f]{6})$/.exec(color);
  if (!match) return undefined;
  const hex = match[1];
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function truncateOutput(output: string, terminalWidth: number | undefined): string {
  if (!terminalWidth || terminalWidth <= 0) return output;
  return output
    .split("\n")
    .map((line) => truncateLine(line, terminalWidth))
    .join("\n");
}

function truncateLine(line: string, terminalWidth: number): string {
  if (line.length <= terminalWidth) return line;
  if (terminalWidth <= 3) return ".".repeat(terminalWidth);
  return `${line.slice(0, terminalWidth - 3)}...`;
}
