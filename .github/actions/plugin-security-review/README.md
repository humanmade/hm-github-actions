# Plugin Security Review

This action turns a third-party-plugin security scan into a "**human-dismissable gate**" rather than a pass/fail check.

Third-party plugins are typically gitignored and installed by Composer at build time, so they never appear in a pull request's file diff. This action detects which plugins were added or updated by diffing the WordPress plugin/mu-plugin packages in `composer.lock` between the PR base and head (a package counts as changed if its name is new, its version differs, or its resolved commit reference differs), then scans only those directories with a security-only PHPCS standard.

If the standard reports findings, the action posts a **Request changes** review (via `GITHUB_TOKEN`) naming each plugin and the exact command to re-run the scan locally. The job itself always exits successfully, but this review creates intentional friction by requiring a human to dismiss the review in order to unblock merge. This avoids hard-blocking CI on the false positives that third-party plugins routinely trigger, while still surfacing findings that may be real.

The review is keyed to the head commit SHA: re-running the workflow will not stack duplicate reviews for the same commit, but a subsequent commit that changes `composer.lock` again earns a fresh review.

Plugins are located by checking `client-mu-plugins/<name>` and `plugins/<name>`, the two installer-paths roots used across HM's WordPress projects.

## Usage

This action expects the caller to have already checked out the repository (with full history, so it can read `composer.lock` at the PR base commit) and set up PHP/Composer. It only handles installing dependencies, detecting changed plugins, scanning, and posting the review:

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
      - name: Checkout code
        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          fetch-depth: 0

      - name: Setup PHP
        uses: shivammathur/setup-php@accd6127cb78bee3e8082180cb391013d204ef9f # v2.37.0
        with:
          php-version: "8.3"
          coverage: none
          tools: composer:v2

      - name: Plugin Security Review
        uses: humanmade/hm-github-actions/.github/actions/plugin-security-review@0e9172f8c3c680f865d3c822754446a8f2f3dc66
        with:
          security_standard: .phpcs-security.xml.dist
          docs_url: https://github.com/my-org/my-repo/blob/main/docs/code-quality.md#plugin-security-review
```

> [!NOTE]
> The action your project `uses:` should be referenced by (`@`) a specific Git commit SHA hash, for both [security reasons](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) and because a specific SHA is necessary to use an action from another repository.

> [!NOTE]
> The caller's own `pull_request` trigger controls when this runs (branches, `paths` filtering on `composer.json`/`composer.lock`, etc.) and its own job `if:` controls any skip-label behavior — this action does not hardcode either.

Checkout, PHP setup, and Composer caching are deliberately left to the caller rather than bundled into this action, so a job that already sets these up for other steps (phpcs, phpstan, tests) doesn't pay for a redundant PHP install here. If you'd rather not declare them yourself, use the [reusable workflow](../../workflows/plugin-security-review.yml) instead, which wraps this action and adds Composer caching.

### Parameters

- `security_standard`: Name of an installed PHPCS standard, or a path to a ruleset XML file, scanning for security issues (injection, escaping, etc.) across first- **and** third-party code. Defaults to `HM-Minimum` (provided by [`humanmade/coding-standards`](https://github.com/humanmade/coding-standards)), which most HM WordPress projects already have installed as part of their base linting setup. Supply a project-specific ruleset path (e.g. `.phpcs-security.xml.dist`) for a broader or stricter scan.
- `docs_url`: Link to project docs explaining the review process, appended to the review body. Omitted if not set.
