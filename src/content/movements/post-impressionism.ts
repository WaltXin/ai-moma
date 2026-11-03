import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const postImpressionism: Movement = {
  slug: "post-impressionism",
  name: "Post-Impressionism",
  period: "1886–1905",
  summary:
    "Artists who came after Impressionism and pushed past it, toward structure, symbol and emotional color.",
  keyArtists: [
    "Paul Cézanne",
    "Vincent van Gogh",
    "Paul Gauguin",
    "Henri de Toulouse-Lautrec",
    "Georges Seurat",
  ],
  techniques: [
    "Expressive color that doesn't copy nature",
    "Thick paint and directional strokes",
    "Building form from planes of color",
    "Flat areas of color with dark outlines",
  ],
  palette: ["#f2c14e", "#2b59c3", "#5b8e7d", "#d1495b", "#f4ecd8"],
  placeholderPattern: "gesture",
  viewer: "wall",
  learn: [
    {
      heading: "Not one style",
      body: [
        "The English critic Roger Fry coined the term for a 1910 London exhibition. It groups artists who never worked together and painted very differently.",
        "What they share is a move away from recording light toward something more lasting: structure for Cézanne, emotion for van Gogh, symbol and myth for Gauguin.",
      ],
    },
    {
      heading: "Why it matters",
      body: [
        "Cézanne's way of building objects from planes of color led straight to Cubism. Van Gogh's and Gauguin's bold, emotional color led to Fauvism and Expressionism.",
        "Van Gogh painted his bedroom in Arles three times. The version in this room is from 1889.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Post-Impressionist painting of: ${p}.`,
      "Bold expressive color, thick directional brushstrokes,",
      "simplified forms with dark outlines, oil paint impasto.",
    ].join(" "),
  ),
};
