import { describe, expect, it } from "vitest";
import { paintAt } from "@/components/walk/paint";
import { getExhibitionsOnFloor, getFloors, getMovements } from "@/lib/museum/registry";
import { type Building, buildBuilding, inRect, spaceAt } from "@/lib/walk/building";
import {
  BAKE_LOW,
  type BakedLevel,
  type LightLayout,
  bakeLevel,
  ceilingLights,
  faceFor,
  lightLayout,
} from "@/lib/walk/light";

const building: Building = buildBuilding({
  floors: getFloors(),
  exhibitionsOn: getExhibitionsOnFloor,
  movements: getMovements(),
  labs: ["perception"],
});

/** Relative light (1 = typical) of an RGBA texel, green channel. */
const light = (data: Uint8Array, o: number) => {
  const x = data[o + 1] / 255;
  return 2 * (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
};

describe("baked light", () => {
  it("gives every plaster wall face its own rectangle in the atlas", () => {
    for (const level of building.levels) {
      const layout = lightLayout(level, BAKE_LOW);
      const { width, height, faces } = layout.atlas;
      for (const f of faces) {
        expect(f.x + f.cols, `level ${level.index}`).toBeLessThanOrEqual(width);
        expect(f.y + f.rows, `level ${level.index}`).toBeLessThanOrEqual(height);
      }
      for (let i = 0; i < faces.length; i++) {
        for (let j = i + 1; j < faces.length; j++) {
          const a = faces[i];
          const b = faces[j];
          const apart =
            a.x + a.cols <= b.x ||
            b.x + b.cols <= a.x ||
            a.y + a.rows <= b.y ||
            b.y + b.rows <= a.y;
          expect(apart, `level ${level.index}: faces ${i} and ${j} overlap`).toBe(true);
        }
      }
      // Both sides of every plaster wall, except an outer wall's outside (the façade).
      level.walls.forEach((w, wi) => {
        if (w.glass) return;
        for (const side of [-1, 1] as const) {
          const alongX = w.z0 === w.z1;
          const n = alongX ? { x: 0, z: side } : { x: side, z: 0 };
          const outside = w.outside && w.outside.x === n.x && w.outside.z === n.z;
          expect(Boolean(faceFor(layout, wi, side)), `level ${level.index} wall ${wi}`).toBe(
            !outside,
          );
        }
      });
    }
  });

  it("puts a laylight over every gallery and downlights only outside them", () => {
    for (const level of building.levels) {
      const { panels, downs } = ceilingLights(building, level);
      const galleries = level.spaces.filter((s) => s.kind === "gallery");
      expect(panels.length).toBeGreaterThanOrEqual(galleries.length);
      for (const d of downs)
        expect(spaceAt(level, d)?.kind, `level ${level.index}`).not.toBe("gallery");
    }
  });

  describe("on a gallery floor", () => {
    const level = building.levels[1];
    const layout: LightLayout = lightLayout(level, BAKE_LOW);
    const started = performance.now();
    const baked: BakedLevel = bakeLevel(building, layout, paintAt);
    const took = performance.now() - started;
    const room = building.rooms.find((r) => r.level === 1)!;

    it("bakes quickly enough for a worker", () => {
      expect(took).toBeLessThan(5000);
      expect(baked.atlas).toHaveLength(layout.atlas.width * layout.atlas.height * 4);
      expect(baked.floor).toHaveLength(layout.plan.cols * layout.plan.rows * 4);
    });

    it("is deterministic", () => {
      const again = bakeLevel(building, layout, paintAt);
      expect(Buffer.from(again.atlas).equals(Buffer.from(baked.atlas))).toBe(true);
      expect(Buffer.from(again.floor).equals(Buffer.from(baked.floor))).toBe(true);
    });

    it("lights a gallery floor most under its laylight, least by its walls", () => {
      const P = layout.plan;
      const at = (x: number, z: number) => {
        const i = Math.floor((x - P.x0) * BAKE_LOW.plan);
        const row = P.rows - 1 - Math.floor((z - P.z0) * BAKE_LOW.plan);
        return light(baked.floor, (row * P.cols + i) * 4);
      };
      const r = room.rect;
      const middle = at((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
      const corner = at(r.x0 + 0.4, r.z0 + 0.4);
      expect(middle).toBeGreaterThan(corner * 1.3);
    });

    it("darkens a gallery wall towards the floor and into its corners", () => {
      const r = room.rect;
      // The room's north wall, from inside: the wall whose inside face is r.z0.
      const wi = level.walls.findIndex(
        (w) =>
          w.z0 === w.z1 &&
          Math.abs(w.z0 + w.thick / 2 - r.z0) < 1e-6 &&
          w.x0 <= r.x0 + 1 &&
          w.x1 >= r.x1 - 1,
      );
      expect(wi).toBeGreaterThanOrEqual(0);
      const f = faceFor(layout, wi, 1)!;
      const d = BAKE_LOW.wall;
      const at = (x: number, v: number) =>
        light(
          baked.atlas,
          ((f.y + 1 + Math.floor(v * d)) * layout.atlas.width +
            f.x +
            1 +
            Math.floor((x - f.start) * d)) *
            4,
        );
      const mid = (r.x0 + r.x1) / 2;
      // Clear of doorways along this wall.
      const w = level.walls[wi];
      const clear = (x: number) =>
        !w.openings.some((o) => x > f.start + o.from - 0.5 && x < f.start + o.to + 0.5);
      const x = [mid, mid - 2, mid + 2].find(clear)!;
      expect(at(x, 1.6)).toBeGreaterThan(at(x, 0.15));
      expect(at(x, 1.6)).toBeGreaterThan(at(r.x0 + 0.2, 0.15) * 1.3);
      expect(inRect(r, { x, z: r.z0 + 0.1 })).toBe(true);
    });
  });
});
