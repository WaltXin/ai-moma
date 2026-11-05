import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const cubism: Movement = {
  slug: "cubism",
  name: "Cubism",
  period: "1907–1920s",
  summary: "Painters broke objects into facets and showed them from several viewpoints at once.",
  keyArtists: [
    "Pablo Picasso",
    "Georges Braque",
    "Juan Gris",
    "Fernand Léger",
    "María Blanchard",
    "Louis Marcoussis",
  ],
  techniques: [
    "Several viewpoints in one image",
    "Objects broken into faceted planes",
    "Muted browns and grays (Analytic Cubism)",
    "Collage and pasted paper (Synthetic Cubism)",
  ],
  palette: ["#8d6e63", "#546e7a", "#d7ccc8", "#3e2723", "#c0a062"],
  placeholderPattern: "grid",
  viewer: "wall",
  learn: [
    {
      heading: "Seeing all sides at once",
      body: [
        'From 1907–08, Pablo Picasso and Georges Braque, inspired by Cézanne, began breaking objects into flat planes seen from different angles. A critic described Braque\'s landscapes as made of "little cubes".',
        "In Analytic Cubism (about 1909–12) forms splinter into near-monochrome facets. In Synthetic Cubism (from 1912) artists pasted in newspaper, wallpaper and labels, inventing collage as fine art.",
      ],
    },
    {
      heading: "What hangs here",
      body: [
        "Picasso and Braque died in 1973 and 1963, so their work is still under copyright in much of the world. This room shows public-domain work by Juan Gris and María Blanchard, who both worked in Paris alongside them.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Cubist painting of: ${p}.`,
      "Object fragmented into faceted geometric planes seen from multiple viewpoints,",
      "muted browns, grays and ochres, collage textures.",
    ].join(" "),
  ),
};
