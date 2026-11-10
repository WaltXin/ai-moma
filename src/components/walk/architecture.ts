import * as THREE from "three";
import {
  type Building,
  type Level,
  type Opening,
  SLAB,
  type Stair,
  type Vec,
  type Wall,
  inRect,
} from "@/lib/walk/building";
import { BAKE_HIGH, BAKE_LOW, type BakedLevel, type Face, LAYLIGHT_INSET, type LightLayout, ceilingLights, faceFor, faceUv, lightLayout, subtractRect } from "@/lib/walk/light";
import { type FaceTrim, wallTrim } from "@/lib/walk/trim";
import { Batch, type Kit, Quads, boxGeometry, placed } from "./kit";
import { Mouldings, PANEL, SLAB_BASE, SLAB_CAP, casing, grandCornice, plainCornice, skirting } from "./mouldings";
import { WHITE, paintAt } from "./paint";
import { floorShade } from "./textures";

/**
 * The building's fabric: walls with real reveals at every door and window,
 * floors and ceilings, slab edges and glass balustrades round the atrium,
 * the stairs, the glass lift, the façade outside and the oculus on top.
 */

export { WHITE, paintAt } from "./paint";

export type LiftRig = {
  /** Moves the car to height `y`; opens the doors on floor `at` by `open` (0–1). */
  update(y: number, at: number | null, open: number): void;
};

/** The baked light (`lib/walk/light.ts`): where each floor's goes, and how it arrives. */
export type BakedLight = {
  layouts: LightLayout[];
  /** Hands a floor its bake; it fades in over a second or so. */
  apply(baked: BakedLevel): void;
  tick(dt: number): void;
  /** For scripts while developing: which floors have their bake, and a way to compare with and without. */
  baked(): number[];
  force(mix: number | null): void;
};

export type Architecture = {
  lift: LiftRig;
  light: BakedLight;
  /** The front doors: slide open as someone comes near. */
  entrance: (open: number) => void;
  /** Light in the atrium, for its slow drift. */
  beam: THREE.Object3D;
};

const SHADE = { floor: 0.8, eye: 1, top: 0.8 };
const shadeAt = (y: number, h: number) =>
  y <= 1.8
    ? SHADE.floor + ((SHADE.eye - SHADE.floor) * y) / 1.8
    : SHADE.eye + ((SHADE.top - SHADE.eye) * (y - 1.8)) / Math.max(0.1, h - 1.8);

/** Where a wall face's light is baked: its rectangle in the floor's atlas. */
type FaceLight = { layout: LightLayout; face: Face; base: number };

/** An upright quad on a wall face with normal `n`, along s0→s1 of the face line. */
function upright(
  q: Quads,
  n: Vec,
  line: number,
  s0: number,
  s1: number,
  y0: number,
  y1: number,
  c0 = 1,
  c1 = 1,
  lm?: FaceLight,
) {
  // Lightmap coordinates for the quad's ends a and b, bottom and top.
  const at = (a: number, b: number): [number, number, number, number] | undefined => {
    if (!lm) return undefined;
    const [ua, v0] = faceUv(lm.layout, lm.face, a, y0 - lm.base);
    const [ub, v1] = faceUv(lm.layout, lm.face, b, y1 - lm.base);
    return [ua, ub, v0, v1];
  };
  if (n.x === 0) {
    if (n.z > 0) q.wall(s0, line, s1, line, y0, y1, c0, c1, s0, at(s0, s1));
    else q.wall(s1, line, s0, line, y0, y1, c0, c1, -s1, at(s1, s0));
  } else if (n.x > 0) q.wall(line, s1, line, s0, y0, y1, c0, c1, -s1, at(s1, s0));
  else q.wall(line, s0, line, s1, y0, y1, c0, c1, s0, at(s0, s1));
}

/**
 * A wall face shaded darker near the floor and ceiling, split at eye height
 * for a smooth ramp: how it looks until its baked light arrives.
 */
function shadedUpright(q: Quads, n: Vec, line: number, s0: number, s1: number, base: number, y0: number, y1: number, h: number, lm?: FaceLight) {
  const cuts = [y0, ...[1.8].filter((c) => c > y0 && c < y1), y1];
  for (let i = 0; i + 1 < cuts.length; i++) {
    upright(q, n, line, s0, s1, base + cuts[i], base + cuts[i + 1], shadeAt(cuts[i], h), shadeAt(cuts[i + 1], h), lm);
  }
}

const horizontal = (w: Wall) => w.z0 === w.z1;

export function buildArchitecture(k: Kit, b: Building): Architecture {
  const shared = new Batch(k.mat, k.keep);
  const quality = k.low ? BAKE_LOW : BAKE_HIGH;
  const layouts = b.levels.map((l) => lightLayout(l, quality));
  const lit = b.levels.map(() => litMaterials(k));

  for (const level of b.levels) {
    const batch = new Batch(k.mat, k.keep);
    const baked = new Batch(lit[level.index].mat, k.keep, true);
    const group = k.levels[level.index];
    const layout = layouts[level.index];
    buildWalls(k, b, level, batch, shared, baked, layout);
    buildFloors(k, b, level, group, layout, lit[level.index]);
    buildCeiling(k, b, level, baked, batch, layout);
    buildEdges(b, level, batch);
    batch.flush(group);
    baked.flush(group);
  }
  for (const s of b.stairs) buildStair(k, b, s, shared);
  buildRoof(k, b, shared);
  const entrance = buildEntrance(k, b);
  const beam = buildOculusLight(k, b);
  shared.flush(k.shared);
  const lift = buildLift(k, b);
  return { lift, entrance, beam, light: bakedLight(k, layouts, lit) };
}

// ── Baked light ──────────────────────────────────────────────────────────

/**
 * One floor's lit surfaces: its own copies of the plaster, skirting, ceiling
 * and floor materials, so its bake can be handed to them alone.
 */
type LitMaterials = {
  mat: (key: string) => THREE.Material;
  /** Lit by the wall atlas, the floor plan and the ceiling plan. */
  walls: THREE.MeshStandardMaterial[];
  floors: THREE.MeshStandardMaterial[];
  ceilings: THREE.MeshStandardMaterial[];
  /** 0 = the old shading, 1 = all baked. */
  mix: { value: number };
  fading: boolean;
};

function litMaterials(k: Kit): LitMaterials {
  const cache = new Map<string, THREE.Material>();
  const lit: LitMaterials = {
    walls: [],
    floors: [],
    ceilings: [],
    mix: { value: 0 },
    fading: false,
    mat(key) {
      let m = cache.get(key);
      if (!m) {
        const copy = k.keep((k.mat(key) as THREE.MeshStandardMaterial).clone());
        takesBake(copy, lit.mix);
        (key === "ceiling" ? lit.ceilings : lit.walls).push(copy);
        cache.set(key, (m = copy));
      }
      return m;
    },
  };
  return lit;
}

/**
 * Teaches a material to take its light from the bake in its `lightMap` slot:
 * instead of adding light, the map scales the surface's colour (and glow),
 * eased in from the vertex shading by `mix`.
 */
export function takesBake(m: THREE.MeshStandardMaterial, mix: { value: number }) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.bakeMix = mix;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float bakeMix;")
      .replace(
        "#include <color_fragment>",
        `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
  vec3 rampShade = vColor.rgb;
#else
  vec3 rampShade = vec3( 1.0 );
#endif
#ifdef USE_LIGHTMAP
  vec3 bakeShade = mix( rampShade, texture2D( lightMap, vLightMapUv ).rgb * lightMapIntensity, bakeMix );
#else
  vec3 bakeShade = rampShade;
#endif
diffuseColor.rgb *= bakeShade;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
#ifdef USE_LIGHTMAP
  totalEmissiveRadiance *= mix( vec3( 1.0 ), bakeShade, bakeMix );
#endif`,
      )
      .replace("#include <lights_fragment_maps>", THREE.ShaderChunk.lights_fragment_maps.replace("irradiance += lightMapIrradiance;", ""))
      // A floor reflects the room, so where the room is dim its reflections are too.
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
#ifdef USE_LIGHTMAP
  reflectedLight.indirectSpecular *= mix( vec3( 1.0 ), clamp( bakeShade, 0.0, 1.0 ), bakeMix );
#endif`,
      );
  };
  m.customProgramCacheKey = () => "baked-light";
}

function bakedLight(k: Kit, layouts: LightLayout[], lit: LitMaterials[]): BakedLight {
  const texture = (data: Uint8Array, w: number, h: number) => {
    const t = k.keep(new THREE.DataTexture(data, w, h, THREE.RGBAFormat));
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.channel = 1;
    t.needsUpdate = true;
    return t;
  };
  const give = (ms: THREE.MeshStandardMaterial[], t: THREE.Texture) => {
    for (const m of ms) {
      m.lightMap = t;
      // The bake is stored halved, so it can brighten as well as darken.
      m.lightMapIntensity = 2;
      m.needsUpdate = true;
    }
  };
  let forced: number | null = null;
  return {
    layouts,
    apply(baked) {
      const layout = layouts[baked.level];
      const l = lit[baked.level];
      if (!layout || !l) return;
      give(l.walls, texture(baked.atlas, layout.atlas.width, layout.atlas.height));
      give(l.floors, texture(baked.floor, layout.plan.cols, layout.plan.rows));
      give(l.ceilings, texture(baked.ceiling, layout.plan.cols, layout.plan.rows));
      l.fading = true;
    },
    baked: () => lit.flatMap((l, i) => (l.walls[0]?.lightMap ? [i] : [])),
    force(mix) {
      forced = mix;
      for (const l of lit) if (l.walls[0]?.lightMap) l.mix.value = mix ?? 1;
    },
    tick(dt) {
      for (const l of lit) {
        if (!l.fading || forced !== null) continue;
        l.mix.value = Math.min(1, l.mix.value + dt / 1.4);
        // The bake already darkens the floor by the walls; the contact shadows keep to the furniture.
        for (const m of l.floors) m.aoMapIntensity = 1 - 0.2 * l.mix.value;
        if (l.mix.value >= 1) l.fading = false;
      }
    },
  };
}

// ── Walls ────────────────────────────────────────────────────────────────

function buildWalls(k: Kit, b: Building, level: Level, batch: Batch, shared: Batch, baked: Batch, layout: LightLayout) {
  const plaster = new Map<string, Quads>();
  const q = (paint: string) => {
    let quads = plaster.get(paint);
    if (!quads) plaster.set(paint, (quads = new Quads()));
    return quads;
  };
  const reveals = new Quads();
  const skin = new Quads();
  const y = level.y;
  const top = b.levels.length - 1;
  const bandTop = level.index < top ? b.levels[level.index + 1].y : b.roofY + 1.2;
  const trims = new Map<string, FaceTrim>();
  for (const t of wallTrim(b, level)) trims.set(`${t.wall}:${t.side}`, t);

  for (const [wi, w] of level.walls.entries()) {
    const H = w.top ?? level.ceiling;
    const t = w.thick;
    const along = horizontal(w) ? "x" : "z";
    const start = along === "x" ? w.x0 : w.z0;
    const end = along === "x" ? w.x1 : w.z1;
    const centre = along === "x" ? w.z0 : w.x0;
    const openings = w.openings.map((o) => ({ ...o, a: start + o.from, b: start + o.to }));

    if (w.glass) {
      buildGlassWall(k, level, w, batch);
    } else {
      for (const side of [-1, 1]) {
        const n: Vec = along === "x" ? { x: 0, z: side } : { x: side, z: 0 };
        const line = centre + (side * t) / 2;
        // The outside of an outer wall wears the façade instead.
        if (w.outside && w.outside.x === n.x && w.outside.z === n.z) continue;
        const face = faceFor(layout, wi, side as 1 | -1);
        const lm = face && { layout, face, base: y };
        const ft = trims.get(`${wi}:${side}`);
        const grand = ft?.style === "grand";
        // Mouldings on this face, by material, lit by the face's own bake.
        const plane = { along, line, n, base: y } as const;
        const surface = {
          shade: (yy: number) => shadeAt(Math.min(H, Math.max(0, yy)), H),
          light: face
            ? (ss: number, yy: number) =>
                faceUv(layout, face, Math.min(end, Math.max(start, ss)), Math.min(H - 0.01, Math.max(0.01, yy)))
            : undefined,
        };
        const trimBy = new Map<string, Mouldings>();
        const trim = (key: string) => {
          let m = trimBy.get(key);
          if (!m) trimBy.set(key, (m = new Mouldings(plane, surface)));
          return m;
        };
        const paintOn = (ss: number) =>
          paintAt(level, along === "x" ? { x: ss, z: line + n.z * 0.3 } : { x: line + n.x * 0.3, z: ss });
        // Paint follows the room each stretch of wall faces.
        const STEP = 0.25;
        const breaks = new Set<number>([start, end]);
        for (const o of openings) {
          if (o.a > start && o.a < end) breaks.add(o.a);
          if (o.b > start && o.b < end) breaks.add(o.b);
        }
        let prev: string | null | undefined;
        for (let s = start; s < end; s += STEP) {
          const mid = Math.min(end - 1e-3, s + STEP / 2);
          const p = along === "x" ? { x: mid, z: line + n.z * 0.3 } : { x: line + n.x * 0.3, z: mid };
          const paint = paintAt(level, p);
          if (prev !== undefined && paint !== prev) breaks.add(s);
          prev = paint;
        }
        const cuts = [...breaks].sort((p0, p1) => p0 - p1);
        for (let i = 0; i + 1 < cuts.length; i++) {
          const s0 = cuts[i];
          const s1 = cuts[i + 1];
          if (s1 - s0 < 1e-4) continue;
          const mid = (s0 + s1) / 2;
          const p = along === "x" ? { x: mid, z: line + n.z * 0.3 } : { x: line + n.x * 0.3, z: mid };
          const paint = paintAt(level, p);
          if (!paint) continue;
          const hole = openings.find((o) => o.a <= s0 + 1e-6 && o.b >= s1 - 1e-6);
          const pieces: [number, number][] = hole
            ? [
                [0, hole.bottom],
                [hole.top, H],
              ]
            : [[0, H]];
          for (const [p0, p1] of pieces) {
            if (p1 - p0 < 1e-3) continue;
            shadedUpright(q(paint), n, line, s0, s1, y, p0, p1, H, lm);
          }
          if (ft && (!hole || hole.bottom > 0.05)) {
            // A skirting board along the foot of the wall.
            trim(`skirting:${paint}`).sweep([[s0, 0], [s1, 0]], skirting(ft.skirting, grand));
          }
          if (ft && ft.cornice > 0 && (!hole || hole.top < H - ft.cornice - 0.01)) {
            // A cornice where the wall meets the ceiling.
            trim(`plaster:${paint}`).sweep([[s0, H], [s1, H]], grand ? grandCornice(ft.cornice) : plainCornice(ft.cornice));
          }
        }
        if (ft) {
          // Casings round the doorways.
          for (const c of ft.casings) {
            const paint = paintOn(c.a - c.width / 2) ?? paintOn(c.b + c.width / 2);
            if (!paint) continue;
            const m = trim(`plaster:${paint}`);
            m.sweep(
              [
                [c.a, 0],
                [c.a, c.top],
                [c.b, c.top],
                [c.b, 0],
              ],
              casing(c.width, grand),
            );
            if (grand) {
              // A plinth block at the foot of each side, taking the skirting.
              m.block(c.a - c.width - 0.012, c.a, 0, ft.skirting + 0.05, 0.045);
              m.block(c.b, c.b + c.width + 0.012, 0, ft.skirting + 0.05, 0.045);
            }
          }
          // Pilasters, with a base and a capital under the cornice.
          const capTop = H - ft.cornice;
          for (const p of ft.pilasters) {
            const paint = paintOn(p);
            if (!paint) continue;
            const m = trim(`plaster:${paint}`);
            m.block(p - 0.31, p + 0.31, 0, 0.24, 0.085);
            m.block(p - 0.28, p + 0.28, 0.24, 0.3, 0.07);
            m.block(p - 0.25, p + 0.25, 0.3, capTop - 0.3, 0.055);
            m.block(p - 0.27, p + 0.27, capTop - 0.3, capTop - 0.24, 0.065);
            m.block(p - 0.29, p + 0.29, capTop - 0.24, capTop - 0.12, 0.075);
            m.block(p - 0.32, p + 0.32, capTop - 0.12, capTop, 0.09);
          }
          // Blind arches between them.
          for (const pn of ft.panels) {
            const paint = paintOn((pn.a + pn.b) / 2);
            if (!paint) continue;
            const r = (pn.b - pn.a) / 2;
            const spring = pn.y1 - r;
            const head: [number, number][] = [];
            if (pn.arch) {
              for (let i = 0; i <= 16; i++) {
                const t = (i / 16) * Math.PI;
                head.push([pn.a + r + r * Math.cos(t), spring + r * Math.sin(t)]);
              }
            } else {
              head.push([pn.b, pn.y1], [pn.a, pn.y1]);
            }
            trim(`plaster:${paint}`).sweep([[pn.a, pn.y0], [pn.b, pn.y0], ...head], PANEL, true);
          }
        }
        for (const [key, m] of trimBy) if (!m.empty) baked.push(key, m.build());
      }
      // The ends of the wall, and every reveal round its openings.
      for (const [s, dir] of [
        [start, -1],
        [end, 1],
      ] as const) {
        const n: Vec = along === "x" ? { x: dir, z: 0 } : { x: 0, z: dir };
        upright(reveals, n, s, centre - t / 2, centre + t / 2, y, y + H);
      }
      for (const o of openings) {
        const n0: Vec = along === "x" ? { x: 1, z: 0 } : { x: 0, z: 1 };
        const n1: Vec = along === "x" ? { x: -1, z: 0 } : { x: 0, z: -1 };
        upright(reveals, n0, o.a, centre - t / 2, centre + t / 2, y + o.bottom, y + o.top);
        upright(reveals, n1, o.b, centre - t / 2, centre + t / 2, y + o.bottom, y + o.top);
        const [x0, z0, x1, z1] =
          along === "x" ? [o.a, centre - t / 2, o.b, centre + t / 2] : [centre - t / 2, o.a, centre + t / 2, o.b];
        reveals.level(x0, z0, x1, z1, y + o.top, true);
        if (o.bottom > 0) reveals.level(x0, z0, x1, z1, y + o.bottom);
        if (o.kind === "window" || o.kind === "glass") windowPane(batch, w, o, along, centre, y);
      }
    }

    // ── The façade outside ──
    if (w.outside) {
      const n = w.outside;
      const line = centre + ((along === "x" ? n.z : n.x) * t) / 2 + (along === "x" ? n.z : n.x) * 0.02;
      const lo = level.index === 0 ? -0.05 : y;
      const glassTop = w.glass ? y + H - 0.05 : null;
      const s0 = start - t / 2 - 0.03;
      const s1 = end + t / 2 + 0.03;
      const bounds = [s0, ...openings.flatMap((o) => [o.a, o.b]), s1].sort((p0, p1) => p0 - p1);
      for (let i = 0; i + 1 < bounds.length; i++) {
        const a = bounds[i];
        const c = bounds[i + 1];
        if (c - a < 1e-4) continue;
        const hole = openings.find((o) => o.a <= a + 1e-6 && o.b >= c - 1e-6);
        const spans: [number, number][] = glassTop
          ? [[glassTop, bandTop]]
          : hole
            ? [
                [lo, y + hole.bottom],
                [y + hole.top, bandTop],
              ]
            : [[lo, bandTop]];
        for (const [p0, p1] of spans) {
          if (p1 - p0 < 1e-3) continue;
          upright(skin, n, line, a, c, p0, p1, sunShade(k, n), sunShade(k, n));
        }
        if (hole && !w.glass) {
          // Dark glass in the façade's openings, seen from outside.
          const g = new Quads();
          upright(g, n, line - (n.x + n.z) * 0.12, a, c, y + hole.bottom, y + hole.top);
          shared.push("facade-glass", g.build());
          // Deep reveals: the façade is thick.
          const rv = new Quads();
          const inward = -(n.x + n.z);
          const across: [number, number] = [line + inward * 0.12, line].sort((p, r) => p - r) as [number, number];
          upright(rv, along === "x" ? { x: 1, z: 0 } : { x: 0, z: 1 }, a, across[0], across[1], y + hole.bottom, y + hole.top, 0.8, 0.8);
          upright(rv, along === "x" ? { x: -1, z: 0 } : { x: 0, z: -1 }, c, across[0], across[1], y + hole.bottom, y + hole.top, 0.8, 0.8);
          shared.push("facade-trim", rv.build());
        }
      }
    }
  }
  for (const [paint, quads] of plaster) baked.push(`plaster:${paint}`, quads.build());
  if (!reveals.empty) batch.push(`plaster:${WHITE}`, reveals.build());
  if (!skin.empty) shared.push("facade", skin.build());
}

/** How bright a façade facing `n` looks in today's sun. */
function sunShade(k: Kit, n: Vec) {
  const s = k.sun;
  const h = Math.hypot(s.x, s.z) || 1;
  const facing = (n.x * s.x + n.z * s.z) / h;
  return 0.74 + 0.26 * Math.max(0, facing) * Math.min(1, h * 1.4);
}

/** A pane of glass in a window opening, with a slim steel frame. */
function windowPane(batch: Batch, w: Wall, o: Opening & { a: number; b: number }, along: "x" | "z", centre: number, y: number) {
  const len = o.b - o.a;
  const h = o.top - o.bottom;
  const mid = (o.a + o.b) / 2;
  const cx = along === "x" ? mid : centre;
  const cz = along === "x" ? centre : mid;
  const yaw = along === "x" ? 0 : Math.PI / 2;
  const pane = new THREE.PlaneGeometry(len, h);
  batch.add("glass", pane, cx, y + o.bottom + h / 2, cz, yaw);
  pane.dispose();
  const f = 0.05;
  // Frame and mullions every 1.6 m or so.
  const bars = Math.max(1, Math.round(len / 1.6));
  for (let i = 0; i <= bars; i++) {
    const s = o.a + (i * len) / bars - mid;
    batch.box("steel", cx + (along === "x" ? s : 0), y + o.bottom, cz + (along === "x" ? 0 : s), along === "x" ? f : 0.08, h, along === "x" ? 0.08 : f);
  }
  for (const yy of [o.bottom, o.top - f]) {
    batch.box("steel", cx, y + yy, cz, along === "x" ? len : 0.08, f, along === "x" ? 0.08 : len);
  }
  void w;
}

/** Floor-to-ceiling glass: panes between slim mullions, a transom, doors where the openings are. */
function buildGlassWall(k: Kit, level: Level, w: Wall, batch: Batch) {
  const along = horizontal(w) ? "x" : "z";
  const start = along === "x" ? w.x0 : w.z0;
  const end = along === "x" ? w.x1 : w.z1;
  const centre = along === "x" ? w.z0 : w.x0;
  const H = level.ceiling;
  const y = level.y;
  const doors = w.openings.filter((o) => o.kind === "door" || o.kind === "entrance").map((o) => [start + o.from, start + o.to] as const);
  const at = (s: number, c = centre): [number, number] => (along === "x" ? [s, c] : [c, s]);
  const box = (key: string, s0: number, s1: number, y0: number, y1: number, depth: number) => {
    const [x, z] = at((s0 + s1) / 2);
    const len = s1 - s0;
    batch.box(key, x, y + y0, z, along === "x" ? len : depth, y1 - y0, along === "x" ? depth : len);
  };
  // Panes between the doors.
  const spans: [number, number][] = [];
  let s = start;
  for (const [d0, d1] of doors) {
    if (d0 > s) spans.push([s, d0]);
    s = d1;
  }
  if (s < end) spans.push([s, end]);
  const transom = Math.min(3.4, H - 0.4);
  for (const [s0, s1] of spans) {
    const len = s1 - s0;
    const pane = new THREE.PlaneGeometry(len, H);
    const [x, z] = at((s0 + s1) / 2);
    batch.add("glass", pane, x, y + H / 2, z, along === "x" ? 0 : Math.PI / 2);
    pane.dispose();
    const bays = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= bays; i++) {
      const m = s0 + (i * len) / bays;
      box("black", m - 0.035, m + 0.035, 0, H, 0.16);
    }
    box("black", s0, s1, transom - 0.035, transom + 0.035, 0.12);
  }
  // Head and sill across the whole run.
  box("black", start, end, H - 0.08, H, 0.2);
  box("black", start, end, 0, 0.06, 0.2);
  // Frames round the doorways.
  for (const [d0, d1] of doors) {
    box("black", d0 - 0.06, d0, 0, H, 0.2);
    box("black", d1, d1 + 0.06, 0, H, 0.2);
    box("black", d0, d1, 3.15, 3.4, 0.2);
    const pane = new THREE.PlaneGeometry(d1 - d0, H - 3.4);
    const [x, z] = at((d0 + d1) / 2);
    batch.add("glass", pane, x, y + 3.4 + (H - 3.4) / 2, z, along === "x" ? 0 : Math.PI / 2);
    pane.dispose();
  }
  void k;
}

// ── Floors ───────────────────────────────────────────────────────────────

const SURFACE_SCALE = { wood: 2, stone: 4, deck: 2, street: 4 } as const;

function buildFloors(k: Kit, b: Building, level: Level, group: THREE.Group, layout: LightLayout, lit: LitMaterials) {
  // A soft shadow round every wall and piece of furniture, in the same plan as the baked light.
  const map = layout.plan;
  const { x0, z0 } = map;
  const solids = [
    // Walls, with gaps at their doorways.
    ...level.walls.flatMap((w) => {
      const h = w.thick / 2 + 0.02;
      const alongX = w.z0 === w.z1;
      const start = alongX ? w.x0 : w.z0;
      const end = alongX ? w.x1 : w.z1;
      const dark = w.glass ? 0.25 : 0.95;
      const gaps = w.openings
        .filter((o) => o.bottom < 0.1 && (o.kind === "door" || o.kind === "entrance"))
        .map((o) => [start + o.from, start + o.to])
        .sort((p, q) => p[0] - q[0]);
      const out: { x0: number; z0: number; x1: number; z1: number; dark: number }[] = [];
      let at = start - h;
      for (const [g0, g1] of [...gaps, [end + h, end + h]]) {
        if (g0 > at) {
          out.push(
            alongX
              ? { x0: at, x1: g0, z0: w.z0 - h, z1: w.z0 + h, dark }
              : { x0: w.x0 - h, x1: w.x0 + h, z0: at, z1: g0, dark },
          );
        }
        at = Math.max(at, g1);
      }
      return out;
    }),
    ...level.items
      .filter((it) => it.solid && it.kind !== "shaft" && it.kind !== "solid")
      .map((it) => ({
        x0: it.x - it.w / 2,
        z0: it.z - it.d / 2,
        x1: it.x + it.w / 2,
        z1: it.z + it.d / 2,
        dark: it.kind === "tree" || it.kind === "lamp" || it.kind === "bollard" ? 0.25 : 0.55,
      })),
    ...level.rails.filter((r) => r.kind === "glass").map((r) => ({ ...r, x0: r.x0 - 0.06, z0: r.z0 - 0.06, x1: r.x1 + 0.06, z1: r.z1 + 0.06, dark: 0.3 })),
  ];
  const shade = k.tex(floorShade({ w: map.w, h: map.h }, k.low ? 4 : 6, solids, { x: x0, z: z0 }), { color: false });
  shade.channel = 1;

  const bySurface = new Map<string, Quads>();
  for (const f of level.floors) {
    let q = bySurface.get(f.surface);
    if (!q) bySurface.set(f.surface, (q = new Quads(map)));
    q.level(f.rect.x0, f.rect.z0, f.rect.x1, f.rect.z1, level.y, false, SURFACE_SCALE[f.surface]);
  }
  for (const [surface, q] of bySurface) {
    const base = k.mat(`floor:${surface}`) as THREE.MeshStandardMaterial;
    const m = k.keep(base.clone());
    m.aoMap = shade;
    m.aoMapIntensity = 1;
    // Outside, the sky does the lighting; indoors, the bake.
    if (surface !== "street" && surface !== "deck") {
      takesBake(m, lit.mix);
      lit.floors.push(m);
    }
    const mesh = new THREE.Mesh(k.keep(q.build()), m);
    mesh.userData.floor = level.index;
    group.add(mesh);
    k.pickables.push(mesh);
  }
  // The street is not the visitor's to walk, but it's there.
  void b;
}

// ── Ceilings ─────────────────────────────────────────────────────────────

function buildCeiling(k: Kit, b: Building, level: Level, baked: Batch, batch: Batch, layout: LightLayout) {
  const y = level.y + level.ceiling;
  // The same lights the bake shines (`lib/walk/light.ts`).
  const lights = ceilingLights(b, level);
  const q = new Quads(layout.plan);
  for (const r of lights.covered) q.level(r.x0, r.z0, r.x1, r.z1, y, true);
  if (!q.empty) baked.push("ceiling", q.build());

  // Laylights over the galleries; downlights everywhere else.
  const down = new THREE.CircleGeometry(0.09, 20);
  down.rotateX(Math.PI / 2);
  const can = boxGeometry(0.2, 0.06, 0.2);
  for (const space of level.spaces) {
    const r = space.rect;
    if (space.kind === "outside" || space.kind === "terrace") continue;
    if (space.kind === "gallery" || space.kind === "lab") {
      const room = space.room !== undefined ? b.rooms[space.room].rect : r;
      const inset = LAYLIGHT_INSET;
      const lx0 = room.x0 + inset;
      const lz0 = room.z0 + inset;
      const lx1 = room.x1 - inset;
      const lz1 = room.z1 - inset;
      const panel = new Quads();
      panel.level(lx0, lz0, lx1, lz1, y - 0.01, true);
      batch.push("laylight", panel.build());
      // A grid of slim bars across the diffuser, and a deep frame round it.
      for (let x = lx0; x <= lx1 + 1e-6; x += (lx1 - lx0) / Math.max(1, Math.round((lx1 - lx0) / 1.2))) {
        batch.box("lamp-frame", x, y - 0.06, (lz0 + lz1) / 2, 0.04, 0.05, lz1 - lz0);
      }
      for (let z = lz0; z <= lz1 + 1e-6; z += (lz1 - lz0) / Math.max(1, Math.round((lz1 - lz0) / 1.2))) {
        batch.box("lamp-frame", (lx0 + lx1) / 2, y - 0.06, z, lx1 - lx0, 0.05, 0.04);
      }
      // Track rails round the room, a metre and a half from the walls.
      const t = 1.4;
      for (const [ax, az, bx, bz] of [
        [room.x0 + t, room.z0 + t, room.x1 - t, room.z0 + t],
        [room.x0 + t, room.z1 - t, room.x1 - t, room.z1 - t],
        [room.x0 + t, room.z0 + t, room.x0 + t, room.z1 - t],
        [room.x1 - t, room.z0 + t, room.x1 - t, room.z1 - t],
      ]) {
        batch.box("black", (ax + bx) / 2, y - 0.04, (az + bz) / 2, Math.max(0.04, bx - ax), 0.035, Math.max(0.04, bz - az));
      }
      continue;
    }
  }
  // Downlights on a 3 m grid, where there's ceiling overhead.
  for (const p of lights.downs) {
    batch.add("lamp", down, p.x, y - 0.005, p.z);
    batch.add("black", can, p.x, y + 0.04, p.z);
  }
  down.dispose();
  can.dispose();
  void k;
}

// ── Edges: slab edges and glass balustrades ──────────────────────────────

function buildEdges(b: Building, level: Level, batch: Batch) {
  const y = level.y;
  const edge = new Quads();
  const floors = level.floors.map((f) => f.rect);
  const onFloor = (p: Vec) => floors.some((r) => inRect(r, p, 1e-4));
  for (const r of level.rails) {
    if (r.kind !== "glass") continue;
    const alongX = r.z0 === r.z1;
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    if (len < 0.05) continue;
    const mid = alongX ? { x: (r.x0 + r.x1) / 2, z: r.z0 } : { x: r.x0, z: (r.z0 + r.z1) / 2 };
    // Outward: the side with no floor.
    const out: Vec = alongX
      ? onFloor({ x: mid.x, z: mid.z + 0.1 })
        ? { x: 0, z: -1 }
        : { x: 0, z: 1 }
      : onFloor({ x: mid.x + 0.1, z: mid.z })
        ? { x: -1, z: 0 }
        : { x: 1, z: 0 };
    const line = alongX ? r.z0 : r.x0;
    const [s0, s1] = alongX ? [r.x0, r.x1] : [r.z0, r.z1];
    // The slab's edge, seen from the atrium (not on the ground or out on the street),
    // moulded like an entablature: a cap along its top, a step along its underside.
    if (level.index > 0) {
      upright(edge, out, line, s0, s1, y - SLAB, y + 0.02);
      const m = new Mouldings({ along: alongX ? "x" : "z", line, n: out, base: y }, { shade: () => 1 });
      m.sweep([[s0, 0.02], [s1, 0.02]], SLAB_CAP);
      m.sweep([[s0, -SLAB], [s1, -SLAB]], SLAB_BASE);
      batch.push("slab", m.build());
    }
    // Glass balustrade: a steel shoe, a pane, an oak handrail.
    const inset = 0.06;
    const lineIn = line - (out.x + out.z) * inset;
    const cx = alongX ? mid.x : lineIn;
    const cz = alongX ? lineIn : mid.z;
    batch.box("steel", cx, y, cz, alongX ? len : 0.08, 0.1, alongX ? 0.08 : len);
    const pane = new THREE.PlaneGeometry(len, 0.95);
    batch.add("glass", pane, cx, y + 0.1 + 0.475, cz, alongX ? 0 : Math.PI / 2);
    pane.dispose();
    batch.box("oak", cx, y + 1.02, cz, alongX ? len + 0.04 : 0.07, 0.05, alongX ? 0.07 : len + 0.04);
  }
  if (!edge.empty) batch.push("slab", edge.build());
  void b;
}

// ── Stairs ───────────────────────────────────────────────────────────────

function buildStair(k: Kit, b: Building, s: Stair, batch: Batch) {
  const y0 = b.levels[s.from].y;
  const y1 = b.levels[s.to].y;
  const { rect } = s;
  const run = rect.z1 - rect.z0;
  const n = Math.round((y1 - y0) / 0.18);
  const rise = (y1 - y0) / n;
  const tread = run / n;
  const w = rect.x1 - rect.x0;
  const cx = (rect.x0 + rect.x1) / 2;
  // z of the front edge of step i (0 = bottom), going up the stair.
  const dir = s.rise === "n" ? -1 : 1;
  const zAt = (i: number) => (s.rise === "n" ? rect.z1 : rect.z0) + dir * i * tread;
  const grand = s.kind === "grand";

  for (let i = 0; i < n; i++) {
    const zFront = zAt(i);
    const zBack = zAt(i + 1);
    const zc = (zFront + zBack) / 2;
    const top = y0 + (i + 1) * rise;
    batch.box("stair-oak", cx, top - 0.05, zc, w, 0.05, tread + 0.02);
    // Risers: oak on the grand stair, white on the atrium's.
    batch.box(grand ? "stair-oak" : "slab", cx, top - rise, zFront + dir * 0.01, w, rise - 0.05, 0.02);
  }

  const slope = Math.atan2(y1 - y0, run);
  const length = Math.hypot(run, y1 - y0);
  const midZ = (rect.z0 + rect.z1) / 2;
  const midY = (y0 + y1) / 2;
  const tilt = new THREE.Matrix4();
  const tiltAt = (x: number, dy: number) => {
    const m = new THREE.Matrix4().makeTranslation(x, midY + dy, midZ);
    // Positive tilt raises the end toward −z when rising north.
    m.multiply(new THREE.Matrix4().makeRotationX(s.rise === "n" ? slope : -slope));
    return m;
  };

  if (grand) {
    // Solid underneath: a white wedge along its open side, a face at the top end.
    const side = new THREE.Shape();
    side.moveTo(0, 0);
    for (let i = 0; i < n; i++) {
      side.lineTo(i * tread, (i + 1) * rise);
      side.lineTo((i + 1) * tread, (i + 1) * rise);
    }
    side.lineTo(run, 0);
    side.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(side);
    // Shape x runs up the stair (−z), y up; it faces +x.
    tilt.makeTranslation(rect.x1 + 0.005, y0, rect.z1).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    batch.push(`plaster:${WHITE}`, placed(g, tilt));
    g.dispose();
    const end = new Quads();
    upright(end, { x: 0, z: -1 }, rect.z0, rect.x0, rect.x1, y0, y1);
    batch.push(`plaster:${WHITE}`, end.build());
    // Cushions on the west steps, where people sit.
    for (const i of [4, 9, 13, 18, 22, 27]) {
      const zc = (zAt(i) + zAt(i + 1)) / 2;
      batch.box(i % 2 ? "cushion-a" : "cushion-b", rect.x0 + 0.9 + ((i * 37) % 3) * 0.7, y0 + (i + 1) * rise, zc, 0.55, 0.07, 0.42);
    }
  } else {
    // A folded white plate: stringers both sides, a smooth soffit below.
    const soffit = new THREE.PlaneGeometry(w, length);
    soffit.rotateX(Math.PI / 2);
    batch.push("slab", placed(soffit, tiltAt(cx, -0.32)));
    soffit.dispose();
    for (const x of [rect.x0 + 0.015, rect.x1 - 0.015]) {
      const plate = boxGeometry(0.03, 0.42, length);
      batch.push("slab", placed(plate, tiltAt(x, -0.1)));
      plate.dispose();
    }
  }
  // Glass balustrades with oak handrails, both sides (the grand stair's west side is the wall).
  for (const x of grand ? [rect.x1 - 0.06] : [rect.x0 + 0.05, rect.x1 - 0.05]) {
    const pane = new THREE.PlaneGeometry(length, 0.92);
    pane.rotateY(Math.PI / 2);
    batch.push("glass", placed(pane, tiltAt(x, 0.6)));
    pane.dispose();
    const rail = boxGeometry(0.07, 0.05, length + 0.1);
    batch.push("oak", placed(rail, tiltAt(x, 1.05)));
    rail.dispose();
  }
  if (grand) {
    const rail = boxGeometry(0.05, 0.05, length);
    batch.push("brass", placed(rail, tiltAt(rect.x0 + 0.08, 0.9)));
    rail.dispose();
  }
  void k;
}

// ── Roof and oculus ──────────────────────────────────────────────────────

function buildRoof(k: Kit, b: Building, batch: Batch) {
  const top = b.levels.length - 1;
  const fp = b.footprints[top];
  const roof = new Quads();
  for (const r of subtractRect(fp, b.atrium)) roof.level(r.x0, r.z0, r.x1, r.z1, b.roofY);
  batch.push("roof", roof.build());

  // The atrium's ceiling: a flat white plane round a great round skylight.
  const { x0, z0, x1, z1 } = b.atrium;
  const { x, z, r } = b.oculus;
  const shape = new THREE.Shape();
  shape.moveTo(x0, z0);
  shape.lineTo(x1, z0);
  shape.lineTo(x1, z1);
  shape.lineTo(x0, z1);
  shape.lineTo(x0, z0);
  const hole = new THREE.Path();
  hole.absarc(x, z, r, 0, Math.PI * 2, false);
  shape.holes.push(hole);
  const ceiling = new THREE.ShapeGeometry(shape, 48);
  // Shape (x, y) → world (x, z), facing down.
  ceiling.rotateX(Math.PI / 2);
  ceiling.translate(0, b.roofY - SLAB, 0);
  batch.push("ceiling", ceiling);
  // The drum: a white cylinder up through the roof, open to the sky.
  const drum = new THREE.CylinderGeometry(r, r, 3.2, 64, 1, true);
  drum.translate(x, b.roofY - SLAB + 1.6, z);
  batch.push("drum", drum);
  // A ring of light where the drum meets the glass.
  const glass = new THREE.CircleGeometry(r, 64);
  glass.rotateX(Math.PI / 2);
  glass.translate(x, b.roofY - SLAB + 3.2, z);
  batch.push("sky-glass", glass);
  // Fins across the skylight, casting their pattern.
  for (let i = -3; i <= 3; i++) {
    const fin = boxGeometry(0.05, 0.4, Math.sqrt(Math.max(0, r * r - (i * 1.2) ** 2)) * 2);
    fin.translate(x + i * 1.2, b.roofY - SLAB + 3, z);
    batch.push("slab", fin);
  }
  // The planted wall on the terrace.
  if (b.greenWall) {
    const gw = b.greenWall;
    const plants = new Quads();
    plants.wall(gw.x + 0.25, gw.z1, gw.x + 0.25, gw.z0, gw.y0, gw.y1, 0.95, 1.05, 0);
    // Texture in 3 m tiles.
    const g = plants.build();
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
    batch.push("green-wall", g);
    batch.box("planter", gw.x + 0.45, gw.y0, (gw.z0 + gw.z1) / 2, 0.5, 0.45, gw.z1 - gw.z0);
  }
  void k;
}

/** The lift's glass shaft and car. */
function buildLift(k: Kit, b: Building): LiftRig {
  const { shaft } = b.lift;
  const batch = new Batch(k.mat, k.keep);
  // Up to the atrium's ceiling.
  const yMax = b.roofY - SLAB;
  const w = shaft.x1 - shaft.x0;
  const d = shaft.z1 - shaft.z0;
  const cx = (shaft.x0 + shaft.x1) / 2;
  const cz = (shaft.z0 + shaft.z1) / 2;
  // Corner posts and glass walls, all the way up.
  for (const [x, z] of [
    [shaft.x0, shaft.z0],
    [shaft.x1, shaft.z0],
    [shaft.x0, shaft.z1],
    [shaft.x1, shaft.z1],
  ]) {
    batch.box("black", x, 0, z, 0.1, yMax, 0.1);
  }
  const glass = new Quads();
  upright(glass, { x: 1, z: 0 }, shaft.x1, shaft.z0, shaft.z1, 0, yMax);
  upright(glass, { x: 0, z: -1 }, shaft.z0, shaft.x0, shaft.x1, 0, yMax);
  upright(glass, { x: 0, z: 1 }, shaft.z1, shaft.x0, shaft.x1, 0, yMax);
  batch.push("glass", glass.build());
  // The landing side: a steel frame round each floor's doors, glass between.
  for (const level of b.levels) {
    const y = level.y;
    batch.box("steel", shaft.x0, y + 2.4, cz, 0.12, 0.12, d);
    batch.box("steel", shaft.x0, y, b.lift.doorZ0 - 0.06, 0.12, 2.4, 0.08);
    batch.box("steel", shaft.x0, y, b.lift.doorZ1 + 0.06, 0.12, 2.4, 0.08);
    // Glass either side of the doors and above them, up to the next floor.
    const top = level.index < b.levels.length - 1 ? b.levels[level.index + 1].y : yMax;
    const g = new Quads();
    upright(g, { x: -1, z: 0 }, shaft.x0 - 0.01, shaft.z0, b.lift.doorZ0 - 0.1, y, top);
    upright(g, { x: -1, z: 0 }, shaft.x0 - 0.01, b.lift.doorZ1 + 0.1, shaft.z1, y, top);
    upright(g, { x: -1, z: 0 }, shaft.x0 - 0.01, b.lift.doorZ0 - 0.1, b.lift.doorZ1 + 0.1, y + 2.52, top);
    batch.push("glass", g.build());
  }
  batch.flush(k.shared);

  // The car: oak floor, glass sides, a brass rail, a light overhead.
  const car = new THREE.Group();
  const cw = w - 0.2;
  const cd = d - 0.2;
  const carBatch = new Batch(k.mat, k.keep);
  carBatch.box("stair-oak", 0, -0.12, 0, cw, 0.12, cd);
  carBatch.box("black", 0, 2.45, 0, cw, 0.12, cd);
  for (const [x, z] of [
    [-cw / 2, -cd / 2],
    [cw / 2, -cd / 2],
    [-cw / 2, cd / 2],
    [cw / 2, cd / 2],
  ]) {
    carBatch.box("black", x, 0, z, 0.06, 2.45, 0.06);
  }
  const panes = new Quads();
  upright(panes, { x: -1, z: 0 }, cw / 2, -cd / 2, cd / 2, 0, 2.45);
  upright(panes, { x: 0, z: 1 }, -cd / 2, -cw / 2, cw / 2, 0, 2.45);
  upright(panes, { x: 0, z: -1 }, cd / 2, -cw / 2, cw / 2, 0, 2.45);
  carBatch.push("glass", panes.build());
  carBatch.box("brass", cw / 2 - 0.08, 0.95, 0, 0.04, 0.04, cd - 0.2);
  const light = new Quads();
  light.level(-cw / 2 + 0.3, -cd / 2 + 0.3, cw / 2 - 0.3, cd / 2 - 0.3, 2.44, true);
  carBatch.push("laylight", light.build());
  // Cables up to the roof.
  carBatch.flush(car);
  const cables = new THREE.Mesh(k.keep(new THREE.BoxGeometry(0.02, 1, 0.02)), k.mat("black"));
  cables.position.set(0, 2.57, 0);
  car.add(cables);
  car.position.set(cx, 0, cz);
  k.shared.add(car);

  // Doors on every floor: two steel leaves that part.
  const leaf = k.keep(new THREE.BoxGeometry(0.04, 2.38, (b.lift.doorZ1 - b.lift.doorZ0) / 2));
  const doors = b.levels.map((level) => {
    const l = new THREE.Mesh(leaf, k.mat("door-steel"));
    const r = new THREE.Mesh(leaf, k.mat("door-steel"));
    const h = (b.lift.doorZ1 - b.lift.doorZ0) / 4;
    l.position.set(shaft.x0 + 0.03, level.y + 1.19, b.lift.doorZ0 + h);
    r.position.set(shaft.x0 + 0.03, level.y + 1.19, b.lift.doorZ1 - h);
    k.levels[level.index].add(l, r);
    return { l, r, h, y: level.y };
  });
  const hit = new THREE.Mesh(k.keep(new THREE.BoxGeometry(0.3, 2.6, 2.4)), k.mat("hidden"));
  hit.userData.focus = { kind: "lift" };
  hit.position.set(shaft.x0, 0, (b.lift.doorZ0 + b.lift.doorZ1) / 2);
  k.shared.add(hit);
  k.pickables.push(hit);

  return {
    update(y, at, open) {
      car.position.y = y;
      cables.scale.y = Math.max(0.1, b.roofY - y - 2.6);
      cables.position.y = 2.57 + cables.scale.y / 2;
      for (const [i, d] of doors.entries()) {
        const o = i === at ? open : 0;
        d.l.position.z = b.lift.doorZ0 + d.h - o * d.h * 1.9;
        d.r.position.z = b.lift.doorZ1 - d.h + o * d.h * 1.9;
      }
      hit.position.y = (doors[at ?? 0]?.y ?? 0) + 1.3;
    },
  };
}

/** The sliding front doors in the glass wall. */
function buildEntrance(k: Kit, b: Building): (open: number) => void {
  const { x0, x1, z } = b.entrance.doors;
  const mid = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  const leaves = [-1, 1].map((side) => {
    const g = new THREE.Group();
    const frame = new Batch(k.mat, k.keep);
    frame.box("black", 0, 0, 0, half, 0.06, 0.06);
    frame.box("black", 0, 3.1, 0, half, 0.06, 0.06);
    frame.box("black", -half / 2, 0, 0, 0.05, 3.16, 0.06);
    frame.box("black", half / 2, 0, 0, 0.05, 3.16, 0.06);
    frame.box("steel", (half / 2 - 0.25) * -side, 0.9, 0.05, 0.03, 1.2, 0.03);
    frame.flush(g);
    const pane = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(half, 3.1)), k.mat("glass"));
    pane.position.y = 1.58;
    g.add(pane);
    g.position.set(mid + side * (half / 2), 0, z);
    k.shared.add(g);
    return { g, side };
  });
  // The motion sensor's box over the doors.
  const sensor = new THREE.Mesh(k.keep(new THREE.BoxGeometry(0.5, 0.12, 0.12)), k.mat("black"));
  sensor.position.set(mid, 3.5, z + 0.12);
  k.shared.add(sensor);
  return (open) => {
    for (const { g, side } of leaves) g.position.x = mid + side * (half / 2 + open * half * 0.95);
  };
}

/** A shaft of daylight from the oculus down the atrium, with dust in it. */
function buildOculusLight(k: Kit, b: Building): THREE.Object3D {
  const beam = new THREE.Group();
  const top = b.roofY;
  const height = top - 0.2;
  const { x, z, r } = b.oculus;
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(r * 1.7, height)), k.mat("beam"));
    m.rotation.y = (i * Math.PI) / 3;
    beam.add(m);
  }
  beam.position.set(x, height / 2, z);
  // Lean with the sun.
  beam.rotation.z = Math.max(-0.18, Math.min(0.18, -k.sun.x * 0.2));
  beam.rotation.x = Math.max(-0.18, Math.min(0.18, k.sun.z * 0.2));
  k.shared.add(beam);
  return beam;
}
