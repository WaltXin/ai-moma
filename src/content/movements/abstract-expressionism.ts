import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const abstractExpressionism: Movement = {
  slug: "abstract-expressionism",
  name: "Abstract Expressionism",
  period: "1940s–1950s",
  summary:
    "New York painters made huge abstract canvases, either full of gesture or of still fields of color, putting the act of painting at the center.",
  keyArtists: [
    "Jackson Pollock",
    "Lee Krasner",
    "Willem de Kooning",
    "Mark Rothko",
    "Helen Frankenthaler",
    "Joan Mitchell",
    "Franz Kline",
  ],
  techniques: [
    "Action painting: dripping, pouring and sweeping paint",
    "Color Field: large, soaking areas of color",
    "All-over compositions with no single focus",
    "Very large scale",
  ],
  palette: ["#111111", "#f2e8cf", "#bc4749", "#386641", "#f4a259"],
  placeholderPattern: "gesture",
  viewer: "wall",
  learn: [
    {
      heading: "Two directions",
      body: [
        'After the Second World War, New York became the center of the art world. The critic Harold Rosenberg called one approach "action painting" in 1952: the canvas as "an arena in which to act".',
        "Other painters, such as Mark Rothko and Barnett Newman, made calm fields of color meant to envelop the viewer. This became known as Color Field painting.",
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
      `Large abstract expressionist painting evoking: ${p}.`,
      "Energetic dripped and poured paint, sweeping gestural brushstrokes,",
      "all-over composition, no recognizable objects.",
    ].join(" "),
  ),
};
