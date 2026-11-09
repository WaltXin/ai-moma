import type { Mood } from "@/lib/walk/music";
import type { WorldPlace } from "./place";
import { flowAround, wrap, type SkyPoint, type Vortex } from "./sky";

/**
 * Wheat Field with Cypresses as a place to stand in: a field of ripe wheat
 * below the Alpilles outside Saint-Rémy, the grass and poppies at its edge,
 * an olive bush to the left, two cypresses to the right, and a summer sky
 * of turning clouds. Plain data (metres, radians), so tests can check it;
 * `components/worlds/wheat-field-scene.ts` raises it.
 *
 * Axes as in every world: x to the right, y up, z toward the viewer; the
 * visitor starts in the grass looking down −z, the way the painting looks.
 *
 * The painting (1889, The Met) is long out of copyright, but no image of it
 * is used: this is an interpretation drawn with code.
 */

const deg = (d: number) => (d * Math.PI) / 180;
const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Where the visitor starts: in the grass at the field's edge, the wheat before them. */
export const START = { x: 2, z: 8, yaw: deg(-3), pitch: deg(6) };

/** Where the visitor may wander: the grass and the wheat, short of the bushes behind. */
export const BOUNDS = { cx: 0, cz: -18, rx: 70, rz: 30 };

export function insideBounds(x: number, z: number, margin = 0): boolean {
  const ex = (x - BOUNDS.cx) / (BOUNDS.rx - margin);
  const ez = (z - BOUNDS.cz) / (BOUNDS.rz - margin);
  return ex * ex + ez * ez <= 1;
}

export function clampToBounds(x: number, z: number, margin = 0.5): { x: number; z: number } {
  if (insideBounds(x, z, margin)) return { x, z };
  const ex = (x - BOUNDS.cx) / (BOUNDS.rx - margin);
  const ez = (z - BOUNDS.cz) / (BOUNDS.rz - margin);
  const s = 1 / Math.hypot(ex, ez);
  return { x: BOUNDS.cx + (x - BOUNDS.cx) * s, z: BOUNDS.cz + (z - BOUNDS.cz) * s };
}

/**
 * The ground: gently rolling under the grass and the wheat, rising a little
 * toward the bushes, dipping into the valley beyond, then rising to the hills.
 */
export function heightAt(x: number, z: number): number {
  const roll =
    0.9 * Math.sin(x * 0.03 + 0.5) * Math.cos(z * 0.04) + 0.5 * Math.sin(x * 0.07 - z * 0.05);
  const rise = 4 * smooth(-z / 90);
  const valley = -9 * smooth((-z - 120) / 110);
  const far = 22 * smooth((-z - 300) / 160);
  return roll + rise + valley + far;
}

/** The wheat field's front edge (toward the visitor) and back edge, at x. */
export const fieldFront = (x: number) => -3 - 1.5 * Math.sin(x * 0.06 + 1);
export const fieldBack = (x: number) => -50 + 4 * Math.sin(x * 0.025 + 2);
export const FIELD_HALF_WIDTH = 95;
/** How tall the wheat stands: below a sitting visitor's eyes, so they still see over it. */
export const WHEAT_HEIGHT = 0.75;

/** How far inside the wheat a point is (0 outside), rising to 1 a couple of metres in from the edge. */
export function wheatAt(x: number, z: number): number {
  const d = Math.min(fieldFront(x) - z, z - fieldBack(x), FIELD_HALF_WIDTH - Math.abs(x));
  return smooth(d / 2.2);
}

/** The path the visitor's feet have worn through the grass, at z (only in the grass). */
export const pathX = (z: number) => 3 + 5 * Math.sin(z * 0.09 + 0.6);

/** Two cypresses on the right, the tall one and its smaller companion. */
export const CYPRESSES = [
  { x: 30, z: -62, height: 34, radius: 5.2, seed: 51 },
  { x: 19, z: -57, height: 21, radius: 3.9, seed: 52 },
];

export type Bush = { x: number; z: number; r: number; h: number };
/** The great silver-green olive bush on the left, at the back of the wheat. */
export const OLIVE: Bush[] = [
  { x: -30, z: -47, r: 10, h: 9 },
  { x: -18, z: -50, r: 7, h: 7 },
  { x: -42, z: -44, r: 6, h: 5.5 },
];
/** Round green bushes round the cypresses' feet and across the land behind the wheat. */
export const SHRUBS: Bush[] = [
  { x: 41, z: -58, r: 5, h: 5 },
  { x: 11, z: -61, r: 4, h: 4 },
  { x: 50, z: -54, r: 4.5, h: 4 },
  { x: 25, z: -66, r: 4, h: 4 },
  { x: -3, z: -66, r: 4, h: 4.5 },
  { x: 60, z: -64, r: 4, h: 4 },
  { x: -8, z: -80, r: 4, h: 5 },
  { x: 5, z: -86, r: 3, h: 3.5 },
  { x: -62, z: -70, r: 5, h: 5 },
  { x: 76, z: -72, r: 4, h: 4 },
  { x: -88, z: -62, r: 4.5, h: 4 },
  { x: 95, z: -60, r: 4, h: 4 },
];

/** Things a walker can't pass through: the olive bush's lumps. */
export const OBSTACLES = OLIVE.map((b) => ({ x: b.x, z: b.z, r: b.r * 0.8 }));

export function blocked(x: number, z: number, r = 0.3): boolean {
  return OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r);
}

/**
 * Which way the strokes run over the land and the wheat at (x, z): long
 * rolling waves, as the wind moves through the field and he painted it.
 */
export function fieldFlow(x: number, z: number): [number, number] {
  const fz = 0.75 * Math.sin(x * 0.11 + z * 0.22) + 0.35 * Math.sin(x * 0.045 - z * 0.1);
  const l = Math.hypot(1, fz);
  return [1 / l, fz / l];
}

/** The hills: green-blue foothills, then the Alpilles, blue-violet with their peaks, the farthest, palest, and low hills behind. */
export type Ridge = {
  z: number;
  base: number;
  height: number;
  seed: number;
  color: string;
  peaks: number;
};
export const RIDGES: Ridge[] = [
  { z: -330, base: 10, height: 30, seed: 5, color: "#6f93a8", peaks: 0.2 },
  { z: -430, base: 18, height: 92, seed: 9, color: "#5f74c0", peaks: 1 },
  { z: -580, base: 28, height: 86, seed: 13, color: "#93a9da", peaks: 0.5 },
  // Low hills behind the visitor, so the land has a horizon all the way round.
  { z: 380, base: 4, height: 26, seed: 17, color: "#7f9fb8", peaks: 0 },
];

/** A ridge's height at x: rolling, with the Alpilles' jagged peaks rising right of centre. */
export function ridgeAt(r: Ridge, x: number): number {
  const p = r.seed;
  const n =
    0.45 +
    0.22 * Math.sin(x * 0.008 + p) +
    0.12 * Math.sin(x * 0.021 + p * 2.1) +
    0.08 * Math.abs(Math.sin(x * 0.047 + p * 0.7));
  const peaks =
    r.peaks * 0.45 * Math.exp(-(((x - 90) / 180) ** 2)) * (0.7 + 0.3 * Math.sin(x * 0.06));
  return r.base + r.height * (n + peaks);
}

// ── The sky ──

/** The clouds' curls: strokes wheel round them. */
export const VORTICES: Vortex[] = [
  { az: deg(-34), el: deg(34), r: deg(12), spin: 1, strength: 0.9 },
  { az: deg(-8), el: deg(42), r: deg(9), spin: -1, strength: 0.7 },
  { az: deg(14), el: deg(22), r: deg(8), spin: 1, strength: 0.7 },
  { az: deg(34), el: deg(40), r: deg(10), spin: -1, strength: 0.8 },
  { az: deg(-58), el: deg(20), r: deg(9), spin: -1, strength: 0.5 },
  { az: deg(55), el: deg(16), r: deg(8), spin: 1, strength: 0.5 },
  // Behind the visitor the clouds keep turning.
  { az: deg(150), el: deg(30), r: deg(16), spin: 1, strength: 0.5 },
  { az: deg(-120), el: deg(26), r: deg(13), spin: -1, strength: 0.5 },
  { az: deg(90), el: deg(38), r: deg(11), spin: 1, strength: 0.4 },
];

/** The cloud masses: white and cream, thickest paint in the sky. */
export const CLOUDS: (SkyPoint & { rx: number; ry: number })[] = [
  { az: deg(-32), el: deg(30), rx: deg(30), ry: deg(13) },
  { az: deg(10), el: deg(17), rx: deg(20), ry: deg(7) },
  { az: deg(28), el: deg(46), rx: deg(20), ry: deg(10) },
  { az: deg(-10), el: deg(56), rx: deg(24), ry: deg(9) },
  { az: deg(60), el: deg(24), rx: deg(16), ry: deg(8) },
  { az: deg(-66), el: deg(14), rx: deg(16), ry: deg(6) },
  { az: deg(140), el: deg(30), rx: deg(32), ry: deg(13) },
  { az: deg(-130), el: deg(24), rx: deg(26), ry: deg(11) },
  { az: deg(95), el: deg(48), rx: deg(22), ry: deg(11) },
];

/** Sky colours, after the painting: pale cerulean and turquoise, and cream-white clouds. */
export const SKY = {
  tones: [
    [0, "#d0e4ea"],
    [0.14, "#a0c4e0"],
    [0.42, "#6f9ad8"],
    [1, "#4a78c0"],
  ] as [number, string][],
  deep: ["#5f8fd0", "#7aa6e0", "#4f80c8", "#6fc0c0", "#86cfc0", "#3f70b8", "#8fb6e6", "#5fb0b8"],
  cloud: ["#f6f3e6", "#ffffff", "#efe8d2", "#f2eedc", "#e8e2c8", "#f8f0d8", "#dfe4e2"],
  seam: "#3f62a8",
};

/** How much a sky point belongs to a cloud (0–1): a soft mass with a curling edge. */
export function cloudAt(az: number, el: number): number {
  let c = 0;
  for (const k of CLOUDS) {
    const dx = (wrap(az - k.az) * Math.cos(el)) / k.rx;
    const dy = (el - k.el) / k.ry;
    const a = Math.atan2(dy, dx);
    // The edge billows in and out as it goes round.
    const edge = 1 + 0.18 * Math.sin(a * 5 + k.az * 7) + 0.1 * Math.sin(a * 9 + k.el * 11);
    const d = Math.hypot(dx, dy) / edge;
    c = Math.max(c, 1 - smooth((d - 0.7) / 0.3));
  }
  return c;
}

/** Which way sky strokes run: rolling waves, wheeling round each cloud's curl. */
export function skyFlow(az: number, el: number): { x: number; y: number } {
  return flowAround(
    az,
    el,
    VORTICES,
    [],
    (a, e) => 0.45 * Math.sin(a * 2.6 + e * 5) + 0.2 * Math.sin(a * 6 - e * 4),
  );
}

/** Midsummer music for the field: brighter and a little busier than the night's, still slow. */
export const SUMMER_MOOD: Mood = {
  // G4, in a major pentatonic.
  root: 67,
  scale: [0, 2, 4, 7, 9],
  chords: [
    [0, 2, 4],
    [3, 0, 1],
    [4, 1, 2],
    [1, 3, 0],
  ],
  beat: 0.52,
  density: 0.28,
  brightness: 2400,
  range: [2, 11],
};

/** The field, for walking in. */
export const WHEAT_FIELD: WorldPlace = {
  start: START,
  heightAt,
  clampToBounds,
  blocked,
  mood: SUMMER_MOOD,
  ground: "the grass or the wheat",
  background: "#9fbfdc",
};
