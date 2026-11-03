import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const surrealism: Movement = {
  slug: "surrealism",
  name: "Surrealism",
  period: "1924–1950s",
  summary:
    "Artists and poets tapped dreams, chance and the unconscious to make the strange feel real.",
  keyArtists: [
    "André Breton",
    "Salvador Dalí",
    "René Magritte",
    "Max Ernst",
    "Joan Miró",
    "Leonora Carrington",
    "Dorothea Tanning",
    "Meret Oppenheim",
  ],
  techniques: [
    "Automatism: drawing without conscious control",
    "Dream images painted with precise realism",
    "Unexpected combinations of ordinary things",
    "Frottage, decalcomania and other chance textures",
    "Exquisite corpse: a picture drawn in turns by several people",
  ],
  palette: ["#2b2d42", "#8d99ae", "#edf2f4", "#ef233c", "#f4a261"],
  placeholderPattern: "gesture",
  viewer: "wall",
  learn: [
    {
      heading: "The manifesto",
      body: [
        "André Breton published the Manifesto of Surrealism in Paris in 1924. Drawing on Freud, the Surrealists wanted to free the imagination from reason and habit.",
        "Some painted dreams in sharp, almost photographic detail. Others let chance and automatic drawing lead the way.",
      ],
    },
    {
      heading: "Why this room holds Studio pieces",
      body: [
        "Most Surrealist artists died after 1955, so their work is still under copyright and isn't shown here. Visit the Learn page, then try the techniques in the Studio.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Surrealist dreamlike painting of: ${p}.`,
      "Impossible juxtapositions rendered with precise realism, long shadows,",
      "uncanny calm atmosphere, vast empty landscape.",
    ].join(" "),
  ),
};
