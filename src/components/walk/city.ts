import * as THREE from "three";
import { seededRandom } from "@/lib/museum/placeholder";
import type { Building, Vec } from "@/lib/walk/building";
import { Batch, type Kit, Quads } from "./kit";

/**
 * Outside: a sky with drifting clouds, the street with its traffic, the
 * buildings across the road and next door, and the city fading into haze.
 * Lit by today's sun, painted in, so it costs almost nothing to draw.
 */

export type City = {
  /** Moves the cars along; returns the nearest one to `p` (for its sound). */
  update(time: number, dt: number, camera: THREE.Vector3): void;
  nearestCar(p: Vec): { dist: number; dx: number; speed: number };
};

const ROAD = { z0: 50.15, z1: 60 };

export function buildCity(k: Kit, b: Building, sky: { top: THREE.Color; horizon: THREE.Color }): City {
  const batch = new Batch(k.mat, k.keep);
  const rand = seededRandom(1907);
  const shade = (n: Vec) => {
    const s = k.sun;
    const h = Math.hypot(s.x, s.z) || 1;
    return 0.62 + 0.38 * Math.max(0, (n.x * s.x + n.z * s.z) / h);
  };

  // ── Sky ──
  const skyMat = k.keep(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: sky.top },
        horizon: { value: sky.horizon },
        sunDir: { value: k.sun },
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 sunDir;
        uniform float time;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 c = mix(horizon, top, pow(h, 0.5));
          // Clouds on a plane overhead, thinning toward the horizon.
          if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(time * 0.004, time * 0.0015);
            float cl = smoothstep(0.52, 0.82, fbm(uv));
            float lit = 0.85 + 0.15 * fbm(uv * 2.0 + 3.0);
            c = mix(c, vec3(1.0, 0.99, 0.97) * lit, cl * smoothstep(0.0, 0.25, d.y) * 0.85);
          } else {
            c = mix(horizon, horizon * 0.7, min(1.0, -d.y * 4.0));
          }
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += vec3(1.0, 0.92, 0.78) * (pow(s, 1200.0) * 6.0 + pow(s, 16.0) * 0.18);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  const skyDome = new THREE.Mesh(k.keep(new THREE.SphereGeometry(1000, 32, 16)), skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -1;
  k.shared.add(skyDome);

  // ── The ground and the street ──
  const ground = new Quads();
  ground.level(-900, -900, 900, 900, -0.03, false, 4);
  batch.push("ground", ground.build());
  const pave = new Quads();
  // Sidewalks beyond the museum's own frontage, and across the road.
  pave.level(-260, b.levels[0].floors.find((f) => f.surface === "street")!.rect.z0, -14, ROAD.z0 - 0.15, 0.0, false, 4);
  pave.level(60, 42, 300, ROAD.z0 - 0.15, 0.0, false, 4);
  pave.level(-260, ROAD.z1 + 0.15, 300, ROAD.z1 + 6, 0.0, false, 4);
  batch.push("pavement", pave.build());
  const road = new Quads();
  road.level(-260, ROAD.z0, 300, ROAD.z1, -0.14, false, 4);
  batch.push("asphalt", road.build());
  // Kerbs, the centre line, a crossing in front of the doors.
  batch.box("curb", 20, -0.14, ROAD.z0 - 0.07, 560, 0.15, 0.16);
  batch.box("curb", 20, -0.14, ROAD.z1 + 0.07, 560, 0.15, 0.16);
  for (let x = -258; x < 300; x += 6) batch.box("road-paint", x, -0.135, (ROAD.z0 + ROAD.z1) / 2, 3, 0.01, 0.14);
  for (let z = ROAD.z0 + 0.5; z < ROAD.z1 - 0.4; z += 0.9) batch.box("road-paint", 24, -0.135, z, 4, 0.01, 0.45);

  // ── Buildings ──
  const blocks: { x0: number; z0: number; x1: number; z1: number; h: number }[] = [];
  // Across the street: a continuous row of mixed heights.
  for (let x = -220; x < 280; ) {
    const w = 10 + rand() * 24;
    const d = 18 + rand() * 16;
    const h = 12 + rand() * (rand() < 0.2 ? 70 : 34);
    blocks.push({ x0: x, z0: ROAD.z1 + 6, x1: x + w - 0.4, z1: ROAD.z1 + 6 + d, h });
    x += w;
  }
  // Next door on either side, and behind.
  for (let z = -60; z < 42; ) {
    const d = 12 + rand() * 18;
    blocks.push({ x0: -40 - rand() * 10, z0: z, x1: -16, z1: Math.min(41.8, z + d - 0.5), h: 16 + rand() * 30 });
    blocks.push({ x0: 62, z0: z, x1: 80 + rand() * 20, z1: Math.min(41.8, z + d - 0.5), h: 14 + rand() * 40 });
    z += d;
  }
  for (let x = -16; x < 62; ) {
    const w = 12 + rand() * 18;
    blocks.push({ x0: x, z0: -40, x1: x + w - 0.5, z1: -8, h: 20 + rand() * 50 });
    x += w;
  }
  // The rest of the city, further off.
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2;
    const r = 130 + rand() * 380;
    const cx = 24 + Math.cos(a) * r;
    const cz = 20 + Math.sin(a) * r;
    if (cz > ROAD.z0 - 5 && cz < ROAD.z1 + 30 && Math.abs(cx) < 300) continue;
    const w = 14 + rand() * 30;
    const d = 14 + rand() * 30;
    blocks.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, h: 10 + rand() * (rand() < 0.15 ? 120 : 45) });
  }
  const walls = new Map<number, Quads>();
  const roofs = new Quads();
  blocks.forEach((bl, i) => {
    const v = i % 5;
    let q = walls.get(v);
    if (!q) walls.set(v, (q = new Quads()));
    const sides: [number, number, number, number, Vec][] = [
      [bl.x0, bl.z1, bl.x1, bl.z1, { x: 0, z: 1 }],
      [bl.x1, bl.z0, bl.x0, bl.z0, { x: 0, z: -1 }],
      [bl.x1, bl.z1, bl.x1, bl.z0, { x: 1, z: 0 }],
      [bl.x0, bl.z0, bl.x0, bl.z1, { x: -1, z: 0 }],
    ];
    for (const [ax, az, bx, bz, n] of sides) {
      const c = shade(n);
      q.wall(ax, az, bx, bz, -0.1, bl.h, c * 0.82, c, (i * 7.3) % 10);
    }
    roofs.level(bl.x0, bl.z0, bl.x1, bl.z1, bl.h, false, 1, 0.9);
    // A shopfront at street level for the row across the road.
    if (bl.z0 === ROAD.z1 + 6) batch.box(`awning-${i % 3}`, (bl.x0 + bl.x1) / 2, 3.2, bl.z0 - 0.6, bl.x1 - bl.x0 - 1, 0.12, 1.2);
  });
  for (const [v, q] of walls) {
    const g = q.build();
    // Window texture: about 6 m across and 4 floors (14 m) up per tile.
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 14);
    batch.push(`city:${v}`, g);
  }
  batch.push("city-roof", roofs.build());

  // The skyline far off, in the haze.
  const band = new THREE.CylinderGeometry(780, 780, 140, 64, 1, true);
  band.translate(24, 50, 20);
  batch.push("skyline", band);

  batch.flush(k.shared);

  // ── Traffic ──
  const carColors = ["#e8e6e1", "#1d1f22", "#9aa1a8", "#a8242c", "#2f4d7a", "#c9b38f", "#3c4a3f"];
  const cars = Array.from({ length: 9 }, (_, i) => {
    const g = new THREE.Group();
    const parts = new Batch(k.mat, k.keep);
    const color = carColors[i % carColors.length];
    const len = 4.3 + rand() * 0.6;
    parts.box(`car:${color}`, 0, 0.3, 0, len, 0.68, 1.8);
    parts.box("car-glass", -0.2, 0.98, 0, len * 0.5, 0.5, 1.62);
    parts.box(`car:${color}`, -0.2, 1.46, 0, len * 0.48, 0.05, 1.6);
    for (const [x, z] of [
      [len * 0.32, 0.82],
      [-len * 0.32, 0.82],
      [len * 0.32, -0.82],
      [-len * 0.32, -0.82],
    ]) {
      parts.box("tyre", x, 0, z, 0.66, 0.66, 0.24);
    }
    parts.box("lamp", len / 2, 0.68, 0.6, 0.04, 0.12, 0.3);
    parts.box("lamp", len / 2, 0.68, -0.6, 0.04, 0.12, 0.3);
    parts.box("tail", -len / 2, 0.7, 0.62, 0.04, 0.1, 0.28);
    parts.box("tail", -len / 2, 0.7, -0.62, 0.04, 0.1, 0.28);
    parts.flush(g);
    const shadow = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(len + 0.6, 2.4)), k.mat("shadow-soft"));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    g.add(shadow);
    const east = i % 2 === 0;
    const car = {
      g,
      east,
      x: -200 + rand() * 450,
      z: east ? 57.6 : 52.6,
      speed: 8 + rand() * 5,
      gap: rand() * 8,
    };
    g.position.set(car.x, -0.14, car.z);
    g.rotation.y = east ? 0 : Math.PI;
    k.shared.add(g);
    return car;
  });
  // Westbound faces −x, eastbound +x.
  for (const c of cars) c.g.rotation.y = c.east ? 0 : Math.PI;

  return {
    update(time, dt) {
      skyMat.uniforms.time.value = time;
      for (const c of cars) {
        c.x += (c.east ? 1 : -1) * c.speed * dt;
        if (c.x > 300) c.x = -260 - c.gap;
        if (c.x < -260) c.x = 300 + c.gap;
        c.g.position.x = c.x;
      }
    },
    nearestCar(p) {
      let best = { dist: Infinity, dx: 0, speed: 0 };
      for (const c of cars) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < best.dist) best = { dist: d, dx: c.x - p.x, speed: c.speed };
      }
      return best;
    },
  };
}
