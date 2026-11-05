# AI MoMA

**A virtual Museum of Modern Art that is itself a piece of modern art.**

**🏛 Visit the museum: [ai-moma.vercel.app](https://ai-moma.vercel.app/)**

[![CI](https://github.com/WaltXin/ai-moma/actions/workflows/ci.yml/badge.svg)](https://github.com/WaltXin/ai-moma/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

AI MoMA is an open-source, interactive museum you can walk through in your browser. Each
**floor** holds **exhibitions** from a modern art movement: Pop Art, Op & Kinetic Art, and more
as people contribute them. Visitors can:

- 🏛 **Visit**: walk into the museum from the street: through the lobby, up the grand stair,
  round a skylit atrium and through seven floors of galleries (keyboard or tap). Take the
  stairs or the glass lift, and walk up to a painting to see it full-size with its wall label.
- 📚 **Learn**: short, plain-language guides to how each movement worked and why it mattered.
- 🎨 **Create**: upload a photo or write a prompt and have an AI model render it in a
  movement's style (for example, turn your selfie into a Pop Art silkscreen grid).
- 🖼 **Exhibit**: submit what you made. Curators review it and hang it in the Community Gallery.

Some movements need their own way of being seen. A
[Yaacov Agam](https://en.wikipedia.org/wiki/Yaacov_Agam)-style **Agamograph** changes as you
move, so its gallery will respond to your mouse, touch or phone tilt. The platform treats
"how a work is displayed" as something each movement can define.

> Inspired by visits to MoMA in New York and SFMOMA in San Francisco. AI MoMA is an independent
> project and is not affiliated with either museum.

## Status

🚧 **Early skeleton.** What works today:

| Area                                                 | State                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Lobby, floors, exhibitions, learn pages              | ✅ Working, content lives in `src/content/`                                          |
| Walk the building (3D, first person, single player)  | ✅ `/walk` from the lobby, or `/floors/<floor>/walk` by lift; live-composed music    |
| 17 movements, Impressionism → Op Art, on 7 floors    | ✅ 47 public-domain works + 35 code-drawn Studio pieces; every room hangs at least 4 |
| Studio → generate → request exhibition               | ✅ Working end to end with the offline **mock** provider                             |
| Real image models (OpenAI, Google, FLUX, Qwen-Image) | 🔌 Adapter stubs; pick and implement next                                            |
| Agamograph / lenticular viewer                       | ✅ Changes as you walk past, move the pointer, drag or tilt                          |
| Database, object storage, accounts, moderation       | 📝 Planned (submissions are in memory)                                               |

See [docs/ROADMAP.md](docs/ROADMAP.md).

## Quick start

Requires Node 20.9+ (22 recommended, see `.nvmrc`) and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

No API keys needed: the Studio uses the offline `mock` provider by default. To try real
providers later, copy `.env.example` to `.env.local` and fill in keys.

```bash
pnpm test           # unit tests (Vitest)
pnpm lint           # ESLint
pnpm typecheck      # route type generation + tsc
pnpm build          # production build
pnpm check          # lint + typecheck + test
```

## How it's built

| Concern          | Choice                                                                | Why                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework        | **Next.js 16** (App Router, Cache Components) + React 19 + TypeScript | One codebase for static gallery pages (fast, SEO-friendly for education), the interactive Studio, and server API routes that keep model keys off the client. |
| Styling          | Tailwind CSS v4                                                       | Fast to iterate, easy for contributors.                                                                                                                      |
| Image generation | **Provider adapters** behind one `ImageProvider` interface            | Lets us benchmark GPT Image, Nano Banana, FLUX, Qwen-Image and others per movement, and lets self-hosters choose.                                            |
| Validation       | Zod                                                                   | API input and submission schemas.                                                                                                                            |
| Tests            | Vitest                                                                | Content-graph integrity, provider routing, submissions.                                                                                                      |

### Why not Midjourney as the backend?

Midjourney has **no official public API**. The only ways to drive it programmatically are
unofficial wrappers that automate its Discord or web UI, which breaks its Terms of Service and
can get accounts banned. An open-source project can't build on that. The provider layer means
we can add Midjourney in an afternoon if it ever ships an official API.

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project layout

```
src/
  app/                    Routes (Next.js App Router)
    page.tsx              Lobby + floor directory
    floors/[floor]/       A floor and its exhibitions
    walk/                 The whole building in 3D, from the lobby
    floors/[floor]/walk/  The same, arriving by lift on that floor
    exhibitions/[slug]/   One gallery
    learn/                Education pages per movement
    studio/               Generate art, then request an exhibition
    api/generate/         POST: run a generation through a provider
    api/submissions/      POST: request an exhibition
  content/                ← the museum's content (most contributions go here)
    movements/            One file per art movement
    exhibitions.ts        Rooms; historic works are pd("aic" | "cma", id)
    floors.ts
    collection.generated.ts  Written by `pnpm art:fetch`
  lib/
    museum/               Domain types, registry, content validation
    generation/           Provider interface, registry, adapters
    submissions/          Exhibition-request schema + store
    walk/                 The building's plan, stairs, routes, first-person movement, baked light
  components/             Shared UI (artwork frame, placeholders)
    walk/                 three.js building, city, visitors; walk loop; overlays
public/art/               Downloaded public-domain images (zoom/: large copies for looking closely)
scripts/                  `fetch-public-domain-art.mjs`
tests/                    Vitest unit tests
docs/                     Architecture and roadmap
```

## Contributing

Anyone can add a movement, an exhibition, a model adapter or a viewer. Start with
[CONTRIBUTING.md](CONTRIBUTING.md). The most common contribution is a new art movement: one
file in `src/content/movements/` plus a floor entry. Looking for something to build?
[docs/MOMA_CATALOG.md](docs/MOMA_CATALOG.md) lists every movement, form and technique MoMA
collects, and marks which ones are still open.

- 💬 Questions and ideas → [Discussions](https://github.com/WaltXin/ai-moma/discussions)
- 🐛 Bugs, features, new movements → [issue templates](https://github.com/WaltXin/ai-moma/issues/new/choose)
- 🔀 PRs are squash-merged with [Conventional Commit](https://www.conventionalcommits.org/) titles,
  for example `content: add Surrealism movement`
- 🤝 [Code of Conduct](CODE_OF_CONDUCT.md) · 🔒 [Security policy](SECURITY.md) ·
  🛠 [Maintainer guide](docs/MAINTAINING.md)

## Responsible use

- We teach **styles and techniques**, not copies. Don't add copyrighted artworks to the repo,
  and don't write prompts that name a living artist to imitate them.
- Historic works on the walls are **public domain**: released under CC0 by the
  [Art Institute of Chicago](https://www.artic.edu/open-access/open-access-images) and the
  [Cleveland Museum of Art](https://www.clevelandart.org/open-access), by artists who died
  more than 70 years ago. `pnpm art:fetch` refuses anything else. Movements still under
  copyright (Surrealism, Abstract Expressionism, Pop, …) hang original **Studio pieces**
  instead: SVGs drawn with code in the movement's techniques (`src/lib/studio-art/`), never
  copies of a specific work.
- Only upload images you have the right to use. Don't upload other people's photos without
  their consent.
- Generated work shows its provenance (model and provider) on the wall label.

## License

Code is released under the [MIT License](LICENSE). Artwork that visitors generate and submit
keeps whatever rights the visitor and the model provider's terms give it. Exhibition licensing
terms will be defined before public submissions open.
