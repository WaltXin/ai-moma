import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldRandom } from "@/lib/worlds/random";
import {
  CHURCH,
  CYPRESS,
  FOLIAGE,
  LAND,
  MOON,
  RIDGES,
  STARS,
  START,
  VILLAGE,
  blocked,
  heightAt,
  insideBounds,
  landFlow,
  ridgeAt,
} from "@/lib/worlds/starry-night";
import {
  SKY_EL_MAX,
  SKY_EL_MIN,
  brushTile,
  glow,
  lerp,
  paintSky,
  paintSurface,
  reliefToNormals,
  rgb,
  skyFlowData,
  type Painted,
  type RGB,
} from "./brush";

/**
 * The Starry Night, raised in three.js: a painted sky whose strokes keep
 * moving along their swirls, blue hills ridge behind ridge, a village with a
 * few lit windows and the cypress swaying. Nobody else is on the hill:
 * it's yours to stand in, or sit in the grass and look up. Nothing in it
 * reacts to the visitor.
 */

export type View = { x: number; y: number; z: number; yaw: number; pitch: number };
export type WorldScene = {
  frame(view: View, dt: number): void;
  resize(w: number, h: number): void;
  /** The ground under a screen point (−1…1 on both axes), if it's on the walkable hilltop. */
  pick(nx: number, ny: number): { x: number; z: number } | null;
  dispose(): void;
};

const SKY_RADIUS = 1200;
const skyDir = (az: number, el: number) =>
  new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

export async function createStarryNightScene(
  canvas: HTMLCanvasElement,
  { low }: { low: boolean },
): Promise<WorldScene> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !low,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2));

  const trash: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    trash.push(x);
    return x;
  };
  const texture = (c: HTMLCanvasElement, repeat = true) => {
    const t = keep(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#2b4c8f", 0.0011);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, SKY_RADIUS * 2);
  camera.rotation.order = "YXZ";
  const time = { value: 0 };

  // Moonlight from top right, and the blue of the night all round.
  scene.add(new THREE.HemisphereLight("#8aa6de", "#16213d", 1.05));
  const moonLight = new THREE.DirectionalLight("#f6e9b4", 1.15);
  moonLight.position.copy(skyDir(MOON.az, MOON.el));
  scene.add(moonLight);
  // A soft light from behind the visitor, as a painter lights what faces them, so walls and trees aren't lost.
  const fill = new THREE.DirectionalLight("#9fb4e0", 0.55);
  fill.position.set(0.25, 0.6, 1);
  scene.add(fill);

  // ── The sky: one painted panorama, its strokes sliding along the flow ──
  const sky = new THREE.Group();
  scene.add(sky);
  const skyPaint = await paintSky(low ? 2048 : 4096);
  // Lets a browser console look at the skyPaint panorama while developing.
  if (process.env.NODE_ENV === "development")
    Object.assign(window, { __skyCanvas: skyPaint.color, __skyRelief: skyPaint.relief });
  const skyTex = texture(skyPaint.color, false);
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.generateMipmaps = false;
  skyTex.minFilter = THREE.LinearFilter;
  // How thick the paint stands: raw values, not a colour.
  const reliefTex = texture(skyPaint.relief, false);
  reliefTex.colorSpace = THREE.NoColorSpace;
  reliefTex.wrapS = THREE.RepeatWrapping;
  reliefTex.generateMipmaps = false;
  reliefTex.minFilter = THREE.LinearFilter;
  const texel = new THREE.Vector2(1 / skyPaint.color.width, 1 / skyPaint.color.height);
  const FW = 256;
  const FH = Math.round((FW * (SKY_EL_MAX - SKY_EL_MIN)) / (Math.PI * 2));
  const flowTex = keep(new THREE.DataTexture(skyFlowData(FW, FH), FW, FH, THREE.RGBAFormat));
  flowTex.flipY = true;
  flowTex.wrapS = THREE.RepeatWrapping;
  flowTex.magFilter = flowTex.minFilter = THREE.LinearFilter;
  flowTex.needsUpdate = true;
  const skyMat = keep(
    new THREE.ShaderMaterial({
      uniforms: {
        uSky: { value: skyTex },
        uRelief: { value: reliefTex },
        uFlow: { value: flowTex },
        uTexel: { value: texel },
        uTime: time,
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSky;
        uniform sampler2D uRelief;
        uniform sampler2D uFlow;
        uniform vec2 uTexel;
        uniform float uTime;
        varying vec3 vDir;
        const float PI = 3.14159265;
        const float EL_MIN = ${SKY_EL_MIN.toFixed(5)};
        const float EL_MAX = ${SKY_EL_MAX.toFixed(5)};
        // Light raking across the paint from the upper right, where the moon is.
        const vec3 LIGHT = vec3(${new THREE.Vector3(0.55, 0.5, 0.67)
          .normalize()
          .toArray()
          .map((v) => v.toFixed(4))
          .join(", ")});

        // The paint at a point, lit as if it stood up off the canvas.
        vec3 paint(vec2 uv) {
          vec3 col = texture2D(uSky, uv).rgb;
          float h = texture2D(uRelief, uv).r;
          float hx = texture2D(uRelief, uv + vec2(uTexel.x * 1.5, 0.0)).r;
          float hy = texture2D(uRelief, uv + vec2(0.0, uTexel.y * 1.5)).r;
          vec3 n = normalize(vec3((h - hx) * 2.2, (h - hy) * 2.2, 1.0));
          // Flat paint keeps its colour; slopes turn toward or away from the light.
          float lit = 0.35 + 0.65 * max(dot(n, LIGHT), 0.0) / LIGHT.z;
          // The wet sheen on a ridge that faces the light.
          float sheen = pow(max(dot(reflect(-LIGHT, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
          // Down in the grooves between strokes, less light reaches.
          float hollow = mix(0.62, 1.0, smoothstep(0.05, 0.5, h));
          return col * lit * hollow + sheen * 0.22 * (0.4 + col);
        }

        void main() {
          vec3 d = normalize(vDir);
          float az = atan(d.x, -d.z);
          float el = asin(clamp(d.y, -1.0, 1.0));
          vec2 uv = vec2(az / (2.0 * PI) + 0.5, clamp((el - EL_MIN) / (EL_MAX - EL_MIN), 0.002, 0.998));
          vec3 f = texture2D(uFlow, uv).rgb;
          vec2 dir = f.rg * 2.0 - 1.0;
          // Pixels are square, so a step up the panorama is ${((Math.PI * 2) / (SKY_EL_MAX - SKY_EL_MIN)).toFixed(3)}× a step across in uv.
          vec2 step = vec2(dir.x, dir.y * ${((Math.PI * 2) / (SKY_EL_MAX - SKY_EL_MIN)).toFixed(4)});
          float amp = 0.0016 + 0.0034 * f.b;
          // Two copies of the paint, each sliding along the flow and fading out before it jumps back.
          float t0 = fract(uTime * 0.045);
          float t1 = fract(uTime * 0.045 + 0.5);
          vec3 c0 = paint(uv - step * amp * (t0 - 0.5));
          vec3 c1 = paint(uv - step * amp * (t1 - 0.5));
          vec3 col = mix(c0, c1, abs(t0 - 0.5) * 2.0);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  const skyBall = new THREE.Mesh(keep(new THREE.SphereGeometry(SKY_RADIUS, 64, 32)), skyMat);
  skyBall.renderOrder = -1;
  sky.add(skyBall);

  // Light spilling round each star and the moon, breathing a little.
  const starGlow = texture(glow(128, "rgba(255,246,196,0.9)"), false);
  const moonGlow = texture(glow(128, "rgba(250,190,80,0.85)"), false);
  const windowGlow = texture(glow(64, "rgba(255,196,96,0.55)"), false);
  const glows: { sprite: THREE.Sprite; base: number; phase: number; speed: number }[] = [];
  const rand = worldRandom(7);
  for (const s of STARS) {
    const m = keep(
      new THREE.SpriteMaterial({
        map: starGlow,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        transparent: true,
      }),
    );
    const sp = new THREE.Sprite(m);
    sp.position.copy(skyDir(s.az, s.el).multiplyScalar(SKY_RADIUS * 0.9));
    sp.scale.setScalar(SKY_RADIUS * 0.9 * 0.1 * s.size);
    sky.add(sp);
    glows.push({ sprite: sp, base: 0.32 * s.size, phase: rand() * 6.3, speed: 0.6 + rand() * 0.9 });
  }
  {
    const m = keep(
      new THREE.SpriteMaterial({
        map: moonGlow,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        transparent: true,
      }),
    );
    const sp = new THREE.Sprite(m);
    sp.position.copy(skyDir(MOON.az, MOON.el).multiplyScalar(SKY_RADIUS * 0.9));
    sp.scale.setScalar(SKY_RADIUS * 0.9 * MOON.size * 3.2);
    sky.add(sp);
    glows.push({ sprite: sp, base: 0.4, phase: 0, speed: 0.25 });
  }

  // ── Paint for everything solid: colour, and a bump map of the same strokes so the paint stands up ──
  /** Colour, and the paint's relief as a normal map: `height` is how many pixels the thickest paint stands. */
  const paintTextures = async (p: Painted | Promise<Painted>, repeat: boolean, height = 2.5) => {
    const done = await p;
    const map = texture(done.color, repeat);
    const normal = texture(await reliefToNormals(done.relief, height, repeat), repeat);
    normal.colorSpace = THREE.NoColorSpace;
    return { map, normal };
  };
  /** A lit surface with paint on it: `vertexColors` tints a grey tile; a painted surface brings its own colour. */
  const painted = (
    p: { map: THREE.Texture; normal: THREE.Texture },
    depth: number,
    extra: THREE.MeshLambertMaterialParameters = {},
  ) =>
    keep(
      new THREE.MeshLambertMaterial({
        map: p.map,
        normalMap: p.normal,
        normalScale: new THREE.Vector2(depth, depth),
        vertexColors: true,
        ...extra,
      }),
    );
  /**
   * Keeps some of the paint's own colour where the light doesn't reach, as a
   * painting has no black shadows.
   */
  const glowInShade = (shader: THREE.WebGLProgramParametersWithUniforms, k: number) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(2)};`,
    );
  };
  const tileSize = low ? 256 : 512;
  const wallTile = await paintTextures(
    brushTile(tileSize, {
      angle: 0,
      wave: 0.15,
      len: tileSize / 6,
      width: tileSize / 26,
      seed: 12,
      dark: 0.65,
    }),
    true,
  );
  const flameTile = await paintTextures(
    brushTile(tileSize, {
      angle: Math.PI / 2,
      wave: 0.55,
      len: tileSize / 5,
      width: tileSize / 32,
      seed: 13,
      dark: 0.5,
    }),
    true,
  );

  const cypressTile = await paintTextures(
    brushTile(tileSize, {
      angle: Math.PI / 2,
      wave: 0.35,
      len: tileSize / 4,
      width: tileSize / 22,
      seed: 14,
      dark: 0.55,
    }),
    true,
    5,
  );

  /** Gives merged geometry texture coordinates in metres: from above for roofs and ground, from the side for walls. */
  const worldUV = (g: THREE.BufferGeometry, metres: number) => {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      if (Math.abs(n.getY(i)) > 0.6) {
        uv[i * 2] = x / metres;
        uv[i * 2 + 1] = z / metres;
      } else {
        uv[i * 2] = (Math.abs(n.getZ(i)) > Math.abs(n.getX(i)) ? x : z) / metres;
        uv[i * 2 + 1] = y / metres;
      }
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  };
  const paintColor = (
    g: THREE.BufferGeometry,
    color: THREE.Color | ((i: number, p: THREE.Vector3) => THREE.Color),
  ) => {
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const c = typeof color === "function" ? color(i, v.fromBufferAttribute(p, i)) : color;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  };
  const C = (hex: string) => new THREE.Color(hex);
  /** A shape grown a little about its own centre: drawn inside out in ink, it outlines the shape. */
  const outline = (g: THREE.BufferGeometry, k: number) => {
    const o = g.clone();
    o.computeBoundingBox();
    const c = o.boundingBox!.getCenter(new THREE.Vector3());
    o.translate(-c.x, -c.y, -c.z);
    o.scale(k, k, k);
    o.translate(c.x, c.y, c.z);
    return o;
  };

  const pickRGB = (xs: RGB[], r: () => number) => xs[Math.floor(r() * xs.length)];
  const smooth = THREE.MathUtils.smoothstep;

  // ── The ground: the hill underfoot, the valley, the land rising far off, all painted ──
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
  const landWash = (x: number, z: number) =>
    lerp(lerp(LANDC.wash.valley, LANDC.wash.far, farness(z)), LANDC.wash.hill, hillness(x, z));
  const landPaint = (x: number, z: number, r: () => number) => {
    if (r() < 0.08) return { color: LANDC.seam, relief: 0.2 };
    const relief = 0.5 + r() * 0.45;
    if (r() < hillness(x, z)) return { color: pickRGB(LANDC.hill, r), relief };
    if (r() < farness(z)) return { color: pickRGB(LANDC.far, r), relief };
    if (isField(x, z) && r() < 0.75) return { color: pickRGB(LANDC.fields, r), relief };
    return { color: pickRGB(LANDC.valley, r), relief };
  };
  /** Strokes grow with distance from the hilltop, so each looks about the same size from up there. */
  const strokeLen = (x: number, z: number) =>
    Math.min(12, 0.8 + Math.hypot(x - START.x, z - START.z) * 0.03);
  /** Paints a rectangle of ground, seen from above: canvas x is world x, canvas y is world z. */
  const paintGround = (
    r: { x0: number; x1: number; z0: number; z1: number },
    widthPx: number,
    count: number,
    minLen: number,
    seed: number,
  ) => {
    const mpp = (r.x1 - r.x0) / widthPx;
    return paintSurface({
      width: widthPx,
      height: Math.round((r.z1 - r.z0) / mpp),
      metresPerPx: mpp,
      count,
      seed,
      wash: (s, t) => landWash(r.x0 + s, r.z0 + t),
      size: (s, t) => Math.max(minLen, strokeLen(r.x0 + s, r.z0 + t)),
      flow: (s, t) => landFlow(r.x0 + s, r.z0 + t),
      paint: (s, t, rr) => landPaint(r.x0 + s, r.z0 + t, rr),
    });
  };

  const ground = await (async () => {
    const FULL = { x0: -550, x1: 550, z0: -500, z1: 120 };
    // The hilltop gets its own, finer canvas: it's where the visitor looks down at their feet.
    const NEAR = { x0: -70, x1: 70, z0: -60, z1: 40 };
    const g = new THREE.PlaneGeometry(
      FULL.x1 - FULL.x0,
      FULL.z1 - FULL.z0,
      low ? 120 : 220,
      low ? 70 : 124,
    );
    g.rotateX(-Math.PI / 2);
    g.translate((FULL.x0 + FULL.x1) / 2, 0, (FULL.z0 + FULL.z1) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    // White vertex colours: the paint brings its own.
    paintColor(g, C("#ffffff"));

    // Hilltop triangles (with a cell's margin inside the fine canvas) draw with the fine paint.
    const index = g.index!;
    const far: number[] = [];
    const near: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      const cx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3;
      const cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
      const inside =
        cx > NEAR.x0 + 10 && cx < NEAR.x1 - 10 && cz > NEAR.z0 + 10 && cz < NEAR.z1 - 10;
      (inside ? near : far).push(a, b, c);
    }
    g.setIndex([...far, ...near]);
    g.addGroup(0, far.length, 0);
    g.addGroup(far.length, near.length, 1);

    const farPaint = await paintTextures(
      paintGround(FULL, low ? 2048 : 4096, low ? 16000 : 46000, 3.5, 21),
      false,
      6,
    );
    const nearPaint = await paintTextures(
      paintGround(NEAR, low ? 1536 : 3072, low ? 14000 : 42000, 0, 22),
      false,
      4,
    );
    // The plane's own uv spans FULL; squeeze the fine canvas onto just its rectangle.
    const u0 = (NEAR.x0 - FULL.x0) / (FULL.x1 - FULL.x0);
    const u1 = (NEAR.x1 - FULL.x0) / (FULL.x1 - FULL.x0);
    const v0 = 1 - (NEAR.z1 - FULL.z0) / (FULL.z1 - FULL.z0);
    const v1 = 1 - (NEAR.z0 - FULL.z0) / (FULL.z1 - FULL.z0);
    for (const t of [nearPaint.map, nearPaint.normal]) {
      t.repeat.set(1 / (u1 - u0), 1 / (v1 - v0));
      t.offset.set(-u0 / (u1 - u0), -v0 / (v1 - v0));
    }
    // Close to, the hilltop's strokes are bigger than the screen; a fine tile of bristle marks,
    // laid over them only near the visitor, keeps the paint looking like paint at their feet.
    const bristles = await paintTextures(
      brushTile(low ? 256 : 512, {
        angle: 0,
        wave: 0.5,
        len: (low ? 256 : 512) / 5,
        width: (low ? 256 : 512) / 28,
        seed: 23,
        dark: 0.62,
      }),
      true,
      3,
    );
    const nearMat = painted(nearPaint, 1);
    nearMat.onBeforeCompile = (shader) => {
      shader.uniforms.uBristle = { value: bristles.map };
      shader.uniforms.uBristleN = { value: bristles.normal };
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec2 vBristleUv;\nvoid main() {")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvBristleUv = vec2(position.x, -position.z) / 1.8;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          `uniform sampler2D uBristle;
          uniform sampler2D uBristleN;
          varying vec2 vBristleUv;
          void main() {
            float bristle = 1.0 - smoothstep(5.0, 30.0, length(vViewPosition));`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          diffuseColor.rgb *= mix(1.0, texture2D(uBristle, vBristleUv).r * 1.2, bristle * 0.6);`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          vec3 bN = texture2D(uBristleN, vBristleUv).xyz * 2.0 - 1.0;
          bN.xy *= bristle;
          mapN = normalize(vec3(mapN.xy + bN.xy, mapN.z * bN.z));
          normal = normalize(tbn * mapN);`,
        );
    };
    const mesh = new THREE.Mesh(keep(g), [painted(farPaint, 1), nearMat]);
    scene.add(mesh);
    return mesh;
  })();

  // ── The hills: curtains of blue, ridge behind ridge, painted along their line, a dark rim on top ──
  const RIDGE_SPAN = { x0: -1300, x1: 1300 };
  for (const [ri, r] of RIDGES.entries()) {
    const N = 220;
    const pos: number[] = [];
    const uvs: number[] = [];
    const line: number[] = [];
    const idx: number[] = [];
    const thick = 1.4 + Math.abs(r.z) * 0.004;
    const columns: { x: number; top: number; bottom: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const x = RIDGE_SPAN.x0 + (i / N) * (RIDGE_SPAN.x1 - RIDGE_SPAN.x0);
      columns.push({ x, top: ridgeAt(r, x), bottom: heightAt(x, r.z) - 12 });
    }
    // How far the paint reaches down from the ridge line, at the deepest.
    const depth = Math.max(...columns.map((c) => c.top - c.bottom));
    for (const [i, { x, top, bottom }] of columns.entries()) {
      pos.push(x, top, r.z, x, bottom, r.z);
      const u = (x - RIDGE_SPAN.x0) / (RIDGE_SPAN.x1 - RIDGE_SPAN.x0);
      // v runs down from the ridge line, so strokes laid across the canvas follow it.
      uvs.push(u, 1, u, 1 - (top - bottom) / depth);
      line.push(x, top + thick * 0.4, r.z + 1, x, top - thick, r.z + 1);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const base = rgb(r.color);
    const light = rgb("#a9c0e0");
    const tints = ["#2a4a8a", "#5a6fb0", "#3f6f8a", "#6a6aa8", "#8fa8d0"].map(rgb);
    const widthPx = low ? 2048 : 4096;
    const mpp = (RIDGE_SPAN.x1 - RIDGE_SPAN.x0) / widthPx;
    const len = 10 + Math.abs(r.z) * 0.012;
    const paint = await paintTextures(
      paintSurface({
        width: widthPx,
        height: Math.ceil(depth / mpp),
        metresPerPx: mpp,
        count: Math.round(((RIDGE_SPAN.x1 - RIDGE_SPAN.x0) * depth) / (len * len * 0.3)) * 1.4,
        seed: 40 + ri,
        aspect: 0.3,
        wash: (_, t) => lerp(base, rgb("#13285a"), Math.min(0.5, t / depth)),
        size: () => len,
        flow: (s) => [1, 0.12 * Math.sin(s * 0.02 + r.seed)],
        paint: (_, t, rr) => {
          if (rr() < 0.08) return { color: rgb("#1a2f66"), relief: 0.2 };
          let c = lerp(base, pickRGB(tints, rr), 0.25 + 0.45 * rr());
          // The rim catches the light of the sky.
          c = lerp(c, light, 0.35 * (1 - smooth(t, 0, 10)));
          // Lower down, the hill falls into shadow.
          c = lerp(c, rgb("#13285a"), 0.35 * smooth(t, depth * 0.3, depth));
          return { color: c, relief: 0.5 + rr() * 0.45 };
        },
      }),
      false,
      7,
    );
    paint.map.wrapS = paint.normal.wrapS = THREE.ClampToEdgeWrapping;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    paintColor(g, C("#ffffff"));
    scene.add(new THREE.Mesh(keep(g), painted(paint, 1, { side: THREE.DoubleSide })));

    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(line, 3));
    lg.setIndex(idx);
    scene.add(
      new THREE.Mesh(
        keep(lg),
        keep(new THREE.MeshBasicMaterial({ color: "#13285a", side: THREE.DoubleSide })),
      ),
    );
  }

  // ── The village ──
  {
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
    const ink = keep(new THREE.MeshBasicMaterial({ color: "#0d1838", side: THREE.BackSide }));
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
      const pg = keep(new THREE.BufferGeometry());
      pg.setAttribute("position", new THREE.Float32BufferAttribute(glowAt, 3));
      scene.add(
        new THREE.Points(
          pg,
          keep(
            new THREE.PointsMaterial({
              map: windowGlow,
              size: 5,
              sizeAttenuation: true,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
              fog: false,
            }),
          ),
        ),
      );
    }

    // Dark trees round the village and along the valley: each a few lumps of flickering strokes.
    const fol = { dark: FOLIAGE.dark.map(C), edge: FOLIAGE.edge.map(C) };
    const blobs: THREE.BufferGeometry[] = [];
    const treeInk: THREE.BufferGeometry[] = [];
    for (const t of VILLAGE.trees) {
      const lumps = 2 + Math.floor(n() * 3);
      for (let k = 0; k < lumps; k++) {
        const b = new THREE.IcosahedronGeometry(1, 2);
        const bp = b.attributes.position;
        const ph = n() * 6.3;
        // Bumpy, and drawn up into a point, as his trees flicker upward.
        for (let j = 0; j < bp.count; j++) {
          const x = bp.getX(j);
          const y = bp.getY(j);
          const z = bp.getZ(j);
          const bump = 1 + 0.18 * Math.sin(x * 5 + ph) * Math.sin(y * 4 + z * 3 + ph);
          const tip = y > 0 ? 1 - 0.35 * y * y : 1;
          bp.setXYZ(j, x * bump * tip, y * bump, z * bump * tip);
        }
        const s = k === 0 ? 1 : 0.55 + n() * 0.3;
        b.scale(t.r * s, (t.h / 2) * s, t.r * s);
        const ox = k === 0 ? 0 : (n() - 0.5) * t.r * 1.4;
        const oz = k === 0 ? 0 : (n() - 0.5) * t.r * 1.0;
        b.translate(t.x + ox, heightAt(t.x, t.z) + t.h * (0.4 - (k === 0 ? 0 : 0.15)), t.z + oz);
        // Smooth shading across the lumps' facets, then split, so each stroke takes its own colour.
        const smoothB = mergeVertices(b);
        b.dispose();
        smoothB.computeVertexNormals();
        const g = smoothB.toNonIndexed();
        smoothB.dispose();
        treeInk.push(outline(g, 1.06));
        paintColor(g, (_, v) => {
          const c = fol.dark[Math.floor(n() * fol.dark.length)].clone();
          // The side facing the moon catches a little olive.
          const lit = v.x - t.x > 0 && n() < 0.35;
          return lit ? c.lerp(fol.edge[Math.floor(n() * fol.edge.length)], 0.55) : c;
        });
        blobs.push(g);
      }
    }
    const treeMat = painted(flameTile, 1);
    treeMat.onBeforeCompile = (shader) => glowInShade(shader, 0.3);
    scene.add(new THREE.Mesh(keep(worldUV(mergeGeometries(blobs), 3)), treeMat));
    scene.add(new THREE.Mesh(keep(mergeGeometries(treeInk)), ink));
    [...blobs, ...treeInk].forEach((g) => g.dispose());
  }

  // ── The cypress: tongues of dark flame twisting up round one another ──
  /** Lets the cypress sway, more toward its top. */
  const sway = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float k = pow(max(position.y, 0.0) / ${CYPRESS.height.toFixed(1)}, 1.6);
      transformed.x += sin(uTime * 0.7 + position.y * 0.18) * 0.5 * k;
      transformed.z += cos(uTime * 0.55 + position.y * 0.13) * 0.32 * k;`,
    );
  };
  const cypressMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
  cypressMat.onBeforeCompile = sway;
  const cypressStrokeMat = painted(cypressTile, 1.2);
  cypressStrokeMat.onBeforeCompile = (shader) => {
    sway(shader);
    glowInShade(shader, 0.4);
  };
  {
    const n = worldRandom(42);
    const tongues: THREE.BufferGeometry[] = [];
    // Underneath, the tongues are nearly black: what shows between the strokes is the shadow in the tree.
    const under = [C("#132a1e"), C("#183022"), C("#1a3029")];
    const dark = ["#2f5a35", "#3a6640", "#447048", "#2f5f55", "#4f522c", "#2a4a45"].map(C);
    const edge = ["#6f8f48", "#8f8a44", "#7a9a58", "#9a7036", "#9aab58", "#a8944a", "#4f8a72"];

    /** A tongue of flame: its radius up its height, and how it spirals and flicks outward. */
    type Tongue = {
      h: number;
      r0: number;
      ang: number;
      off: number;
      twist: number;
      phase: number;
      spiral: number;
      flick: number;
    };
    const radius = (tg: Tongue, t: number) =>
      tg.r0 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85) * (1 - 0.6 * t) + 0.04;
    /** A point on a tongue's surface: `t` up it (0–1), `phi` round it, `lift` out from it. */
    const tongueAt = (tg: Tongue, t: number, phi: number, lift = 0) => {
      const r = radius(tg, t) + lift;
      const x = r * Math.sin(phi);
      const z = r * Math.cos(phi);
      const a = tg.twist * t * 2.2;
      const around = tg.ang + tg.spiral * t;
      const reach = tg.off * (1 - t * 0.75) + tg.flick * t ** 3;
      const cx = Math.cos(around) * reach + Math.sin(t * 5 + tg.phase) * 0.6 * t;
      const cz = Math.sin(around) * reach + Math.cos(t * 4 + tg.phase) * 0.45 * t;
      return new THREE.Vector3(
        x * Math.cos(a) - z * Math.sin(a) + cx,
        t * tg.h,
        x * Math.sin(a) + z * Math.cos(a) + cz,
      );
    };

    const COUNT = low ? 22 : 30;
    const all: Tongue[] = [];
    for (let i = 0; i < COUNT; i++) {
      const tg: Tongue = {
        h: CYPRESS.height * (i === 0 ? 1 : 0.3 + n() * 0.66),
        r0: CYPRESS.radius * (i === 0 ? 0.7 : 0.28 + n() * 0.38),
        ang: (i / COUNT) * Math.PI * 2 + n(),
        off: i === 0 ? 0 : CYPRESS.radius * (0.35 + n() * 0.6),
        twist: 0.5 + n() * 0.9,
        phase: n() * 6.3,
        // Each tongue spirals up round the trunk and flicks outward at its tip.
        spiral: (n() < 0.5 ? -1 : 1) * (0.8 + n() * 1.2),
        flick: 0.6 + n() * 1.4,
      };
      all.push(tg);
      const ROWS = 26;
      const SIDES = 12;
      const pos: number[] = [];
      const idx: number[] = [];
      for (let k = 0; k <= ROWS; k++) {
        for (let j = 0; j <= SIDES; j++) {
          const v = tongueAt(tg, k / ROWS, (j / SIDES) * Math.PI * 2);
          pos.push(v.x, v.y, v.z);
          if (k > 0 && j > 0) {
            const a = (k - 1) * (SIDES + 1) + j - 1;
            const b = a + SIDES + 1;
            idx.push(a, b, a + 1, a + 1, b, b + 1);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      paintColor(g, () => under[Math.floor(n() * under.length)]);
      tongues.push(g);
    }

    // The strokes: thousands of curved, raised dabs laid up the tongues, each one colour,
    // flickering upward with the flame the way he drew it.
    const STROKES = low ? 2000 : 4200;
    const sp: number[] = [];
    const sc: number[] = [];
    const suv: number[] = [];
    const si: number[] = [];
    const ALONG = 4;
    for (let s = 0; s < STROKES; s++) {
      // Bigger tongues get more strokes.
      let tg = all[0];
      for (let tries = 0; tries < 8; tries++) {
        tg = all[Math.floor(n() * all.length)];
        if (n() < (tg.h * tg.r0) / (CYPRESS.height * CYPRESS.radius * 0.7)) break;
      }
      const len = (1.1 + n() * 1.3) / tg.h;
      const t0 = n() * (1 - len * 0.6);
      const phi0 = n() * Math.PI * 2;
      const drift = (n() - 0.5) * 0.5;
      const width = 0.32 + n() * 0.3;
      let c = dark[Math.floor(n() * dark.length)].clone();
      // The side toward the moon catches more of the olive and ochre.
      const facing = Math.cos(phi0 - Math.PI * 0.75);
      if (n() < 0.3 + 0.3 * Math.max(0, facing))
        c.lerp(C(edge[Math.floor(n() * edge.length)]), 0.85);
      c = c.multiplyScalar(0.9 + n() * 0.25);
      const base = sp.length / 3;
      // Each stroke takes its own patch of the bristle tile, its grooves running along it.
      const ou = n();
      const ov = n();
      for (let j = 0; j <= ALONG; j++) {
        const f = j / ALONG;
        const t = Math.min(0.999, t0 + f * len);
        const phi = phi0 + drift * f;
        const r = Math.max(0.12, radius(tg, t));
        // Tapered at both ends, fullest just past the middle.
        const w = width * Math.sin(Math.PI * (0.12 + 0.76 * f)) ** 0.7;
        const dphi = w / 2 / r;
        // Raised along its crown, so each stroke stands off the tree and catches the light.
        for (const [dp, lift] of [
          [-dphi, 0.04],
          [0, 0.1 + w * 0.15],
          [dphi, 0.04],
        ] as const) {
          const v = tongueAt(tg, t, phi + dp, lift);
          sp.push(v.x, v.y, v.z);
          sc.push(c.r, c.g, c.b);
          suv.push(ou + (dp / dphi + 1) * 0.06, ov + (f * len * tg.h) / 3.2);
        }
        if (j > 0) {
          const a = base + (j - 1) * 3;
          const b = a + 3;
          si.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
        }
      }
    }
    const strokeGeo = keep(new THREE.BufferGeometry());
    strokeGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    strokeGeo.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
    strokeGeo.setAttribute("uv", new THREE.Float32BufferAttribute(suv, 2));
    strokeGeo.setIndex(si);
    strokeGeo.computeVertexNormals();

    const tree = new THREE.Mesh(keep(mergeGeometries(tongues)), cypressMat);
    const strokes = new THREE.Mesh(strokeGeo, cypressStrokeMat);
    for (const m of [tree, strokes]) {
      m.position.set(CYPRESS.x, heightAt(CYPRESS.x, CYPRESS.z) - 0.4, CYPRESS.z);
      scene.add(m);
    }
    tongues.forEach((g) => g.dispose());
  }

  const raycaster = new THREE.Raycaster();
  let width = 1;
  let height = 1;

  return {
    frame(view, dt) {
      time.value += dt;
      camera.position.set(view.x, view.y, view.z);
      camera.rotation.set(view.pitch, view.yaw, 0);
      sky.position.copy(camera.position);
      for (const g of glows) {
        g.sprite.material.opacity = g.base * (0.8 + 0.2 * Math.sin(time.value * g.speed + g.phase));
      }
      renderer.render(scene, camera);
    },
    resize(w, h) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // A taller view on phones held upright, so the sky still fits.
      camera.fov = w / h < 0.8 ? 78 : 62;
      camera.updateProjectionMatrix();
    },
    pick(nx, ny) {
      if (!width || !height) return null;
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = raycaster.intersectObject(ground, false)[0];
      if (!hit || !insideBounds(hit.point.x, hit.point.z, 0.5) || blocked(hit.point.x, hit.point.z))
        return null;
      return { x: hit.point.x, z: hit.point.z };
    },
    dispose() {
      for (const t of trash) t.dispose();
      renderer.dispose();
    },
  };
}
