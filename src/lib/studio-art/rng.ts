/** Seeded random numbers (mulberry32) so every generated piece is reproducible. */
export type Rng = {
  (): number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
};

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.range = (min, max) => min + next() * (max - min);
  rng.int = (min, max) => Math.floor(min + next() * (max - min + 1));
  rng.pick = (items) => items[Math.floor(next() * items.length)];
  rng.chance = (p) => next() < p;
  return rng;
}

/** Rounds coordinates so the SVG stays small. */
export const n = (v: number) => Math.round(v * 10) / 10;

/** "x,y x,y …" for polygon points. */
export const pts = (points: [number, number][]) =>
  points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
