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
  tileAt,
} from "@/lib/walk/floor-plan";
import {
  RADIUS,
  artCenter,
  atElevator,
  collides,
  lenticularView,
  lookingAt,
  move,
  route,
  spawnPose,
  viewpoint,
} from "@/lib/walk/motion";

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
    expect(lenticularView(art, 3, 0)).toBe(0);
    expect(lenticularView(art, 3, 30)).toBe(2);
    const mid = lenticularView(art, 3, art.x + 1.5);
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

describe("walking in 3D", () => {
  it("starts every visitor clear of the walls, near the lift", () => {
    for (const plan of plans) {
      const { at } = spawnPose(plan);
      expect(collides(plan, at), plan.floor.slug).toBe(false);
      expect(atElevator(plan, at)).toBe(false);
    }
  });

  it("stops at walls and slides along them", () => {
    const plan = plans[0];
    const { at } = spawnPose(plan);
    // Straight at the back wall: stop a body's width short of it.
    const stopped = move(plan, at, { x: 0, z: -20 });
    expect(stopped.z).toBeCloseTo(ROW.roomTop + RADIUS, 2);
    // At an angle: keep going sideways.
    const slid = move(plan, stopped, { x: 1, z: -1 });
    expect(slid.x).toBeCloseTo(stopped.x + 1, 5);
    expect(slid.z).toBeCloseTo(stopped.z, 5);
    // Never through a room's wall, even in one big jump.
    const room = plan.rooms[0];
    const inCorridor = { x: room.x + room.w - 1.5, z: ROW.corridorTop + 1 };
    const jumped = move(plan, inCorridor, { x: 0, z: -5 });
    expect(jumped.z).toBeGreaterThan(ROW.roomWall + 1);
  });

  it("can walk from the lift to stand in front of every painting, stand and the lift", () => {
    for (const plan of plans) {
      const { at } = spawnPose(plan);
      const targets = [
        ...plan.artworks.map((art) => ({ kind: "art" as const, art })),
        ...plan.rooms.map((room) => ({ kind: "room" as const, room })),
        { kind: "elevator" as const },
      ];
      for (const f of targets) {
        const view = viewpoint(plan, f);
        expect(collides(plan, view.at), `${plan.floor.slug}: ${f.kind}`).toBe(false);
        const legs = route(plan, at, view.at);
        expect(legs, `${plan.floor.slug}: ${f.kind}`).not.toBeNull();
        // Walking the legs never clips a wall.
        let p = at;
        for (const leg of legs!) {
          // Frame-sized steps, as the walk takes them.
          for (let n = 0; n < 2000 && Math.hypot(leg.x - p.x, leg.z - p.z) > 1e-9; n++) {
            const dx = leg.x - p.x;
            const dz = leg.z - p.z;
            const k = Math.min(1, 0.05 / Math.hypot(dx, dz));
            p = move(plan, p, { x: dx * k, z: dz * k });
          }
          expect(Math.hypot(p.x - leg.x, p.z - leg.z)).toBeLessThan(1e-6);
        }
        // From there, it's what the visitor is looking at.
        expect(lookingAt(plan, view.at, view.yaw)).toEqual(f);
      }
    }
  });

  it("only offers paintings you are facing", () => {
    const plan = plans.find((p) => p.artworks.length)!;
    const art = plan.artworks[0];
    const view = viewpoint(plan, { kind: "art", art });
    expect(lookingAt(plan, view.at, view.yaw)).toEqual({ kind: "art", art });
    expect(lookingAt(plan, view.at, view.yaw + Math.PI)?.kind).not.toBe("art");
    expect(artCenter(art).z).toBe(ROW.roomTop);
  });
});
