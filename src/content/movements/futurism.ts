import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const futurism: Movement = {
  slug: "futurism",
  name: "Futurism",
  period: "1909–1916",
  summary:
    "Italian artists who celebrated speed, machines and the modern city, and tried to paint motion itself.",
  keyArtists: [
    "Umberto Boccioni",
    "Giacomo Balla",
    "Gino Severini",
    "Carlo Carrà",
    "Luigi Russolo",
  ],
  techniques: [
    '"Lines of force" showing direction and energy',
    "Repeated, overlapping forms to show movement",
    "Fragmented planes borrowed from Cubism",
    "Manifestos as part of the art",
  ],
  palette: ["#d62828", "#f77f00", "#fcbf49", "#003049", "#eae2b7"],
  placeholderPattern: "stripes",
  viewer: "wall",
  learn: [
    {
      heading: "A movement that began as a manifesto",
      body: [
        "The poet F. T. Marinetti published the Founding Manifesto of Futurism on the front page of Le Figaro on 20 February 1909. It praised cars, speed and the city, and attacked museums.",
        "Painters such as Boccioni and Balla studied chronophotography, which records a moving body in overlapping stages, to show motion on a still canvas.",
      ],
    },
    {
      heading: "A hard history",
      body: [
        "Futurism also glorified war. Boccioni died in 1916 during military service, and the movement's later ties to Italian Fascism are part of its story.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Futurist painting of: ${p} in motion.`,
      "Repeated overlapping forms showing speed, dynamic diagonal lines of force,",
      "fragmented planes, vivid reds, oranges and deep blue.",
    ].join(" "),
  ),
};
