import { type Building, type Level, type Rect, type Vec, type Wall, inRect } from "./building";

/**
 * The plasterwork on the walls, as plain data: where the cornices,
 * skirtings, door casings, pilasters and arched panels go. The galleries
 * keep a quiet cornice and skirting, so the art leads. The lobby and the
 * atrium get the full classical treatment of an old museum's stair hall:
 * a deep cornice, pilasters and blind arches between them, keeping clear of
 * every doorway, sign and stair. `components/walk/mouldings.ts` raises it.
 */

export type TrimStyle = "grand" | "plain";

/** Sizes, in metres. A cornice's height depends on the room's (see `corniceHeight`). */
export const TRIM = {
  grand: { skirting: 0.2, casing: 0.16, pilaster: 0.5 },
  plain: { skirting: 0.11, casing: 0.08, pilaster: 0 },
} as const;

/** How far down from the ceiling a cornice reaches. */
export function corniceHeight(level: Level, style: TrimStyle): number {
  if (style === "plain") return 0.12;
  return level.ceiling > 5 ? 0.42 : 0.26;
}

/**
 * Where a room's name is lettered over its doorway, read from outside: up
 * from the floor, clear of the door's casing below and the cornice above.
 */
export function roomSign(level: Level): { y: number; h: number; w: number } {
  // The lobby's doors are taller (3.6 m) and its ceiling higher.
  return level.index === 0 ? { y: 4.3, h: 0.9, w: 3.8 } : { y: 3.81, h: 0.78, w: 3.8 };
}

export type Panel = {
  /** Along the face, and up from the floor. */
  a: number;
  b: number;
  y0: number;
  y1: number;
  /** A round head, as a blind arch; otherwise square. */
  arch: boolean;
};

export type FaceTrim = {
  wall: number;
  side: 1 | -1;
  style: TrimStyle;
  /** The face: along x or z, on the line `line`, facing `n`. `s` below runs along its axis. */
  along: "x" | "z";
  line: number;
  n: Vec;
  /** Floor to ceiling, and the cornice's drop (0 for no cornice). */
  height: number;
  cornice: number;
  skirting: number;
  /** A casing round each doorway: its sides along the face, and its head. */
  casings: { a: number; b: number; top: number; width: number }[];
  /** Centres of the pilasters along the face. */
  pilasters: number[];
  panels: Panel[];
};

const horizontal = (w: Wall) => w.z0 === w.z1;

/** The hall: the lobby on the ground floor, the atrium's ring above. */
function hallOf(level: Level): Rect[] {
  return level.spaces.filter((s) => s.kind === "lobby" || s.kind === "ring").map((s) => s.rect);
}

/** Every plaster face's trim on one floor. */
export function wallTrim(b: Building, level: Level): FaceTrim[] {
  const hall = hallOf(level);
  const floors = level.floors.map((f) => f.rect);
  // In the hall, with floor underfoot (not over the grand stair's well).
  const inHall = (p: Vec) => hall.some((r) => inRect(r, p)) && floors.some((r) => inRect(r, p));
  const out: FaceTrim[] = [];

  for (const [wi, w] of level.walls.entries()) {
    if (w.glass) continue;
    const alongX = horizontal(w);
    const along = alongX ? "x" : "z";
    const start = alongX ? w.x0 : w.z0;
    const end = alongX ? w.x1 : w.z1;
    const centre = alongX ? w.z0 : w.x0;
    const H = w.top ?? level.ceiling;
    for (const side of [-1, 1] as const) {
      const n: Vec = alongX ? { x: 0, z: side } : { x: side, z: 0 };
      if (w.outside && w.outside.x === n.x && w.outside.z === n.z) continue;
      const line = centre + (side * w.thick) / 2;
      /** A point on the room's side of the face. */
      const off = (s: number, d = 0.3): Vec => (alongX ? { x: s, z: line + side * d } : { x: line + side * d, z: s });

      // Grand where the face looks into the hall.
      let grand = false;
      for (let s = start + 0.25; s < end; s += 0.5) if (inHall(off(s))) grand = true;
      const style: TrimStyle = grand ? "grand" : "plain";
      const casing = TRIM[style].casing;

      const casings = w.openings
        .filter((o) => o.kind === "door" || o.kind === "entrance")
        .map((o) => ({ a: start + o.from, b: start + o.to, top: o.top, width: casing }));

      const face: FaceTrim = {
        wall: wi,
        side,
        style,
        along,
        line,
        n,
        height: H,
        // A low wall (none yet) has no ceiling to meet.
        cornice: H < level.ceiling - 0.01 ? 0 : corniceHeight(level, style),
        skirting: TRIM[style].skirting,
        casings,
        pilasters: [],
        panels: [],
      };
      out.push(face);
      if (!grand) continue;

      // ── Where pilasters and panels may go: the hall's stretch of the face, less what's on it ──
      const blocked: [number, number][] = [];
      // Walls butting into this face from the room's side.
      for (const v of level.walls) {
        if (v === w || horizontal(v) === alongX) continue;
        const vLine = alongX ? v.x0 : v.z0;
        if (vLine < start - 0.01 || vLine > end + 0.01) continue;
        const v0 = alongX ? v.z0 : v.x0;
        const v1 = alongX ? v.z1 : v.x1;
        const probe = line + side * 0.05;
        if (probe < v0 || probe > v1) continue;
        blocked.push([vLine - v.thick / 2 - 0.15, vLine + v.thick / 2 + 0.15]);
      }
      // Openings, with their casings and a margin.
      for (const o of w.openings) {
        if (o.bottom >= H) continue;
        blocked.push([start + o.from - casing - 0.3, start + o.to + casing + 0.3]);
      }
      // Room names over doorways on this face.
      const sign = roomSign(level);
      for (const r of b.rooms) {
        if (r.level !== level.index || r.inward.x !== -n.x || r.inward.z !== -n.z) continue;
        // The door's point is on the room's face; the sign is on this one, a wall's thickness out.
        const across = alongX ? r.door.z - r.inward.z * w.thick : r.door.x - r.inward.x * w.thick;
        if (Math.abs(across - line) > 0.05) continue;
        const s = alongX ? r.door.x : r.door.z;
        if (s < start || s > end) continue;
        blocked.push([s - sign.w / 2 - 0.3, s + sign.w / 2 + 0.3]);
      }
      // The floor's name on the core.
      const L = level.lettering;
      if (alongX && n.z === 1 && Math.abs(line - L.z) < 0.05 && L.x > start && L.x < end) {
        blocked.push([L.x - L.w / 2 - 0.4, L.x + L.w / 2 + 0.4]);
      }
      // Stairs climbing along the face.
      for (const st of b.stairs) {
        if (st.from !== level.index) continue;
        const r = st.rect;
        const near = alongX
          ? Math.min(Math.abs(r.z0 - line), Math.abs(r.z1 - line))
          : Math.min(Math.abs(r.x0 - line), Math.abs(r.x1 - line));
        if (near > 0.3) continue;
        blocked.push(alongX ? [r.x0 - 0.3, r.x1 + 0.3] : [r.z0 - 0.3, r.z1 + 0.3]);
      }
      // Furniture standing against it.
      for (const it of level.items) {
        const x0 = it.x - it.w / 2;
        const x1 = it.x + it.w / 2;
        const z0 = it.z - it.d / 2;
        const z1 = it.z + it.d / 2;
        const gap = alongX
          ? side > 0
            ? z0 - line
            : line - z1
          : side > 0
            ? x0 - line
            : line - x1;
        if (gap < -0.01 || gap > 0.2) continue;
        blocked.push(alongX ? [x0 - 0.2, x1 + 0.2] : [z0 - 0.2, z1 + 0.2]);
      }
      // Stretches of the face in the hall, from 0.25 m samples.
      const step = 0.25;
      const open: [number, number][] = [];
      let run: number | null = null;
      for (let s = start; s <= end + 1e-6; s += step) {
        const ok =
          s + step <= end + 1e-6 &&
          inHall(off(s + 0.01)) &&
          inHall(off(s + step - 0.01)) &&
          !blocked.some(([a, c]) => s + step > a && s < c);
        if (ok && run === null) run = s;
        if (!ok && run !== null) {
          open.push([run, s]);
          run = null;
        }
      }
      placeBays(face, open, level);
    }
  }
  return out;
}

/**
 * Fills each clear stretch with bays: a pilaster at each end and between
 * bays, an arched panel in each. A stretch too short for pilasters gets a
 * single panel; one shorter than that, nothing.
 */
function placeBays(face: FaceTrim, open: [number, number][], level: Level) {
  const pw = TRIM.grand.pilaster;
  const y0 = face.skirting + 0.45;
  const y1 = face.height - face.cornice - 0.45;
  const panel = (a: number, b: number) => {
    if (b - a < 0.8) return;
    // A round head needs its radius, and a straight run of a metre under it.
    const arch = y1 - (b - a) / 2 - y0 >= 1;
    face.panels.push({ a, b, y0, y1, arch });
  };
  for (const [a, b] of open) {
    const len = b - a;
    if (len < 1.2) continue;
    if (len < 2 * pw + 1.4) {
      panel(a + 0.25, b - 0.25);
      continue;
    }
    const bays = Math.max(1, Math.round((len - pw) / (level.ceiling > 5 ? 2.9 : 2.6)));
    const pitch = (len - pw) / bays;
    for (let k = 0; k <= bays; k++) face.pilasters.push(a + pw / 2 + k * pitch);
    for (let k = 0; k < bays; k++) {
      const left = a + pw / 2 + k * pitch;
      panel(left + pw / 2 + 0.3, left + pitch - pw / 2 - 0.3);
    }
  }
}
