import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const impressionism: Movement = {
  slug: "impressionism",
  name: "Impressionism",
  period: "1860s–1880s",
  summary:
    "Painters left the studio to catch passing light and modern life, using quick, visible brushstrokes.",
  keyArtists: [
    "Claude Monet",
    "Pierre-Auguste Renoir",
    "Edgar Degas",
    "Berthe Morisot",
    "Camille Pissarro",
    "Mary Cassatt",
    "Gustave Caillebotte",
  ],
  techniques: [
    "Painting outdoors (en plein air)",
    "Short, broken, visible brushstrokes",
    "Colored shadows instead of black",
    "Series of one motif at different times of day",
    "Cropped, snapshot-like compositions",
  ],
  palette: ["#a7c7e7", "#f4d58d", "#e8a0bf", "#7fb069", "#f6f1e7"],
  placeholderPattern: "gesture",
  viewer: "wall",
  learn: [
    {
      heading: "Where it came from",
      body: [
        "In 1874 a group of painters who kept being turned away by the official Paris Salon put on their own exhibition. A critic mocked Monet's Impression, Sunrise, and the name stuck.",
        "Paris was being rebuilt with wide boulevards, railway stations and cafés. These artists wanted to paint that modern life as it actually looked, in changing light.",
      ],
    },
    {
      heading: "How to recognize it",
      body: [
        "Look for short strokes you can see, bright and light colors, no hard outlines, and shadows painted blue or violet instead of black.",
        "Subjects are everyday: weather, rivers, streets, gardens, people at leisure.",
      ],
    },
    {
      heading: "Look closer in this room",
      body: [
        "Monet painted the same stacks of wheat again and again at different hours and seasons. The real subject is the light, not the haystack.",
        "Caillebotte's Paris Street; Rainy Day shows the new boulevards of the 1870s, cropped like a photograph.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Impressionist painting of: ${p}.`,
      "Loose visible brushstrokes, outdoor natural light, soft bright colors,",
      "colored shadows, no hard outlines, oil on canvas texture.",
    ].join(" "),
  ),
};
