import type { Movement } from "@/lib/museum/types";

export const popArt: Movement = {
  slug: "pop-art",
  name: "Pop Art",
  period: "1950s–1970s",
  summary:
    "Art that borrowed the language of advertising, comics and mass production, using everyday images as fine art.",
  keyArtists: ["Andy Warhol", "Roy Lichtenstein", "Richard Hamilton", "Claes Oldenburg", "Marisol"],
  techniques: [
    "Ben-Day dots and halftone printing",
    "Silkscreen repetition in grids",
    "Flat, high-saturation color fields",
    "Bold black outlines and comic-panel framing",
  ],
  palette: ["#ff2e63", "#fde047", "#22d3ee", "#111111", "#ffffff"],
  placeholderPattern: "ben-day",
  viewer: "wall",
  learn: [
    {
      heading: "Where it came from",
      body: [
        "Pop Art came out of Britain and the United States after the war, as consumer culture boomed. Artists took soup cans, celebrities, comic strips and billboards and put them in galleries.",
        "That move asked a question that still matters: if an image is reproduced millions of times, what makes one copy art?",
      ],
    },
    {
      heading: "How to recognize it",
      body: [
        "Look for flat colors, hard outlines, repetition, and the visible marks of commercial printing such as halftone dots.",
        "Subjects are familiar on purpose: products, logos, famous faces and comic panels.",
      ],
    },
    {
      heading: "Try it yourself",
      body: [
        "In the Studio, upload a portrait or describe an everyday object. The generator renders it with Pop Art techniques: a repeated grid, posterized color, and Ben-Day dots.",
      ],
    },
  ],
  studio: {
    status: "available",
    inputs: ["prompt", "image"],
    output: "image",
    buildPrompt: (userPrompt) =>
      [
        `Pop Art rendering of: ${userPrompt}.`,
        "Flat high-saturation colors, bold black outlines, visible Ben-Day halftone dots,",
        "silkscreen look, optionally repeated in a 2x2 grid with different color schemes.",
      ].join(" "),
  },
};
