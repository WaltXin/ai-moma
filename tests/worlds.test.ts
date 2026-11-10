import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENES } from "@/components/worlds/scenes";
import { getWorlds } from "@/lib/museum/registry";
import { arrivalOf } from "@/lib/worlds/place";
import { PLACES } from "@/lib/worlds/places";
import * as SUN from "@/lib/worlds/sunflowers";
import * as WHEAT from "@/lib/worlds/wheat-field";
import { WORLD_REQUEST_TEMPLATE, worldRequestUrl } from "@/lib/worlds/request";
import {
  BOUNDS,
  CYPRESS,
  CYPRESS_BUSHES,
  MOON,
  OLIVES,
  START,
  STARS,
  VILLAGE,
  WIND,
  blocked,
  clampToBounds,
  grassAt,
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

  it("brings every visitor in from somewhere they may stand, with a clear walk to their place", () => {
    for (const [slug, p] of Object.entries(PLACES)) {
      const a = arrivalOf(p);
      expect(p.clampToBounds(a.x, a.z), slug).toEqual(a);
      // A few steps at most, and nothing in the way.
      expect(Math.hypot(a.x - p.start.x, a.z - p.start.z), slug).toBeLessThan(5);
      for (let i = 0; i <= 20; i++) {
        const x = a.x + ((p.start.x - a.x) * i) / 20;
        const z = a.z + ((p.start.z - a.z) * i) / 20;
        expect(p.blocked(x, z), `${slug} step ${i}`).toBe(false);
      }
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

  it("walks the visitor in over the hilltop, from behind where they'll stand", () => {
    const a = arrivalOf(PLACES["starry-night"]);
    expect(a.z).toBeGreaterThan(START.z + 3);
    expect(insideBounds(a.x, a.z)).toBe(true);
  });

  it("stands olives and the cypress's bushes on the hilltop, clear of the view of the village", () => {
    for (const t of [...OLIVES, ...CYPRESS_BUSHES]) {
      expect(heightAt(t.x, t.z), `tree at ${t.x}, ${t.z}`).toBeGreaterThan(20);
      // In the way of a walker, and nowhere near where they come in.
      expect(blocked(t.x, t.z)).toBe(true);
      expect(Math.hypot(t.x - START.x, t.z - START.z)).toBeGreaterThan(8);
    }
    // An olive's leaves are overhead: only its stem is in the way.
    for (const t of OLIVES) {
      expect(t.trunk).toBeGreaterThan(1);
      expect(blocked(t.x + t.r * 0.8, t.z)).toBe(false);
      // Behind the visitor or well out to the side, never between them and the village.
      expect(t.z > START.z || Math.abs(t.x - START.x) > 20, `olive at ${t.x}`).toBe(true);
    }
    // The bushes are at the cypress's foot.
    for (const t of CYPRESS_BUSHES)
      expect(Math.hypot(t.x - CYPRESS.x, t.z - CYPRESS.z)).toBeLessThan(5);
  });

  it("grows grass over the hilltop and nowhere else, with the wind in it", () => {
    for (let x = -80; x <= 80; x += 3.7) {
      for (let z = -60; z <= 50; z += 3.1) {
        const g = grassAt(x, z);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
      }
    }
    expect(grassAt(START.x, START.z)).toBeGreaterThan(0.2);
    // None under a tree, none down in the village.
    for (const t of [...OLIVES, ...CYPRESS_BUSHES]) expect(grassAt(t.x, t.z)).toBe(0);
    expect(grassAt(CYPRESS.x, CYPRESS.z)).toBe(0);
    for (const h of VILLAGE.houses) expect(grassAt(h.x, h.z)).toBe(0);
    expect(Math.hypot(...WIND)).toBeCloseTo(1, 2);
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

describe("the Wheat Field", () => {
  const W = WHEAT;
  const az = (x: number, z: number) => Math.atan2(x - W.START.x, -(z - W.START.z));

  it("starts the visitor in the grass, with the wheat right in front", () => {
    expect(W.wheatAt(W.START.x, W.START.z)).toBe(0);
    expect(W.wheatAt(W.START.x, W.START.z - 25)).toBeCloseTo(1, 5);
  });

  it("stands the cypresses on the right, out of reach, and the olive on the left", () => {
    for (const c of W.CYPRESSES) {
      expect(az(c.x, c.z)).toBeGreaterThan(0);
      expect(W.insideBounds(c.x, c.z)).toBe(false);
    }
    for (const b of W.OLIVE) expect(az(b.x, b.z)).toBeLessThan(0);
    // The olive's trunk can't be walked through.
    expect(W.blocked(W.OLIVE[0].x, W.OLIVE[0].z)).toBe(true);
  });

  it("keeps the wheat, waving, below a sitting visitor's eyes", () => {
    // The wind lifts it by at most 0.08 m; a sitting visitor's eyes are 0.9 m up.
    expect(W.WHEAT_HEIGHT + 0.08).toBeLessThan(0.9);
  });

  it("gives every point of the field a stroke direction", () => {
    for (let x = -100; x <= 100; x += 13) {
      for (let z = -80; z <= 20; z += 11) {
        const [fx, fz] = W.fieldFlow(x, z);
        expect(Math.hypot(fx, fz)).toBeCloseTo(1, 5);
      }
    }
  });

  it("paints clouds where the clouds are, and clear sky between", () => {
    for (const c of W.CLOUDS) expect(W.cloudAt(c.az, c.el)).toBeCloseTo(1, 5);
    expect(W.cloudAt(0, Math.PI / 2 - 0.05)).toBeLessThan(0.5);
  });
});

describe("the Sunflowers table", () => {
  const S = SUN;

  it("hangs fifteen sunflowers over the jug, in every stage of their lives", () => {
    expect(S.FLOWERS).toHaveLength(15);
    const stages = new Set(S.FLOWERS.map((f) => f.stage));
    expect([...stages].sort()).toEqual(["bloom", "open", "seed", "wilting"]);
    // Every head is high above a small visitor, clear of the jug's body.
    for (const f of S.FLOWERS) {
      expect(f.y - f.r, `flower ${f.seed}`).toBeGreaterThan(10);
      const out = Math.hypot(f.x, f.z);
      expect(out > S.JUG_RADIUS || f.y > S.JUG_TOP, `flower ${f.seed}`).toBe(true);
    }
  });

  it("faces every head somewhere, at unit length", () => {
    for (const f of S.FLOWERS) {
      const d = S.facing(f);
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 5);
    }
  });

  it("keeps the visitor on the table and out of the jug", () => {
    expect(S.blocked(S.JUG.x, S.JUG.z)).toBe(true);
    // The table's edge drops to the floor, beyond where they may walk.
    expect(S.heightAt(0, S.TABLE.front + 10)).toBeLessThan(-50);
    expect(S.insideBounds(0, S.TABLE.front + 1)).toBe(false);
    expect(S.insideBounds(S.TABLE.half + 1, 0)).toBe(false);
    const c = S.clampToBounds(500, 500);
    expect(S.insideBounds(c.x, c.z, 0.4)).toBe(true);
  });

  it("drops its fallen petals on the table, clear of the jug", () => {
    for (const p of S.FALLEN) {
      expect(Math.abs(S.heightAt(p.x, p.z))).toBeLessThan(1e-9);
      expect(Math.hypot(p.x - S.JUG.x, p.z - S.JUG.z)).toBeGreaterThan(S.JUG_RADIUS);
    }
  });
});
