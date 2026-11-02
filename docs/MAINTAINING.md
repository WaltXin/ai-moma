# Maintaining AI MoMA

Notes for maintainers. Contributors should read [CONTRIBUTING.md](../CONTRIBUTING.md).

## Repository settings

`scripts/setup-github.sh` applies these idempotently with `gh` (repo admin required):

| Setting                         | Value                                                                                             | Why                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Merge methods                   | Squash only, PR title → commit title                                                              | Clean, Conventional-Commit history on `main`                                                 |
| Auto-delete head branches       | On                                                                                                | No stale branches                                                                            |
| Discussions                     | On                                                                                                | Questions and ideas stay out of the issue tracker                                            |
| Private vulnerability reporting | On                                                                                                | Backs SECURITY.md                                                                            |
| Ruleset on `main`               | PR required, `check` + `Validate PR title` must pass, no force-push or deletion, threads resolved | Every change goes through CI                                                                 |
| Ruleset bypass                  | Repository admins                                                                                 | Lets a solo maintainer push hotfixes. Remove when there are co-maintainers                   |
| Required approvals              | 0                                                                                                 | A solo maintainer can't approve their own PR. **Raise to 1 once there are ≥ 2 maintainers.** |

## Triage

New issues get the `triage` label from their template. For each one:

1. Reproduce or clarify, and ask for details if needed.
2. Replace `triage` with an area label, and add `good first issue` / `help wanted` where it fits.
3. Close duplicates and anything out of scope, linking where the discussion lives.

Good first issues should say where in the code to look and what "done" means.

## Reviewing content PRs

- Historical claims have sources linked in the PR.
- No copyrighted images. Learn-page images are public domain or licensed, with attribution.
- Prompt templates describe technique, not "in the style of <living artist>".
- `validateMuseum()` passes (CI covers this).

## Releases

The app deploys from `main`, so there's no package to publish. To mark milestones, create a
GitHub release with auto-generated notes. `.github/release.yml` groups them by label:

```bash
gh release create v0.1.0 --generate-notes
```

## Dependencies

Dependabot opens one grouped PR per week for minor/patch npm updates, separate PRs for majors,
and a monthly PR for GitHub Actions. Merge them when CI is green. Major Next.js and React
upgrades need a manual look (see `node_modules/next/dist/docs/` upgrade guides).

## Workflow security

The `pull_request_target` workflows (PR title, labeler) never check out PR code. Keep it that
way: a fork's code must never run with a write token.
