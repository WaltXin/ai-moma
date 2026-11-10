import * as THREE from "three";
import type { Vec } from "@/lib/walk/building";

/**
 * Mouldings: a profile swept along a path on a wall, mitred at its corners
 * (a cornice, a skirting, a door's casing, the frame of an arched panel),
 * and plain blocks proud of a wall (a pilaster's shaft, base and capital).
 *
 * A path lies in the wall's plane, as (s, y): s along the wall's axis, y up
 * from the floor. A profile is its cross-section, as (w, d): w across the
 * path (toward its left, so up for a path running along +s), d out of the
 * wall. List a profile with the solid on its right as you walk it.
 */

/** A wall face: along x or z, on the line `line`, facing `n`, its floor at `base`. */
export type Plane = { along: "x" | "z"; line: number; n: Vec; base: number };
export type Profile = [number, number][];

/** Shading and lightmap for a point on the face, so mouldings light like the wall they're on. */
export type Surface = {
  shade: (y: number) => number;
  light?: (s: number, y: number) => [number, number];
};

/** Profiles turn smoothly where they bend less than this; sharper bends keep a crisp edge. */
const SMOOTH = Math.cos((35 * Math.PI) / 180);

export class Mouldings {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private uv: number[] = [];
  private uv1: number[] = [];

  constructor(
    private readonly plane: Plane,
    private readonly surface: Surface,
  ) {}

  get empty() {
    return this.pos.length === 0;
  }

  /** World position of (s, y, d) on the plane. */
  private at(s: number, y: number, d: number): THREE.Vector3Tuple {
    const { along, line, n, base } = this.plane;
    return along === "x" ? [s, base + y, line + n.z * d] : [line + n.x * d, base + y, s];
  }

  /** World direction of an in-plane (s, y) vector plus `d` out of the wall. */
  private dir(s: number, y: number, d: number): THREE.Vector3Tuple {
    const { along, n } = this.plane;
    return along === "x" ? [s, y, n.z * d] : [n.x * d, y, s];
  }

  /** A triangle; turned round if needed so it faces along `hint`. */
  private tri(
    p: THREE.Vector3Tuple[],
    nrm: THREE.Vector3Tuple[],
    sy: [number, number][],
    uv: [number, number][],
    hint: THREE.Vector3Tuple,
  ) {
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * cx + cy * cy + cz * cz < 1e-14) return;
    const order = cx * hint[0] + cy * hint[1] + cz * hint[2] >= 0 ? [0, 1, 2] : [0, 2, 1];
    for (const i of order) {
      this.pos.push(...p[i]);
      this.nor.push(...nrm[i]);
      const c = this.surface.shade(sy[i][1]);
      this.col.push(c, c, c);
      this.uv.push(...uv[i]);
      this.uv1.push(...(this.surface.light ? this.surface.light(sy[i][0], sy[i][1]) : [0, 0]));
    }
  }

  /**
   * Sweeps `profile` along `path`. A closed path joins its last point to its
   * first; an open one is capped at both ends.
   */
  sweep(rawPath: [number, number][], rawProfile: Profile, closed = false) {
    const path = dedupe(rawPath, closed);
    const profile = dedupe(rawProfile, false);
    if (path.length < 2 || profile.length < 2) return;
    const m = path.length;
    const segs = closed ? m : m - 1;
    // Each segment's direction and left normal, in the plane.
    const tan: [number, number][] = [];
    const left: [number, number][] = [];
    for (let i = 0; i < segs; i++) {
      const a = path[i];
      const b = path[(i + 1) % m];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      tan.push([(b[0] - a[0]) / len, (b[1] - a[1]) / len]);
      left.push([-(b[1] - a[1]) / len, (b[0] - a[0]) / len]);
    }
    // At each point: the mitre (offset direction and stretch) and whether the bend is smooth.
    const mitre = path.map((_, i) => {
      const prev = closed ? left[(i - 1 + segs) % segs] : left[Math.max(0, i - 1)];
      const next = closed ? left[i % segs] : left[Math.min(segs - 1, i)];
      let mx = prev[0] + next[0];
      let my = prev[1] + next[1];
      const ml = Math.hypot(mx, my) || 1;
      mx /= ml;
      my /= ml;
      const stretch = 1 / Math.max(0.3, mx * next[0] + my * next[1]);
      const smooth = prev[0] * next[0] + prev[1] * next[1] >= SMOOTH;
      return { mx, my, stretch, smooth };
    });
    // Profile segments' normals in (w, d), and their arc length for texture.
    const pn: [number, number][] = [];
    const pv: number[] = [0];
    for (let j = 0; j + 1 < profile.length; j++) {
      const dw = profile[j + 1][0] - profile[j][0];
      const dd = profile[j + 1][1] - profile[j][1];
      const len = Math.hypot(dw, dd) || 1;
      pn.push([-dd / len, dw / len]);
      pv.push(pv[j] + len);
    }
    const profileNormal = (j: number, k: number) => {
      // At profile point k of segment j (k = j or j + 1): blended with the neighbour if the bend is gentle.
      const own = pn[j];
      const other = k === j ? pn[j - 1] : pn[j + 1];
      if (other && own[0] * other[0] + own[1] * other[1] >= SMOOTH) {
        const x = own[0] + other[0];
        const y = own[1] + other[1];
        const l = Math.hypot(x, y);
        return [x / l, y / l] as [number, number];
      }
      return own;
    };

    let u = 0;
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % m;
      const segLen = Math.hypot(path[i1][0] - path[i][0], path[i1][1] - path[i][1]);
      const ends = [
        { p: path[i], mt: mitre[i], u },
        { p: path[i1], mt: mitre[i1], u: u + segLen },
      ];
      for (let j = 0; j + 1 < profile.length; j++) {
        const corners = ends.flatMap((e) =>
          [j, j + 1].map((k) => {
            const [w, d] = profile[k];
            const s = e.p[0] + e.mt.mx * w * e.mt.stretch;
            const y = e.p[1] + e.mt.my * w * e.mt.stretch;
            const lv = e.mt.smooth ? [e.mt.mx, e.mt.my] : left[i];
            const [nw, nd] = profileNormal(j, k);
            const nx = lv[0] * nw;
            const ny = lv[1] * nw;
            const dvec = this.dir(nx, ny, nd);
            return { pos: this.at(s, y, d), nor: dvec, sy: [s, y] as [number, number], uv: [e.u, pv[k]] as [number, number] };
          }),
        );
        // corners: [a.j, a.j+1, b.j, b.j+1]
        const [a0, a1, b0, b1] = corners;
        const hint = this.dir(left[i][0] * pn[j][0], left[i][1] * pn[j][0], pn[j][1]);
        this.tri([a0.pos, b0.pos, b1.pos], [a0.nor, b0.nor, b1.nor], [a0.sy, b0.sy, b1.sy], [a0.uv, b0.uv, b1.uv], hint);
        this.tri([a0.pos, b1.pos, a1.pos], [a0.nor, b1.nor, a1.nor], [a0.sy, b1.sy, a1.sy], [a0.uv, b1.uv, a1.uv], hint);
      }
      u += segLen;
    }
    if (!closed) {
      this.cap(path[0], left[0], [-tan[0][0], -tan[0][1]], profile);
      this.cap(path[m - 1], left[segs - 1], tan[segs - 1], profile);
    }
  }

  /** Closes the end of a swept profile, back to the wall. */
  private cap(p: [number, number], lv: [number, number], facing: [number, number], profile: Profile) {
    const outline = profile.map(([w, d]) => new THREE.Vector2(w, d));
    const first = profile[0];
    const last = profile[profile.length - 1];
    if (last[1] > 1e-6) outline.push(new THREE.Vector2(last[0], 0));
    if (first[1] > 1e-6) outline.push(new THREE.Vector2(first[0], 0));
    const tris = THREE.ShapeUtils.triangulateShape(outline, []);
    const nrm = this.dir(facing[0], facing[1], 0);
    for (const t of tris) {
      const pts = t.map((k) => {
        const { x: w, y: d } = outline[k];
        const s = p[0] + lv[0] * w;
        const y = p[1] + lv[1] * w;
        return { pos: this.at(s, y, d), sy: [s, y] as [number, number], uv: [w, d] as [number, number] };
      });
      this.tri(
        pts.map((q) => q.pos),
        [nrm, nrm, nrm],
        pts.map((q) => q.sy),
        pts.map((q) => q.uv),
        nrm,
      );
    }
  }

  /** A block proud of the wall: s0–s1 along it, y0–y1 up, `d` deep. Its back is against the wall. */
  block(s0: number, s1: number, y0: number, y1: number, d: number) {
    const quad = (
      c: [number, number, number][],
      nrm: THREE.Vector3Tuple,
    ) => {
      const p = c.map(([s, y, dd]) => this.at(s, y, dd));
      const sy = c.map(([s, y]) => [s, y] as [number, number]);
      const uv = c.map(([s, y, dd]) => [s + dd, y + dd] as [number, number]);
      this.tri([p[0], p[1], p[2]], [nrm, nrm, nrm], [sy[0], sy[1], sy[2]], [uv[0], uv[1], uv[2]], nrm);
      this.tri([p[0], p[2], p[3]], [nrm, nrm, nrm], [sy[0], sy[2], sy[3]], [uv[0], uv[2], uv[3]], nrm);
    };
    quad([[s0, y0, d], [s1, y0, d], [s1, y1, d], [s0, y1, d]], this.dir(0, 0, 1));
    quad([[s0, y1, 0], [s1, y1, 0], [s1, y1, d], [s0, y1, d]], this.dir(0, 1, 0));
    quad([[s0, y0, 0], [s1, y0, 0], [s1, y0, d], [s0, y0, d]], this.dir(0, -1, 0));
    quad([[s0, y0, 0], [s0, y1, 0], [s0, y1, d], [s0, y0, d]], this.dir(-1, 0, 0));
    quad([[s1, y0, 0], [s1, y1, 0], [s1, y1, d], [s1, y0, d]], this.dir(1, 0, 0));
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("uv1", new THREE.Float32BufferAttribute(this.uv1, 2));
    return g;
  }
}

/** Drops points that repeat the one before (and, closed, a last point repeating the first). */
function dedupe(pts: [number, number][], closed: boolean): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  if (closed && out.length > 2) {
    const [a, z] = [out[0], out[out.length - 1]];
    if (Math.hypot(a[0] - z[0], a[1] - z[1]) <= 1e-6) out.pop();
  }
  return out;
}

// ── Profiles ───────────────────────────────────────────────────────────────

/** Points along a quarter (or any) arc, for building profiles. */
function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

/**
 * A classical cornice `h` deep, as (w, d) with w ≤ 0 below the ceiling:
 * a bed moulding, a corona standing proud, and a cyma up to the ceiling.
 */
export function grandCornice(h: number): Profile {
  const k = h / 0.42;
  const cyma: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    // An ogee: an S-curve, vertical at both ends.
    const e = t * t * (3 - 2 * t);
    cyma.push([-0.18 + 0.15 * t, 0.26 + 0.1 * e]);
  }
  const p: [number, number][] = [
    [-0.42, 0],
    [-0.42, 0.025],
    [-0.38, 0.025],
    // Ovolo: a quarter round, full side out and down.
    ...arc(-0.33, 0.025, 0.05, Math.PI, Math.PI / 2, 4).slice(1),
    [-0.33, 0.09],
    [-0.31, 0.09],
    // The corona's soffit, its face, a fillet.
    [-0.31, 0.24],
    [-0.2, 0.24],
    [-0.2, 0.26],
    [-0.18, 0.26],
    ...cyma.slice(1),
    [0, 0.36],
  ];
  return p.map(([w, d]) => [w * k, d * k]);
}

/** A plain cove, `h` deep, where gallery walls meet the ceiling. */
export function plainCornice(h: number): Profile {
  const k = h / 0.12;
  const p: [number, number][] = [
    [-0.12, 0],
    [-0.12, 0.012],
    [-0.105, 0.012],
    // Hollow: the curve's centre is out in the room, so it dishes in.
    ...arc(-0.105, 0.102, 0.09, -Math.PI / 2, 0, 6).slice(1),
    [-0.015, 0.11],
    [0, 0.11],
  ];
  return p.map(([w, d]) => [w * k, d * k]);
}

/** A skirting board `h` tall with a moulded top, standing proud of the wall. */
export function skirting(h: number, grand: boolean): Profile {
  const d = grand ? 0.022 : 0.016;
  return grand
    ? [
        [0, 0],
        [0, d],
        [h - 0.045, d],
        [h - 0.036, 0.014],
        [h - 0.026, 0.014],
        // A rounded nosing.
        [h - 0.016, 0.012],
        [h - 0.007, 0.008],
        [h - 0.002, 0.004],
        [h, 0],
      ]
    : [
        [0, 0],
        [0, d],
        [h - 0.014, d],
        [h, d - 0.01],
        [h, 0],
      ];
}

/** A door's casing `width` wide, out from the opening's edge. */
export function casing(width: number, grand: boolean): Profile {
  if (!grand)
    return [
      [0, 0],
      [0, 0.016],
      [0.01, 0.022],
      [width - 0.01, 0.022],
      [width, 0.014],
      [width, 0],
    ];
  return [
    [0, 0],
    [0, 0.02],
    [0.02, 0.028],
    [0.1, 0.028],
    [0.105, 0.035],
    [0.145, 0.035],
    [width, 0.022],
    [width, 0],
  ];
}

/** The raised frame of a panel: a bead and a flat, inward from its outer edge. */
export const PANEL: Profile = [
  [0, 0],
  [0, 0.012],
  [0.015, 0.025],
  [0.045, 0.025],
  [0.07, 0.008],
  [0.07, 0],
];

/** Along the top of a slab's edge round the atrium: a fillet, an ovolo, a cap. */
export const SLAB_CAP: Profile = [
  [-0.14, 0],
  [-0.14, 0.02],
  [-0.11, 0.02],
  ...arc(-0.07, 0.02, 0.04, Math.PI, Math.PI / 2, 4).slice(1),
  [-0.03, 0.06],
  [0, 0.06],
  [0, 0],
];

/** Along its underside: a step and a chamfer. */
export const SLAB_BASE: Profile = [
  [0, 0],
  [0, 0.03],
  [0.06, 0.03],
  [0.08, 0],
];
