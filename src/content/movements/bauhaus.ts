import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const bauhaus: Movement = {
  slug: "bauhaus",
  name: "Bauhaus",
  period: "1919–1933",
  summary: "A German art school that joined art, craft and industry, and shaped modern design.",
  keyArtists: [
    "Walter Gropius",
    "Paul Klee",
    "Wassily Kandinsky",
    "László Moholy-Nagy",
    "Oskar Schlemmer",
    "Anni Albers",
    "Marianne Brandt",
    "Gunta Stölzl",
  ],
  techniques: [
    "Form follows function",
    "Basic shapes and primary colors",
    "Workshops in weaving, metal, typography and theater",
    "Design for mass production",
  ],
  palette: ["#e63946", "#f1c40f", "#1d3557", "#111111", "#f1faee"],
  placeholderPattern: "field",
  viewer: "wall",
  learn: [
    {
      heading: "A school, not a style",
      body: [
        "Walter Gropius founded the Bauhaus in Weimar in 1919. It moved to Dessau in 1925 and to Berlin in 1932, and closed in 1933 under pressure from the Nazi government.",
        "Students took a shared foundation course and then trained in workshops. Teachers included painters such as Paul Klee and Wassily Kandinsky.",
      ],
    },
    {
      heading: "Look closer in this room",
      body: [
        'Klee described drawing as "taking a line for a walk". His small prints here show that playful, exact line.',
        "Oskar Schlemmer ran the theater workshop and is known for the Triadic Ballet, with costumes built from geometric shapes.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Bauhaus design of: ${p}.`,
      "Basic geometric shapes, circles, squares and triangles, primary colors with black,",
      "clean sans-serif typography, functional modernist layout.",
    ].join(" "),
  ),
};
