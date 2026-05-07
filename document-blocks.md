# Block Documentation

Automatically generates markdown documentation for WordPress blocks using Claude Code CLI (`claude -p`), and adds JSDoc and inline comments directly to block JS files. By default, this runs when a PR is opened or when a label is applied.

## Setup

### 1. Copy files into the project

```
scripts/document-blocks.mjs               → scripts/document-blocks.mjs
.github/workflows/document-blocks.yml     → .github/workflows/document-blocks.yml
.document-blocks.json.example             → .document-blocks.json  (then edit)
```

### 2. Configure `.document-blocks.json`

Place this file in the project root and set the paths for your theme:

```json
{
  "blocksDir": "themes/my-theme/blocks",
  "utilitiesDir": "themes/my-theme/src/utilities",
  "docsDir": "docs/blocks",
  "styleRef": "docs/blocks/example-block.md",
  "coreBlockPrefix": "core-",
  "model": "claude-haiku-4-5-20251001",
  "triggerMode": "pr",
  "docLabel": "generate-docs"
}
```

| Key | Required | Description |
|---|---|---|
| `blocksDir` | Yes | Path to the blocks directory, relative to repo root. |
| `utilitiesDir` | No | Path to a frontend utilities directory. When set, the script also looks for `{block-name}.js` here and includes it in the prompt. |
| `docsDir` | No | Output directory for generated docs. Defaults to `docs/blocks`. |
| `styleRef` | No | Path to a markdown file used as a style reference for Claude. Defaults to the first `.md` file found in `docsDir`. |
| `coreBlockPrefix` | No | Block folder names starting with this prefix that have no `edit.js` or `save.js` are skipped. Defaults to `"core-"`. Set to `""` to disable. |
| `model` | No | Claude model used for generation. Defaults to `claude-haiku-4-5-20251001`. |
| `triggerMode` | No | `"pr"` (default) — runs when a PR is opened or the doc label is applied. `"push"` — runs on every push to a non-protected branch. |
| `docLabel` | No | The PR label that triggers doc generation when `triggerMode` is `"pr"`. Defaults to `"generate-docs"`. |

### 3. Add repository secret

In **Settings → Secrets and variables → Actions**, add:

- `ANTHROPIC_API_KEY` — your Anthropic API key.

### 4. Adjust the branch filter (optional)

The workflow ignores pushes to long-lived branches. Edit the `branches-ignore` list in `.github/workflows/document-blocks.yml` to match the branch names your project uses.

### 5. Create the docs directory

```sh
mkdir -p docs/blocks
```

Optionally add a well-documented block's generated output as `docs/blocks/example-block.md` to give Claude a style reference for all subsequent generations.

## Manual use

To generate or regenerate documentation for a specific block:

```sh
node scripts/document-blocks.mjs <block-name>
```

To document multiple blocks at once (runs in parallel):

```sh
node scripts/document-blocks.mjs carousel accordion featured-articles
```

You can optionally add an npm script to `package.json` for convenience:

```json
"document-block": "node scripts/document-blocks.mjs"
```

Then run with:

```sh
npm run document-block carousel
```

## How it works

1. On PR open (or on push, if `triggerMode` is `"push"`), the workflow diffs the changed commits to find which block folders were modified. Applying the configured doc label to an existing PR re-runs generation for all blocks changed in that PR.
2. For each changed block, the script reads all source files (`block.json`, `edit.js`, `save.js`, `view.js`, `render.php`, deprecations, and optionally a matching utility file) and runs two tasks in parallel:
   - Sends the full file set to `claude -p` to generate `docs/blocks/{block-name}.md`.
   - Sends each JS file individually to `claude -p` to add JSDoc comments and inline explanatory comments, writing the result back in place.
3. The workflow stages both the docs directory and the blocks directory, commits with `[skip ci]`, and pushes.

## Requirements

- [Claude Code CLI](https://claude.ai/code) (`npm install -g @anthropic-ai/claude-code`)
- Node.js 18+
- An `ANTHROPIC_API_KEY` environment variable (set automatically in CI via the repository secret)
