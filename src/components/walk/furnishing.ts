import * as THREE from "three";
import { floorWall } from "@/components/gallery/walls";
import { seedFrom, seededRandom } from "@/lib/museum/placeholder";
import { type Building, type Item, type Level, type PlanArtwork, type Vec, spaceAt } from "@/lib/walk/building";
import { DESK, type Focus, forward, lenticularView } from "@/lib/walk/motion";
import { roomSign } from "@/lib/walk/trim";
import { Batch, type Kit, Quads, boxGeometry } from "./kit";
import {
  type Fonts,
  canvas,
  loadArt,
  luma,
  mix,
  placeholderArt,
  standTop,
  waitingCard,
  wallLabel,
  wallLettering,
} from "./textures";

/**
 * What fills the building: the paintings under their lights, labels,
 * lecterns, benches and sofas, the desk, café and store, signs and
 * lettering, kiosks to the Studio and the lab, and sunlight on the floors.
 */

/** Centre of a painting above the floor. */
const HANG = 1.62;

const FRAMES = {
  gilt: { maxW: 1.9, maxH: 1.55, profile: 0.1, depth: 0.075, mat: 0 },
  black: { maxW: 2, maxH: 1.6, profile: 0.045, depth: 0.05, mat: 0 },
  mat: { maxW: 1.4, maxH: 1.1, profile: 0.035, depth: 0.04, mat: 0.16 },
} as const;

type Hung = {
  id: string;
  art?: PlanArtwork;
  level: number;
  dark: boolean;
  pool: THREE.MeshBasicMaterial;
  canvas: THREE.MeshStandardMaterial;
  /** The painted face, for finding it on screen. */
  face: THREE.Mesh;
  /** Swapped for the sharper copy once you stand in front of it. */
  sharp?: "loading" | "done";
  views?: { textures: (THREE.Texture | null)[]; over: THREE.MeshStandardMaterial };
  load?: () => void;
};

export type Furnishing = {
  /** Loads the pictures for a floor (once); call for the floors near the visitor. */
  loadLevel(level: number): void;
  /** A painting's face, to find where it is on screen. */
  face(id: string): THREE.Mesh | undefined;
  update(s: { pos: Vec; focusId: string | null; hoverId: string | null }): void;
};

const yawFacing = (n: { x: number; z: number }) => Math.atan2(n.x, n.z);

export function buildFurnishing(k: Kit, b: Building, fonts: Fonts): Furnishing {
  const hung: Hung[] = [];
  const loaded = new Set<number>();
  const maxPx = k.low ? 640 : 1024;

  const setImage = (m: THREE.MeshStandardMaterial, t: THREE.Texture) => {
    m.map = t;
    m.emissiveMap = t;
    m.color.set(0xffffff);
    m.needsUpdate = true;
  };

  for (const level of b.levels) {
    const group = k.levels[level.index];
    // Paintings, lecterns and kiosks: only drawn on the floors next to the visitor's.
    const shelf = new THREE.Group();
    shelf.userData.art = true;
    group.add(shelf);
    const batch = new Batch(k.mat, k.keep);
    const wall = floorWall(level.slug);
    const dark = luma(wall.wall) < 110;

    // ── Paintings ──
    const hang = (
      id: string,
      at: { x: number; z: number; nx: number; nz: number },
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
      const g = new THREE.Group();
      g.position.set(at.x, level.y + HANG, at.z);
      g.rotation.y = yawFacing({ x: at.nx, z: at.nz });
      shelf.add(g);
      const ow = w + 2 * f.mat;
      const oh = h + 2 * f.mat;
      const p = f.profile;
      const frameKey = kind === "gilt" ? "gilt" : kind === "black" ? "frame-black" : "frame-thin";
      const frame = new Batch(k.mat, k.keep);
      for (const [bx, by, bw, bh] of [
        [0, oh / 2 + p / 2, ow + 2 * p, p],
        [0, -oh / 2 - p / 2, ow + 2 * p, p],
        [-ow / 2 - p / 2, 0, p, oh],
        [ow / 2 + p / 2, 0, p, oh],
      ]) {
        frame.box(frameKey, bx, by - bh / 2, f.depth / 2, bw, bh, f.depth);
      }
      if (f.mat) frame.box("mat-board", 0, -oh / 2, 0.006, ow, oh, 0.012);
      frame.flush(g);
      const canvasMat = k.keep(
        new THREE.MeshStandardMaterial({
          color: dark ? mix(wall.wall, "#ffffff", 0.1) : mix(wall.wall, "#000000", 0.1),
          roughness: 0.82,
          emissive: 0xffffff,
          emissiveIntensity: 0,
        }),
      );
      const face = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(w, h)), canvasMat);
      face.position.z = 0.016;
      g.add(face);
      // A pool of light on the wall, from the spot on the track.
      const pool = k.keep(
        new THREE.MeshBasicMaterial({
          map: (k.mat("pool") as THREE.MeshBasicMaterial).map,
          color: 0xfff0d8,
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const poolMesh = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(ow + 1.7, oh + 2)), pool);
      poolMesh.position.set(0, 0.25, 0.004);
      g.add(poolMesh);
      // The spot itself, on the ceiling track, aimed at the work.
      const can = new THREE.Mesh(k.keep(new THREE.CylinderGeometry(0.06, 0.075, 0.2, 14)), k.mat("black"));
      can.position.set(at.x + at.nx * 1.4, level.y + level.ceiling - 0.17, at.z + at.nz * 1.4);
      can.lookAt(at.x, level.y + HANG, at.z);
      can.rotateX(Math.PI / 2);
      shelf.add(can);
      const hit = new THREE.Mesh(k.keep(new THREE.BoxGeometry(ow + 2 * p + 0.1, oh + 2 * p + 0.1, 0.25)), k.mat("hidden"));
      hit.userData.focus = focus;
      g.add(hit);
      k.pickables.push(hit);
      return { g, face, canvasMat, pool, w, h, outerW: ow + 2 * p };
    };

    for (const art of b.artworks.filter((a) => a.level === level.index)) {
      const room = b.rooms[art.room];
      const img = art.image;
      const piece = hang(art.id, art, img ? img.width / img.height : 4 / 3, art.frame, { kind: "art", art });
      const entry: Hung = { id: art.id, art, level: level.index, dark, pool: piece.pool, canvas: piece.canvasMat, face: piece.face };
      hung.push(entry);
      if (art.frames) {
        // Two layers: the nearest view, and the next fading in as you walk past.
        const over = k.keep(
          new THREE.MeshStandardMaterial({ roughness: 0.82, emissive: 0xffffff, emissiveIntensity: 0, transparent: true, opacity: 0 }),
        );
        const overMesh = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(piece.w, piece.h)), over);
        overMesh.position.z = 0.017;
        piece.g.add(overMesh);
        const textures: (THREE.Texture | null)[] = art.frames.map(() => null);
        entry.views = { textures, over };
        entry.load = () =>
          art.frames!.forEach((frame, i) => {
            loadArt(frame.src, frame.width, frame.height, maxPx)
              .then((c) => {
                textures[i] = k.tex(c);
                if (i === 0) setImage(piece.canvasMat, textures[i]!);
              })
              .catch(() => {});
          });
      } else if (img) {
        entry.load = () =>
          loadArt(img.src, img.width, img.height, maxPx)
            .then((c) => {
              if (entry.sharp !== "done") setImage(piece.canvasMat, k.tex(c));
            })
            .catch(() => {});
      } else {
        setImage(piece.canvasMat, k.tex(placeholderArt(room.movement.pattern, room.movement.palette, seedFrom(art.id))));
      }
      // The label, to the right of the frame as you face it.
      const right = { x: art.nz, z: -art.nx };
      const label = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(0.24, 0.15)), k.mat("label-blank"));
      label.position.set(
        art.x + right.x * (piece.outerW / 2 + 0.3) + art.nx * 0.006,
        level.y + 1.34,
        art.z + right.z * (piece.outerW / 2 + 0.3) + art.nz * 0.006,
      );
      label.rotation.y = yawFacing({ x: art.nx, z: art.nz });
      shelf.add(label);
      const prevLoad = entry.load;
      entry.load = () => {
        prevLoad?.();
        label.material = k.keep(new THREE.MeshStandardMaterial({ map: k.tex(wallLabel(art, fonts)), roughness: 0.9 }));
      };
    }

    // Empty frames in the Community Gallery wait for visitors' work.
    for (const room of b.rooms.filter((r) => r.level === level.index)) {
      const card = k.tex(waitingCard(wall.ink, wall.wall, fonts));
      for (const spot of room.emptySlots) {
        const piece = hang(`empty:${room.slug}:${spot.x}:${spot.z}`, spot, 4 / 3, "black", { kind: "room", room });
        setImage(piece.canvasMat, card);
        piece.canvasMat.emissiveIntensity = 0.1;
      }
    }

    // ── Lettering ──
    const lettering = (
      lines: Parameters<typeof wallLettering>[0],
      ink: string,
      width: number,
      at: { x: number; y: number; z: number },
      yaw: number,
      maxH = Infinity,
    ) => {
      const { canvas: c, aspect } = wallLettering(lines, ink, fonts);
      let w = width;
      let h = w / aspect;
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      const m = new THREE.Mesh(
        k.keep(new THREE.PlaneGeometry(w, h)),
        k.keep(new THREE.MeshBasicMaterial({ map: k.tex(c), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.94 })),
      );
      m.position.set(at.x, at.y, at.z);
      m.rotation.y = yaw;
      group.add(m);
      return m;
    };

    // The floor's name on the core wall, big, facing the atrium.
    const L = level.lettering;
    if (level.index === 0) {
      lettering(
        [
          { text: b.name, size: 200, weight: 900, font: "display" },
          { text: "A museum of modern art, made of modern art", size: 54, weight: 500 },
        ],
        "#1b1b1b",
        L.w,
        { x: L.x, y: 3.4, z: L.z + 0.01 },
        0,
      );
    } else {
      lettering(
        [
          { text: `Floor ${level.number}`, size: 64, weight: 600 },
          { text: level.name, size: 170, weight: 800, font: "display" },
          { text: level.tagline, size: 52, weight: 400 },
        ],
        "#1b1b1b",
        L.w,
        { x: L.x, y: level.y + 2.7, z: L.z + 0.01 },
        0,
        2.6,
      );
    }

    // Each room's name over its doorway, read from outside.
    const sign = roomSign(level);
    for (const room of b.rooms.filter((r) => r.level === level.index)) {
      const out = { x: -room.inward.x, z: -room.inward.z };
      // The door's point is on the room's side of its wall; the name goes on the far side.
      const wall = level.walls.find((w) =>
        w.z0 === w.z1
          ? Math.abs(w.z0 - room.door.z) < 0.5 && room.door.x > w.x0 && room.door.x < w.x1
          : Math.abs(w.x0 - room.door.x) < 0.5 && room.door.z > w.z0 && room.door.z < w.z1,
      );
      const faceOffset = (wall?.thick ?? 0.3) + 0.005;
      lettering(
        [
          { text: room.movement.name, size: 110, weight: 800, font: "display" },
          { text: room.title, size: 50, weight: 500 },
        ],
        "#1b1b1b",
        sign.w,
        {
          x: room.door.x + room.inward.x * -faceOffset + out.x * 0.01,
          y: level.y + sign.y,
          z: room.door.z + room.inward.z * -faceOffset + out.z * 0.01,
        },
        yawFacing(out),
        sign.h,
      );
    }
    // The public rooms off the lobby, named over their openings.
    for (const space of level.spaces) {
      const sign: Record<string, { at: Vec; yaw: number } | undefined> = {
        cafe: { at: { x: 33.83, z: 19 }, yaw: -Math.PI / 2 },
        shop: { at: { x: 33.83, z: 34 }, yaw: -Math.PI / 2 },
        studio: { at: { x: 6, z: 27.84 }, yaw: Math.PI },
        reading: undefined,
        lounge: undefined,
      };
      const s = level.index === 0 ? sign[space.kind] : undefined;
      if (!s) continue;
      lettering([{ text: space.name, size: 120, weight: 800, font: "display" }], "#1b1b1b", 3.2, { x: s.at.x, y: 4.4, z: s.at.z }, s.yaw, 0.7);
    }

    // ── Furniture and fixtures ──
    for (const it of level.items) furnish(k, b, level, it, batch, group, fonts);

    // ── Lecterns: what each room is about ──
    for (const room of b.rooms.filter((r) => r.level === level.index)) {
      const stand = new THREE.Group();
      stand.position.set(room.stand.x, level.y, room.stand.z);
      // Its top tilts toward a reader facing along `standYaw`.
      stand.rotation.y = room.standYaw + Math.PI;
      const parts = new Batch(k.mat, k.keep);
      parts.box("black", 0, 0, 0, 0.34, 0.92, 0.3);
      parts.flush(stand);
      const top = new THREE.Mesh(k.keep(new THREE.BoxGeometry(0.62, 0.035, 0.46)), k.mat("black"));
      top.position.set(0, 1.0, 0.02);
      top.rotation.x = 0.5;
      const cardTex = k.tex(standTop(room, fonts));
      const card = new THREE.Mesh(
        k.keep(new THREE.PlaneGeometry(0.58, 0.41)),
        k.keep(new THREE.MeshStandardMaterial({ map: cardTex, emissiveMap: cardTex, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.6 })),
      );
      card.position.set(0, 1.0 + 0.018 * Math.cos(0.5), 0.02 + 0.018 * Math.sin(0.5));
      card.rotation.x = -Math.PI / 2 + 0.5;
      const hit = new THREE.Mesh(k.keep(new THREE.BoxGeometry(0.8, 1.3, 0.8)), k.mat("hidden"));
      hit.position.y = 0.65;
      hit.userData.focus = { kind: "room", room } satisfies Focus;
      stand.add(top, card, hit);
      k.pickables.push(hit);
      shelf.add(stand);
    }

    // ── Kiosks to the Studio, the lab, the guides ──
    for (const portal of b.portals.filter((p) => p.level === level.index)) {
      const [c, ctx] = canvas(512, 360);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, 512, 360);
      ctx.fillStyle = portal.kind === "studio" ? "#ff2e63" : portal.kind === "lab" ? "#7cf0ff" : "#f6c500";
      ctx.fillRect(0, 0, 512, 16);
      ctx.fillStyle = "#f4f0e8";
      ctx.textBaseline = "top";
      ctx.font = `800 54px ${fonts.display}`;
      ctx.fillText(portal.title, 28, 52);
      ctx.font = `400 26px ${fonts.sans}`;
      ctx.fillStyle = "#cfcac0";
      wrapLines(ctx, portal.blurb, 456).slice(0, 4).forEach((line, i) => ctx.fillText(line, 28, 140 + i * 34));
      ctx.fillStyle = "#ff2e63";
      ctx.font = `600 24px ${fonts.sans}`;
      ctx.fillText("Press E or tap to go in", 28, 314);
      const screen = k.tex(c);
      const kiosk = new THREE.Group();
      kiosk.position.set(portal.at.x, level.y, portal.at.z);
      kiosk.rotation.y = portal.yaw + Math.PI;
      const body = new Batch(k.mat, k.keep);
      body.box("black", 0, 0, 0, 0.5, 1.05, 0.4);
      body.flush(kiosk);
      const face = new THREE.Mesh(
        k.keep(new THREE.PlaneGeometry(0.72, 0.5)),
        k.keep(new THREE.MeshBasicMaterial({ map: screen, toneMapped: false })),
      );
      face.position.set(0, 1.22, 0.1);
      face.rotation.x = -0.45;
      const hit = new THREE.Mesh(k.keep(new THREE.BoxGeometry(0.9, 1.6, 0.9)), k.mat("hidden"));
      hit.position.y = 0.8;
      hit.userData.focus = { kind: "portal", portal } satisfies Focus;
      kiosk.add(face, hit);
      k.pickables.push(hit);
      shelf.add(kiosk);
    }

    // ── Sunlight through the glass ──
    sunPatches(k, level, batch);
    batch.flush(group);
  }

  // The information desk: what it's for, lettered on its front.
  {
    const level = b.levels[0];
    const sign = wallLettering([{ text: "Information", size: 90, weight: 700 }], "#f4f0e8", fonts);
    const m = new THREE.Mesh(
      k.keep(new THREE.PlaneGeometry(1.6, 1.6 / sign.aspect)),
      k.keep(new THREE.MeshBasicMaterial({ map: k.tex(sign.canvas), transparent: true, toneMapped: false })),
    );
    m.position.set(DESK.x, 0.62, DESK.z + 0.51);
    k.levels[0].add(m);
    const hit = new THREE.Mesh(k.keep(new THREE.BoxGeometry(5.2, 1.6, 1.4)), k.mat("hidden"));
    hit.position.set(DESK.x, 0.8, DESK.z);
    hit.userData.focus = { kind: "desk" } satisfies Focus;
    k.levels[0].add(hit);
    k.pickables.push(hit);
    void level;
  }

  // A canopy over the front doors, with the museum's name along its edge.
  {
    const { x0, x1, z } = b.entrance.doors;
    const mid = (x0 + x1) / 2;
    const canopy = new Batch(k.mat, k.keep);
    canopy.box("slab", mid, 4.1, z + 1.6, 9, 0.45, 3.2);
    canopy.box("black", mid, 4.08, z + 3.18, 9, 0.02, 0.04);
    const down = new THREE.CircleGeometry(0.08, 16);
    down.rotateX(Math.PI / 2);
    for (let i = -3; i <= 3; i++) canopy.add("lamp", down, mid + i * 1.2, 4.095, z + 1.8);
    down.dispose();
    canopy.flush(k.shared);
    // Sized to the name, so it sits centred on the canopy.
    const sign = wallLettering([{ text: b.name, size: 200, weight: 900, font: "display" }], "#161616", fonts, 0);
    const h = 0.34;
    const m = new THREE.Mesh(
      k.keep(new THREE.PlaneGeometry(h * sign.aspect, h)),
      k.keep(new THREE.MeshBasicMaterial({ map: k.tex(sign.canvas), transparent: true })),
    );
    m.position.set(mid, 4.33, z + 3.21);
    k.shared.add(m);
  }

  return {
    loadLevel(level) {
      if (loaded.has(level)) return;
      loaded.add(level);
      for (const h of hung) if (h.level === level) h.load?.();
    },
    face: (id) => hung.find((h) => h.id === id)?.face,
    update(s) {
      for (const h of hung) {
        // In front of a painting: load the large copy, so it holds up close.
        const zoom = h.art?.zoom;
        if (h.id === s.focusId && zoom && !h.sharp && !h.views && !k.low && loaded.has(h.level)) {
          h.sharp = "loading";
          loadArt(zoom.src, zoom.width, zoom.height, 2048)
            .then((c) => {
              h.sharp = "done";
              setImage(h.canvas, k.tex(c));
            })
            .catch(() => {});
        }
        const lit = h.id === s.focusId ? 1 : h.id === s.hoverId ? 0.6 : 0;
        h.pool.opacity += ((h.dark ? 0.26 : 0.16) + lit * 0.22 - h.pool.opacity) * 0.15;
        h.canvas.emissiveIntensity += (0.16 + lit * 0.14 - h.canvas.emissiveIntensity) * 0.15;
        if (h.views && h.art) {
          const v = lenticularView(h.art, h.views.textures.length, s.pos);
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
    },
  };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ── Furniture ────────────────────────────────────────────────────────────

const shared = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = shared.get(key);
  if (!g) shared.set(key, (g = make()));
  return g;
}

function furnish(k: Kit, b: Building, level: Level, it: Item, batch: Batch, group: THREE.Group, fonts: Fonts) {
  const y = level.y;
  const f = forward(it.rot);
  // Local axes: "ahead" is the way a user faces; "across" is to their right.
  const across = { x: -f.z, z: f.x };
  const at = (ahead: number, side: number) => ({ x: it.x + f.x * ahead + across.x * side, z: it.z + f.z * ahead + across.z * side });
  // Size along the user's facing and across it.
  const facingX = Math.abs(f.x) > 0.5;
  const deep = facingX ? it.w : it.d;
  const wide = facingX ? it.d : it.w;
  const boxAt = (key: string, ahead: number, side: number, y0: number, w: number, h: number, d: number) => {
    const p = at(ahead, side);
    batch.box(key, p.x, y + y0, p.z, facingX ? d : w, h, facingX ? w : d);
  };
  const rand = seededRandom(Math.round(it.x * 131 + it.z * 17 + (it.variant ?? 0)));
  const shadow = (w: number, d: number, strength = 1) => {
    const m = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(w, d)), k.mat(strength > 0.7 ? "shadow" : "shadow-soft"));
    m.rotation.x = -Math.PI / 2;
    m.position.set(it.x, y + 0.006, it.z);
    group.add(m);
  };

  switch (it.kind) {
    case "bench": {
      batch.box("oak", it.x, y + 0.42, it.z, it.w - 0.05, 0.06, it.d - 0.05);
      const long = it.w > it.d;
      for (const s of [-1, 1]) {
        const off = (long ? it.w : it.d) / 2 - 0.3;
        batch.box("black", it.x + (long ? s * off : 0), y, it.z + (long ? 0 : s * off), long ? 0.05 : it.w - 0.1, 0.42, long ? it.d - 0.1 : 0.05);
      }
      shadow(it.w + 0.4, it.d + 0.4);
      break;
    }
    case "sofa":
    case "armchair": {
      const fabric = level.index === 0 ? "leather" : "fabric";
      boxAt(fabric, 0.05, 0, 0.12, wide - 0.3, 0.32, deep - 0.25);
      boxAt(fabric, -deep / 2 + 0.12, 0, 0.12, wide, 0.68, 0.24);
      for (const s of [-1, 1]) boxAt(fabric, 0, s * (wide / 2 - 0.1), 0.12, 0.2, 0.46, deep);
      for (const s of [-1, 1]) for (const a of [-1, 1]) boxAt("black", a * (deep / 2 - 0.1), s * (wide / 2 - 0.1), 0, 0.05, 0.12, 0.05);
      shadow(wide + 0.5, deep + 0.5);
      break;
    }
    case "low-table": {
      batch.box("oak", it.x, y + 0.38, it.z, it.w, 0.05, it.d);
      batch.box("black", it.x, y, it.z, it.w - 0.3, 0.38, it.d - 0.3);
      shadow(it.w + 0.3, it.d + 0.3);
      break;
    }
    case "plant": {
      const big = it.variant === 1;
      batch.add("pot", geo("pot", () => new THREE.CylinderGeometry(0.24, 0.19, 0.5, 20)), it.x, y + 0.25, it.z, 0, big ? [1.3, 1.2, 1.3] : undefined);
      const leaf = geo("leaf", () => new THREE.IcosahedronGeometry(1, 0));
      const n = big ? 26 : 12;
      for (let i = 0; i < n; i++) {
        const s = (big ? 0.22 : 0.16) + rand() * 0.16;
        const h = big ? 0.8 + rand() * 1.9 : 0.62 + rand() * 0.9;
        const spread = big ? 0.25 + (h / 2.7) * 0.5 : 0.22;
        batch.add(`leaf-${i % 4}`, leaf, it.x + (rand() - 0.5) * spread * 2, y + h, it.z + (rand() - 0.5) * spread * 2, rand() * 6, [s, s * 1.25, s]);
      }
      if (big) batch.box("bark", it.x, y + 0.4, it.z, 0.05, 1.6, 0.05);
      shadow(1, 1);
      break;
    }
    case "tree": {
      batch.box("tree-grate", it.x, y + 0.002, it.z, 1.3, 0.02, 1.3);
      batch.add("bark", geo("trunk", () => new THREE.CylinderGeometry(0.1, 0.14, 3.2, 10)), it.x, y + 1.6, it.z);
      const leaf = geo("leaf", () => new THREE.IcosahedronGeometry(1, 0));
      for (let i = 0; i < 16; i++) {
        const a = rand() * Math.PI * 2;
        const r = rand() * 1.3;
        const s = 0.6 + rand() * 0.7;
        batch.add(`tree-leaf-${i % 3}`, leaf, it.x + Math.cos(a) * r, y + 3.4 + rand() * 2.4, it.z + Math.sin(a) * r, rand() * 6, [s, s * 0.85, s]);
      }
      shadow(3.4, 3.4, 0.5);
      break;
    }
    case "lamp": {
      batch.box("black", it.x, y, it.z, 0.12, 6, 0.12);
      batch.box("black", it.x, y + 5.9, it.z - 0.6, 0.12, 0.1, 1.3);
      batch.box("lamp", it.x, y + 5.82, it.z - 1.1, 0.35, 0.06, 0.2);
      break;
    }
    case "bollard": {
      batch.add("steel", geo("bollard", () => new THREE.CylinderGeometry(0.1, 0.11, 0.9, 12)), it.x, y + 0.45, it.z);
      break;
    }
    case "desk": {
      // A long white counter with an oak top and a low writing ledge.
      batch.box("corian", it.x, y, it.z, it.w, 1.08, it.d);
      batch.box("oak", it.x, y + 1.08, it.z, it.w + 0.1, 0.05, it.d + 0.12);
      batch.box("black", it.x - 1.2, y + 1.13, it.z - 0.1, 0.5, 0.32, 0.03);
      batch.box("black", it.x + 1.1, y + 1.13, it.z - 0.1, 0.5, 0.32, 0.03);
      shadow(it.w + 0.6, it.d + 0.6);
      break;
    }
    case "cafe-counter": {
      batch.box("oak-dark", it.x, y, it.z, it.w, 1.05, it.d);
      batch.box("corian", it.x, y + 1.05, it.z, it.w + 0.06, 0.05, it.d + 0.06);
      // A glass case of pastries, the espresso machine, cups.
      batch.box("glass", it.x - 2, y + 1.1, it.z + 0.15, 1.6, 0.45, 0.6);
      for (let i = 0; i < 9; i++) {
        batch.box(i % 3 === 0 ? "pastry-a" : "pastry-b", it.x - 2.6 + (i % 5) * 0.28, y + 1.12 + Math.floor(i / 5) * 0.2, it.z + 0.1, 0.16, 0.07, 0.16);
      }
      batch.box("steel", it.x + 1.5, y + 1.1, it.z - 0.15, 0.8, 0.5, 0.5);
      batch.box("black", it.x + 1.5, y + 1.6, it.z - 0.15, 0.82, 0.06, 0.52);
      // The menu over the counter.
      const sign = wallLettering(
        [
          { text: "Café", size: 120, weight: 800, font: "display" },
          { text: "Espresso · Pastries · Lunch", size: 44, weight: 500 },
        ],
        "#1b1b1b",
        fonts,
      );
      const m = new THREE.Mesh(
        k.keep(new THREE.PlaneGeometry(3, 3 / sign.aspect)),
        k.keep(new THREE.MeshBasicMaterial({ map: k.tex(sign.canvas), transparent: true, toneMapped: false })),
      );
      m.position.set(it.x, y + 2.9, 0.26);
      group.add(m);
      // Pendant lights along it.
      for (let i = -1; i <= 1; i++) pendant(batch, it.x + i * 2.6, y + level.ceiling, it.z + 0.2, level.ceiling - 2.4);
      break;
    }
    case "cafe-table": {
      batch.add("corian", geo("cafe-top", () => new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28)), it.x, y + 0.74, it.z);
      batch.box("black", it.x, y, it.z, 0.06, 0.74, 0.06);
      batch.box("black", it.x, y, it.z, 0.5, 0.02, 0.5);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + (it.variant ?? 0);
        const cx = it.x + Math.cos(a) * 0.72;
        const cz = it.z + Math.sin(a) * 0.72;
        batch.box("chair", cx, y + 0.44, cz, 0.42, 0.04, 0.42, -a);
        const back = { x: cx + Math.cos(a) * 0.2, z: cz + Math.sin(a) * 0.2 };
        batch.box("chair", back.x, y + 0.44, back.z, 0.04, 0.42, 0.4, -a);
        batch.box("black", cx, y, cz, 0.03, 0.44, 0.03);
      }
      if (rand() < 0.7) batch.add("cup", geo("cup", () => new THREE.CylinderGeometry(0.04, 0.035, 0.09, 12)), it.x + 0.1, y + 0.8, it.z - 0.05);
      pendant(batch, it.x, y + level.ceiling, it.z, level.ceiling - 2.2);
      shadow(2, 2);
      break;
    }
    case "book-table": {
      batch.box("oak", it.x, y + 0.82, it.z, it.w, 0.05, it.d);
      batch.box("black", it.x, y, it.z, it.w - 0.2, 0.82, it.d - 0.2);
      for (let i = 0; i < 10; i++) {
        const bx = it.x - it.w / 2 + 0.25 + (i % 5) * ((it.w - 0.4) / 4);
        const bz = it.z + (i < 5 ? -0.27 : 0.27);
        const stack = 0.04 + rand() * 0.14;
        batch.box(`book-${Math.floor(rand() * 5)}`, bx, y + 0.87, bz, 0.26, stack, 0.34, (rand() - 0.5) * 0.3);
      }
      shadow(it.w + 0.4, it.d + 0.4);
      break;
    }
    case "shelf":
    case "bookcase": {
      const h = it.kind === "shelf" ? 2.4 : 2.2;
      // Carcass, then rows of book spines facing out.
      batch.box("oak-dark", it.x, y, it.z, it.w, h, it.d);
      const rows = it.kind === "shelf" ? 5 : 6;
      const faceOut = { x: f.x === 0 ? 0 : -f.x, z: f.z === 0 ? 0 : -f.z };
      const facing = Math.abs(faceOut.x) > 0.5;
      const len = facing ? it.d : it.w;
      for (let r = 0; r < rows; r++) {
        const q = new Quads();
        const yy = y + 0.12 + r * (h / rows);
        const plane = facing ? it.x + faceOut.x * (it.w / 2 + 0.005) : it.z + faceOut.z * (it.d / 2 + 0.005);
        const s0 = (facing ? it.z : it.x) - len / 2 + 0.05;
        const s1 = s0 + len - 0.1;
        if (facing) {
          if (faceOut.x > 0) q.wall(plane, s1, plane, s0, yy, yy + h / rows - 0.06, 1, 1, 0);
          else q.wall(plane, s0, plane, s1, yy, yy + h / rows - 0.06, 1, 1, 0);
        } else if (faceOut.z > 0) q.wall(s0, plane, s1, plane, yy, yy + h / rows - 0.06, 1, 1, 0);
        else q.wall(s1, plane, s0, plane, yy, yy + h / rows - 0.06, 1, 1, 0);
        const g = q.build();
        const uv = g.getAttribute("uv") as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.4 + r * 0.37, (uv.getY(i) - (yy - y) + 0) / (h / rows));
        batch.push(`books-${((it.variant ?? 0) + r) % 4}`, g);
      }
      break;
    }
    case "reading-table": {
      batch.box("oak", it.x, y + 0.74, it.z, it.w, 0.05, it.d);
      for (const s of [-1, 1]) batch.box("black", it.x + s * (it.w / 2 - 0.25), y, it.z, 0.06, 0.74, it.d - 0.2);
      for (let i = 0; i < 4; i++) {
        const cx = it.x - it.w / 2 + 0.55 + i * ((it.w - 1.1) / 3);
        for (const s of [-1, 1]) {
          batch.box("chair", cx, y + 0.44, it.z + s * (it.d / 2 + 0.3), 0.44, 0.04, 0.42);
          batch.box("chair", cx, y + 0.44, it.z + s * (it.d / 2 + 0.5), 0.44, 0.44, 0.04);
        }
      }
      for (const s of [-1, 1]) {
        batch.box("brass", it.x + s * 0.9, y + 0.79, it.z, 0.03, 0.4, 0.03);
        batch.box("lamp-green", it.x + s * 0.9, y + 1.15, it.z, 0.45, 0.12, 0.18);
      }
      shadow(it.w + 1, it.d + 1.4);
      break;
    }
    case "workbench": {
      batch.box("corian", it.x, y + 0.9, it.z, it.w, 0.05, it.d);
      batch.box("black", it.x, y, it.z, it.w - 0.3, 0.9, 0.08);
      for (let i = 0; i < 3; i++) {
        const sx = it.x - it.w / 2 + 0.55 + i * ((it.w - 1.1) / 2);
        batch.box("black", sx, y + 0.95, it.z - 0.35, 0.56, 0.36, 0.03);
        batch.box(`screen-${i % 3}`, sx, y + 0.97, it.z - 0.33, 0.52, 0.32, 0.005);
        batch.box("steel", sx, y + 0.95, it.z + 0.1, 0.32, 0.01, 0.22);
        batch.box("chair", sx, y + 0.6, it.z + 0.95, 0.4, 0.05, 0.4);
        batch.box("black", sx, y, it.z + 0.95, 0.04, 0.6, 0.04);
      }
      shadow(it.w + 0.6, it.d + 1.6);
      break;
    }
    case "plinth": {
      batch.box("corian", it.x, y, it.z, it.w, 1.0, it.d);
      // An optical toy on top: a striped disc, a tilted grid, a lenticular fan.
      const v = it.variant ?? 0;
      if (v === 0) batch.add("op-disc", geo("op-disc", () => new THREE.CylinderGeometry(0.3, 0.3, 0.02, 40)), it.x, y + 1.25, it.z, 0, undefined);
      if (v === 1) batch.box("op-grid", it.x, y + 1.0, it.z, 0.5, 0.5, 0.02);
      if (v === 2) for (let i = 0; i < 6; i++) batch.box(i % 2 ? "black" : "corian", it.x - 0.25 + i * 0.1, y + 1.0, it.z, 0.08, 0.4, 0.12, i % 2 ? 0.6 : -0.6);
      shadow(1.3, 1.3);
      break;
    }
    case "sculpture": {
      const v = it.variant ?? 0;
      if (v === 0) {
        // A polished steel ring standing on its edge.
        batch.box("concrete", it.x, y, it.z, 1.6, 0.25, 0.8);
        const ring = new THREE.TorusGeometry(1.2, 0.16, 20, 64);
        batch.add("chrome", ring, it.x, y + 1.45, it.z, 0.4);
        ring.dispose();
      } else if (v === 1) {
        // Three rough stone blocks, stacked off true.
        let yy = y;
        for (let i = 0; i < 3; i++) {
          const s = 1.2 - i * 0.25;
          batch.box("stone-block", it.x + (rand() - 0.5) * 0.2, yy, it.z + (rand() - 0.5) * 0.2, s, s * 0.8, s, rand() * 0.8);
          yy += s * 0.8;
        }
      } else {
        // Two tall weathered plates leaning toward each other.
        batch.box("corten", it.x - 0.5, y, it.z, 0.08, 4.2, 1.8, 0.2);
        batch.box("corten", it.x + 0.6, y, it.z + 0.2, 0.08, 3.4, 1.6, -0.5);
      }
      shadow(3, 3, 0.5);
      break;
    }
    case "planter": {
      batch.box("concrete", it.x, y, it.z, it.w, 0.55, it.d);
      batch.box("soil", it.x, y + 0.55, it.z, it.w - 0.12, 0.02, it.d - 0.12);
      const leaf = geo("leaf", () => new THREE.IcosahedronGeometry(1, 0));
      const n = Math.round(it.w * it.d * 5);
      for (let i = 0; i < n; i++) {
        const s = 0.1 + rand() * 0.18;
        batch.add(
          `leaf-${i % 4}`,
          leaf,
          it.x + (rand() - 0.5) * (it.w - 0.3),
          y + 0.6 + rand() * 0.35,
          it.z + (rand() - 0.5) * (it.d - 0.3),
          rand() * 6,
          [s, s * 1.6, s],
        );
      }
      break;
    }
    case "lectern":
    case "kiosk":
    case "shaft":
    case "solid":
      break;
  }
  void b;
  void boxGeometry;
}

/** A pendant lamp hanging `drop` metres from the ceiling. */
function pendant(batch: Batch, x: number, ceilingY: number, z: number, drop: number) {
  batch.box("black", x, ceilingY - drop, z, 0.01, drop, 0.01);
  batch.add("pendant", geo("pendant", () => new THREE.ConeGeometry(0.22, 0.26, 24, 1, true)), x, ceilingY - drop - 0.12, z);
  batch.add("lamp", geo("bulb", () => new THREE.SphereGeometry(0.06, 12, 8)), x, ceilingY - drop - 0.22, z);
}

/**
 * Patches of sun on the floor below each window that faces the sun, crossed
 * by the shadows of its mullions.
 */
function sunPatches(k: Kit, level: Level, batch: Batch) {
  const s = k.sun;
  if (s.y < 0.12) return;
  const sh = { x: s.x, z: s.z };
  for (const w of level.walls) {
    if (!w.outside) continue;
    const facing = w.outside.x * sh.x + w.outside.z * sh.z;
    if (facing <= 0.05) continue;
    const alongX = w.z0 === w.z1;
    const start = alongX ? w.x0 : w.z0;
    const line = alongX ? w.z0 : w.x0;
    const spans = w.glass
      ? [{ from: 0, to: (alongX ? w.x1 - w.x0 : w.z1 - w.z0), bottom: 0, top: level.ceiling - 0.2, cols: 0 }]
      : w.openings.filter((o) => o.kind === "window" || o.kind === "glass").map((o) => ({ ...o, cols: 0 }));
    for (const o of spans) {
      const len = o.to - o.from;
      const cols = Math.max(1, Math.round(len / (w.glass ? 1.5 : 1.6)));
      // The material draws the mullions' shadows: so many columns, a transom so far up.
      const key = `sun:${cols}:${w.glass ? Math.round((3.4 / (o.top - o.bottom)) * 20) : 0}`;
      // Each corner of the opening, projected along the sunlight onto the floor.
      const proj = (along: number, hgt: number) => {
        const p = alongX ? { x: start + along, z: line } : { x: line, z: start + along };
        const t = hgt / s.y;
        return { x: p.x - sh.x * t, z: p.z - sh.z * t };
      };
      const a0 = proj(o.from, o.bottom);
      const a1 = proj(o.to, o.bottom);
      const b1 = proj(o.to, o.top);
      const b0 = proj(o.from, o.top);
      // Not into the void of the atrium, nor further than a room's depth.
      const reach = Math.hypot(b0.x - a0.x, b0.z - a0.z);
      if (reach > 16) continue;
      const mid = { x: (a0.x + b1.x) / 2, z: (a0.z + b1.z) / 2 };
      const space = spaceAt(level, mid);
      if (!space || space.kind === "outside") continue;
      const q = new Quads();
      const yy = level.y + 0.008;
      q.add(
        [
          [a0.x, yy, a0.z],
          [a1.x, yy, a1.z],
          [b1.x, yy, b1.z],
          [b0.x, yy, b0.z],
        ],
        [0, 1, 0],
        undefined,
        [
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      );
      const g = q.build();
      batch.push(key, g);
    }
  }
}
