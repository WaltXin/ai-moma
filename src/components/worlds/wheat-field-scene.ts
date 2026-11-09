import * as THREE from "three";
import {
  CYPRESSES,
  FIELD_HALF_WIDTH,
  OLIVE,
  RIDGES,
  SHRUBS,
  SKY,
  START,
  WHEAT_HEIGHT,
  blocked,
  cloudAt,
  fieldBack,
  fieldFlow,
  fieldFront,
  heightAt,
  insideBounds,
  pathX,
  ridgeAt,
  skyFlow,
  wheatAt,
} from "@/lib/worlds/wheat-field";
import { worldRandom } from "@/lib/worlds/random";
import { lerp, rgb, type SkySpec } from "./brush";
import {
  addBushes,
  addFlameTree,
  addGround,
  addRidges,
  addSky,
  bristleTile,
  createStage,
  glowInShade,
  paintGround,
  pickRGB,
  smooth,
  withBristles,
  type LandPaint,
  type Rect,
  type SceneMaker,
  type Stage,
} from "./kit";

/**
 * Wheat Field with Cypresses, raised with the world kit: a summer sky of
 * cream clouds wheeling over the Alpilles, two cypresses, a silver olive
 * bush, and the wheat itself, ripe and rolling in the wind, hip-high so
 * the visitor can wade into it. The grass at its edge is full of poppies.
 */

const pal = (xs: string[]) => xs.map(rgb);

/** The summer sky: pale cerulean and turquoise, thick cream clouds curling, no sun in sight. */
function summerSky(): SkySpec {
  return {
    seed: 1890,
    tones: SKY.tones,
    swirl: SKY.cloud,
    deep: SKY.deep,
    seam: SKY.seam,
    seamChance: 0.07,
    strokes: 58000,
    strokeScale: 1.35,
    // Clouds all the way round: the visitor turns to look at them.
    ahead: 0.5,
    underStrokes: 7000,
    flow: skyFlow,
    swirlAt: cloudAt,
    lights: [],
  };
}

/** The land: grass and poppies before the wheat, greens and ochre behind it, the valley, the far blue land. */
function summerLand(): LandPaint {
  const grass = pal(["#4f8a3a", "#6aa04a", "#3f7a40", "#8ab858", "#5a9a5a", "#7aa84a", "#2f6a3a"]);
  const poppies = pal(["#d83a28", "#e85a3a", "#c82a20"]);
  const daisies = pal(["#f2ece0", "#e8e0f0"]);
  const path = pal(["#c8c08a", "#b8b07a", "#d8d0a0", "#a8b088"]);
  const under = pal(["#a8862a", "#8a6a20"]);
  const band = pal(["#3f7a3a", "#5a8a3a", "#2f6a40", "#6a9a4a", "#4a8a5a"]);
  const strip = pal(["#d8c070", "#c8b060", "#e0d090"]);
  const valley = pal(["#6a9a6a", "#5a8a7a", "#7aa08a", "#8ab0a0", "#9ab070", "#6a8f9a"]);
  const far = pal(["#6a8fa8", "#7a9ab8", "#5a7a9a", "#8aa6c0"]);
  const seamGreen = rgb("#2f4a2a");
  const seamBlue = rgb("#4a6a7a");
  const wash = {
    grass: rgb("#4a8038"),
    band: rgb("#3f7038"),
    valley: rgb("#6a907a"),
    far: rgb("#6a8aa8"),
  };
  const farness = (z: number) => smooth(-z, 280, 360);
  const valleyness = (z: number) => smooth(-z, 115, 140);
  const onPath = (x: number, z: number) =>
    z > fieldFront(x) && Math.abs(x - pathX(z)) < 1.1 + 0.3 * Math.sin(z * 0.5);
  const onStrip = (x: number, z: number) =>
    z < fieldBack(x) - 18 && z > fieldBack(x) - 30 && Math.sin(x * 0.02 + 1) > -0.3;
  return {
    wash: (x, z) =>
      lerp(
        lerp(z > fieldFront(x) ? wash.grass : wash.band, wash.valley, valleyness(z)),
        wash.far,
        farness(z),
      ),
    size: (x, z) => Math.min(14, 0.6 + Math.hypot(x - START.x, z - START.z) * 0.032),
    flow: fieldFlow,
    paint: (x, z, r) => {
      const relief = 0.5 + r() * 0.45;
      if (r() < farness(z)) return { color: pickRGB(far, r), relief };
      if (r() < valleyness(z)) {
        if (r() < 0.07) return { color: seamBlue, relief: 0.2 };
        return { color: pickRGB(valley, r), relief };
      }
      if (r() < 0.07) return { color: seamGreen, relief: 0.2 };
      if (z > fieldFront(x)) {
        if (onPath(x, z)) return { color: pickRGB(path, r), relief };
        // Poppies, and now and then a daisy, in the grass at the wheat's edge.
        const flowers = r();
        if (flowers < 0.09) return { color: pickRGB(poppies, r), relief: 1, scale: 0.55 };
        if (flowers < 0.11) return { color: pickRGB(daisies, r), relief: 0.95, scale: 0.45 };
        return { color: pickRGB(grass, r), relief };
      }
      if (wheatAt(x, z) > 0) return { color: pickRGB(under, r), relief };
      if (onStrip(x, z)) return { color: pickRGB(strip, r), relief };
      return { color: pickRGB(band, r), relief };
    },
  };
}

/** The wheat's paint: gold and ochre in rolling waves, a little green, a little rust, dark seams. */
function wheatPaint(): LandPaint {
  const gold = pal([
    "#d9b44a",
    "#e6c35a",
    "#c99a32",
    "#b8862a",
    "#e8cf72",
    "#a8782a",
    "#c8a040",
    "#d8a838",
  ]);
  const green = pal(["#8a9a40", "#9aa848", "#7a8a3a"]);
  const rust = pal(["#c8702a", "#b86a2a"]);
  const seam = rgb("#7a5a1a");
  return {
    wash: () => rgb("#c09034"),
    size: (x, z) => Math.min(5, 0.5 + Math.hypot(x - START.x, z - START.z) * 0.022),
    flow: fieldFlow,
    paint: (_x, _z, r) => {
      const k = r();
      if (k < 0.08) return { color: seam, relief: 0.2 };
      if (k < 0.14) return { color: pickRGB(green, r), relief: 0.6 + r() * 0.3 };
      if (k < 0.18) return { color: pickRGB(rust, r), relief: 0.6 + r() * 0.3 };
      return { color: pickRGB(gold, r), relief: 0.55 + r() * 0.45 };
    },
  };
}

/**
 * The wheat: a painted surface standing hip-high over the ground wherever the
 * field is, rounding down at its edges, rolling as the wind goes through it.
 * The visitor wades through it; sitting, their eyes are just above it.
 */
async function addWheat(stage: Stage) {
  const { low, keep, paintTextures, painted, paintColor, scene, time } = stage;
  const R: Rect = { x0: -FIELD_HALF_WIDTH, x1: FIELD_HALF_WIDTH, z0: -56, z1: 1 };
  const g = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0, low ? 95 : 190, low ? 30 : 57);
  g.rotateX(-Math.PI / 2);
  g.translate((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  const p = g.attributes.position;
  const mask = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    mask[i] = wheatAt(x, z);
    // A hair above the ground at the very edge, so the two never flicker into each other.
    p.setY(i, heightAt(x, z) + 0.03 + WHEAT_HEIGHT * mask[i]);
  }
  g.setAttribute("aMask", new THREE.BufferAttribute(mask, 1));
  // Only where there's wheat.
  const index = g.index!;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (Math.max(mask[a], mask[b], mask[c]) > 0.001) kept.push(a, b, c);
  }
  g.setIndex(kept);
  g.computeVertexNormals();
  paintColor(g, new THREE.Color("#ffffff"));

  const paint = await paintTextures(
    paintGround(R, wheatPaint(), low ? 2048 : 4096, low ? 22000 : 60000, 0, 71, { aspect: 0.26 }),
    false,
    5,
  );
  const mat = withBristles(painted(paint, 1.2), await bristleTile(stage), 1.2, {
    key: "wheat",
    change: (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader =
        `attribute float aMask;\nuniform float uTime;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          // The wind going through the wheat in long waves.
          transformed.y += aMask * (0.05 * sin(uTime * 1.4 + position.x * 0.18 + position.z * 0.35)
            + 0.03 * sin(uTime * 0.8 - position.x * 0.07));`,
        );
      glowInShade(shader, 0.12);
    },
  });
  scene.add(new THREE.Mesh(keep(g), mat));
}

export const createWheatFieldScene: SceneMaker = async (canvas, { low }) => {
  const stage = createStage(canvas, { low, fog: { color: "#c8d8e8", density: 0.0009 } });
  const { scene } = stage;

  // A summer day: the sky's blue all round, and the sun high on the left, a little behind.
  scene.add(new THREE.HemisphereLight("#e6eef8", "#7a8a50", 0.95));
  const sun = new THREE.DirectionalLight("#fff1d6", 1.25);
  sun.position.set(-0.5, 0.75, 0.45);
  scene.add(sun);

  // The clouds' paint is lit from the upper left, where the sun is.
  await addSky(stage, summerSky(), [-0.5, 0.6, 0.62]);

  const ground = await addGround(stage, {
    heightAt,
    full: { x0: -500, x1: 500, z0: -600, z1: 300 },
    // Where the visitor walks, and well round it: the grass and the wheat.
    near: { x0: -110, x1: 110, z0: -64, z1: 70 },
    segments: { low: [100, 90], high: [200, 180] },
    land: summerLand(),
    far: { px: [2048, 3072], count: [16000, 46000], minLen: 3.5, height: 6, seed: 61 },
    fine: { px: [1536, 3072], count: [14000, 42000], minLen: 0, height: 4, seed: 62 },
  });

  await addWheat(stage);

  // The Alpilles: green-blue foothills, the blue-violet peaks catching white light, the far range palest.
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
      rim: "#f2f4f8",
      shadow: "#4f62a8",
      seam: "#4a5a9a",
      tints: ["#7a8ad0", "#5a6ab0", "#8aa0d8", "#9a90c8", "#6a9ab8", "#c8d4ec"],
    },
  );

  // The sun is on the left: in a tree's own turn, that's this way round.
  const litFrom = Math.atan2(-0.5, 0.45);
  // The olive: a billowing mass of silver-green strokes, its sunlit side almost white.
  await addBushes(stage, {
    bushes: OLIVE,
    heightAt,
    rand: worldRandom(63),
    dark: ["#8fae86", "#7a9f78", "#a0bb94", "#6f9a72", "#aac4a0", "#5f8a66"],
    edge: ["#d0dcc0", "#b8cca8", "#e4e8d4", "#c0d4b0", "#eef0e0"],
    litSide: -1,
    edgeChance: 0.85,
    ink: "#2f4a32",
    glow: 0.4,
    strokes: {
      perSquareMetre: [1.8, 3.8],
      len: [0.9, 1.8],
      width: [0.35, 0.6],
      under: ["#4a6a50", "#56765a", "#4f6f55"],
    },
  });
  // Round green bushes, emerald where the sun catches them.
  await addBushes(stage, {
    bushes: SHRUBS,
    heightAt,
    rand: worldRandom(64),
    dark: ["#1f5a2a", "#2a6a3a", "#2f7a3a", "#246a44"],
    edge: ["#5aa050", "#7ab860", "#4a9a5a", "#9ac070"],
    litSide: -1,
    edgeChance: 0.55,
    ink: "#14301c",
    glow: 0.35,
    strokes: {
      perSquareMetre: [1.4, 3],
      len: [0.6, 1.2],
      width: [0.3, 0.5],
      under: ["#0f2a18", "#14321e"],
    },
  });

  // The two cypresses, deep green flames against the clouds.
  for (const [i, c] of CYPRESSES.entries()) {
    await addFlameTree(stage, {
      x: c.x,
      y: heightAt(c.x, c.z) - 0.4,
      z: c.z,
      height: c.height,
      radius: c.radius,
      seed: c.seed,
      tongues: i === 0 ? [24, 34] : [18, 24],
      strokes: i === 0 ? [2400, 5200] : [1400, 3000],
      under: ["#0c2416", "#10301c", "#0f2a20"],
      dark: ["#1f5a2a", "#2a6a32", "#245e3a", "#1a4a2a", "#2f7040", "#2a5a30"],
      edge: ["#4f9a48", "#6aaa50", "#3a8a5a", "#7ab060", "#8a9a40", "#5ab070"],
      litFrom,
    });
  }

  return stage.finish({
    ground,
    walkable: (x, z) => insideBounds(x, z, 0.5) && !blocked(x, z),
  });
};
