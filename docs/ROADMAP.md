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

- [ ] **Agamograph viewer:** generate N related frames, interleave, respond to cursor, touch and tilt
- [ ] Agamograph studio for Op & Kinetic Art
- [ ] 3D galleries (React Three Fiber): walk a floor, artworks on walls
- [ ] 3D model artworks (`model3d` source)

## 4. More of the museum

- [ ] More movements: Cubism, Surrealism, Abstract Expressionism, Minimalism, Bauhaus, Fluxus, …
- [ ] MDX learn pages with images (public domain or licensed only)
- [ ] Guided tours and audio guides
- [ ] i18n
