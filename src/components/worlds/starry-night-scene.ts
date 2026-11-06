import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldRandom } from "@/lib/worlds/random";
import {
  CHURCH,
  CYPRESS,
  MOON,
  RIDGES,
  STARS,
  VILLAGE,
  blocked,
  heightAt,
  insideBounds,
  ridgeAt,
} from "@/lib/worlds/starry-night";
import { SKY_EL_MAX, SKY_EL_MIN, brushTile, glow, paintSky, skyFlowData } from "./brush";

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

export function createStarryNightScene(
  canvas: HTMLCanvasElement,
  { low }: { low: boolean },
): WorldScene {
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

  // ── The sky: one painted panorama, its strokes sliding along the flow ──
  const sky = new THREE.Group();
  scene.add(sky);
  const skyCanvas = paintSky(low ? 2048 : 4096);
  // Lets a browser console look at the painted panorama while developing.
  if (process.env.NODE_ENV === "development") Object.assign(window, { __skyCanvas: skyCanvas });
  const skyTex = texture(skyCanvas, false);
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.generateMipmaps = false;
  skyTex.minFilter = THREE.LinearFilter;
  const FW = 256;
  const FH = Math.round((FW * (SKY_EL_MAX - SKY_EL_MIN)) / (Math.PI * 2));
  const flowTex = keep(new THREE.DataTexture(skyFlowData(FW, FH), FW, FH, THREE.RGBAFormat));
  flowTex.flipY = true;
  flowTex.wrapS = THREE.RepeatWrapping;
  flowTex.magFilter = flowTex.minFilter = THREE.LinearFilter;
  flowTex.needsUpdate = true;
  const skyMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uSky: { value: skyTex }, uFlow: { value: flowTex }, uTime: time },
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
        uniform sampler2D uFlow;
        uniform float uTime;
        varying vec3 vDir;
        const float PI = 3.14159265;
        const float EL_MIN = ${SKY_EL_MIN.toFixed(5)};
        const float EL_MAX = ${SKY_EL_MAX.toFixed(5)};
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
          vec3 c0 = texture2D(uSky, uv - step * amp * (t0 - 0.5)).rgb;
          vec3 c1 = texture2D(uSky, uv - step * amp * (t1 - 0.5)).rgb;
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

  // ── Brushwork for everything solid ──
  const tileSize = low ? 256 : 512;
  const grassTile = texture(
    brushTile(tileSize, {
      angle: 0.15,
      wave: 0.7,
      len: tileSize / 9,
      width: tileSize / 70,
      seed: 11,
    }),
  );
  const wallTile = texture(
    brushTile(tileSize, {
      angle: 0,
      wave: 0.15,
      len: tileSize / 12,
      width: tileSize / 50,
      seed: 12,
      dark: 0.65,
    }),
  );
  const flameTile = texture(
    brushTile(tileSize, {
      angle: Math.PI / 2,
      wave: 0.55,
      len: tileSize / 6,
      width: tileSize / 55,
      seed: 13,
      dark: 0.55,
    }),
  );
  const hillTile = texture(
    brushTile(tileSize, {
      angle: 0.05,
      wave: 0.35,
      len: tileSize / 7,
      width: tileSize / 60,
      seed: 14,
      dark: 0.6,
    }),
  );
  const lambert = (map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) =>
    keep(new THREE.MeshLambertMaterial({ map, vertexColors: true, ...extra }));

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

  // ── The ground: the hill underfoot, the valley, the land rising far off ──
  const ground = (() => {
    const g = new THREE.PlaneGeometry(1100, 620, low ? 120 : 220, low ? 70 : 124);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -190);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const near = [C("#1f3f37"), C("#2f5a49"), C("#3c5d3a")];
    const valley = [C("#1b3358"), C("#22406b"), C("#2a4a6e")];
    const far = C("#2e4f86");
    const n = worldRandom(5);
    paintColor(g, (_, v) => {
      const d = Math.hypot(v.x, v.z + 4);
      const a = near[Math.floor(n() * near.length)].clone();
      const b = valley[Math.floor(n() * valley.length)];
      const c = a.lerp(b, THREE.MathUtils.smoothstep(d, 45, 110));
      return c.lerp(far, THREE.MathUtils.smoothstep(-v.z, 280, 420));
    });
    worldUV(g, 9);
    const mesh = new THREE.Mesh(keep(g), lambert(grassTile));
    scene.add(mesh);
    return mesh;
  })();

  // ── The hills: curtains of blue, ridge behind ridge, each with a dark line along its top ──
  for (const r of RIDGES) {
    const N = 220;
    const pos: number[] = [];
    const line: number[] = [];
    const idx: number[] = [];
    const thick = 1.4 + Math.abs(r.z) * 0.004;
    for (let i = 0; i <= N; i++) {
      const x = -1300 + (i / N) * 2600;
      const top = ridgeAt(r, x);
      pos.push(x, top, r.z, x, heightAt(x, r.z) - 12, r.z);
      line.push(x, top + thick * 0.4, r.z + 1, x, top - thick, r.z + 1);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const make = (verts: number[], color: string, lighten: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const base = C(color);
      paintColor(g, (i) =>
        i % 2 === 0 ? base.clone().lerp(C("#9fb8de"), lighten) : base.clone().multiplyScalar(0.8),
      );
      const uv = new Float32Array((verts.length / 3) * 2);
      for (let i = 0; i < verts.length / 3; i++) {
        uv[i * 2] = verts[i * 3] / 30;
        uv[i * 2 + 1] = verts[i * 3 + 1] / 30;
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      return keep(g);
    };
    scene.add(
      new THREE.Mesh(make(pos, r.color, 0.18), lambert(hillTile, { side: THREE.DoubleSide })),
    );
    scene.add(
      new THREE.Mesh(
        make(line, "#13285a", 0),
        keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })),
      ),
    );
  }

  // ── The village ──
  {
    const walls: THREE.BufferGeometry[] = [];
    const roofs: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    const wallColors = ["#33466e", "#3c4f7a", "#465a7c", "#545d74", "#2a3a63", "#5d6276"];
    const roofColors = ["#6d8cbf", "#8aa0c4", "#5876aa", "#9aa8bf", "#7d94b9", "#b98a4e"];
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
      walls.push(paintColor(place(body, x, y, z, rot), C(wallHex)));
      const roof = prism(w, d, rise);
      roof.translate(0, h + 0.3, 0);
      roofs.push(paintColor(place(roof, x, y, z, rot), C(roofHex)));
      for (const win of windows) {
        const pane = new THREE.PlaneGeometry(0.8, 1.0).toNonIndexed();
        pane.translate((win.u - 0.5) * w, 0.3 + win.v * h, d / 2 + 0.03);
        lights.push(paintColor(place(pane, x, y, z, rot), C(n() < 0.3 ? "#ffb347" : "#ffe27a")));
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
      "#223265",
      "#4c6698",
    );
    {
      const tx = CHURCH.x + Math.sin(CHURCH.rot) * (CHURCH.d / 2 + 1.5);
      const tz = CHURCH.z + Math.cos(CHURCH.rot) * (CHURCH.d / 2 + 1.5);
      const y = heightAt(tx, tz) - 0.3;
      const tower = new THREE.BoxGeometry(3.6, CHURCH.h + 7, 3.6).toNonIndexed();
      tower.translate(0, (CHURCH.h + 7) / 2, 0);
      walls.push(paintColor(place(tower, tx, y, tz, CHURCH.rot), C("#1d2b5a")));
      const spire = new THREE.ConeGeometry(2.3, CHURCH.spire, 8).toNonIndexed();
      spire.translate(0, CHURCH.h + 7 + CHURCH.spire / 2, 0);
      roofs.push(paintColor(place(spire, tx, y, tz, CHURCH.rot), C("#22346a")));
    }
    const wallGeo = keep(worldUV(mergeGeometries(walls), 3));
    const roofGeo = keep(worldUV(mergeGeometries(roofs), 3));
    scene.add(new THREE.Mesh(wallGeo, lambert(wallTile)));
    scene.add(new THREE.Mesh(roofGeo, lambert(wallTile)));
    scene.add(
      new THREE.Mesh(
        keep(mergeGeometries(lights)),
        keep(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })),
      ),
    );
    [...walls, ...roofs, ...lights].forEach((g) => g.dispose());

    // Dark trees round the village and along the valley.
    const blobs: THREE.BufferGeometry[] = [];
    for (const t of VILLAGE.trees) {
      const b = new THREE.IcosahedronGeometry(1, 1);
      b.scale(t.r, t.h / 2, t.r);
      b.translate(t.x, heightAt(t.x, t.z) + t.h * 0.4, t.z);
      blobs.push(paintColor(b, C(n() < 0.5 ? "#13292c" : "#1b3536")));
    }
    scene.add(new THREE.Mesh(keep(worldUV(mergeGeometries(blobs), 4)), lambert(flameTile)));
    blobs.forEach((g) => g.dispose());
  }

  // ── The cypress: tongues of dark flame twisting up round one another ──
  const cypressMat = lambert(flameTile);
  cypressMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float k = pow(max(position.y, 0.0) / ${CYPRESS.height.toFixed(1)}, 1.6);
      transformed.x += sin(uTime * 0.7 + position.y * 0.18) * 0.5 * k;
      transformed.z += cos(uTime * 0.55 + position.y * 0.13) * 0.32 * k;`,
    );
  };
  {
    const n = worldRandom(42);
    const tongues: THREE.BufferGeometry[] = [];
    const dark = [C("#18331f"), C("#21402a"), C("#2a4d30"), C("#1c3b35")];
    const edge = [C("#4d6b38"), C("#6b6a34"), C("#3f5f46"), C("#5a4a2a"), C("#7a8a48")];
    const COUNT = 18;
    for (let i = 0; i < COUNT; i++) {
      const h = CYPRESS.height * (i === 0 ? 1 : 0.3 + n() * 0.66);
      const r0 = CYPRESS.radius * (i === 0 ? 0.7 : 0.32 + n() * 0.42);
      const pts: THREE.Vector2[] = [];
      for (let k = 0; k <= 26; k++) {
        const t = k / 26;
        const r = r0 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85) * (1 - 0.6 * t) + 0.04;
        pts.push(new THREE.Vector2(r, t * h));
      }
      const lathe = new THREE.LatheGeometry(pts, 12);
      const ang = (i / COUNT) * Math.PI * 2 + n();
      const off = i === 0 ? 0 : CYPRESS.radius * (0.35 + n() * 0.6);
      const twist = 0.5 + n() * 0.9;
      const phase = n() * 6.3;
      // Each tongue spirals up round the trunk and flicks outward at its tip.
      const spiral = (n() < 0.5 ? -1 : 1) * (0.8 + n() * 1.2);
      const flick = 0.6 + n() * 1.4;
      const lp = lathe.attributes.position;
      for (let j = 0; j < lp.count; j++) {
        const x = lp.getX(j);
        const y = lp.getY(j);
        const z = lp.getZ(j);
        const t = y / h;
        const a = twist * t * 2.2;
        const around = ang + spiral * t;
        const reach = off * (1 - t * 0.75) + flick * t ** 3;
        const cx = Math.cos(around) * reach + Math.sin(t * 5 + phase) * 0.6 * t;
        const cz = Math.sin(around) * reach + Math.cos(t * 4 + phase) * 0.45 * t;
        lp.setXYZ(
          j,
          x * Math.cos(a) - z * Math.sin(a) + cx,
          y,
          x * Math.sin(a) + z * Math.cos(a) + cz,
        );
      }
      // Smooth shading on the shared vertices first; then split them, so each stroke can take its own colour.
      lathe.computeVertexNormals();
      const g = lathe.toNonIndexed();
      lathe.dispose();
      const p = g.attributes.position;
      paintColor(g, () => {
        const c = dark[Math.floor(n() * dark.length)].clone();
        return n() < 0.3 ? c.lerp(edge[Math.floor(n() * edge.length)], 0.75) : c;
      });
      // Strokes run up the tree, round its girth.
      const uv = new Float32Array(p.count * 2);
      for (let j = 0; j < p.count; j++) {
        uv[j * 2] = (Math.atan2(p.getZ(j), p.getX(j)) * CYPRESS.radius) / 2.4;
        uv[j * 2 + 1] = p.getY(j) / 3.2;
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      tongues.push(g);
    }
    const tree = new THREE.Mesh(keep(mergeGeometries(tongues)), cypressMat);
    tree.position.set(CYPRESS.x, heightAt(CYPRESS.x, CYPRESS.z) - 0.4, CYPRESS.z);
    scene.add(tree);
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
