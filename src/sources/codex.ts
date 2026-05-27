import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";
import type { HudConfig } from "../config.js";
import { defaultShimBinDir, resolveNativeCodexPath } from "../native-runner.js";

const execFileAsync = promisify(execFile);

export interface CodexInfo {
  model?: string;
  reasoningEffort?: string;
  version?: string;
  codexPath?: string;
  codexHome: string;
}

export interface DoctorReport {
  ok: boolean;
  codexCli: {
    found: boolean;
    path?: string;
    version?: string;
  };
  codexHud: {
    found: boolean;
    path?: string;
  };
  codexShim: {
    installed: boolean;
    path: string;
  };
  patchedCodex: {
    found: boolean;
    path: string;
  };
  nativeStatusCommand: {
    configured: boolean;
  };
  codexHome: string;
  lines: string[];
}

export interface DoctorDeps {
  resolveCodexPath?: () => Promise<string | undefined>;
  readCodexVersion?: () => Promise<string | undefined>;
  resolveCodexHudPath?: () => Promise<string | undefined>;
  codexHome?: string;
  shimPath?: string;
  readTextFile?: (target: string) => Promise<string | undefined>;
  pathExists?: (target: string) => Promise<boolean>;
}

export function getCodexHome(config?: HudConfig): string {
  return config?.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
}

export async function readCodexInfo(config?: HudConfig): Promise<CodexInfo> {
  const codexHome = getCodexHome(config);
  const [codexPath, version, configText] = await Promise.all([
    resolveCodexPath(),
    readCodexVersion(),
    readCodexConfigText(codexHome),
  ]);
  const parsedConfig = parseCodexConfigText(configText ?? "");

  return {
    ...parsedConfig,
    version,
    codexPath,
    codexHome,
  };
}

export async function resolveCodexPath(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("sh", ["-c", "command -v codex"], {
      timeout: 1000,
      encoding: "utf8",
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function resolveCodexHudPath(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("sh", ["-c", "command -v codex-hud"], {
      timeout: 1000,
      encoding: "utf8",
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function readCodexVersion(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("codex", ["--version"], {
      timeout: 1000,
      encoding: "utf8",
    });
    return parseCodexVersion(stdout);
  } catch {
    return undefined;
  }
}

export function parseCodexVersion(output: string): string | undefined {
  const match = output.match(/codex-cli\s+([0-9]+(?:\.[0-9]+){1,3}(?:[-+][^\s]+)?)/);
  return match?.[1];
}

export function parseCodexConfigText(text: string): Pick<CodexInfo, "model" | "reasoningEffort"> {
  return {
    model: parseTomlString(text, "model"),
    reasoningEffort: parseTomlString(text, "model_reasoning_effort"),
  };
}

export async function createDoctorReport(deps: DoctorDeps = {}): Promise<DoctorReport> {
  const codexHome = deps.codexHome ?? getCodexHome();
  const codexPath = await (deps.resolveCodexPath ?? resolveCodexPath)();
  const codexHudPath = await (deps.resolveCodexHudPath ?? resolveCodexHudPath)();
  const version = codexPath ? await (deps.readCodexVersion ?? readCodexVersion)() : undefined;
  const exists = deps.pathExists ?? pathExists;
  const homeExists = await exists(codexHome);
  const shimPath = deps.shimPath ?? path.join(defaultShimBinDir(), process.platform === "win32" ? "codex.cmd" : "codex");
  const shimText = await (deps.readTextFile ?? readOptionalText)(shimPath);
  const shimInstalled = Boolean(shimText?.includes("codex-hud shim"));
  const patchedCodexPath = parseShimCodexPath(shimText) ?? resolveNativeCodexPath();
  const patchedCodexFound = await exists(patchedCodexPath);
  const nativeStatusCommandConfigured = Boolean(shimText && /codex-hud(?:\.cmd)?\s+native/.test(shimText));
  const lines: string[] = [];

  if (codexPath) {
    lines.push(`Codex CLI: ${version ?? "found"} (${codexPath})`);
  } else {
    lines.push("Codex CLI: not found");
  }
  if (codexHudPath) {
    lines.push(`codex-hud binary found (${codexHudPath})`);
  } else {
    lines.push("codex-hud binary: not found");
  }
  if (shimInstalled) {
    lines.push(`codex shim installed at ${shimPath}`);
  } else {
    lines.push(`codex shim: not installed at ${shimPath}`);
  }
  if (patchedCodexFound) {
    lines.push(`patched Codex found at ${patchedCodexPath}`);
  } else {
    lines.push(`patched Codex: not found at ${patchedCodexPath}`);
  }
  if (nativeStatusCommandConfigured) {
    lines.push("native status command configured");
  } else {
    lines.push("native status command: not configured");
  }
  lines.push(`Codex home: ${homeExists ? codexHome : `${codexHome} (missing)`}`);
  lines.push(`Node.js: ${process.version}`);

  return {
    ok: Boolean(codexPath),
    codexCli: {
      found: Boolean(codexPath),
      path: codexPath,
      version,
    },
    codexHud: {
      found: Boolean(codexHudPath),
      path: codexHudPath,
    },
    codexShim: {
      installed: shimInstalled,
      path: shimPath,
    },
    patchedCodex: {
      found: patchedCodexFound,
      path: patchedCodexPath,
    },
    nativeStatusCommand: {
      configured: nativeStatusCommandConfigured,
    },
    codexHome,
    lines,
  };
}

async function readOptionalText(target: string): Promise<string | undefined> {
  try {
    return await readFile(target, "utf8");
  } catch {
    return undefined;
  }
}

function parseShimCodexPath(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(/--codex\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

async function readCodexConfigText(codexHome: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(codexHome, "config.toml"), "utf8");
  } catch {
    return undefined;
  }
}

function parseTomlString(text: string, key: string): string | undefined {
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*"([^"]+)"\\s*$`, "m");
  return text.match(pattern)?.[1];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}
