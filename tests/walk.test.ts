import { describe, expect, it } from "vitest";
import {
  getExhibitionsOnFloor,
  getFloors,
  getMovements,
  getStation,
  getStationMovements,
  getWorldsOnFloor,
} from "@/lib/museum/registry";
import { type Building, buildBuilding, inRect, spaceAt, stairPart } from "@/lib/walk/building";
import {
  type Focus,
  type Place,
  RADIUS,
  collides,
  groundAt,
  lenticularView,
  levelAfter,
  liftExitPose,
  lookingAt,
  move,
  route,
  startPose,
  viewpoint,
} from "@/lib/walk/motion";
import { TRIM, corniceHeight, roomSign, wallTrim } from "@/lib/walk/trim";

const building: Building = buildBuilding({
  floors: getFloors(),
  exhibitionsOn: getExhibitionsOnFloor,
  movements: getMovements(),
  labs: ["perception"],
  stations: Object.fromEntries(getStationMovements().map((m) => [m, getStation(m)!])),
  worlds: Object.fromEntries(
    getFloors().map((f) => [
      f.slug,
      getWorldsOnFloor(f).map((w) => ({ slug: w.slug, title: w.title, blurb: w.intro })),
    ]),
  ),
});

/** Walks a route the way the walk does, in small steps; returns where it ends up. */
function walk(b: Building, from: Place, legs: { x: number; z: number }[]): Place {
  let at = from;
  for (const leg of legs) {
    for (let n = 0; n < 4000 && Math.hypot(leg.x - at.pos.x, leg.z - at.pos.z) > 1e-6; n++) {
      const dx = leg.x - at.pos.x;
      const dz = leg.z - at.pos.z;
      const k = Math.min(1, 0.08 / Math.hypot(dx, dz));
      const before = at.pos;
      at = move(b, at, { x: dx * k, z: dz * k });
      // Stuck against something the route said was clear.
      if (Math.hypot(at.pos.x - before.x, at.pos.z - before.z) < 1e-9) break;
    }
  }
  return at;
}

describe("the building", () => {
  it("has a floor per floor of content, in order, with every exhibition as a room on it", () => {
    const floors = getFloors();
    expect(building.levels.map((l) => l.slug)).toEqual(floors.map((f) => f.slug));
    for (const [i, floor] of floors.entries()) {
      const rooms = building.rooms.filter((r) => r.level === i);
      expect(rooms.map((r) => r.slug)).toEqual(getExhibitionsOnFloor(floor).map((e) => e.slug));
    }
    const works = floors.flatMap((f) => getExhibitionsOnFloor(f).flatMap((e) => e.artworks));
    expect(building.artworks.map((a) => a.id).sort()).toEqual(works.map((a) => a.id).sort());
  });

  it("gives every painting world a room of its own on its floor, with the way in at a kiosk", () => {
    for (const floor of getFloors()) {
      const level = building.levels.find((l) => l.slug === floor.slug)!;
      for (const world of getWorldsOnFloor(floor)) {
        const portal = building.portals.find((p) => p.id === `world-${world.slug}`);
        expect(portal, world.slug).toBeDefined();
        expect(portal!.level).toBe(level.index);
        expect(portal!.href).toBe(`/worlds/${world.slug}`);
        // The kiosk stands in the room named after the painting: somewhere to sit before and after.
        const room = spaceAt(level, portal!.at);
        expect(room?.name).toBe(world.title);
        expect(room?.kind).toBe("lounge");
      }
    }
  });

  it("is plain data", () => {
    expect(JSON.parse(JSON.stringify(building))).toEqual(building);
  });

  it("stacks the floors, lobby tallest, with a terrace the upper floors step back from", () => {
    const ys = building.levels.map((l) => l.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    expect(building.levels[0].ceiling).toBeGreaterThan(building.levels[1].ceiling);
    const terrace = building.levels.findIndex((l) => l.spaces.some((s) => s.kind === "terrace"));
    expect(terrace).toBeGreaterThan(0);
    for (const l of building.levels.slice(terrace + 1)) {
      expect(building.footprints[l.index].x1).toBeLessThan(building.footprints[terrace].x1);
    }
  });

  it("hangs every work on a wall of its own room, facing in, apart from the others and clear of doors", () => {
    for (const room of building.rooms) {
      const works = building.artworks.filter((a) => building.rooms[a.room] === room);
      const spots = [...works, ...room.emptySlots];
      const r = room.rect;
      for (const s of spots) {
        // On one of the four inside faces.
        const onWall =
          (Math.abs(s.x - r.x0) < 1e-6 && s.nx === 1) ||
          (Math.abs(s.x - r.x1) < 1e-6 && s.nx === -1) ||
          (Math.abs(s.z - r.z0) < 1e-6 && s.nz === 1) ||
          (Math.abs(s.z - r.z1) < 1e-6 && s.nz === -1);
        expect(onWall, `${room.slug} at ${s.x},${s.z}`).toBe(true);
        expect(inRect(r, s, 1e-6)).toBe(true);
        // Nothing hangs over a doorway.
        const level = building.levels[room.level];
        for (const w of level.walls) {
          const alongX = w.z0 === w.z1;
          const line = alongX ? w.z0 : w.x0;
          const at = alongX ? s.z : s.x;
          if (Math.abs(line - at) > w.thick) continue;
          const p = alongX ? s.x : s.z;
          const start = alongX ? w.x0 : w.z0;
          for (const o of w.openings) {
            if (o.kind !== "door") continue;
            expect(p < start + o.from - 1 || p > start + o.to + 1, `${room.slug}: ${p} by a door`).toBe(true);
          }
        }
      }
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThan(2.2);
        }
      }
    }
    // The Community Gallery keeps frames waiting for visitors' work.
    const community = building.rooms.find((r) => r.kind === "community")!;
    expect(community.emptySlots.length).toBeGreaterThanOrEqual(4);
  });

  it("starts a visit inside the front doors, clear of everything", () => {
    const s = startPose(building);
    expect(s.level).toBe(0);
    expect(collides(building, 0, s.pos)).toBe(false);
    expect(spaceAt(building.levels[0], s.pos)?.kind).toBe("lobby");
    for (const l of building.levels) {
      expect(collides(building, l.index, liftExitPose(building, l.index).pos), l.slug).toBe(false);
    }
  });
});

describe("walking the building", () => {
  const start = startPose(building);

  it("walks from the front doors to every painting, lectern, kiosk, the desk and the lift on every floor", () => {
    const targets: Focus[] = [
      ...building.artworks.map((art) => ({ kind: "art" as const, art })),
      ...building.rooms.map((room) => ({ kind: "room" as const, room })),
      ...building.portals.map((portal) => ({ kind: "portal" as const, portal })),
      { kind: "desk" },
    ];
    const lifts = building.levels.map((l) => ({ f: { kind: "lift" } as Focus, level: l.index }));
    for (const t of [...targets.map((f) => ({ f, level: 0 })), ...lifts]) {
      const view = viewpoint(building, t.f, t.level);
      const label = `${t.f.kind} on ${building.levels[view.level].slug}`;
      expect(collides(building, view.level, view.at), label).toBe(false);
      const legs = route(building, { level: start.level, pos: start.pos }, { level: view.level, pos: view.at });
      expect(legs, label).not.toBeNull();
      const end = walk(building, start, legs!);
      expect(end.level, label).toBe(view.level);
      expect(Math.hypot(end.pos.x - view.at.x, end.pos.z - view.at.z), label).toBeLessThan(1e-3);
      // And from there, it's what the visitor is looking at.
      expect(lookingAt(building, { level: view.level, pos: view.at }, view.yaw), label).toEqual(t.f);
    }
  });

  it("climbs the grand stair to Floor 2, rising step by step, and comes back down", () => {
    const grand = building.stairs.find((s) => s.kind === "grand")!;
    const x = (grand.rect.x0 + grand.rect.x1) / 2;
    let at: Place = { level: 0, pos: { x, z: grand.rect.z1 + 1 } };
    let lastY = groundAt(building, 0, at.pos);
    for (let i = 0; i < 200; i++) {
      at = move(building, at, { x: 0, z: -0.08 });
      const y = groundAt(building, at.level, at.pos);
      expect(y).toBeGreaterThanOrEqual(lastY - 1e-9);
      lastY = y;
    }
    expect(at.level).toBe(1);
    expect(lastY).toBe(building.levels[1].y);
    for (let i = 0; i < 200; i++) at = move(building, at, { x: 0, z: 0.08 });
    expect(at.level).toBe(0);
    expect(groundAt(building, 0, at.pos)).toBe(0);
  });

  it("joins each floor to the next by a stair across the atrium", () => {
    for (let i = 1; i + 1 < building.levels.length; i++) {
      const s = building.stairs.find((st) => st.from === i && st.to === i + 1);
      expect(s, `floor ${i + 1} up`).toBeDefined();
      // Both halves of the flight belong to the floors it joins.
      expect(stairPart(s!, i)).not.toBeNull();
      expect(stairPart(s!, i + 1)).not.toBeNull();
    }
  });

  it("can't step onto a stair from the side, or off a balcony into the atrium", () => {
    const grand = building.stairs.find((s) => s.kind === "grand")!;
    // From the lobby, beside the stair halfway up: blocked, and still on the ground floor.
    const beside: Place = { level: 0, pos: { x: grand.rect.x1 + 0.6, z: (grand.rect.z0 + grand.rect.z1) / 2 + 1 } };
    const pushed = move(building, beside, { x: -3, z: 0 });
    expect(pushed.level).toBe(0);
    expect(pushed.pos.x).toBeGreaterThan(grand.rect.x1);
    // On Floor 3, walking into the atrium stops at the glass.
    const a = building.atrium;
    const balcony: Place = { level: 2, pos: { x: a.x1 + 2, z: (a.z0 + a.z1) / 2 } };
    expect(collides(building, 2, balcony.pos)).toBe(false);
    const stopped = move(building, balcony, { x: -5, z: 0 });
    expect(stopped.pos.x).toBeGreaterThan(a.x1 + RADIUS - 1e-6);
  });

  it("stops at walls and slides along them, and only gets through glass at a door", () => {
    // Into the lobby's north wall: stop a body's width short of it.
    const stopped = move(building, { level: 0, pos: { x: 24, z: 13 } }, { x: 0, z: -10 });
    expect(stopped.pos.z).toBeGreaterThan(10);
    expect(stopped.pos.z).toBeLessThan(10.15 + RADIUS + 0.05);
    const slid = move(building, stopped, { x: 1, z: -1 });
    expect(slid.pos.x).toBeCloseTo(stopped.pos.x + 1, 5);
    // The glass front: solid beside the doors, open through them, out onto the street.
    const glass = move(building, { level: 0, pos: { x: 16, z: 40 } }, { x: 0, z: 5 });
    expect(glass.pos.z).toBeLessThan(building.entrance.doors.z);
    const out = move(building, { level: 0, pos: { x: 24, z: 40 } }, { x: 0, z: 5 });
    expect(out.pos.z).toBeGreaterThan(building.entrance.doors.z + 1);
    expect(spaceAt(building.levels[0], out.pos)?.kind).toBe("outside");
    // But not into the road.
    const kerb = move(building, out, { x: 0, z: 20 });
    expect(kerb.pos.z).toBeLessThan(50);
  });

  it("changes floor only halfway up a flight", () => {
    const s = building.stairs.find((st) => st.kind === "atrium")!;
    const x = (s.rect.x0 + s.rect.x1) / 2;
    const bottomZ = s.rise === "n" ? s.rect.z1 : s.rect.z0;
    const dir = s.rise === "n" ? -1 : 1;
    const len = s.rect.z1 - s.rect.z0;
    expect(levelAfter(building, s.from, { x, z: bottomZ + dir * len * 0.4 })).toBe(s.from);
    expect(levelAfter(building, s.from, { x, z: bottomZ + dir * len * 0.52 })).toBe(s.to);
    expect(levelAfter(building, s.to, { x, z: bottomZ + dir * len * 0.48 })).toBe(s.from);
  });

  it("only offers paintings you are facing", () => {
    const art = building.artworks[0];
    const view = viewpoint(building, { kind: "art", art });
    const at = { level: view.level, pos: view.at };
    expect(lookingAt(building, at, view.yaw)).toEqual({ kind: "art", art });
    expect(lookingAt(building, at, view.yaw + Math.PI)?.kind).not.toBe("art");
  });
});

describe("lenticular works", () => {
  it("shows the first view from the left of a piece and the last from the right", () => {
    // On a north wall: facing it (looking north), left is west.
    const art = { x: 10, z: 0, nx: 0, nz: 1 };
    expect(lenticularView(art, 3, { x: 0, z: 3 })).toBe(0);
    expect(lenticularView(art, 3, { x: 20, z: 3 })).toBe(2);
    const mid = lenticularView(art, 3, { x: 10, z: 3 });
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1.5);
  });

  it("passes every view of an Agamograph to the walk", () => {
    const lenticular = building.artworks.filter((a) => a.frames);
    expect(lenticular.length).toBeGreaterThanOrEqual(3);
    for (const a of lenticular) expect(a.frames!.length).toBeGreaterThanOrEqual(2);
  });

  it("gives the walk a large copy to zoom into for public-domain works and Studio pieces", () => {
    const pd = building.artworks.filter((a) => a.credit);
    expect(pd.filter((a) => a.zoom).length).toBeGreaterThan(pd.length * 0.8);
    for (const a of building.artworks.filter((x) => x.zoom)) {
      expect(a.zoom!.width, a.id).toBeGreaterThanOrEqual(a.image!.width);
    }
    // Code-drawn pieces are SVG: their own file is sharp at any size.
    for (const a of building.artworks.filter((x) => x.generative && !x.frames)) expect(a.zoom?.src, a.id).toBe(a.image!.src);
  });
});

describe("the plasterwork", () => {
  const faces = building.levels.map((level) => ({ level, trim: wallTrim(building, level) }));
  const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

  it("gives the lobby and every atrium floor pilasters and arches, the galleries a plain finish", () => {
    for (const { level, trim } of faces) {
      const grand = trim.filter((f) => f.style === "grand");
      expect(grand.flatMap((f) => f.pilasters).length, `level ${level.index}`).toBeGreaterThanOrEqual(4);
      expect(grand.flatMap((f) => f.panels).filter((p) => p.arch).length, `level ${level.index}`).toBeGreaterThanOrEqual(2);
      for (const f of trim) {
        const w = level.walls[f.wall];
        const mid = (f.along === "x" ? (w.x0 + w.x1) / 2 : (w.z0 + w.z1) / 2);
        const p = f.along === "x" ? { x: mid, z: f.line + f.n.z * 0.3 } : { x: f.line + f.n.x * 0.3, z: mid };
        if (spaceAt(level, p)?.kind === "gallery") expect(f.style, `level ${level.index} wall ${f.wall}`).toBe("plain");
      }
    }
  });

  it("keeps pilasters and panels on the wall, clear of doorways, signs, the floor's name and the stair", () => {
    for (const { level, trim } of faces) {
      const sign = roomSign(level);
      for (const f of trim) {
        const w = level.walls[f.wall];
        const start = f.along === "x" ? w.x0 : w.z0;
        const end = f.along === "x" ? w.x1 : w.z1;
        const spans: [number, number][] = [
          ...f.pilasters.map((p) => [p - 0.32, p + 0.32] as [number, number]),
          ...f.panels.map((p) => [p.a, p.b] as [number, number]),
        ];
        const where = `level ${level.index} wall ${f.wall}`;
        for (const [a, b] of spans) {
          expect(a, where).toBeGreaterThan(start);
          expect(b, where).toBeLessThan(end);
          // Every opening, with its casing.
          const c = TRIM[f.style].casing;
          for (const o of w.openings) {
            expect(overlaps(a, b, start + o.from - c, start + o.to + c), `${where}: opening`).toBe(false);
          }
          for (const r of building.rooms.filter((r) => r.level === level.index)) {
            const across = f.along === "x" ? r.door.z - r.inward.z * w.thick : r.door.x - r.inward.x * w.thick;
            if (Math.abs(across - f.line) > 0.05) continue;
            const s = f.along === "x" ? r.door.x : r.door.z;
            expect(overlaps(a, b, s - sign.w / 2, s + sign.w / 2), `${where}: ${r.slug}'s name`).toBe(false);
          }
          const L = level.lettering;
          if (f.along === "x" && Math.abs(f.line - L.z) < 0.05) {
            expect(overlaps(a, b, L.x - L.w / 2, L.x + L.w / 2), `${where}: the floor's name`).toBe(false);
          }
          for (const st of building.stairs.filter((st) => st.from === level.index && st.kind === "grand")) {
            if (f.along === "z" && Math.abs(f.line - st.rect.x0) < 0.3) {
              expect(overlaps(a, b, st.rect.z0, st.rect.z1), `${where}: the grand stair`).toBe(false);
            }
          }
        }
        for (const p of f.panels) {
          expect(p.y0, where).toBeGreaterThan(f.skirting);
          expect(p.y1, where).toBeLessThan(f.height - f.cornice);
        }
      }
    }
  });

  it("fits every room's name between its doorway's casing and the cornice", () => {
    for (const room of building.rooms) {
      const level = building.levels[room.level];
      const sign = roomSign(level);
      const wall = level.walls.find((w) =>
        w.z0 === w.z1
          ? Math.abs(w.z0 - room.door.z) < 0.5 && room.door.x > w.x0 && room.door.x < w.x1
          : Math.abs(w.x0 - room.door.x) < 0.5 && room.door.z > w.z0 && room.door.z < w.z1,
      )!;
      const s = wall.z0 === wall.z1 ? room.door.x - wall.x0 : room.door.z - wall.z0;
      const door = wall.openings.find((o) => o.from < s && o.to > s);
      if (!door) continue; // A room off the enfilade is named from the room before it.
      const bottom = sign.y - sign.h / 2;
      const top = sign.y + sign.h / 2;
      expect(bottom, room.slug).toBeGreaterThan(door.top + TRIM.grand.casing);
      expect(top, room.slug).toBeLessThan(level.ceiling - corniceHeight(level, "grand"));
    }
  });
});
