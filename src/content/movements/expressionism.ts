import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const expressionism: Movement = {
  slug: "expressionism",
  name: "Expressionism",
  period: "1905–1925",
  summary: "Artists bent shape and color to show inner feeling rather than outward appearance.",
  keyArtists: [
    "Edvard Munch",
    "Ernst Ludwig Kirchner",
    "Wassily Kandinsky",
    "Franz Marc",
    "Egon Schiele",
    "Käthe Kollwitz",
  ],
  techniques: [
    "Distorted, angular forms",
    "Harsh or symbolic color",
    "Woodcuts with raw, gouged lines",
    "Subjects of anxiety, the city, nature and the spiritual",
  ],
  palette: ["#1d3557", "#e63946", "#f1c40f", "#2d6a4f", "#111111"],
  placeholderPattern: "gesture",
  viewer: "wall",
  learn: [
    {
      heading: "Two groups in Germany",
      body: [
        "Die Brücke (The Bridge) formed in Dresden in 1905. Kirchner and his friends made raw woodcuts and jarring city scenes.",
        "Der Blaue Reiter (The Blue Rider) formed in Munich in 1911 around Kandinsky and Franz Marc, who looked for spiritual meaning in color. Kandinsky's Improvisations, like the one here, moved step by step toward pure abstraction.",
      ],
    },
    {
      heading: "A forerunner",
      body: [
        "Edvard Munch painted The Scream in 1893. The print in this room is his 1895 lithograph of the same image, which spread it far beyond one canvas.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Expressionist artwork of: ${p}.`,
      "Distorted angular forms, intense symbolic color, raw woodcut-like lines,",
      "emotional and unsettling mood.",
    ].join(" "),
  ),
};
