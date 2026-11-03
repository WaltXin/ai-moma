import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const fauvism: Movement = {
  slug: "fauvism",
  name: "Fauvism",
  period: "1905–1910",
  summary:
    'The "wild beasts" used pure, unmixed color for its emotional force, not to describe what things looked like.',
  keyArtists: [
    "Henri Matisse",
    "André Derain",
    "Maurice de Vlaminck",
    "Raoul Dufy",
    "Kees van Dongen",
  ],
  techniques: [
    "Pure color straight from the tube",
    "Color freed from description: green faces, red trees",
    "Bold, simplified shapes",
    "Fast, energetic brushwork",
  ],
  palette: ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#ffb4a2"],
  placeholderPattern: "field",
  viewer: "wall",
  learn: [
    {
      heading: "The wild beasts",
      body: [
        'At the 1905 Salon d\'Automne in Paris, the critic Louis Vauxcelles saw a classical sculpture in a room of blazing canvases and called it "Donatello among the wild beasts" (fauves).',
        "The movement was short. By 1908 most of its painters had moved on, but the idea that color could carry feeling on its own changed modern art.",
      ],
    },
    {
      heading: "Why some frames hold Studio pieces",
      body: [
        "Several Fauve painters died after 1955, so their work is still under copyright in many countries and isn't shown here. Matisse's works shown here are public domain.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Fauvist painting of: ${p}.`,
      "Pure unmixed saturated color, non-naturalistic colors, simplified bold shapes,",
      "loose energetic brushstrokes.",
    ].join(" "),
  ),
};
