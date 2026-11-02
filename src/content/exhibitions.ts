import type { Exhibition } from "@/lib/museum/types";

/**
 * Seed exhibitions. Artworks use `placeholder` sources until real
 * generated pieces are added. Community exhibitions will later be stored
 * in a database rather than in this file.
 */
export const exhibitions: Exhibition[] = [
  {
    slug: "everyday-icons",
    title: "Everyday Icons",
    movement: "pop-art",
    description:
      "Ordinary objects and faces, repeated, saturated and turned into icons by machines and their prompters.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      {
        id: "everyday-icons-1",
        title: "Can, Four Ways",
        artist: "AI MoMA Studio",
        year: 2026,
        medium: "Generated image",
        source: { kind: "placeholder" },
      },
      {
        id: "everyday-icons-2",
        title: "Selfie in Halftone",
        artist: "AI MoMA Studio",
        year: 2026,
        medium: "Generated image",
        source: { kind: "placeholder" },
      },
      {
        id: "everyday-icons-3",
        title: "Notification Blonde",
        artist: "AI MoMA Studio",
        year: 2026,
        medium: "Generated image",
        source: { kind: "placeholder" },
      },
    ],
  },
  {
    slug: "visitor-pop",
    title: "Visitor Pop",
    movement: "pop-art",
    description: "Pop portraits made by visitors in the Studio and submitted for exhibition.",
    curator: "Community",
    kind: "community",
    artworks: [],
  },
  {
    slug: "angles-of-view",
    title: "Angles of View",
    movement: "op-art",
    description:
      "Pieces that change depending on where you stand, including virtual Agamographs that shift as you move your cursor or tilt your phone.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      {
        id: "angles-of-view-1",
        title: "Two Skies",
        artist: "AI MoMA Studio",
        year: 2026,
        medium: "Virtual Agamograph (planned)",
        source: { kind: "placeholder" },
      },
      {
        id: "angles-of-view-2",
        title: "Interference No. 1",
        artist: "AI MoMA Studio",
        year: 2026,
        medium: "Generated image",
        source: { kind: "placeholder" },
      },
    ],
  },
];
