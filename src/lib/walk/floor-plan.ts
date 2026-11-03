import { type FrameKind, frameFor } from "@/lib/museum/frames";
import type {
  Artwork,
  ArtworkCredit,
  ImageFile,
  Exhibition,
  Floor,
  Movement,
  PlaceholderPattern,
} from "@/lib/museum/types";

/**
 * Turns a floor's content into a walkable tile map, Gather-style:
 *
 *   row 0      ███████████████████████████████████████   wall tops
 *   rows 1–3   █ [lift] █ [art] [art] [art] █ [art] …    wall faces (paintings hang here)
 *   rows 4–9   █ bay    █      room 1       █ room 2     gallery floors
 *   row 10     █        █▒▒ ███ label ██████ █▒▒ ████     room walls, door ▒▒ on the left
 *   rows 11–14 █        corridor                         corridor
 *   row 15     ███████████████████████████████████████
 *
 * Every floor ends in a lounge with windows and sofas, widened so small
 * floors still fill the screen.
 *
 * Rooms are laid out left to right in the floor's walking order, so adding an
 * exhibition to `floors.ts` adds a room. The result is plain data, safe to pass
 * from a Server Component to the client.
 */

export const TILE = 32;

export const Tile = {
  Void: 0,
  Floor: 1,
  Wall: 2,
  Face: 3,
  Corridor: 4,
  Door: 5,
  Pedestal: 6,
  Bench: 7,
  Plant: 8,
} as const;
export type TileKind = (typeof Tile)[keyof typeof Tile];

const WALKABLE = new Set<number>([Tile.Floor, Tile.Corridor, Tile.Door]);
export const isWalkable = (t: number) => WALKABLE.has(t);

/** Layout rows. */
export const ROW = {
  faceTop: 1,
  faceBottom: 3,
  roomTop: 4,
  roomBottom: 9,
  roomWall: 10,
  corridorTop: 11,
  corridorBottom: 14,
  rows: 16,
} as const;

/** A painting is 3 tiles wide with 1 tile between paintings. */
export const FRAME_W = 3;
const SLOT = FRAME_W + 1;
const MIN_ROOM_W = 9;
const BAY_W = 6;
/** Community rooms keep this many frames on the wall, waiting for submissions. */
const COMMUNITY_SLOTS = 4;
const MIN_LOUNGE_W = 12;
/** Small floors get a wider lounge so the map is never a sliver in the dark. */
const MIN_COLS = 56;

export type PlanArtwork = {
  id: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  /** The image, or the first view of a lenticular piece. */
  image?: ImageFile;
  /** Every view of a lenticular piece (Agamograph), left to right. */
  frames?: ImageFile[];
  credit?: ArtworkCredit;
  /** Drawn with code by the Studio. */
  generative?: boolean;
  /** Gilt, black or a mat, the same frame the site hangs it in. */
  frame: FrameKind;
  generation?: Artwork["generation"];
  /** Left column of the frame on the wall face. */
  x: number;
  /** Index of the room it hangs in. */
  room: number;
};

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
  };
  /** Interior bounds in tiles. */
  x: number;
  w: number;
  /** Left column of the 2-tile door in the room's bottom wall. */
  doorX: number;
  pedestal: { x: number; y: number };
  /** Wall slots with nothing hung yet (community rooms). */
  emptySlots: number[];
};

export type FloorPlan = {
  floor: { slug: string; level: number; name: string; tagline: string };
  /** Every floor, bottom-up, for the elevator panel. */
  floors: { slug: string; level: number; name: string }[];
  cols: number;
  rows: number;
  /** Row-major tile kinds, `cols * rows` long. */
  tiles: number[];
  rooms: PlanRoom[];
  artworks: PlanArtwork[];
  /** Elevator doors on the bay's wall face; the tiles below them call the lift. */
  elevator: { x: number; w: number };
  /** Open lounge at the end of the floor. */
  lounge: { x: number; w: number };
  spawn: { x: number; y: number };
};

export function buildFloorPlan(input: {
  floor: Floor;
  exhibitions: Exhibition[];
  movements: Movement[];
  floors: Floor[];
}): FloorPlan {
  const { floor, exhibitions } = input;
  const movementBySlug = new Map(input.movements.map((m) => [m.slug, m]));

  const slotCounts = exhibitions.map((e) =>
    Math.max(e.artworks.length, e.kind === "community" ? COMMUNITY_SLOTS : 0),
  );
  const widths = slotCounts.map((n) => Math.max(MIN_ROOM_W, n * SLOT + 1));
  // outer wall + bay + divider + (room + divider)* + lounge + outer wall
  const roomsEnd = 1 + BAY_W + 1 + widths.reduce((sum, w) => sum + w + 1, 0);
  const loungeW = Math.max(MIN_LOUNGE_W, MIN_COLS - roomsEnd - 1);
  const cols = roomsEnd + loungeW + 1;
  const rows = ROW.rows;
  const tiles = new Array<number>(cols * rows).fill(Tile.Wall);
  const set = (x: number, y: number, t: TileKind) => {
    tiles[y * cols + x] = t;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, t: TileKind) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };

  // Corridor along the bottom, open to the elevator bay.
  fill(1, ROW.corridorTop, cols - 2, ROW.corridorBottom, Tile.Corridor);
  fill(1, ROW.faceTop, BAY_W, ROW.faceBottom, Tile.Face);
  fill(1, ROW.roomTop, BAY_W, ROW.roomWall, Tile.Corridor);
  const elevator = { x: 2, w: 3 };

  const rooms: PlanRoom[] = [];
  const artworks: PlanArtwork[] = [];
  let x0 = 1 + BAY_W + 1;

  exhibitions.forEach((exhibition, index) => {
    const w = widths[index];
    const movement = movementBySlug.get(exhibition.movement);
    if (!movement) throw new Error(`Unknown movement "${exhibition.movement}"`);

    fill(x0, ROW.faceTop, x0 + w - 1, ROW.faceBottom, Tile.Face);
    fill(x0, ROW.roomTop, x0 + w - 1, ROW.roomBottom, Tile.Floor);
    const doorX = x0 + 1;
    fill(doorX, ROW.roomWall, doorX + 1, ROW.roomWall, Tile.Door);

    const pedestal = { x: doorX + 3, y: ROW.roomBottom };
    set(pedestal.x, pedestal.y, Tile.Pedestal);

    const n = exhibition.artworks.length;
    const slots = slotCounts[index];
    const used = slots * SLOT - 1;
    const offset = x0 + Math.floor((w - used) / 2);
    const emptySlots: number[] = [];
    for (let k = 0; k < slots; k++) {
      const x = offset + k * SLOT;
      const artwork = exhibition.artworks[k];
      if (!artwork) {
        emptySlots.push(x);
        continue;
      }
      artworks.push({
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist,
        date: artwork.dateLabel ?? String(artwork.year),
        medium: artwork.medium,
        image: imageOf(artwork),
        frames:
          artwork.source.kind === "lenticular"
            ? artwork.source.frames.map((f) => ({ src: f.src, width: f.width, height: f.height }))
            : undefined,
        credit: artwork.credit,
        generative: artwork.recipe ? true : undefined,
        frame: frameFor(artwork),
        generation: artwork.generation,
        x,
        room: index,
      });
    }

    // A bench in the middle of bigger rooms.
    if (n >= 4) {
      const cx = x0 + Math.floor(w / 2) - 1;
      fill(cx, ROW.roomTop + 3, cx + 1, ROW.roomTop + 3, Tile.Bench);
    }

    rooms.push({
      slug: exhibition.slug,
      title: exhibition.title,
      description: exhibition.description,
      curator: exhibition.curator,
      kind: exhibition.kind,
      movement: {
        slug: movement.slug,
        name: movement.name,
        period: movement.period,
        summary: movement.summary,
        palette: movement.palette,
        pattern: movement.placeholderPattern,
        studioOpen: movement.studio.status === "available",
      },
      x: x0,
      w,
      doorX,
      pedestal,
      emptySlots,
    });
    x0 += w + 1;
  });

  // Lounge: open to the corridor, windows on the wall, sofas facing the view.
  const lounge = { x: roomsEnd, w: loungeW };
  fill(lounge.x, ROW.faceTop, lounge.x + loungeW - 1, ROW.faceBottom, Tile.Face);
  fill(lounge.x, ROW.roomTop, lounge.x + loungeW - 1, ROW.roomWall, Tile.Floor);
  for (let x = lounge.x + 2; x + 1 < lounge.x + loungeW - 2; x += 5) {
    fill(x, ROW.roomTop + 2, x + 1, ROW.roomTop + 2, Tile.Bench);
    fill(x, ROW.roomTop + 5, x + 1, ROW.roomTop + 5, Tile.Bench);
  }
  set(lounge.x, ROW.roomTop, Tile.Plant);
  set(lounge.x + loungeW - 1, ROW.roomTop, Tile.Plant);
  set(lounge.x + loungeW - 1, ROW.roomWall, Tile.Plant);

  // Plants against the corridor's bottom wall, clear of the doors.
  for (let x = BAY_W + 4; x < cols - 2; x += 9) set(x, ROW.corridorBottom, Tile.Plant);

  return {
    floor: { slug: floor.slug, level: floor.level, name: floor.name, tagline: floor.tagline },
    floors: [...input.floors]
      .sort((a, b) => a.level - b.level)
      .map((f) => ({ slug: f.slug, level: f.level, name: f.name })),
    cols,
    rows,
    tiles,
    rooms,
    artworks,
    elevator,
    lounge,
    spawn: { x: elevator.x + 1, y: ROW.roomTop + 2 },
  };
}

export function tileAt(plan: FloorPlan, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= plan.cols || y >= plan.rows) return Tile.Void;
  return plan.tiles[y * plan.cols + x];
}

/** Whether a visitor standing at (x, y) is close enough to look at an artwork. */
export function canSee(art: { x: number }, x: number, y: number): boolean {
  return y <= ROW.roomTop + 1 && x >= art.x && x < art.x + FRAME_W;
}

/** Tiles below the elevator doors that call the lift. */
export function isElevatorTile(plan: FloorPlan, x: number, y: number): boolean {
  return y === ROW.roomTop && x >= plan.elevator.x && x < plan.elevator.x + plan.elevator.w;
}

/**
 * Shortest walkable path from `from` to `to` (exclusive of `from`), or null.
 * Breadth-first search over 4-connected tiles; maps are small.
 */
export function findPath(
  plan: FloorPlan,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  if (!isWalkable(tileAt(plan, to.x, to.y))) return null;
  const key = (x: number, y: number) => y * plan.cols + x;
  const prev = new Map<number, number>([[key(from.x, from.y), -1]]);
  const queue = [key(from.x, from.y)];
  const target = key(to.x, to.y);
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === target) break;
    const cx = cur % plan.cols;
    const cy = Math.floor(cur / plan.cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = key(nx, ny);
      if (prev.has(k) || !isWalkable(tileAt(plan, nx, ny))) continue;
      prev.set(k, cur);
      queue.push(k);
    }
  }
  if (!prev.has(target)) return null;
  const path: { x: number; y: number }[] = [];
  for (let k = target; k !== key(from.x, from.y); k = prev.get(k)!) {
    path.push({ x: k % plan.cols, y: Math.floor(k / plan.cols) });
  }
  return path.reverse();
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

/**
 * Which view of a lenticular piece a visitor sees from column `vx`:
 * a position from 0 (leftmost view) to `frames - 1` (rightmost), changing
 * over a few steps either side of the frame's centre.
 */
export function lenticularPosition(art: { x: number }, frames: number, vx: number): number {
  const center = art.x + FRAME_W / 2 - 0.5;
  const t = Math.max(0, Math.min(1, (vx - center) / 6 + 0.5));
  return t * (frames - 1);
}
