import type { Floor } from "@/lib/museum/types";

/** The building, listed bottom-up and roughly in historical order. */
export const floors: Floor[] = [
  {
    level: 1,
    slug: "community",
    name: "Community Gallery",
    tagline: "Work made by visitors in the Studio.",
    exhibitions: ["visitor-pop"],
  },
  {
    level: 2,
    slug: "light-and-color",
    name: "Light & Color",
    tagline: "Impressionism and what came after, 1860s–1900s.",
    exhibitions: ["impressions-of-light", "points-of-color", "color-and-structure", "living-line"],
  },
  {
    level: 3,
    slug: "avant-garde",
    name: "The Avant-Garde",
    tagline: "Wild color, inner feeling and shattered viewpoints, 1905–1916.",
    exhibitions: ["wild-color", "inner-visions", "many-angles", "speed-and-force"],
  },
  {
    level: 4,
    slug: "between-the-wars",
    name: "Between the Wars",
    tagline: "Anti-art, pure geometry, design and dreams, 1916–1940.",
    exhibitions: [
      "anti-art",
      "lines-and-primaries",
      "square-and-wedge",
      "school-of-making",
      "dream-logic",
    ],
  },
  {
    level: 5,
    slug: "postwar",
    name: "After the War",
    tagline: "Gesture, color field and the minimal object, 1940s–1970s.",
    exhibitions: ["gesture-and-field", "what-you-see"],
  },
  {
    level: 6,
    slug: "pop",
    name: "Pop",
    tagline: "Mass media, repetition and the everyday.",
    exhibitions: ["everyday-icons"],
  },
  {
    level: 7,
    slug: "perception",
    name: "Perception & Motion",
    tagline: "Op Art, Kinetic Art and works that change as you move.",
    exhibitions: ["angles-of-view"],
  },
  {
    level: 8,
    slug: "vibe",
    name: "Vibe",
    tagline: "Paintings to walk into and be still in. Step inside one, sit down, and breathe.",
    exhibitions: [],
    worlds: ["starry-night", "sunflowers", "wheat-field-with-cypresses"],
  },
];
