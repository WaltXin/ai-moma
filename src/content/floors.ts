import type { Floor } from "@/lib/museum/types";

/** The building. Floors are listed bottom-up. */
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
    slug: "pop",
    name: "Pop",
    tagline: "Mass media, repetition and the everyday.",
    exhibitions: ["everyday-icons"],
  },
  {
    level: 3,
    slug: "perception",
    name: "Perception & Motion",
    tagline: "Op Art, Kinetic Art and works that change as you move.",
    exhibitions: ["angles-of-view"],
  },
];
