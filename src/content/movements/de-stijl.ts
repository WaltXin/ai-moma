import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const deStijl: Movement = {
  slug: "de-stijl",
  name: "De Stijl",
  period: "1917–1931",
  summary:
    "Dutch artists and architects reduced art to straight lines, right angles and primary colors, hoping for a universal visual language.",
  keyArtists: [
    "Piet Mondrian",
    "Theo van Doesburg",
    "Gerrit Rietveld",
    "Bart van der Leck",
    "Vilmos Huszár",
  ],
  techniques: [
    "Only horizontal and vertical lines",
    "Red, yellow and blue, plus black, white and gray",
    "Asymmetric balance",
    "The same rules for painting, furniture and buildings",
  ],
  palette: ["#d62828", "#f7c600", "#1d4e89", "#111111", "#f5f5f5"],
  placeholderPattern: "grid",
  viewer: "wall",
  learn: [
    {
      heading: "The style",
      body: [
        'Theo van Doesburg founded the magazine De Stijl ("The Style") in 1917. Piet Mondrian called his version of the idea Neo-Plasticism.',
        "The group designed rooms, chairs and houses too. Gerrit Rietveld's Red Blue Chair and Schröder House apply the same grid of lines and primary colors to real space.",
      ],
    },
    {
      heading: "Look closer in this room",
      body: [
        "Farm near Duivendrecht (about 1916) shows where Mondrian started. Within a few years he had stripped landscapes down to the grid.",
        "His Lozenge Composition (1921) is a square canvas turned 45 degrees, so the straight lines meet a diamond-shaped edge.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Abstract geometric composition inspired by: ${p}.`,
      "Only horizontal and vertical black lines, rectangles of primary red, yellow and blue,",
      "white and gray fields, asymmetric balance.",
    ].join(" "),
  ),
};
