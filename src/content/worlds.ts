import type { PaintingWorld } from "@/lib/museum/types";

/**
 * Paintings you can step into. Each one's scene lives in
 * `src/components/worlds/` and its layout in `src/lib/worlds/`. Only
 * paintings in the public domain, and never built from a photograph of the
 * work: the world is drawn with code, after the painting.
 *
 * Painting worlds are the idea of the artist Liya Tian, made with Walt Xin.
 */

/** The two who made the first world together. */
const LIYA_AND_WALT = [
  { name: "Liya Tian", url: "https://www.linkedin.com/in/liya-tian" },
  { name: "Walt Xin", url: "https://github.com/WaltXin" },
];
export const worlds: PaintingWorld[] = [
  {
    slug: "starry-night",
    title: "The Starry Night",
    artist: "Vincent van Gogh",
    year: 1889,
    heldBy: {
      institution: "The Museum of Modern Art, New York",
      url: "https://www.moma.org/collection/works/79802",
    },
    movement: "post-impressionism",
    room: "color-and-structure",
    creators: LIYA_AND_WALT,
    intro:
      "June 1889, the hill outside Saint-Rémy before dawn. The village is asleep, the cypress burns black against the sky, and the sky won't keep still. Walk the hill, or sit in the grass and look up.",
  },
];
