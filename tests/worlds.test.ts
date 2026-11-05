import { describe, expect, it } from "vitest";
import { getWorlds } from "@/lib/museum/registry";
import {
  BOUNDS,
  CYPRESS,
  LINGER,
  MOON,
  START,
  STARS,
  VILLAGE,
  blocked,
  clampToBounds,
  heightAt,
  insideBounds,
  skyFlow,
} from "@/lib/worlds/starry-night";

describe("painting worlds", () => {
  it("only lists worlds that have a scene", () => {
    // Each slug needs a scene in src/components/worlds/; add it there first.
    expect(getWorlds().map((w) => w.slug)).toEqual(["starry-night"]);
  });
});

describe("the Starry Night hill", () => {
  it("starts the visitor on the hilltop, clear of the cypress", () => {
    expect(insideBounds(START.x, START.z)).toBe(true);
    expect(blocked(START.x, START.z)).toBe(false);
  });

  it("gives other visitors spots they can reach and sit at", () => {
    for (const s of LINGER) {
      expect(insideBounds(s.x, s.z, 0.5), `${s.x},${s.z}`).toBe(true);
      expect(blocked(s.x, s.z, 0.5), `${s.x},${s.z}`).toBe(false);
    }
    expect(new Set(LINGER.map((s) => `${s.x},${s.z}`)).size).toBe(LINGER.length);
  });

  it("keeps walkers on the hill", () => {
    const c = clampToBounds(500, -300);
    expect(insideBounds(c.x, c.z)).toBe(true);
    expect(clampToBounds(1, 1)).toEqual({ x: 1, z: 1 });
  });

  it("puts the cypress on the hill, to the left, and the village well below", () => {
    expect(insideBounds(CYPRESS.x, CYPRESS.z)).toBe(true);
    expect(CYPRESS.x).toBeLessThan(0);
    const hill = heightAt(START.x, START.z);
    for (const h of VILLAGE.houses) expect(heightAt(h.x, h.z)).toBeLessThan(hill - 15);
    // Nobody on the hilltop is anywhere near the houses.
    for (const h of VILLAGE.houses) expect(insideBounds(h.x, h.z)).toBe(false);
    expect(BOUNDS.rx).toBeGreaterThan(BOUNDS.rz);
  });

  it("builds a village whose houses don't overlap", () => {
    const { houses } = VILLAGE;
    expect(houses.length).toBeGreaterThan(30);
    for (let i = 0; i < houses.length; i++) {
      for (let j = i + 1; j < houses.length; j++) {
        const a = houses[i];
        const b = houses[j];
        const gap = Math.hypot(a.x - b.x, a.z - b.z);
        expect(gap, `houses ${i} and ${j}`).toBeGreaterThan(
          (Math.max(a.w, a.d) + Math.max(b.w, b.d)) * 0.3,
        );
      }
    }
  });

  it("hangs eleven stars and the moon in front, above the horizon", () => {
    const ahead = STARS.filter((s) => Math.abs(s.az) < Math.PI / 3);
    expect(ahead.length).toBe(12);
    for (const s of [...STARS, MOON]) expect(s.el).toBeGreaterThan(0);
    expect(MOON.az).toBeGreaterThan(0);
  });

  it("gives every point of the sky a stroke direction", () => {
    for (let az = -3; az <= 3; az += 0.37) {
      for (let el = -0.2; el <= 1.5; el += 0.13) {
        const f = skyFlow(az, el);
        expect(Math.hypot(f.x, f.y)).toBeCloseTo(1, 5);
      }
    }
  });
});
