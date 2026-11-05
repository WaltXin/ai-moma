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

## Walkable floors

`/floors/[floor]/walk` is the floor in 3D: you walk through it in first person, like a visit to
a real museum. It's prerendered like the other floor pages:

```
floor content ──▶ buildFloorPlan()          src/lib/walk/floor-plan.ts   (server, pure)
                    tiles (1 tile = 1 m), rooms, artwork positions, elevator
              ──▶ <WalkableFloor plan>      src/components/walk/walkable-floor.tsx  (client)
                    rAF walk loop, keyboard / drag-to-look / click-to-walk / touch stick,
                    overlays: artwork viewer, room info, elevator
                    │  movement, collisions, routes, "what am I facing"
                    │    src/lib/walk/motion.ts   (pure, tested)
                    ▼
                  createMuseumScene()       src/components/walk/scene.ts   (three.js, loaded on demand)
                    walls raised from the tiles, framed paintings under light pools,
                    wall labels and room lettering (textures.ts), lift, lounge, avatar
```

- The scene is built from the plan, never modelled by hand, and paints its walls in the floor's
  color. three.js is imported dynamically, so the page shell and header arrive first.
- Controls: drag to look; WASD / arrows (left/right turn); click the floor to walk there; click
  a painting to walk up to it; E opens what you're facing; scroll, pinch or V steps the camera
  back to show your avatar. Phones get a thumb stick. Without WebGL the page links to the guide.
- A visit starts in the lift. "Enter" (the click browsers need before playing sound) starts the
  audio; the doors open and the visitor steps out. Taking the lift fades to black and arrives on
  the next floor the same way, without the welcome. Any key or tap skips the walk out.
- Sound (`components/walk/audio.ts`, Web Audio, no audio files): a generative score in each
  floor's mood (`lib/walk/music.ts`: scale, chords, tempo, density), a low building hum,
  footsteps on oak or terrazzo (`surfaceAt()`), and the lift's chime and doors, panned to where
  they are, all in one reverb. One engine lives for the visit, so floors crossfade. M or the
  Sound button mutes it (remembered in `localStorage`); a painting up close muffles the music.
- In development, `window.__walk` holds the walk state and `window.__audio()` the audio engine,
  so scripts can move the visitor and check the sound.

- One room per exhibition, left to right in the floor's walking order, with paintings on the
  room's back wall. Adding an exhibition to `floors.ts` adds a room; nobody draws maps by hand.
- Every floor ends in a lounge (windows, sofas), widened on small floors so the map is always
  at least 56 tiles wide.
- The plan is plain JSON, so it can later be shared with a realtime server for multiplayer
  presence without changing the layout code.
- The list pages stay as the accessible, indexable version of each floor.
- A floor can swap its map for a hands-on lab. Floor 7 (`perception`) does: `/floors/perception/walk`
  renders `<PerceptionLab>` (`src/components/perception/`), four stations where the visitor makes an
  optical effect happen and then sees how it works. Add a slug to `FLOOR_LABS` to give another floor
  its own lab. Its floor plan is still built, so `tests/walk.test.ts` keeps checking it.

## Public-domain collection

Historic works come from museum open-access APIs, never from scraping:

```
exhibitions.ts: pd("aic", 27992) ──▶ pnpm art:fetch ──▶ public/art/aic-27992.jpg
                                        │                 src/content/collection.generated.ts
                                        └─ refuses unless the museum marks it CC0/public domain
                                           AND every artist died > 70 years ago
```

`pd()` throws if a work hasn't been fetched, and `validateMuseum()` requires a credit on every
collection image. Sources: Art Institute of Chicago (`aic`) and Cleveland Museum of Art (`cma`).

## Rendering

Next.js 16 with **Cache Components** (`cacheComponents: true`) and Partial Prefetching:

- Lobby, floor, walk, exhibition and learn pages are prerendered at build time (`generateStaticParams`).
  Pages that read `params` do it inside `<Suspense>` with `<WallFallback>`, so client navigations
  are instant: the visitor's current wall stays up while the next page streams in, then
  `<WallRepaint>` eases the colors over. Direct visits still get the whole prerendered page.
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

`Movement.viewer` says how a movement's works should be shown.

- **`wall`**: flat on the wall.
- **`agamograph`** ✅: artworks with a `lenticular` source carry 2–N frames. On a walkable
  floor, the 3D scene turns from one view to the next as the visitor walks past
  (`lenticularView()`). Elsewhere, `<Agamograph>` (`src/components/agamograph.tsx`)
  does the same with CSS masks, driven by pointer X, touch drag, phone tilt
  (`DeviceOrientationEvent`, with the iOS permission prompt) or a slider.
- **`room3d`** (planned): 3D model artworks, hung in the three.js walk (`components/walk/scene.ts`).

## Studio pieces drawn with code

Rooms whose historic works are still under copyright hang original pieces made by recipes in
`src/lib/studio-art/` (seeded, deterministic SVG: Fauve harbors, Constructivist posters,
Op Art moiré, Agamograph views, …). Content declares them with
`studio(id, title, recipe)`; `/studio-art/<id>.svg` (and `<id>.f<n>.svg` for each view)
is a Route Handler prerendered with `generateStaticParams`. They are stand-ins until
visitors' AI-generated work is hung.

## Decisions pending

| Decision                         | Leaning                                                                 |
| -------------------------------- | ----------------------------------------------------------------------- |
| Database                         | Postgres + Drizzle (SQLite for local dev)                               |
| Object storage                   | S3-compatible (Cloudflare R2 / S3)                                      |
| Auth (for submitters & curators) | Auth.js or a hosted provider                                            |
| Moderation                       | Provider safety filters + an image moderation API + human curator queue |
| Rate limiting / cost control     | Per-IP and per-user quotas before any paid provider is public           |
| Learn content format             | Move from TS strings to MDX once pages grow                             |
