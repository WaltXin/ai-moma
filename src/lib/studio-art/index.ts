import { makeRng } from "./rng";
import { RECIPES, type RecipeName } from "./styles";

export { RECIPES, type RecipeName };

/** Draws one frame of a generative piece as a standalone SVG document. */
export function renderStudioArt(recipe: RecipeName, seed: number, frame = 0): string {
  const r = RECIPES[recipe];
  // Each frame gets its own stream, so frames stay stable if another changes.
  const body = r.render(makeRng(seed + frame * 7919), frame);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}" viewBox="0 0 ${r.width} ${r.height}">${body}</svg>`;
}

export function frameCount(recipe: RecipeName): number {
  return "frames" in RECIPES[recipe] ? (RECIPES[recipe] as { frames: number }).frames : 1;
}

/** Public URL for a frame: `/studio-art/<id>.svg`, or `/studio-art/<id>.f1.svg`. */
export function studioArtUrl(id: string, frame?: number): string {
  return frame === undefined ? `/studio-art/${id}.svg` : `/studio-art/${id}.f${frame}.svg`;
}

/** Inverse of `studioArtUrl`'s file name. */
export function parseStudioArtFile(file: string): { id: string; frame?: number } | null {
  const m = /^([a-z0-9-]+)(?:\.f(\d+))?\.svg$/.exec(file);
  if (!m) return null;
  return { id: m[1], frame: m[2] === undefined ? undefined : Number(m[2]) };
}
