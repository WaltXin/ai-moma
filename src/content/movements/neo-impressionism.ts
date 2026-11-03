import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const neoImpressionism: Movement = {
  slug: "neo-impressionism",
  name: "Neo-Impressionism",
  period: "1886–1900s",
  summary:
    "Pointillism. Painters turned Impressionism into a method, building pictures from small dots of pure color that mix in the viewer's eye.",
  keyArtists: [
    "Georges Seurat",
    "Paul Signac",
    "Henri-Edmond Cross",
    "Maximilien Luce",
    "Théo van Rysselberghe",
  ],
  techniques: [
    "Pointillism: small, separate dots of color",
    "Divisionism: splitting a color into its components",
    "Complementary contrasts drawn from color science",
    "Calm, carefully planned compositions",
  ],
  palette: ["#1f6feb", "#f2c14e", "#e4572e", "#76b041", "#fdfcf7"],
  placeholderPattern: "ben-day",
  viewer: "wall",
  learn: [
    {
      heading: "Painting with color science",
      body: [
        "Georges Seurat read color theorists such as Michel-Eugène Chevreul and Ogden Rood. Instead of mixing paint on the palette, he placed pure colors side by side and let the eye mix them.",
        "A Sunday on La Grande Jatte took him about two years. Paul Signac later explained the method in his book From Eugène Delacroix to Neo-Impressionism (1899).",
      ],
    },
    {
      heading: "Try stepping back",
      body: [
        "Up close you see separate dots. From a distance they blend into glowing color. In the walkable gallery, walk up to a painting and then back away.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Pointillist painting of: ${p}.`,
      "Built entirely from small dots of pure unmixed color, complementary contrasts,",
      "calm geometric composition, luminous optical color mixing.",
    ].join(" "),
  ),
};
