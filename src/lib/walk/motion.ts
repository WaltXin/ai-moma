import {
  type Building,
  type Level,
  type PlanArtwork,
  type PlanRoom,
  type Portal,
  type Rect,
  type Stair,
  type Vec,
  inRect,
  spaceAt,
  stairPart,
  stairProgress,
  yawOf,
} from "./building";

export type { Vec } from "./building";

/**
 * Walking the building, in metres. x runs east, z south, y up. Yaw 0 looks
 * north (−z); positive yaw turns left. A visitor is a circle on one floor at
 * a time; climbing a stair carries them to the next floor halfway up.
 *
 * Everything here is pure, so it runs in tests and could run on a server.
 */

/** Eye height. */
export const EYE = 1.6;
/** How close the visitor's centre can get to a wall. */
export const RADIUS = 0.28;

/** Where someone is: which floor, and where on it. */
export type Place = { level: number; pos: Vec };

/** What the visitor can open: a painting, a room's lectern, the lift, the desk, a doorway to elsewhere. */
export type Focus =
  | { kind: "art"; art: PlanArtwork }
  | { kind: "room"; room: PlanRoom }
  | { kind: "lift" }
  | { kind: "desk" }
  | { kind: "portal"; portal: Portal };

export const focusKey = (f: Focus | null) =>
  !f
    ? ""
    : f.kind === "art"
      ? f.art.id
      : f.kind === "room"
        ? `room:${f.room.slug}`
        : f.kind === "portal"
          ? `portal:${f.portal.id}`
          : f.kind;

export const forward = (yaw: number): Vec => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

/** The yaw that looks from `from` toward `to`. */
export const yawToward = (from: Vec, to: Vec) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

// ── What's solid ────────────────────────────────────────────────────────

type Solid = Rect;
type Grid = {
  floors: Rect[];
  solids: Solid[];
  /** Solids bucketed by 2 m cell, so a collision test only looks nearby. */
  buckets: Map<number, number[]>;
};

const BUCKET = 2;
const bucketKey = (bx: number, bz: number) => (bx + 1000) * 4096 + (bz + 1000);
const cache = new WeakMap<Level, Grid>();

function gridFor(b: Building, level: Level): Grid {
  const hit = cache.get(level);
  if (hit) return hit;
  const floors = [
    ...level.floors.map((f) => f.rect),
    ...b.stairs.map((s) => stairPart(s, level.index)).filter((r): r is Rect => r !== null),
  ];
  const solids: Solid[] = [];
  for (const w of level.walls) {
    const h = w.thick / 2;
    const along = w.z0 === w.z1 ? "x" : "z";
    const start = along === "x" ? w.x0 : w.z0;
    const end = along === "x" ? w.x1 : w.z1;
    // Doorways reaching the floor are gaps; glass is as solid as plaster.
    const gaps = w.openings
      .filter((o) => (o.kind === "door" || o.kind === "entrance") && o.bottom < 0.1)
      .map((o) => [start + o.from, start + o.to] as const)
      .sort((p, q) => p[0] - q[0]);
    let at = start;
    const piece = (a: number, c: number) => {
      if (c - a < 1e-6) return;
      solids.push(
        along === "x"
          ? { x0: a, x1: c, z0: w.z0 - h, z1: w.z0 + h }
          : { x0: w.x0 - h, x1: w.x0 + h, z0: a, z1: c },
      );
    };
    for (const [g0, g1] of gaps) {
      piece(at, g0);
      at = Math.max(at, g1);
    }
    piece(at, end);
  }
  for (const r of level.rails) {
    const t = 0.05;
    solids.push({ x0: r.x0 - t, z0: r.z0 - t, x1: r.x1 + t, z1: r.z1 + t });
  }
  for (const it of level.items) {
    if (!it.solid) continue;
    solids.push({ x0: it.x - it.w / 2, z0: it.z - it.d / 2, x1: it.x + it.w / 2, z1: it.z + it.d / 2 });
  }
  const buckets = new Map<number, number[]>();
  solids.forEach((s, i) => {
    for (let bx = Math.floor(s.x0 / BUCKET); bx <= Math.floor(s.x1 / BUCKET); bx++) {
      for (let bz = Math.floor(s.z0 / BUCKET); bz <= Math.floor(s.z1 / BUCKET); bz++) {
        const k = bucketKey(bx, bz);
        const list = buckets.get(k);
        if (list) list.push(i);
        else buckets.set(k, [i]);
      }
    }
  });
  const grid = { floors, solids, buckets };
  cache.set(level, grid);
  return grid;
}

const levelOf = (b: Building, i: number) => b.levels[Math.max(0, Math.min(b.levels.length - 1, i))];

/** Whether a visitor of radius `r` at `p` on floor `level` would stand off the floor or overlap something. */
export function collides(b: Building, level: number, p: Vec, r = RADIUS): boolean {
  const g = gridFor(b, levelOf(b, level));
  if (!g.floors.some((f) => inRect(f, p, 1e-6))) return true;
  const seen = new Set<number>();
  for (let bx = Math.floor((p.x - r) / BUCKET); bx <= Math.floor((p.x + r) / BUCKET); bx++) {
    for (let bz = Math.floor((p.z - r) / BUCKET); bz <= Math.floor((p.z + r) / BUCKET); bz++) {
      for (const i of g.buckets.get(bucketKey(bx, bz)) ?? []) {
        if (seen.has(i)) continue;
        seen.add(i);
        const s = g.solids[i];
        const cx = Math.max(s.x0, Math.min(s.x1, p.x));
        const cz = Math.max(s.z0, Math.min(s.z1, p.z));
        if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < r * r - 1e-9) return true;
      }
    }
  }
  return false;
}

// ── Stairs ──────────────────────────────────────────────────────────────

/** The stair a point on a floor is standing on, if any. */
export function stairAt(b: Building, level: number, p: Vec): Stair | null {
  for (const s of b.stairs) {
    const part = stairPart(s, level);
    if (part && inRect(part, p, 1e-6)) return s;
  }
  return null;
}

/** Which floor a visitor is on after a step: halfway up a stair, they've reached the next. */
export function levelAfter(b: Building, level: number, p: Vec): number {
  const s = stairAt(b, level, p);
  if (!s) return level;
  const t = stairProgress(s, p);
  if (level === s.from && t > 0.5) return s.to;
  if (level === s.to && t < 0.5) return s.from;
  return level;
}

/** Height of the floor under a visitor: a stair's slope, or the floor's own level. */
export function groundAt(b: Building, level: number, p: Vec): number {
  const s = stairAt(b, level, p);
  const base = levelOf(b, level).y;
  if (!s) return base;
  const y0 = b.levels[s.from].y;
  const y1 = b.levels[s.to].y;
  const t = Math.max(0, Math.min(1, stairProgress(s, p)));
  // Steps, not a ramp: the eye rises a little with each one.
  const steps = Math.round((y1 - y0) / 0.18);
  const stepped = Math.floor(t * steps + 0.5) / steps;
  return y0 + (y1 - y0) * (t * 0.6 + stepped * 0.4);
}

// ── Moving ──────────────────────────────────────────────────────────────

/**
 * Moves from `at` by `d`, sliding along walls instead of stopping dead, and
 * onto the next floor up or down a stair. Long moves are split up so nothing
 * tunnels through a thin wall.
 */
export function move(b: Building, at: Place, d: Vec, r = RADIUS): Place {
  const len = Math.hypot(d.x, d.z);
  const steps = Math.max(1, Math.ceil(len / 0.15));
  let level = at.level;
  // Each axis on its own, so a blocked one doesn't stop the other: that's the slide.
  const advance = (from: Vec, to: Vec) => {
    if (!collides(b, level, to, r)) return to;
    // Close the gap to the wall instead of stopping a whole step short.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const p = { x: from.x + (to.x - from.x) * mid, z: from.z + (to.z - from.z) * mid };
      if (collides(b, level, p, r)) hi = mid;
      else lo = mid;
    }
    return { x: from.x + (to.x - from.x) * lo, z: from.z + (to.z - from.z) * lo };
  };
  let cur = { ...at.pos };
  for (let i = 0; i < steps; i++) {
    cur = advance(cur, { x: cur.x + d.x / steps, z: cur.z });
    cur = advance(cur, { x: cur.x, z: cur.z + d.z / steps });
    level = levelAfter(b, level, cur);
  }
  return { level, pos: cur };
}

/** Whether a visitor can walk straight from `a` to `c` on one floor. */
export function clearLine(b: Building, level: number, a: Vec, c: Vec, r = RADIUS): boolean {
  const len = Math.hypot(c.x - a.x, c.z - a.z);
  const n = Math.max(1, Math.ceil(len / 0.1));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (collides(b, level, { x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t }, r)) return false;
  }
  return true;
}

// ── Finding the way ─────────────────────────────────────────────────────

const CELL = 0.5;
type Nav = { x0: number; z0: number; cols: number; rows: number; open: Uint8Array[] };
const navCache = new WeakMap<Building, Nav>();

function navFor(b: Building): Nav {
  const hit = navCache.get(b);
  if (hit) return hit;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const l of b.levels) {
    for (const f of l.floors) {
      x0 = Math.min(x0, f.rect.x0);
      z0 = Math.min(z0, f.rect.z0);
      x1 = Math.max(x1, f.rect.x1);
      z1 = Math.max(z1, f.rect.z1);
    }
  }
  const cols = Math.ceil((x1 - x0) / CELL);
  const rows = Math.ceil((z1 - z0) / CELL);
  const nav: Nav = { x0, z0, cols, rows, open: [] };
  for (const l of b.levels) {
    const open = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = { x: x0 + (c + 0.5) * CELL, z: z0 + (r + 0.5) * CELL };
        open[r * cols + c] = collides(b, l.index, p, RADIUS + 0.05) ? 0 : 1;
      }
    }
    nav.open.push(open);
  }
  navCache.set(b, nav);
  return nav;
}

/**
 * A walking route from one place to another, across floors by the stairs if
 * need be, as a few straight legs. Corners are cut wherever the way is clear.
 */
export function route(b: Building, from: Place, to: Place): Vec[] | null {
  if (collides(b, to.level, to.pos)) return null;
  // A little margin, so frame-by-frame steps never graze a corner the line just clears.
  const clear = (level: number, a: Vec, c: Vec) => clearLine(b, level, a, c, RADIUS + 0.05);
  if (from.level === to.level && clear(from.level, from.pos, to.pos)) return [to.pos];

  const nav = navFor(b);
  const { cols, rows } = nav;
  const n = cols * rows;
  const cellOf = (p: Vec) => {
    const c = Math.floor((p.x - nav.x0) / CELL);
    const r = Math.floor((p.z - nav.z0) / CELL);
    return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
  };
  const centre = (cell: number): Vec => ({
    x: nav.x0 + ((cell % cols) + 0.5) * CELL,
    z: nav.z0 + (Math.floor(cell / cols) + 0.5) * CELL,
  });
  // Start and end may sit in a cell too tight to be open; use the nearest open one.
  const nearestOpen = (pl: Place) => {
    const c0 = cellOf(pl.pos);
    if (c0 < 0) return -1;
    const open = nav.open[pl.level];
    let best = -1;
    let bestD = Infinity;
    const cc = c0 % cols;
    const rr = Math.floor(c0 / cols);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const c = cc + dc;
        const r = rr + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const k = r * cols + c;
        if (!open[k]) continue;
        const p = centre(k);
        const d = Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z);
        if (d < bestD && clear(pl.level, pl.pos, p)) {
          bestD = d;
          best = k;
        }
      }
    }
    return best;
  };
  const start = nearestOpen(from);
  const goal = nearestOpen(to);
  if (start < 0 || goal < 0) return null;

  // Stairs join a floor's cells to the next floor's, where the two halves overlap.
  const links = new Map<number, number[]>();
  for (const s of b.stairs) {
    const low = stairPart(s, s.from)!;
    const high = stairPart(s, s.to)!;
    const overlap = { x0: low.x0, x1: low.x1, z0: Math.max(low.z0, high.z0), z1: Math.min(low.z1, high.z1) };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        if (!inRect(overlap, centre(k))) continue;
        if (!nav.open[s.from][k] || !nav.open[s.to][k]) continue;
        const a = s.from * n + k;
        const z = s.to * n + k;
        links.set(a, [...(links.get(a) ?? []), z]);
        links.set(z, [...(links.get(z) ?? []), a]);
      }
    }
  }

  const src = from.level * n + start;
  const dst = to.level * n + goal;
  const prev = new Map<number, number>([[src, -1]]);
  const queue = [src];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (cur === dst) break;
    const level = Math.floor(cur / n);
    const k = cur % n;
    const c = k % cols;
    const r = Math.floor(k / cols);
    const next: number[] = [];
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nk = nr * cols + nc;
      if (nav.open[level][nk]) next.push(level * n + nk);
    }
    for (const l of links.get(cur) ?? []) next.push(l);
    for (const node of next) {
      if (prev.has(node)) continue;
      prev.set(node, cur);
      queue.push(node);
    }
  }
  if (!prev.has(dst)) return null;
  const nodes: number[] = [];
  for (let node = dst; node !== -1; node = prev.get(node)!) nodes.push(node);
  nodes.reverse();

  // Runs of cells on one floor; straighten each run, then join them up.
  const points: Place[] = nodes.map((node) => ({ level: Math.floor(node / n), pos: centre(node % n) }));
  points[0] = from;
  points.push(to);
  const legs: Vec[] = [];
  let at = from;
  let i = 1;
  while (i < points.length) {
    let j = i;
    // As far ahead as is in a straight line on the same floor.
    for (let k = points.length - 1; k > i; k--) {
      if (points[k].level === at.level && sameRun(points, i, k) && clear(at.level, at.pos, points[k].pos)) {
        j = k;
        break;
      }
    }
    const p = points[j];
    if (legs.length === 0 || Math.hypot(legs[legs.length - 1].x - p.pos.x, legs[legs.length - 1].z - p.pos.z) > 1e-6) {
      legs.push(p.pos);
    }
    at = p;
    i = j + 1;
  }
  return legs;
}

/** Whether points i..k all lie on one floor (a shortcut mustn't skip a stair). */
function sameRun(points: Place[], i: number, k: number) {
  for (let m = i; m <= k; m++) if (points[m].level !== points[i].level) return false;
  return true;
}

// ── Where things are ────────────────────────────────────────────────────

/** Where to stand to look at something, and which way to face. */
export function viewpoint(
  b: Building,
  f: Focus,
  /** The floor the visitor is on, for things on every floor (the lift). */
  level = 0,
): { level: number; at: Vec; yaw: number; pitch: number } {
  if (f.kind === "art") {
    const a = f.art;
    return {
      level: a.level,
      at: { x: a.x + a.nx * 2.3, z: a.z + a.nz * 2.3 },
      yaw: yawOf({ x: -a.nx, z: -a.nz }),
      pitch: 0,
    };
  }
  if (f.kind === "room") {
    const fwd = forward(f.room.standYaw);
    const at = { x: f.room.stand.x - fwd.x * 1.05, z: f.room.stand.z - fwd.z * 1.05 };
    return { level: f.room.level, at, yaw: f.room.standYaw, pitch: -0.42 };
  }
  if (f.kind === "lift") return { level, at: b.lift.call, yaw: -Math.PI / 2, pitch: 0.05 };
  if (f.kind === "desk") return { level: 0, at: { x: 29.5, z: 35.1 }, yaw: 0, pitch: -0.12 };
  const fwd = forward(f.portal.yaw);
  return {
    level: f.portal.level,
    at: { x: f.portal.at.x - fwd.x * 1.1, z: f.portal.at.z - fwd.z * 1.1 },
    yaw: f.portal.yaw,
    pitch: -0.2,
  };
}

/** Name of where a visitor is: a room's title, "Atrium", "Lobby", a stair. */
export function placeName(b: Building, at: Place): string {
  const s = stairAt(b, at.level, at.pos);
  if (s) return s.kind === "grand" ? "Grand stair" : `Stairs, floors ${b.levels[s.from].number}–${b.levels[s.to].number}`;
  return spaceAt(levelOf(b, at.level), at.pos)?.name ?? "";
}

/** The room a visitor is standing in, if any. */
export function roomAt(b: Building, at: Place): PlanRoom | null {
  const space = spaceAt(levelOf(b, at.level), at.pos);
  return space?.room !== undefined ? b.rooms[space.room] : null;
}

const angleTo = (p: Vec, yaw: number, target: Vec) => {
  const f = forward(yaw);
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  return { dist, angle: Math.acos(Math.max(-1, Math.min(1, (f.x * dx + f.z * dz) / dist))) };
};

export const DESK = { x: 29.5, z: 33.4 };

/** What the visitor is close to and facing: the thing an "E" press would open. */
export function lookingAt(b: Building, at: Place, yaw: number): Focus | null {
  const p = at.pos;
  let best: { f: Focus; score: number } | null = null;
  const consider = (f: Focus, target: Vec, reach: number, cone: number) => {
    const { dist, angle } = angleTo(p, yaw, target);
    if (dist > reach || angle > cone) return;
    const score = angle + dist * 0.06;
    if (!best || score < best.score) best = { f, score };
  };
  if (stairAt(b, at.level, p)) return null;

  const room = roomAt(b, at);
  if (room) {
    const index = b.rooms.indexOf(room);
    for (const art of b.artworks) {
      if (art.room !== index) continue;
      // Only from in front of the wall it hangs on.
      if ((p.x - art.x) * art.nx + (p.z - art.z) * art.nz < 0.4) continue;
      consider({ kind: "art", art }, art, 4.6, 0.5);
    }
    consider({ kind: "room", room }, room.stand, 2.4, 0.75);
  }
  for (const portal of b.portals) {
    if (portal.level === at.level) consider({ kind: "portal", portal }, portal.at, 2.6, 0.7);
  }
  const lift = { x: b.lift.shaft.x0, z: (b.lift.doorZ0 + b.lift.doorZ1) / 2 };
  consider({ kind: "lift" }, lift, 3.4, 0.6);
  if (at.level === 0) consider({ kind: "desk" }, DESK, 3.4, 0.6);
  return (best as { f: Focus } | null)?.f ?? null;
}

/** The visitor has walked right up to the lift doors. */
export function atLift(b: Building, p: Vec): boolean {
  const mid = (b.lift.doorZ0 + b.lift.doorZ1) / 2;
  return p.x > b.lift.shaft.x0 - RADIUS - 0.2 && Math.abs(p.z - mid) < 0.75;
}

/** Where a visit starts: just inside the front doors, looking up the lobby. */
export function startPose(b: Building): Place & { yaw: number } {
  return { level: 0, pos: b.entrance.at, yaw: b.entrance.yaw };
}

/** Out of the lift on a floor, looking past the shaft across the atrium toward the lounge. */
export function liftExitPose(b: Building, level: number): Place & { yaw: number } {
  const pos = { x: b.lift.call.x - 0.85, z: b.lift.call.z + 0.65 };
  return { level, pos, yaw: yawToward(pos, { x: b.atrium.x1 - 5, z: b.atrium.z1 + 5 }) };
}

/**
 * Which view of a lenticular piece a visitor at `p` sees, from 0 (seen from
 * the left) to `frames - 1` (from the right).
 */
export function lenticularView(art: { x: number; z: number; nx: number; nz: number }, frames: number, p: Vec): number {
  // "Right" as you face the wall.
  const offset = (p.x - art.x) * art.nz - (p.z - art.z) * art.nx;
  const t = Math.max(0, Math.min(1, offset / 6 + 0.5));
  return t * (frames - 1);
}
