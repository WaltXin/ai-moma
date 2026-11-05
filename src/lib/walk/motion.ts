import {
  FRAME_W,
  type FloorPlan,
  type PlanArtwork,
  type PlanRoom,
  ROW,
  findPath,
  isWalkable,
  tileAt,
} from "./floor-plan";

/**
 * First-person movement on a floor plan, in metres. One tile is one metre:
 * tile (x, y) covers world x ∈ [x, x+1] and z ∈ [y, y+1], and the paintings
 * hang on the wall at z = ROW.roomTop, facing +z.
 *
 * Yaw 0 looks along −z, toward the paintings; positive yaw turns left.
 * Everything here is pure, so it runs in tests and could run on a server.
 */

export type Vec = { x: number; z: number };

/** Eye height. */
export const EYE = 1.6;
/** How close the visitor's centre can get to a wall. */
export const RADIUS = 0.28;
export const CEILING = 4.2;

/** What the visitor can open: a painting, a room's info stand, the lift. */
export type Focus =
  { kind: "art"; art: PlanArtwork } | { kind: "room"; room: PlanRoom } | { kind: "elevator" };

export const focusKey = (f: Focus | null) =>
  !f ? "" : f.kind === "art" ? f.art.id : f.kind === "room" ? `room:${f.room.slug}` : "elevator";

export const forward = (yaw: number): Vec => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

/** The yaw that looks from `from` toward `to`. */
export const yawToward = (from: Vec, to: Vec) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

const solid = (plan: FloorPlan, tx: number, tz: number) => !isWalkable(tileAt(plan, tx, tz));

/** Whether a visitor of radius `r` standing at `p` would overlap a wall or furniture. */
export function collides(plan: FloorPlan, p: Vec, r = RADIUS): boolean {
  for (let tz = Math.floor(p.z - r); tz <= Math.floor(p.z + r); tz++) {
    for (let tx = Math.floor(p.x - r); tx <= Math.floor(p.x + r); tx++) {
      if (!solid(plan, tx, tz)) continue;
      const cx = Math.max(tx, Math.min(tx + 1, p.x));
      const cz = Math.max(tz, Math.min(tz + 1, p.z));
      if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < r * r - 1e-9) return true;
    }
  }
  return false;
}

/**
 * Moves from `p` by `d`, sliding along walls instead of stopping dead.
 * Long moves are split up so nothing tunnels through a one-tile wall.
 */
export function move(plan: FloorPlan, p: Vec, d: Vec, r = RADIUS): Vec {
  const len = Math.hypot(d.x, d.z);
  const steps = Math.max(1, Math.ceil(len / 0.2));
  // Each axis on its own, so a blocked one doesn't stop the other: that's the slide.
  const advance = (from: Vec, to: Vec) => {
    if (!collides(plan, to, r)) return to;
    // Close the gap to the wall instead of stopping a whole step short.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const at = { x: from.x + (to.x - from.x) * mid, z: from.z + (to.z - from.z) * mid };
      if (collides(plan, at, r)) hi = mid;
      else lo = mid;
    }
    return { x: from.x + (to.x - from.x) * lo, z: from.z + (to.z - from.z) * lo };
  };
  let cur = { ...p };
  for (let i = 0; i < steps; i++) {
    cur = advance(cur, { x: cur.x + d.x / steps, z: cur.z });
    cur = advance(cur, { x: cur.x, z: cur.z + d.z / steps });
  }
  return cur;
}

/** Whether a visitor can walk straight from `a` to `b`. */
export function clearLine(plan: FloorPlan, a: Vec, b: Vec, r = RADIUS): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / 0.1));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (collides(plan, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, r)) return false;
  }
  return true;
}

/**
 * A walking route from `from` to `to` around walls, as a few straight legs.
 * Tiles give the route; corners are cut wherever the way is clear.
 */
export function route(plan: FloorPlan, from: Vec, to: Vec): Vec[] | null {
  if (collides(plan, to)) return null;
  // A little margin, so frame-by-frame steps never graze a corner the line just clears.
  const clear = (a: Vec, b: Vec) => clearLine(plan, a, b, RADIUS + 0.05);
  if (clear(from, to)) return [to];
  const tiles = findPath(
    plan,
    { x: Math.floor(from.x), y: Math.floor(from.z) },
    { x: Math.floor(to.x), y: Math.floor(to.z) },
  );
  if (!tiles) return null;
  const points = [...tiles.slice(0, -1).map((t) => ({ x: t.x + 0.5, z: t.y + 0.5 })), to];
  const legs: Vec[] = [];
  let at = from;
  let i = 0;
  while (i < points.length) {
    let j = points.length - 1;
    while (j > i && !clear(at, points[j])) j--;
    legs.push(points[j]);
    at = points[j];
    i = j + 1;
  }
  return legs;
}

export const artCenter = (art: { x: number }): Vec => ({ x: art.x + FRAME_W / 2, z: ROW.roomTop });
export const elevatorCenter = (plan: FloorPlan): Vec => ({
  x: plan.elevator.x + plan.elevator.w / 2,
  z: ROW.roomTop,
});
export const standCenter = (room: PlanRoom): Vec => ({
  x: room.pedestal.x + 0.5,
  z: room.pedestal.y + 0.5,
});

/** Where to stand to look at something, and which way to face. */
export function viewpoint(plan: FloorPlan, f: Focus): { at: Vec; yaw: number; pitch: number } {
  if (f.kind === "art") {
    return { at: { x: artCenter(f.art).x, z: ROW.roomTop + 2.3 }, yaw: 0, pitch: 0 };
  }
  if (f.kind === "elevator") {
    return { at: { x: elevatorCenter(plan).x, z: ROW.roomTop + 1.1 }, yaw: 0, pitch: 0.05 };
  }
  // Beside the info stand, looking down at its top.
  const c = standCenter(f.room);
  const at = { x: c.x - 1.05, z: c.z - 0.2 };
  return { at, yaw: yawToward(at, c), pitch: -0.42 };
}

/** The room whose walls the visitor stands between, if any. */
export function roomAt(plan: FloorPlan, p: Vec): PlanRoom | null {
  if (p.z < ROW.roomTop || p.z >= ROW.roomWall + 1) return null;
  return plan.rooms.find((r) => p.x >= r.x && p.x < r.x + r.w) ?? null;
}

const angleTo = (p: Vec, yaw: number, target: Vec) => {
  const f = forward(yaw);
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  return { dist, angle: Math.acos(Math.max(-1, Math.min(1, (f.x * dx + f.z * dz) / dist))) };
};

/** What the visitor is close to and facing: the thing an "E" press would open. */
export function lookingAt(plan: FloorPlan, p: Vec, yaw: number): Focus | null {
  let best: { f: Focus; score: number } | null = null;
  const consider = (f: Focus, target: Vec, reach: number, cone: number) => {
    const { dist, angle } = angleTo(p, yaw, target);
    if (dist > reach || angle > cone) return;
    const score = angle + dist * 0.06;
    if (!best || score < best.score) best = { f, score };
  };

  const room = roomAt(plan, p);
  if (room) {
    const index = plan.rooms.indexOf(room);
    for (const art of plan.artworks) {
      // Only paintings in this room, and only from in front of the wall they hang on.
      if (art.room === index && p.z > ROW.roomTop)
        consider({ kind: "art", art }, artCenter(art), 4.6, 0.5);
    }
    consider({ kind: "room", room }, standCenter(room), 2.4, 0.75);
  }
  consider({ kind: "elevator" }, elevatorCenter(plan), 3.4, 0.6);
  return (best as { f: Focus } | null)?.f ?? null;
}

/** The visitor has walked right up to the lift doors. */
export function atElevator(plan: FloorPlan, p: Vec): boolean {
  const c = elevatorCenter(plan);
  return p.z < c.z + RADIUS + 0.2 && Math.abs(p.x - c.x) < 0.9;
}

/** Where the visitor starts: just out of the lift, looking down the corridor past every room. */
export function spawnPose(plan: FloorPlan): { at: Vec; yaw: number } {
  const at = { x: elevatorCenter(plan).x, z: ROW.corridorTop + 1.6 };
  return { at, yaw: yawToward(at, { x: plan.cols, z: at.z }) };
}

/**
 * Which view of a lenticular piece a visitor at world `x` sees, from 0
 * (leftmost view) to `frames - 1`.
 */
export function lenticularView(art: { x: number }, frames: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - artCenter(art).x) / 6 + 0.5));
  return t * (frames - 1);
}
