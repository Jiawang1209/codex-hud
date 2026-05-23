# Codex HUD Design

Date: 2026-05-23
Status: Draft approved for implementation planning

## Goal

Codex HUD is a Codex CLI-first terminal telemetry layer inspired by Claude HUD. It should give users an at-a-glance view of the current Codex working session: model, reasoning effort, project path, git state, context usage, usage windows when available, task progress, tool activity, and session signals.

The first version will use a standalone CLI as the core runtime and a Codex plugin wrapper for packaging, setup guidance, and future integration. This avoids blocking the project on a Claude-style command-backed statusline API that Codex CLI does not currently expose as a stable public surface.

## Non-Goals

- Do not patch or fork Codex CLI.
- Do not assume Codex has the same `statusLine.command` stdin/stdout contract as Claude Code.
- Do not require tmux, shell prompt integration, or Codex Desktop for the MVP.
- Do not collect or upload session content.
- Do not parse private message bodies beyond the metadata needed for HUD signals.

## Product Shape

The core package exposes a command named `codex-hud`.

Initial commands:

- `codex-hud status`: render one HUD snapshot and exit.
- `codex-hud watch`: continuously render HUD snapshots on an interval.
- `codex-hud doctor`: inspect runtime readiness and print actionable diagnostics.
- `codex-hud config`: show or initialize user configuration.

The Codex plugin wrapper provides:

- `.codex-plugin/plugin.json` with project metadata.
- A skill or command-oriented instructions for setup and diagnostics.
- Documentation for using the CLI directly today.
- A future path to native Codex statusline integration if Codex adds a command-backed statusline provider.

## MVP Display

Default compact output:

```text
[gpt-5.5 medium] | codex-hud git:(main*) | Context 42% | 5h 68% | Todos 2/5 | Bash/Edit active
```

Expanded output may split details across semantic lines:

```text
[gpt-5.5 medium] | codex-hud git:(main*)
Context ████░░░░░░ 42% | Usage ██████░░░░ 68%
Tools Bash active | Edit x2 | Read x4
Todos 2/5 | Build CLI scaffold
```

When a signal is unavailable, the renderer should omit it or show a clear low-noise fallback. The HUD should not imply precision where Codex does not expose reliable data.

## Data Sources

The data layer normalizes signals from multiple sources into one internal `HudSnapshot`.

Primary sources for the MVP:

- Current working directory passed by process cwd.
- Git state from local `git` commands.
- Codex config from `$CODEX_HOME/config.toml` or `~/.codex/config.toml`.
- Codex version from `codex --version`.
- Feature flags from `codex features list` when available.
- Session files under `$CODEX_HOME/sessions` or `~/.codex/sessions` when discoverable.

Optional and best-effort sources:

- Recent session JSONL metadata for tool activity, tasks, model, reasoning effort, and context signals.
- Local usage or limit data if Codex exposes it in config, session logs, or a future statusline payload.
- Stdin JSON adapter for future Codex statusline support.

The reader modules should be defensive. Missing files, unknown schemas, malformed JSONL lines, or unavailable Codex commands must degrade gracefully.

## Architecture

The CLI is organized into small units:

- `cli`: argument parsing, command dispatch, exit codes.
- `sources`: filesystem, Codex config, Codex sessions, git, Codex command probes.
- `adapters`: convert raw data into normalized HUD state.
- `render`: compact and expanded terminal output, colors, width handling.
- `config`: user config loading, defaults, validation.
- `doctor`: environment checks and actionable diagnostics.

The normalized state is the main boundary:

```ts
interface HudSnapshot {
  model?: string;
  reasoningEffort?: string;
  cwd: string;
  projectName: string;
  git?: GitSnapshot;
  context?: ProgressSnapshot;
  usage?: UsageSnapshot;
  tools: ToolActivity[];
  todos: TodoSnapshot;
  session?: SessionSnapshot;
  warnings: HudWarning[];
}
```

Renderers must depend on `HudSnapshot`, not on raw Codex files. This keeps future statusline stdin support local to a new adapter.

## Configuration

Default config location:

```text
~/.codex-hud/config.json
```

The first version supports:

- `layout`: `compact` or `expanded`.
- `refreshIntervalMs`: watch interval.
- `pathLevels`: number of cwd path segments to show.
- `display`: booleans for model, git, context, usage, tools, todos, session.
- `colors`: simple named colors and bar characters.
- `codexHome`: optional override for `$CODEX_HOME`.

Advanced config should be validated and merged with defaults, not trusted directly.

## Error Handling

The HUD should never crash the user terminal for ordinary missing data. It should:

- Exit non-zero only for invalid CLI arguments or explicit `doctor` failures.
- Print a minimal fallback status if optional sources fail.
- Keep debug details behind an environment flag such as `CODEX_HUD_DEBUG=1`.
- Avoid leaking full transcript content in errors.

## Testing

Core tests should use fixtures and not require live Codex sessions.

Initial test coverage:

- Config loading and validation.
- Git parser behavior for clean, dirty, detached, and non-git directories.
- JSONL session parsing with malformed-line tolerance.
- Renderer output for compact and expanded layouts.
- Doctor checks with mocked command availability.

Manual verification:

- `codex-hud doctor` in this repository.
- `codex-hud status` in a git repo and a non-git directory.
- `codex-hud watch` with a short interval and interrupt handling.

## Implementation Phases

Phase 1: CLI skeleton and config.

- Create TypeScript package.
- Add command parser.
- Add config defaults and validation.
- Add compact renderer with static and cwd/git data.

Phase 2: Codex-aware sources.

- Add Codex CLI detection.
- Read Codex config and version.
- Discover recent session files.
- Parse safe metadata from session JSONL fixtures.

Phase 3: Plugin wrapper.

- Add `.codex-plugin/plugin.json`.
- Add setup and diagnostic instructions.
- Document direct CLI, watch mode, and future statusline integration.

Phase 4: polish and packaging.

- Add tests, CI-ready scripts, README, examples, and release notes.
- Revisit native statusline integration if Codex exposes a stable command-backed API.

## Open Risks

- Codex session JSONL schema may change and may differ across CLI, Desktop, and cloud-backed flows.
- Codex CLI currently appears to lack a stable public command-backed statusline API like Claude Code.
- Usage limits and precise context percentages may not be available from stable local sources.
- Plugin-scoped lifecycle hooks and UI customization may be limited by Codex plugin runtime behavior.

## Acceptance Criteria

The MVP is acceptable when:

- `codex-hud status` prints a useful one-shot HUD in this repository.
- `codex-hud watch` refreshes without corrupting the terminal and exits cleanly on Ctrl-C.
- `codex-hud doctor` explains missing optional capabilities clearly.
- The package includes a Codex plugin manifest and user-facing setup docs.
- Tests cover config, rendering, git state, and session parsing fixtures.
