import type { Mood } from "@/lib/walk/music";

/**
 * What the visitor needs to know about a painting world to walk in it,
 * apart from how it looks: where they start, the ground under them, where
 * they may go, and its music. Plain data and functions, so tests can check
 * it; the scene that raises it lives in `src/components/worlds/`.
 */
export type WorldPlace = {
  /** Where the visitor's eyes start, and which way they look (yaw 0 is down −z). */
  start: { x: number; z: number; yaw: number; pitch: number };
  /** The height of the ground at (x, z), in metres. */
  heightAt(x: number, z: number): number;
  /** Keeps a point where the visitor may walk, sliding it back along the way it went out. */
  clampToBounds(x: number, z: number): { x: number; z: number };
  /** Whether something (a tree, a bush) stands at (x, z). */
  blocked(x: number, z: number): boolean;
  mood: Mood;
  /** What they walk on, for the hint: "click the grass". */
  ground: string;
  /** The colour behind the canvas while the world is painted. */
  background: string;
  /** What a footstep lands on, for its sound; steps are silent if not given. */
  footing?: "grass";
  /** The air of the place, for its sound; still if not given. */
  air?: Air;
  /** A colour the corners of the view darken to, as the eye loses the edges at night. */
  vignette?: string;
};

/**
 * What the air of a place sounds like, each from 0 (none) to 1: wind coming
 * in gusts, crickets in the grass, and a bell tolling far off now and then.
 */
export type Air = { wind: number; crickets: number; bell: number };

/** How far behind where they'll stand a visitor comes in from, in metres. */
const WALK_IN = 4.5;

/**
 * Where a visitor comes in: a few steps behind `start`, so they arrive by
 * walking into the place. Falls back to `start` itself where there's no clear
 * ground behind it.
 */
export function arrivalOf(place: WorldPlace): { x: number; z: number } {
  const { start } = place;
  // Forward is (−sin yaw, −cos yaw); behind is the other way.
  const bx = Math.sin(start.yaw);
  const bz = Math.cos(start.yaw);
  const at = place.clampToBounds(start.x + bx * WALK_IN, start.z + bz * WALK_IN);
  const far = Math.hypot(at.x - start.x, at.z - start.z);
  if (far < 1.5) return { x: start.x, z: start.z };
  // The way in must be clear, and level enough to walk.
  for (let i = 0; i <= 8; i++) {
    const x = start.x + ((at.x - start.x) * i) / 8;
    const z = start.z + ((at.z - start.z) * i) / 8;
    if (place.blocked(x, z)) return { x: start.x, z: start.z };
    if (Math.abs(place.heightAt(x, z) - place.heightAt(start.x, start.z)) > 1.5)
      return { x: start.x, z: start.z };
  }
  return at;
}
