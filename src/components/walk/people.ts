import * as THREE from "three";
import { seededRandom } from "@/lib/museum/placeholder";
import type { Building, Vec } from "@/lib/walk/building";
import { type Place, collides, groundAt, move, route, viewpoint, yawToward } from "@/lib/walk/motion";
import { Batch, type Kit } from "./kit";

/**
 * Other visitors: people drifting from painting to painting, pausing to
 * look, sitting on the benches and the grand stair, crossing the lobby and
 * walking the street outside. They step aside for no one but stop short of
 * the visitor.
 */

export type Figure = {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
};

const COATS = ["#2f3a4a", "#7a2e2e", "#d9d2c3", "#3b5a46", "#c27c3a", "#1f1f22", "#6d6a8a", "#a8b4be", "#e2b23c", "#ff2e63"];
const LEGS = ["#22252b", "#3a3f4a", "#5b4a3a", "#2a3d5c", "#c9c2b4", "#151515"];
const SKIN = ["#f0c9a6", "#d9a47c", "#a8714c", "#7a4e33", "#e8b896", "#5c3a26"];
const HAIR = ["#2b211b", "#4a3424", "#9a7748", "#111111", "#c9b8a0", "#6b2f1f"];

/** A simple figure: capsules for limbs that swing from hip and shoulder. */
export function makeFigure(k: Kit, colors: { coat: string; legs: string; skin: string; hair: string }, scale = 1): Figure {
  const root = new THREE.Group();
  const limb = (r: number, len: number, key: string, x: number, top: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, top, 0);
    const m = new THREE.Mesh(capsule(k, r, len), k.mat(key));
    m.position.y = -len / 2 - r / 2;
    pivot.add(m);
    return pivot;
  };
  const coat = `person:${colors.coat}`;
  const body = new THREE.Group();
  const torso = new THREE.Mesh(capsule(k, 0.19, 0.42), k.mat(coat));
  torso.position.y = 1.08;
  torso.scale.z = 0.72;
  const head = new THREE.Mesh(sphere(k), k.mat(`person:${colors.skin}`));
  head.position.y = 1.56;
  const hair = new THREE.Mesh(cap(k), k.mat(`person:${colors.hair}`));
  hair.position.set(0, 1.575, 0.012);
  hair.rotation.x = 0.35;
  const legL = limb(0.075, 0.62, `person:${colors.legs}`, -0.095, 0.86);
  const legR = limb(0.075, 0.62, `person:${colors.legs}`, 0.095, 0.86);
  const armL = limb(0.055, 0.46, coat, -0.225, 1.36);
  const armR = limb(0.055, 0.46, coat, 0.225, 1.36);
  body.add(torso, head, hair, armL, armR);
  root.add(body, legL, legR);
  const shadow = new THREE.Mesh(plane(k), k.mat("shadow"));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  root.add(shadow);
  root.scale.setScalar(scale);
  return { root, body, legL, legR, armL, armR };
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const capsule = (k: Kit, r: number, len: number) => cached(k, `cap:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
const sphere = (k: Kit) => cached(k, "head", () => new THREE.SphereGeometry(0.13, 18, 12));
const cap = (k: Kit) => cached(k, "hair", () => new THREE.SphereGeometry(0.137, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55));
const plane = (k: Kit) => cached(k, "shadow", () => new THREE.PlaneGeometry(0.8, 0.8));
function cached(k: Kit, key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
    k.keep({ dispose: () => {
      g!.dispose();
      geoCache.delete(key);
    } });
  }
  return g;
}

/** Poses a figure mid-stride (`stride` in metres walked, `pace` 0–1). */
export function pose(f: Figure, stride: number, pace: number) {
  // Straight legs, no knees: a modest swing reads as walking, a big one as marching.
  const swing = Math.sin(stride * 4.2) * 0.4 * pace;
  f.legL.rotation.x = swing;
  f.legR.rotation.x = -swing;
  f.armL.rotation.x = -swing * 0.6;
  f.armR.rotation.x = swing * 0.6;
  f.body.position.y = Math.abs(Math.cos(stride * 4.2)) * 0.03 * pace;
}

/** Seats a figure: thighs forward, body lowered onto a seat at `seat` metres. */
function sit(f: Figure, seat: number) {
  f.legL.rotation.x = Math.PI / 2 - 0.05;
  f.legR.rotation.x = Math.PI / 2 + 0.05;
  f.legL.position.y = f.legR.position.y = seat;
  f.body.position.y = seat - 0.86;
  f.armL.rotation.x = f.armR.rotation.x = 0.45;
}

type Walker = {
  fig: Figure;
  at: Place;
  yaw: number;
  legs: Vec[];
  wait: number;
  face: number | null;
  stride: number;
  pace: number;
  speed: number;
  rand: () => number;
  /** Stays outside, walking the sidewalk. */
  street: boolean;
};

export type Crowd = {
  update(dt: number, visitor: Place, visible: (level: number) => boolean, near: Vec): void;
  /** Circles the visitor shouldn't walk through. */
  obstacles(level: number): { x: number; z: number; r: number }[];
};

export function buildCrowd(k: Kit, b: Building): Crowd {
  const rand = seededRandom(2024);
  const colors = () => ({
    coat: COATS[Math.floor(rand() * COATS.length)],
    legs: LEGS[Math.floor(rand() * LEGS.length)],
    skin: SKIN[Math.floor(rand() * SKIN.length)],
    hair: HAIR[Math.floor(rand() * HAIR.length)],
  });
  const walkers: Walker[] = [];
  const sitters: { level: number; x: number; z: number; fig: Figure }[] = [];

  // Spots worth walking to on each floor: in front of the paintings, by the lecterns, along the atrium.
  const spots = b.levels.map((level) => {
    const list: { at: Vec; yaw: number }[] = [];
    for (const art of b.artworks.filter((a) => a.level === level.index)) {
      const v = viewpoint(b, { kind: "art", art });
      list.push({ at: v.at, yaw: v.yaw });
    }
    for (const room of b.rooms.filter((r) => r.level === level.index)) {
      for (const spot of room.emptySlots) list.push({ at: { x: spot.x + spot.nx * 2.2, z: spot.z + spot.nz * 2.2 }, yaw: Math.atan2(spot.nx, spot.nz) });
    }
    for (const s of level.spaces) {
      if (s.kind === "gallery" || s.kind === "outside") continue;
      for (let i = 0; i < 3; i++) {
        const at = { x: s.rect.x0 + 1 + rand() * (s.rect.x1 - s.rect.x0 - 2), z: s.rect.z0 + 1 + rand() * (s.rect.z1 - s.rect.z0 - 2) };
        if (!collides(b, level.index, at)) list.push({ at, yaw: rand() * Math.PI * 2 });
      }
    }
    return list;
  });

  const add = (level: number, street = false) => {
    const list = spots[level];
    let start: Vec | null = null;
    for (let tries = 0; tries < 20 && !start; tries++) {
      const s = street
        ? { at: { x: -10 + rand() * 66, z: 43.5 + rand() * 5 }, yaw: 0 }
        : list[Math.floor(rand() * list.length)];
      if (s && !collides(b, level, s.at, 0.35)) start = s.at;
    }
    if (!start) return;
    const fig = makeFigure(k, colors(), 0.92 + rand() * 0.14);
    k.levels[level].add(fig.root);
    walkers.push({
      fig,
      at: { level, pos: start },
      yaw: rand() * Math.PI * 2,
      legs: [],
      wait: rand() * 6,
      face: null,
      stride: rand() * 10,
      pace: 0,
      speed: 0.8 + rand() * 0.45,
      rand: seededRandom(Math.floor(rand() * 1e6)),
      street,
    });
  };

  for (const level of b.levels) {
    const n = level.index === 0 ? 7 : Math.min(7, 2 + b.rooms.filter((r) => r.level === level.index).length);
    for (let i = 0; i < n; i++) add(level.index);
  }
  for (let i = 0; i < 6; i++) add(0, true);

  // People sitting: on gallery benches, on the grand stair, at café tables.
  const seat = (level: number, x: number, z: number, yaw: number, height: number) => {
    const fig = makeFigure(k, colors(), 0.95 + rand() * 0.1);
    sit(fig, height);
    fig.root.position.set(x, b.levels[level].y + 0, z);
    fig.root.rotation.y = yaw;
    k.levels[level].add(fig.root);
    sitters.push({ level, x, z, fig });
  };
  for (const level of b.levels) {
    for (const it of level.items) {
      if (it.kind === "bench" && rand() < 0.45) {
        const long = it.w > it.d;
        const off = (rand() - 0.5) * ((long ? it.w : it.d) - 0.8);
        const side = rand() < 0.5 ? 1 : -1;
        seat(
          level.index,
          it.x + (long ? off : 0),
          it.z + (long ? 0 : off),
          long ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2,
          0.47,
        );
      }
      if (it.kind === "cafe-table" && rand() < 0.5) {
        const a = rand() * Math.PI * 2;
        seat(level.index, it.x + Math.cos(a) * 0.72, it.z + Math.sin(a) * 0.72, Math.atan2(Math.cos(a), Math.sin(a)), 0.47);
      }
    }
  }
  const grand = b.stairs.find((s) => s.kind === "grand");
  if (grand) {
    for (const i of [5, 10, 14, 19, 23]) {
      const t = (i + 0.5) / 34;
      const z = grand.rect.z1 - t * (grand.rect.z1 - grand.rect.z0);
      const x = grand.rect.x0 + 0.7 + rand() * 2.6;
      const y = groundAt(b, 0, { x, z });
      const fig = makeFigure(k, colors(), 0.95 + rand() * 0.1);
      sit(fig, 0.45);
      fig.root.position.set(x, y - 0.18, z + 0.18);
      fig.root.rotation.y = 0;
      // Facing down the stair, toward the lobby.
      fig.root.rotation.y = Math.PI;
      k.shared.add(fig.root);
    }
  }

  const choose = (w: Walker) => {
    if (w.street) {
      const to = { x: -10 + w.rand() * 66, z: 43.5 + w.rand() * 5 };
      w.legs = [to];
      w.face = null;
      return;
    }
    const list = spots[w.at.level];
    if (!list.length) return;
    const s = list[Math.floor(w.rand() * list.length)];
    // Not exactly where the last person stood.
    const at = { x: s.at.x + (w.rand() - 0.5) * 1.2, z: s.at.z + (w.rand() - 0.5) * 0.8 };
    if (collides(b, w.at.level, at)) return;
    const legs = route(b, w.at, { level: w.at.level, pos: at });
    if (!legs || legs.length > 12) return;
    w.legs = legs;
    w.face = s.yaw;
  };

  return {
    update(dt, visitor, visible, near) {
      // Too far off to make out: not drawn at all.
      const FAR = 35;
      for (const s of sitters) {
        s.fig.root.visible = visible(s.level) && Math.hypot(s.x - near.x, s.z - near.z) < FAR;
      }
      for (const w of walkers) {
        const show = visible(w.at.level) && Math.hypot(w.at.pos.x - near.x, w.at.pos.z - near.z) < FAR;
        w.fig.root.visible = show;
        // Far away or out of sight: let them be.
        if (!show || Math.hypot(w.at.pos.x - near.x, w.at.pos.z - near.z) > 45) continue;
        if (w.wait > 0) {
          w.wait -= dt;
          w.pace = Math.max(0, w.pace - dt * 3);
          if (w.face !== null) w.yaw += Math.atan2(Math.sin(w.face - w.yaw), Math.cos(w.face - w.yaw)) * Math.min(1, dt * 2.5);
          if (w.wait <= 0) choose(w);
        } else if (w.legs.length) {
          const target = w.legs[0];
          const dx = target.x - w.at.pos.x;
          const dz = target.z - w.at.pos.z;
          const dist = Math.hypot(dx, dz);
          // Stop short of the visitor rather than walk through them.
          const tooClose =
            visitor.level === w.at.level &&
            Math.hypot(visitor.pos.x - w.at.pos.x, visitor.pos.z - w.at.pos.z) < 1 &&
            (visitor.pos.x - w.at.pos.x) * dx + (visitor.pos.z - w.at.pos.z) * dz > 0;
          if (dist < 0.1) w.legs.shift();
          else if (!tooClose) {
            const step = Math.min(dist, w.speed * dt);
            const before = w.at.pos;
            w.at = move(b, w.at, { x: (dx / dist) * step, z: (dz / dist) * step }, 0.25);
            const moved = Math.hypot(w.at.pos.x - before.x, w.at.pos.z - before.z);
            w.stride += moved;
            w.pace = Math.min(1, moved / dt / 1.2);
            const want = yawToward(before, target);
            w.yaw += Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)) * Math.min(1, dt * 5);
            if (moved < step * 0.2) w.legs = [];
          } else w.pace = Math.max(0, w.pace - dt * 4);
          if (!w.legs.length) w.wait = 4 + w.rand() * 10;
        } else {
          w.wait = 1 + w.rand() * 3;
        }
        pose(w.fig, w.stride, w.pace);
        w.fig.root.position.set(w.at.pos.x, groundAt(b, w.at.level, w.at.pos), w.at.pos.z);
        w.fig.root.rotation.y = w.yaw;
      }
    },
    obstacles(level) {
      return [
        ...walkers.filter((w) => w.at.level === level).map((w) => ({ x: w.at.pos.x, z: w.at.pos.z, r: 0.3 })),
        ...sitters.filter((s) => s.level === level).map((s) => ({ x: s.x, z: s.z, r: 0.25 })),
      ];
    },
  };
}

/** For the visitor's own body, seen when the camera steps back. */
export function buildSelf(k: Kit): Figure {
  const fig = makeFigure(k, { coat: "#ff2e63", legs: "#24252b", skin: "#e0b48f", hair: "#2b211b" });
  fig.root.visible = false;
  k.shared.add(fig.root);
  return fig;
}

export { Batch };
