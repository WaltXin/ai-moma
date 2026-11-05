<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AI MoMA project notes

Goal: an open-source virtual museum of modern art. Visitors walk floors, learn each movement, and make AI art that can hang in the Community Gallery. What's next is in `docs/ROADMAP.md`; tick items off there as they ship.

- Read `docs/ARCHITECTURE.md` first. Content lives in `src/content/`; pages read it only via `src/lib/museum/registry.ts`.
- Image generation goes through `ImageProvider` (`src/lib/generation/`). Never call a model API from a page or client component. No Midjourney (no official API).
- Cache Components is on: no `dynamic`/`dynamicParams`/`runtime` segment exports; wrap runtime reads (`searchParams`, env-dependent data via `connection()`) in `<Suspense>`.
- Copyright: never commit a copyrighted artwork. Historic works go in `src/content/exhibitions.ts` as `pd("aic" | "cma", id)`, then run `pnpm art:fetch`. It only downloads CC0 works by artists who died more than 70 years ago. Don't hand-edit `collection.generated.ts`. For movements still in copyright, hang a Studio piece instead: a seeded SVG recipe in `src/lib/studio-art/styles.ts`, made with the movement's techniques but never a copy of a specific work. Use system fonts only, so they render in the walk canvas.
- Every curated room hangs at least 4 works; `tests/museum.test.ts` enforces this.
- The 3D walk: `src/lib/walk/building.ts` turns content into a serializable `Building` (every floor, stairs, lift, rooms, hung works); `src/lib/walk/motion.ts` walks it. `src/components/walk/` raises it in three.js. For layout changes, keep `tests/walk.test.ts` passing; it checks that every work hangs on a wall clear of doors and can be walked to from the front doors.
- Run `pnpm check` (lint + typecheck + test) before finishing; `pnpm build` for routing changes. For UI changes, also check the page in a browser at desktop width and at 390px.
