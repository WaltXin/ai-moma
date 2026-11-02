# Contributing to AI MoMA

Thanks for helping build the museum! Ways to contribute, easiest first:

1. **Add or improve a movement**: education text, techniques, a prompt template
2. **Curate an exhibition** on a floor
3. **Implement an image provider** adapter
4. **Build a viewer** (Agamograph, 3D room, …)

## Setup

```bash
pnpm install
pnpm dev
pnpm check   # run before opening a PR: lint + typecheck + test
```

No API keys are needed. The `mock` provider works offline.

## Add a movement

1. Create `src/content/movements/<slug>.ts` (kebab-case slug) exporting a `Movement`.
   Copy `pop-art.ts` as a template. Fill in:
   - `summary`, `period`, `keyArtists`, `techniques`
   - `palette` (3–5 hex colors) and `placeholderPattern`
   - `learn` sections in plain language
   - `studio`: set `status: "planned"` until the prompt template produces good results
2. Register it in `src/content/movements/index.ts`.
3. Add an exhibition in `src/content/exhibitions.ts` and place it on a floor in
   `src/content/floors.ts`, or add a new floor.
4. Run `pnpm test`. `validateMuseum()` will catch broken references.

### Content rules

- **Teach techniques, don't copy works.** Don't commit copyrighted artworks. Images in learn
  pages must be public domain or properly licensed, with attribution.
- **Prompt templates describe style, not people.** Use "Ben-Day dots, flat saturated color",
  not "in the style of <living artist>".
- Be accurate. Link sources in your PR description for historical claims.

## Implement an image provider

1. Open the stub in `src/lib/generation/providers/<id>.ts`.
2. Replace the `stubProvider(...)` call with an object that implements `ImageProvider`
   (see `mock.ts`). Read keys from `process.env` only, and never expose them to the client.
3. Set `capabilities` truthfully. The Studio uses them to decide whether uploads are allowed.
4. Document new env vars in `.env.example`.
5. Add tests that mock `fetch`. CI has no API keys.

## How a contribution flows

```
idea ─▶ issue / discussion ─▶ fork & branch ─▶ PR (draft is fine) ─▶ CI + review ─▶ squash merge
```

### 1. Start with an issue (for anything non-trivial)

- **Small fixes** (typos, obvious bugs): skip straight to a PR.
- **New movement, feature, provider or viewer**: open an issue with the matching template, or
  start a [Discussion](https://github.com/WaltXin/ai-moma/discussions), so we can agree on the
  approach before you spend time on it.
- Look for [`good first issue`](https://github.com/WaltXin/ai-moma/labels/good%20first%20issue)
  if you're new. Comment on an issue to claim it so nobody duplicates your work.

### 2. Fork and branch

```bash
gh repo fork WaltXin/ai-moma --clone && cd ai-moma
git switch -c content/surrealism       # or feat/agamograph-viewer, fix/upload-size …
pnpm install
```

Keep your fork up to date with `git pull --rebase upstream main`.

### 3. Commit

Commit however you like on your branch. **PRs are squash-merged**, so only the PR title ends
up on `main`.

### 4. Open a pull request

- **Title** must follow [Conventional Commits](https://www.conventionalcommits.org/). A CI
  check enforces it:

  | Type                                                   | Use for                                    | Example                            |
  | ------------------------------------------------------ | ------------------------------------------ | ---------------------------------- |
  | `feat`                                                 | new functionality                          | `feat(studio): add photo cropping` |
  | `fix`                                                  | bug fixes                                  | `fix(api): reject empty uploads`   |
  | `content`                                              | movements, exhibitions, floors, learn text | `content: add Surrealism movement` |
  | `docs`                                                 | documentation only                         | `docs: explain provider env vars`  |
  | `refactor` `perf` `test` `build` `ci` `chore` `revert` | the usual                                  | `ci: cache pnpm store`             |

  Add `!` for breaking changes: `feat(api)!: rename generate response fields`.

- Fill in the PR template: what and why, linked issue (`Closes #12`), how you tested,
  screenshots for anything visual.
- Open it as a **draft** early if you want feedback before it's finished.
- Keep PRs focused: one movement or one feature per PR. Big changes are easier to review
  as a stack of smaller PRs.

### 5. CI and review

Every PR runs:

| Check               | What it does                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| `check`             | `pnpm lint`, `typecheck`, `test`, `build`                                  |
| `Validate PR title` | Conventional Commit title                                                  |
| PR labeler          | Adds area labels (`content`, `generation`, `studio`, …) from changed paths |

A maintainer (see `.github/CODEOWNERS`) will review it. Please respond to comments by pushing
new commits rather than force-pushing, which makes re-review easier. Resolve every review
thread before merging.

### 6. Merge

A maintainer squash-merges once CI is green and review is done. Your PR title becomes the
commit message and appears in the release notes, grouped by label.

## AI-assisted contributions

AI MoMA is about AI and art, so using AI coding assistants is welcome. Please:

- say in the PR template what was AI-assisted
- review and understand every line you submit, because you're responsible for it
- don't submit generated content (learn text, artist facts) without checking it against sources

## Licensing of contributions

By submitting a PR you agree your contribution is licensed under the project's
[MIT License](LICENSE). There's no CLA to sign. Only submit work you have the right to
license this way.

## Code of conduct

Everyone taking part is expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please don't report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).
