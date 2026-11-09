import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENES } from "@/components/worlds/scenes";
import { getWorlds } from "@/lib/museum/registry";
import { PLACES } from "@/lib/worlds/places";
import { WORLD_REQUEST_TEMPLATE, worldRequestUrl } from "@/lib/worlds/request";
import {
  BOUNDS,
  CYPRESS,
  MOON,
  START,
  STARS,
  VILLAGE,
  blocked,
  clampToBounds,
  heightAt,
  insideBounds,
  landFlow,
  skyFlow,
} from "@/lib/worlds/starry-night";

describe("painting worlds", () => {
  it("gives every world a place to walk and a scene, and nothing more", () => {
    // Each slug needs a place in src/lib/worlds/places.ts and a scene in
    // src/components/worlds/scenes.ts; add them there first.
    const slugs = getWorlds()
      .map((w) => w.slug)
      .sort();
    expect(Object.keys(PLACES).sort()).toEqual(slugs);
    expect(Object.keys(SCENES).sort()).toEqual(slugs);
  });

  it("starts every visitor somewhere they may stand", () => {
    for (const [slug, p] of Object.entries(PLACES)) {
      const c = p.clampToBounds(p.start.x, p.start.z);
      expect(c, slug).toEqual({ x: p.start.x, z: p.start.z });
      expect(p.blocked(p.start.x, p.start.z), slug).toBe(false);
      expect(Number.isFinite(p.heightAt(p.start.x, p.start.z)), slug).toBe(true);
    }
  });

  it("asks for a new world on a GitHub form that exists, filled in", () => {
    expect(existsSync(`.github/ISSUE_TEMPLATE/${WORLD_REQUEST_TEMPLATE}`)).toBe(true);
    const url = new URL(
      worldRequestUrl({ title: "The Dance Class", artist: "Edgar Degas", url: "https://x.test/1" }),
    );
    expect(url.searchParams.get("template")).toBe(WORLD_REQUEST_TEMPLATE);
    expect(url.searchParams.get("title")).toBe("World request: The Dance Class, Edgar Degas");
    expect(url.searchParams.get("painting")).toBe("The Dance Class");
    expect(url.searchParams.get("link")).toBe("https://x.test/1");
  });
});

describe("the Starry Night hill", () => {
  it("starts the visitor on the hilltop, clear of the cypress", () => {
    expect(insideBounds(START.x, START.z)).toBe(true);
    expect(blocked(START.x, START.z)).toBe(false);
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

  it("gives every point of the land a stroke direction, along the hill's contours", () => {
    for (let x = -500; x <= 500; x += 37) {
      for (let z = -480; z <= 100; z += 29) {
        const [fx, fz] = landFlow(x, z);
        expect(Math.hypot(fx, fz)).toBeCloseTo(1, 5);
      }
    }
    // On the hill's flank, a stroke barely climbs: it follows the slope round.
    const [fx, fz] = landFlow(40, -40);
    const climb = heightAt(40 + fx, -40 + fz) - heightAt(40, -40);
    const steepest = Math.hypot(
      heightAt(41, -40) - heightAt(40, -40),
      heightAt(40, -39) - heightAt(40, -40),
    );
    expect(steepest).toBeGreaterThan(0.2);
    expect(Math.abs(climb)).toBeLessThan(steepest * 0.15);
  });
});
