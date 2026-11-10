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
              mouldings.ts      cornices, skirtings, casings, pilasters and arched panels,
                                placed by src/lib/walk/trim.ts   (pure, tested)
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
  Walls are smoothed more along than up (blotches show on plaster; the darkening at the floor
  is real), and `tests/light.test.ts` checks a plain wall stays even.
  In development, `window.__light.force(0 | 1)` switches it off and on to compare.
- **Audio guides.** Open a work and listen, or read along, in English, French or Chinese.
  Scripts and their sources are in `src/content/guides.ts`, written to the standard in
  [AUDIO_GUIDES.md](AUDIO_GUIDES.md). `pnpm guides:voice` records each one once (Cartesia,
  one request at a time) into `public/guides/`; the walk fetches a work's guide from
  `/api/guides/[id]` (prerendered) and plays the file. A recording made from an older script
  is never served.
- **Plasterwork.** Walls are painted plaster: a faint tint and roller texture tiled every 2 m
  (`plaster()` in `textures.ts`). `lib/walk/trim.ts` plans the mouldings on every face: the
  galleries get a quiet cove and skirting, so the art leads; the lobby and the atrium get an
  old stair hall's: a deep cornice, cased doorways, and pilasters with blind arches between
  them, clear of doorways, room names, the floor's name and the grand stair (checked in
  `tests/walk.test.ts`). `mouldings.ts` sweeps each profile along its path, mitred at the
  corners, and takes its light from the wall's own bake.
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
- A movement can have a hands-on station: try its technique, see why it works, keep what you
  made. Neo-Impressionism does: `/studio/neo-impressionism` ("Paint with dots": mix two colours
  in the eye, then paint a lawn in sun and shade and read what you used). Its kiosk text lives
  in `src/content/stations.ts`, its page body in `src/components/stations/pages.tsx`, and the
  colour science in `src/lib/stations/dots.ts`; the walk puts a kiosk inside the movement's
  room, opposite the lectern. What a visitor keeps goes to the same exhibition request as the
  Studio's (`/api/submissions`).

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
world you walk round and sit in, alone with it: no made-up visitors wander about.
Nothing in it can be touched. Painting worlds are the idea of the artist
[Liya Tian](https://www.linkedin.com/in/liya-tian), who makes them with Walt Xin: people love to
sit and stare in museums, so give a few paintings a place to do that inside them. Each world
can credit its makers (`creators` in `src/content/worlds.ts`, optional) on the way in and under
it; only The Starry Night does.

```
src/content/worlds.ts                 PaintingWorld: title, artist, year, where the real one hangs, its room here
src/lib/worlds/<slug>.ts              the layout as data, and its WorldPlace: start, ground, bounds, music, air
src/lib/worlds/place.ts               WorldPlace, and where a visitor walks in from (`arrivalOf`)
src/lib/worlds/places.ts              every world's place, by slug
src/components/worlds/brush.ts        painters: a sky panorama, any surface, brushwork tiles, relief → normal maps
src/components/worlds/kit.ts          the world kit: stage, painted sky, ground, grass, ridges, flame trees, bushes
src/components/worlds/<slug>-scene.ts a world's scene: the kit's pieces, plus what only it has
src/components/worlds/scenes.ts       every world's scene, by slug, loaded on demand
src/components/worlds/world-view.tsx  walking, sitting, sound and controls, the same for every world
```

### How a world is painted

Everything in a world is made of paint strokes, laid one by one on canvases at load time, and
each painter also draws the strokes on a height map, as raised ridges with the grooves the
bristles left. Lit, the paint stands up off the canvas like impasto.

- **Sky** (`addSky`, `paintSky`): one panorama of tens of thousands of short strokes following
  a flow field (a rolling wave bent round each vortex, ringed round each light; `flowAround`
  in `src/lib/worlds/sky.ts`). A `SkySpec` gives its colours, where it's paler (`swirlAt`)
  and its lights (stars, a moon, a sun) with their rings, cores and glows. A shader lights
  the relief and keeps the strokes sliding along the flow, so the sky never stops moving.
- **Ground** (`addGround`, `paintSurface`): a height field painted from above, its strokes
  following a world's own flow (for the Starry Night hill, its contours: `landFlow`) in a
  `LandPaint` of its colours. A finer canvas covers where the visitor walks, and a fine tile
  of bristle marks fades in near them, so the paint still looks like paint at their feet.
- **Grass** (`addGrass`): tufts of curved, raised blades standing up out of the ground's
  paint wherever a world's own `densityAt` lets them, each blade one colour, bigger and fewer
  far off. They lean downwind and bow as gusts cross the hill (in the vertex shader). Near
  blades sliding past far ones is most of what tells the eye it's walking through a place.
- **Ridges** (`addRidges`): hills ridge behind ridge, each painted along its own line,
  lighter at the rim, in shadow lower down, with a dark line on top.
- **Flame trees** (`addFlameTree`): a cypress as tongues of flame twisting up round one
  another, covered in a few thousand curved, raised strokes, swaying.
- **Bushes** (`addBushes`): bumpy lumps drawn up into a point, painted, outlined in ink, and
  (with `strokes`) covered in raised strokes flicking upward. With `trunk`, a bush is a tree:
  its leaves held up on a leaning stem, so the land shows under them.

Each builder gives the page a breath (`breathe`) before it starts and every so often as it
works, so no piece of a world holds the main thread for long.

Custom shaders go through `customize`, which gives each its own program cache key: three.js
otherwise shares one program between materials changed by the same helper, so a second tree
or a waving wheat field would silently draw with the first one's shader.

Height maps become normal maps (`reliefToNormals`), so paint keeps its relief at any distance.
Painters lay a few thousand strokes at a time and then let the page breathe (`breathe`), so
the welcome stays responsive while a world is painted.

The first world is _The Starry Night_ (`starry-night`): a hill above a sleeping village, its
cypress, and the night sky with eleven stars and the moon. The hilltop is somewhere to walk:
grass (`grassAt`) bowing in the wind, the dark bushes the cypress rises from, five olives
behind the visitor and out to the sides (their stems are in a walker's way, their leaves
overhead), and fireflies drifting over the grass. Down in the village the trees are covered
in raised strokes metres long, the houses have chimneys, and the light at the windows
wavers. The second, _Wheat Field with
Cypresses_ (`wheat-field-with-cypresses`), is built on the same kit: a summer sky of cream
clouds (`cloudAt`, painted with bigger strokes, as much behind the visitor as in front), the
Alpilles as ridges, two flame trees, an olive and green bushes covered in raised strokes
(`addBushes` with `strokes`), poppies in the grass, and one piece of its own: the wheat, a
painted surface standing hip-high over the ground and waving in the wind, that the visitor
wades through.

The third, _Sunflowers_ (`sunflowers`), is a still life, so it makes the visitor small: the
yellow table is the ground (a painted wall of crosshatching behind it, a long drop at its front
edge), the jug stands 28 m tall, and fifteen sunflowers hang overhead at their own stages of
life (`FLOWERS`: in bloom, open, wilting, gone to seed). Everything raised is one mesh of
stroke ribbons (`strokeRibbons`, `strokeMaterial`): the jug's glaze in vertical strokes with
its blue line and signature, each seed head a spiral of thick dabs, each petal three strokes
side by side (its colour, a lighter edge, a darker ochre one), leaves, and petals fallen on
the table. Colours given as 0–255 sRGB go through `setRGB(…, SRGBColorSpace)`: handed to
`new THREE.Color(r, g, b)` they're taken as linear and come out washed pale.

### Adding a world

1. Add the painting to `src/content/worlds.ts` (public domain only; `validateMuseum()` checks
   its movement and room, and a room links to its worlds with `getWorldsForRoom`).
2. Write its layout as data in `src/lib/worlds/<slug>.ts`, with a `WorldPlace`, and add it to
   `PLACES`. Test it in `tests/worlds.test.ts`.
3. Write `src/components/worlds/<slug>-scene.ts` from the kit, and add it to `SCENES`.
4. Hold it to the standard below, and check it in a browser at desktop width and at 390 px.

### The standard every world meets

- **All paint.** Every surface is strokes with relief, never a smooth, flat-shaded mesh.
- **His strokes.** Strokes run the way the painter's run (the swirls, the contours, the waves
  of the wheat), at the size he made them, in the painting's own palette.
- **No black shadows.** What faces away from the light keeps its colour (`glowInShade`), as
  in a painting.
- **Up close too.** At the visitor's feet the paint still reads as paint (`withBristles`).
- **Nothing copied.** No image of the painting is used, not even a public-domain one, and
  only public-domain paintings get a world.
- **Light on a phone.** About 2 s to build on a desktop and 60 fps; on a phone (4× CPU
  throttle) no single block of the main thread longer than about 0.6 s.

**No photograph of the painting is used**, not even a public-domain one. The world is an
interpretation drawn with code, and the welcome says where the real painting hangs. Only
public-domain paintings get a world. A room links to its worlds (`getWorldsForRoom`), and
`validateMuseum()` checks that each world's movement and room exist.

**Walking like a person** (`world-view.tsx`, the same in every world). A visitor comes in a
few steps behind where they'll stand (`arrivalOf`) and walks the rest, so they arrive on foot;
any key or tap takes over. They gather speed and lose it instead of starting and stopping
dead, slow over the last steps to where they tapped, and with each step the head rises and
falls, leans toward the standing foot and tips a little; the view follows the hand a moment
behind, and they breathe when still. Each footfall is heard where the place says what's
underfoot (`footing`). With `prefers-reduced-motion` the view holds steady and they start
where they'll stand.

**The air.** A place can say what its air sounds like (`air`: wind, crickets, a bell): wind
in gusts, crickets trilling and resting on either side, and now and then a few strokes of a
bell from far off (`MuseumAudio.air`, made live like the rest of the sound). A world with air
is out in the open (`setPlace("open")`): no building's hum, no murmur of other visitors. A
`vignette` colour darkens the corners of the view.

**Quiet controls.** Sitting, or in full screen, the title and buttons fade after a few seconds
(2.5 s in full screen, 4 s sitting), and the cursor hides. Moving the mouse, tapping or pressing
a key that isn't for walking brings them back; dragging to look and walking don't. While hidden
they can't be pressed, so the first tap only shows them.

**Requests.** Under every public-domain painting in a room, "Request this world" opens the
`4-world_request.yml` issue form on GitHub, filled in with the painting (`src/lib/worlds/request.ts`),
so requests are public, can be upvoted, and wait for a contributor to build them.

**Full screen on phones.** Where the browser allows it (Android, desktop, iPad), "Full screen"
uses the Fullscreen API. iPhone Safari only allows that for video, so there the world covers
the whole page instead. Added to the home screen (`app/manifest.ts`, `appleWebApp` in the
root layout), the museum opens with no Safari bars at all. iPhone also silences web audio
when the ring switch is on silent, so the audio engine asks for a "playback" audio session
(Safari 16.4+) whenever sound is on.

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
