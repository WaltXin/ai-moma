import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldRandom } from "@/lib/worlds/random";
import {
  CHURCH,
  CYPRESS,
  CYPRESS_BUSHES,
  FOLIAGE,
  LAND,
  MOON,
  OLIVES,
  RIDGES,
  SKY,
  STARS,
  START,
  VILLAGE,
  WIND,
  blocked,
  grassAt,
  heightAt,
  insideBounds,
  landFlow,
  ridgeAt,
  skyFlow,
  swirlAt,
} from "@/lib/worlds/starry-night";
import { glow, lerp, rgb, type SkySpec } from "./brush";
import {
  C,
  addBushes,
  addFlameTree,
  addGrass,
  addGround,
  addRidges,
  addSky,
  createStage,
  pickRGB,
  skyDir,
  smooth,
  type LandPaint,
  type SceneMaker,
  type Stage,
} from "./kit";

/**
 * The Starry Night, raised with the world kit: a painted sky whose strokes
 * keep moving along their swirls, blue hills ridge behind ridge, a village
 * with a few lit windows and the cypress swaying. On the hilltop, grass
 * stands up out of the paint and bows as the wind crosses it, olives and the
 * cypress's bushes give the visitor something to walk round, and fireflies
 * drift over the grass. Nobody else is on the hill: it's yours to stand in,
 * or sit in the grass and look up. Nothing in it reacts to the visitor.
 */

/** The navy every outline in the village is inked in. */
const INK = "#0d1838";

/** The night sky: ultramarine with pale swirls, eleven stars in their halos, the moon in its ring. */
function nightSky(): SkySpec {
  const swirl = SKY.swirl.map(rgb);
  const halo = SKY.halo.map(rgb);
  const starC = SKY.star.map(rgb);
  const moonC = SKY.moon.map(rgb);
  return {
    seed: 1889,
    tones: [
      [0, SKY.horizon],
      [0.16, SKY.low],
      [0.42, SKY.high],
      [1, SKY.zenith],
    ],
    swirl: SKY.swirl,
    deep: SKY.deep,
    seam: "#0c1c4a",
    seamChance: 0.12,
    strokes: 70000,
    underStrokes: 9000,
    flow: skyFlow,
    swirlAt,
    lights: [
      ...STARS.map((s) => ({
        az: s.az,
        el: s.el,
        reach: 0.06 * s.size,
        tint: (d: number, pick: <T>(xs: T[]) => T) =>
          d < 0.45 ? pick(starC) : d < 0.75 ? lerp(pick(starC), pick(halo), 0.6) : pick(halo),
        rings: {
          radius: 0.05 * s.size,
          colors: [starC, [...starC, ...halo], halo, [...halo, ...swirl]],
          dab: 0.012,
        },
        core: { radius: 0.016 * s.size, inner: "#fffdf0", outer: "rgba(248,226,122,0)" },
        glow: { color: "rgba(255,246,196,0.9)", size: 0.1 * s.size, base: 0.32 * s.size },
      })),
      {
        az: MOON.az,
        el: MOON.el,
        reach: MOON.size * 1.6,
        tint: (d: number, pick: <T>(xs: T[]) => T) =>
          d < 0.5 ? pick(moonC) : lerp(pick(moonC), starC[1], 0.5),
        rings: {
          radius: MOON.size * 1.45,
          colors: [
            moonC,
            [moonC[0], moonC[1], starC[1]],
            [starC[1], starC[3]],
            [...halo, starC[1]],
          ],
          dab: 0.016,
        },
        // An orange disc, and a lemon crescent on it.
        core: { radius: MOON.size * 0.75, inner: SKY.moon[1], outer: "rgba(224,125,34,0)" },
        draw(g, { x, y, pxPerRad }) {
          const mr = MOON.size * 0.5 * pxPerRad;
          g.save();
          g.beginPath();
          g.arc(x, y, mr, 0, Math.PI * 2);
          g.clip();
          g.fillStyle = SKY.moon[0];
          g.fillRect(x - mr, y - mr, mr * 2, mr * 2);
          g.fillStyle = SKY.moon[2];
          g.beginPath();
          g.arc(x + mr * 0.55, y - mr * 0.25, mr * 0.95, 0, Math.PI * 2);
          g.fill();
          g.restore();
        },
        glow: {
          color: "rgba(250,190,80,0.85)",
          size: MOON.size * 3.2,
          base: 0.4,
          phase: 0,
          speed: 0.25,
        },
      },
    ],
  };
}

/** The land at night: the hill in greens and ochre, the valley blue, fields round the village, the far land rising. */
function nightLand(): LandPaint {
  const LANDC = {
    hill: LAND.hill.map(rgb),
    valley: LAND.valley.map(rgb),
    fields: LAND.fields.map(rgb),
    far: LAND.far.map(rgb),
    seam: rgb(LAND.seam),
    wash: {
      hill: rgb(LAND.wash.hill),
      valley: rgb(LAND.wash.valley),
      far: rgb(LAND.wash.far),
    },
  };
  const hillness = (x: number, z: number) =>
    1 - smooth(Math.hypot(x / 60, (z + 4) / 40), 0.85, 1.35);
  const farness = (z: number) => smooth(-z, 260, 420);
  const isField = (x: number, z: number) =>
    Math.sin(x * 0.045 + 1.7) * Math.sin(z * 0.06 + 0.4) > 0.35 &&
    Math.hypot((x - CHURCH.x) / 120, (z - CHURCH.z) / 45) > 0.7;
  return {
    wash: (x, z) =>
      lerp(lerp(LANDC.wash.valley, LANDC.wash.far, farness(z)), LANDC.wash.hill, hillness(x, z)),
    // Strokes grow with distance from the hilltop, so each looks about the same size from up there.
    size: (x, z) => Math.min(12, 0.8 + Math.hypot(x - START.x, z - START.z) * 0.03),
    flow: landFlow,
    paint: (x, z, r) => {
      if (r() < 0.08) return { color: LANDC.seam, relief: 0.2 };
      const relief = 0.5 + r() * 0.45;
      if (r() < hillness(x, z)) return { color: pickRGB(LANDC.hill, r), relief };
      if (r() < farness(z)) return { color: pickRGB(LANDC.far, r), relief };
      if (isField(x, z) && r() < 0.75) return { color: pickRGB(LANDC.fields, r), relief };
      return { color: pickRGB(LANDC.valley, r), relief };
    },
  };
}

/**
 * Fireflies over the grass: a few dabs of the stars' lemon, each drifting
 * round its own spot on the hill and glowing now and then. They're small and
 * near, so walking moves them against the village and the sky.
 */
function addFireflies(stage: Stage) {
  const { low, keep, scene, time, renderer } = stage;
  const n = worldRandom(77);
  const COUNT = low ? 28 : 64;
  const at: number[] = [];
  const seed: number[] = [];
  for (let tries = 0; at.length < COUNT * 3 && tries < COUNT * 40; tries++) {
    const x = (n() - 0.5) * 96;
    const z = -4 + (n() - 0.5) * 64;
    if (n() > grassAt(x, z)) continue;
    at.push(x, heightAt(x, z) + 0.35 + n() * n() * 2.2, z);
    seed.push(n() * 6.283, 0.25 + n() * 0.4, 0.5 + n() * 0.8, n());
  }
  const g = keep(new THREE.BufferGeometry());
  g.setAttribute("position", new THREE.Float32BufferAttribute(at, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 4));
  // They wander a few metres from where they're listed; never cull them by that.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 30, -4), 80);
  const size = { value: 1 };
  const mat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uTime: time, uSize: size },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uSize;
        varying float vGlow;
        void main() {
          float t = uTime * aSeed.y + aSeed.x;
          // Each wanders a slow, lopsided loop round its own spot.
          vec3 p = position + vec3(
            sin(t) * 1.6 + sin(t * 0.37 + aSeed.x) * 2.2,
            sin(t * 1.3 + aSeed.x * 2.0) * 0.35,
            cos(t * 0.8) * 1.6 + cos(t * 0.29 + aSeed.x) * 2.2);
          // Lit for a breath, dark for longer, each in its own time.
          float beat = sin(uTime * aSeed.z + aSeed.x * 3.0);
          vGlow = smoothstep(0.35, 0.95, beat) * (0.6 + 0.4 * aSeed.w);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(uSize * (0.16 + 0.1 * aSeed.w) / -mv.z, 64.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vGlow;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          // A hot dab, and a soft light round it.
          float a = smoothstep(1.0, 0.0, d);
          float core = smoothstep(0.32, 0.1, d);
          vec3 col = mix(vec3(0.82, 0.86, 0.36), vec3(1.0, 0.98, 0.78), core);
          gl_FragColor = vec4(col * (a * a * 0.55 + core) * vGlow, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  const flies = new THREE.Points(g, mat);
  scene.add(flies);
  const buffer = new THREE.Vector2();
  stage.onFrame(() => {
    // A point's size is given in pixels: keep it the same size in the world on any screen.
    size.value = renderer.getDrawingBufferSize(buffer).y;
  });
}

export const createStarryNightScene: SceneMaker = async (canvas, { low }) => {
  const stage = createStage(canvas, { low, fog: { color: "#2b4c8f", density: 0.0011 } });
  const { scene, keep, texture, painted, paintColor, outline, worldUV } = stage;

  // Moonlight from top right, and the blue of the night all round.
  scene.add(new THREE.HemisphereLight("#8aa6de", "#16213d", 1.05));
  const moonLight = new THREE.DirectionalLight("#f6e9b4", 1.15);
  moonLight.position.copy(skyDir(MOON.az, MOON.el));
  scene.add(moonLight);
  // A soft light from behind the visitor, as a painter lights what faces them, so walls and trees aren't lost.
  const fill = new THREE.DirectionalLight("#9fb4e0", 0.55);
  fill.position.set(0.25, 0.6, 1);
  scene.add(fill);

  // The sky's paint is lit from the upper right, where the moon is.
  await addSky(stage, nightSky(), [0.55, 0.5, 0.67]);

  // ── The ground: the hill underfoot, the valley, the land rising far off, all painted ──
  const ground = await addGround(stage, {
    heightAt,
    // Far enough behind the hill that its edge stays under the brow, wherever the visitor stands.
    full: { x0: -550, x1: 550, z0: -500, z1: 270 },
    // The hilltop gets its own, finer canvas: it's where the visitor looks down at their feet.
    near: { x0: -70, x1: 70, z0: -60, z1: 40 },
    segments: { low: [120, 84], high: [220, 154] },
    land: nightLand(),
    far: { px: [2048, 4096], count: [19000, 55000], minLen: 3.5, height: 6, seed: 21 },
    fine: { px: [1536, 3072], count: [14000, 42000], minLen: 0, height: 4, seed: 22 },
  });

  // ── The hills: curtains of blue, ridge behind ridge ──
  await addRidges(
    stage,
    RIDGES.map((r) => ({
      z: r.z,
      top: (x) => ridgeAt(r, x),
      bottom: (x) => heightAt(x, r.z) - 12,
      color: r.color,
      seed: r.seed,
    })),
    {
      rim: "#a9c0e0",
      shadow: "#13285a",
      seam: "#1a2f66",
      tints: ["#2a4a8a", "#5a6fb0", "#3f6f8a", "#6a6aa8", "#8fa8d0"],
    },
  );

  // ── The village ──
  const windowGlow = texture(glow(64, "rgba(255,196,96,0.55)"), false);
  const wallTile = await stage.tile("wall", {
    angle: 0,
    wave: 0.15,
    len: 6,
    width: 26,
    seed: 12,
    dark: 0.65,
  });
  const walls: THREE.BufferGeometry[] = [];
  const roofs: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const glowAt: number[] = [];
  // Pale walls, blue in the moonlight, now and then ochre; roofs darker, a few of them tiled orange.
  const wallColors = ["#7f93b8", "#8fa0bf", "#a5a99a", "#6c82ad", "#b0a77e", "#5d72a3"];
  const roofColors = ["#3d5a94", "#4a6aa6", "#2f4c86", "#b07a3e", "#5b6fa0", "#36507f"];
  // Dark outlines round each house, drawn as its own shape grown a little and turned inside out.
  const outlines: THREE.BufferGeometry[] = [];

  const n = worldRandom(31);
  // Chimneys draw from their own numbers, so the village stays as it was laid out.
  const chim = worldRandom(53);
  const prism = (w: number, d: number, rise: number) => {
    // A pitched roof along the house's width, with a little overhang.
    const hw = w / 2 + 0.3;
    const hd = d / 2 + 0.35;
    const v = [
      [-hw, 0, -hd],
      [hw, 0, -hd],
      [hw, rise, 0],
      [-hw, rise, 0],
      [hw, 0, hd],
      [-hw, 0, hd],
      [-hw, rise, 0],
      [hw, rise, 0],
    ];
    const g = new THREE.BufferGeometry();
    const pos = [
      ...v[0],
      ...v[1],
      ...v[2],
      ...v[0],
      ...v[2],
      ...v[3], // back slope
      ...v[4],
      ...v[5],
      ...v[6],
      ...v[4],
      ...v[6],
      ...v[7], // front slope
      -hw,
      0,
      -hd,
      -hw,
      rise,
      0,
      -hw,
      0,
      hd, // left gable
      hw,
      0,
      hd,
      hw,
      rise,
      0,
      hw,
      0,
      -hd, // right gable
    ];
    // Listed inside out; turn each triangle round so its faces point outward.
    for (let i = 0; i < pos.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const t = pos[i + 3 + k];
        pos[i + 3 + k] = pos[i + 6 + k];
        pos[i + 6 + k] = t;
      }
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  };
  const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, rot: number) => {
    // Texture coordinates are given after merging, in metres.
    if (g.attributes.uv) g.deleteAttribute("uv");
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z));
    return g;
  };
  const house = (
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    rot: number,
    rise: number,
    windows: { u: number; v: number }[],
    wallHex: string,
    roofHex: string,
  ) => {
    const y =
      Math.min(
        heightAt(x - w / 2, z),
        heightAt(x + w / 2, z),
        heightAt(x, z - d / 2),
        heightAt(x, z + d / 2),
      ) - 0.3;
    const body = new THREE.BoxGeometry(w, h + 0.3, d).toNonIndexed();
    body.translate(0, (h + 0.3) / 2, 0);
    const roof = prism(w, d, rise);
    roof.translate(0, h + 0.3, 0);
    outlines.push(
      place(outline(body, 1.07), x, y, z, rot),
      place(outline(roof, 1.07), x, y, z, rot),
    );
    walls.push(paintColor(place(body, x, y, z, rot), C(wallHex)));
    roofs.push(paintColor(place(roof, x, y, z, rot), C(roofHex)));
    // Most houses have a chimney, standing through the roof to one side of the ridge.
    if (chim() < 0.7) {
      const cw = 0.7 + chim() * 0.3;
      const stack = new THREE.BoxGeometry(cw, rise + 1.1, cw).toNonIndexed();
      stack.translate(
        (chim() - 0.5) * w * 0.6,
        h + 0.3 + (rise + 1.1) / 2,
        (chim() - 0.5) * d * 0.3,
      );
      outlines.push(place(outline(stack, 1.12), x, y, z, rot));
      walls.push(paintColor(place(stack, x, y, z, rot), C(wallHex).multiplyScalar(0.8)));
    }
    for (const win of windows) {
      const pane = new THREE.PlaneGeometry(0.8, 1.0).toNonIndexed();
      const lx = (win.u - 0.5) * w;
      const ly = 0.3 + win.v * h;
      pane.translate(lx, ly, d / 2 + 0.03);
      lights.push(paintColor(place(pane, x, y, z, rot), C(n() < 0.3 ? "#ffb347" : "#ffe27a")));
      // Where the window's warm light spills out into the night.
      glowAt.push(
        x + Math.cos(rot) * lx + Math.sin(rot) * (d / 2 + 0.4),
        y + ly,
        z - Math.sin(rot) * lx + Math.cos(rot) * (d / 2 + 0.4),
      );
    }
  };
  for (const h of VILLAGE.houses) {
    house(
      h.x,
      h.z,
      h.w,
      h.d,
      h.h,
      h.rot,
      h.roof,
      h.windows,
      wallColors[Math.floor(n() * wallColors.length)],
      roofColors[Math.floor(n() * roofColors.length)],
    );
  }
  // The church: a long nave, a tower at its front, and the spire reaching up past the hills.
  house(
    CHURCH.x,
    CHURCH.z,
    CHURCH.w,
    CHURCH.d,
    CHURCH.h,
    CHURCH.rot,
    3.5,
    [{ u: 0.5, v: 0.45 }],
    "#2c3c72",
    "#4c6698",
  );
  {
    const tx = CHURCH.x + Math.sin(CHURCH.rot) * (CHURCH.d / 2 + 1.5);
    const tz = CHURCH.z + Math.cos(CHURCH.rot) * (CHURCH.d / 2 + 1.5);
    const y = heightAt(tx, tz) - 0.3;
    const tower = new THREE.BoxGeometry(3.6, CHURCH.h + 7, 3.6).toNonIndexed();
    tower.translate(0, (CHURCH.h + 7) / 2, 0);
    walls.push(paintColor(place(tower, tx, y, tz, CHURCH.rot), C("#24346a")));
    const spire = new THREE.ConeGeometry(2.3, CHURCH.spire, 8).toNonIndexed();
    spire.translate(0, CHURCH.h + 7 + CHURCH.spire / 2, 0);
    roofs.push(paintColor(place(spire, tx, y, tz, CHURCH.rot), C("#2a3c74")));
  }
  const wallGeo = keep(worldUV(mergeGeometries(walls), 5));
  const roofGeo = keep(worldUV(mergeGeometries(roofs), 5));
  const ink = stage.ink(INK);
  scene.add(new THREE.Mesh(keep(mergeGeometries(outlines)), ink));
  outlines.forEach((g) => g.dispose());
  scene.add(new THREE.Mesh(wallGeo, painted(wallTile, 1)));
  scene.add(new THREE.Mesh(roofGeo, painted(wallTile, 1)));
  scene.add(
    new THREE.Mesh(
      keep(mergeGeometries(lights)),
      keep(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })),
    ),
  );
  [...walls, ...roofs, ...lights].forEach((g) => g.dispose());
  {
    // The light spilling from the windows wavers, as lamplight does: three lots, each in its own time.
    const LOTS = 3;
    const lamps: THREE.PointsMaterial[] = [];
    for (let k = 0; k < LOTS; k++) {
      const lot: number[] = [];
      for (let i = k * 3; i < glowAt.length; i += LOTS * 3) lot.push(...glowAt.slice(i, i + 3));
      if (!lot.length) continue;
      const pg = keep(new THREE.BufferGeometry());
      pg.setAttribute("position", new THREE.Float32BufferAttribute(lot, 3));
      const lamp = keep(
        new THREE.PointsMaterial({
          map: windowGlow,
          size: 6,
          sizeAttenuation: true,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      lamps.push(lamp);
      scene.add(new THREE.Points(pg, lamp));
    }
    stage.onFrame(() => {
      const t = stage.time.value;
      for (const [k, lamp] of lamps.entries())
        lamp.opacity =
          0.8 + 0.14 * Math.sin(t * (1.1 + k * 0.45) + k * 2) + 0.06 * Math.sin(t * (5.3 + k));
    });
  }

  // Dark trees round the village and along the valley: each a few lumps of flickering strokes.
  await addBushes(stage, {
    bushes: VILLAGE.trees,
    heightAt,
    rand: n,
    dark: FOLIAGE.dark,
    edge: FOLIAGE.edge,
    litSide: 1,
    edgeChance: 0.35,
    ink: INK,
    glow: 0.3,
    // Seen from the hill, a stroke has to be metres long to read as one.
    strokes: {
      perSquareMetre: [0.1, 0.24],
      len: [2.4, 4.4],
      width: [0.9, 1.6],
      under: ["#0c1f24", "#10262a", "#0e2220"],
    },
  });

  // ── The hilltop: the bushes the cypress rises from, and olives to walk round ──
  await addBushes(stage, {
    bushes: CYPRESS_BUSHES,
    heightAt,
    rand: worldRandom(34),
    dark: FOLIAGE.dark,
    edge: FOLIAGE.edge,
    litSide: 1,
    edgeChance: 0.4,
    ink: INK,
    glow: 0.35,
    strokes: {
      perSquareMetre: [2, 4.2],
      len: [0.6, 1.2],
      width: [0.26, 0.46],
      under: ["#0c1f24", "#10262a", "#0e2220"],
    },
  });
  // Olives at night: grey-green, silvered on the side the moon is on.
  await addBushes(stage, {
    bushes: OLIVES,
    heightAt,
    rand: worldRandom(35),
    dark: ["#1f4038", "#27504a", "#2a4a3a", "#1d3f4a", "#31584a"],
    edge: ["#6f9a86", "#8fb0a8", "#7a9a6a", "#a8c0b0", "#5f8a8a"],
    litSide: 1,
    edgeChance: 0.6,
    ink: INK,
    glow: 0.38,
    stems: ["#1c2a33", "#27323a", "#2f3630", "#182430"],
    strokes: {
      perSquareMetre: [1.8, 3.8],
      len: [0.7, 1.4],
      width: [0.3, 0.52],
      under: ["#10262a", "#142c2a", "#0e2220"],
    },
  });

  // ── The grass: strokes standing up out of the hill's paint, bowing in the wind ──
  await addGrass(stage, {
    area: { x0: -62, x1: 62, z0: -46, z1: 38 },
    heightAt,
    densityAt: grassAt,
    perSquareMetre: [1.4, 3.6],
    blades: [3, 5],
    length: [0.22, 0.52],
    width: [0.035, 0.07],
    // Strokes grow with distance from where the visitor comes in, as the ground's do.
    scaleAt: (x, z) => 1 + Math.max(0, Math.hypot(x - START.x, z - START.z) - 14) * 0.035,
    colors: LAND.hill,
    tips: ["#9aab58", "#a8944a", "#7fb08a", "#b8c078", "#8fb0a0"],
    tipChance: 0.3,
    wind: WIND,
    push: 0.34,
    glow: 0.38,
    seed: 88,
  });

  addFireflies(stage);

  // ── The cypress: tongues of dark flame twisting up round one another ──
  await addFlameTree(stage, {
    x: CYPRESS.x,
    y: heightAt(CYPRESS.x, CYPRESS.z) - 0.4,
    z: CYPRESS.z,
    height: CYPRESS.height,
    radius: CYPRESS.radius,
    seed: 42,
    tongues: [22, 30],
    strokes: [2000, 4200],
    under: ["#132a1e", "#183022", "#1a3029"],
    dark: ["#2f5a35", "#3a6640", "#447048", "#2f5f55", "#4f522c", "#2a4a45"],
    edge: ["#6f8f48", "#8f8a44", "#7a9a58", "#9a7036", "#9aab58", "#a8944a", "#4f8a72"],
    litFrom: Math.PI * 0.75,
  });

  return stage.finish({
    ground,
    walkable: (x, z) => insideBounds(x, z, 0.5) && !blocked(x, z),
  });
};
