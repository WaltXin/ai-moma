/** Small deterministic hash so each placeholder looks a little different. */
export function seedFrom(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Deterministic pseudo-random numbers in [0, 1) from a seed. */
export function seededRandom(seed: number): () => number {
  let r = seed;
  return () => ((r = (r * 1103515245 + 12345) >>> 0) % 1000) / 1000;
}
