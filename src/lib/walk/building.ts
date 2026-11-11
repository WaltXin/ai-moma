import { type FrameKind, frameFor } from "@/lib/museum/frames";
import type {
  Artwork,
  ArtworkCredit,
  Exhibition,
  Floor,
  ImageFile,
  Movement,
  PlaceholderPattern,
} from "@/lib/museum/types";

/**
 * The museum as one building, in metres: every floor stacked around a
 * skylit atrium, from the lobby and the street outside up to the top-lit
 * galleries. The 3D walk (`components/walk/scene.ts`) raises it; movement,
 * stairs and routes (`motion.ts`) walk it. It's plain data, safe to pass from
 * a Server Component to the client.
 *
 * x runs east, z runs south toward the street, y is up. Every floor has the
 * same plan, seen from above:
 *
 *        0        12   18          30   34        46
 *     0  ┌─────────┬───────────────────┬─────────┐
 *        │   NW    │   core: lettering │   NE    │
 *    10  │         ├────┬─────────┬────┤         │
 *    14  ├──  ──── │ring│  atrium │ring│ ────  ──┤   rooms open onto the ring,
 *        │    W    │    │ (void,  │    │    E    │   and into each other in a
 *    28  ├──  ──── │    │ stairs) │    │ ────  ──┤   line, so you can see
 *        │   SW    │    └─────────┘    │   SE    │   through three at once
 *    42  └─────────┴───── lounge ──────┴─────────┘
 *                         street ↓
 *
 * The ground floor is the lobby: entrance, information desk, café, store,
 * the Community Gallery and the Studio, with a grand oak stair up to Floor 2.
 * Above, open stairs zigzag across the atrium from floor to floor, and a glass
 * lift rides up its west side. Floor 5 opens onto a sculpture terrace with a
 * living wall; the floors above step back from it.
 *
 * Exhibitions fill the rooms in walking order. Rooms a floor doesn't need
 * become lounges and reading rooms, as in a real museum.
 */

export type Vec = { x: number; z: number };
export type Rect = { x0: number; z0: number; x1: number; z1: number };
export type Surface = "wood" | "stone" | "deck" | "street";

export type SpaceKind =
  | "gallery"
  | "ring"
  | "lobby"
  | "lounge"
  | "reading"
  | "studio"
  | "lab"
  | "cafe"
  | "shop"
  | "terrace"
  | "outside";

/** A named area of a floor: what it's called, what's underfoot, how its walls are painted. */
export type Space = {
  kind: SpaceKind;
  name: string;
  rect: Rect;
  surface: Surface;
  /** Index into `Building.rooms`, for galleries. */
  room?: number;
};

/** A gap in a wall, measured along it from its start and up from the floor. */
export type Opening = {
  from: number;
  to: number;
  bottom: number;
  top: number;
  kind: "door" | "window" | "glass" | "entrance";
};

/** A straight, axis-aligned wall. */
export type Wall = {
  /** Centre line: x0 === x1 or z0 === z1, with x0 ≤ x1 and z0 ≤ z1. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  thick: number;
  /** Height above the floor; defaults to the ceiling. */
  top?: number;
  openings: Opening[];
  /** Unit vector toward the outside, for the building's outer walls. */
  outside?: Vec;
  /** A glass wall: panes and mullions instead of plaster. */
  glass?: boolean;
};

/** Edge of a walkable area: glass balustrade, a stair's side, or the kerb outside. */
export type Rail = Rect & { kind: "glass" | "stair" | "edge" };

export type ItemKind =
  | "bench"
  | "sofa"
  | "armchair"
  | "low-table"
  | "plant"
  | "tree"
  | "lectern"
  | "desk"
  | "cafe-counter"
  | "cafe-table"
  | "book-table"
  | "shelf"
  | "bookcase"
  | "reading-table"
  | "workbench"
  | "kiosk"
  | "plinth"
  | "sculpture"
  | "planter"
  | "bollard"
  | "lamp"
  | "shaft"
  | "solid";

/**
 * Furniture and fixtures: a box `w` (along x) by `d` (along z) centred on
 * (x, z). `rot` is the yaw of someone using it: sitting on it, reading it,
 * standing at its counter.
 */
export type Item = {
  kind: ItemKind;
  x: number;
  z: number;
  w: number;
  d: number;
  rot: number;
  /** Blocks walking. */
  solid: boolean;
  variant?: number;
};

/** Something on a floor that leads elsewhere on the site: the Studio, a lab, a hands-on station, the learning guides, a painting world. */
export type Portal = {
  id: string;
  level: number;
  title: string;
  blurb: string;
  href: string;
  /** The kiosk or sign, and the yaw a visitor faces to read it. */
  at: Vec;
  yaw: number;
  kind: "studio" | "lab" | "station" | "learn" | "world";
};

/** A painting world entered from a floor: what its kiosk says, and where it leads. */
export type WorldDoor = { slug: string; title: string; blurb: string };

export type PlanArtwork = {
  id: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  /** The image, or the first view of a lenticular piece. */
  image?: ImageFile;
  /** A large copy to zoom into, brushstroke by brushstroke. */
  zoom?: ImageFile;
  /** Every view of a lenticular piece (Agamograph), left to right. */
  frames?: ImageFile[];
  credit?: ArtworkCredit;
  /** Drawn with code by the Studio. */
  generative?: boolean;
  /** Gilt, black or a mat, the same frame the site hangs it in. */
  frame: FrameKind;
  generation?: Artwork["generation"];
  /** Index into `Building.rooms`. */
  room: number;
  level: number;
  /** Centre of the picture on the wall's face. */
  x: number;
  z: number;
  /** Unit normal out of the wall, into the room. */
  nx: number;
  nz: number;
};

/** A spot on a wall: where a work hangs, or a frame waits for one. */
export type WallSpot = { x: number; z: number; nx: number; nz: number };

export type PlanRoom = {
  slug: string;
  title: string;
  description: string;
  curator: string;
  kind: Exhibition["kind"];
  movement: {
    slug: string;
    name: string;
    period: string;
    summary: string;
    palette: string[];
    pattern: PlaceholderPattern;
    studioOpen: boolean;
    /** The movement's hands-on station, if it has one. */
    station?: string;
  };
  level: number;
  /** Inside faces of the walls. */
  rect: Rect;
  /** Middle of the doorway from the ring, and the way into the room. */
  door: Vec;
  inward: Vec;
  /** The lectern with the room's story, and the yaw a reader faces. */
  stand: Vec;
  standYaw: number;
  /** Frames waiting for work (the Community Gallery). */
  emptySlots: WallSpot[];
};

export type Level = {
  index: number;
  /** The floor's number in the building, 1 = ground. */
  number: number;
  slug: string;
  name: string;
  tagline: string;
  /** Height of the floor. */
  y: number;
  /** Floor to ceiling. */
  ceiling: number;
  /** Walkable floor, without the stairs (`motion.ts` adds those). */
  floors: { rect: Rect; surface: Surface }[];
  walls: Wall[];
  rails: Rail[];
  items: Item[];
  spaces: Space[];
  /** Big lettering on the core wall facing the atrium, `w` wide. */
  lettering: { x: number; z: number; yaw: number; w: number };
};

/** Straight flight of stairs from one floor to the next, rising toward `rise`. */
export type Stair = {
  id: string;
  from: number;
  to: number;
  rect: Rect;
  rise: "n" | "s";
  kind: "grand" | "atrium";
};

export type Building = {
  name: string;
  levels: Level[];
  stairs: Stair[];
  lift: {
    /** The glass shaft, rising through every floor. */
    shaft: Rect;
    /** Its doors, on the shaft's west face. */
    doorZ0: number;
    doorZ1: number;
    /** Where a rider stands, and where to stand to call it. */
    car: Vec;
    call: Vec;
  };
  rooms: PlanRoom[];
  artworks: PlanArtwork[];
  portals: Portal[];
  atrium: Rect;
  /** The round skylight over the atrium. */
  oculus: { x: number; z: number; r: number };
  roofY: number;
  /** Outline of the building on each floor, for the façades. */
  footprints: Rect[];
  /** Planted wall on the terrace, if there is one. */
  greenWall?: { x: number; z0: number; z1: number; y0: number; y1: number };
  /** Where a visit starts: just inside the front doors. */
  entrance: { at: Vec; yaw: number; doors: { x0: number; x1: number; z: number } };
};

// ── Dimensions ────────────────────────────────────────────────────────────

export const SLAB = 0.5;
const LOBBY_H = 6;
const FLOOR_H = 5;
const EXT = 0.5;
const INT = 0.3;
const DOOR_W = 2.4;
const DOOR_H = 3.2;

const D = 42;
const FULL_W = 46;
const TOP_W = 34;
/** West wing ends, east wing starts. */
const WEST = 12;
const EAST = 34;
const CORE_Z = 10;
const ATRIUM: Rect = { x0: 18, z0: 14, x1: 30, z1: 28 };
/** Grand stair from the lobby to Floor 2. */
const GRAND: Rect = { x0: 12.15, z0: 29.4, x1: 18, z1: 40 };
const LANES = { a: { x0: 25.5, x1: 27.5 }, b: { x0: 21.5, x1: 23.5 } };
const SHAFT: Rect = { x0: 18, z0: 19, x1: 20.5, z1: 21.5 };
/** The floor (index) whose east wing is the open-air terrace; floors above step back. */
const TERRACE_AT = 4;
const PLAZA: Rect = { x0: -14, z0: D, x1: 60, z1: 50 };

type Slot = "NW" | "W" | "SW" | "NE" | "E" | "SE";
const SLOTS: Record<Slot, Rect> = {
  NW: { x0: 0, z0: 0, x1: WEST, z1: 14 },
  W: { x0: 0, z0: 14, x1: WEST, z1: 28 },
  SW: { x0: 0, z0: 28, x1: WEST, z1: D },
  NE: { x0: EAST, z0: 0, x1: FULL_W, z1: 14 },
  E: { x0: EAST, z0: 14, x1: FULL_W, z1: 28 },
  SE: { x0: EAST, z0: 28, x1: FULL_W, z1: D },
};
/** Walking order: down the west wing, across the lounge, up the east wing. */
const ORDER: Slot[] = ["NW", "W", "SW", "SE", "E", "NE"];
/** Where each slot's door onto the ring is, along its inner wall. */
const RING_DOOR_Z: Record<Slot, number> = { NW: 12.2, W: 21, SW: 35, NE: 12.2, E: 21, SE: 35 };
/** Doorways between rooms in a wing line up on one axis. */
const ENFILADE_X = { west: 6, east: 40 };

/** Painting slots: frame plus breathing room. */
const HANG_PITCH = 3.4;
const COMMUNITY_SLOTS = 4;

const levelY = (i: number) => (i === 0 ? 0 : LOBBY_H + (i - 1) * FLOOR_H);
const isWest = (s: Slot) => s === "NW" || s === "W" || s === "SW";

export const inRect = (r: Rect, p: Vec, pad = 0) =>
  p.x >= r.x0 - pad && p.x <= r.x1 + pad && p.z >= r.z0 - pad && p.z <= r.z1 + pad;

export function buildBuilding(input: {
  floors: Floor[];
  exhibitionsOn: (floor: Floor) => Exhibition[];
  movements: Movement[];
  /** Floors that also have a hands-on lab (`/floors/[slug]/walk`). */
  labs?: string[];
  /** Movements with a hands-on station (`/studio/[movement]`), with what its kiosk says. */
  stations?: Record<string, { title: string; blurb: string }>;
  /** Painting worlds entered from a floor, by the floor's slug: each gets a quiet room and a kiosk. */
  worlds?: Record<string, WorldDoor[]>;
}): Building {
  const floors = [...input.floors].sort((a, b) => a.level - b.level);
  const movementBySlug = new Map(input.movements.map((m) => [m.slug, m]));
  const labs = new Set(input.labs ?? []);
  const top = floors.length - 1;
  const hasTerrace = top > TERRACE_AT;
  const stepsBack = (i: number) => hasTerrace && i > TERRACE_AT;

  const rooms: PlanRoom[] = [];
  const artworks: PlanArtwork[] = [];
  const portals: Portal[] = [];
  const stairs: Stair[] = [];

  // Stairs: the grand stair out of the lobby, then flights zigzagging across the atrium.
  if (top >= 1) {
    stairs.push({ id: "grand", from: 0, to: 1, rect: GRAND, rise: "n", kind: "grand" });
  }
  for (let i = 1; i < top; i++) {
    const lane = i % 2 === 1 ? LANES.a : LANES.b;
    stairs.push({
      id: `atrium-${i}`,
      from: i,
      to: i + 1,
      rect: { x0: lane.x0, z0: ATRIUM.z0, x1: lane.x1, z1: ATRIUM.z1 },
      rise: i % 2 === 1 ? "n" : "s",
      kind: "atrium",
    });
  }

  const levels: Level[] = floors.map((floor, i) => {
    const y = levelY(i);
    const ceiling = (i === 0 ? LOBBY_H : FLOOR_H) - SLAB;
    const walls: Wall[] = [];
    const items: Item[] = [];
    const spaces: Space[] = [];
    const floorRects: { rect: Rect; surface: Surface }[] = [];
    const width = stepsBack(i) ? TOP_W : FULL_W;
    const exhibitions = input.exhibitionsOn(floor);

    const wallX = (x: number, z0: number, z1: number, thick: number, openings: Opening[] = [], extra: Partial<Wall> = {}) =>
      walls.push({ x0: x, z0, x1: x, z1, thick, openings, ...extra });
    const wallZ = (z: number, x0: number, x1: number, thick: number, openings: Opening[] = [], extra: Partial<Wall> = {}) =>
      walls.push({ x0, z0: z, x1, z1: z, thick, openings, ...extra });
    const door = (center: number, start: number, w = DOOR_W, h = DOOR_H): Opening => ({
      from: center - start - w / 2,
      to: center - start + w / 2,
      bottom: 0,
      top: h,
      kind: "door",
    });
    const windowBand = (from: number, to: number, bottom = 0.55, topH = 3.7): Opening => ({
      from,
      to,
      bottom,
      top: Math.min(topH, ceiling - 0.3),
      kind: "window",
    });

    // ── Which room goes where ───────────────────────────────────────────
    type Use =
      | { kind: "gallery"; exhibition: Exhibition; rect: Rect; slot: Slot | "community" }
      | { kind: "lounge" | "reading" | "lab" | "studio"; rect: Rect; slot: Slot; world?: WorldDoor };
    const uses: Use[] = [];
    const ringDoors = new Map<Slot, boolean>();

    if (i === 0) {
      // Ground floor: the Community Gallery fills the north of the west wing, the Studio the south.
      const gallery: Rect = { x0: 0, z0: 0, x1: WEST, z1: 28 };
      exhibitions.forEach((exhibition, k) => {
        const n = exhibitions.length;
        const rect: Rect = { ...gallery, z0: (28 * k) / n, z1: (28 * (k + 1)) / n };
        uses.push({ kind: "gallery", exhibition, rect, slot: "community" });
      });
      uses.push({ kind: "studio", rect: SLOTS.SW, slot: "SW" });
    } else {
      const slots = ORDER.filter((s) => isWest(s) || !(stepsBack(i) || (hasTerrace && i === TERRACE_AT)));
      if (exhibitions.length > slots.length) {
        throw new Error(
          `Floor ${floor.level} has ${exhibitions.length} exhibitions; the building has rooms for ${slots.length}.`,
        );
      }
      let filler = 0;
      const worlds = [...(input.worlds?.[floor.slug] ?? [])];
      if (exhibitions.length + worlds.length > slots.length) {
        throw new Error(
          `Floor ${floor.level} has ${exhibitions.length} exhibitions and ${worlds.length} worlds; the building has rooms for ${slots.length}.`,
        );
      }
      slots.forEach((slot, k) => {
        const exhibition = exhibitions[k];
        if (exhibition) uses.push({ kind: "gallery", exhibition, rect: SLOTS[slot], slot });
        // A world's room: a place to sit before stepping in, and after.
        else if (worlds.length) uses.push({ kind: "lounge", rect: SLOTS[slot], slot, world: worlds.shift() });
        else if (labs.has(floor.slug) && !uses.some((u) => u.kind === "lab"))
          uses.push({ kind: "lab", rect: SLOTS[slot], slot });
        else uses.push({ kind: filler++ % 2 === 0 ? "lounge" : "reading", rect: SLOTS[slot], slot });
      });
    }

    // ── Outer walls ─────────────────────────────────────────────────────
    // A terrace has a parapet, not walls; the floors above it step back.
    const enclosed = hasTerrace && i === TERRACE_AT ? EAST : width;
    if (i === 0) {
      // Glass across the lobby with the front doors in it; windows for the Studio and the store.
      wallZ(D, 0, WEST, EXT, [windowBand(1.5, 10.5, 0.9, 3.9)], { outside: { x: 0, z: 1 } });
      wallZ(
        D,
        WEST,
        EAST,
        0.16,
        [{ from: 21.6 - WEST, to: 26.4 - WEST, bottom: 0, top: 3.4, kind: "entrance" }],
        { outside: { x: 0, z: 1 }, glass: true },
      );
      wallZ(D, EAST, FULL_W, EXT, [{ from: 1, to: 11, bottom: 0.25, top: 4.2, kind: "window" }], {
        outside: { x: 0, z: 1 },
      });
    } else {
      // The lounge looks down on the street.
      wallZ(D, 0, enclosed, EXT, [windowBand(i === 1 ? 18.6 : 12.8, EAST - 0.6)], {
        outside: { x: 0, z: 1 },
      });
    }
    wallZ(0, 0, enclosed, EXT, [], { outside: { x: 0, z: -1 } });
    const westWindows: Opening[] = [];
    const eastWindows: Opening[] = [];
    for (const u of uses) {
      if (u.kind !== "lounge") continue;
      const band = windowBand(u.rect.z0 + 1.2, u.rect.z1 - 1.2);
      (isWest(u.slot) ? westWindows : eastWindows).push(band);
    }
    wallX(0, 0, D, EXT, westWindows, { outside: { x: -1, z: 0 } });
    if (i === 0) {
      // The café looks out east.
      eastWindows.push(windowBand(2, 26, 0.8, 4.4));
    }
    if (stepsBack(i)) {
      // Above the terrace: windows over it, and the planted wall on the core.
      wallX(EAST, 0, D, EXT, [windowBand(11, 27), windowBand(29.5, 40.5)], {
        outside: { x: 1, z: 0 },
      });
    } else if (hasTerrace && i === TERRACE_AT) {
      // Glass onto the terrace, two doors through it; the core stays solid.
      wallX(EAST, 0, CORE_Z, EXT, [], { outside: { x: 1, z: 0 } });
      wallX(EAST, CORE_Z, D, 0.16, [door(19.2, CORE_Z, 2.2, 3), door(33, CORE_Z, 2.2, 3)], {
        glass: true,
        outside: { x: 1, z: 0 },
      });
    } else {
      wallX(FULL_W, 0, D, EXT, eastWindows, { outside: { x: 1, z: 0 } });
    }

    // ── Inner walls ─────────────────────────────────────────────────────
    // The core, with the floor's name on it.
    wallZ(CORE_Z, WEST, EAST, INT);

    // West wing: the wall onto the ring, and the walls between rooms.
    const westDoors: Opening[] = [];
    const eastDoors: Opening[] = [];
    for (const u of uses) {
      if (u.slot === "community") continue;
      const slot = u.slot;
      // The grand stair runs along the west wing's wall on the two lowest floors.
      if (slot === "SW" && i <= 1) continue;
      ringDoors.set(slot, true);
      (isWest(slot) ? westDoors : eastDoors).push(door(RING_DOOR_Z[slot], 0));
    }
    if (i === 0) {
      // The Community Gallery opens wide onto the lobby.
      for (const u of uses) {
        if (u.kind === "gallery") westDoors.push(door((u.rect.z0 + u.rect.z1) / 2, 0, 3.6, 3.6));
      }
    }
    wallX(WEST, 0, D, INT, westDoors);
    if (i !== 0) wallZ(14, 0, WEST, INT, [door(ENFILADE_X.west, 0)]);
    wallZ(28, 0, WEST, INT, [door(ENFILADE_X.west, 0)]);

    if (!stepsBack(i) && !(hasTerrace && i === TERRACE_AT)) {
      if (i === 0) {
        // Café and store open off the lobby; a wall between them.
        wallX(EAST, 0, D, INT, [
          { from: 15.5, to: 22.5, bottom: 0, top: 3.8, kind: "door" },
          { from: 31, to: 37, bottom: 0, top: 3.8, kind: "door" },
        ]);
        wallZ(28, EAST, FULL_W, INT);
      } else {
        wallX(EAST, 0, D, INT, eastDoors);
        wallZ(14, EAST, FULL_W, INT, [door(ENFILADE_X.east, EAST)]);
        wallZ(28, EAST, FULL_W, INT, [door(ENFILADE_X.east, EAST)]);
      }
    }

    // ── Floors and spaces ───────────────────────────────────────────────
    if (i === 0) {
      floorRects.push({ rect: { x0: 0, z0: 0, x1: WEST, z1: D }, surface: "wood" });
      floorRects.push({ rect: { x0: WEST, z0: CORE_Z, x1: EAST, z1: D }, surface: "stone" });
      floorRects.push({ rect: { x0: EAST, z0: 0, x1: FULL_W, z1: D }, surface: "wood" });
      floorRects.push({ rect: PLAZA, surface: "street" });
      spaces.push({ kind: "lobby", name: "Lobby", rect: { x0: WEST, z0: CORE_Z, x1: EAST, z1: D }, surface: "stone" });
      spaces.push({ kind: "cafe", name: "Café", rect: { x0: EAST, z0: 0, x1: FULL_W, z1: 28 }, surface: "wood" });
      spaces.push({ kind: "shop", name: "Museum Store", rect: { x0: EAST, z0: 28, x1: FULL_W, z1: D }, surface: "wood" });
      spaces.push({ kind: "outside", name: "Outside", rect: PLAZA, surface: "street" });
    } else {
      const ring: Rect[] = [
        // West ring; on Floor 2 it stops where the grand stair comes up.
        { x0: WEST, z0: CORE_Z, x1: ATRIUM.x0, z1: i === 1 ? GRAND.z0 : D },
        { x0: ATRIUM.x0, z0: CORE_Z, x1: EAST, z1: ATRIUM.z0 },
        { x0: ATRIUM.x1, z0: ATRIUM.z0, x1: EAST, z1: D },
        { x0: ATRIUM.x0, z0: ATRIUM.z1, x1: ATRIUM.x1, z1: D },
      ];
      for (const rect of ring) floorRects.push({ rect, surface: "wood" });
      floorRects.push({ rect: { x0: 0, z0: 0, x1: WEST, z1: D }, surface: "wood" });
      spaces.push({
        kind: "lounge",
        name: "Lounge",
        rect: { x0: WEST, z0: 32, x1: EAST, z1: D },
        surface: "wood",
      });
      spaces.push({ kind: "ring", name: "Atrium", rect: { x0: WEST, z0: CORE_Z, x1: EAST, z1: D }, surface: "wood" });
      if (!stepsBack(i)) {
        const east: Rect = { x0: EAST, z0: 0, x1: FULL_W, z1: D };
        if (hasTerrace && i === TERRACE_AT) {
          floorRects.push({ rect: east, surface: "deck" });
          spaces.push({ kind: "terrace", name: "Sculpture Terrace", rect: east, surface: "deck" });
        } else floorRects.push({ rect: east, surface: "wood" });
      }
    }

    // ── Rooms ───────────────────────────────────────────────────────────
    // A room's inside faces: outer walls are thicker than the ones between rooms.
    const t = (envelope: boolean) => (envelope ? EXT / 2 : INT / 2);
    const inner = (r: Rect): Rect => ({
      x0: r.x0 + t(r.x0 === 0),
      z0: r.z0 + t(r.z0 === 0),
      x1: r.x1 - t(r.x1 === width),
      z1: r.z1 - t(r.z1 === D),
    });

    for (const u of uses) {
      const rect = inner(u.rect);
      const west = u.slot === "community" || isWest(u.slot);
      const cx = (rect.x0 + rect.x1) / 2;
      const cz = (rect.z0 + rect.z1) / 2;
      // The doorway from the ring (or, for a room off the enfilade only, from the room before it).
      const ringDoor =
        u.slot === "community"
          ? { x: west ? rect.x1 : rect.x0, z: cz }
          : ringDoors.has(u.slot)
            ? { x: west ? rect.x1 : rect.x0, z: RING_DOOR_Z[u.slot] }
            : { x: west ? ENFILADE_X.west : ENFILADE_X.east, z: rect.z0 };
      const inward: Vec = ringDoors.has(u.slot as Slot) || u.slot === "community"
        ? { x: west ? -1 : 1, z: 0 }
        : { x: 0, z: 1 };

      if (u.kind === "gallery") {
        const ex = u.exhibition;
        const movement = movementBySlug.get(ex.movement);
        if (!movement) throw new Error(`Unknown movement "${ex.movement}"`);
        const index = rooms.length;
        spaces.push({ kind: "gallery", name: ex.title, rect: u.rect, surface: "wood", room: index });

        // Hang the works around the walls, clear of the doorways.
        const slotsNeeded = Math.max(ex.artworks.length, ex.kind === "community" ? COMMUNITY_SLOTS : 0);
        const spots = hangingSpots(rect, walls, ringDoor, slotsNeeded);
        const emptySlots: WallSpot[] = [];
        spots.forEach((spot, k) => {
          const artwork = ex.artworks[k];
          if (!artwork) {
            emptySlots.push(spot);
            return;
          }
          artworks.push({
            id: artwork.id,
            title: artwork.title,
            artist: artwork.artist,
            date: artwork.dateLabel ?? String(artwork.year),
            medium: artwork.medium,
            image: imageOf(artwork),
            zoom: zoomOf(artwork),
            frames:
              artwork.source.kind === "lenticular"
                ? artwork.source.frames.map((f) => ({ src: f.src, width: f.width, height: f.height }))
                : undefined,
            credit: artwork.credit,
            generative: artwork.recipe ? true : undefined,
            frame: frameFor(artwork),
            generation: artwork.generation,
            room: index,
            level: i,
            ...spot,
          });
        });

        // A lectern just inside the door, to one side of the way in.
        const side = { x: -inward.z, z: inward.x };
        const sideSign = sideTowardCentre(ringDoor, side, { x: cx, z: cz });
        const stand = {
          x: ringDoor.x + inward.x * 2.1 + side.x * sideSign * 1.9,
          z: ringDoor.z + inward.z * 2.1 + side.z * sideSign * 1.9,
        };
        rooms.push({
          slug: ex.slug,
          title: ex.title,
          description: ex.description,
          curator: ex.curator,
          kind: ex.kind,
          movement: {
            slug: movement.slug,
            name: movement.name,
            period: movement.period,
            summary: movement.summary,
            palette: movement.palette,
            pattern: movement.placeholderPattern,
            studioOpen: movement.studio.status === "available",
            station: input.stations?.[movement.slug] ? `/studio/${movement.slug}` : undefined,
          },
          level: i,
          rect,
          door: ringDoor,
          inward,
          stand,
          standYaw: yawOf(inward),
          emptySlots,
        });
        items.push({ kind: "lectern", x: stand.x, z: stand.z, w: 0.6, d: 0.6, rot: yawOf(inward), solid: true });

        // A hands-on station: a kiosk on the other side of the way in, facing into the room.
        const station = input.stations?.[movement.slug];
        if (station) {
          const at = {
            x: ringDoor.x + inward.x * 2.1 - side.x * sideSign * 1.9,
            z: ringDoor.z + inward.z * 2.1 - side.z * sideSign * 1.9,
          };
          portals.push({
            id: `station-${movement.slug}`,
            level: i,
            title: station.title,
            blurb: station.blurb,
            href: `/studio/${movement.slug}`,
            at,
            yaw: yawOf(inward),
            kind: "station",
          });
          items.push({ kind: "kiosk", x: at.x, z: at.z, w: 0.6, d: 0.6, rot: yawOf(inward), solid: true, variant: 3 });
        }

        // Benches down the middle of the room, facing the long walls.
        if (spots.length >= 4) {
          const alongX = rect.x1 - rect.x0 > rect.z1 - rect.z0;
          items.push({
            kind: "bench",
            x: cx,
            z: cz,
            w: alongX ? 2.4 : 0.55,
            d: alongX ? 0.55 : 2.4,
            rot: 0,
            solid: true,
          });
        }
        continue;
      }

      const name =
        u.kind === "lounge"
          ? (u.world?.title ?? "Lounge")
          : u.kind === "reading"
            ? "Reading Room"
            : u.kind === "lab"
              ? "Perception Lab"
              : "Studio";
      spaces.push({ kind: u.kind, name, rect: u.rect, surface: "wood" });

      if (u.kind === "lounge") {
        // Sofas facing out of the windows, a low table in front, armchairs either side.
        const toWindow = west ? -1 : 1;
        const view = yawOf({ x: toWindow, z: 0 });
        const sx = (west ? rect.x0 : rect.x1) - toWindow * 3.6;
        for (const dz of [-1.35, 1.35]) {
          items.push({ kind: "sofa", x: sx, z: cz + dz, w: 0.95, d: 2.4, rot: view, solid: true });
        }
        items.push({ kind: "low-table", x: sx + toWindow * 1.35, z: cz, w: 0.7, d: 1.4, rot: view, solid: true });
        for (const dz of [-3.6, 3.6]) {
          items.push({ kind: "armchair", x: sx + toWindow * 1.1, z: cz + dz, w: 0.85, d: 0.85, rot: view, solid: true });
        }
        items.push({ kind: "plant", x: rect.x0 + 0.6, z: rect.z0 + 0.6, w: 0.6, d: 0.6, rot: 0, solid: true });
        items.push({ kind: "plant", x: rect.x1 - 0.6, z: rect.z1 - 0.6, w: 0.6, d: 0.6, rot: 0, solid: true });
        if (u.world) {
          // The way into the painting, just inside the door.
          const at = { x: ringDoor.x + inward.x * 2.2, z: ringDoor.z + inward.z * 2.2 - 2.2 };
          portals.push({
            id: `world-${u.world.slug}`,
            level: i,
            title: u.world.title,
            blurb: u.world.blurb,
            href: `/worlds/${u.world.slug}`,
            at,
            yaw: yawOf(inward),
            kind: "world",
          });
          items.push({ kind: "kiosk", x: at.x, z: at.z, w: 0.6, d: 0.6, rot: yawOf(inward), solid: true, variant: 4 });
        }
      } else if (u.kind === "reading") {
        // Bookcases along the outer wall, long tables with lamps.
        const shelfX = west ? rect.x0 + 0.25 : rect.x1 - 0.25;
        for (let z = rect.z0 + 1.2; z + 2 <= rect.z1 - 1; z += 2.1) {
          items.push({
            kind: "bookcase",
            x: shelfX,
            z: z + 1,
            w: 0.45,
            d: 2,
            rot: yawOf({ x: west ? -1 : 1, z: 0 }),
            solid: true,
            variant: Math.round(z * 7),
          });
        }
        for (const dz of [-2.6, 2.6]) {
          items.push({ kind: "reading-table", x: cx, z: cz + dz, w: 3.6, d: 1.2, rot: 0, solid: true });
        }
        const at = { x: ringDoor.x + inward.x * 2.2, z: ringDoor.z + inward.z * 2.2 - 2.2 };
        portals.push({
          id: `learn-${floor.slug}`,
          level: i,
          title: "Learn the movements",
          blurb: "Short guides to every movement in the museum: what changed, how it worked, who made it.",
          href: "/learn",
          at,
          yaw: yawOf(inward),
          kind: "learn",
        });
        items.push({ kind: "kiosk", x: at.x, z: at.z, w: 0.6, d: 0.6, rot: yawOf(inward), solid: true });
      } else if (u.kind === "lab") {
        // Plinths with optical toys, and the way into the hands-on lab.
        const rows = [cz - 3.5, cz, cz + 3.5];
        rows.forEach((z, k) =>
          items.push({ kind: "plinth", x: cx + (k - 1) * 0.8, z, w: 0.9, d: 0.9, rot: 0, solid: true, variant: k }),
        );
        const at = { x: (west ? rect.x0 : rect.x1) + (west ? 1.2 : -1.2), z: cz };
        portals.push({
          id: `lab-${floor.slug}`,
          level: i,
          title: "Perception Lab",
          blurb: "Four hands-on stations: fold an Agamograph, make moiré, bend a grid and see motion that isn't there.",
          href: `/floors/${floor.slug}/walk`,
          at,
          yaw: yawOf({ x: west ? -1 : 1, z: 0 }),
          kind: "lab",
        });
        items.push({ kind: "kiosk", x: at.x, z: at.z, w: 0.6, d: 0.6, rot: yawOf({ x: west ? -1 : 1, z: 0 }), solid: true, variant: 1 });
      } else {
        // The Studio: workbenches, and a screen to start making.
        for (const dz of [-3, 1.5]) {
          items.push({ kind: "workbench", x: cx + 0.6, z: cz + dz, w: 3.2, d: 1.3, rot: 0, solid: true });
        }
        const at = { x: rect.x0 + 1, z: cz - 0.75 };
        portals.push({
          id: "studio",
          level: i,
          title: "The Studio",
          blurb: "Make a piece in the style of any movement here, from a prompt or a photo, then ask to hang it in the Community Gallery.",
          href: "/studio",
          at,
          yaw: yawOf({ x: -1, z: 0 }),
          kind: "studio",
        });
        items.push({ kind: "kiosk", x: at.x, z: at.z, w: 0.6, d: 0.6, rot: yawOf({ x: -1, z: 0 }), solid: true, variant: 2 });
      }
    }

    // ── Furnishing the public spaces ────────────────────────────────────
    if (i === 0) {
      // The information desk, facing the doors.
      items.push({ kind: "desk", x: 29.5, z: 33.4, w: 5, d: 1, rot: 0, solid: true });
      // Benches and trees in the lobby.
      items.push({ kind: "bench", x: 24, z: 25.5, w: 3.2, d: 0.6, rot: 0, solid: true });
      items.push({ kind: "bench", x: 24, z: 16.5, w: 3.2, d: 0.6, rot: 0, solid: true });
      for (const [x, z] of [
        [32.6, 12],
        [32.6, 40.4],
        [20.4, 40.4],
        [13.4, 11.4],
      ]) {
        items.push({ kind: "plant", x, z, w: 0.8, d: 0.8, rot: 0, solid: true, variant: 1 });
      }
      // Café: counter along the north wall, tables by the windows.
      items.push({ kind: "cafe-counter", x: 40, z: 1.4, w: 9, d: 1.1, rot: 0, solid: true });
      for (let z = 6; z <= 24; z += 4.5) {
        for (const x of [38.5, 43]) {
          items.push({ kind: "cafe-table", x, z, w: 1.6, d: 1.6, rot: 0, solid: true, variant: Math.round(x + z) });
        }
      }
      // Store: tables of books, shelves along the walls.
      for (const [x, z] of [
        [38, 33],
        [42.5, 33],
        [38, 37.5],
        [42.5, 37.5],
      ]) {
        items.push({ kind: "book-table", x, z, w: 2.2, d: 1.2, rot: 0, solid: true, variant: Math.round(x * z) });
      }
      items.push({ kind: "shelf", x: 45.4, z: 35, w: 0.5, d: 9, rot: -Math.PI / 2, solid: true });
      items.push({ kind: "shelf", x: 40, z: 28.6, w: 9, d: 0.5, rot: 0, solid: true, variant: 3 });

      // Outside: street trees, lamps and bollards along the kerb, benches under the trees.
      for (let x = -10; x <= 56; x += 8) {
        items.push({ kind: "tree", x, z: 48.2, w: 1.4, d: 1.4, rot: 0, solid: true, variant: Math.round(x) });
      }
      for (let x = -6; x <= 52; x += 16) {
        items.push({ kind: "lamp", x, z: 49.3, w: 0.3, d: 0.3, rot: 0, solid: true });
      }
      for (let x = 14; x <= 34; x += 2) {
        if (x > 20 && x < 28) continue;
        items.push({ kind: "bollard", x, z: 49.5, w: 0.25, d: 0.25, rot: 0, solid: true });
      }
      for (const x of [2, 42]) {
        items.push({ kind: "bench", x, z: 45.6, w: 3, d: 0.6, rot: 0, solid: true });
      }
    } else {
      // The lounge along the street: sofas facing the view.
      const from = i === 1 ? 20 : 15;
      for (let x = from; x + 2.4 <= EAST - 1; x += 5) {
        items.push({ kind: "sofa", x: x + 1.2, z: 38.6, w: 2.4, d: 0.95, rot: Math.PI, solid: true });
      }
      items.push({ kind: "plant", x: EAST - 0.8, z: D - 0.9, w: 0.7, d: 0.7, rot: 0, solid: true });
      // Benches along the atrium, looking into it.
      items.push({ kind: "bench", x: 15, z: 24.5, w: 0.55, d: 2.4, rot: 0, solid: true });
      if (hasTerrace && i === TERRACE_AT) {
        // The terrace: sculptures, planters and benches in the open air.
        for (const [x, z, v] of [
          [40, 7, 0],
          [39.5, 21, 1],
          [41, 34.5, 2],
        ]) {
          items.push({ kind: "sculpture", x, z, w: 2.4, d: 2.4, rot: 0, solid: true, variant: v });
        }
        for (const z of [14, 28]) {
          items.push({ kind: "planter", x: 44.4, z, w: 1.6, d: 5, rot: 0, solid: true });
          items.push({ kind: "bench", x: 42.8, z, w: 0.6, d: 3.2, rot: 0, solid: true });
        }
        for (const z of [3, 39.5]) {
          items.push({ kind: "planter", x: 37, z, w: 4, d: 1.4, rot: 0, solid: true });
        }
      }
    }

    // The lift shaft stands on every floor.
    items.push({ kind: "shaft", x: (SHAFT.x0 + SHAFT.x1) / 2, z: (SHAFT.z0 + SHAFT.z1) / 2, w: SHAFT.x1 - SHAFT.x0, d: SHAFT.z1 - SHAFT.z0, rot: 0, solid: true });
    // Under the grand stair is solid oak, not a room.
    if (i === 0 && top >= 1) {
      const d = 4.7;
      items.push({
        kind: "solid",
        x: (GRAND.x0 + GRAND.x1) / 2,
        z: GRAND.z0 + d / 2,
        w: GRAND.x1 - GRAND.x0,
        d,
        rot: 0,
        solid: true,
      });
    }

    return {
      index: i,
      number: floor.level,
      slug: floor.slug,
      name: floor.name,
      tagline: floor.tagline,
      y,
      ceiling,
      floors: floorRects,
      walls,
      rails: [],
      items,
      spaces,
      lettering: { x: (WEST + EAST) / 2, z: CORE_Z + INT / 2, yaw: 0, w: i === 0 ? 11 : 10 },
    };
  });

  // Edges of every floor: glass balustrades round the atrium and terrace,
  // the sides of the stairs, the kerb outside.
  for (const level of levels) level.rails = railsFor(level, stairs);

  const roofY = levelY(top) + FLOOR_H;
  return {
    name: "AI MoMA",
    levels,
    stairs,
    lift: {
      shaft: SHAFT,
      doorZ0: 19.55,
      doorZ1: 20.95,
      car: { x: (SHAFT.x0 + SHAFT.x1) / 2 + 0.05, z: (SHAFT.z0 + SHAFT.z1) / 2 },
      call: { x: SHAFT.x0 - 1.15, z: 20.25 },
    },
    rooms,
    artworks,
    portals,
    atrium: ATRIUM,
    // Clear of the lift shaft, which rises up the atrium's west side.
    oculus: { x: (ATRIUM.x0 + ATRIUM.x1) / 2 + 0.5, z: (ATRIUM.z0 + ATRIUM.z1) / 2, r: 3.8 },
    roofY,
    footprints: levels.map((l) => ({ x0: 0, z0: 0, x1: stepsBack(l.index) ? TOP_W : FULL_W, z1: D })),
    greenWall: hasTerrace
      ? { x: EAST + EXT / 2, z0: 0.3, z1: CORE_Z - 0.2, y0: levelY(TERRACE_AT), y1: roofY }
      : undefined,
    entrance: { at: { x: 24, z: 38.6 }, yaw: 0, doors: { x0: 21.6, x1: 26.4, z: D } },
  };
}

/** Yaw that faces along `v` (see `motion.ts`: yaw 0 looks toward −z). */
export const yawOf = (v: Vec) => Math.atan2(-v.x, -v.z);

function sideTowardCentre(door: Vec, side: Vec, centre: Vec) {
  return (centre.x - door.x) * side.x + (centre.z - door.z) * side.z >= 0 ? 1 : -1;
}

/**
 * Where to hang `n` works in a room: along each wall's face, clear of
 * doorways, spread so no wall is crowded while another stands empty. Works
 * run round the room from the doorway, so the hang reads in order.
 */
function hangingSpots(rect: Rect, walls: Wall[], door: Vec, n: number): WallSpot[] {
  if (n === 0) return [];
  // The four faces, going round the room clockwise seen from above: north, east, south, west.
  const faces = [
    { a: { x: rect.x0, z: rect.z0 }, b: { x: rect.x1, z: rect.z0 }, n: { x: 0, z: 1 } },
    { a: { x: rect.x1, z: rect.z0 }, b: { x: rect.x1, z: rect.z1 }, n: { x: -1, z: 0 } },
    { a: { x: rect.x1, z: rect.z1 }, b: { x: rect.x0, z: rect.z1 }, n: { x: 0, z: -1 } },
    { a: { x: rect.x0, z: rect.z1 }, b: { x: rect.x0, z: rect.z0 }, n: { x: 1, z: 0 } },
  ];
  type Seg = { a: Vec; dir: Vec; len: number; n: Vec; cap: number; used: number; doorWall: boolean; order: number };
  const segs: Seg[] = [];
  faces.forEach((f, fi) => {
    const len = Math.hypot(f.b.x - f.a.x, f.b.z - f.a.z);
    const dir = { x: (f.b.x - f.a.x) / len, z: (f.b.z - f.a.z) / len };
    // Gaps where any wall's door or window crosses this face.
    const gaps: [number, number][] = [];
    for (const w of walls) {
      const horizontal = w.z0 === w.z1;
      if (horizontal !== (f.n.x === 0)) continue;
      const line = horizontal ? w.z0 : w.x0;
      const faceLine = horizontal ? f.a.z : f.a.x;
      if (Math.abs(line - faceLine) > w.thick / 2 + 0.05) continue;
      for (const o of w.openings) {
        if (o.bottom > 2.2) continue;
        const start = horizontal ? w.x0 : w.z0;
        const p0 = start + o.from;
        const p1 = start + o.to;
        // Into this face's own coordinate along `dir`.
        const s0 = horizontal ? (p0 - f.a.x) * dir.x : (p0 - f.a.z) * dir.z;
        const s1 = horizontal ? (p1 - f.a.x) * dir.x : (p1 - f.a.z) * dir.z;
        gaps.push([Math.min(s0, s1) - 0.7, Math.max(s0, s1) + 0.7]);
      }
    }
    gaps.sort((p, q) => p[0] - q[0]);
    let at = 0.35;
    const pieces: [number, number][] = [];
    for (const [g0, g1] of gaps) {
      if (g0 > at) pieces.push([at, Math.min(g0, len - 0.35)]);
      at = Math.max(at, g1);
    }
    if (at < len - 0.35) pieces.push([at, len - 0.35]);
    const onDoorWall = Math.abs((door.x - f.a.x) * f.n.x + (door.z - f.a.z) * f.n.z) < 0.5;
    for (const [s0, s1] of pieces) {
      const plen = s1 - s0;
      const cap = Math.floor((plen + 0.6) / HANG_PITCH);
      if (cap < 1) continue;
      segs.push({
        a: { x: f.a.x + dir.x * s0, z: f.a.z + dir.z * s0 },
        dir,
        len: plen,
        n: f.n,
        cap,
        used: 0,
        doorWall: onDoorWall,
        order: fi * 100 + s0,
      });
    }
  });
  // Fill the emptiest walls first; the door's own wall last.
  for (let k = 0; k < n; k++) {
    let best: Seg | null = null;
    let bestScore = -Infinity;
    for (const s of segs) {
      if (s.used >= s.cap) continue;
      const score = (1 - s.used / s.cap) * (s.doorWall ? 0.55 : 1) + s.len * 0.001;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (!best) throw new Error(`A room ${rect.x1 - rect.x0}×${rect.z1 - rect.z0} m can't hang ${n} works.`);
    best.used++;
  }
  // Round the room from the doorway, clockwise.
  const centre = { x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2 };
  const angle = (p: Vec) => Math.atan2(p.z - centre.z, p.x - centre.x);
  const start = angle(door);
  const spots: (WallSpot & { t: number })[] = [];
  for (const s of segs) {
    for (let k = 0; k < s.used; k++) {
      const along = (s.len * (k + 0.5)) / s.used;
      const p = { x: s.a.x + s.dir.x * along, z: s.a.z + s.dir.z * along };
      let t = angle(p) - start;
      while (t <= 0) t += Math.PI * 2;
      spots.push({ x: round(p.x), z: round(p.z), nx: s.n.x, nz: s.n.z, t });
    }
  }
  spots.sort((p, q) => p.t - q.t);
  return spots.map((s) => ({ x: s.x, z: s.z, nx: s.nx, nz: s.nz }));
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** The rectangle of a stair that belongs to a floor: its lower part on the floor below, upper on the floor above. */
export function stairPart(s: Stair, level: number): Rect | null {
  const { rect } = s;
  const len = rect.z1 - rect.z0;
  // Progress 0 at the bottom; the halves overlap so the visitor can change floor mid-flight.
  const span = level === s.from ? [0, 0.55] : level === s.to ? [0.45, 1] : null;
  if (!span) return null;
  const [p0, p1] = span;
  if (s.rise === "n") return { x0: rect.x0, x1: rect.x1, z0: rect.z1 - p1 * len, z1: rect.z1 - p0 * len };
  return { x0: rect.x0, x1: rect.x1, z0: rect.z0 + p0 * len, z1: rect.z0 + p1 * len };
}

/** How far up a stair a point is, 0 at the bottom step to 1 at the top. */
export function stairProgress(s: Stair, p: Vec): number {
  const len = s.rect.z1 - s.rect.z0;
  return s.rise === "n" ? (s.rect.z1 - p.z) / len : (p.z - s.rect.z0) / len;
}

/**
 * The open edges of a floor, where there's floor on one side and neither
 * floor nor wall on the other: each becomes a balustrade, a stair's side or
 * (outside) the kerb.
 */
function railsFor(level: Level, stairs: Stair[]): Rail[] {
  const parts = stairs
    .map((s) => ({ s, part: stairPart(s, level.index) }))
    .filter((p): p is { s: Stair; part: Rect } => p.part !== null);
  const all: Rect[] = [...level.floors.map((f) => f.rect), ...parts.map((p) => p.part)];
  const covered = (p: Vec) => all.some((r) => inRect(r, p, 1e-6));
  const shafts = level.items.filter((it) => it.kind === "shaft");
  const walled = (p: Vec) =>
    level.walls.some((w) => {
      const h = w.thick / 2 + 0.06;
      return p.x >= w.x0 - h && p.x <= w.x1 + h && p.z >= w.z0 - h && p.z <= w.z1 + h;
    }) || shafts.some((s) => Math.abs(p.x - s.x) <= s.w / 2 + 0.06 && Math.abs(p.z - s.z) <= s.d / 2 + 0.06);
  const outside = level.spaces.find((s) => s.kind === "outside")?.rect;
  const rails: Rail[] = [];
  const STEP = 0.1;

  const edge = (
    a: Vec,
    b: Vec,
    out: Vec,
    kind: (mid: Vec) => Rail["kind"] | null,
    always = false,
  ) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.round(len / STEP));
    let run: { t0: number; kind: Rail["kind"] } | null = null;
    const flush = (t1: number) => {
      if (!run) return;
      const p0 = { x: a.x + ((b.x - a.x) * run.t0) / n, z: a.z + ((b.z - a.z) * run.t0) / n };
      const p1 = { x: a.x + ((b.x - a.x) * t1) / n, z: a.z + ((b.z - a.z) * t1) / n };
      rails.push({
        x0: round(Math.min(p0.x, p1.x)),
        z0: round(Math.min(p0.z, p1.z)),
        x1: round(Math.max(p0.x, p1.x)),
        z1: round(Math.max(p0.z, p1.z)),
        kind: run.kind,
      });
      run = null;
    };
    for (let k = 0; k < n; k++) {
      const mid = { x: a.x + ((b.x - a.x) * (k + 0.5)) / n, z: a.z + ((b.z - a.z) * (k + 0.5)) / n };
      const beyond = { x: mid.x + out.x * 0.05, z: mid.z + out.z * 0.05 };
      const open = always || (!covered(beyond) && !walled(beyond));
      const k2 = open ? kind(mid) : null;
      if (run && k2 !== run.kind) flush(k);
      if (k2 && !run) run = { t0: k, kind: k2 };
    }
    flush(n);
  };

  for (const f of level.floors) {
    const r = f.rect;
    const kind = (mid: Vec): Rail["kind"] =>
      outside && inRect(outside, mid) ? "edge" : "glass";
    edge({ x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }, { x: 0, z: -1 }, kind);
    edge({ x: r.x0, z: r.z1 }, { x: r.x1, z: r.z1 }, { x: 0, z: 1 }, kind);
    edge({ x: r.x0, z: r.z0 }, { x: r.x0, z: r.z1 }, { x: -1, z: 0 }, kind);
    edge({ x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 }, { x: 1, z: 0 }, kind);
  }
  // A stair's two sides, whatever is beside them; its ends run on into the floors it joins.
  for (const { part } of parts) {
    edge({ x: part.x0, z: part.z0 }, { x: part.x0, z: part.z1 }, { x: -1, z: 0 }, () => "stair", true);
    edge({ x: part.x1, z: part.z0 }, { x: part.x1, z: part.z1 }, { x: 1, z: 0 }, () => "stair", true);
  }
  return rails;
}

/** The space a point is in on a floor: the most specific one, rooms before the ring. */
export function spaceAt(level: Level, p: Vec): Space | null {
  const order: SpaceKind[] = [
    "gallery",
    "lounge",
    "reading",
    "studio",
    "lab",
    "cafe",
    "shop",
    "terrace",
    "lobby",
    "ring",
    "outside",
  ];
  let best: Space | null = null;
  for (const s of level.spaces) {
    if (!inRect(s.rect, p)) continue;
    if (!best || order.indexOf(s.kind) < order.indexOf(best.kind)) best = s;
  }
  return best;
}

/** The large copy, or for a Studio piece its own SVG, which is sharp at any size. */
function zoomOf(artwork: Artwork): ImageFile | undefined {
  const s = artwork.source;
  if (s.kind !== "image") return undefined;
  if (s.zoom) return { src: s.zoom.src, width: s.zoom.width, height: s.zoom.height };
  if (s.src.endsWith(".svg")) return { src: s.src, width: s.width, height: s.height };
  return undefined;
}

function imageOf(artwork: Artwork): ImageFile | undefined {
  const s = artwork.source;
  if (s.kind === "image") return { src: s.src, width: s.width, height: s.height };
  if (s.kind === "lenticular") {
    const f = s.frames[0];
    return { src: f.src, width: f.width, height: f.height };
  }
  return undefined;
}
