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
- [ ] 3D model artworks (`model3d` source)

## 4. More of the museum

- [x] 17 movements from Impressionism to Op Art, with public-domain works where they exist
- [x] At least 4 works per room: code-drawn Studio pieces where works are still in copyright
- [ ] Replace code-drawn Studio pieces with benchmarked AI generations
- [ ] Public-domain images for Suprematism & Constructivism and Futurism (few in our sources yet)
- [ ] More movements: Fluxus, Conceptual Art, Land Art, …
- [ ] MDX learn pages with images (public domain or licensed only)
- [ ] Guided tours and audio guides
- [ ] i18n
