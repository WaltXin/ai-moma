/** Sky positions are azimuth (radians, 0 straight ahead, positive to the right) and elevation above the horizon. */
export type SkyPoint = { az: number; el: number };

/** An angle wrapped to −π…π. */
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A swirl in a sky: strokes circle it. `spin` 1 is counter-clockwise as seen. */
export type Vortex = SkyPoint & { r: number; spin: 1 | -1; strength: number };

/**
 * Which way sky strokes run at a point, in angular units, unit length: a
 * wave rolling left to right (`wave` gives its tilt), bent round each vortex
 * and ringed round each light.
 */
export function flowAround(
  az: number,
  el: number,
  vortices: Vortex[],
  rings: (SkyPoint & { r: number })[],
  wave: (az: number, el: number) => number,
): { x: number; y: number } {
  let x = 1;
  let y = wave(az, el);
  for (const v of vortices) {
    const dx = wrap(az - v.az) * Math.cos(el);
    const dy = el - v.el;
    const d = Math.hypot(dx, dy);
    const w = v.strength * Math.exp(-((d / v.r) ** 2)) * 3.2;
    if (d > 1e-6) {
      x += (-dy / d) * w * v.spin;
      y += (dx / d) * w * v.spin;
    }
  }
  for (const s of rings) {
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
