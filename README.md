# Human Made Reusable GitHub Actions

This repository contains action and workflow definitions which can be used across Human Made projects to centralize and standardize our tooling and release processes.

## Available Actions

### Build to Release Branch

The [`build-to-release-branch.yml`](./.github/actions/build-to-release-branch/action.yml) action can be used to compile a source branch into a target releasable branch, committing any built assets which are normally gitignore'd. This release branch can then be tagged for a formalized NPM or Packagist release, or else tracked in composer as a VCS reference.

[View usage instructions here](./.github/actions/build-to-release-branch/)

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
    uses: humanmade/hm-github-actions/.github/workflows/build-and-release-node.yml@04c32a93e52ae987095f144105745a501d6207c8 # v0.2.0
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
