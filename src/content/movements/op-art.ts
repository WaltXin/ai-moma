import type { Movement } from "@/lib/museum/types";

export const opArt: Movement = {
  slug: "op-art",
  name: "Op & Kinetic Art",
  period: "1950s–present",
  summary:
    "Art that moves, or seems to. It uses optical effects, viewing angle and motion to change in front of the viewer.",
  keyArtists: [
    "Yaacov Agam",
    "Bridget Riley",
    "Victor Vasarely",
    "Jesús Rafael Soto",
    "Carlos Cruz-Diez",
  ],
  techniques: [
    "Lenticular / Agamograph: interleaved images that change with viewing angle",
    "Moiré and line interference",
    "High-contrast geometric repetition",
    "Works that the viewer completes by moving",
  ],
  palette: ["#111111", "#f5f5f5", "#2563eb", "#f97316", "#a3e635"],
  placeholderPattern: "stripes",
  // The Agamograph viewer is planned. Until then artworks render on the wall.
  viewer: "agamograph",
  learn: [
    {
      heading: "Art that changes as you move",
      body: [
        "Op and Kinetic artists treated perception as their material. A canvas could vibrate, a sculpture could change shape, a picture could turn into another picture as you walked past.",
      ],
    },
    {
      heading: "The Agamograph",
      body: [
        "Yaacov Agam's Agamographs are lenticular prints. Two or more images are cut into thin strips and interleaved under a ridged lens, so you see a different image from each angle.",
        "In AI MoMA, a visitor will be able to generate several related images and combine them into a virtual Agamograph that responds to mouse, touch or device tilt.",
      ],
    },
  ],
  studio: {
    status: "planned",
    inputs: ["prompt", "image"],
    output: "lenticular",
    buildPrompt: (userPrompt) =>
      [
        `Geometric optical art interpretation of: ${userPrompt}.`,
        "Hard-edged stripes, high contrast, vibrant complementary colors,",
        "designed to be one frame of a lenticular sequence.",
      ].join(" "),
  },
};
