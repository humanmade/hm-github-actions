# Sync Branches

This action creates a companion "sync" branch from a labeled pull request and opens a second pull request proposing to merge the source branch into a target environment branch (e.g. `dev`, `staging`). It is a port of [`humanmade/sync-branches`](https://github.com/humanmade/sync-branches) into this repo, rewritten as a composite action using the `gh` CLI.

Typical usage: a developer labels an open PR with `Push to Dev`; this action creates `{source-branch}-dev`, opens a PR from that new branch to `dev`, assigns the sync PR to the original author, and removes the label from the source PR so the workflow can't re-fire.

## Usage

```yml
name: Push to Environment

on:
  pull_request:
    types:
      - labeled

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  push-to-dev:
    name: Dev
    if: ${{ github.event.label.name == 'Push to Dev' }}
    runs-on: ubuntu-latest
    steps:
      - name: Create sync PR
        id: syncdev
        uses: humanmade/hm-github-actions/.github/actions/sync-branches@4d2c658bfd7f5c6b21f1d022322bddf26899b033 # v0.2.0
        with:
          from_branch: ${{ github.head_ref }}
          to_branch: dev
          new_branch_suffix: dev
          required_label: Push to Dev

      - name: Approve and auto-merge the sync PR
        if: steps.syncdev.outputs.pull_request_number
        env:
          GH_TOKEN: ${{ secrets.PR_MERGE_PAT }}
        run: |
          gh pr update-branch ${{ steps.syncdev.outputs.pull_request_number }} || true
          gh pr merge ${{ steps.syncdev.outputs.pull_request_number }} --merge --auto
```

> [!NOTE]
> The action your workflow `uses:` should be referenced by (`@`) a specific Git commit SHA hash for [security reasons](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions).

> [!NOTE]
> The calling workflow must grant `contents: write`, `pull-requests: write`, and `issues: write` permissions so the action can create branches, open pull requests, and remove labels respectively.

### Pairing with `resolve-composer-lock-conflict`

When the sync PR includes `composer.lock`, `gh pr update-branch` will often fail because the lockfile's `content-hash` diverges between the source branch and the target environment branch. Drop [`resolve-composer-lock-conflict`](../resolve-composer-lock-conflict/) in between to auto-resolve that case — see that action's README for the full example.

### Required Parameters

- `from_branch`: Source branch to sync from. Typically `${{ github.head_ref }}` in a `pull_request` workflow.
- `to_branch`: Target branch the sync PR opens against (e.g. `dev`, `staging`).
- `required_label`: Label on the source PR that triggered the workflow. Removed from the source PR before the sync PR is created.

### Optional Parameters

- `new_branch_suffix`: Suffix appended to `from_branch` to form the sync branch name. Defaults to `dev`. For example, `from_branch: feature-x` with `new_branch_suffix: staging` produces the sync branch `feature-x-staging`.
- `pull_request_title`: Title of the sync PR. Defaults to `"sync: {from_branch} to {to_branch}"`.
- `pull_request_body`: Body of the sync PR. Defaults to `"sync-branches: Merge #{source_pr} to {to_branch}"`.
- `pull_request_is_draft`: Open the sync PR as a draft. Defaults to `"false"`.
- `github_token`: Token used for API calls. Defaults to `${{ github.token }}`. Override with a PAT when you need to bypass branch protections or trigger downstream workflows on the sync PR.

### Outputs

- `pull_request_number`: Number of the sync PR — newly created or, if one was already open from this branch pair, the pre-existing one.
- `pull_request_url`: HTML URL of the sync PR.

### Behavior notes

- If the sync branch already exists, the action posts a comment on the source PR explaining the conflict and fails. Delete the stale branch and re-run.
- If a sync PR is already open from `{from_branch}-{new_branch_suffix}` → `to_branch`, the action returns that PR's number and URL rather than creating a duplicate.
- If the required label cannot be removed from the source PR (e.g. it was already removed manually), the action exits without creating the sync PR.
