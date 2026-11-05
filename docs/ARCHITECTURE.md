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

## Walking the building

`/walk` is the museum in 3D: you come in through the front doors and walk it in first person,
like a visit to a real museum. `/floors/[floor]/walk` is the same building, arriving by lift on
that floor. Both are prerendered:

```
content ──▶ buildBuilding()            src/lib/walk/building.ts     (server, pure)
              every floor stacked round an atrium, walls with doors and windows,
              rooms filled in walking order, works hung round their walls,
              stairs, the lift, furniture, the street outside
        ──▶ <WalkableBuilding>          src/components/walk/walkable-building.tsx  (client)
              rAF walk loop, keyboard / drag-to-look / click-to-walk / touch stick,
              the welcome, the look up the atrium, lift rides; overlays
              │  collisions, stairs, routes across floors, "what am I facing"
              │    src/lib/walk/motion.ts   (pure, tested)
              ▼
            createMuseumScene()         src/components/walk/scene.ts   (three.js, loaded on demand)
              architecture.ts   walls with reveals, floors with baked soft shadows, laylights,
                                slab edges and glass balustrades, stairs, the glass lift,
                                the rippled façade, the oculus
              bake.worker.ts    the light round every floor, traced off the main thread
                                  src/lib/walk/light.ts   (pure, tested)
              furnishing.ts     paintings under their spots, labels, lecterns, furniture,
                                lettering, kiosks, sun through the windows
              city.ts           sky with clouds, the street and its traffic, the city round it
              people.ts         other visitors walking, looking, sitting
```

- **The plan.** One plan for every floor: wings of rooms west and east of a ring round the
  atrium, a core with the floor's name on it to the north, a lounge on the street side. The
  ground floor is the lobby: front doors, information desk, café, store, the Community Gallery
  and the Studio, and a grand oak stair to Floor 2. Above it, flights zigzag across the atrium
  from floor to floor and a glass lift rides up its west side. Floor 5 opens onto a sculpture
  terrace with a living wall; the floors above step back from it. The design takes its spirit
  from big modern museums (a skylit atrium, a wide stair to sit on, a rippled white façade)
  without copying any real building.
- **Rooms.** Exhibitions fill the rooms in walking order (down the west wing, across, up the
  east). Rooms in a wing open into each other on one axis, so you see through three at once.
  A floor with fewer exhibitions than rooms gets lounges and reading rooms; adding an exhibition
  to `floors.ts` fills the next room. A floor with too many throws at build time.
- **Hanging.** Works go round a room's walls, clear of doorways, spread so no wall is crowded
  while another is bare, in order from the door. `tests/walk.test.ts` checks every work hangs on
  its room's wall and can be walked to from the front doors, up the stairs if need be.
- **Stairs.** A stair belongs to the floor below for its lower half and the floor above for its
  upper half; halfway up, the visitor changes floor. Routes (`route()`) search every floor's
  walkable cells joined at the stairs, so a click on a balcony across the atrium walks you
  there.
- **Drawing.** Static geometry is merged per material per floor; floors you can't see aren't
  drawn, and paintings and other visitors only near you. Pictures load for your floor and the
  floors either side. Exposure adapts: brighter in the galleries, stopped down in the street.
  The sun follows the time of day, within opening hours.
- **Baked light.** `lib/walk/light.ts` traces how light gets round each floor: from the
  laylights over the galleries, the downlights elsewhere, the windows and the atrium's skylight,
  then two bounces off the walls, floors and ceilings (in their own colours, toned down). So
  walls darken towards the floor and into corners, floors fall off away from the laylights, and
  a bright room spills through its doorway. Each floor's walls get a rectangle in a small atlas
  (`lightLayout()`), its floor and ceiling a plan; `bake.worker.ts` bakes the visitor's floor
  first, then the rest, in about a second each. The bake is relative light per kind of surface
  (1 = a gallery's typical wall, floor or ceiling): the shader multiplies it into the surface's
  colour (and dims the floor's reflections by it) instead of adding light, so the scene's own
  lights still balance floors against walls, and furniture, paintings and visitors keep them.
  It fades in over the old vertex shading as it arrives. Phones bake coarser, with one bounce.
  In development, `window.__light.force(0 | 1)` switches it off and on to compare.
- **Controls.** Drag to look; WASD / arrows; click the floor (any floor) to walk there; click a
  painting to walk up to it; E opens what you're facing; F opens the floor directory; scroll,
  pinch or V steps the camera back to show your avatar.
- **Up close.** Opening a painting (E, or clicking it once you're in front of it) grows it out
  of its place on the wall into a full-screen viewer (`components/zoom-image.tsx`) with its
  label beside it: scroll, pinch or double-click to zoom right into the large copy, drag to look
  around, ← → for the next work on the wall; Escape shrinks it back onto the wall
  (`scene.artRect()` says where it hangs on screen). Studio pieces zoom from their own SVG.
  Standing in front of a painting also swaps its texture in the walk for the large copy. Phones get a thumb stick. Without WebGL
  the page links to the floor guides.
- **Sound** (`components/walk/audio.ts`, Web Audio, no audio files): a generative score in each
  floor's mood and a lobby mood downstairs (`lib/walk/music.ts`); footsteps on oak, stone,
  decking or pavement; a long echo in the atrium, a murmur of voices, traffic outside and the
  car going by; the lift's chime and doors. M or the Sound button mutes it.
- In development, `window.__walk` holds the walk state, `window.__building` the plan,
  `window.__audio()` the audio engine and `window.__renderer` the renderer (draw calls), so
  scripts can move the visitor and check what's drawn.
- The building is plain JSON, so it can later be shared with a realtime server for multiplayer
  presence.
- The floor pages stay as the accessible, indexable version of each floor.
- A floor can also have a hands-on lab. Floor 7 (`perception`) does: `/floors/perception/walk`
  renders `<PerceptionLab>` (`src/components/perception/`), and in the building a kiosk in the
  Perception Lab room leads there. Add a slug to `FLOOR_LABS` to give another floor its own lab.

## Public-domain collection

Historic works come from museum open-access APIs, never from scraping:

```
exhibitions.ts: pd("aic", 27992) ──▶ pnpm art:fetch ──▶ public/art/aic-27992.jpg       (843 px, the wall)
                                        │                 public/art/zoom/aic-27992.jpg  (≤ 3000 px, up close)
                                        │                 src/content/collection.generated.ts
                                        └─ refuses unless the museum marks it CC0/public domain
                                           AND every artist died > 70 years ago
```

`pd()` throws if a work hasn't been fetched, and `validateMuseum()` requires a credit on every
collection image. The zoom copy is the largest the museum serves to anyone (AIC's IIIF server
stops at 3000 px; CMA's "print" image), re-encoded with `sharp` to about a megabyte. Works whose
museum has nothing much bigger than the wall image get no zoom copy.

| Source | Museum                         | Metadata                                                                  | Images                                                                                    |
| ------ | ------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `aic`  | Art Institute of Chicago       | JSON API                                                                  | IIIF, up to 3000 px                                                                       |
| `cma`  | Cleveland Museum of Art        | JSON API                                                                  | "web" and "print" JPEGs                                                                   |
| `met`  | The Metropolitan Museum of Art | JSON API                                                                  | The original (often 4000–8000 px), cut down to both copies; its web image is only ~600 px |
| `nga`  | National Gallery of Art        | Daily CSV exports on GitHub, cached in `node_modules/.cache/ai-moma/nga/` | IIIF, originals often 10,000 px or more                                                   |

Images of works no longer in `exhibitions.ts` are deleted from `public/art/`.

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

## Painting worlds

Some paintings can be stepped into: `/worlds/<slug>` raises the painting's place as a small
world you walk round and sit in, while other visitors stand and sit nearby, part of the scene.
Nothing in it can be touched. The idea came from an artist: people love to sit and stare in
museums, so give a few paintings a place to do that inside them.

```
src/content/worlds.ts          PaintingWorld: title, artist, year, where the real one hangs, its room here
src/lib/worlds/<slug>.ts       the layout as data: ground, sky swirls, stars, village, cypress, where visitors linger
src/components/worlds/         the scene (three.js), its brushwork (canvas), and WorldView (controls, sit, sound)
```

The first is _The Starry Night_ (`starry-night`). Its sky is one panorama painted on a canvas
at load time: about 70,000 short strokes, each following a flow field (a rolling wave bent
round each vortex and ringed round each star). A shader keeps the strokes sliding along that
flow, so the sky never stops moving. The hills, houses and cypress are lit meshes painted
with tiles of brushwork.

**No photograph of the painting is used**, not even a public-domain one. The world is an
interpretation drawn with code, and the welcome says where the real painting hangs. Only
public-domain paintings get a world. A room links to its worlds (`getWorldsForRoom`), and
`validateMuseum()` checks that each world's movement and room exist.

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
