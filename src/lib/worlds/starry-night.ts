import { worldRandom } from "./random";
import type { Mood } from "@/lib/walk/music";

/**
 * The Starry Night as a place to stand in: the hill outside the window at
 * Saint-Rémy, the village asleep in the valley, the cypress, the hills and
 * the sky. Everything here is plain data (metres, radians), so tests can
 * check it and the scene (`components/worlds/starry-night-scene.ts`) only
 * has to raise it.
 *
 * Axes: x to the right, y up, z toward the viewer; the visitor starts at the
 * origin looking down -z, the way the painting looks. Sky positions are
 * azimuth (radians, 0 straight ahead, positive to the right) and elevation
 * (radians above the horizon).
 *
 * The painting (1889, MoMA) is long out of copyright, but no image of it is
 * used: this is an interpretation drawn with code.
 */

export type SkyPoint = { az: number; el: number };
/** A swirl in the sky: strokes circle it. `spin` 1 is counter-clockwise as seen. */
export type Vortex = SkyPoint & { r: number; spin: 1 | -1; strength: number };
export type Star = SkyPoint & { size: number };
export type House = {
  x: number;
  z: number;
  /** Width along the house's own x, depth along its z, wall height. */
  w: number;
  d: number;
  h: number;
  rot: number;
  /** Roof rise above the walls. */
  roof: number;
  /** Lit windows on the side facing the hill, as fractions along the front (0–1) and up the wall. */
  windows: { u: number; v: number }[];
};
export type Tree = { x: number; z: number; r: number; h: number };
export type Ridge = { z: number; base: number; height: number; seed: number; color: string };
export type Linger = { x: number; z: number; sit: boolean };

const deg = (d: number) => (d * Math.PI) / 180;

/** Where the visitor's eyes start, and how far the hilltop lets them wander. */
export const START = { x: 2, z: -10, yaw: 0, pitch: deg(10) };

/** The walkable hilltop: an ellipse, so nobody wanders down into the village. */
export const BOUNDS = { cx: 0, cz: -4, rx: 34, rz: 22 };

export function insideBounds(x: number, z: number, margin = 0): boolean {
  const ex = (x - BOUNDS.cx) / (BOUNDS.rx - margin);
  const ez = (z - BOUNDS.cz) / (BOUNDS.rz - margin);
  return ex * ex + ez * ez <= 1;
}

/** Keeps a point on the hilltop, sliding it back along the way it went out. */
export function clampToBounds(x: number, z: number, margin = 0.5): { x: number; z: number } {
  if (insideBounds(x, z, margin)) return { x, z };
  const ex = (x - BOUNDS.cx) / (BOUNDS.rx - margin);
  const ez = (z - BOUNDS.cz) / (BOUNDS.rz - margin);
  const s = 1 / Math.hypot(ex, ez);
  return { x: BOUNDS.cx + (x - BOUNDS.cx) * s, z: BOUNDS.cz + (z - BOUNDS.cz) * s };
}

/** The ground: a round hill under the visitor, falling away to the valley floor at 0. */
export function heightAt(x: number, z: number): number {
  // Flat enough on top to wander, then falling away steeply, so the village shows below its edge.
  const q = (x / 60) ** 2 + ((z + 4) / 40) ** 2;
  const hill = 30 * Math.exp(-(q * q));
  // A gentle roll across the valley, flattening out where the village stands.
  const roll =
    2.4 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) + 1.2 * Math.sin(x * 0.06 + z * 0.04);
  const farRise = 14 * smooth((-z - 300) / 160);
  return hill + roll + farRise;
}

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** The cypress, standing on the hill to the left: tall enough to cut across the sky. */
export const CYPRESS = { x: -10, z: -23, height: 23, radius: 2.6, trunk: 1.4 };

/** Things a walker can't pass through: the cypress, the old olive by the path. */
export const OBSTACLES = [{ x: CYPRESS.x, z: CYPRESS.z, r: CYPRESS.trunk + 0.7 }];

export function blocked(x: number, z: number, r = 0.3): boolean {
  return OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r);
}

/** The swirls, after the painting: the great double curl, the long wave beneath it, smaller eddies. */
export const VORTICES: Vortex[] = [
  { az: deg(-6), el: deg(26), r: deg(13), spin: 1, strength: 1 },
  { az: deg(-21), el: deg(30), r: deg(8), spin: -1, strength: 0.8 },
  { az: deg(18), el: deg(20), r: deg(7), spin: -1, strength: 0.45 },
  { az: deg(-40), el: deg(18), r: deg(9), spin: 1, strength: 0.4 },
  // Behind the visitor the sky keeps turning, more quietly.
  { az: deg(150), el: deg(28), r: deg(16), spin: 1, strength: 0.5 },
  { az: deg(-130), el: deg(22), r: deg(12), spin: -1, strength: 0.45 },
  { az: deg(95), el: deg(35), r: deg(10), spin: 1, strength: 0.35 },
];

/** The moon, a crescent in a ring of orange light, top right. */
export const MOON: SkyPoint & { size: number } = { az: deg(36), el: deg(33), size: deg(3.6) };

/** Eleven stars in their halos, and the morning star low by the cypress. */
export const STARS: Star[] = [
  { az: deg(-44), el: deg(36), size: 1 },
  { az: deg(-31), el: deg(41), size: 0.9 },
  { az: deg(-17), el: deg(38), size: 0.85 },
  { az: deg(-6), el: deg(44), size: 0.8 },
  { az: deg(4), el: deg(38), size: 0.95 },
  { az: deg(15), el: deg(43), size: 0.8 },
  { az: deg(22), el: deg(31), size: 1 },
  { az: deg(29), el: deg(22), size: 0.85 },
  { az: deg(48), el: deg(25), size: 0.9 },
  { az: deg(-53), el: deg(24), size: 0.8 },
  { az: deg(9), el: deg(27), size: 0.75 },
  // The morning star, beside the cypress: the biggest, the whitest.
  { az: deg(-22), el: deg(14), size: 1.35 },
  // A few behind, for anyone who turns round.
  { az: deg(160), el: deg(40), size: 0.8 },
  { az: deg(120), el: deg(25), size: 0.7 },
  { az: deg(-150), el: deg(45), size: 0.85 },
  { az: deg(-100), el: deg(30), size: 0.7 },
  { az: deg(80), el: deg(50), size: 0.7 },
];

/** Sky colours, after the painting: ultramarine and cobalt, with pale swirls, lemon stars and an orange moon. */
export const SKY = {
  zenith: "#142a66",
  high: "#1f3f8c",
  low: "#3d68b2",
  horizon: "#8fb2d6",
  swirl: ["#d4e3f0", "#a7c7e6", "#eef0d4", "#7fa6d8", "#9cc9c0", "#f4f1d0"],
  deep: ["#0b1b4d", "#173a8a", "#2a59b0", "#3f6fc0", "#122c6e", "#5a86c8", "#1f4b9e"],
  star: ["#fffbe0", "#f8e27a", "#f0c93a", "#fdf1a8"],
  halo: ["#cfe0c4", "#a9c8c6", "#e8e6b0", "#b7d3d8"],
  moon: ["#fbe37a", "#f1b63c", "#e07d22"],
};

/**
 * The direction strokes run at a point in the sky (azimuth, elevation),
 * in angular units: a wave rolling left to right, bent round each vortex and
 * ringed round each star and the moon.
 */
export function skyFlow(az: number, el: number): { x: number; y: number } {
  let x = 1;
  let y = 0.35 * Math.sin(az * 3.2 + el * 4) + 0.18 * Math.sin(az * 7.1 - el * 3);
  for (const v of VORTICES) {
    const dx = wrap(az - v.az) * Math.cos(el);
    const dy = el - v.el;
    const d = Math.hypot(dx, dy);
    const w = v.strength * Math.exp(-((d / v.r) ** 2)) * 3.2;
    if (d > 1e-6) {
      x += (-dy / d) * w * v.spin;
      y += (dx / d) * w * v.spin;
    }
  }
  for (const s of [
    ...STARS.map((s) => ({ ...s, r: deg(3.4) * s.size })),
    { ...MOON, r: MOON.size * 1.6 },
  ]) {
    const dx = wrap(az - s.az) * Math.cos(el);
    const dy = el - s.el;
    const d = Math.hypot(dx, dy);
    const w = Math.exp(-((d / s.r) ** 2)) * 6;
    if (d > 1e-6) {
      x += (-dy / d) * w;
      y += (dx / d) * w;
    }
  }
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** How strongly a point belongs to a swirl (0–1): swirls are painted paler. */
export function swirlAt(az: number, el: number): number {
  let s = 0;
  for (const v of VORTICES) {
    const dx = wrap(az - v.az) * Math.cos(el);
    const dy = el - v.el;
    const d = Math.hypot(dx, dy) / v.r;
    // A ring, brightest a little inside the vortex's edge, with its eye darker.
    s = Math.max(s, v.strength * Math.exp(-(((d - 0.62) / 0.32) ** 2)));
  }
  // The long pale wave beneath the great curl.
  const wave =
    Math.exp(-(((el - deg(17) - 0.05 * Math.sin(az * 4)) / deg(4)) ** 2)) *
    smooth((deg(35) - Math.abs(wrap(az + deg(12)))) / deg(25));
  return Math.min(1, Math.max(s, wave * 0.9));
}

/** An angle wrapped to −π…π. */
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The blue hills, ridge behind ridge, the farthest palest. */
export const RIDGES: Ridge[] = [
  { z: -360, base: 4, height: 34, seed: 3, color: "#3b5f9e" },
  { z: -470, base: 10, height: 52, seed: 7, color: "#4f74b0" },
  { z: -600, base: 14, height: 70, seed: 11, color: "#6a8cc0" },
];

/** A ridge's height above its base at x: rolling, with one long rise on the left as in the painting. */
export function ridgeAt(r: Ridge, x: number): number {
  const p = r.seed;
  const n =
    0.55 +
    0.25 * Math.sin(x * 0.009 + p) +
    0.12 * Math.sin(x * 0.023 + p * 2.1) +
    0.06 * Math.sin(x * 0.061 + p * 0.7);
  const leftRise = 0.35 * Math.exp(-(((x + 220) / 160) ** 2));
  return r.base + r.height * (n + leftRise);
}

/** The village: a church with a tall spire, and houses round it with a few windows still lit. */
export const CHURCH = { x: 4, z: -150, w: 8, d: 18, h: 10, spire: 34, rot: 0.12 };

export const VILLAGE: { houses: House[]; trees: Tree[] } = (() => {
  const rand = worldRandom(1889);
  const houses: House[] = [];
  const free = (x: number, z: number, r: number) =>
    Math.hypot(x - CHURCH.x, z - CHURCH.z) > r + 11 &&
    houses.every((h) => Math.hypot(h.x - x, h.z - z) > r + Math.max(h.w, h.d) * 0.6);
  for (let tries = 0; houses.length < 46 && tries < 3000; tries++) {
    // Clustered round the church, thinning out along the valley.
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 1;
    const x = CHURCH.x + Math.cos(a) * d * 110;
    const z = CHURCH.z + Math.sin(a) * d * 40;
    const w = 6 + rand() * 6;
    const dep = 5 + rand() * 4;
    if (!free(x, z, Math.max(w, dep) * 0.6)) continue;
    const windows: { u: number; v: number }[] = [];
    const n = rand() < 0.75 ? 1 + Math.floor(rand() * 3) : 0;
    for (let i = 0; i < n; i++) windows.push({ u: 0.2 + rand() * 0.6, v: 0.35 + rand() * 0.3 });
    houses.push({
      x,
      z,
      w,
      d: dep,
      h: 3.5 + rand() * 3.5,
      rot: (rand() - 0.5) * 0.5,
      roof: 1.6 + rand() * 1.6,
      windows,
    });
  }
  const trees: Tree[] = [];
  for (let tries = 0; trees.length < 70 && tries < 4000; tries++) {
    const x = (rand() - 0.5) * 520;
    const z = -95 - rand() * 230;
    if (
      houses.some((h) => Math.hypot(h.x - x, h.z - z) < 8) ||
      Math.hypot(x - CHURCH.x, z - CHURCH.z) < 14
    )
      continue;
    trees.push({ x, z, r: 3 + rand() * 4, h: 5 + rand() * 7 });
  }
  return { houses, trees };
})();

/** Where other visitors drift to: to stand and look up, or sit in the grass. */
export const LINGER: Linger[] = [
  { x: -6, z: -8, sit: true },
  { x: 7, z: -12, sit: false },
  { x: 15, z: -6, sit: true },
  { x: -18, z: -2, sit: false },
  { x: 2, z: -18, sit: true },
  { x: 22, z: -14, sit: false },
  { x: -24, z: -12, sit: true },
  { x: 11, z: 4, sit: false },
  { x: -12, z: 6, sit: true },
  { x: 26, z: 2, sit: true },
];

/** Night music for the hill: slow, low, wide apart, never a quotation of anything. */
export const NIGHT_MOOD: Mood = {
  // D4: an octave lower sat under what a phone's speaker can play.
  root: 62,
  scale: [0, 2, 3, 7, 9],
  chords: [
    [0, 2, 4],
    [3, 0, 1],
    [4, 1, 2],
    [2, 4, 0],
  ],
  beat: 0.62,
  density: 0.2,
  brightness: 1300,
  range: [3, 12],
};
