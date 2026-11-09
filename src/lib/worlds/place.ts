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
};
