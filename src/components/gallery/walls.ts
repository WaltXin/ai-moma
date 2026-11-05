import type { CSSProperties } from "react";

/** A painted wall: the ground color and the colors of everything set on it. */
export type Wall = { wall: string; ink: string; muted: string; line: string };

/** The lobby's salon wall. */
export const LOBBY_WALL: Wall = {
  wall: "#5a1820",
  ink: "#f6ead8",
  muted: "#dcbcab",
  line: "#7b3a40",
};

/**
 * The Studio: a neutral working wall, so generated colors read true. Not a
 * floor of its own; finished work goes to the Community Gallery on Floor 1.
 */
export const STUDIO_WALL: Wall = {
  wall: "#d9dad6",
  ink: "#151614",
  muted: "#4f514c",
  line: "#bdbfb9",
};

/** Round the 3D walk: dark, like the edges of a cinema screen, so the building is what you see. */
export const WALK_WALL: Wall = {
  wall: "#161514",
  ink: "#f2efe9",
  muted: "#a9a49b",
  line: "#2c2a27",
};

/** One wall color per floor, like rooms in a real museum. */
const FLOOR_WALLS: Record<string, Wall> = {
  "light-and-color": { wall: "#1d2f4f", ink: "#f3efe6", muted: "#b9c5d8", line: "#3a4f73" },
  "avant-garde": { wall: "#113c35", ink: "#eff1e7", muted: "#a8cbbe", line: "#2d5a51" },
  "between-the-wars": { wall: "#e7e2d7", ink: "#1a1a18", muted: "#57524a", line: "#c8c0b0" },
  postwar: { wall: "#f7f7f5", ink: "#121212", muted: "#5c5c5c", line: "#dcdcd9" },
  pop: { wall: "#f6c500", ink: "#141414", muted: "#463a00", line: "#d7aa00" },
  perception: { wall: "#0d0d0f", ink: "#f2f2f2", muted: "#a4a4aa", line: "#2b2b30" },
  community: { wall: "#ff2e63", ink: "#17070b", muted: "#4a0c1c", line: "#ff6f93" },
};

/** A new floor without its own color gets a white cube. */
export function floorWall(slug: string): Wall {
  return FLOOR_WALLS[slug] ?? FLOOR_WALLS.postwar;
}

/** Inline style for a `[data-wall]` section: the colors <WallRepaint> moves onto the page. */
export function wallVars(w: Wall): CSSProperties {
  return {
    "--floor-wall": w.wall,
    "--floor-ink": w.ink,
    "--floor-muted": w.muted,
    "--floor-line": w.line,
  } as CSSProperties;
}

/**
 * Paints the whole page, header and footer included, before any JavaScript
 * runs. Scoped to one `[data-walls]` root so a page Next keeps hidden after
 * navigation never paints the page that replaced it.
 */
export function wallCss(key: string, w: Wall): string {
  return `body:has([data-walls="${key}"]:not([data-away])){--wall:${w.wall};--ink:${w.ink};--muted:${w.muted};--line:${w.line}}`;
}
