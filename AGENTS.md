<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AI MoMA project notes

- Read `docs/ARCHITECTURE.md` first. Content lives in `src/content/`; pages read it only via `src/lib/museum/registry.ts`.
- Image generation goes through `ImageProvider` (`src/lib/generation/`). Never call a model API from a page or client component. No Midjourney (no official API).
- Cache Components is on: no `dynamic`/`dynamicParams`/`runtime` segment exports; wrap runtime reads (`searchParams`, env-dependent data via `connection()`) in `<Suspense>`.
- Run `pnpm check` (lint + typecheck + test) before finishing; `pnpm build` for routing changes.
