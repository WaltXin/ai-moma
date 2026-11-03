import { seedFrom } from "@/lib/museum/placeholder";
import type { Artwork } from "@/lib/museum/types";
import { RECIPES, type RecipeName, frameCount, studioArtUrl } from "@/lib/studio-art";

/**
 * An original Studio piece drawn with code in a movement's techniques.
 * Used where the movement's historic works are still under copyright, until
 * visitors' AI-made pieces replace them. Lenticular recipes become
 * Agamographs with one image per viewing angle.
 */
export function studioPiece(id: string, title: string, recipe: RecipeName): Artwork {
  const { width, height } = RECIPES[recipe];
  const frames = frameCount(recipe);
  return {
    id,
    title,
    artist: "AI MoMA Studio",
    year: 2026,
    medium: frames > 1 ? `Virtual Agamograph, ${frames} views, generative SVG` : "Generative SVG",
    source:
      frames > 1
        ? {
            kind: "lenticular",
            frames: Array.from({ length: frames }, (_, f) => ({
              src: studioArtUrl(id, f),
              width,
              height,
            })),
          }
        : { kind: "image", src: studioArtUrl(id), width, height },
    recipe: { name: recipe, seed: seedFrom(id) },
  };
}
