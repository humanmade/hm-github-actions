# Build to Release Branch

This action can be used to compile a source branch into a target releasable branch, committing any built assets which are normally gitignore'd. This release branch can then be tagged for a formalized NPM or Packagist release, or else tracked in composer as a VCS reference.

## Usage

Reference this action in a workflow within your project by using a repository action reference. As an example, the below action listens for pushes to `main`, then installs build dependencies and uses this action to build generated assets to a `release` branch.

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
      - name: Check out project
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Set up Node
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22
          cache: 'npm'

      - name: Merge and build
        uses: humanmade/hm-github-actions/.github/actions/build-to-release-branch@bbe801d037b61dd0fa0fcd7d208f6bf54d7ca1fd # v0.1.1
        with:
          source_branch: main
          release_branch: release
          built_asset_paths: build
          build_script: |
            npm ci
            npm run build
```

> [!NOTE]
> The action your workflow `uses:` should be referenced by (`@`) a specific Git commit SHA hash for [security reasons](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions).

> [!NOTE]
> The target `release` branch must exist before this action is used. Push a copy of your default branch as the base for future release commits, _e.g._ `git push origin main:release`.

### Required Parameters

- `source_branch`: Base branch for build.
- `release_branch`: Branch to which the built files will be committed.
- `built_asset_paths`: Paths (space-separated) which should be force-committed after build.

### Optional Parameters

- `build_script`: Script used to generate built files. Defaults to `npm ci; npm run build`.
- `commit_user_name`: Name used for the release build Git commit within the CI process. Defaults to "Your friendly neighborhood GH Actions Bot".
- `commit_user_email`: Email used for the release build Git commit within the CI process. Defaults to the empty address "<>".
