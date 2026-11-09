import type { Mood } from "@/lib/walk/music";
import type { WorldPlace } from "./place";
import { worldRandom } from "./random";

/**
 * Sunflowers as a place to stand in, with the visitor made small: the yellow
 * table is the ground, the jug stands as tall as a house, and fifteen
 * sunflowers in every stage of their lives hang overhead like trees, some
 * full and blazing, some drooping, some gone to seed, a few petals fallen
 * round the jug's foot. Behind it all, the yellow wall. Plain data (metres
 * at the visitor's size, radians), so tests can check it;
 * `components/worlds/sunflowers-scene.ts` raises it.
 *
 * Axes as in every world: x to the right, y up, z toward the viewer; the
 * visitor starts on the table looking down −z at the jug, the way the
 * painting looks.
 *
 * The painting (1888, The National Gallery, London) is long out of
 * copyright, but no image of it is used: this is an interpretation drawn
 * with code.
 */

const deg = (d: number) => (d * Math.PI) / 180;
const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Where the visitor starts: out on the table, far enough back to see the whole bouquet. */
export const START = { x: 6, z: 42, yaw: 0, pitch: deg(22) };

/** The jug: where it stands, and its shape (radius at each height, from its foot to its lip). */
export const JUG = {
  x: 0,
  z: -20,
  profile: [
    [6.2, 0],
    [8.4, 3],
    [9.3, 8],
    [9.0, 13],
    [7.6, 18],
    [6.0, 23],
    [5.6, 26],
    [6.4, 28],
  ] as [number, number][],
  /** Where the glaze changes, yellow above, orange below, with a blue line between. */
  band: 14,
};
export const JUG_TOP = JUG.profile.at(-1)![1];
export const JUG_RADIUS = Math.max(...JUG.profile.map(([r]) => r));

/** The table's edges: the wall behind it, its front edge (a long drop to the floor), its sides. */
export const TABLE = { back: -72, front: 90, half: 160 };
export const WALL_Z = -75;

/** The table is flat; past its edges the floor lies far below. */
export function heightAt(x: number, z: number): number {
  const off = Math.max(smooth((z - TABLE.front) / 3), smooth((Math.abs(x) - TABLE.half) / 3));
  return -70 * off;
}

/** Where the visitor may wander: the table, short of its edges. A rounded rectangle. */
export const BOUNDS = { cx: 0, cz: 9, rx: 150, rz: 77 };

const boundsValue = (x: number, z: number, margin: number) =>
  (Math.abs(x - BOUNDS.cx) / (BOUNDS.rx - margin)) ** 4 +
  (Math.abs(z - BOUNDS.cz) / (BOUNDS.rz - margin)) ** 4;

export function insideBounds(x: number, z: number, margin = 0): boolean {
  return boundsValue(x, z, margin) <= 1;
}

export function clampToBounds(x: number, z: number, margin = 0.5): { x: number; z: number } {
  const v = boundsValue(x, z, margin);
  if (v <= 1) return { x, z };
  const s = 1 / Math.pow(v, 1 / 4);
  return { x: BOUNDS.cx + (x - BOUNDS.cx) * s, z: BOUNDS.cz + (z - BOUNDS.cz) * s };
}

/** Nobody walks through the jug. */
export function blocked(x: number, z: number, r = 0.3): boolean {
  return Math.hypot(x - JUG.x, z - JUG.z) < JUG_RADIUS + 0.6 + r;
}

/** A sunflower's stage: in full bloom, just open, wilting and drooping, or gone to seed. */
export type Stage = "bloom" | "open" | "wilting" | "seed";
export type Sunflower = {
  /** The head's centre, relative to the jug's foot. */
  x: number;
  y: number;
  z: number;
  /** Which way its face turns: yaw 0 faces the visitor (+z), pitch up. */
  yaw: number;
  pitch: number;
  /** Its radius, petals and all. */
  r: number;
  stage: Stage;
  seed: number;
};

/** Fifteen sunflowers, after the painting: fanning up and out of the jug, every one different. */
export const FLOWERS: Sunflower[] = [
  { x: -11.5, y: 57.6, z: 1.8, yaw: deg(-12), pitch: deg(8), r: 10.2, stage: "bloom", seed: 1 },
  { x: 1.6, y: 63.1, z: -3.6, yaw: deg(40), pitch: deg(35), r: 8.7, stage: "open", seed: 2 },
  { x: 14.8, y: 56.1, z: 0, yaw: deg(22), pitch: deg(4), r: 9.4, stage: "bloom", seed: 3 },
  { x: -22.1, y: 49.1, z: -1.8, yaw: deg(-55), pitch: deg(-10), r: 8.0, stage: "wilting", seed: 4 },
  { x: -16.4, y: 41.3, z: 6.3, yaw: deg(-8), pitch: deg(-4), r: 10.9, stage: "bloom", seed: 5 },
  { x: 0.8, y: 45.9, z: 8.1, yaw: deg(4), pitch: deg(6), r: 11.6, stage: "seed", seed: 6 },
  { x: 16.4, y: 42.8, z: 6.3, yaw: deg(14), pitch: deg(-6), r: 10.2, stage: "bloom", seed: 7 },
  { x: 26.2, y: 36.6, z: 0.9, yaw: deg(65), pitch: deg(-30), r: 8.0, stage: "wilting", seed: 8 },
  { x: -12.3, y: 32.7, z: 9.9, yaw: deg(-25), pitch: deg(-22), r: 8.7, stage: "open", seed: 9 },
  { x: 12.3, y: 31.9, z: 9.9, yaw: deg(10), pitch: deg(-12), r: 8.7, stage: "seed", seed: 10 },
  { x: 19.7, y: 25.7, z: 6.3, yaw: deg(35), pitch: deg(-50), r: 7.2, stage: "wilting", seed: 11 },
  { x: -19.7, y: 27.2, z: 4.5, yaw: deg(-40), pitch: deg(-45), r: 7.2, stage: "wilting", seed: 12 },
  { x: -4.9, y: 53.7, z: -9, yaw: deg(-20), pitch: deg(55), r: 7.2, stage: "open", seed: 13 },
  { x: 9, y: 51.4, z: -10.8, yaw: deg(80), pitch: deg(10), r: 7.2, stage: "bloom", seed: 14 },
  { x: 23.8, y: 50.6, z: -4.5, yaw: deg(45), pitch: deg(15), r: 6.5, stage: "open", seed: 15 },
];

/** The direction a flower's face looks. */
export function facing(f: Sunflower): { x: number; y: number; z: number } {
  return {
    x: Math.sin(f.yaw) * Math.cos(f.pitch),
    y: Math.sin(f.pitch),
    z: Math.cos(f.yaw) * Math.cos(f.pitch),
  };
}

/** Petals fallen on the table round the jug: where, which way they lie, how long. */
export const FALLEN: { x: number; z: number; angle: number; len: number }[] = (() => {
  const rand = worldRandom(1888);
  const out: { x: number; z: number; angle: number; len: number }[] = [];
  while (out.length < 46) {
    const a = rand() * Math.PI * 2;
    const d = JUG_RADIUS + 2 + rand() ** 1.6 * 28;
    const x = JUG.x + Math.cos(a) * d * 1.3;
    const z = JUG.z + Math.sin(a) * d;
    if (z < TABLE.back + 3) continue;
    out.push({ x, z, angle: rand() * Math.PI * 2, len: 2.2 + rand() * 1.8 });
  }
  return out;
})();

/** Warm afternoon music for the table: bright, unhurried, a soft pulse under it. */
export const AFTERNOON_MOOD: Mood = {
  // A4, in a major pentatonic.
  root: 69,
  scale: [0, 2, 4, 7, 9],
  chords: [
    [0, 2, 4],
    [4, 1, 2],
    [3, 0, 1],
    [1, 3, 0],
  ],
  beat: 0.48,
  density: 0.3,
  brightness: 2800,
  range: [2, 11],
  pulse: true,
};

/** The table, for walking on. */
export const SUNFLOWERS: WorldPlace = {
  start: START,
  heightAt,
  clampToBounds,
  blocked,
  mood: AFTERNOON_MOOD,
  ground: "the table",
  background: "#e6c45a",
};
