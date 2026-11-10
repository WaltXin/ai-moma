import { type Building, type Level, type Rect, type Vec, inRect, spaceAt } from "./building";

/**
 * Light baked into the building: how much light reaches every wall, floor
 * and ceiling, worked out by tracing rays round each floor the way light
 * goes. Laylights over the galleries, downlights elsewhere, the windows and
 * the atrium's skylight light the rooms; light then bounces off the walls
 * and floors (twice), so corners fall dark, a bright room spills through
 * its doorway, and a red wall warms the floor in front of it.
 *
 * It's pure and deterministic, from the same `Building` as everything else:
 * the walk bakes it in a Web Worker (`components/walk/bake.worker.ts`) and
 * multiplies it into the surfaces' colour, so walking costs nothing extra.
 *
 * Results are relative light, per kind of surface: 1 is how a gallery's
 * walls (at eye height), floor or ceiling typically look, which is how the
 * building looked before the bake. The scene's own lights still say how
 * floors differ from walls; the bake adds what varies across each one.
 */

export type Rgb = [number, number, number];

// ── Where the light comes from ─────────────────────────────────────────────

/** Laylights inset this far from a gallery's walls. */
export const LAYLIGHT_INSET = 1.9;

export type CeilingLights = {
  /** Where there's a ceiling overhead (not the atrium, the terrace or the street). */
  covered: Rect[];
  /** Diffusers in the ceilings of galleries and labs. */
  panels: Rect[];
  /** Downlights everywhere else, on a grid. */
  downs: Vec[];
};

export function ceilingLights(b: Building, level: Level): CeilingLights {
  const top = b.levels.length - 1;
  const covered =
    level.index < top
      ? b.levels[level.index + 1].floors.map((f) => f.rect)
      : subtractRect(b.footprints[top], b.atrium);
  const isCovered = (p: Vec) => covered.some((r) => inRect(r, p));
  const panels: Rect[] = [];
  const downs: Vec[] = [];
  for (const space of level.spaces) {
    const r = space.rect;
    if (space.kind === "outside" || space.kind === "terrace") continue;
    if (space.kind === "gallery" || space.kind === "lab") {
      const room = space.room !== undefined ? b.rooms[space.room].rect : r;
      panels.push({
        x0: room.x0 + LAYLIGHT_INSET,
        z0: room.z0 + LAYLIGHT_INSET,
        x1: room.x1 - LAYLIGHT_INSET,
        z1: room.z1 - LAYLIGHT_INSET,
      });
      continue;
    }
    const spacing = space.kind === "lobby" ? 3.6 : 3;
    for (let x = r.x0 + spacing / 2; x < r.x1; x += spacing) {
      for (let z = r.z0 + spacing / 2; z < r.z1; z += spacing) {
        const p = { x, z };
        if (isCovered(p) && spaceAt(level, p) === space) downs.push(p);
      }
    }
  }
  return { covered, panels, downs };
}

/** `r` with the rectangle `a` (inside it) cut out, as up to four rectangles. */
export function subtractRect(r: Rect, a: Rect): Rect[] {
  return [
    { x0: r.x0, z0: r.z0, x1: r.x1, z1: a.z0 },
    { x0: r.x0, z0: a.z1, x1: r.x1, z1: r.z1 },
    { x0: r.x0, z0: a.z0, x1: a.x0, z1: a.z1 },
    { x0: a.x1, z0: a.z0, x1: r.x1, z1: a.z1 },
  ].filter((p) => p.x1 > p.x0 && p.z1 > p.z0);
}

// ── Where it's stored ─────────────────────────────────────────────────────

export type BakeQuality = {
  /** Texels per metre on the walls, and on the floor and ceiling plans. */
  wall: number;
  plan: number;
  /** Rays per texel: direct light, then each bounce. */
  rays: number[];
};

export const BAKE_HIGH: BakeQuality = { wall: 4, plan: 3, rays: [48, 40, 16] };
/** Phones: coarser, fewer rays, one bounce. */
export const BAKE_LOW: BakeQuality = { wall: 2.5, plan: 2, rays: [24, 24] };

/** One side of a plaster wall, as a rectangle of texels in the atlas (with a texel of padding all round). */
export type Face = {
  wall: number;
  side: 1 | -1;
  x: number;
  y: number;
  cols: number;
  rows: number;
  /** Where the wall starts along its axis, and its length and height. */
  start: number;
  len: number;
  height: number;
};

export type LightLayout = {
  level: number;
  quality: BakeQuality;
  atlas: { width: number; height: number; faces: Face[] };
  /** The floor and ceiling share one plan over the floor's bounds; row 0 is the south edge (v = 0). */
  plan: { x0: number; z0: number; w: number; h: number; cols: number; rows: number };
};

const ATLAS_W = 512;
const horizontal = (w: { z0: number; z1: number }) => w.z0 === w.z1;

/** Where every surface's light goes. Deterministic, so the scene and the worker agree. */
export function lightLayout(level: Level, quality: BakeQuality): LightLayout {
  const d = quality.wall;
  const faces: Face[] = [];
  level.walls.forEach((w, i) => {
    if (w.glass) return;
    const alongX = horizontal(w);
    const start = alongX ? w.x0 : w.z0;
    const len = (alongX ? w.x1 : w.z1) - start;
    if (len < 0.05) return;
    const height = w.top ?? level.ceiling;
    for (const side of [-1, 1] as const) {
      const n = alongX ? { x: 0, z: side } : { x: side, z: 0 };
      if (w.outside && w.outside.x === n.x && w.outside.z === n.z) continue;
      faces.push({
        wall: i,
        side,
        x: 0,
        y: 0,
        cols: Math.ceil(len * d) + 2,
        rows: Math.ceil(height * d) + 2,
        start,
        len,
        height,
      });
    }
  });
  // Shelves, tallest first.
  const order = faces.map((_, i) => i).sort((a, b) => faces[b].rows - faces[a].rows || a - b);
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const i of order) {
    const f = faces[i];
    if (x + f.cols > ATLAS_W) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    f.x = x;
    f.y = y;
    x += f.cols;
    shelf = Math.max(shelf, f.rows);
  }
  const height = Math.max(4, Math.ceil((y + shelf) / 4) * 4);

  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const f of level.floors) {
    x0 = Math.min(x0, f.rect.x0);
    z0 = Math.min(z0, f.rect.z0);
    x1 = Math.max(x1, f.rect.x1);
    z1 = Math.max(z1, f.rect.z1);
  }
  const cols = Math.ceil((x1 - x0) * quality.plan);
  const rows = Math.ceil((z1 - z0) * quality.plan);
  return {
    level: level.index,
    quality,
    atlas: { width: ATLAS_W, height, faces },
    plan: { x0, z0, w: cols / quality.plan, h: rows / quality.plan, cols, rows },
  };
}

/** Texture coordinates in the atlas for a point `s` along a wall face and `v` up from the floor. */
export function faceUv(layout: LightLayout, f: Face, s: number, v: number): [number, number] {
  const d = layout.quality.wall;
  return [
    (f.x + 1 + (s - f.start) * d) / layout.atlas.width,
    (f.y + 1 + v * d) / layout.atlas.height,
  ];
}

/** The face for one side of a wall, if it's baked. */
export function faceFor(layout: LightLayout, wall: number, side: 1 | -1): Face | undefined {
  return layout.atlas.faces.find((f) => f.wall === wall && f.side === side);
}

// ── How bright things are ─────────────────────────────────────────────────

/** Radiance of what a ray can see, times π (so a gather is just the mean). */
const LIGHT = {
  laylight: 1.15,
  /** Daylight through a window, and the ground outside. */
  sky: 1.5,
  ground: 0.45,
  /** Up the atrium to the skylight, and down it, on the top floor; dimmer lower down. */
  atriumUp: 1.6,
  atriumDown: 0.5,
  /** A downlight, at a metre. */
  down: 0.55,
};
/**
 * Light that reads as 1 on each kind of surface: the middle of a gallery's
 * walls and ceiling; floors a little darker than that, so they don't blow out.
 */
const REFERENCE = { wall: 0.24, floor: 0.48, ceiling: 0.14 };
/**
 * How strongly each kind of surface follows its light: walls a little more
 * than the light really varies (so even a dark wall shows its gradient),
 * floors and ceilings a little less (so they don't blow out).
 */
const CONTRAST = { wall: 1.7, floor: 1, ceiling: 0.75 };
/** No surface falls darker than this: a corner is in shadow, not black. */
const DARKEST = 0.35;
/** How much of the bounced light's colour to keep: enough to warm a floor by a red wall, not to tint a ceiling orange. */
const CHROMA = 0.35;

const FLOOR_ALBEDO: Record<string, Rgb> = {
  wood: [0.42, 0.26, 0.14],
  stone: [0.6, 0.57, 0.52],
  deck: [0.3, 0.22, 0.15],
  street: [0.3, 0.3, 0.3],
};
const CEILING_ALBEDO: Rgb = [0.86, 0.85, 0.82];

export type BakedLevel = {
  level: number;
  /** RGBA, sRGB-encoded relative light ÷ 2 (the shader doubles it). */
  atlas: Uint8Array;
  floor: Uint8Array;
  ceiling: Uint8Array;
};

/**
 * Bakes one floor. `paint` gives the colour of the wall facing a point (as
 * the walk paints it), or null where there's no wall to paint.
 */
export function bakeLevel(
  b: Building,
  layout: LightLayout,
  paint: (level: Level, p: Vec) => string | null,
): BakedLevel {
  const level = b.levels[layout.level];
  const q = layout.quality;
  const lights = ceilingLights(b, level);
  const y0 = level.y;
  const yc = level.y + level.ceiling;
  const depth = b.levels.length > 1 ? level.index / (b.levels.length - 1) : 1;
  const atriumUp = LIGHT.atriumUp * (0.55 + 0.45 * depth);
  const atriumDown = LIGHT.atriumDown * (0.5 + 0.5 * depth);
  const tracer = new Tracer(level);
  const covered = (p: Vec) => lights.covered.some((r) => inRect(r, p));
  tracer.setCovered((x, z) => covered({ x, z }));

  // ── Texels: where they are, which way they face, what colour the surface is ──
  const { faces } = layout.atlas;
  const P = layout.plan;
  const faceBase: number[] = [];
  let n = 0;
  for (const f of faces) {
    faceBase.push(n);
    n += f.cols * f.rows;
  }
  const floorBase = n;
  n += P.cols * P.rows;
  const ceilBase = n;
  n += P.cols * P.rows;

  const pos = new Float32Array(n * 3);
  const nor = new Int8Array(n * 3);
  const alb = new Float32Array(n * 3);
  const valid = new Uint8Array(n);
  const colour = new Map<string, Rgb>();
  const linear = (hex: string): Rgb => {
    let c = colour.get(hex);
    if (!c) colour.set(hex, (c = hexToLinear(hex)));
    return c;
  };

  faces.forEach((f, fi) => {
    const w = level.walls[f.wall];
    const alongX = horizontal(w);
    const centre = alongX ? w.z0 : w.x0;
    const line = centre + (f.side * w.thick) / 2;
    const holes = w.openings.map((o) => ({
      a: f.start + o.from,
      b: f.start + o.to,
      lo: o.bottom,
      hi: o.top,
    }));
    for (let j = 0; j < f.rows; j++) {
      // Padding texels sample just inside the face, so they carry its edge.
      const v = Math.min(f.height - 0.02, Math.max(0.02, (j - 0.5) / q.wall));
      for (let i = 0; i < f.cols; i++) {
        const s = f.start + Math.min(f.len - 0.02, Math.max(0.02, (i - 0.5) / q.wall));
        const k = faceBase[fi] + j * f.cols + i;
        const px = alongX ? s : line + f.side * 0.02;
        const pz = alongX ? line + f.side * 0.02 : s;
        pos[k * 3] = px;
        pos[k * 3 + 1] = y0 + v;
        pos[k * 3 + 2] = pz;
        nor[k * 3] = alongX ? 0 : f.side;
        nor[k * 3 + 2] = alongX ? f.side : 0;
        const inHole = holes.some((h) => s > h.a && s < h.b && v > h.lo && v < h.hi);
        const hex = paint(
          level,
          alongX ? { x: s, z: line + f.side * 0.3 } : { x: line + f.side * 0.3, z: s },
        );
        if (inHole || !hex || tracer.inside(px, y0 + v, pz)) continue;
        valid[k] = 1;
        alb.set(linear(hex), k * 3);
      }
    }
  });

  const onFloor = (p: Vec) => level.floors.find((f) => inRect(f.rect, p));
  const underPanel = (p: Vec) => lights.panels.some((r) => inRect(r, p));
  for (let j = 0; j < P.rows; j++) {
    for (let i = 0; i < P.cols; i++) {
      const p = { x: P.x0 + (i + 0.5) / q.plan, z: P.z0 + (j + 0.5) / q.plan };
      const kind = spaceAt(level, p)?.kind;
      const indoors = kind !== undefined && kind !== "outside";
      // Floor.
      const fk = floorBase + j * P.cols + i;
      pos.set([p.x, y0 + 0.02, p.z], fk * 3);
      nor[fk * 3 + 1] = 1;
      const f = onFloor(p);
      if (f && indoors && !tracer.inside(p.x, y0 + 0.02, p.z)) {
        valid[fk] = 1;
        alb.set(FLOOR_ALBEDO[f.surface] ?? FLOOR_ALBEDO.stone, fk * 3);
      }
      // Ceiling.
      const ck = ceilBase + j * P.cols + i;
      pos.set([p.x, yc - 0.02, p.z], ck * 3);
      nor[ck * 3 + 1] = -1;
      if (covered(p) && indoors && !underPanel(p) && !tracer.inside(p.x, yc - 0.02, p.z)) {
        valid[ck] = 1;
        alb.set(CEILING_ALBEDO, ck * 3);
      }
    }
  }

  // ── Where a ray lands, as a texel ──
  const hit = tracer.hit;
  const faceIndex = new Map<number, number>();
  faces.forEach((f, fi) => faceIndex.set(f.wall * 2 + (f.side > 0 ? 1 : 0), fi));
  const texelAt = (): number => {
    if (hit.kind === HIT_WALL) {
      const fi = faceIndex.get(hit.wall * 2 + (hit.side > 0 ? 1 : 0));
      if (fi === undefined) return -1;
      const f = faces[fi];
      const i = Math.min(f.cols - 2, Math.max(1, 1 + Math.floor((hit.u - f.start) * q.wall)));
      const j = Math.min(f.rows - 2, Math.max(1, 1 + Math.floor(hit.v * q.wall)));
      return faceBase[fi] + j * f.cols + i;
    }
    const i = Math.floor((hit.x - P.x0) * q.plan);
    const j = Math.floor((hit.z - P.z0) * q.plan);
    if (i < 0 || j < 0 || i >= P.cols || j >= P.rows) return -1;
    return (hit.kind === HIT_FLOOR ? floorBase : ceilBase) + j * P.cols + i;
  };

  // ── Downlights: direct, with a shadow ray each ──
  const direct = new Float32Array(n);
  const ly = yc - 0.05;
  for (let k = 0; k < n; k++) {
    if (!valid[k]) continue;
    const px = pos[k * 3];
    const py = pos[k * 3 + 1];
    const pz = pos[k * 3 + 2];
    let e = 0;
    for (const d of lights.downs) {
      const dx = d.x - px;
      const dy = ly - py;
      const dz = d.z - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 49) continue;
      const dist = Math.sqrt(d2);
      const cosSurf = (dx * nor[k * 3] + dy * nor[k * 3 + 1] + dz * nor[k * 3 + 2]) / dist;
      const cosLight = dy / dist;
      if (cosSurf <= 0 || cosLight <= 0) continue;
      if (tracer.blocked(px, py, pz, dx / dist, dy / dist, dz / dist, dist - 0.1)) continue;
      e += (LIGHT.down * cosLight * cosSurf) / Math.max(0.25, d2);
    }
    direct[k] = e;
  }

  // ── Gather: direct light first, then a bounce (or two) off everything ──
  // Every face, the floor and the ceiling: blocks of texels to smooth and fill on their own.
  const blocks = [
    ...faces.map((f, fi) => ({
      base: faceBase[fi],
      cols: f.cols,
      rows: f.rows,
      ref: REFERENCE.wall,
      wall: true,
    })),
    { base: floorBase, cols: P.cols, rows: P.rows, ref: REFERENCE.floor, wall: false },
    { base: ceilBase, cols: P.cols, rows: P.rows, ref: REFERENCE.ceiling, wall: false },
  ];
  // Texels for a distance on the walls. A wall's light changes slowly along it and faster up it
  // (dark at the skirting, bright at eye height), so it's smoothed more along than up.
  const wallTexels = (m: number) => Math.max(1, Math.round(m * q.wall));
  let light = new Float32Array(n * 3);
  let prev: Float32Array | null = null;
  q.rays.forEach((rays, pass) => {
    // What the rays see of the lights, and of lit surfaces: kept apart, since bounced light
    // is soft and can be smoothed much more than the light straight from a laylight or window.
    const emit = new Float32Array(n * 3);
    const bounce = new Float32Array(n * 3);
    const seq = hammersley(rays);
    for (let k = 0; k < n; k++) {
      if (!valid[k]) continue;
      const nx = nor[k * 3];
      const ny = nor[k * 3 + 1];
      const nz = nor[k * 3 + 2];
      // A frame round the normal (always along an axis).
      const tx = ny !== 0 ? 1 : 0;
      const ty = ny !== 0 ? 0 : 1;
      const tz = 0;
      const bx = ny * tz - nz * ty;
      const by = nz * tx - nx * tz;
      const bz = nx * ty - ny * tx;
      // Each texel turns the same pattern by its own amount (Cranley–Patterson), so noise is fine-grained.
      const r1 = hash(k * 2 + pass * 7919);
      const r2 = hash(k * 2 + 1 + pass * 7919);
      let r = 0;
      let g = 0;
      let bl = 0;
      let er = 0;
      let eg = 0;
      let eb = 0;
      const px = pos[k * 3];
      const py = pos[k * 3 + 1];
      const pz = pos[k * 3 + 2];
      for (let s = 0; s < rays; s++) {
        const u1 = (seq[s * 2] + r1) % 1;
        const u2 = (seq[s * 2 + 1] + r2) % 1;
        const rad = Math.sqrt(u1);
        const phi = 2 * Math.PI * u2;
        const lx = rad * Math.cos(phi);
        const lyy = rad * Math.sin(phi);
        const lz = Math.sqrt(Math.max(0, 1 - u1));
        const dx = tx * lx + bx * lyy + nx * lz;
        const dy = ty * lx + by * lyy + ny * lz;
        const dz = tz * lx + bz * lyy + nz * lz;
        tracer.trace(px, py, pz, dx, dy, dz);
        switch (hit.kind) {
          case HIT_WALL:
          case HIT_FLOOR:
          case HIT_CEILING: {
            if (hit.kind === HIT_CEILING && underPanel(hit)) {
              er += LIGHT.laylight;
              eg += LIGHT.laylight * 0.98;
              eb += LIGHT.laylight * 0.93;
              break;
            }
            if (!prev) break;
            const t = texelAt();
            if (t < 0 || !valid[t]) break;
            r += alb[t * 3] * prev[t * 3];
            g += alb[t * 3 + 1] * prev[t * 3 + 1];
            bl += alb[t * 3 + 2] * prev[t * 3 + 2];
            break;
          }
          case HIT_SOLID:
            // A lift shaft or a solid block: a neutral surface, lit about as this texel is.
            if (prev) {
              r += 0.45 * prev[k * 3];
              g += 0.45 * prev[k * 3 + 1];
              bl += 0.45 * prev[k * 3 + 2];
            }
            break;
          case HIT_UP: {
            const v = inRect(b.atrium, hit, 0.2) ? atriumUp : LIGHT.sky;
            er += v * 0.94;
            eg += v * 0.98;
            eb += v;
            break;
          }
          case HIT_DOWN: {
            const v = inRect(b.atrium, hit, 0.2) ? atriumDown : LIGHT.ground;
            er += v;
            eg += v * 0.97;
            eb += v * 0.92;
            break;
          }
          default: {
            // Out through a window.
            const v = dy > -0.05 ? LIGHT.sky : LIGHT.ground;
            er += v * 0.95;
            eg += v * 0.98;
            eb += v;
          }
        }
      }
      emit[k * 3] = er / rays;
      emit[k * 3 + 1] = eg / rays;
      emit[k * 3 + 2] = eb / rays;
      bounce[k * 3] = r / rays;
      bounce[k * 3 + 1] = g / rays;
      bounce[k * 3 + 2] = bl / rays;
    }
    // Smooth the noise, then add the downlights (exact already) and fill the gaps.
    const next = new Float32Array(n * 3);
    for (const bk of blocks) {
      if (bk.wall) {
        // Plaster shows every blotch, and the contrast curve doubles it: smooth it until it's even.
        for (let i = 0; i < 2; i++) {
          blurAxes(emit, valid, bk.base, bk.cols, bk.rows, wallTexels(1.2), wallTexels(0.4));
          blurAxes(bounce, valid, bk.base, bk.cols, bk.rows, wallTexels(2), wallTexels(0.6));
        }
        continue;
      }
      blur(emit, valid, bk.base, bk.cols, bk.rows, 2);
      blur(bounce, valid, bk.base, bk.cols, bk.rows, 2);
      blur(bounce, valid, bk.base, bk.cols, bk.rows, 2);
    }
    for (let k = 0; k < n; k++) {
      next[k * 3] = direct[k] + emit[k * 3] + bounce[k * 3];
      next[k * 3 + 1] = direct[k] * 0.96 + emit[k * 3 + 1] + bounce[k * 3 + 1];
      next[k * 3 + 2] = direct[k] * 0.86 + emit[k * 3 + 2] + bounce[k * 3 + 2];
    }
    for (const bk of blocks) fill(next, valid, bk.base, bk.cols, bk.rows, bk.ref);
    prev = next;
    light = next;
  });
  const out = light;

  const atlas = new Uint8Array(layout.atlas.width * layout.atlas.height * 4).fill(neutral);
  faces.forEach((f, fi) => {
    for (let j = 0; j < f.rows; j++) {
      for (let i = 0; i < f.cols; i++) {
        encode(
          out,
          faceBase[fi] + j * f.cols + i,
          REFERENCE.wall,
          CONTRAST.wall,
          atlas,
          ((f.y + j) * layout.atlas.width + f.x + i) * 4,
        );
      }
    }
  });
  const plan = (base: number, ref: number, contrast: number) => {
    const data = new Uint8Array(P.cols * P.rows * 4);
    // Texture row r is v = (r + 0.5) / rows, which runs north from the south edge.
    for (let r = 0; r < P.rows; r++) {
      const j = P.rows - 1 - r;
      for (let i = 0; i < P.cols; i++)
        encode(out, base + j * P.cols + i, ref, contrast, data, (r * P.cols + i) * 4);
    }
    return data;
  };
  return {
    level: level.index,
    atlas,
    floor: plan(floorBase, REFERENCE.floor, CONTRAST.floor),
    ceiling: plan(ceilBase, REFERENCE.ceiling, CONTRAST.ceiling),
  };
}

/** sRGB byte for relative light 1, the "no change" value. */
const neutral = srgbByte(0.5);

function encode(
  light: Float32Array,
  k: number,
  ref: number,
  contrast: number,
  out: Uint8Array,
  o: number,
) {
  const r = light[k * 3] / ref;
  const g = light[k * 3 + 1] / ref;
  const b = light[k * 3 + 2] / ref;
  const y = Math.max(1e-4, 0.2126 * r + 0.7152 * g + 0.0722 * b);
  const shaped = Math.max(DARKEST, y ** contrast);
  for (const [c, v] of [r, g, b].entries())
    out[o + c] = srgbByte((((y + (v - y) * CHROMA) / y) * shaped) / 2);
  out[o + 3] = 255;
}

function srgbByte(v: number): number {
  const x = Math.min(1, Math.max(0, v));
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

function hexToLinear(hex: string): Rgb {
  const h = hex.replace("#", "");
  const c = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [c(0), c(2), c(4)];
}

/** A box blur of `radius` texels over the valid texels of one block (a wall face or a plan), in place. */
function blur(
  light: Float32Array,
  valid: Uint8Array,
  base: number,
  cols: number,
  rows: number,
  radius: number,
) {
  const src = light.slice(base * 3, (base + cols * rows) * 3);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (!valid[base + k]) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let c = 0;
      for (let jj = Math.max(0, j - radius); jj <= Math.min(rows - 1, j + radius); jj++) {
        for (let ii = Math.max(0, i - radius); ii <= Math.min(cols - 1, i + radius); ii++) {
          const kk = jj * cols + ii;
          if (!valid[base + kk]) continue;
          r += src[kk * 3];
          g += src[kk * 3 + 1];
          b += src[kk * 3 + 2];
          c++;
        }
      }
      light[(base + k) * 3] = r / c;
      light[(base + k) * 3 + 1] = g / c;
      light[(base + k) * 3 + 2] = b / c;
    }
  }
}

/**
 * A box blur `rx` texels along and `ry` texels up one block, over its valid
 * texels only, in place: one pass along each axis, with running sums so a
 * wide blur costs no more than a narrow one.
 */
function blurAxes(
  light: Float32Array,
  valid: Uint8Array,
  base: number,
  cols: number,
  rows: number,
  rx: number,
  ry: number,
) {
  const longest = Math.max(cols, rows) + 1;
  const sr = new Float64Array(longest);
  const sg = new Float64Array(longest);
  const sb = new Float64Array(longest);
  const sc = new Int32Array(longest);
  const pass = (along: boolean, radius: number) => {
    const [lines, len] = along ? [rows, cols] : [cols, rows];
    for (let a = 0; a < lines; a++) {
      const at = (t: number) => base + (along ? a * cols + t : t * cols + a);
      // Prefix sums of the line's valid texels.
      for (let t = 0; t < len; t++) {
        const k = at(t);
        const ok = valid[k] ? 1 : 0;
        sr[t + 1] = sr[t] + ok * light[k * 3];
        sg[t + 1] = sg[t] + ok * light[k * 3 + 1];
        sb[t + 1] = sb[t] + ok * light[k * 3 + 2];
        sc[t + 1] = sc[t] + ok;
      }
      for (let t = 0; t < len; t++) {
        const k = at(t);
        if (!valid[k]) continue;
        const lo = Math.max(0, t - radius);
        const hi = Math.min(len, t + radius + 1);
        const c = sc[hi] - sc[lo];
        light[k * 3] = (sr[hi] - sr[lo]) / c;
        light[k * 3 + 1] = (sg[hi] - sg[lo]) / c;
        light[k * 3 + 2] = (sb[hi] - sb[lo]) / c;
      }
    }
  };
  pass(true, rx);
  pass(false, ry);
}

/**
 * Fills the invalid texels of a block from their valid neighbours, a few
 * texels deep, so the GPU's filtering never pulls in black; anything
 * further reads as `neutralLight`.
 */
function fill(
  light: Float32Array,
  valid: Uint8Array,
  base: number,
  cols: number,
  rows: number,
  neutralLight: number,
) {
  const filled = valid.slice(base, base + cols * rows);
  for (let pass = 0; pass < 3; pass++) {
    const grow: number[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (filled[k]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let c = 0;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
          const kk = jj * cols + ii;
          if (!filled[kk]) continue;
          r += light[(base + kk) * 3];
          g += light[(base + kk) * 3 + 1];
          b += light[(base + kk) * 3 + 2];
          c++;
        }
        if (!c) continue;
        light[(base + k) * 3] = r / c;
        light[(base + k) * 3 + 1] = g / c;
        light[(base + k) * 3 + 2] = b / c;
        grow.push(k);
      }
    }
    for (const k of grow) filled[k] = 1;
  }
  for (let k = 0; k < cols * rows; k++) {
    if (filled[k]) continue;
    light[(base + k) * 3] = light[(base + k) * 3 + 1] = light[(base + k) * 3 + 2] = neutralLight;
  }
}

function hammersley(n: number): Float32Array {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    let bits = i;
    let inv = 0;
    let f = 0.5;
    while (bits) {
      if (bits & 1) inv += f;
      bits >>= 1;
      f /= 2;
    }
    out[i * 2] = (i + 0.5) / n;
    out[i * 2 + 1] = inv;
  }
  return out;
}

function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// ── Rays ───────────────────────────────────────────────────────────────────

const HIT_NONE = 0;
const HIT_WALL = 1;
const HIT_FLOOR = 2;
const HIT_CEILING = 3;
/** Up through the atrium or the open sky. */
const HIT_UP = 4;
/** Down a stairwell or the atrium, or off the edge of the floor. */
const HIT_DOWN = 5;
const HIT_SOLID = 6;

type Box = {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  top: number;
  /** -1 for solid blocks with no face of their own. */
  wall: number;
  alongX: boolean;
  centre: number;
  holes: { a: number; b: number; lo: number; hi: number }[];
};

const CELL = 1;

/** Casts rays round one floor: its walls (with their doors and windows), floor and ceiling. */
class Tracer {
  readonly hit = { kind: HIT_NONE, t: 0, x: 0, z: 0, wall: 0, side: 1, u: 0, v: 0 };
  private boxes: Box[] = [];
  private grid: number[][];
  private gx0: number;
  private gz0: number;
  private gw: number;
  private gh: number;
  private stamp: Uint32Array;
  private tick = 0;
  private y0: number;
  private yc: number;
  private floors: Rect[];
  private covered: (x: number, z: number) => boolean;

  constructor(level: Level) {
    this.y0 = level.y;
    this.yc = level.y + level.ceiling;
    level.walls.forEach((w, i) => {
      if (w.glass) return;
      const alongX = horizontal(w);
      const h = w.thick / 2;
      const start = alongX ? w.x0 : w.z0;
      this.boxes.push({
        x0: alongX ? w.x0 : w.x0 - h,
        x1: alongX ? w.x1 : w.x0 + h,
        z0: alongX ? w.z0 - h : w.z0,
        z1: alongX ? w.z0 + h : w.z1,
        top: level.y + (w.top ?? level.ceiling),
        wall: i,
        alongX,
        centre: alongX ? w.z0 : w.x0,
        holes: w.openings.map((o) => ({
          a: start + o.from,
          b: start + o.to,
          lo: o.bottom,
          hi: o.top,
        })),
      });
    });
    for (const it of level.items) {
      if (it.kind !== "shaft" && it.kind !== "solid") continue;
      this.boxes.push({
        x0: it.x - it.w / 2,
        x1: it.x + it.w / 2,
        z0: it.z - it.d / 2,
        z1: it.z + it.d / 2,
        top: this.yc,
        wall: -1,
        alongX: true,
        centre: it.z,
        holes: [],
      });
    }
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const r of [...this.boxes, ...level.floors.map((f) => f.rect)]) {
      x0 = Math.min(x0, r.x0);
      z0 = Math.min(z0, r.z0);
      x1 = Math.max(x1, r.x1);
      z1 = Math.max(z1, r.z1);
    }
    this.gx0 = Math.floor(x0) - 1;
    this.gz0 = Math.floor(z0) - 1;
    this.gw = Math.ceil(x1) + 1 - this.gx0;
    this.gh = Math.ceil(z1) + 1 - this.gz0;
    this.grid = Array.from({ length: this.gw * this.gh }, () => []);
    this.boxes.forEach((bx, bi) => {
      for (
        let cz = Math.floor((bx.z0 - this.gz0) / CELL);
        cz <= Math.floor((bx.z1 - this.gz0) / CELL);
        cz++
      ) {
        for (
          let cx = Math.floor((bx.x0 - this.gx0) / CELL);
          cx <= Math.floor((bx.x1 - this.gx0) / CELL);
          cx++
        ) {
          if (cx >= 0 && cz >= 0 && cx < this.gw && cz < this.gh)
            this.grid[cz * this.gw + cx].push(bi);
        }
      }
    });
    this.stamp = new Uint32Array(this.boxes.length);
    this.floors = level.floors.map((f) => f.rect);
    // The level above's floor is this one's ceiling; set by bakeLevel through `setCovered`.
    this.covered = () => true;
  }

  setCovered(f: (x: number, z: number) => boolean) {
    this.covered = f;
  }

  /** Inside a wall or a solid block (so a texel there is never seen). */
  inside(x: number, y: number, z: number): boolean {
    for (const b of this.cellBoxes(x, z)) {
      const bx = this.boxes[b];
      if (x > bx.x0 && x < bx.x1 && z > bx.z0 && z < bx.z1 && y < bx.top) {
        const along = bx.alongX ? x : z;
        const v = y - this.y0;
        if (!bx.holes.some((h) => along > h.a && along < h.b && v > h.lo && v < h.hi)) return true;
      }
    }
    return false;
  }

  private cellBoxes(x: number, z: number): number[] {
    const cx = Math.floor((x - this.gx0) / CELL);
    const cz = Math.floor((z - this.gz0) / CELL);
    if (cx < 0 || cz < 0 || cx >= this.gw || cz >= this.gh) return [];
    return this.grid[cz * this.gw + cx];
  }

  /** Something between here and `dist` along the ray. */
  blocked(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    dist: number,
  ): boolean {
    this.trace(ox, oy, oz, dx, dy, dz, dist);
    return this.hit.kind !== HIT_NONE;
  }

  /** Fills `hit` with the first thing the ray meets (within `maxT`, if given). */
  trace(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT = Infinity) {
    const hit = this.hit;
    // The floor or ceiling plane.
    let tPlane = Infinity;
    if (dy > 1e-6) tPlane = (this.yc - oy) / dy;
    else if (dy < -1e-6) tPlane = (this.y0 - oy) / dy;
    const tLimit = Math.min(tPlane, maxT);

    // Walk the grid cells under the ray.
    let best = Infinity;
    let bestBox = -1;
    let bestAxisX = false;
    this.tick++;
    const stamp = this.tick;
    let cx = Math.floor((ox - this.gx0) / CELL);
    let cz = Math.floor((oz - this.gz0) / CELL);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity;
    const tdz = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
    let tmx =
      Math.abs(dx) > 1e-9 ? (this.gx0 + (cx + (dx > 0 ? 1 : 0)) * CELL - ox) / dx : Infinity;
    let tmz =
      Math.abs(dz) > 1e-9 ? (this.gz0 + (cz + (dz > 0 ? 1 : 0)) * CELL - oz) / dz : Infinity;
    let tCell = 0;
    let escaped = false;
    while (tCell <= tLimit) {
      if (cx < 0 || cz < 0 || cx >= this.gw || cz >= this.gh) {
        escaped = true;
        break;
      }
      for (const bi of this.grid[cz * this.gw + cx]) {
        if (this.stamp[bi] === stamp) continue;
        this.stamp[bi] = stamp;
        const bx = this.boxes[bi];
        let t0x: number;
        let t1x: number;
        if (Math.abs(dx) > 1e-9) {
          const a = (bx.x0 - ox) / dx;
          const c = (bx.x1 - ox) / dx;
          t0x = Math.min(a, c);
          t1x = Math.max(a, c);
        } else if (ox > bx.x0 && ox < bx.x1) {
          t0x = -Infinity;
          t1x = Infinity;
        } else continue;
        let t0z: number;
        let t1z: number;
        if (Math.abs(dz) > 1e-9) {
          const a = (bx.z0 - oz) / dz;
          const c = (bx.z1 - oz) / dz;
          t0z = Math.min(a, c);
          t1z = Math.max(a, c);
        } else if (oz > bx.z0 && oz < bx.z1) {
          t0z = -Infinity;
          t1z = Infinity;
        } else continue;
        const tin = Math.max(t0x, t0z);
        const tout = Math.min(t1x, t1z);
        if (tin >= tout || tout <= 1e-4 || tin >= best || tin > tLimit) continue;
        const t = Math.max(0, tin);
        const y = oy + dy * t;
        if (y > bx.top || y < this.y0) continue;
        const along = bx.alongX ? ox + dx * t : oz + dz * t;
        const v = y - this.y0;
        if (bx.holes.some((h) => along > h.a && along < h.b && v > h.lo && v < h.hi)) continue;
        best = t;
        bestBox = bi;
        bestAxisX = t0x >= t0z;
      }
      if (best <= Math.min(tmx, tmz)) break;
      if (tmx < tmz) {
        tCell = tmx;
        tmx += tdx;
        cx += stepX;
      } else {
        tCell = tmz;
        tmz += tdz;
        cz += stepZ;
      }
    }

    if (bestBox >= 0 && best <= tLimit) {
      const bx = this.boxes[bestBox];
      hit.t = best;
      hit.x = ox + dx * best;
      hit.z = oz + dz * best;
      if (bx.wall < 0) {
        hit.kind = HIT_SOLID;
        return;
      }
      hit.kind = HIT_WALL;
      hit.wall = bx.wall;
      hit.u = bx.alongX ? hit.x : hit.z;
      hit.v = oy + dy * best - this.y0;
      // Which face: the one the ray came in through, or for a wall's end, the side the ray started on.
      const facing = bx.alongX ? !bestAxisX : bestAxisX;
      if (facing) hit.side = (bx.alongX ? dz : dx) < 0 ? 1 : -1;
      else hit.side = (bx.alongX ? oz : ox) > bx.centre ? 1 : -1;
      return;
    }
    if (maxT !== Infinity && tPlane >= maxT) {
      hit.kind = HIT_NONE;
      return;
    }
    if (tPlane === Infinity || (escaped && tPlane > tCell)) {
      hit.kind = HIT_NONE;
      return;
    }
    hit.t = tPlane;
    hit.x = ox + dx * tPlane;
    hit.z = oz + dz * tPlane;
    if (dy > 0) hit.kind = this.covered(hit.x, hit.z) ? HIT_CEILING : HIT_UP;
    else
      hit.kind = this.floors.some(
        (r) => hit.x >= r.x0 && hit.x <= r.x1 && hit.z >= r.z0 && hit.z <= r.z1,
      )
        ? HIT_FLOOR
        : HIT_DOWN;
  }
}
