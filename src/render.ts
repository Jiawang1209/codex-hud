import type { HudConfig } from "./config.js";
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
  return compactParts(config, snapshot, options).join(" | ");
}

function renderExpanded(config: HudConfig, snapshot: HudSnapshot, options: RenderOptions): string {
  const identity = identityParts(config, snapshot).join(" | ");
  const progress = progressParts(config, snapshot, options).join(" | ");
  const activity = activityParts(config, snapshot).join(" | ");

  return [identity, progress, activity].filter(Boolean).join("\n");
}

function compactParts(config: HudConfig, snapshot: HudSnapshot, options: RenderOptions): string[] {
  return [
    ...identityParts(config, snapshot),
    ...progressParts(config, snapshot, options),
    ...activityParts(config, snapshot),
  ];
}

function identityParts(config: HudConfig, snapshot: HudSnapshot): string[] {
  const parts: string[] = [];
  if (config.display.model && snapshot.model) {
    parts.push(`[${[snapshot.model, snapshot.reasoningEffort].filter(Boolean).join(" ")}]`);
  }

  let project = snapshot.projectName;
  if (config.display.git && snapshot.git) {
    const dirty = snapshot.git.isDirty ? "*" : "";
    project += ` git:(${snapshot.git.branch}${dirty})`;
  }
  parts.push(project);

  return parts;
}

function progressParts(config: HudConfig, snapshot: HudSnapshot, options: RenderOptions): string[] {
  const parts: string[] = [];
  if (config.display.context && snapshot.context) {
    parts.push(formatProgress(snapshot.context, config, options));
  }
  if (config.display.usage && snapshot.usage) {
    parts.push(formatProgress(snapshot.usage, config, options));
  }
  return parts;
}

function activityParts(config: HudConfig, snapshot: HudSnapshot): string[] {
  const parts: string[] = [];
  if (config.display.todos && snapshot.todos.total > 0) {
    parts.push(`Todos ${snapshot.todos.completed}/${snapshot.todos.total}`);
  }
  if (config.display.tools && snapshot.tools.length > 0) {
    parts.push(snapshot.tools.map(formatTool).join(", "));
  }
  return parts;
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

function formatProgress(progress: ProgressSnapshot, config: HudConfig, options: RenderOptions): string {
  const percent = clampPercent(progress.percent);
  const width = 10;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = `${config.colors.barFilled.repeat(filled)}${config.colors.barEmpty.repeat(empty)}`;
  return `${progress.label} ${colorize(bar, percent, options)} ${colorize(`${percent}%`, percent, options)}`;
}

function colorize(value: string, percent: number, options: RenderOptions): string {
  if (!options.color) return value;
  const color = percent >= 85 ? 31 : percent >= 70 ? 33 : 32;
  return `\x1b[${color}m${value}\x1b[0m`;
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
