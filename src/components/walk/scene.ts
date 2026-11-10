import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { type Building, type Vec, inRect, spaceAt, stairProgress } from "@/lib/walk/building";
import { type Focus, type Place, collides, forward, stairAt } from "@/lib/walk/motion";
import { type Architecture, buildArchitecture } from "./architecture";
import { type City, buildCity } from "./city";
import { type Furnishing, buildFurnishing } from "./furnishing";
import type { Kit } from "./kit";
import { type Crowd, type Figure, buildCrowd, buildSelf, pose } from "./people";
import {
  type Fonts,
  asphalt,
  bookSpines,
  cityWindows,
  contactShadow,
  deck,
  facadeRipples,
  lightBeam,
  lightPool,
  livingWall,
  mix,
  pavement,
  skyline,
  stoneFloor,
  plaster,
  sunThroughGlass,
  woodFloor,
} from "./textures";

/**
 * The whole museum in 3D, built from the same `Building` as everything
 * else: seven floors round a skylit atrium, the lobby and the street, the
 * paintings, the furniture and the other visitors. Plain three.js, no
 * React, so the page can load it on demand.
 */

export type ViewState = {
  at: Place;
  /** Height of the ground under the visitor (stairs, the lift car). */
  ground: number;
  yaw: number;
  pitch: number;
  /** Eye height above the ground, with the walking bob in it. */
  eye: number;
  time: number;
  dt: number;
  focusId: string | null;
  hoverId: string | null;
  /** Where a click-to-walk is heading. */
  marker: Place | null;
  /** How far behind the visitor the camera sits; 0 is through their eyes. */
  zoom: number;
  /** Metres walked, for the stride, and how fast (0–1) they're walking now. */
  stride: number;
  pace: number;
  /** 0–1: how hard the visitor is hurrying, which widens the view a touch. */
  rush: number;
  /** The lift car's height, and which floor's doors are open, by how much. */
  lift: { y: number; at: number | null; open: number };
  /** Riding the lift: every floor is in view through the glass. */
  riding: boolean;
};

export type Pick = { focus: Focus } | { place: Place } | null;

export type MuseumScene = {
  resize(width: number, height: number, dpr: number): void;
  render(state: ViewState): void;
  /** What's under a point on screen, in normalized device coordinates. */
  pick(x: number, y: number): Pick;
  /**
   * Where a painting is on screen, in CSS pixels from the canvas's top left,
   * as of the last frame; null when it isn't drawn or is behind the camera.
   */
  artRect(id: string): { left: number; top: number; width: number; height: number } | null;
  /** The nearest car, for the sound of the street. */
  nearestCar(p: Vec): { dist: number; dx: number; speed: number };
  /** Other visitors, as circles to keep out of. */
  obstacles(level: number): { x: number; z: number; r: number }[];
  dispose(): void;
};

/** Where the sun is now: low in the morning and evening, never set (the museum keeps daylight hours). */
export function sunNow(date = new Date()): THREE.Vector3 {
  const h = date.getHours() + date.getMinutes() / 60;
  // 0 at 7:00, 1 at 19:00, clamped to opening hours.
  const t = Math.max(0.08, Math.min(0.92, (h - 7) / 12));
  const elevation = 0.22 + Math.sin(t * Math.PI) * 0.78;
  // East (+x) in the morning, south (+z) at noon, west (−x) in the evening.
  const azimuth = (t - 0.5) * Math.PI;
  return new THREE.Vector3(-Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).normalize();
}

export function createMuseumScene(
  canvasEl: HTMLCanvasElement,
  { building: b, fonts, low }: { building: Building; fonts: Fonts; low: boolean },
): MuseumScene {
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: !low, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  // Lets a test script read draw calls and triangles while developing.
  if (process.env.NODE_ENV === "development") Object.assign(window, { __renderer: renderer });

  const trash: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    trash.push(x);
    return x;
  };
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (c: HTMLCanvasElement, opts: { repeat?: boolean; color?: boolean } = {}) => {
    const t = keep(new THREE.CanvasTexture(c));
    if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
    if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(low ? 4 : 8, maxAniso);
    return t;
  };

  const sun = sunNow();
  // Warmer and lower light early and late.
  const warmth = 1 - Math.min(1, sun.y / 0.7);
  const skyTop = new THREE.Color().set(mix("#4f86c6", "#6b7fa8", warmth * 0.5));
  const skyHorizon = new THREE.Color().set(mix("#d9e4ec", "#f2d2a8", warmth * 0.8));
  const daylight = 0.92 + 0.08 * (1 - warmth);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.45;
  scene.background = skyHorizon.clone();
  scene.fog = new THREE.Fog(skyHorizon.clone(), 140, 950);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1500);
  camera.rotation.order = "YXZ";

  // Light: soft and even from above, as galleries are; a little warmth from the skylights.
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7a66, 1.15));
  const top = new THREE.DirectionalLight(0xfff4e6, 0.55);
  top.position.set(0.25, 1, 0.15);
  scene.add(top);

  // ── Materials, by key, made on first use ──
  const materials = new Map<string, THREE.Material>();
  const textures = new Map<string, THREE.Texture>();
  const texOnce = (key: string, make: () => HTMLCanvasElement, opts: { repeat?: boolean; color?: boolean } = {}) => {
    let t = textures.get(key);
    if (!t) textures.set(key, (t = tex(make(), opts)));
    return t;
  };
  // One plaster finish for every wall, in 2 m tiles (wall texture coordinates are in metres).
  let plasterPair: { map: THREE.Texture; bump: THREE.Texture } | null = null;
  const plasterMaps = () => {
    if (!plasterPair) {
      const made = plaster(low ? 512 : 1024);
      plasterPair = { map: tex(made.map, { repeat: true, color: false }), bump: tex(made.bump, { repeat: true, color: false }) };
      plasterPair.map.repeat.set(0.5, 0.5);
      plasterPair.bump.repeat.set(0.5, 0.5);
    }
    return plasterPair;
  };
  const std = (p: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial(p));
  const basic = (p: THREE.MeshBasicMaterialParameters) => keep(new THREE.MeshBasicMaterial(p));
  const outdoor = (hex: string) => new THREE.Color().set(hex).multiplyScalar(daylight);
  const make = (key: string): THREE.Material => {
    const [kind, arg] = key.split(/:(.*)/);
    switch (kind) {
      case "plaster": {
        const { map, bump } = plasterMaps();
        return std({ color: arg, map, bumpMap: bump, bumpScale: 0.35, roughness: 0.93, metalness: 0, vertexColors: true });
      }
      case "skirting":
        // Gloss paint on wood: smoother, and catching a little more light.
        return std({ color: mix(arg, arg === "#f3f1ec" ? "#bdb8ae" : "#000000", 0.3), roughness: 0.45, vertexColors: true });
      case "ceiling":
        return std({ color: "#f2f0eb", roughness: 1, emissive: "#f2f0eb", emissiveIntensity: 0.5, vertexColors: true });
      case "slab":
        return std({ color: "#f2f0eb", roughness: 0.85, emissive: "#f2f0eb", emissiveIntensity: 0.12, vertexColors: true, side: THREE.DoubleSide });
      case "drum":
        return std({ color: "#f4f2ee", roughness: 0.9, emissive: "#f4f2ee", emissiveIntensity: 0.55, side: THREE.DoubleSide });
      case "laylight":
        return basic({ color: "#fff9ef" });
      case "lamp":
        return basic({ color: "#fff3dc" });
      case "lamp-frame":
        return std({ color: "#d9d7d1", roughness: 0.7 });
      case "sky-glass":
        return basic({ color: new THREE.Color("#f6fbff").multiplyScalar(1.15), toneMapped: false });
      case "beam":
        return basic({
          map: texOnce("beam", lightBeam, { color: false }),
          color: "#fff2da",
          transparent: true,
          opacity: 0.07,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        });
      case "glass":
        return std({
          color: "#dfeaee",
          transparent: true,
          opacity: 0.13,
          roughness: 0.05,
          metalness: 0.1,
          envMapIntensity: 1.6,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      case "facade": {
        const t = texOnce("facade", facadeRipples, { repeat: true });
        t.repeat.set(1 / 4, 1 / 2);
        return basic({ map: t, color: outdoor("#ffffff"), vertexColors: true });
      }
      case "facade-glass":
        return basic({ color: outdoor("#46586a"), transparent: true, opacity: 0.78 });
      case "facade-trim":
        return basic({ color: outdoor("#d4d0c8"), vertexColors: true });
      case "roof":
        return basic({ color: outdoor("#8e8b85") });
      case "floor": {
        const surface = arg as "wood" | "stone" | "deck" | "street";
        const map =
          surface === "wood"
            ? texOnce("wood", woodFloor, { repeat: true })
            : surface === "stone"
              ? texOnce("stone", stoneFloor, { repeat: true })
              : surface === "deck"
                ? texOnce("deck", deck, { repeat: true })
                : texOnce("pavement", pavement, { repeat: true });
        const out = surface === "deck" || surface === "street";
        return std({
          map,
          roughness: surface === "stone" ? 0.28 : surface === "wood" ? 0.42 : 0.85,
          envMapIntensity: surface === "stone" ? 1.1 : 0.8,
          emissive: out ? "#ffffff" : "#000000",
          emissiveMap: out ? map : null,
          emissiveIntensity: out ? 0.35 : 0,
        });
      }
      case "stair-oak":
        return std({ map: texOnce("wood", woodFloor, { repeat: true }), color: "#f0dcc0", roughness: 0.45 });
      case "oak":
        return std({ map: texOnce("wood", woodFloor, { repeat: true }), color: "#e3cba6", roughness: 0.5 });
      case "oak-dark":
        return std({ map: texOnce("wood", woodFloor, { repeat: true }), color: "#7a5a40", roughness: 0.5 });
      case "black":
        return std({ color: "#1c1c1c", roughness: 0.5, metalness: 0.3 });
      case "steel":
        return std({ color: "#b9bec4", metalness: 0.9, roughness: 0.3 });
      case "door-steel":
        return std({ color: "#c9cdd2", metalness: 0.85, roughness: 0.35 });
      case "brass":
        return std({ color: "#b08d4a", metalness: 0.85, roughness: 0.35 });
      case "chrome":
        return std({ color: "#eef0f2", metalness: 1, roughness: 0.06, envMapIntensity: 1.6 });
      case "gilt":
        return std({ color: "#a88645", metalness: 0.8, roughness: 0.38 });
      case "frame-black":
        return std({ color: "#141414", metalness: 0.1, roughness: 0.45 });
      case "frame-thin":
        return std({ color: "#1d1a17", metalness: 0.05, roughness: 0.55 });
      case "mat-board":
        return std({ color: "#f4f1ea", roughness: 0.95 });
      case "label-blank":
        return std({ color: "#f7f4ee", roughness: 0.9 });
      case "hidden":
        return basic({ visible: false });
      case "pool":
        return basic({ map: texOnce("pool", lightPool, { color: false }) });
      case "shadow":
      case "shadow-soft":
        return basic({
          map: texOnce("shadow", contactShadow, { color: false }),
          transparent: true,
          opacity: kind === "shadow" ? 1 : 0.55,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        });
      case "leather":
        return std({ color: "#4a3a30", roughness: 0.6 });
      case "fabric":
        return std({ color: "#7d827f", roughness: 0.95 });
      case "cushion-a":
        return std({ color: "#c8553a", roughness: 0.95 });
      case "cushion-b":
        return std({ color: "#2f4f6f", roughness: 0.95 });
      case "pot":
        return std({ color: "#e8e2d8", roughness: 0.8 });
      case "bark":
        return std({ color: "#4b3a2c", roughness: 0.95 });
      case "tree-grate":
        return std({ color: "#2a2a2a", roughness: 0.6, metalness: 0.5 });
      case "corian":
        return std({ color: "#f2f0eb", roughness: 0.35 });
      case "chair":
        return std({ color: "#2b2b2b", roughness: 0.6 });
      case "cup":
        return std({ color: "#ffffff", roughness: 0.3 });
      case "pastry-a":
        return std({ color: "#c98b4a", roughness: 0.8 });
      case "pastry-b":
        return std({ color: "#e3c27a", roughness: 0.8 });
      case "pendant":
        return std({ color: "#1e1e1e", roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
      case "lamp-green":
        return std({ color: "#1f5c3a", roughness: 0.4, emissive: "#2a5a3a", emissiveIntensity: 0.4 });
      case "screen":
        return basic({ color: ["#3a6df0", "#ff2e63", "#f6c500"][Number(arg) || 0], toneMapped: false });
      case "op-disc": {
        const t = texOnce("op-disc", () => {
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          const ctx = c.getContext("2d")!;
          for (let r = 128; r > 0; r -= 8) {
            ctx.fillStyle = (r / 8) % 2 ? "#111" : "#f4f4f4";
            ctx.beginPath();
            ctx.arc(128 + (128 - r) * 0.15, 128, r, 0, Math.PI * 2);
            ctx.fill();
          }
          return c;
        });
        return std({ map: t, roughness: 0.4 });
      }
      case "op-grid": {
        const t = texOnce("op-grid", () => {
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          const ctx = c.getContext("2d")!;
          for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
            ctx.fillStyle = (i + j) % 2 ? "#111" : "#f4f4f4";
            const s = 16 * (1 + 0.3 * Math.sin((i + j) / 3));
            ctx.fillRect(i * 16, j * 16, s, s);
          }
          return c;
        });
        return std({ map: t, roughness: 0.4 });
      }
      case "stone-block":
        return std({ color: "#8b8478", roughness: 0.95, flatShading: true });
      case "corten":
        return std({ color: "#7a3b1e", roughness: 0.85, emissive: "#3a1a0c", emissiveIntensity: 0.25 });
      case "concrete":
        return std({ color: "#b3ada3", roughness: 0.95 });
      case "soil":
        return std({ color: "#3b2f25", roughness: 1 });
      case "planter":
        return std({ color: "#9c968c", roughness: 0.95 });
      case "green-wall": {
        const t = texOnce("green", livingWall, { repeat: true });
        return std({ map: t, roughness: 0.9, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.25, vertexColors: true });
      }
      case "ground":
        return basic({ color: outdoor("#8a857c") });
      case "pavement": {
        const t = texOnce("pavement", pavement, { repeat: true });
        return basic({ map: t, color: outdoor("#e6e2da") });
      }
      case "asphalt": {
        const t = texOnce("asphalt", asphalt, { repeat: true });
        return basic({ map: t, color: outdoor("#c8c8c8") });
      }
      case "curb":
        return basic({ color: outdoor("#bdb8ae") });
      case "road-paint":
        return basic({ color: outdoor("#e9e5da") });
      case "city": {
        const t = texOnce(`city:${arg}`, () => cityWindows(Number(arg)), { repeat: true });
        return basic({ map: t, color: outdoor("#ffffff"), vertexColors: true });
      }
      case "city-roof":
        return basic({ color: outdoor("#7a7772"), vertexColors: true });
      case "skyline": {
        const t = texOnce("skyline", skyline);
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(3, 1);
        return basic({ map: t, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false });
      }
      case "awning":
        return basic({ color: outdoor(["#2f4d3a", "#7a2e2e", "#1f2a3a"][Number(arg) || 0]) });
      case "car":
        return std({ color: arg, metalness: 0.6, roughness: 0.3, envMapIntensity: 1.2, emissive: arg, emissiveIntensity: 0.25 });
      case "car-glass":
        return std({ color: "#1e2328", metalness: 0.8, roughness: 0.1 });
      case "tyre":
        return std({ color: "#151515", roughness: 0.9 });
      case "tail":
        return basic({ color: "#c0262d" });
      case "person":
        return std({ color: arg, roughness: 0.75 });
      case "sun": {
        const [cols, t] = arg.split(":").map(Number);
        const map = texOnce(`sun:${arg}`, () => sunThroughGlass(cols, t / 20), { color: true });
        return basic({
          map,
          transparent: true,
          opacity: 0.32 * Math.min(1, sun.y * 2),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -3,
        });
      }
      default: {
        if (kind.startsWith("leaf") || kind.startsWith("tree-leaf")) {
          const greens = ["#2f5a32", "#3f7240", "#264a2a", "#4d8248"];
          const c = greens[Number(kind.split("-").pop()) % greens.length];
          return std({
            color: c,
            roughness: 0.8,
            flatShading: true,
            emissive: kind.startsWith("tree") ? c : "#000000",
            emissiveIntensity: kind.startsWith("tree") ? 0.35 : 0,
          });
        }
        if (kind.startsWith("book-")) {
          return std({ color: ["#c8442f", "#1f4e79", "#e5d8b8", "#2f6b4f", "#111111"][Number(kind.slice(5)) % 5], roughness: 0.7 });
        }
        if (kind.startsWith("books-")) {
          const v = Number(kind.slice(6));
          return std({ map: texOnce(`books:${v}`, () => bookSpines(v), { repeat: true }), roughness: 0.8 });
        }
        if (kind.startsWith("screen-")) {
          return basic({ color: ["#3a6df0", "#ff2e63", "#f6c500"][Number(kind.slice(7)) % 3], toneMapped: false });
        }
        if (kind.startsWith("awning-")) {
          return basic({ color: outdoor(["#2f4d3a", "#7a2e2e", "#1f2a3a"][Number(kind.slice(7)) % 3]) });
        }
        return std({ color: "#ff00ff" });
      }
    }
  };
  const mat = (key: string) => {
    let m = materials.get(key);
    if (!m) materials.set(key, (m = make(key)));
    return m;
  };

  // ── Build ──
  const levels = b.levels.map(() => new THREE.Group());
  const shared = new THREE.Group();
  scene.add(...levels, shared);
  const pickables: THREE.Object3D[] = [];
  const k: Kit = { mat, tex, keep, levels, shared, pickables, sun, low };

  const arch: Architecture = buildArchitecture(k, b);
  const furnishing: Furnishing = buildFurnishing(k, b, fonts);
  const city: City = buildCity(k, b, { top: skyTop, horizon: skyHorizon });
  const crowd: Crowd = buildCrowd(k, b);
  const self: Figure = buildSelf(k);
  // Walls and ceilings stop a click from reaching floors behind them.
  for (const g of levels) {
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const m = o.material as THREE.Material;
      if ([...materials.entries()].some(([key, v]) => v === m && /^(plaster|slab|ceiling|stair-oak)/.test(key))) pickables.push(o);
    });
  }
  shared.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.Material;
    if (m === materials.get("stair-oak")) {
      o.userData.stairs = true;
      pickables.push(o);
    }
    if (m === materials.get("facade") || m === materials.get(`plaster:#f3f1ec`)) pickables.push(o);
  });

  // ── Walk-to marker ──
  const marker = new THREE.Mesh(
    keep(new THREE.RingGeometry(0.16, 0.22, 40)),
    basic({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // ── Dust in the light ──
  const dustSeeds: { x: number; y: number; z: number; speed: number; phase: number; rise: number }[] = [];
  {
    let s = 91;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < (low ? 300 : 700); i++) {
      dustSeeds.push({
        x: b.oculus.x + (r() - 0.5) * b.oculus.r * 1.6,
        y: r() * b.roofY,
        z: b.oculus.z + (r() - 0.5) * b.oculus.r * 1.6,
        speed: 0.05 + r() * 0.12,
        phase: r() * 7,
        rise: 0.01 + r() * 0.03,
      });
    }
  }
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(dustSeeds.length * 3), 3));
  const motes = new THREE.Points(
    dustGeo,
    keep(
      new THREE.PointsMaterial({
        map: (mat("pool") as THREE.MeshBasicMaterial).map,
        color: 0xfff1d6,
        size: 0.05,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  motes.frustumCulled = false;
  scene.add(motes);

  const raycaster = new THREE.Raycaster();
  let baseFov = 66;
  const ndc = new THREE.Vector2();
  let exposure = 1;
  let entranceOpen = 0;
  let shownLevel = -1;
  let wideOpen = true;
  const artGroups = levels.map((g) => g.children.find((c) => c.userData.art));
  const near = new Set<number>();
  // The baked light, worked out in a worker once we know which floor the visitor is on.
  let baker: Worker | null = null;
  let baking = false;
  const bake = (from: number) => {
    baking = true;
    const order = b.levels.map((l) => l.index).sort((p, q) => Math.abs(p - from) - Math.abs(q - from) || q - p);
    try {
      baker = new Worker(new URL("./bake.worker.ts", import.meta.url), { type: "module" });
    } catch {
      return;
    }
    baker.onmessage = (e) => arch.light.apply(e.data);
    if (process.env.NODE_ENV === "development") Object.assign(window, { __light: arch.light });
    baker.onerror = (e) => console.warn("Couldn't bake the light", e.message);
    baker.postMessage({ building: b, low, order });
  };
  const view = { width: 1, height: 1 };
  const corner = new THREE.Vector3();

  /** Out in the open (the atrium, the lobby, the terrace, the street): every floor may be in view. */
  const openView = (s: ViewState, cam: THREE.Vector3) => {
    if (s.riding) return true;
    if (stairAt(b, s.at.level, s.at.pos)) return true;
    const space = spaceAt(b.levels[s.at.level], { x: cam.x, z: cam.z });
    return !space || ["ring", "lobby", "terrace", "lounge", "outside"].includes(space.kind);
  };

  return {
    resize(width, height, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      view.width = width;
      view.height = height;
      camera.aspect = width / Math.max(1, height);
      // A taller frame on phones needs a wider vertical view to feel the same.
      baseFov = camera.aspect < 1 ? 78 : 66;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    },

    render(s) {
      const level = b.levels[s.at.level];
      if (!baking) bake(s.at.level);
      arch.light.tick(s.dt);
      // Through the visitor's eyes, or pulled back behind them, never through a wall.
      const f = forward(s.yaw);
      const back = { x: -f.x * Math.cos(s.pitch), y: -Math.sin(s.pitch), z: -f.z * Math.cos(s.pitch) };
      const headY = s.ground + (s.zoom > 0 ? 2.05 : s.eye);
      const ceiling = level.y + level.ceiling - 0.15;
      let d = 0;
      while (d + 0.05 <= s.zoom) {
        const p = { x: s.at.pos.x + back.x * (d + 0.05), z: s.at.pos.z + back.z * (d + 0.05) };
        const y = headY + back.y * (d + 0.05);
        const underCeiling = spaceAt(level, p)?.kind !== "terrace" && spaceAt(level, p)?.kind !== "outside";
        if (collides(b, s.at.level, p, 0.15) && !stairAt(b, s.at.level, p)) break;
        if (underCeiling && y > ceiling && !inRect(b.atrium, p)) break;
        d += 0.05;
      }
      camera.position.set(s.at.pos.x + back.x * d, Math.max(s.ground + 0.3, headY + back.y * d), s.at.pos.z + back.z * d);
      camera.rotation.set(s.pitch, s.yaw, 0);

      // The visitor's own body, when the camera steps back.
      self.root.visible = d > 0.45;
      if (self.root.visible) {
        self.root.position.set(s.at.pos.x, s.ground, s.at.pos.z);
        self.root.rotation.y = s.yaw;
        pose(self, s.stride, s.pace);
      }

      // Which floors to draw: the one you're on and its neighbours, or all of them out in the open.
      const open = openView(s, camera.position);
      if (s.at.level !== shownLevel || open !== wideOpen) {
        shownLevel = s.at.level;
        wideOpen = open;
        near.clear();
        for (const g of levels.keys()) {
          const show = open || Math.abs(g - s.at.level) <= 1;
          levels[g].visible = show;
          const art = artGroups[g];
          if (art) art.visible = Math.abs(g - s.at.level) <= 1;
          if (show) near.add(g);
        }
        // Pictures for the floor you're on and the ones either side.
        for (const i of [s.at.level, s.at.level + 1, s.at.level - 1]) if (i >= 0 && i < b.levels.length) furnishing.loadLevel(i);
      }

      // Eyes adjust: bright outside, a little brighter in the galleries.
      const space = spaceAt(level, s.at.pos);
      const want = !space ? 0.95 : space.kind === "outside" ? 0.72 : space.kind === "terrace" ? 0.8 : space.kind === "lobby" ? 0.93 : 1.04;
      exposure += (want - exposure) * Math.min(1, s.dt * 1.5);
      renderer.toneMappingExposure = exposure;

      const fov = baseFov + s.rush * 5;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov += (fov - camera.fov) * 0.1;
        camera.updateProjectionMatrix();
      }

      arch.lift.update(s.lift.y, s.lift.at, s.lift.open);
      // The front doors open for anyone near them, inside or out.
      const doors = b.entrance.doors;
      const toDoors = s.at.level === 0 ? Math.hypot(s.at.pos.x - (doors.x0 + doors.x1) / 2, s.at.pos.z - doors.z) : 99;
      entranceOpen += ((toDoors < 3.2 ? 1 : 0) - entranceOpen) * Math.min(1, s.dt * 3);
      arch.entrance(entranceOpen);
      arch.beam.rotation.y = s.time * 0.01;

      furnishing.update({ pos: s.at.pos, focusId: s.focusId, hoverId: s.hoverId });
      city.update(s.time, s.dt, camera.position);
      crowd.update(s.dt, s.at, (l) => levels[l].visible, s.at.pos);

      // Dust turning slowly in the oculus's light.
      const dust = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dustSeeds.length; i++) {
        const m = dustSeeds[i];
        const t = s.time * m.speed + m.phase;
        dust.setXYZ(i, m.x + Math.sin(t) * 0.6, 0.4 + ((m.y + s.time * m.rise) % (b.roofY - 1)), m.z + Math.cos(t * 0.8) * 0.6);
      }
      dust.needsUpdate = true;

      if (s.marker) {
        marker.visible = true;
        const y = b.levels[s.marker.level].y;
        marker.position.set(s.marker.pos.x, y + 0.015, s.marker.pos.z);
        const pulse = 1 + Math.sin(s.time * 6) * 0.08;
        marker.scale.set(pulse, pulse, pulse);
      } else marker.visible = false;

      renderer.render(scene, camera);
    },

    pick(x, y) {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      for (const hit of hits) {
        // Only what's drawn.
        let o: THREE.Object3D | null = hit.object;
        let shown = true;
        while (o) {
          if (!o.visible && !(o as THREE.Mesh).userData.focus) shown = false;
          o = o.parent;
        }
        if (!shown) continue;
        const focus = hit.object.userData.focus as Focus | undefined;
        if (focus) return { focus };
        if (hit.object.userData.floor !== undefined) {
          return { place: { level: hit.object.userData.floor as number, pos: { x: hit.point.x, z: hit.point.z } } };
        }
        if (hit.object.userData.stairs) {
          const p = { x: hit.point.x, z: hit.point.z };
          // Whichever flight this tread belongs to, and which half of it.
          for (const st of b.stairs) {
            if (!inRect(st.rect, p, 0.05)) continue;
            const y0 = b.levels[st.from].y;
            const y1 = b.levels[st.to].y;
            if (hit.point.y < y0 - 0.2 || hit.point.y > y1 + 0.2) continue;
            return { place: { level: stairProgress(st, p) >= 0.5 ? st.to : st.from, pos: p } };
          }
        }
        return null;
      }
      return null;
    },

    artRect(id) {
      const face = furnishing.face(id);
      if (!face) return null;
      for (let o: THREE.Object3D | null = face; o; o = o.parent) if (!o.visible) return null;
      const geo = face.geometry as THREE.PlaneGeometry;
      const { width: w, height: h } = geo.parameters;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [cx, cy] of [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [-w / 2, h / 2],
        [w / 2, h / 2],
      ]) {
        corner.set(cx, cy, 0).applyMatrix4(face.matrixWorld);
        // Behind the camera: there's no honest rectangle to give.
        if (corner.clone().applyMatrix4(camera.matrixWorldInverse).z > -camera.near) return null;
        corner.project(camera);
        const sx = ((corner.x + 1) / 2) * view.width;
        const sy = ((1 - corner.y) / 2) * view.height;
        x0 = Math.min(x0, sx);
        y0 = Math.min(y0, sy);
        x1 = Math.max(x1, sx);
        y1 = Math.max(y1, sy);
      }
      // Well off screen isn't worth flying from.
      if (x1 < 0 || y1 < 0 || x0 > view.width || y0 > view.height) return null;
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    },

    nearestCar: (p) => city.nearestCar(p),
    obstacles: (lv) => crowd.obstacles(lv),

    dispose() {
      baker?.terminate();
      for (const t of trash) t.dispose();
      for (const m of materials.values()) m.dispose();
      renderer.dispose();
    },
  };
}

