import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const artNouveau: Movement = {
  slug: "art-nouveau",
  name: "Art Nouveau",
  period: "1890–1910",
  summary:
    'A "new art" of whiplash curves and plant forms that spread across posters, buildings, furniture and jewelry.',
  keyArtists: [
    "Alphonse Mucha",
    "Gustav Klimt",
    "Hector Guimard",
    "Victor Horta",
    "Antoni Gaudí",
    "Louis Comfort Tiffany",
  ],
  techniques: [
    "Whiplash curves and flowing lines",
    "Flowers, vines and long hair as ornament",
    "Flat-color lithographic posters",
    "No line between fine art and decoration",
  ],
  palette: ["#c9a66b", "#7a9e7e", "#d98e73", "#3d3b30", "#f3e9d2"],
  placeholderPattern: "field",
  viewer: "wall",
  learn: [
    {
      heading: "One style, many names",
      body: [
        "It was Art Nouveau in France and Belgium, Jugendstil in Germany, Secession style in Vienna and Modernisme in Catalonia. Everywhere it tried to replace copied historical styles with forms taken from nature.",
      ],
    },
    {
      heading: "Art on the street",
      body: [
        "Alphonse Mucha became famous in Paris in 1895 with a theater poster for the actress Sarah Bernhardt. His Documents décoratifs (1902), shown here, was a pattern book that taught designers his approach.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Art Nouveau decorative poster of: ${p}.`,
      "Flowing whiplash curves, floral ornament frame, muted gold and sage palette,",
      "flat lithographic color with fine outlines.",
    ].join(" "),
  ),
};
