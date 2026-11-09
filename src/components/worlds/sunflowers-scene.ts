import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldRandom } from "@/lib/worlds/random";
import {
  FALLEN,
  FLOWERS,
  JUG,
  JUG_TOP,
  START,
  TABLE,
  WALL_Z,
  blocked,
  facing,
  heightAt,
  insideBounds,
} from "@/lib/worlds/sunflowers";
import { lerp, paintSurface, rgb, type RGB, type SkySpec } from "./brush";
import {
  C,
  addGround,
  addSky,
  createStage,
  customize,
  glowInShade,
  pickRGB,
  smooth,
  strokeMaterial,
  strokeRibbons,
  type LandPaint,
  type SceneMaker,
  type Stage,
} from "./kit";

/**
 * Sunflowers, raised with the world kit, with the visitor made small: they
 * walk the yellow table, the jug towers over them, and fifteen sunflowers
 * hang overhead like trees, every one at its own stage of life. The seed
 * heads are dense spirals of thick dabs, the petals raised ribbons of
 * yellow and orange. Nothing moves but the light in the air.
 */

const pal = (xs: string[]) => xs.map(rgb);
const pick = <T>(xs: T[], r: () => number) => xs[Math.floor(r() * xs.length)];
/** A painted colour (sRGB, 0–255) as three.js works with it. */
const asColor = (c: RGB) =>
  new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

/** The room beyond the table: the same yellow as the wall, hatched in short strokes. */
function roomAir(): SkySpec {
  return {
    seed: 1888,
    tones: [
      [0, "#7a5a32"],
      [0.12, "#e2c868"],
      [0.5, "#eedc88"],
      [1, "#f2e6aa"],
    ],
    swirl: ["#e6e08c", "#dcd87a", "#f0e8a4"],
    deep: ["#e8d870", "#f0e088", "#dcd070", "#e4e098", "#d0cc78", "#f2e6a2"],
    seam: "#c8a848",
    seamChance: 0.06,
    strokes: 52000,
    underStrokes: 7000,
    ahead: 0.45,
    // Crosshatched: patches of strokes leaning one way, then the other, patches laid out by
    // direction, so they're as big overhead as ahead.
    flow: (az, el) => {
      const dx = Math.sin(az) * Math.cos(el);
      const dy = Math.sin(el);
      const dz = Math.cos(az) * Math.cos(el);
      const s = Math.sin(dx * 13) * Math.sin(dy * 13 + 1) * Math.sin(dz * 13 + 2) > 0 ? 1 : -1;
      const l = Math.hypot(1, 0.8);
      return { x: 1 / l, y: (0.8 * s) / l };
    },
    swirlAt: (az, el) => 0.25 + 0.25 * Math.sin(az * 5 + el * 3),
    lights: [],
  };
}

/** The table: ochre and yellow in strokes laid across it, darker where the jug shades it, the floor far below. */
function tableTop(): LandPaint {
  const table = pal(["#e0a830", "#d89828", "#e8b840", "#c88820", "#f0c048", "#d8a038"]);
  const shade = pal(["#b8781e", "#a86a1c", "#c08428"]);
  const line = pal(["#5a8a7a", "#4a7a8a", "#6a9a8a"]);
  const floor = pal(["#6a4a2a", "#5a3a20", "#7a5a30", "#4a3220"]);
  const seam = rgb("#a06818");
  // The jug's shadow falls right and toward the visitor: the light comes from the left.
  const shadowness = (x: number, z: number) =>
    1 - smooth(Math.hypot((x - JUG.x - 9) / 20, (z - JUG.z - 6) / 13), 0.6, 1.1);
  return {
    wash: (x, z) => (heightAt(x, z) < -3 ? rgb("#5a4026") : rgb("#dca838")),
    size: (x, z) => Math.min(10, 0.6 + Math.hypot(x - START.x, z - START.z) * 0.03),
    flow: (x, z) => {
      const fz = 0.06 * Math.sin(x * 0.05 + z * 0.1);
      const l = Math.hypot(1, fz);
      return [1 / l, fz / l];
    },
    paint: (x, z, r) => {
      const relief = 0.5 + r() * 0.45;
      if (heightAt(x, z) < -3) return { color: pickRGB(floor, r), relief };
      // Where the table meets the wall, a line of blue-green, as he drew it.
      if (z < TABLE.back + 2.5) return { color: pickRGB(line, r), relief };
      if (r() < 0.07) return { color: seam, relief: 0.2 };
      if (r() < shadowness(x, z)) return { color: pickRGB(shade, r), relief };
      return { color: pickRGB(table, r), relief };
    },
  };
}

/** The wall behind the table: pale yellow-green, crosshatched, the whole height of the room. */
async function addWall(stage: Stage) {
  const { low, keep, paintTextures, painted, paintColor, scene } = stage;
  const W = 480;
  const H = 320;
  const widthPx = low ? 1536 : 3072;
  const mpp = W / widthPx;
  const wall = pal(["#f0e080", "#f6ea98", "#e6dc7c", "#eceaa8", "#dcdc88", "#f8f0b4"]);
  const paint = await paintTextures(
    paintSurface({
      width: widthPx,
      height: Math.round(H / mpp),
      metresPerPx: mpp,
      count: low ? 7000 : 18000,
      seed: 75,
      aspect: 0.28,
      jitter: 0.45,
      wash: () => rgb("#f0e28a"),
      size: () => 5,
      // Crosshatched in patches, as the background of the painting is.
      flow: (s, t) => ((Math.floor(s / 7) + Math.floor(t / 7)) % 2 ? [1, 0.75] : [1, -0.75]),
      paint: (_s, _t, r) => {
        if (r() < 0.05) return { color: rgb("#c8b050"), relief: 0.25 };
        return { color: pickRGB(wall, r), relief: 0.45 + r() * 0.4 };
      },
    }),
    false,
    2.5,
  );
  const g = new THREE.PlaneGeometry(W, H);
  g.translate(0, H / 2 - 5, WALL_Z);
  paintColor(g, C("#ffffff"));
  const mat = painted(paint, 1);
  customize(mat, "wall", (shader) => glowInShade(shader, 0.3));
  scene.add(new THREE.Mesh(keep(g), mat));
}

/** The jug's radius at a height, from its profile. */
function jugRadius(y: number): number {
  const p = JUG.profile;
  if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][1]) {
      const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]);
      return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
    }
  }
  return p.at(-1)![0];
}

/** A point on the jug: `theta` round it (0 faces the visitor), at height `y`, `lift` out from it. */
function jugAt(theta: number, y: number, lift = 0) {
  const r = jugRadius(y) + lift;
  return new THREE.Vector3(JUG.x + r * Math.sin(theta), y, JUG.z + r * Math.cos(theta));
}

/** The jug: yellow glaze above, orange below, a blue line between, in raised vertical strokes, signed. */
async function addJug(stage: Stage, ribbons: ReturnType<typeof strokeRibbons>) {
  const { low, keep, paintColor, scene, texture } = stage;
  const n = worldRandom(28);
  // Underneath the strokes, a dark ochre jug.
  const lathe = new THREE.LatheGeometry(
    JUG.profile.map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  );
  lathe.translate(JUG.x, 0, JUG.z);
  paintColor(lathe, C("#a8742a"));
  scene.add(
    new THREE.Mesh(keep(lathe), keep(new THREE.MeshLambertMaterial({ vertexColors: true }))),
  );

  const yellow = ["#f2c840", "#e8b830", "#f6d860", "#dca828", "#f0d050"].map(C);
  const orange = ["#d88a2a", "#c87a24", "#e09838", "#b86a20", "#d07a20"].map(C);
  const blue = ["#3a5aa8", "#4a6ab8", "#30509a"].map(C);
  const COUNT = low ? 1500 : 2200;
  const ALONG = 3;
  for (let i = 0; i < COUNT; i++) {
    const theta0 = n() * Math.PI * 2;
    const y0 = n() * (JUG_TOP - 1);
    const len = 2 + n() * 1.6;
    const width = 0.7 + n() * 0.45;
    const drift = (n() - 0.5) * 0.08;
    const c = (y0 > JUG.band ? pick(yellow, n) : pick(orange, n))
      .clone()
      .multiplyScalar(0.92 + n() * 0.16);
    const rows: THREE.Vector3[][] = [];
    for (let j = 0; j <= ALONG; j++) {
      const f = j / ALONG;
      const y = Math.min(JUG_TOP - 0.2, y0 + f * len);
      const theta = theta0 + drift * f;
      const w = width * Math.sin(Math.PI * (0.12 + 0.76 * f)) ** 0.7;
      const dth = w / 2 / jugRadius(y);
      rows.push([
        jugAt(theta - dth, y, 0.04),
        jugAt(theta, y, 0.1 + w * 0.12),
        jugAt(theta + dth, y, 0.04),
      ]);
    }
    ribbons.add(rows, c, n(), n(), (j) => ((j / ALONG) * len) / 3.2);
  }
  // The blue line round its middle, laid on in strokes going round.
  const ROUND = low ? 50 : 90;
  for (let i = 0; i < ROUND; i++) {
    const theta0 = (i / ROUND) * Math.PI * 2 + n() * 0.05;
    const y = JUG.band + (n() - 0.5) * 0.5;
    const r = jugRadius(y);
    const arc = (2.2 + n()) / r;
    const rows: THREE.Vector3[][] = [];
    for (let j = 0; j <= 3; j++) {
      const th = theta0 + (j / 3) * arc;
      rows.push([jugAt(th, y - 0.35, 0.06), jugAt(th, y, 0.16), jugAt(th, y + 0.35, 0.06)]);
    }
    ribbons.add(rows, pick(blue, n), n(), n(), (j) => j * 0.3);
  }

  // His name on the jug, in blue, as he signed it.
  const sig = document.createElement("canvas");
  sig.width = 512;
  sig.height = 128;
  const g = sig.getContext("2d")!;
  g.fillStyle = "#2a4aa0";
  g.font = 'italic 600 86px Georgia, "Times New Roman", serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("Vincent", 256, 70);
  const pts: THREE.Vector2[] = [];
  for (let y = 4.5; y <= 9.5; y += 0.5) pts.push(new THREE.Vector2(jugRadius(y) + 0.3, y));
  const patch = new THREE.LatheGeometry(pts, 16, -0.42, 0.84);
  patch.translate(JUG.x, 0, JUG.z);
  const map = texture(sig, false);
  scene.add(
    new THREE.Mesh(
      keep(patch),
      keep(new THREE.MeshLambertMaterial({ map, transparent: true, depthWrite: false })),
    ),
  );
}

/** How each stage of a sunflower's life looks: its petals, its seed head, how they curl and droop. */
const STAGES = {
  bloom: { petals: 32, len: 0.6, disc: 0.4, curl: -0.12, droop: 0.12, petalLen: 1 },
  open: { petals: 26, len: 0.56, disc: 0.38, curl: 0.28, droop: 0.05, petalLen: 1 },
  wilting: { petals: 22, len: 0.64, disc: 0.42, curl: -0.6, droop: 0.6, petalLen: 1 },
  seed: { petals: 12, len: 0.3, disc: 0.68, curl: -0.4, droop: 0.4, petalLen: 0.6 },
};

/** Fifteen sunflowers on their stems, with a few leaves at the jug's mouth. */
async function addFlowers(stage: Stage, ribbons: ReturnType<typeof strokeRibbons>) {
  const { low, keep, paintColor, scene } = stage;
  const yellowPetals = pal(["#f5b800", "#f2c230", "#eaa010", "#f6c828", "#e8860a", "#f0a818"]);
  const wiltPetals = pal(["#d87a14", "#c86a10", "#b8701a", "#e0901e", "#a86010"]);
  const seedPetals = pal(["#a87020", "#8a5a18", "#c08a30"]);
  const edgeLight = rgb("#fbe27a");
  const edgeDark = rgb("#a8600e");
  const centre = {
    fresh: pal(["#7a8a2a", "#9aa034", "#6a7a28"]),
    seed: pal(["#6a6a28", "#7a7a30"]),
  };
  const middle = {
    fresh: pal(["#c8701a", "#d8882a", "#b85a18"]),
    seed: pal(["#8a5a20", "#a06a24"]),
  };
  const outer = {
    fresh: pal(["#6a3a1a", "#5a3418", "#7a4a1a", "#4a2a14"]),
    seed: pal(["#4a2e16", "#5a3418", "#3a2412", "#6a4a1a"]),
  };
  const caps: THREE.BufferGeometry[] = [];
  const stems: THREE.BufferGeometry[] = [];

  for (const f of FLOWERS) {
    const n = worldRandom(300 + f.seed);
    const st = STAGES[f.stage];
    const centreAt = new THREE.Vector3(JUG.x + f.x, f.y, JUG.z + f.z);
    const nrm = new THREE.Vector3(...Object.values(facing(f)));
    const up = Math.abs(nrm.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(up, nrm).normalize();
    const yAxis = new THREE.Vector3().crossVectors(nrm, xAxis);
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, nrm).setPosition(centreAt);
    const local = (x: number, y: number, z: number) =>
      new THREE.Vector3(x, y, z).applyMatrix4(basis);
    const discR = f.r * st.disc;
    const bulge = discR * (f.stage === "seed" ? 0.3 : 0.22);
    const capZ = (rr: number) => bulge * (1 - Math.min(1, (rr / discR) ** 2));

    // The seed head's dark dome, and the green back of the head behind it.
    const front = new THREE.CircleGeometry(discR, 28);
    const back = new THREE.CircleGeometry(discR * 1.08, 20);
    for (const [g, sign] of [
      [front, 1],
      [back, -1],
    ] as const) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const rr = Math.hypot(p.getX(i), p.getY(i));
        p.setZ(
          i,
          sign > 0 ? capZ(rr) * 0.9 : -bulge * 0.9 * (1 - (rr / (discR * 1.08)) ** 2) - 0.1,
        );
      }
      g.applyMatrix4(basis);
      g.computeVertexNormals();
      paintColor(g, C(sign > 0 ? "#3a2410" : "#4a6a24"));
      g.deleteAttribute("uv");
      caps.push(g);
    }

    // The seeds: thick dabs in a spiral, as the seeds grow, olive at the heart, orange, then dark.
    const seedHead = f.stage === "seed";
    const dabs = Math.round((low ? 0.45 : 1) * (seedHead ? 700 : 520));
    for (let k = 0; k < dabs; k++) {
      const rf = Math.sqrt((k + 0.5) / dabs);
      const rr = rf * discR * 0.97;
      const th = k * 2.39996 + n() * 0.15;
      const ring = rf < 0.35 ? "c" : rf < 0.68 ? "m" : "o";
      const set = seedHead ? "seed" : "fresh";
      let c = pick(ring === "c" ? centre[set] : ring === "m" ? middle[set] : outer[set], n);
      if (seedHead && n() < 0.1) c = pick(middle.fresh, n);
      const len = discR * 0.12 * (0.8 + n() * 0.4);
      const w = len * 0.55;
      // Laid across the radius, so the dabs turn in the spiral.
      const dx = -Math.sin(th);
      const dy = Math.cos(th);
      const cx = Math.cos(th) * rr;
      const cy = Math.sin(th) * rr;
      const rows: THREE.Vector3[][] = [];
      for (let j = 0; j <= 2; j++) {
        const s = (j / 2 - 0.5) * len;
        const px = cx + dx * s;
        const py = cy + dy * s;
        const z = capZ(Math.hypot(px, py));
        const ww = w * (j === 1 ? 1 : 0.6);
        rows.push([
          local(px - Math.cos(th) * ww * 0.5, py - Math.sin(th) * ww * 0.5, z + 0.05),
          local(px, py, z + 0.12 + w * 0.3),
          local(px + Math.cos(th) * ww * 0.5, py + Math.sin(th) * ww * 0.5, z + 0.05),
        ]);
      }
      ribbons.add(rows, asColor(c).multiplyScalar(0.9 + n() * 0.2), n(), n(), (j) => j * 0.15);
    }

    // The petals: raised ribbons from the rim, curling and drooping with the flower's age.
    const petalColors =
      f.stage === "wilting" ? wiltPetals : f.stage === "seed" ? seedPetals : yellowPetals;
    const ALONG = 5;
    for (let i = 0; i < st.petals; i++) {
      const a = (i / st.petals) * Math.PI * 2 + (n() - 0.5) * 0.3;
      const L = f.r * st.len * st.petalLen * (0.8 + n() * 0.4);
      const w = f.r * 0.36 * (0.8 + n() * 0.4);
      const curl = st.curl * (0.7 + n() * 0.6);
      const droop = st.droop * (0.6 + n() * 0.8);
      let c = pick(petalColors, n);
      if (f.stage !== "seed" && n() < 0.15) c = lerp(c, pick(wiltPetals, n), 0.6);
      // Each petal is three strokes side by side: its colour down the middle, a lighter
      // stroke on the side toward the light, a darker ochre one on the other.
      const shades = [lerp(c, edgeLight, 0.35), c, lerp(c, edgeDark, 0.55)];
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (const [k, shade] of shades.entries()) {
        const across = (k - 1) / 3;
        const rows: THREE.Vector3[][] = [];
        for (let j = 0; j <= ALONG; j++) {
          const t = j / ALONG;
          const d = discR * 0.92 + t * L;
          const z = curl * L * t * t;
          // Broad near the middle, coming to a point.
          const ww =
            w *
            (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95))) *
            (1 - t ** 3 * 0.7);
          const fall = droop * L * t * t;
          const mid = ww * across;
          const sw = ww / 2.4;
          const pt = (side: number, lift: number) => {
            const v = local(ca * d - sa * side, sa * d + ca * side, z + lift);
            v.y -= fall;
            return v;
          };
          rows.push([pt(mid - sw / 2, 0.02), pt(mid, sw * 0.45 + 0.06), pt(mid + sw / 2, 0.02)]);
        }
        ribbons.add(
          rows,
          asColor(shade).multiplyScalar(0.92 + n() * 0.16),
          n(),
          n(),
          (j) => ((j / ALONG) * L) / 3.2,
        );
      }
    }

    // The stem, from inside the jug's mouth up (or over and down) to the back of the head.
    const out = Math.atan2(f.z, f.x);
    const p0 = new THREE.Vector3(
      JUG.x + Math.cos(out) * 2.6,
      JUG_TOP - 1.5,
      JUG.z + Math.sin(out) * 2.6,
    );
    const p2 = centreAt.clone().addScaledVector(nrm, -f.r * 0.12);
    const p1 = new THREE.Vector3(
      p0.x + (p2.x - p0.x) * 0.35,
      Math.max(p0.y, p2.y) + (p2.y < JUG_TOP + 4 ? 9 : (p2.y - p0.y) * 0.1),
      p0.z + (p2.z - p0.z) * 0.35,
    );
    const stem = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 20, 0.55, 6);
    paintColor(stem, C(pick(["#5a7a2a", "#6a8a30", "#4f6f28"], n)));
    stems.push(stem);
  }

  // A few leaves at the jug's mouth, curling over its lip.
  const leafGreen = pal(["#5a8a2a", "#6a9a30", "#4a7a2a", "#7aa040", "#3f6a28"]);
  const ln = worldRandom(29);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + ln() * 0.5;
    const L = 9 + ln() * 4;
    const W = 3.4 + ln();
    const base = new THREE.Vector3(
      JUG.x + Math.sin(a) * 5.4,
      JUG_TOP - 0.5,
      JUG.z + Math.cos(a) * 5.4,
    );
    const outward = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const across = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    for (let k = 0; k < 4; k++) {
      const off = (k / 3 - 0.5) * W * 0.7;
      const rows: THREE.Vector3[][] = [];
      for (let j = 0; j <= 5; j++) {
        const t = j / 5;
        const ww = (W / 4) * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)) * 1.1;
        const spread = off * Math.sin(Math.PI * Math.min(1, t * 1.1));
        // Out over the lip, then down the jug's side.
        const p = base
          .clone()
          .addScaledVector(outward, t * L * 0.75 + 0.6)
          .addScaledVector(across, spread)
          .add(new THREE.Vector3(0, 2.5 * Math.sin(t * Math.PI * 0.8) - t * t * L * 0.6, 0));
        rows.push([
          p.clone().addScaledVector(across, -ww / 2),
          p
            .clone()
            .addScaledVector(outward, 0.15)
            .add(new THREE.Vector3(0, 0.12, 0)),
          p.clone().addScaledVector(across, ww / 2),
        ]);
      }
      ribbons.add(
        rows,
        asColor(pick(leafGreen, ln)).multiplyScalar(0.9 + ln() * 0.2),
        ln(),
        ln(),
        (j) => j * 0.6,
      );
    }
  }

  const capMat = keep(
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  customize(capMat, "caps", (shader) => glowInShade(shader, 0.35));
  scene.add(new THREE.Mesh(keep(mergeGeometries(caps)), capMat));
  const stemTile = await stage.tile("flame", {
    angle: Math.PI / 2,
    wave: 0.55,
    len: 5,
    width: 32,
    seed: 13,
    dark: 0.5,
  });
  const stemMat = stage.painted(stemTile, 1);
  customize(stemMat, "stems", (shader) => glowInShade(shader, 0.3));
  scene.add(new THREE.Mesh(keep(mergeGeometries(stems)), stemMat));
  [...caps, ...stems].forEach((g) => g.dispose());
}

/** Petals that have fallen on the table round the jug, lying where they dropped. */
function addFallen(ribbons: ReturnType<typeof strokeRibbons>) {
  const n = worldRandom(30);
  const colors = pal(["#e8b030", "#d88a20", "#c87018", "#f0c040", "#b8781e"]);
  for (const p of FALLEN) {
    const dir = new THREE.Vector3(Math.cos(p.angle), 0, Math.sin(p.angle));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const w = 0.9 + n() * 0.4;
    const curl = 0.2 + n() * 0.5;
    const rows: THREE.Vector3[][] = [];
    for (let j = 0; j <= 4; j++) {
      const t = j / 4;
      const ww = w * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)));
      const c = new THREE.Vector3(p.x, 0.04 + curl * (t - 0.5) ** 2 * 2, p.z).addScaledVector(
        dir,
        (t - 0.5) * p.len,
      );
      rows.push([
        c.clone().addScaledVector(side, -ww / 2),
        c.clone().add(new THREE.Vector3(0, 0.1, 0)),
        c.clone().addScaledVector(side, ww / 2),
      ]);
    }
    const col = pick(colors, n);
    ribbons.add(rows, asColor(col), n(), n(), (j) => j * 0.2);
  }
}

export const createSunflowersScene: SceneMaker = async (canvas, { low }) => {
  const stage = createStage(canvas, { low, fog: { color: "#efe0a0", density: 0.0011 } });
  const { scene, keep } = stage;

  // An afternoon in Arles: warm light all round, the sun from the left through a window.
  scene.add(new THREE.HemisphereLight("#fff2c8", "#8a6a3a", 0.75));
  const sun = new THREE.DirectionalLight("#fff4dc", 1.05);
  sun.position.set(-0.6, 0.7, 0.55);
  scene.add(sun);

  await addSky(stage, roomAir(), [-0.5, 0.6, 0.62]);
  await addWall(stage);

  const ground = await addGround(stage, {
    heightAt,
    full: { x0: -260, x1: 260, z0: -75, z1: 200 },
    // Where the visitor walks: the table round the jug.
    near: { x0: -110, x1: 110, z0: -75, z1: 95 },
    segments: { low: [104, 55], high: [208, 110] },
    land: tableTop(),
    far: { px: [2048, 3072], count: [10000, 26000], minLen: 3, height: 6, seed: 76 },
    fine: { px: [1536, 3072], count: [16000, 44000], minLen: 0, height: 4, seed: 77 },
  });

  // Every raised stroke on the jug, the flowers and the table, drawn as one.
  const ribbons = strokeRibbons();
  await addJug(stage, ribbons);
  await addFlowers(stage, ribbons);
  addFallen(ribbons);
  scene.add(
    new THREE.Mesh(
      keep(ribbons.geometry()),
      await strokeMaterial(stage, 0.3, { twoSided: true, dark: 0.8 }),
    ),
  );

  return stage.finish({
    ground,
    walkable: (x, z) => insideBounds(x, z, 0.5) && !blocked(x, z),
  });
};
