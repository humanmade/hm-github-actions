# Resolve Composer Lock Content-Hash Conflict

This action can be used to automatically resolve a `composer.lock` content-hash merge conflict in a pull request. When two branches independently update `composer.json`, the `content-hash` field in `composer.lock` diverges and GitHub marks the PR as unmergeable even though no actual package change is in conflict. This action detects that situation, regenerates the hash from the resolved `composer.json`, and pushes a merge commit to the PR branch.

The action exits without modifying the branch when:
- There are no conflicts (nothing to do).
- `composer.json` is also conflicted — a human must resolve it first.
- `composer.lock` has conflicts beyond the `content-hash` line (package-level changes require human review).
- The PR is from a fork (pushing is not possible with the default `pull_request` token).

## Usage

Reference this action in a workflow within your project by using a repository action reference. As an example, the below workflow listens for pull request events and automatically resolves `composer.lock` content-hash conflicts.

```yml
name: Resolve composer.lock conflict

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref_name }}
  cancel-in-progress: true

jobs:
  resolve-lock:
    name: "Resolve composer.lock content-hash conflict"
    runs-on: ubuntu-latest
    steps:
      - name: Set up PHP
        uses: shivammathur/setup-php@accd6127cb78bee3e8082180cb391013d204ef9f # v2.37.0
        with:
          php-version: "8.4"
          tools: composer

      - name: Resolve conflict
        uses: humanmade/hm-github-actions/.github/actions/resolve-composer-lock-conflict@4d2c658bfd7f5c6b21f1d022322bddf26899b033 # v0.2.0
        with:
          base_branch: ${{ github.base_ref }}
          head_branch: ${{ github.head_ref }}
```

> [!NOTE]
> The action your workflow `uses:` should be referenced by (`@`) a specific Git commit SHA hash for [security reasons](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions).

> [!NOTE]
> This action pushes directly to the PR branch and therefore requires `permissions: contents: write` in the calling workflow. Fork PRs are not supported — the workflow will skip them silently.

### Required Parameters

- `base_branch`: Base branch of the pull request (e.g. `main`). Use `${{ github.base_ref }}` in a `pull_request` workflow.
- `head_branch`: Head branch of the pull request to update. Use `${{ github.head_ref }}` in a `pull_request` workflow.

### Optional Parameters

- `working_directory`: Directory containing `composer.json` and `composer.lock`. Defaults to the repository root (`.`). Useful for monorepos where Composer is in a subdirectory.
- `commit_message`: Commit message for the merge commit. Defaults to `"Auto-resolve composer.lock content-hash conflict"`.
- `commit_user_name`: Name used for the merge commit author. Defaults to `"Your friendly neighborhood GH Actions Bot"`.
- `commit_user_email`: Email used for the merge commit author. Defaults to `"<>"`.
