import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitSnapshot } from "../types.js";

const execFileAsync = promisify(execFile);

export async function readGitSnapshot(cwd: string): Promise<GitSnapshot | undefined> {
  try {
    const [{ stdout: branchOut }, status] = await Promise.all([
      execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd,
        timeout: 1000,
        encoding: "utf8",
      }),
      readDirty(cwd),
    ]);
    const branch = branchOut.trim();
    if (!branch) return undefined;
    return {
      branch,
      isDirty: status,
      ahead: 0,
      behind: 0,
    };
  } catch {
    return undefined;
  }
}

async function readDirty(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["--no-optional-locks", "status", "--porcelain"],
      { cwd, timeout: 1000, encoding: "utf8" },
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}
