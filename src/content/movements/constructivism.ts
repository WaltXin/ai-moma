import type { Movement } from "@/lib/museum/types";
import { plannedStudio } from "./studio";

export const constructivism: Movement = {
  slug: "constructivism",
  name: "Suprematism & Constructivism",
  period: "1913–1930s",
  summary:
    "Russian avant-garde artists reduced painting to pure geometry, then put art to work for a new society in posters, design and architecture.",
  keyArtists: [
    "Kazimir Malevich",
    "El Lissitzky",
    "Lyubov Popova",
    "Varvara Stepanova",
    "Alexander Rodchenko",
    "Vladimir Tatlin",
  ],
  techniques: [
    "Pure geometric shapes on a white ground",
    "Diagonal, dynamic compositions",
    "Photomontage and bold typography",
    "Industrial materials and design for production",
  ],
  palette: ["#c1121f", "#111111", "#f2efe6", "#8d99ae"],
  placeholderPattern: "field",
  viewer: "wall",
  learn: [
    {
      heading: "From the black square",
      body: [
        'Kazimir Malevich showed his Black Square at the 0.10 exhibition in Petrograd in 1915 and called the new art Suprematism: "the supremacy of pure feeling" expressed through simple geometric forms.',
        "After the 1917 revolution, Constructivists such as Tatlin, Rodchenko and Stepanova rejected art for art's sake and designed posters, books, clothes and buildings instead.",
      ],
    },
    {
      heading: "This room is waiting",
      body: [
        "We haven't found open-access images for this room in our sources yet, so for now it holds Studio pieces. Contributions of public-domain images are welcome.",
      ],
    },
  ],
  studio: plannedStudio((p) =>
    [
      `Constructivist poster about: ${p}.`,
      "Floating geometric shapes on an off-white ground, strong diagonals,",
      "red and black only, bold sans-serif typography, photomontage.",
    ].join(" "),
  ),
};
