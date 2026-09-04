# Human Made Reusable GitHub Actions

This repository contains action and workflow definitions which can be used across Human Made projects to centralize and standardize our tooling and release processes.

## Available Actions

### Build to Release Branch

The [`build-to-release-branch.yml`](./.github/actions/build-to-release-branch/action.yml) action can be used to compile a source branch into a target releasable branch, committing any built assets which are normally gitignore'd. This release branch can then be tagged for a formalized NPM or Packagist release, or else tracked in composer as a VCS reference.

[View usage instructions here](./.github/actions/build-to-release-branch/)

### Resolve Composer Lock Content-Hash Conflict

The [`resolve-composer-lock-conflict`](./.github/actions/resolve-composer-lock-conflict/action.yml) action automatically resolves `composer.lock` content-hash merge conflicts in pull requests. When two branches independently update `composer.json`, the `content-hash` in `composer.lock` diverges. This action detects that situation, regenerates the hash from the resolved `composer.json`, and pushes a merge commit to the PR branch. It exits without modifying the branch if `composer.json` is also conflicted, if there are package-level conflicts in `composer.lock`, or if the PR comes from a fork.

[View usage instructions here](./.github/actions/resolve-composer-lock-conflict/)

### Sync Branches

The [`sync-branches`](./.github/actions/sync-branches/action.yml) action creates a companion sync branch from a labeled pull request and opens a second pull request proposing to merge it into a target environment branch (e.g. `dev`, `staging`). Ported from [`humanmade/sync-branches`](https://github.com/humanmade/sync-branches).

[View usage instructions here](./.github/actions/sync-branches/)

### Block Pattern Diff Comment

The [`block-pattern-diff-comment`](./.github/actions/block-pattern-diff-comment/action.yml) action watches a pull request for changes to block patterns, templates and template parts in one or more theme directories, and comments with a link to a structural diff of those files on [Block Pattern Diff](https://humanmade.github.io/block-pattern-diff/). The diff is encoded into the link itself, so nothing is uploaded. The comment is updated in place as the pull request changes and removed if the pattern changes are reverted; a pull request that touches no watched files gets no comment.

[View usage instructions here](./.github/actions/block-pattern-diff-comment/)

### Plugin Security Review

The [`plugin-security-review`](./.github/actions/plugin-security-review/action.yml) action detects third-party plugins and themes added or updated in a pull request (via `composer.lock`) and scans only those directories with a security PHPCS standard (defaulting to `HM-Minimum`, or a caller-supplied ruleset for a broader scan). If findings are present, it requests changes on the PR rather than failing the check, so a human independently reviews and owns the merge decision by dismissing the review.

[View usage instructions here](./.github/actions/plugin-security-review/)

## Complete Workflows

### Node.js Build-and-Release Workflow

This workflow simplifies installing Node.js dependencies, then building them to a target branch. It composes the `actions/checkout`, `actions/setup-node`, and our custom `build-to-release-branch` actions.

Example usage:

```yml
name: Production Release

on:
  push:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref_name }}
  cancel-in-progress: true

jobs:
  release:
    name: "Update release branch"
    uses: humanmade/hm-github-actions/.github/workflows/build-and-release-node.yml@fabf2b583b046cca2cccffa99d5a3cd83c487e4f # v0.3.0
    with:
      node_version: 24
      source_branch: main
      release_branch: release
      built_asset_paths: build
      build_script: |
        npm ci
        npm run build
```
See [.github/workflows/build-and-release-node-basic.yml](./.github/workflows/build-and-release-node.yml) for full usage instructions.

### Resolve Composer Lock Conflict Workflow

This workflow simplifies resolving `composer.lock` content-hash conflicts in pull requests by setting up PHP and Composer, then calling the `resolve-composer-lock-conflict` action.

Example usage:

```yml
name: Resolve composer.lock conflict

on:
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref_name }}
  cancel-in-progress: true

jobs:
  resolve-lock:
    name: "Resolve composer.lock content-hash conflict"
    uses: humanmade/hm-github-actions/.github/workflows/resolve-composer-lock-conflict.yml@fabf2b583b046cca2cccffa99d5a3cd83c487e4f # v0.3.0
    with:
      base_branch: ${{ github.base_ref }}
      head_branch: ${{ github.head_ref }}
    permissions:
      contents: write
```

See [.github/workflows/resolve-composer-lock-conflict.yml](./.github/workflows/resolve-composer-lock-conflict.yml) for full usage instructions.

### Plugin Security Review Workflow

This workflow simplifies running the `plugin-security-review` action by handling checkout, PHP setup, and Composer caching.

Example usage:

```yml
name: Plugin Security Review

on:
  pull_request:
    branches:
      - production
      - staging
    paths:
      - composer.json
      - composer.lock

jobs:
  plugin-security-review:
    name: Plugin Security Review
    uses: humanmade/hm-github-actions/.github/workflows/plugin-security-review.yml@7a43ab08912a043659fa4492711d2921d79e57ea # v0.5.0
    with:
      security_standard: .phpcs-security.xml.dist
```

See [.github/workflows/plugin-security-review.yml](./.github/workflows/plugin-security-review.yml) for full usage instructions.

### Tag and Release Workflow

This workflow tags a branch and cuts a GitHub release from that tag. It refuses to overwrite an existing tag, pushes the new tag, and creates the release with GitHub's generated release notes.

A reusable workflow cannot declare its own `workflow_dispatch` inputs, so the calling repository owns the trigger and forwards the values it collects.

Example usage:

```yml
name: Tag and Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (e.g. v1.0.0)'
        required: true
      target_branch:
        description: 'Branch to tag'
        default: main
        required: true

jobs:
  tag-and-release:
    name: Tag and Release
    uses: humanmade/hm-github-actions/.github/workflows/tag-and-release.yml@4a6221b14a1ebb175076a05c1bb5ecf063ae6725
    with:
      version: ${{ inputs.version }}
      target_branch: ${{ inputs.target_branch }}
    permissions:
      contents: write
```

`target_branch` defaults to `main`; pass `release` (or whichever branch your build workflow produces) in repositories that tag a built branch. `body`, `generate_release_notes`, `draft`, `prerelease`, `commit_user_name` and `commit_user_email` are also available.

The caller job must grant `permissions: contents: write` — a called workflow can only narrow the calling workflow's token, never widen it. No `secrets: inherit` is needed: the workflow falls back to the automatic `GITHUB_TOKEN`. Pass an optional `token` secret only if the new tag needs to trigger other workflows, which a `GITHUB_TOKEN`-pushed tag does not.

> [!NOTE]
> That SHA is the tip of the `tag-and-release-workflow` branch, which is enough to call the workflow before it is merged. Re-pin it to a release tag's SHA once this lands, the way the other workflows here are pinned. A squash merge would leave the branch commits unreachable and break the reference, so do not leave it pointing at a branch tip.

See [.github/workflows/tag-and-release.yml](./.github/workflows/tag-and-release.yml) for full usage instructions.
