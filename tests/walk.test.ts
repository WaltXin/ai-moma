import { describe, expect, it } from "vitest";
import { getExhibitionsOnFloor, getFloors, getMovements } from "@/lib/museum/registry";
import {
  FRAME_W,
  ROW,
  Tile,
  buildFloorPlan,
  canSee,
  findPath,
  isElevatorTile,
  isWalkable,
  lenticularPosition,
  tileAt,
} from "@/lib/walk/floor-plan";

const plans = getFloors().map((floor) =>
  buildFloorPlan({
    floor,
    exhibitions: getExhibitionsOnFloor(floor),
    movements: getMovements(),
    floors: getFloors(),
  }),
);

describe("floor plans", () => {
  it("builds one room per exhibition and hangs every artwork", () => {
    for (const [i, floor] of getFloors().entries()) {
      const exhibitions = getExhibitionsOnFloor(floor);
      expect(plans[i].rooms.map((r) => r.slug)).toEqual(exhibitions.map((e) => e.slug));
      expect(plans[i].artworks).toHaveLength(exhibitions.flatMap((e) => e.artworks).length);
    }
  });

  it("is fully serializable", () => {
    for (const plan of plans) expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it("keeps paintings on the wall inside their room without overlapping", () => {
    for (const plan of plans) {
      for (const art of plan.artworks) {
        const room = plan.rooms[art.room];
        expect(art.x).toBeGreaterThanOrEqual(room.x);
        expect(art.x + FRAME_W).toBeLessThanOrEqual(room.x + room.w);
        for (let dx = 0; dx < FRAME_W; dx++) {
          expect(tileAt(plan, art.x + dx, ROW.faceBottom)).toBe(Tile.Face);
        }
      }
      const xs = plan.artworks.map((a) => a.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(FRAME_W - 1);
    }
  });

  it("lets a visitor walk from the elevator to see every painting and info stand", () => {
    for (const plan of plans) {
      for (const art of plan.artworks) {
        const spot = { x: art.x + 1, y: ROW.roomTop };
        expect(canSee(art, spot.x, spot.y)).toBe(true);
        expect(findPath(plan, plan.spawn, spot), `${plan.floor.slug}: ${art.id}`).not.toBeNull();
      }
      for (const room of plan.rooms) {
        const beside = { x: room.pedestal.x - 1, y: room.pedestal.y };
        expect(isWalkable(tileAt(plan, beside.x, beside.y))).toBe(true);
        expect(findPath(plan, plan.spawn, beside)).not.toBeNull();
      }
      const lift = { x: plan.elevator.x, y: ROW.roomTop };
      expect(isElevatorTile(plan, lift.x, lift.y)).toBe(true);
      expect(findPath(plan, plan.spawn, lift)).not.toBeNull();
    }
  });

  it("finds shortest paths and refuses walls", () => {
    const plan = plans[0];
    const path = findPath(plan, plan.spawn, { x: plan.spawn.x + 2, y: plan.spawn.y });
    expect(path).toEqual([
      { x: plan.spawn.x + 1, y: plan.spawn.y },
      { x: plan.spawn.x + 2, y: plan.spawn.y },
    ]);
    expect(findPath(plan, plan.spawn, { x: 0, y: 0 })).toBeNull();
  });

  it("ends every floor in a walkable lounge and never builds a sliver of a map", () => {
    for (const plan of plans) {
      expect(plan.cols).toBeGreaterThanOrEqual(56);
      const seat = { x: plan.lounge.x + 1, y: ROW.roomTop + 1 };
      expect(isWalkable(tileAt(plan, seat.x, seat.y))).toBe(true);
      expect(findPath(plan, plan.spawn, seat), plan.floor.slug).not.toBeNull();
    }
  });

  it("shows the first view from the left of a lenticular piece and the last from the right", () => {
    const art = { x: 10 };
    expect(lenticularPosition(art, 3, 0)).toBe(0);
    expect(lenticularPosition(art, 3, 30)).toBe(2);
    const mid = lenticularPosition(art, 3, art.x + 1);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1.5);
  });

  it("passes every view of an Agamograph to the walkable floor", () => {
    const perception = plans.find((p) => p.floor.slug === "perception")!;
    const lenticular = perception.artworks.filter((a) => a.frames);
    expect(lenticular.length).toBeGreaterThanOrEqual(3);
    for (const a of lenticular) expect(a.frames!.length).toBeGreaterThanOrEqual(2);
  });
});
