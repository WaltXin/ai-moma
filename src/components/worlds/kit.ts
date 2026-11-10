import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldRandom } from "@/lib/worlds/random";
import {
  SKY_EL_MAX,
  SKY_EL_MIN,
  breathe,
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
  type SkySpec,
  type Surface,
} from "./brush";

/**
 * The kit every painting world is raised with: a stage (renderer, camera,
 * painted materials) and builders for the pieces a landscape after a
 * painter is made of: a painted sky that keeps moving, painted ground with
 * a finer canvas where the visitor stands, ridges of hills, flame-like trees
 * built of raised strokes, and lumpy bushes. A world's own scene composes
 * these with its layout (in `src/lib/worlds/`) and adds what only it has.
 *
 * Everything is drawn with code, stroke by stroke; no image of the painting
 * is used.
 */

export type View = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** The head's tilt to one side as it walks, in radians. */
  roll?: number;
};
export type WorldScene = {
  frame(view: View, dt: number): void;
  resize(w: number, h: number): void;
  /** The ground under a screen point (−1…1 on both axes), if the visitor may walk there. */
  pick(nx: number, ny: number): { x: number; z: number } | null;
  dispose(): void;
};
/** Builds a world's scene on a canvas; `low` asks for less detail (phones). */
export type SceneMaker = (canvas: HTMLCanvasElement, opts: { low: boolean }) => Promise<WorldScene>;

/** Paint ready for a material: its colour, and its relief as a normal map. */
export type PaintMaps = { map: THREE.Texture; normal: THREE.Texture };
/** Picks one of a palette with a random number. */
export const pickRGB = (xs: RGB[], r: () => number) => xs[Math.floor(r() * xs.length)];
export const C = (hex: string) => new THREE.Color(hex);
export const smooth = THREE.MathUtils.smoothstep;

const SKY_RADIUS = 1200;
export const skyDir = (az: number, el: number) =>
  new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

export type Stage = ReturnType<typeof createStage>;

/** The renderer, scene and camera, and the helpers every piece is built with. */
export function createStage(
  canvas: HTMLCanvasElement,
  { low, fog }: { low: boolean; fog: { color: string; density: number } },
) {
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
  scene.fog = new THREE.FogExp2(fog.color, fog.density);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, SKY_RADIUS * 2);
  camera.rotation.order = "YXZ";
  const time = { value: 0 };
  const onFrame: ((dt: number) => void)[] = [];

  /** Colour, and the paint's relief as a normal map: `height` is how many pixels the thickest paint stands. */
  const paintTextures = async (
    p: Painted | Promise<Painted>,
    repeat: boolean,
    height = 2.5,
  ): Promise<PaintMaps> => {
    const done = await p;
    const map = texture(done.color, repeat);
    const normal = texture(await reliefToNormals(done.relief, height, repeat), repeat);
    normal.colorSpace = THREE.NoColorSpace;
    return { map, normal };
  };
  /** A lit surface with paint on it: `vertexColors` tints a grey tile; a painted surface brings its own colour. */
  const painted = (p: PaintMaps, depth: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
    keep(
      new THREE.MeshLambertMaterial({
        map: p.map,
        normalMap: p.normal,
        normalScale: new THREE.Vector2(depth, depth),
        vertexColors: true,
        ...extra,
      }),
    );
  /** Brushwork tiles, painted once and shared by everything that asks for the same one. */
  const tiles = new Map<string, Promise<PaintMaps>>();
  const tileSize = low ? 256 : 512;
  const tile = (
    key: string,
    t: { angle: number; wave: number; len: number; width: number; seed: number; dark: number },
    height = 2.5,
  ) => {
    let made = tiles.get(key);
    if (!made) {
      made = paintTextures(
        brushTile(tileSize, {
          angle: t.angle,
          wave: t.wave,
          len: tileSize / t.len,
          width: tileSize / t.width,
          seed: t.seed,
          dark: t.dark,
        }),
        true,
        height,
      );
      tiles.set(key, made);
    }
    return made;
  };

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
  /** Dark ink for outlines, one material per colour. */
  const inks = new Map<string, THREE.MeshBasicMaterial>();
  const ink = (color: string) => {
    let m = inks.get(color);
    if (!m) {
      m = keep(new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
      inks.set(color, m);
    }
    return m;
  };

  const raycaster = new THREE.Raycaster();
  let width = 1;
  let height = 1;

  return {
    low,
    renderer,
    scene,
    camera,
    time,
    keep,
    texture,
    paintTextures,
    painted,
    tile,
    worldUV,
    paintColor,
    outline,
    ink,
    /** Runs every frame, before the scene is drawn. */
    onFrame(fn: (dt: number) => void) {
      onFrame.push(fn);
    },
    /** The finished world: draws each frame, and walks where `walkable` allows on `ground`. */
    finish({
      ground,
      walkable,
    }: {
      ground: THREE.Object3D;
      walkable: (x: number, z: number) => boolean;
    }): WorldScene {
      return {
        frame(view, dt) {
          time.value += dt;
          camera.position.set(view.x, view.y, view.z);
          camera.rotation.set(view.pitch, view.yaw, view.roll ?? 0);
          for (const f of onFrame) f(dt);
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
          if (!hit || !walkable(hit.point.x, hit.point.z)) return null;
          return { x: hit.point.x, z: hit.point.z };
        },
        dispose() {
          for (const t of trash) t.dispose();
          renderer.dispose();
        },
      };
    },
  };
}

/**
 * Changes a material's shader. three.js caches programs by the text of
 * `onBeforeCompile`, which is the same for every material changed through
 * the same helper; `key` tells them apart (a tree's sway, a glow's strength).
 */
export function customize(
  material: THREE.Material,
  key: string,
  change: (shader: THREE.WebGLProgramParametersWithUniforms) => void,
) {
  material.onBeforeCompile = change;
  material.customProgramCacheKey = () => key;
  return material;
}

/**
 * Keeps some of the paint's own colour where the light doesn't reach, as a
 * painting has no black shadows.
 */
export function glowInShade(shader: THREE.WebGLProgramParametersWithUniforms, k: number) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(2)};`,
  );
}

/**
 * Close to, a surface's strokes are bigger than the screen; a fine tile of
 * bristle marks, laid over them only near the visitor, keeps the paint
 * looking like paint at their feet. `metres` is the tile's size on the ground.
 */
export function withBristles(
  material: THREE.MeshLambertMaterial,
  bristles: PaintMaps,
  metres = 1.8,
  extra?: { key: string; change: (shader: THREE.WebGLProgramParametersWithUniforms) => void },
) {
  return customize(material, `bristles:${metres}:${extra?.key ?? ""}`, (shader) => {
    shader.uniforms.uBristle = { value: bristles.map };
    shader.uniforms.uBristleN = { value: bristles.normal };
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec2 vBristleUv;\nvoid main() {")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nvBristleUv = vec2(position.x, -position.z) / ${metres.toFixed(2)};`,
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
    extra?.change(shader);
  });
}

/** The fine bristle tile laid over the ground near the visitor. */
export const bristleTile = (stage: Stage) =>
  stage.tile("bristles", { angle: 0, wave: 0.5, len: 5, width: 28, seed: 23, dark: 0.62 }, 3);

// ── The sky ──

/**
 * A painted sky round the visitor: the panorama painted stroke by stroke,
 * its strokes sliding along their flow so the sky never stops moving, the
 * paint lit from `lightFrom` (across, up, out of the canvas) so it stands up.
 */
export async function addSky(stage: Stage, spec: SkySpec, lightFrom: [number, number, number]) {
  const { scene, texture, keep, time, low } = stage;
  const sky = new THREE.Group();
  scene.add(sky);
  const skyPaint = await paintSky(low ? 2048 : 4096, spec);
  // Lets a browser console look at the painted panorama while developing.
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
  const flowTex = keep(new THREE.DataTexture(skyFlowData(FW, FH, spec), FW, FH, THREE.RGBAFormat));
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
        // Light raking across the paint.
        const vec3 LIGHT = vec3(${new THREE.Vector3(...lightFrom)
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

  // Light spilling round each light, breathing a little.
  const glowTex = new Map<string, THREE.Texture>();
  const glows: { sprite: THREE.Sprite; base: number; phase: number; speed: number }[] = [];
  const rand = worldRandom(7);
  for (const l of spec.lights) {
    if (!l.glow) continue;
    let map = glowTex.get(l.glow.color);
    if (!map) {
      map = texture(glow(128, l.glow.color), false);
      glowTex.set(l.glow.color, map);
    }
    const m = keep(
      new THREE.SpriteMaterial({
        map,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        transparent: true,
      }),
    );
    const sp = new THREE.Sprite(m);
    sp.position.copy(skyDir(l.az, l.el).multiplyScalar(SKY_RADIUS * 0.9));
    sp.scale.setScalar(SKY_RADIUS * 0.9 * l.glow.size);
    sky.add(sp);
    glows.push({
      sprite: sp,
      base: l.glow.base,
      phase: l.glow.phase ?? rand() * 6.3,
      speed: l.glow.speed ?? 0.6 + rand() * 0.9,
    });
  }

  stage.onFrame(() => {
    sky.position.copy(stage.camera.position);
    for (const g of glows) {
      g.sprite.material.opacity = g.base * (0.8 + 0.2 * Math.sin(time.value * g.speed + g.phase));
    }
  });
  return sky;
}

// ── The ground ──

/** A rectangle of ground, in metres. */
export type Rect = { x0: number; x1: number; z0: number; z1: number };
/** How a canvas of ground is painted: its size in pixels and strokes (on phones, then elsewhere). */
export type GroundCanvas = {
  px: [number, number];
  count: [number, number];
  /** The shortest stroke on it, in metres. */
  minLen: number;
  /** How high its paint stands, in pixels. */
  height: number;
  seed: number;
};
/** The land's paint at a point (x, z): what's under the strokes, how long they are, which way they run, their colours. */
export type LandPaint = {
  wash(x: number, z: number): RGB;
  size(x: number, z: number): number;
  flow(x: number, z: number): [number, number];
  paint(x: number, z: number, r: () => number): { color: RGB; relief: number };
};

/** Paints a rectangle of ground, seen from above: canvas x is world x, canvas y is world z. */
export function paintGround(
  r: Rect,
  land: LandPaint,
  widthPx: number,
  count: number,
  minLen: number,
  seed: number,
  extra: Partial<Surface> = {},
) {
  const mpp = (r.x1 - r.x0) / widthPx;
  return paintSurface({
    width: widthPx,
    height: Math.round((r.z1 - r.z0) / mpp),
    metresPerPx: mpp,
    count,
    seed,
    wash: (s, t) => land.wash(r.x0 + s, r.z0 + t),
    size: (s, t) => Math.max(minLen, land.size(r.x0 + s, r.z0 + t)),
    flow: (s, t) => land.flow(r.x0 + s, r.z0 + t),
    paint: (s, t, rr) => land.paint(r.x0 + s, r.z0 + t, rr),
    ...extra,
  });
}

/**
 * The ground: a height field over `full`, painted with `land`. The `near`
 * rectangle, where the visitor walks and looks down, gets its own finer
 * canvas and the bristle tile.
 */
export async function addGround(
  stage: Stage,
  o: {
    heightAt: (x: number, z: number) => number;
    full: Rect;
    near: Rect;
    segments: { low: [number, number]; high: [number, number] };
    land: LandPaint;
    far: GroundCanvas;
    fine: GroundCanvas;
  },
) {
  const { low, keep, paintTextures, painted, paintColor, scene } = stage;
  const { full: FULL, near: NEAR } = o;
  const seg = low ? o.segments.low : o.segments.high;
  const g = new THREE.PlaneGeometry(FULL.x1 - FULL.x0, FULL.z1 - FULL.z0, seg[0], seg[1]);
  g.rotateX(-Math.PI / 2);
  g.translate((FULL.x0 + FULL.x1) / 2, 0, (FULL.z0 + FULL.z1) / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, o.heightAt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  // White vertex colours: the paint brings its own.
  paintColor(g, C("#ffffff"));

  // Triangles near the visitor (with a cell's margin inside the fine canvas) draw with the fine paint.
  const index = g.index!;
  const far: number[] = [];
  const near: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const cx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3;
    const cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
    const inside = cx > NEAR.x0 + 10 && cx < NEAR.x1 - 10 && cz > NEAR.z0 + 10 && cz < NEAR.z1 - 10;
    (inside ? near : far).push(a, b, c);
  }
  g.setIndex([...far, ...near]);
  g.addGroup(0, far.length, 0);
  g.addGroup(far.length, near.length, 1);

  // Each canvas's sizes are given for phones, then everywhere else.
  const pick = low ? 0 : 1;
  const farPaint = await paintTextures(
    paintGround(FULL, o.land, o.far.px[pick], o.far.count[pick], o.far.minLen, o.far.seed),
    false,
    o.far.height,
  );
  const nearPaint = await paintTextures(
    paintGround(NEAR, o.land, o.fine.px[pick], o.fine.count[pick], o.fine.minLen, o.fine.seed),
    false,
    o.fine.height,
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
  const nearMat = withBristles(
    painted(nearPaint, 1),
    await bristleTile(stage),
  ) as THREE.MeshLambertMaterial;
  const mesh = new THREE.Mesh(keep(g), [painted(farPaint, 1), nearMat]);
  scene.add(mesh);
  return mesh;
}

// ── Grass ──

/** Grass standing on the ground: where, how thick, how tall, its colours, the wind in it. */
export type Grass = {
  /** Tufts are tried all over this rectangle, and kept where `densityAt` lets them. */
  area: Rect;
  heightAt: (x: number, z: number) => number;
  /** How thickly it grows at a point, from 0 (none) to 1. */
  densityAt: (x: number, z: number) => number;
  /** Tufts per square metre where it's thickest, and blades in each (phones, elsewhere). */
  perSquareMetre: [number, number];
  blades: [number, number];
  /** A blade's length and width, in metres. */
  length: [number, number];
  width: [number, number];
  /** How much bigger a tuft is here than at the visitor's feet (1): far ones are bigger and fewer. */
  scaleAt?: (x: number, z: number) => number;
  /** The blades' colours, and the lighter ones some catch at the tip. */
  colors: string[];
  tips: string[];
  tipChance: number;
  /** Where the wind blows to (a unit vector in the ground plane), and how far it pushes a blade's tip, in blade lengths. */
  wind: [number, number];
  push: number;
  /** How much of its colour a blade keeps in shade. */
  glow: number;
  seed: number;
};

/**
 * Grass as strokes standing up off the ground: tufts of curved, raised
 * blades, each one colour, leaning with the wind and bowing as gusts cross
 * the hill. Walking, the near blades slide past the far ones, which is most
 * of what tells the eye it's moving through a place.
 */
export async function addGrass(stage: Stage, o: Grass) {
  const { low, keep, painted, scene, time } = stage;
  await breathe();
  const n = worldRandom(o.seed);
  const pick = low ? 0 : 1;
  const colors = o.colors.map(C);
  const tips = o.tips.map(C);
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const sway: number[] = [];
  const idx: number[] = [];
  const ALONG = 3;
  const [wx, wz] = o.wind;
  const tries = Math.round(
    (o.area.x1 - o.area.x0) * (o.area.z1 - o.area.z0) * o.perSquareMetre[pick],
  );
  const c = new THREE.Color();
  for (let i = 0; i < tries; i++) {
    const tx = o.area.x0 + n() * (o.area.x1 - o.area.x0);
    const tz = o.area.z0 + n() * (o.area.z1 - o.area.z0);
    const k = o.scaleAt?.(tx, tz) ?? 1;
    // Bigger tufts are fewer, so the cover stays even.
    if (n() > o.densityAt(tx, tz) / (k * k)) continue;
    const count = o.blades[pick] - 1 + Math.floor(n() * 3);
    for (let b = 0; b < count; b++) {
      const len = (o.length[0] + n() * (o.length[1] - o.length[0])) * k;
      const width = (o.width[0] + n() * (o.width[1] - o.width[0])) * k;
      // Blades fan out from the tuft's root, most of them leaning downwind.
      const a = n() * Math.PI * 2;
      const out = 0.25 + n() * 0.75;
      let dx = Math.cos(a) * out + wx * 0.7;
      let dz = Math.sin(a) * out + wz * 0.7;
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl;
      dz /= dl;
      const bow = 0.25 + n() * 0.55;
      const rx = tx + (n() - 0.5) * 0.16 * k;
      const rz = tz + (n() - 0.5) * 0.16 * k;
      const ry = o.heightAt(rx, rz) - 0.04;
      c.copy(colors[Math.floor(n() * colors.length)]);
      if (n() < o.tipChance) c.lerp(tips[Math.floor(n() * tips.length)], 0.8);
      c.multiplyScalar(0.85 + n() * 0.3);
      const ou = n();
      const ov = n();
      const base = pos.length / 3;
      for (let j = 0; j <= ALONG; j++) {
        const f = j / ALONG;
        // Bowing over as it rises, and tapering to its tip.
        const h = len * bow * f * f;
        const y = len * (f - 0.3 * bow * f * f);
        const w = width * (1 - f * f * 0.92);
        const cx = rx + dx * h;
        const cz = rz + dz * h;
        // Across the blade: level, square to the way it leans. Its crown stands off its face.
        const sx = -dz * (w / 2);
        const sz = dx * (w / 2);
        const lift = w * 0.3;
        pos.push(cx - sx, ry + y, cz - sz);
        pos.push(cx - dx * lift, ry + y + lift * 0.4, cz - dz * lift);
        pos.push(cx + sx, ry + y, cz + sz);
        for (let v = 0; v < 3; v++) {
          col.push(c.r, c.g, c.b);
          uv.push(ou + v * 0.06, ov + (f * len) / 1.6);
          // The higher up the blade, the further the wind moves it.
          sway.push(f * f * len);
        }
        if (j > 0) {
          const p = base + (j - 1) * 3;
          const q = p + 3;
          idx.push(p, q, p + 1, p + 1, q, q + 1, p + 1, q + 1, p + 2, p + 2, q + 1, q + 2);
        }
      }
    }
  }
  const g = keep(new THREE.BufferGeometry());
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aSway", new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  g.computeVertexNormals();

  const tile = await stage.tile(
    "flame-strokes",
    { angle: Math.PI / 2, wave: 0.35, len: 4, width: 22, seed: 14, dark: 0.55 },
    5,
  );
  const mat = painted(tile, 1.2, { side: THREE.DoubleSide });
  customize(mat, `grass:${o.glow}:${o.push}:${wx}:${wz}`, (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader =
      `attribute float aSway;\nuniform float uTime;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        // Gusts cross the hill in long waves; within one, each blade shivers.
        float gust = 0.5 + 0.5 * sin(uTime * 0.45 - position.x * 0.06 + position.z * 0.045);
        float shiver = sin(uTime * 2.1 + position.x * 0.8 + position.z * 0.6)
          + 0.5 * sin(uTime * 3.7 - position.x * 1.7 + position.z * 1.3);
        float bend = aSway * ${o.push.toFixed(3)} * (0.25 + gust * (0.75 + 0.3 * shiver));
        transformed.x += ${wx.toFixed(4)} * bend;
        transformed.z += ${wz.toFixed(4)} * bend;
        transformed.y -= bend * 0.35;`,
      );
    glowInShade(shader, o.glow);
  });
  const mesh = new THREE.Mesh(g, mat);
  scene.add(mesh);
  return mesh;
}

// ── Ridges of hills ──

/** A ridge of hills: a curtain at depth `z`, from `bottom(x)` up to `top(x)`, in `color`. */
export type RidgeLine = {
  z: number;
  top: (x: number) => number;
  bottom: (x: number) => number;
  color: string;
  /** Shapes the gentle wave its strokes follow. */
  seed: number;
};

/**
 * Hills ridge behind ridge, each painted along its own line: lighter at the
 * rim where it catches the sky, falling into shadow lower down, a dark line
 * along the top.
 */
export async function addRidges(
  stage: Stage,
  ridges: RidgeLine[],
  look: { rim: string; shadow: string; seam: string; tints: string[] },
) {
  const { low, keep, paintTextures, painted, paintColor, scene } = stage;
  const RIDGE_SPAN = { x0: -1300, x1: 1300 };
  for (const [ri, r] of ridges.entries()) {
    await breathe();
    const N = 220;
    const pos: number[] = [];
    const uvs: number[] = [];
    const line: number[] = [];
    const idx: number[] = [];
    const thick = 1.4 + Math.abs(r.z) * 0.004;
    const columns: { x: number; top: number; bottom: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const x = RIDGE_SPAN.x0 + (i / N) * (RIDGE_SPAN.x1 - RIDGE_SPAN.x0);
      columns.push({ x, top: r.top(x), bottom: r.bottom(x) });
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
    const light = rgb(look.rim);
    const shadow = rgb(look.shadow);
    const seam = rgb(look.seam);
    const tints = look.tints.map(rgb);
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
        wash: (_, t) => lerp(base, shadow, Math.min(0.5, t / depth)),
        size: () => len,
        flow: (s) => [1, 0.12 * Math.sin(s * 0.02 + r.seed)],
        paint: (_, t, rr) => {
          if (rr() < 0.08) return { color: seam, relief: 0.2 };
          let c = lerp(base, pickRGB(tints, rr), 0.25 + 0.45 * rr());
          // The rim catches the light of the sky.
          c = lerp(c, light, 0.35 * (1 - smooth(t, 0, 10)));
          // Lower down, the hill falls into shadow.
          c = lerp(c, shadow, 0.35 * smooth(t, depth * 0.3, depth));
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
        keep(new THREE.MeshBasicMaterial({ color: look.shadow, side: THREE.DoubleSide })),
      ),
    );
  }
}

// ── Trees built of strokes ──

/**
 * Raised strokes as ribbons. Each row across a stroke is its left edge, its
 * raised crown and its right edge, so a stroke stands off what it's laid on
 * and catches the light; each takes its own patch of the bristle tile, its
 * grooves running along it.
 */
export function strokeRibbons() {
  const sp: number[] = [];
  const sc: number[] = [];
  const suv: number[] = [];
  const si: number[] = [];
  return {
    /** One stroke: `rows` from start to end, each [left, crown, right]; `v` how far along each row is, in tile units. */
    add(rows: THREE.Vector3[][], c: THREE.Color, ou: number, ov: number, v: (j: number) => number) {
      const base = sp.length / 3;
      for (const [j, row] of rows.entries()) {
        for (const [k, p] of row.entries()) {
          sp.push(p.x, p.y, p.z);
          sc.push(c.r, c.g, c.b);
          suv.push(ou + k * 0.06, ov + v(j));
        }
        if (j > 0) {
          const a = base + (j - 1) * 3;
          const b = a + 3;
          si.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
        }
      }
    },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(suv, 2));
      g.setIndex(si);
      g.computeVertexNormals();
      return g;
    },
  };
}

/** A flame-like tree: where it stands, how big, its paint, and how much detail. */
export type FlameTree = {
  x: number;
  y: number;
  z: number;
  height: number;
  radius: number;
  seed: number;
  /** How many tongues of flame, and how many strokes laid up them (phones, elsewhere). */
  tongues: [number, number];
  strokes: [number, number];
  /** Nearly black under the strokes; the strokes themselves; and the colours they catch at the edge. */
  under: string[];
  dark: string[];
  edge: string[];
  /** The direction round the tree (radians) that faces the light, where edge colours gather. */
  litFrom: number;
  /** How much of its colour it keeps in shade (0.4 if not given). */
  glow?: number;
  /** How long its strokes are, in metres (1.1–2.4 if not given), and how wide (0.32–0.62). */
  strokeLen?: [number, number];
  strokeWidth?: [number, number];
};

/**
 * A tree like a dark flame (a cypress): tongues twisting up round one
 * another, each covered in curved, raised strokes laid up it, the way he
 * drew it. It sways, more toward its top.
 */
export async function addFlameTree(stage: Stage, t: FlameTree) {
  const { low, keep, painted, paintColor, scene, time } = stage;
  // Each piece of a world is built in one go; a breath between them keeps the page answering.
  await breathe();
  /** Lets the tree sway, more toward its top. */
  const sway = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = time;
    // Each tree's own height, as a uniform, so trees of every size share one program.
    shader.uniforms.uTreeHeight = { value: t.height };
    shader.vertexShader =
      `uniform float uTime;\nuniform float uTreeHeight;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      float k = pow(max(position.y, 0.0) / uTreeHeight, 1.6);
      transformed.x += sin(uTime * 0.7 + position.y * 0.18) * 0.5 * k;
      transformed.z += cos(uTime * 0.55 + position.y * 0.13) * 0.32 * k;`,
      );
  };
  const treeMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
  customize(treeMat, "flame-tree", sway);
  const strokeTile = await stage.tile(
    "flame-strokes",
    { angle: Math.PI / 2, wave: 0.35, len: 4, width: 22, seed: 14, dark: 0.55 },
    5,
  );
  const strokeMat = painted(strokeTile, 1.2);
  customize(strokeMat, `flame-strokes:${t.glow ?? 0.4}`, (shader) => {
    sway(shader);
    glowInShade(shader, t.glow ?? 0.4);
  });

  const n = worldRandom(t.seed);
  const tongues: THREE.BufferGeometry[] = [];
  // Underneath, the tongues are nearly black: what shows between the strokes is the shadow in the tree.
  const under = t.under.map(C);
  const dark = t.dark.map(C);
  const edge = t.edge;

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
  const radius = (tg: Tongue, s: number) =>
    tg.r0 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.85) * (1 - 0.6 * s) + 0.04;
  /** A point on a tongue's surface: `s` up it (0–1), `phi` round it, `lift` out from it. */
  const tongueAt = (tg: Tongue, s: number, phi: number, lift = 0) => {
    const r = radius(tg, s) + lift;
    const x = r * Math.sin(phi);
    const z = r * Math.cos(phi);
    const a = tg.twist * s * 2.2;
    const around = tg.ang + tg.spiral * s;
    const reach = tg.off * (1 - s * 0.75) + tg.flick * s ** 3;
    const cx = Math.cos(around) * reach + Math.sin(s * 5 + tg.phase) * 0.6 * s;
    const cz = Math.sin(around) * reach + Math.cos(s * 4 + tg.phase) * 0.45 * s;
    return new THREE.Vector3(
      x * Math.cos(a) - z * Math.sin(a) + cx,
      s * tg.h,
      x * Math.sin(a) + z * Math.cos(a) + cz,
    );
  };

  const COUNT = low ? t.tongues[0] : t.tongues[1];
  const all: Tongue[] = [];
  for (let i = 0; i < COUNT; i++) {
    const tg: Tongue = {
      h: t.height * (i === 0 ? 1 : 0.3 + n() * 0.66),
      r0: t.radius * (i === 0 ? 0.7 : 0.28 + n() * 0.38),
      ang: (i / COUNT) * Math.PI * 2 + n(),
      off: i === 0 ? 0 : t.radius * (0.35 + n() * 0.6),
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
  const STROKES = low ? t.strokes[0] : t.strokes[1];
  const ribbons = strokeRibbons();
  const ALONG = 4;
  for (let s = 0; s < STROKES; s++) {
    // Bigger tongues get more strokes.
    let tg = all[0];
    for (let tries = 0; tries < 8; tries++) {
      tg = all[Math.floor(n() * all.length)];
      if (n() < (tg.h * tg.r0) / (t.height * t.radius * 0.7)) break;
    }
    const len =
      ((t.strokeLen?.[0] ?? 1.1) + n() * ((t.strokeLen?.[1] ?? 2.4) - (t.strokeLen?.[0] ?? 1.1))) /
      tg.h;
    const t0 = n() * (1 - len * 0.6);
    const phi0 = n() * Math.PI * 2;
    const drift = (n() - 0.5) * 0.5;
    const width =
      (t.strokeWidth?.[0] ?? 0.32) +
      n() * ((t.strokeWidth?.[1] ?? 0.62) - (t.strokeWidth?.[0] ?? 0.32));
    let c = dark[Math.floor(n() * dark.length)].clone();
    // The side toward the light catches more of the edge colours.
    const facing = Math.cos(phi0 - t.litFrom);
    if (n() < 0.3 + 0.3 * Math.max(0, facing)) c.lerp(C(edge[Math.floor(n() * edge.length)]), 0.85);
    c = c.multiplyScalar(0.9 + n() * 0.25);
    const ou = n();
    const ov = n();
    const rows: THREE.Vector3[][] = [];
    for (let j = 0; j <= ALONG; j++) {
      const f = j / ALONG;
      const s1 = Math.min(0.999, t0 + f * len);
      const phi = phi0 + drift * f;
      const r = Math.max(0.12, radius(tg, s1));
      // Tapered at both ends, fullest just past the middle.
      const w = width * Math.sin(Math.PI * (0.12 + 0.76 * f)) ** 0.7;
      const dphi = w / 2 / r;
      rows.push([
        tongueAt(tg, s1, phi - dphi, 0.04),
        tongueAt(tg, s1, phi, 0.1 + w * 0.15),
        tongueAt(tg, s1, phi + dphi, 0.04),
      ]);
    }
    ribbons.add(rows, c, ou, ov, (j) => ((j / ALONG) * len * tg.h) / 3.2);
  }
  const strokeGeo = keep(ribbons.geometry());

  const tree = new THREE.Mesh(keep(mergeGeometries(tongues)), treeMat);
  const strokes = new THREE.Mesh(strokeGeo, strokeMat);
  for (const m of [tree, strokes]) {
    m.position.set(t.x, t.y, t.z);
    scene.add(m);
  }
  tongues.forEach((g) => g.dispose());
}

/**
 * The material raised strokes are drawn with: the bristle tile on them, and
 * `glow` of their own colour kept in shade. Two-sided for strokes seen from
 * behind (petals).
 */
export async function strokeMaterial(
  stage: Stage,
  glow: number,
  { twoSided = false, dark = 0.55 }: { twoSided?: boolean; dark?: number } = {},
) {
  // The darker the tile's grooves, the darker the strokes: bright petals want a light one.
  const tile = await stage.tile(
    `flame-strokes:${dark}`,
    { angle: Math.PI / 2, wave: 0.35, len: 4, width: 22, seed: 14, dark },
    5,
  );
  const mat = stage.painted(tile, 1.2, twoSided ? { side: THREE.DoubleSide } : {});
  return customize(mat, `strokes:${glow}:${twoSided}`, (shader) => glowInShade(shader, glow));
}

/**
 * A bush or round tree: where it stands, how wide and how tall. With
 * `trunk`, its leaves are held that far off the ground on a bare stem, so
 * the land shows under them.
 */
export type Bush = { x: number; z: number; r: number; h: number; trunk?: number };

/**
 * Bushes and round trees: each a few bumpy lumps drawn up into a point,
 * painted with flickering upward strokes, the side toward the light catching
 * its edge colours, outlined in `ink`. `rand` lets a world share one random
 * sequence with what it built before.
 */
export async function addBushes(
  stage: Stage,
  o: {
    bushes: Bush[];
    heightAt: (x: number, z: number) => number;
    rand: () => number;
    dark: string[];
    edge: string[];
    /** Which side catches the light: +1 toward +x, −1 toward −x. */
    litSide: 1 | -1;
    /** How much of each stroke is edge colour on the lit side. */
    edgeChance: number;
    ink: string;
    glow: number;
    /** The colours of a tree's bare stem, if any has one. */
    stems?: string[];
    /**
     * Covers each lump in raised strokes flicking upward, over a darker
     * `under`: how many per square metre (phones, elsewhere), and how long
     * and wide they are, in metres.
     */
    strokes?: {
      perSquareMetre: [number, number];
      len: [number, number];
      width: [number, number];
      under: string[];
    };
  },
) {
  const { keep, painted, paintColor, outline, worldUV, scene, low } = stage;
  const n = o.rand;
  const fol = { dark: o.dark.map(C), edge: o.edge.map(C) };
  const under = o.strokes?.under.map(C);
  const blobs: THREE.BufferGeometry[] = [];
  const treeInk: THREE.BufferGeometry[] = [];
  /** Each lump's shape, for laying strokes on it. */
  const shapes: {
    cx: number;
    cy: number;
    cz: number;
    R: number;
    H: number;
    ph: number;
    t: Bush;
  }[] = [];
  const stems = (o.stems ?? o.dark).map(C);
  await breathe();
  for (const [bi, t] of o.bushes.entries()) {
    if (bi % 24 === 23) await breathe();
    const up = t.trunk ?? 0;
    if (up > 0) {
      // A stem that leans and twists a little on its way up into the leaves.
      const tall = up + t.h * 0.4;
      const stem = new THREE.CylinderGeometry(t.r * 0.09, t.r * 0.17, tall, 7, 4).toNonIndexed();
      const sp = stem.attributes.position;
      const ph = n() * 6.3;
      for (let j = 0; j < sp.count; j++) {
        const f = sp.getY(j) / tall + 0.5;
        sp.setX(j, sp.getX(j) + Math.sin(f * 2.4 + ph) * t.r * 0.1);
        sp.setZ(j, sp.getZ(j) + Math.cos(f * 1.9 + ph) * t.r * 0.08);
      }
      stem.translate(t.x, o.heightAt(t.x, t.z) + tall / 2 - 0.25, t.z);
      stem.computeVertexNormals();
      treeInk.push(outline(stem, 1.08));
      // One colour a face, as each lump's strokes are.
      let c = stems[0];
      paintColor(stem, (j) => {
        if (j % 6 === 0) c = stems[Math.floor(n() * stems.length)];
        return c;
      });
      blobs.push(stem);
    }
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
      const cy = o.heightAt(t.x, t.z) + up + t.h * (0.4 - (k === 0 ? 0 : 0.15));
      b.translate(t.x + ox, cy, t.z + oz);
      shapes.push({ cx: t.x + ox, cy, cz: t.z + oz, R: t.r * s, H: (t.h / 2) * s, ph, t });
      // Smooth shading across the lumps' facets, then split, so each stroke takes its own colour.
      const smoothB = mergeVertices(b);
      b.dispose();
      smoothB.computeVertexNormals();
      const g = smoothB.toNonIndexed();
      smoothB.dispose();
      treeInk.push(outline(g, 1.06));
      paintColor(g, (_, v) => {
        if (under) return under[Math.floor(n() * under.length)];
        const c = fol.dark[Math.floor(n() * fol.dark.length)].clone();
        // The side facing the light catches its edge colours.
        const lit = (v.x - t.x) * o.litSide > 0 && n() < o.edgeChance;
        return lit ? c.lerp(fol.edge[Math.floor(n() * fol.edge.length)], 0.55) : c;
      });
      blobs.push(g);
    }
  }
  const flameTile = await stage.tile("flame", {
    angle: Math.PI / 2,
    wave: 0.55,
    len: 5,
    width: 32,
    seed: 13,
    dark: 0.5,
  });
  const mat = painted(flameTile, 1);
  customize(mat, `bush:${o.glow}`, (shader) => glowInShade(shader, o.glow));
  scene.add(new THREE.Mesh(keep(worldUV(mergeGeometries(blobs), 3)), mat));
  scene.add(new THREE.Mesh(keep(mergeGeometries(treeInk)), stage.ink(o.ink)));
  [...blobs, ...treeInk].forEach((g) => g.dispose());

  if (!o.strokes) return;
  await breathe();
  const st = o.strokes;
  /** A point on a lump: `theta` round it, `phi` up it from its equator, `lift` out from it. */
  const lumpAt = (L: (typeof shapes)[number], theta: number, phi: number, lift: number) => {
    const x = Math.cos(phi) * Math.cos(theta);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.sin(theta);
    const bump = 1 + 0.18 * Math.sin(x * 5 + L.ph) * Math.sin(y * 4 + z * 3 + L.ph);
    const tip = y > 0 ? 1 - 0.35 * y * y : 1;
    const p = new THREE.Vector3(x * bump * tip * L.R, y * bump * L.H, z * bump * tip * L.R);
    const out = p.clone().normalize();
    return p.addScaledVector(out, lift).add(new THREE.Vector3(L.cx, L.cy, L.cz));
  };
  const ribbons = strokeRibbons();
  const ALONG = 4;
  for (const [li, L] of shapes.entries()) {
    if (li % 60 === 59) await breathe();
    // Roughly the lump's skin, above the ground.
    const area = 4 * Math.PI * Math.pow(L.R * L.R * L.H, 2 / 3) * 0.8;
    const count = Math.round(area * st.perSquareMetre[low ? 0 : 1]);
    for (let i = 0; i < count; i++) {
      const theta0 = n() * Math.PI * 2;
      const phi0 = -0.3 + n() * 1.55;
      const len = st.len[0] + n() * (st.len[1] - st.len[0]);
      const width = st.width[0] + n() * (st.width[1] - st.width[0]);
      const drift = (n() - 0.5) * 0.6;
      let c = fol.dark[Math.floor(n() * fol.dark.length)].clone();
      // The side toward the light catches its edge colours.
      const facing = Math.cos(theta0) * o.litSide;
      if (n() < o.edgeChance * (0.35 + 0.65 * Math.max(0, facing)) + 0.08)
        c.lerp(fol.edge[Math.floor(n() * fol.edge.length)], 0.8);
      c = c.multiplyScalar(0.9 + n() * 0.2);
      const rMean = (L.R + L.H) / 2;
      const rows: THREE.Vector3[][] = [];
      for (let j = 0; j <= ALONG; j++) {
        const f = j / ALONG;
        // Up the lump, leaning as it goes, as his strokes flick upward.
        const phi = Math.min(1.45, phi0 + (f * len) / rMean);
        const theta = theta0 + drift * f * (len / rMean);
        const w = width * Math.sin(Math.PI * (0.12 + 0.76 * f)) ** 0.7;
        const dth = w / 2 / Math.max(0.3, L.R * Math.cos(phi));
        rows.push([
          lumpAt(L, theta - dth, phi, 0.03),
          lumpAt(L, theta, phi, 0.07 + w * 0.15),
          lumpAt(L, theta + dth, phi, 0.03),
        ]);
      }
      ribbons.add(rows, c, n(), n(), (j) => ((j / ALONG) * len) / 3.2);
    }
  }
  const strokeTile = await stage.tile(
    "flame-strokes",
    { angle: Math.PI / 2, wave: 0.35, len: 4, width: 22, seed: 14, dark: 0.55 },
    5,
  );
  const strokeMat = painted(strokeTile, 1.2);
  customize(strokeMat, `bush-strokes:${o.glow}`, (shader) => glowInShade(shader, o.glow));
  scene.add(new THREE.Mesh(keep(ribbons.geometry()), strokeMat));
}
