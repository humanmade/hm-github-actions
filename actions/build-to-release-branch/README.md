# Build to Release Branch

This action can be used to compile a source branch into a target releasable branch, committing any built assets which are normally gitignore'd. This release branch can then be tagged for a formalized NPM or Packagist release, or else tracked in composer as a VCS reference.

## Usage

Reference this action in a workflow within your project by using a repository action reference. As an example, the below action listens for pushes to `main`, then installs build dependencies and uses this action to build generated assets to a `release` branch.

(Note: The target `release` branch must exist before this action is used. Push a copy of your default branch as the base for future release commits, _e.g._ `git push origin main:release`.)

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
    runs-on: ubuntu-latest
    steps:
      - name: Check out
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: 22
          cache: 'npm'

      - name: Merge and build
        uses: humanmade/hm-github-actions/actions/build-to-release-branch@25234fa9f55b6793954cd22b85e578d7b18be866
        with:
          source_branch: main
          release_branch: release
          built_asset_paths: assets/dist
          build_script: |
            npm ci
            npm run build
```
