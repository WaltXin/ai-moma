# Architecture

## Domain model

```
Museum
 ├─ Floor (level, name)            src/content/floors.ts
 │   └─ Exhibition (curated | community)   src/content/exhibitions.ts
 │       └─ Artwork (placeholder | image | model3d, + provenance)
 └─ Movement                       src/content/movements/*.ts
     ├─ learn    → education sections
     ├─ studio   → inputs, output type, prompt template, status
     └─ viewer   → wall | agamograph | room3d
```

Types live in `src/lib/museum/types.ts`. Pages never import `src/content` directly. They go
through `src/lib/museum/registry.ts`, so content can later move to a database without UI
changes.

`validateMuseum()` checks the content graph (unique slugs, no dangling references, every
exhibition on exactly one floor). It runs in the test suite, so a broken contribution fails CI.

## Rendering

Next.js 16 with **Cache Components** (`cacheComponents: true`) and Partial Prefetching:

- Lobby, floor, exhibition and learn pages are prerendered at build time (`generateStaticParams`).
- `/studio` is a partial prerender. The static header ships right away, and the form streams
  in after `connection()`, because the list of providers depends on runtime env vars.
- `/api/generate` and `/api/submissions` are dynamic POST route handlers.
- Unknown slugs call `notFound()`. Pages stream, so the 404 UI renders with
  `noindex`, but the HTTP status stays 200.

> Next.js 16 differs from older versions: `params`/`searchParams` are Promises,
> `dynamic`/`dynamicParams`/`runtime` segment exports are not allowed with Cache Components,
> and `PageProps<'/route'>` is a global type. The bundled docs in `node_modules/next/dist/docs/`
> are the reference.

## Generation pipeline

```
Studio form ──multipart──▶ POST /api/generate
                              │  validate upload (png/jpeg/webp, ≤ 8 MB)
                              ▼
                        generateArtwork()            src/lib/generation/generate.ts
                              │  movement exists & studio open?
                              │  inputs allowed by movement + provider?
                              │  prompt = movement.studio.buildPrompt(userPrompt)
                              ▼
                        resolveProvider()            src/lib/generation/registry.ts
                              │  request → IMAGE_PROVIDER → "mock"
                              ▼
                        ImageProvider.generate()     src/lib/generation/providers/*
                              ▼
                        { imageUrl, mimeType, provider, model }
```

`ImageProvider` is deliberately small: `id`, `label`, `capabilities` (text→image,
image→image), `isConfigured()` (env vars present), and `generate()`.

| Provider id | Covers                                                              | Status |
| ----------- | ------------------------------------------------------------------- | ------ |
| `mock`      | Offline SVG: Ben-Day poster, or a 2×2 posterized grid of the upload | ✅     |
| `openai`    | GPT Image family                                                    | stub   |
| `google`    | Nano Banana / Gemini image family                                   | stub   |
| `bfl`       | FLUX (Black Forest Labs API)                                        | stub   |
| `qwen`      | Qwen-Image (open weights, self-hosted or any hosted endpoint)       | stub   |

Model choice per movement is an open question. Benchmarking candidates is on the roadmap,
and the adapter layer exists so that decision can change cheaply.

### Midjourney

Not supported. There is no official public API, and automating its Discord or web UI breaks
its Terms of Service. If an official API ships, add `providers/midjourney.ts`.

### Results today

Results come back as `data:` URLs. That's fine for a skeleton but too heavy for a real
gallery. The next step is to upload results to object storage (S3/R2) and return a URL.

## Submissions

`POST /api/submissions` validates with Zod and stores a `pending` request through the
`SubmissionStore` interface. The current implementation is in memory, one per server process,
and is lost on restart. There is no public read endpoint on purpose, because pending work is
unmoderated.

## Viewers

`Movement.viewer` says how a movement's works should be shown. Only `wall` is rendered today.
Planned:

- **`agamograph`**: interleave 2–N frames and pick the visible frame from cursor X, touch
  drag or `DeviceOrientationEvent`. Could be a client component with canvas or CSS strips.
- **`room3d`**: React Three Fiber scene for walk-through galleries and 3D model artworks.

## Decisions pending

| Decision                         | Leaning                                                                 |
| -------------------------------- | ----------------------------------------------------------------------- |
| Database                         | Postgres + Drizzle (SQLite for local dev)                               |
| Object storage                   | S3-compatible (Cloudflare R2 / S3)                                      |
| Auth (for submitters & curators) | Auth.js or a hosted provider                                            |
| Moderation                       | Provider safety filters + an image moderation API + human curator queue |
| Rate limiting / cost control     | Per-IP and per-user quotas before any paid provider is public           |
| Learn content format             | Move from TS strings to MDX once pages grow                             |
