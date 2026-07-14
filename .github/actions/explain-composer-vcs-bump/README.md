# Explain Composer VCS Reference Bump

This action comments on a pull request explaining any change to a tracked composer VCS ("dev-branch") package reference (the kind of dependency tracked in `composer.json` as `dev-release`, `dev-main`, etc.), where `composer.lock` pins an exact commit SHA rather than a tagged version. When a PR bumps that pinned SHA, this action posts (or updates) a comment linking to the GitHub compare view between the old and new commit, e.g.:

> `wikimedia/shiro-wordpress-theme` updated from [release#6a15cc7c to release#1acac5bb](https://github.com/wikimedia/shiro-wordpress-theme/compare/6a15cc7ca6f7fc9848672ee8f23f258f9a8496bd...1acac5bb5c5ba89ded1d24dba4d4011f9ec104ad)

The repo URL and branch name are read directly from `composer.lock`'s `source` and `version` fields for each tracked package, so nothing needs to be hardcoded beyond the package names you want to watch. If a tracked package isn't touched by the PR, or was added/removed rather than bumped, it's silently skipped. If a previously-posted comment no longer applies (e.g. the bump was reverted by a later push), the comment is deleted.

The comparison is made against the merge-base of the PR's base and head, not the base branch's live tip. We want a dependency change to show up in the PR review even if it also occurs elsewhere.

This action can complement the use of [IonBazan/composer-diff-action](https://github.com/IonBazan/composer-diff-action), which lists the version number changes of composer dependencies in a PR but does not explain the details of a VCS dependency bump.

## Usage

Reference this action in a workflow within your project by using a repository action reference. As an example, the below workflow listens for pull request events touching `composer.lock` and comments on any change to a tracked package's VCS reference.

```yml
name: Explain composer VCS reference bump

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - composer.lock

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  explain-bump:
    runs-on: ubuntu-latest
    steps:
      - name: Explain composer VCS reference bump
        uses: humanmade/hm-github-actions/.github/actions/explain-composer-vcs-bump@70ae190dcc9efa323a3411ca4b25d52015bc1467
        with:
          tracked_packages: |
            wikimedia/shiro-wordpress-theme
            wikimedia/wikimedia-wordpress-security-plugin
```

> [!NOTE]
> The action your workflow `uses:` should be referenced by (`@`) a specific Git commit SHA hash both for [security reasons](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) and because remote-repo references seem to require this level of specificity.

> [!NOTE]
> This action needs `permissions: issues: write` (not just `pull-requests: write`) — PR conversation comments are served by the Issues REST API regardless of whether the target is an issue or a PR.

> [!NOTE]
> This action reads the pull request directly from the triggering event context (`github.event.pull_request`) and exits without doing anything if that's not present. It must be run from a `pull_request`-triggered workflow (or a reusable workflow called from one).

### Required Parameters

- `tracked_packages`: Newline-separated list of composer package names to track (e.g. `wikimedia/shiro-wordpress-theme`).

### Optional Parameters

- `working_directory`: Directory containing `composer.lock`. Defaults to the repository root (`.`). Useful for monorepos where Composer is in a subdirectory.
