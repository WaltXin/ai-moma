/**
 * A seeded random number generator (mulberry32). The museum's own
 * `seededRandom` is fine for picking a colour or two, but its successive
 * values are correlated: tens of thousands of brushstrokes, or a village of
 * houses, placed with it line up in rows.
 */
export function worldRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
