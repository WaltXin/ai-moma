import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const dada: Movement = {
  slug: "dada",
  name: "Dada",
  period: "1916–1924",
  summary:
    "An anti-art movement born in wartime that used chance, collage and nonsense to mock the logic that led to war.",
  keyArtists: [
    "Hugo Ball",
    "Hannah Höch",
    "Marcel Duchamp",
    "Kurt Schwitters",
    "Sophie Taeuber-Arp",
    "Jean Arp",
    "Man Ray",
  ],
  techniques: [
    "Collage and photomontage",
    "Readymades: everyday objects declared art",
    "Chance operations",
    "Sound poetry and performance",
  ],
  palette: ["#222222", "#c1121f", "#f0ead6", "#669bbc", "#e9c46a"],
  placeholderPattern: "field",
  viewer: "wall",
  learn: [
    {
      heading: "Zurich, 1916",
      body: [
        "During the First World War, Hugo Ball and Emmy Hennings opened the Cabaret Voltaire in neutral Zurich. Artists from across Europe performed nonsense poems, wore masks and made art by chance.",
        "Dada spread to Berlin, Paris, Cologne, Hanover and New York, where Marcel Duchamp submitted a urinal titled Fountain (1917) to an art exhibition.",
      ],
    },
    {
      heading: "Merz",
      body: [
        "In Hanover, Kurt Schwitters made collages from tickets, wrappers and scraps he found in the street. He called his art Merz, a fragment cut from the word Commerzbank in one of his collages.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Dada collage about: ${p}.`,
      "Cut-up newspaper type, torn tickets and paper scraps, photomontage fragments,",
      "chance arrangement, absurd humor.",
    ].join(" "),
  ),
};
