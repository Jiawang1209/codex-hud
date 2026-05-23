# Release

## Checks

```bash
npm run pack:check
python3 /Users/liuyue/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex-hud
```

The npm dry run should include:

- `dist/`
- `patches/codex-cli-command-statusline.patch`
- `.codex-plugin/`
- `plugins/codex-hud/`
- `skills/codex-hud/`
- `docs/`

## Publish

```bash
npm publish --access public
```

## After Publish

Install from the registry and verify the native bundle:

```bash
npm install -g codex-hud
codex-hud install --dry-run
codex-hud doctor
```

Run a real install on a clean machine before announcing the first public version.
