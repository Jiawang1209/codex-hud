import type { HudConfig } from "./config.js";
import type { HudSnapshot, ToolActivity } from "./types.js";

export function renderHud({
  config,
  snapshot,
}: {
  config: HudConfig;
  snapshot: HudSnapshot;
}): string {
  return config.layout === "expanded"
    ? renderExpanded(config, snapshot)
    : renderCompact(config, snapshot);
}

function renderCompact(config: HudConfig, snapshot: HudSnapshot): string {
  return compactParts(config, snapshot).join(" | ");
}

function renderExpanded(config: HudConfig, snapshot: HudSnapshot): string {
  const identity = identityParts(config, snapshot).join(" | ");
  const progress = progressParts(config, snapshot).join(" | ");
  const activity = activityParts(config, snapshot).join(" | ");

  return [identity, progress, activity].filter(Boolean).join("\n");
}

function compactParts(config: HudConfig, snapshot: HudSnapshot): string[] {
  return [
    ...identityParts(config, snapshot),
    ...progressParts(config, snapshot),
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

function progressParts(config: HudConfig, snapshot: HudSnapshot): string[] {
  const parts: string[] = [];
  if (config.display.context && snapshot.context) {
    parts.push(`${snapshot.context.label} ${clampPercent(snapshot.context.percent)}%`);
  }
  if (config.display.usage && snapshot.usage) {
    parts.push(`${snapshot.usage.label} ${clampPercent(snapshot.usage.percent)}%`);
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
