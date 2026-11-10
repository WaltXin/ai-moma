# Roadmap

Rough order. Each item is a good first PR area.

## 0. Skeleton ✅

- [x] Next.js app with lobby, floors, exhibitions, learn pages
- [x] Movement / exhibition / floor content model with integrity validation
- [x] Provider-agnostic generation API with an offline mock provider
- [x] Studio: prompt or photo → generate → request exhibition
- [x] CI: lint, typecheck, test, build

## 1. Real generation

- [ ] **Benchmark models per movement.** Candidates: GPT Image 2.x, Nano Banana 2.x,
      FLUX.2, Qwen-Image-2512, and others. Compare style fidelity, image-to-image quality,
      identity preservation for portraits, latency, cost, and licensing.
- [ ] Implement the winning adapter(s) in `src/lib/generation/providers/`
- [ ] Object storage for uploads and results (replace `data:` URLs)
- [ ] Rate limiting and cost caps
- [ ] Safety: provider filters + upload moderation (faces, minors, NSFW)

## 2. Exhibitions for real

- [ ] Database for exhibitions, artworks and submissions
- [ ] Curator review queue (approve → hang in Community Gallery)
- [ ] Accounts for submitters and curators
- [ ] Licensing terms for submitted work

## 3. Interactive viewers

- [x] **Agamograph viewer:** N frames, interleaved strips, responds to walking, cursor, touch and tilt
- [ ] Agamograph studio for Op & Kinetic Art
- [x] Walkable floors: keyboard + tap to walk, elevator, artwork viewer
- [x] Perception Lab on Floor 7: hands-on stations for Agamograph folds, moiré, distorted grids and apparent motion
- [ ] Multiplayer presence on walkable floors (see other visitors, emoji reactions)
- [x] Lounge at the end of every floor, so small floors don't look empty
- [ ] Minimap and "you are here" on walkable floors
- [x] 3D galleries: walk a floor in first person (or step back to see yourself), lit paintings on the walls, lift doors that open
- [x] Sound: generative music in each floor's mood, footsteps, the lift's chime; arrive by lift
- [x] One real building: enter from the street, lobby with grand stair, a skylit atrium with stairs across it and a glass lift, enfiladed galleries, a sculpture terrace with a living wall, other visitors
- [x] Up close: a painting grows off the wall into a full-screen viewer you can zoom into, brushstroke by brushstroke
- [x] Baked light: laylights, downlights, windows and the atrium's skylight traced round every floor, with two bounces
- [x] Plasterwork: painted plaster walls, cornices and skirtings throughout; pilasters, arched
      panels and cased doorways in the lobby and the atrium; room names over their doorways
- [x] Step into a painting: _The Starry Night_ as a hill you walk and sit on, under a sky that keeps moving
- [x] Thick paint: the Starry Night sky's strokes stand up off the canvas, lit from the moon's side
- [x] Thick paint on the land too: hills, village, trees and cypress built from the same raised
      strokes as the sky, in the painting's greens, ochres and teal
- [x] A world kit (`src/components/worlds/kit.ts`) and a standard every world meets
      (`docs/ARCHITECTURE.md`), so any painting can be raised like the Starry Night
- [x] Second world: _Wheat Field with Cypresses_, wading through the wheat under turning clouds
- [x] Third world: _Sunflowers_, with the visitor made small: walk the table under fifteen
      sunflowers as big as trees, every one at its own stage of life
- [ ] More painting worlds (public domain only): Seurat's Grande Jatte (dots; but it's full of
      people), Monet's water lilies (water and reflections are new)
- [ ] Paint the Starry Night village's trees with raised strokes too, as the Wheat Field's bushes are
- [ ] A world from your own photo: a moment you loved, rebuilt in a movement's style (the Studio, but walkable)
- [ ] Real visitors in a world, quietly: see who else is sitting on the hill right now (no made-up ones)
- [ ] VR for the most-loved worlds (WebXR)
- [ ] Guided looking: an expert's tour through one painting, zooming to each detail as they explain it
- [ ] Day and night: follow the clock past opening hours (the building keeps daylight hours for now)
- [ ] Better performance on low-end phones (merge visitors, lower-detail far floors)
- [ ] 3D model artworks (`model3d` source)

## 4. More of the museum

- [x] 17 movements from Impressionism to Op Art, with public-domain works where they exist
- [x] At least 4 works per room: code-drawn Studio pieces where works are still in copyright
- [ ] Replace code-drawn Studio pieces with benchmarked AI generations
- [x] Two more open-access sources: The Met (`met`) and the National Gallery of Art (`nga`)
- [ ] Public-domain images for Suprematism & Constructivism and Futurism (none famous yet in
      AIC, CMA, the Met or NGA; try the Rijksmuseum or Smithsonian Open Access)
- [ ] Deep zoom: serve NGA and Met originals as IIIF tiles instead of a 3000 px copy
- [ ] More movements: Fluxus, Conceptual Art, Land Art, … See
      [MOMA_CATALOG.md](MOMA_CATALOG.md) for every movement, form and technique MoMA collects,
      with what's still open
- [ ] More forms beyond painting: photography, books, sculpture and design, video, sound,
      performance, software (see [MOMA_CATALOG.md](MOMA_CATALOG.md#good-first-picks))
- [ ] MDX learn pages with images (public domain or licensed only)
- [ ] Guided tours and audio guides
- [x] Hands-on station for Neo-Impressionism: paint with dots, step back to watch them mix,
      read what you used (opposites touching, sun and shade from across the room), ask to hang it
- [ ] A hands-on station for every movement (Fauvism's arbitrary colour, Cubism's many
      viewpoints, De Stijl's grid and primaries, …)
- [ ] Keep what visitors make: store requests and images (they're in memory now), a curator
      queue, and approved work hung in the Community Gallery in the walk
- [ ] i18n
