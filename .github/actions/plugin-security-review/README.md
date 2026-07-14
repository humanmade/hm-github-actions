# Plugin Security Review

This action turns a third-party-plugin security scan into a "**human-dismissable gate**" rather than a pass/fail check.

Third-party plugins are typically gitignored and installed by Composer at build time, so they never appear in a pull request's file diff. This action detects which plugins were added or updated by diffing the WordPress plugin/mu-plugin packages in `composer.lock` between the PR base and head (a package counts as changed if its name is new, its version differs, or its resolved commit reference differs), then scans only those directories with a security-only PHPCS ruleset supplied by the caller.

If the ruleset reports findings, the action posts a **Request changes** review (via `GITHUB_TOKEN`) naming each plugin and the exact command to re-run the scan locally. The job itself always exits successfully, but this review creates intentional friction by requiring a human to dismiss the review in order to unblock merge. This avoids hard-blocking CI on the false positives that third-party plugins routinely trigger, while still surfacing findings that may be real.

The review is keyed to the head commit SHA: re-running the workflow will not stack duplicate reviews for the same commit, but a subsequent commit that changes `composer.lock` again earns a fresh review.

Plugins are located by checking `client-mu-plugins/<name>` and `plugins/<name>`, the two installer-paths roots used across HM's WordPress projects.

## Usage

This action includes its own checkout, PHP setup, and Composer caching, so a single step is enough to run it within a job:

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
    runs-on: ubuntu-latest
    if: "!contains(github.event.pull_request.labels.*.name, 'skip-ci')"
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Plugin Security Review
        uses: humanmade/hm-github-actions/.github/actions/plugin-security-review@REPLACE_WITH_COMMIT_SHA # vX.Y.Z
        with:
          security_ruleset_path: .phpcs-security.xml.dist
          docs_url: https://github.com/my-org/my-repo/blob/main/docs/code-quality.md#plugin-security-review
```

> [!NOTE]
> The action your project `uses:` should be referenced by (`@`) a specific Git commit SHA hash, for both [security reasons](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) and because a specific SHA is necessary to use an action from another repository.

> [!NOTE]
> The caller's own `pull_request` trigger controls when this runs (branches, `paths` filtering on `composer.json`/`composer.lock`, etc.) and its own job `if:` controls any skip-label behavior — this action does not hardcode either.

If you'd rather not declare checkout/PHP/permissions yourself, use the [reusable workflow](../../workflows/plugin-security-review.yml) instead, which wraps this action and also accepts a `skip_ci_label` input.

### Required Parameters

- `security_ruleset_path`: Path to a PHPCS ruleset that scans for security issues (injection, escaping, etc.) across first- **and** third-party code. This is project-specific and must already exist in the caller's repository.

### Optional Parameters

- `php_version`: PHP version to use for Composer and PHPCS. Defaults to `"8.3"`.
- `docs_url`: Link to project docs explaining the review process, appended to the review body. Omitted if not set.
