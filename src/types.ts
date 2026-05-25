export interface ProgressSnapshot {
  label: string;
  percent: number;
  windowMinutes?: number;
  resetsAt?: number;
}

export interface GitSnapshot {
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
}

export interface ToolActivity {
  name: string;
  status: "active" | "completed" | "error";
  count?: number;
}

export interface TodoSnapshot {
  completed: number;
  total: number;
  current?: string;
}

export interface SessionSnapshot {
  name?: string;
  duration?: string;
}

export interface HudWarning {
  message: string;
}

export interface HudSnapshot {
  model?: string;
  reasoningEffort?: string;
  cwd: string;
  projectName: string;
  git?: GitSnapshot;
  context?: ProgressSnapshot;
  usage?: ProgressSnapshot;
  weekly?: ProgressSnapshot;
  tools: ToolActivity[];
  todos: TodoSnapshot;
  session?: SessionSnapshot;
  warnings: HudWarning[];
}
