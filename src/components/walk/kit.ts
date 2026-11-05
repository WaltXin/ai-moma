import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Small geometry tools for the 3D walk: quads and boxes with texture
 * coordinates in metres (so wood grain and stone stay true to scale), and a
 * batch that merges everything sharing a material into a single mesh, so the
 * whole building draws in a few hundred calls.
 */

/**
 * Collects quads into one geometry. Colours are per-vertex shading (1 = full).
 * A second set of texture coordinates (`uv1`) places each quad in a
 * lightmap: given a plan, level quads map onto it from above; walls pass
 * their own.
 */
export class Quads {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  uv1: number[] = [];

  constructor(private readonly map?: { x0: number; z0: number; w: number; h: number }) {}

  /** Four corners counter-clockwise as seen from the front. */
  add(p: THREE.Vector3Tuple[], n: THREE.Vector3Tuple, c: number[] = [1, 1, 1, 1], uv?: number[][], uv1?: number[][]) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(...p[i]);
      this.nor.push(...n);
      this.col.push(c[i], c[i], c[i]);
      this.uv.push(...(uv ? uv[i] : [0, 0]));
      if (uv1) this.uv1.push(...uv1[i]);
      else if (this.map) this.uv1.push((p[i][0] - this.map.x0) / this.map.w, 1 - (p[i][2] - this.map.z0) / this.map.h);
      else this.uv1.push(0, 0);
    }
  }

  /**
   * An upright quad along a→b from y0 to y1, facing (−dz, dx) of a→b.
   * `u0` offsets the texture along the wall; colours shade bottom and top.
   * `lm` places it in a lightmap: [u at a, u at b, v at y0, v at y1].
   */
  wall(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    y0: number,
    y1: number,
    c0 = 1,
    c1 = 1,
    u0 = 0,
    lm?: [number, number, number, number],
  ) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    this.add(
      [
        [ax, y0, az],
        [bx, y0, bz],
        [bx, y1, bz],
        [ax, y1, az],
      ],
      [-dz / len, 0, dx / len],
      [c0, c0, c1, c1],
      [
        [u0, y0],
        [u0 + len, y0],
        [u0 + len, y1],
        [u0, y1],
      ],
      lm && [
        [lm[0], lm[2]],
        [lm[1], lm[2]],
        [lm[1], lm[3]],
        [lm[0], lm[3]],
      ],
    );
  }

  /** A level quad facing up (or down), textured in world metres scaled by `scale`. */
  level(x0: number, z0: number, x1: number, z1: number, y: number, down = false, scale = 1, shade = 1) {
    const uv = (x: number, z: number) => [x / scale, -z / scale];
    const p: THREE.Vector3Tuple[] = [
      [x0, y, z0],
      [x0, y, z1],
      [x1, y, z1],
      [x1, y, z0],
    ];
    const order = down ? [0, 3, 2, 1] : [0, 1, 2, 3];
    this.add(
      order.map((i) => p[i]),
      [0, down ? -1 : 1, 0],
      [shade, shade, shade, shade],
      order.map((i) => uv(p[i][0], p[i][2])),
    );
  }

  get empty() {
    return this.pos.length === 0;
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

/** A box w × h × d centred on the origin, texture coordinates in metres, all-white vertex colour. */
export function boxGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const q = new Quads();
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  // +z, −z, +x, −x, +y, −y
  q.add([[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], [0, 0, 1], undefined, [[0, 0], [w, 0], [w, h], [0, h]]);
  q.add([[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]], [0, 0, -1], undefined, [[0, 0], [w, 0], [w, h], [0, h]]);
  q.add([[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], [1, 0, 0], undefined, [[0, 0], [d, 0], [d, h], [0, h]]);
  q.add([[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]], [-1, 0, 0], undefined, [[0, 0], [d, 0], [d, h], [0, h]]);
  q.add([[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], [0, 1, 0], undefined, [[0, 0], [w, 0], [w, d], [0, d]]);
  q.add([[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]], [0, -1, 0], undefined, [[0, 0], [w, 0], [w, d], [0, d]]);
  return q.build();
}

const scratch = new THREE.Matrix4();
const rot = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);

/**
 * Geometry waiting to be merged, keyed by material. `flush()` turns each key
 * into one mesh on `parent`. A batch `withLightmap` keeps each part's `uv1`.
 */
export class Batch {
  private parts = new Map<string, THREE.BufferGeometry[]>();

  constructor(
    private readonly materials: (key: string) => THREE.Material,
    private readonly keep: <T extends { dispose(): void }>(x: T) => T,
    private readonly withLightmap = false,
  ) {}

  /** Adds a copy of `g`, moved to (x, y, z), turned `yaw` about y and scaled by `scale`. */
  add(key: string, g: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, scale?: THREE.Vector3Tuple) {
    const copy = g.clone();
    rot.setFromAxisAngle(yAxis, yaw);
    scratch.compose(
      new THREE.Vector3(x, y, z),
      rot,
      scale ? new THREE.Vector3(...scale) : new THREE.Vector3(1, 1, 1),
    );
    copy.applyMatrix4(scratch);
    this.push(key, copy);
  }

  /** A box, its bottom at y. */
  box(key: string, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) {
    const g = boxGeometry(w, h, d);
    rot.setFromAxisAngle(yAxis, yaw);
    scratch.compose(new THREE.Vector3(x, y + h / 2, z), rot, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(scratch);
    this.push(key, g);
  }

  push(key: string, g: THREE.BufferGeometry) {
    // Everything merged must carry the same attributes.
    if (!g.getAttribute("color")) {
      const n = g.getAttribute("position").count;
      g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    }
    if (!g.getAttribute("uv")) {
      const n = g.getAttribute("position").count;
      g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    if (g.index) g = g.toNonIndexed();
    const keepNames = this.withLightmap ? ["position", "normal", "color", "uv", "uv1"] : ["position", "normal", "color", "uv"];
    for (const name of Object.keys(g.attributes)) {
      if (!keepNames.includes(name)) g.deleteAttribute(name);
    }
    if (this.withLightmap && !g.getAttribute("uv1")) {
      g.setAttribute("uv1", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    }
    const list = this.parts.get(key);
    if (list) list.push(g);
    else this.parts.set(key, [g]);
  }

  flush(parent: THREE.Object3D, userData?: Record<string, unknown>): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(this.keep(merged), this.materials(key));
      if (userData) Object.assign(mesh.userData, userData);
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}

/** Adds already-placed geometry under `key`, transformed by `m`. */
export function placed(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const copy = g.clone();
  copy.applyMatrix4(m);
  return copy;
}

/** Everything the scene's builders share. */
export type Kit = {
  /** A material by key; created on first use and shared after. */
  mat: (key: string) => THREE.Material;
  tex: (c: HTMLCanvasElement, opts?: { repeat?: boolean; color?: boolean }) => THREE.Texture;
  keep: <T extends { dispose(): void }>(x: T) => T;
  /** One group per floor, hidden when out of sight; and one for what's seen from everywhere. */
  levels: THREE.Group[];
  shared: THREE.Group;
  pickables: THREE.Object3D[];
  /** Unit vector toward the sun. */
  sun: THREE.Vector3;
  /** Fewer, smaller textures on phones. */
  low: boolean;
};
