import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Wall } from "@/components/gallery/walls";
import { seedFrom, seededRandom } from "@/lib/museum/placeholder";
import { type FloorPlan, type PlanArtwork, ROW, Tile, tileAt } from "@/lib/walk/floor-plan";
import {
  CEILING,
  type Focus,
  type Vec,
  artCenter,
  collides,
  elevatorCenter,
  forward,
  lenticularView,
  standCenter,
} from "@/lib/walk/motion";
import {
  type Fonts,
  contactShadow,
  floorIndicator,
  lightPool,
  loadArt,
  luma,
  mix,
  placeholderArt,
  standTop,
  stoneFloor,
  waitingCard,
  wallLabel,
  wallLettering,
  windowView,
  woodFloor,
} from "./textures";

/**
 * The floor in 3D, built from the same `FloorPlan` as everything else: every
 * wall tile becomes plaster, every painting a framed canvas under its own pool
 * of light. Plain three.js, no React, so the page can load it on demand.
 *
 * Units are metres; see `lib/walk/motion.ts` for the coordinate system.
 */

export type ViewState = {
  pos: Vec;
  yaw: number;
  pitch: number;
  /** Eye height, with the walking bob in it. */
  eye: number;
  time: number;
  focusId: string | null;
  hoverId: string | null;
  /** Where a click-to-walk is heading. */
  marker: Vec | null;
  /** How far behind the visitor the camera sits; 0 is through their eyes. */
  zoom: number;
  /** Metres walked, for the stride, and how fast (0–1) they're walking now. */
  stride: number;
  pace: number;
  /** Holds the lift doors open (1) or shut (0); otherwise they open as you come near. */
  lift?: number;
  /** 0–1: how hard the visitor is hurrying, which widens the view a touch. */
  rush: number;
};

export type Pick = { focus: Focus } | { floor: Vec } | null;

export type MuseumScene = {
  resize(width: number, height: number, dpr: number): void;
  render(state: ViewState): void;
  /** What's under a point on screen, in normalized device coordinates. */
  pick(x: number, y: number): Pick;
  dispose(): void;
};

/** Centre of a painting above the floor. */
const HANG = 1.6;
const DOOR_H = 2.9;
/** Where a pulled-back camera aims: just above the visitor's head. */
const AVATAR_HEAD = 2.05;

const FRAMES = {
  gilt: { maxW: 1.8, maxH: 1.45, profile: 0.1, depth: 0.075, mat: 0 },
  black: { maxW: 1.9, maxH: 1.5, profile: 0.045, depth: 0.05, mat: 0 },
  mat: { maxW: 1.35, maxH: 1.05, profile: 0.035, depth: 0.04, mat: 0.16 },
} as const;

const isWallTile = (t: number) => t === Tile.Wall || t === Tile.Face || t === Tile.Void;

/** Collects quads into one mesh: one draw call for all the walls, one for each floor. */
class Quads {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];

  /** Four corners counter-clockwise as seen from the front. */
  add(p: THREE.Vector3Tuple[], n: THREE.Vector3Tuple, c: number[] = [1, 1, 1, 1], uv?: number[][]) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(...p[i]);
      this.nor.push(...n);
      this.col.push(c[i], c[i], c[i]);
      this.uv.push(...(uv ? uv[i] : [0, 0]));
    }
  }

  /** An upright quad along the line a→b; it faces (−dz, dx). */
  wall(ax: number, az: number, bx: number, bz: number, y0: number, y1: number, c0 = 1, c1 = 1) {
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
    );
  }

  /** A level quad facing up (or down). */
  level(x0: number, z0: number, x1: number, z1: number, y: number, down = false) {
    const uv = (x: number, z: number) => [x / 2, z / 2];
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
      undefined,
      order.map((i) => uv(p[i][0], p[i][2])),
    );
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

export function createMuseumScene(
  canvasEl: HTMLCanvasElement,
  { plan, wall, fonts }: { plan: FloorPlan; wall: Wall; fonts: Fonts },
): MuseumScene {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;

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
    t.anisotropy = Math.min(8, maxAniso);
    return t;
  };

  const dark = luma(wall.wall) < 110;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.5;
  const haze = mix(wall.wall, dark ? "#000000" : "#2a2622", dark ? 0.45 : 0.6);
  scene.background = new THREE.Color(haze);
  scene.fog = new THREE.Fog(haze, 18, 52);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  camera.rotation.order = "YXZ";

  // Light: soft sky from above, a key from the skylights, a little bounce.
  scene.add(new THREE.HemisphereLight(0xfff6ea, mix(wall.wall, "#6b5a45", 0.5), 1.25));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.1);
  sun.position.set(-3, 10, 8);
  scene.add(sun);

  const pickables: THREE.Object3D[] = [];
  const box = (w: number, h: number, d: number) => keep(new THREE.BoxGeometry(w, h, d));
  const plane = (w: number, h: number) => keep(new THREE.PlaneGeometry(w, h));
  const std = (p: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial(p));
  const basic = (p: THREE.MeshBasicMaterialParameters) => keep(new THREE.MeshBasicMaterial(p));
  const hidden = basic({ visible: false });
  const shadowTex = tex(contactShadow(), { color: false });
  const shadowMat = basic({ map: shadowTex, transparent: true, depthWrite: false });
  const addShadow = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(plane(w, d), shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    scene.add(m);
  };

  // ── Floors, walls, door lintels ────────────────────────────────────────
  const wood = new Quads();
  const stone = new Quads();
  const walls = new Quads();
  const skirting = new Quads();
  const shade = { floor: 0.82, eye: 1, top: dark ? 0.82 : 0.72 };
  const ex0 = plan.elevator.x;
  const ex1 = plan.elevator.x + plan.elevator.w;
  const lift = elevatorCenter(plan);
  const opening = { x0: lift.x - 0.8, x1: lift.x + 0.8, h: 2.35 };

  const upright = (ax: number, az: number, bx: number, bz: number, y0 = 0, y1 = CEILING) => {
    const at = (y: number) =>
      y <= 1.8
        ? shade.floor + ((shade.eye - shade.floor) * y) / 1.8
        : shade.eye + ((shade.top - shade.eye) * (y - 1.8)) / (CEILING - 1.8);
    if (y0 < 1.8 && y1 > 1.8) {
      walls.wall(ax, az, bx, bz, y0, 1.8, at(y0), at(1.8));
      walls.wall(ax, az, bx, bz, 1.8, y1, at(1.8), at(y1));
    } else walls.wall(ax, az, bx, bz, y0, y1, at(y0), at(y1));
    if (y0 === 0) {
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      const o = 0.012;
      skirting.wall(
        ax - (dz / len) * o,
        az + (dx / len) * o,
        bx - (dz / len) * o,
        bz + (dx / len) * o,
        0,
        0.11,
      );
    }
  };

  const floorKind = (x: number, y: number): "wood" | "stone" => {
    const t = tileAt(plan, x, y);
    if (t === Tile.Floor || t === Tile.Door) return "wood";
    if (t === Tile.Corridor) return "stone";
    // Furniture stands on whatever most of its neighbours are.
    let w = 0;
    let s = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = tileAt(plan, x + dx, y + dy);
      if (n === Tile.Floor || n === Tile.Door) w++;
      if (n === Tile.Corridor) s++;
    }
    return w >= s ? "wood" : "stone";
  };

  for (let y = 0; y < plan.rows; y++) {
    for (let x = 0; x < plan.cols; x++) {
      const t = tileAt(plan, x, y);
      if (isWallTile(t)) continue;
      (floorKind(x, y) === "wood" ? wood : stone).level(x, y, x + 1, y + 1, 0);
      if (isWallTile(tileAt(plan, x, y - 1))) {
        if (y === ROW.roomTop && x >= ex0 && x < ex1) {
          // The lift wall is built below, with a hole for the doors.
        } else upright(x, y, x + 1, y);
      }
      if (isWallTile(tileAt(plan, x, y + 1))) upright(x + 1, y + 1, x, y + 1);
      if (isWallTile(tileAt(plan, x - 1, y))) upright(x, y + 1, x, y);
      if (isWallTile(tileAt(plan, x + 1, y))) upright(x + 1, y, x + 1, y + 1);
      if (t === Tile.Door) {
        upright(x + 1, y, x, y, DOOR_H, CEILING);
        upright(x, y + 1, x + 1, y + 1, DOOR_H, CEILING);
        walls.level(x, y, x + 1, y + 1, DOOR_H, true);
      }
    }
  }
  // The lift wall, around the door opening.
  upright(ex0, ROW.roomTop, opening.x0, ROW.roomTop);
  upright(opening.x1, ROW.roomTop, ex1, ROW.roomTop);
  upright(opening.x0, ROW.roomTop, opening.x1, ROW.roomTop, opening.h, CEILING);

  const woodTex = tex(woodFloor(), { repeat: true });
  const stoneTex = tex(stoneFloor(), { repeat: true });
  const woodMesh = new THREE.Mesh(
    keep(wood.build()),
    std({ map: woodTex, roughness: 0.48, metalness: 0, envMapIntensity: 0.9 }),
  );
  const stoneMesh = new THREE.Mesh(
    keep(stone.build()),
    std({ map: stoneTex, roughness: 0.38, metalness: 0, envMapIntensity: 1 }),
  );
  woodMesh.userData.floor = true;
  stoneMesh.userData.floor = true;
  const wallMesh = new THREE.Mesh(
    keep(walls.build()),
    std({ color: wall.wall, roughness: 0.93, metalness: 0, vertexColors: true }),
  );
  const skirtMesh = new THREE.Mesh(
    keep(skirting.build()),
    std({
      color: dark ? mix(wall.wall, "#ffffff", 0.14) : mix(wall.wall, "#000000", 0.3),
      roughness: 0.6,
    }),
  );
  scene.add(woodMesh, stoneMesh, wallMesh, skirtMesh);
  pickables.push(woodMesh, stoneMesh, wallMesh);

  // ── Ceiling and its lights ─────────────────────────────────────────────
  // Galleries keep a pale ceiling whatever the walls, so the rooms stay bright.
  const ceilingColor = mix("#f2efe9", wall.wall, 0.1);
  const ceiling = new THREE.Mesh(
    plane(plan.cols, plan.rows),
    // Lit from below by the rooms; a little glow stands in for the bounce.
    std({ color: ceilingColor, roughness: 1, emissive: ceilingColor, emissiveIntensity: 0.55 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(plan.cols / 2, CEILING, plan.rows / 2);
  scene.add(ceiling);

  const glow = basic({ color: 0xfaf6ee });
  const rimMat = std({ color: mix(ceilingColor, "#000000", 0.25), roughness: 0.8 });
  const skylight = (x: number, z: number, w: number, d: number) => {
    const rim = new THREE.Mesh(plane(w + 0.16, d + 0.16), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, CEILING - 0.004, z);
    const lit = new THREE.Mesh(plane(w, d), glow);
    lit.rotation.x = Math.PI / 2;
    lit.position.set(x, CEILING - 0.008, z);
    scene.add(rim, lit);
    // Diffuser bars, so it reads as a skylight rather than a hole in the ceiling.
    const bars = Math.max(1, Math.round(w / 0.9));
    for (let i = 1; i < bars; i++) {
      const bar = new THREE.Mesh(box(0.04, 0.03, d), rimMat);
      bar.position.set(x - w / 2 + (i * w) / bars, CEILING - 0.02, z);
      scene.add(bar);
    }
  };
  const downlightGeo = keep(new THREE.CircleGeometry(0.12, 24));
  const downlight = (x: number, z: number) => {
    const m = new THREE.Mesh(downlightGeo, glow);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, CEILING - 0.006, z);
    scene.add(m);
  };
  const railMat = std({ color: 0x1c1c1c, roughness: 0.5, metalness: 0.4 });
  const canGeo = keep(new THREE.CylinderGeometry(0.06, 0.075, 0.2, 16));

  for (const room of plan.rooms) {
    const zMid = (ROW.roomTop + ROW.roomBottom + 1) / 2;
    skylight(room.x + room.w / 2, zMid + 0.6, Math.max(1, room.w - 3), 1.6);
    const rail = new THREE.Mesh(box(room.w - 0.6, 0.04, 0.05), railMat);
    rail.position.set(room.x + room.w / 2, CEILING - 0.03, ROW.roomTop + 1.6);
    scene.add(rail);
  }
  for (let x = 2.5; x < plan.cols - 1; x += 3)
    downlight(x, (ROW.corridorTop + ROW.corridorBottom + 1) / 2);
  downlight(lift.x, ROW.roomTop + 2.5);
  skylight(plan.lounge.x + plan.lounge.w / 2, ROW.roomTop + 3.5, plan.lounge.w - 3, 3);

  // ── Paintings ──────────────────────────────────────────────────────────
  const poolTex = tex(lightPool(), { color: false });
  const giltMat = std({ color: 0xa88645, metalness: 0.8, roughness: 0.38 });
  const blackMat = std({ color: 0x141414, metalness: 0.1, roughness: 0.45 });
  const thinMat = std({ color: 0x1d1a17, metalness: 0.05, roughness: 0.55 });
  const matBoard = std({ color: 0xf4f1ea, roughness: 0.95 });
  const placeholderShade = dark ? mix(wall.wall, "#ffffff", 0.1) : mix(wall.wall, "#000000", 0.1);

  type Hung = {
    id: string;
    art?: PlanArtwork;
    pool: THREE.MeshBasicMaterial;
    canvas: THREE.MeshStandardMaterial;
    views?: { textures: (THREE.Texture | null)[]; over: THREE.MeshStandardMaterial };
  };
  const hung: Hung[] = [];

  const hang = (
    id: string,
    cx: number,
    aspect: number,
    kind: keyof typeof FRAMES,
    focus: Focus,
  ) => {
    const f = FRAMES[kind];
    let w = f.maxW;
    let h = w / aspect;
    if (h > f.maxH) {
      h = f.maxH;
      w = h * aspect;
    }
    const group = new THREE.Group();
    group.position.set(cx, HANG, ROW.roomTop);
    scene.add(group);

    const ow = w + 2 * f.mat;
    const oh = h + 2 * f.mat;
    const frameMat = kind === "gilt" ? giltMat : kind === "black" ? blackMat : thinMat;
    const p = f.profile;
    for (const [bx, by, bw, bh] of [
      [0, oh / 2 + p / 2, ow + 2 * p, p],
      [0, -oh / 2 - p / 2, ow + 2 * p, p],
      [-ow / 2 - p / 2, 0, p, oh],
      [ow / 2 + p / 2, 0, p, oh],
    ]) {
      const m = new THREE.Mesh(box(bw, bh, f.depth), frameMat);
      m.position.set(bx, by, f.depth / 2);
      group.add(m);
    }
    if (f.mat) {
      const board = new THREE.Mesh(plane(ow, oh), matBoard);
      board.position.z = 0.012;
      group.add(board);
    }
    const canvasMat = std({
      color: placeholderShade,
      roughness: 0.82,
      emissive: 0xffffff,
      emissiveIntensity: 0,
    });
    const face = new THREE.Mesh(plane(w, h), canvasMat);
    face.position.z = 0.016;
    group.add(face);

    // Light pool on the wall and a spot can on the ceiling rail aimed at it.
    const pool = basic({
      map: poolTex,
      color: 0xfff0d8,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const poolMesh = new THREE.Mesh(plane(ow + 1.6, oh + 1.9), pool);
    poolMesh.position.set(0, 0.25, 0.003);
    group.add(poolMesh);
    const can = new THREE.Mesh(canGeo, railMat);
    can.position.set(cx, CEILING - 0.16, ROW.roomTop + 1.6);
    can.rotation.x = -0.75;
    scene.add(can);

    const hit = new THREE.Mesh(box(ow + 2 * p + 0.1, oh + 2 * p + 0.1, 0.25), hidden);
    hit.userData.focus = focus;
    group.add(hit);
    pickables.push(hit);

    return { group, face, canvasMat, pool, w, h, outerW: ow + 2 * p };
  };

  const setImage = (m: THREE.MeshStandardMaterial, t: THREE.Texture) => {
    m.map = t;
    m.emissiveMap = t;
    m.color.set(0xffffff);
    m.needsUpdate = true;
  };

  for (const art of plan.artworks) {
    const room = plan.rooms[art.room];
    const img = art.image;
    const aspect = img ? img.width / img.height : 4 / 3;
    const cx = artCenter(art).x;
    const piece = hang(art.id, cx, aspect, art.frame, { kind: "art", art });
    const entry: Hung = { id: art.id, art, pool: piece.pool, canvas: piece.canvasMat };
    hung.push(entry);

    if (art.frames) {
      // Two layers: the nearest view, and the next one fading in as you walk.
      const over = std({
        roughness: 0.82,
        emissive: 0xffffff,
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
      });
      const overMesh = new THREE.Mesh(plane(piece.w, piece.h), over);
      overMesh.position.z = 0.017;
      piece.group.add(overMesh);
      const textures: (THREE.Texture | null)[] = art.frames.map(() => null);
      entry.views = { textures, over };
      art.frames.forEach((frame, i) => {
        loadArt(frame.src, frame.width, frame.height)
          .then((c) => {
            textures[i] = tex(c);
            if (i === 0) setImage(piece.canvasMat, textures[i]!);
          })
          .catch(() => {});
      });
    } else if (img) {
      loadArt(img.src, img.width, img.height)
        .then((c) => setImage(piece.canvasMat, tex(c)))
        .catch(() => {});
    } else {
      setImage(
        piece.canvasMat,
        tex(placeholderArt(room.movement.pattern, room.movement.palette, seedFrom(art.id))),
      );
    }

    // The label to the right of the frame.
    const label = new THREE.Mesh(
      plane(0.24, 0.15),
      std({ map: tex(wallLabel(art, fonts)), roughness: 0.9 }),
    );
    label.position.set(cx + piece.outerW / 2 + 0.3, 1.32, ROW.roomTop + 0.006);
    scene.add(label);
  }

  // Empty frames in the Community Gallery wait for visitors' work.
  const waiting = tex(waitingCard(wall.ink, wall.wall, fonts));
  for (const room of plan.rooms) {
    for (const sx of room.emptySlots) {
      const piece = hang(`empty:${room.slug}:${sx}`, sx + 1.5, 4 / 3, "black", {
        kind: "room",
        room,
      });
      setImage(piece.canvasMat, waiting);
      piece.canvasMat.emissiveIntensity = 0.1;
    }
  }

  // ── Room lettering, info stands ────────────────────────────────────────
  const lettering = (
    lines: Parameters<typeof wallLettering>[0],
    maxW: number,
    place: (m: THREE.Mesh, w: number, h: number) => void,
  ) => {
    const { canvas: c, aspect } = wallLettering(lines, wall.ink, fonts);
    const w = maxW;
    const h = w / aspect;
    const m = new THREE.Mesh(
      plane(w, h),
      basic({ map: tex(c), transparent: true, depthWrite: false, toneMapped: false }),
    );
    place(m, w, h);
    scene.add(m);
  };

  const standMat = std({ color: 0x232323, roughness: 0.55, metalness: 0.2 });
  for (const room of plan.rooms) {
    // Outside, on the corridor wall right of the door.
    const segX = room.doorX + 2;
    const segLen = room.x + room.w - segX;
    if (segLen > 3) {
      lettering(
        [
          { text: room.movement.name, size: 120, weight: 800, font: "display" },
          { text: room.title, size: 48, weight: 500 },
          { text: room.movement.period, size: 40, weight: 400 },
        ],
        Math.min(segLen - 1.2, 5.2),
        (m, w) => {
          m.position.set(segX + 0.6 + w / 2, 2.35, ROW.roomWall + 1 + 0.004);
        },
      );
    }

    // A lectern just inside the door, read from its left.
    const c = standCenter(room);
    const stand = new THREE.Group();
    stand.position.set(c.x, 0, c.z);
    stand.rotation.y = -Math.PI / 2;
    const post = new THREE.Mesh(box(0.34, 0.92, 0.3), standMat);
    post.position.y = 0.46;
    const top = new THREE.Mesh(box(0.62, 0.035, 0.46), standMat);
    top.position.set(0, 1.0, 0.02);
    top.rotation.x = 0.5;
    const card = new THREE.Mesh(
      plane(0.58, 0.41),
      std({
        map: tex(standTop(room, fonts)),
        roughness: 0.6,
        emissive: 0xffffff,
        emissiveIntensity: 0.15,
      }),
    );
    card.position.set(0, 1.0 + 0.018 * Math.cos(0.5), 0.02 + 0.018 * Math.sin(0.5));
    card.rotation.x = -Math.PI / 2 + 0.5;
    (card.material as THREE.MeshStandardMaterial).emissiveMap = (
      card.material as THREE.MeshStandardMaterial
    ).map;
    stand.add(post, top, card);
    const hit = new THREE.Mesh(box(0.8, 1.3, 0.8), hidden);
    hit.position.y = 0.65;
    hit.userData.focus = { kind: "room", room } satisfies Focus;
    stand.add(hit);
    pickables.push(hit);
    scene.add(stand);
    addShadow(c.x, c.z, 0.9, 0.9);
  }

  // The floor's name on the lift lobby's side wall.
  const bayWall = plan.rooms[0]?.x ?? plan.lounge.x;
  lettering(
    [
      { text: `Floor ${plan.floor.level}`, size: 44, weight: 600 },
      { text: plan.floor.name, size: 120, weight: 800, font: "display" },
      { text: plan.floor.tagline, size: 38, weight: 400 },
    ],
    4.6,
    (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(bayWall - 1 - 0.004, 2.3, ROW.roomTop + 3.4);
    },
  );

  // ── The lift ───────────────────────────────────────────────────────────
  const steel = std({ color: 0xb9bec4, metalness: 0.9, roughness: 0.28 });
  // Oak-panelled inside, warm under its own light: where every visit begins.
  // No wall on the door side (box face +z), so the open doors show the floor outside.
  const cabWood = std({ map: woodTex, color: 0xc9a77c, roughness: 0.45, side: THREE.BackSide });
  const cab = new THREE.Mesh(box(opening.x1 - opening.x0, opening.h, 1.4), [
    cabWood,
    cabWood,
    cabWood,
    cabWood,
    hidden,
    cabWood,
  ]);
  cab.position.set(lift.x, opening.h / 2, ROW.roomTop - 0.7);
  scene.add(cab);
  const cabLight = new THREE.Mesh(plane(1.1, 0.8), glow);
  cabLight.rotation.x = Math.PI / 2;
  cabLight.position.set(lift.x, opening.h - 0.01, ROW.roomTop - 0.7);
  scene.add(cabLight);
  for (const [x, y, w, h] of [
    [opening.x0 - 0.04, opening.h / 2, 0.08, opening.h],
    [opening.x1 + 0.04, opening.h / 2, 0.08, opening.h],
    [lift.x, opening.h + 0.04, opening.x1 - opening.x0 + 0.16, 0.08],
  ]) {
    const m = new THREE.Mesh(box(w, h, 0.05), steel);
    m.position.set(x, y, ROW.roomTop + 0.02);
    scene.add(m);
  }
  const doorGeo = box((opening.x1 - opening.x0) / 2, opening.h, 0.04);
  const leftDoor = new THREE.Mesh(doorGeo, steel);
  const rightDoor = new THREE.Mesh(doorGeo, steel);
  leftDoor.position.set(lift.x - 0.4, opening.h / 2, ROW.roomTop - 0.03);
  rightDoor.position.set(lift.x + 0.4, opening.h / 2, ROW.roomTop - 0.03);
  // The seam where the doors meet, and a brass handrail at the back of the car.
  const seam = new THREE.Mesh(box(0.012, opening.h, 0.05), railMat);
  seam.position.set(0.4, 0, 0);
  leftDoor.add(seam);
  const handrail = new THREE.Mesh(box(opening.x1 - opening.x0 - 0.2, 0.04, 0.04), giltMat);
  handrail.position.set(lift.x, 0.95, ROW.roomTop - 1.36);
  scene.add(leftDoor, rightDoor, handrail);
  const indicator = new THREE.Mesh(
    plane(0.5, 0.19),
    basic({ map: tex(floorIndicator(plan.floor.level, fonts)), toneMapped: false }),
  );
  indicator.position.set(lift.x, opening.h + 0.35, ROW.roomTop + 0.006);
  const button = new THREE.Mesh(box(0.12, 0.24, 0.02), steel);
  button.position.set(opening.x1 + 0.35, 1.15, ROW.roomTop + 0.01);
  const buttonLight = new THREE.Mesh(
    keep(new THREE.CircleGeometry(0.025, 16)),
    basic({ color: 0xffb347, toneMapped: false }),
  );
  buttonLight.position.set(opening.x1 + 0.35, 1.18, ROW.roomTop + 0.022);
  scene.add(indicator, button, buttonLight);
  const liftHit = new THREE.Mesh(box(2.2, 2.9, 0.3), hidden);
  liftHit.position.set(lift.x, 1.45, ROW.roomTop);
  liftHit.userData.focus = { kind: "elevator" } satisfies Focus;
  scene.add(liftHit);
  pickables.push(liftHit);
  let doorsOpen = 0;

  // ── Lounge: windows and sofas ──────────────────────────────────────────
  {
    const x0 = plan.lounge.x + 1;
    const w = plan.lounge.w - 2;
    const view = new THREE.Mesh(
      plane(w, 3.1),
      basic({ map: tex(windowView(w)), toneMapped: false }),
    );
    view.position.set(x0 + w / 2, 0.55 + 1.55, ROW.roomTop + 0.008);
    scene.add(view);
    const mullion = std({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 });
    const panes = Math.max(2, Math.round(w / 1.6));
    for (let i = 0; i <= panes; i++) {
      const m = new THREE.Mesh(box(0.06, 3.14, 0.06), mullion);
      m.position.set(x0 + (i * w) / panes, 2.1, ROW.roomTop + 0.03);
      scene.add(m);
    }
    for (const y of [0.55, 3.65]) {
      const m = new THREE.Mesh(box(w + 0.06, 0.07, 0.1), mullion);
      m.position.set(x0 + w / 2, y, ROW.roomTop + 0.05);
      scene.add(m);
    }
  }

  // ── Benches, sofas and plants ──────────────────────────────────────────
  const oak = std({ map: woodTex, color: 0xd9c2a0, roughness: 0.5 });
  const legMat = std({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 });
  const leather = std({ color: dark ? 0x5b3d2c : 0x4a4038, roughness: 0.7 });
  for (let y = 0; y < plan.rows; y++) {
    for (let x = 0; x < plan.cols; x++) {
      if (tileAt(plan, x, y) !== Tile.Bench || tileAt(plan, x - 1, y) === Tile.Bench) continue;
      let len = 1;
      while (tileAt(plan, x + len, y) === Tile.Bench) len++;
      const cx = x + len / 2;
      const cz = y + 0.5;
      if (x >= plan.lounge.x) {
        // Sofa, facing the windows.
        const seat = new THREE.Mesh(box(len - 0.1, 0.42, 0.82), leather);
        seat.position.set(cx, 0.21, cz);
        const back = new THREE.Mesh(box(len - 0.1, 0.42, 0.18), leather);
        back.position.set(cx, 0.6, cz + 0.32);
        scene.add(seat, back);
        for (const s of [-1, 1]) {
          const arm = new THREE.Mesh(box(0.16, 0.6, 0.82), leather);
          arm.position.set(cx + s * (len / 2 - 0.13), 0.3, cz);
          scene.add(arm);
        }
        addShadow(cx, cz, len + 0.5, 1.4);
      } else {
        const seat = new THREE.Mesh(box(len - 0.2, 0.06, 0.48), oak);
        seat.position.set(cx, 0.45, cz);
        scene.add(seat);
        for (const s of [-1, 1]) {
          const leg = new THREE.Mesh(box(0.05, 0.42, 0.42), legMat);
          leg.position.set(cx + s * (len / 2 - 0.3), 0.21, cz);
          scene.add(leg);
        }
        addShadow(cx, cz, len + 0.3, 1);
      }
    }
  }

  const pot = std({ color: 0xe8e2d8, roughness: 0.8 });
  const potGeo = keep(new THREE.CylinderGeometry(0.22, 0.17, 0.46, 20));
  const leafGeo = keep(new THREE.IcosahedronGeometry(1, 0));
  const leaves = [0x2f5a32, 0x3f7240, 0x264a2a, 0x4d8248].map((c) =>
    std({ color: c, roughness: 0.75, flatShading: true }),
  );
  for (let y = 0; y < plan.rows; y++) {
    for (let x = 0; x < plan.cols; x++) {
      if (tileAt(plan, x, y) !== Tile.Plant) continue;
      const rand = seededRandom(x * 31 + y * 7);
      const m = new THREE.Mesh(potGeo, pot);
      m.position.set(x + 0.5, 0.23, y + 0.5);
      scene.add(m);
      for (let i = 0; i < 8; i++) {
        const leaf = new THREE.Mesh(leafGeo, leaves[i % leaves.length]);
        const s = 0.16 + rand() * 0.16;
        leaf.scale.set(s, s * 1.3, s);
        leaf.position.set(
          x + 0.5 + (rand() - 0.5) * 0.4,
          0.62 + rand() * 0.9,
          y + 0.5 + (rand() - 0.5) * 0.4,
        );
        leaf.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        scene.add(leaf);
      }
      addShadow(x + 0.5, y + 0.5, 0.9, 0.9);
    }
  }

  // ── The visitor, seen when the camera pulls back ──────────────────────
  const avatar = new THREE.Group();
  const coat = std({ color: 0xff2e63, roughness: 0.7 });
  const trousers = std({ color: 0x24252b, roughness: 0.8 });
  const skin = std({ color: 0xe0b48f, roughness: 0.65 });
  const hair = std({ color: 0x2b211b, roughness: 0.9 });
  const limb = (r: number, len: number, mat: THREE.Material, x: number, top: number) => {
    // Pivot at the top, so legs and arms swing from the hip and shoulder.
    const pivot = new THREE.Group();
    pivot.position.set(x, top, 0);
    const m = new THREE.Mesh(keep(new THREE.CapsuleGeometry(r, len, 4, 12)), mat);
    m.position.y = -len / 2 - r / 2;
    pivot.add(m);
    return pivot;
  };
  const body = new THREE.Group();
  const torso = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.19, 0.42, 6, 16)), coat);
  torso.position.y = 1.08;
  torso.scale.z = 0.72;
  const headMesh = new THREE.Mesh(keep(new THREE.SphereGeometry(0.13, 24, 16)), skin);
  headMesh.position.y = 1.56;
  const hairMesh = new THREE.Mesh(
    keep(new THREE.SphereGeometry(0.137, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    hair,
  );
  hairMesh.position.set(0, 1.575, 0.012);
  hairMesh.rotation.x = 0.35;
  const limbs = {
    body,
    legL: limb(0.075, 0.62, trousers, -0.095, 0.86),
    legR: limb(0.075, 0.62, trousers, 0.095, 0.86),
    armL: limb(0.055, 0.46, coat, -0.225, 1.36),
    armR: limb(0.055, 0.46, coat, 0.225, 1.36),
  };
  body.add(torso, headMesh, hairMesh, limbs.armL, limbs.armR);
  avatar.add(body, limbs.legL, limbs.legR);
  const avatarShadow = new THREE.Mesh(plane(0.8, 0.8), shadowMat);
  avatarShadow.rotation.x = -Math.PI / 2;
  avatarShadow.position.y = 0.006;
  avatar.add(avatarShadow);
  avatar.visible = false;
  scene.add(avatar);

  // ── Dust in the light ──────────────────────────────────────────────────
  const dustSeeds: {
    x: number;
    y: number;
    z: number;
    speed: number;
    phase: number;
    rise: number;
  }[] = [];
  {
    const rand = seededRandom(91);
    for (const room of plan.rooms) {
      for (let i = 0; i < 70; i++) {
        dustSeeds.push({
          x: room.x + 1 + rand() * (room.w - 2),
          y: rand() * CEILING,
          z: ROW.roomTop + 0.6 + rand() * (ROW.roomBottom - ROW.roomTop),
          speed: 0.05 + rand() * 0.12,
          phase: rand() * 7,
          rise: 0.006 + rand() * 0.014,
        });
      }
    }
  }
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(dustSeeds.length * 3), 3),
  );
  const motes = new THREE.Points(
    dustGeo,
    keep(
      new THREE.PointsMaterial({
        map: poolTex,
        color: 0xfff1d6,
        size: 0.035,
        transparent: true,
        opacity: dark ? 0.55 : 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  motes.frustumCulled = false;
  scene.add(motes);

  // ── Walk-to marker ─────────────────────────────────────────────────────
  const marker = new THREE.Mesh(
    keep(new THREE.RingGeometry(0.16, 0.22, 40)),
    basic({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  const raycaster = new THREE.Raycaster();
  let baseFov = 66;
  const ndc = new THREE.Vector2();

  return {
    resize(width, height, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      // A taller frame on phones needs a wider vertical view to feel the same.
      baseFov = camera.aspect < 1 ? 78 : 66;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    },

    render(s) {
      // Through the visitor's eyes, or pulled back behind them, never through a wall.
      const f = forward(s.yaw);
      const back = {
        x: -f.x * Math.cos(s.pitch),
        y: -Math.sin(s.pitch),
        z: -f.z * Math.cos(s.pitch),
      };
      const head = { x: s.pos.x, y: s.zoom > 0 ? AVATAR_HEAD : s.eye, z: s.pos.z };
      // Back out step by step, stopping at the first wall, so the camera never hops one.
      const cameraAt = (dist: number) => ({ x: head.x + back.x * dist, z: head.z + back.z * dist });
      let d = 0;
      while (
        d + 0.05 <= s.zoom &&
        !collides(plan, cameraAt(d + 0.05), 0.15) &&
        head.y + back.y * (d + 0.05) < CEILING - 0.15
      ) {
        d += 0.05;
      }
      camera.position.set(
        head.x + back.x * d,
        Math.max(0.3, head.y + back.y * d),
        head.z + back.z * d,
      );
      camera.rotation.set(s.pitch, s.yaw, 0);

      avatar.visible = d > 0.45;
      if (avatar.visible) {
        avatar.position.set(s.pos.x, 0, s.pos.z);
        avatar.rotation.y = s.yaw;
        const swing = Math.sin(s.stride * 4.2) * 0.55 * s.pace;
        limbs.legL.rotation.x = swing;
        limbs.legR.rotation.x = -swing;
        limbs.armL.rotation.x = -swing * 0.8;
        limbs.armR.rotation.x = swing * 0.8;
        limbs.body.position.y = Math.abs(Math.cos(s.stride * 4.2)) * 0.03 * s.pace;
      }

      // Lift doors slide open as you come near.
      const near = Math.hypot(s.pos.x - lift.x, s.pos.z - lift.z) < 2.4 ? 1 : 0;
      doorsOpen += ((s.lift ?? near) - doorsOpen) * 0.06;

      const fov = baseFov + s.rush * 5;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov += (fov - camera.fov) * 0.1;
        camera.updateProjectionMatrix();
      }

      // Dust turning slowly in the skylights' light.
      const dust = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dustSeeds.length; i++) {
        const d = dustSeeds[i];
        const t = s.time * d.speed + d.phase;
        dust.setXYZ(
          i,
          d.x + Math.sin(t) * 0.35,
          0.4 + ((d.y + s.time * d.rise) % (CEILING - 0.8)),
          d.z + Math.cos(t * 0.8) * 0.35,
        );
      }
      dust.needsUpdate = true;
      const slide = doorsOpen * 0.78;
      leftDoor.position.x = lift.x - 0.4 - slide;
      rightDoor.position.x = lift.x + 0.4 + slide;

      for (const h of hung) {
        const lit = h.id === s.focusId ? 1 : h.id === s.hoverId ? 0.6 : 0;
        h.pool.opacity += ((dark ? 0.26 : 0.16) + lit * 0.22 - h.pool.opacity) * 0.15;
        h.canvas.emissiveIntensity += (0.16 + lit * 0.14 - h.canvas.emissiveIntensity) * 0.15;
        if (h.views && h.art) {
          const v = lenticularView(h.art, h.views.textures.length, s.pos.x);
          const i0 = Math.floor(v);
          const i1 = Math.min(h.views.textures.length - 1, i0 + 1);
          const t0 = h.views.textures[i0];
          const t1 = h.views.textures[i1];
          if (t0 && h.canvas.map !== t0) setImage(h.canvas, t0);
          const over = h.views.over;
          if (t1 && over.map !== t1) {
            over.map = t1;
            over.emissiveMap = t1;
            over.needsUpdate = true;
          }
          // Hold each view, then turn over quickly, like the folds of the real thing.
          const f = v - i0;
          over.opacity = t1 ? Math.min(1, Math.max(0, (f - 0.3) / 0.4)) : 0;
          over.emissiveIntensity = h.canvas.emissiveIntensity;
        }
      }

      if (s.marker) {
        marker.visible = true;
        marker.position.set(s.marker.x, 0.012, s.marker.z);
        const pulse = 1 + Math.sin(s.time * 6) * 0.08;
        marker.scale.set(pulse, pulse, pulse);
      } else marker.visible = false;

      renderer.render(scene, camera);
    },

    pick(x, y) {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      if (!hit) return null;
      const focus = hit.object.userData.focus as Focus | undefined;
      if (focus) return { focus };
      if (hit.object.userData.floor) return { floor: { x: hit.point.x, z: hit.point.z } };
      return null;
    },

    dispose() {
      for (const t of trash) t.dispose();
      renderer.dispose();
    },
  };
}
