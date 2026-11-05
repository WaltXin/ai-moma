import { floorWall } from "@/components/gallery/walls";
import { type Level, type Vec, spaceAt } from "@/lib/walk/building";

/** Plain (no three.js), so the light-baking worker can paint the walls the same way. */

export const WHITE = "#f3f1ec";

/** Gallery walls take the floor's colour; everything else is a warm white. */
export function paintAt(level: Level, p: Vec): string | null {
  const space = spaceAt(level, p);
  if (!space) return null;
  if (space.kind === "gallery") return floorWall(level.slug).wall;
  if (space.kind === "studio") return "#e6e5e1";
  if (space.kind === "outside") return null;
  return WHITE;
}
