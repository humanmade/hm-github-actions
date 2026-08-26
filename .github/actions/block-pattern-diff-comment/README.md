# Block pattern diff comment

Watches a pull request for changes to block patterns and templates, and comments with a link to a structural diff of those files on [Block Pattern Diff](https://humanmade.github.io/block-pattern-diff/).

A line diff of serialized block markup is close to unreadable: wrapping one group in another rewrites every line beneath it, and the one attribute that changed sits somewhere inside a 900-character line. The linked view re-parses both sides as blocks and compares them as a tree, so re-nesting and migrated attributes read as moves.

The comment is updated in place as the pull request changes, and removed if the pattern changes are reverted. If a pull request touches no watched files, the action does nothing.

## Usage

```yml
name: Block pattern diff

on:
  pull_request:
    types: [ opened, synchronize, reopened ]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  comment:
    runs-on: ubuntu-latest
    steps:
      - uses: humanmade/hm-github-actions/.github/actions/block-pattern-diff-comment@2c2360ec0747e0e2ac527f185dfc5860b70030c0 # pattern-diff-action
        with:
          theme_directories: themes/my-theme
```

That SHA is the tip of the `pattern-diff-action` branch, which is enough to run the action before it is merged. Re-pin it to a release tag's SHA once this lands, the way the other actions here are pinned. A squash merge would leave the branch commits unreachable and break the reference, so do not leave it pointing at a branch tip.

Several themes in one repository, one directory per line:

```yml
        with:
          theme_directories: |
            themes/parent
            themes/child
```

A repository that is itself a theme is the default, so `theme_directories` can be omitted.

No checkout step is needed. The action reads the changed files and the diff from the API.

## Inputs

Input | Default | Description
--- | --- | ---
`theme_directories` | `.` | Theme directories to watch, one per line, relative to the repository root.
`file_pattern` | see below | Extended regular expression matched against each changed file's path *relative to a theme directory*.
`site_url` | `https://humanmade.github.io/block-pattern-diff/` | Base URL of the tool.
`view` | `unified` | Which view the link opens: `unified` or `sbs`.
`comment_id` | `block-pattern-diff` | Identifier embedded in the comment so it can be found later. Change it if you run the action twice on one pull request.
`max_url_length` | `8000` | Longest link to build. Files are packed into as few links as fit under this. Raising it much produces links that 414.
`github_token` | `${{ github.token }}` | Token used for API calls.

The default `file_pattern` is:

```
^(patterns/.+\.(php|html)|templates/.+\.html|parts/.+\.html|[^/]+\.html)$
```

That covers registered patterns, block templates, template parts, and HTML files at the theme root, which is where block markup lives in a block theme. It deliberately ignores `functions.php`, stylesheets, and `theme.json`: those change how patterns render but are not themselves block markup, so there is nothing for a block tree to show.

## Outputs

Output | Description
--- | ---
`url` | The first link posted. Empty when nothing could be linked.
`link_count` | How many links the diff was split across.
`changed_files` | Number of matched files.
`comment_action` | `created`, `updated`, `unchanged`, `deleted`, or `none`.

## Behaviour worth knowing

**The diff travels inside the link.** Nothing is uploaded anywhere. The matched sections of the diff are gzipped and base64url-encoded into the query string, and the browser decodes them. Block markup compresses hard, so a twenty-file change still lands around a kilobyte.

**Large pull requests are split across several links.** GitHub Pages answers `414` past roughly 8190 characters of URL, so one link cannot always carry a whole pull request. Files are packed whole into as few links as fit under `max_url_length`, each link being a complete diff of the files it lists. The comment shows a single link when everything fits and a collapsed list of parts when it does not. A single file whose own diff will not fit is listed as unlinkable rather than being split mid-file, which would produce a diff the tool could not parse.

**Unchanged diffs are not rewritten.** If a push does not alter the pattern diff, the existing comment is left alone rather than edited, so subscribers are not re-notified. This relies on the payload being deterministic, which is why the action gzips with `-n` — without it the header timestamp would change on every run.

**Forks.** On a `pull_request` event from a fork the job's token is read-only and the comment cannot be posted. Running on `pull_request_target` instead gives a writable token and is safe here, because the action never checks out or executes any code from the pull request; it reads the changed files and the diff through the API and writes a comment. Do not add a checkout step to that job.
