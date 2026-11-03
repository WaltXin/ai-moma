import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const minimalism: Movement = {
  slug: "minimalism",
  name: "Minimalism",
  period: "1960s–1970s",
  summary:
    "Artists stripped work down to simple forms, industrial materials and repetition, so the object is just what it is.",
  keyArtists: [
    "Donald Judd",
    "Agnes Martin",
    "Dan Flavin",
    "Sol LeWitt",
    "Carl Andre",
    "Anne Truitt",
    "Frank Stella",
  ],
  techniques: [
    "Industrial materials: steel, aluminum, fluorescent light",
    "Serial repetition of identical units",
    "Grids",
    "No visible trace of the artist's hand",
  ],
  palette: ["#f5f5f4", "#a8a29e", "#57534e", "#1c1917", "#dc2626"],
  placeholderPattern: "field",
  viewer: "wall",
  learn: [
    {
      heading: "What you see is what you see",
      body: [
        "Frank Stella said it in a 1964 interview, and it became the movement's motto. Minimal works don't represent anything or express the artist's feelings. They ask you to notice the object, the room and your own body in it.",
        "Many Minimal artists made their works in factories from plans, using units that could be repeated or rearranged.",
      ],
    },
    {
      heading: "Why this room holds Studio pieces",
      body: [
        "These works are still under copyright, so this room shows pieces made with the movement's techniques instead.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Minimalist artwork based on: ${p}.`,
      "Simple repeated geometric units, industrial materials, precise grid,",
      "neutral grays with one accent color, no visible brushwork.",
    ].join(" "),
  ),
};
