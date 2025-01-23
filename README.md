# Human Made Reusable GitHub Actions

This repository contains action and workflow definitions which can be used across Human Made projects to centralize and standardize our tooling and release processes.

## Available Actions

### Build to Release Branch

The [`build-to-release-branch.yml`](./actions/build-to-release-branch/action.yml) action can be used to compile a source branch into a target releasable branch, committing any built assets which are normally gitignore'd. This release branch can then be tagged for a formalized NPM or Packagist release, or else tracked in composer as a VCS reference.

[View usage instructions here](./actions/build-to-release-branch/)
