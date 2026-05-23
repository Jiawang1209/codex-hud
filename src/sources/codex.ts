import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";
import type { HudConfig } from "../config.js";

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
  codexHome: string;
  lines: string[];
}

export interface DoctorDeps {
  resolveCodexPath?: () => Promise<string | undefined>;
  readCodexVersion?: () => Promise<string | undefined>;
  codexHome?: string;
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
  const version = codexPath ? await (deps.readCodexVersion ?? readCodexVersion)() : undefined;
  const homeExists = await pathExists(codexHome);
  const lines: string[] = [];

  if (codexPath) {
    lines.push(`Codex CLI: ${version ?? "found"} (${codexPath})`);
  } else {
    lines.push("Codex CLI: not found");
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
    codexHome,
    lines,
  };
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
