import { worldRandom } from "@/lib/worlds/random";
import { wrap } from "@/lib/worlds/sky";

/**
 * Paint for painting worlds, laid down stroke by stroke on canvases: a whole
 * sky as one panorama (every stroke following its flow), surfaces such as
 * ground and hillsides, and small seamless tiles of brushwork. Every painter
 * also returns a height map of its strokes, so the paint can stand up off
 * the canvas when it's lit.
 */

/** The sky panorama covers every azimuth, and elevations from just below the horizon to straight up. */
export const SKY_EL_MIN = (-12 * Math.PI) / 180;
export const SKY_EL_MAX = Math.PI / 2;

export type RGB = [number, number, number];
export const rgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const lerp = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: RGB, k = 1) =>
  `rgb(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))})`;

/** A light in a sky: a star, the moon, the sun. Its colours reach into the strokes round it. */
export type SkyLight = {
  az: number;
  el: number;
  /** How far round it its colours reach into the strokes, in radians. */
  reach: number;
  /** A stroke's colour within that reach: `d` is 0 at the light, 1 at the edge. */
  tint(d: number, pick: <T>(xs: T[]) => T): RGB;
  /** Rings of short dabs round it, innermost first, alternating each ring's colours. */
  rings?: { radius: number; colors: RGB[][]; dab: number };
  /** A hot core: a disc that fades from `inner` to `outer`. */
  core?: { radius: number; inner: string; outer: string };
  /** Anything else drawn on top, such as the moon's crescent. */
  draw?(g: CanvasRenderingContext2D, at: { x: number; y: number; pxPerRad: number }): void;
  /** Light spilling round it in the scene, breathing a little. */
  glow?: { color: string; size: number; base: number; phase?: number; speed?: number };
};

/** How to paint a sky: its colours, where its strokes run, where it's paler, and its lights. */
export type SkySpec = {
  seed: number;
  /** The colour behind the strokes, from the bottom of the panorama (0) to straight up (1). */
  tones: [number, string][];
  /** Strokes where the sky swirls (`swirlAt` near 1), and everywhere else. */
  swirl: string[];
  deep: string[];
  /** Now and then a dark seam between the strokes. */
  seam: string;
  seamChance: number;
  /** How many strokes, at full size; and how many broad thin ones underneath first. */
  strokes: number;
  underStrokes: number;
  /** Which way strokes run at a point (unit length, in angular units). */
  flow(az: number, el: number): { x: number; y: number };
  /** How strongly a point belongs to a swirl (0–1). */
  swirlAt(az: number, el: number): number;
  lights: SkyLight[];
};

/** The sky's colour behind the strokes at an elevation. */
function toneAt(stops: [number, RGB][], el: number): RGB {
  const t = (el - SKY_EL_MIN) / (SKY_EL_MAX - SKY_EL_MIN);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0])
      return lerp(
        stops[i - 1][1],
        stops[i][1],
        (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]),
      );
  }
  return stops.at(-1)![1];
}

/** The light whose colours reach a sky point, and how far in (0 at it, 1 at its edge). */
function nearestLight(lights: SkyLight[], az: number, el: number) {
  let best: { light: SkyLight; d: number } | null = null;
  for (const l of lights) {
    const d = Math.hypot(wrap(az - l.az) * Math.cos(el), el - l.el) / l.reach;
    if (d < 1 && (!best || d < best.d)) best = { light: l, d };
  }
  return best;
}

/** A grey for the height map: 0 is the bare canvas, 1 the thickest paint. */
const grey = (h: number) => {
  const v = Math.round(Math.max(0, Math.min(1, h)) * 255);
  return `rgb(${v},${v},${v})`;
};

/**
 * Gives the main thread back for a moment, so the page stays responsive while
 * a world is painted. A message, not a timer: timers in a background tab
 * wait a whole second.
 */
export function breathe(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(null);
  });
}
/** How many strokes to lay between breaths. */
const BREATH = 4000;

/** Paint on a canvas, and how thick it stands on a second one the same size. */
export type Painted = { color: HTMLCanvasElement; relief: HTMLCanvasElement };

/** A fresh pair of canvases: the colour, and the height map under it, bare. */
function canvases(
  W: number,
  H: number,
): Painted & {
  g: CanvasRenderingContext2D;
  hg: CanvasRenderingContext2D;
} {
  const color = document.createElement("canvas");
  color.width = W;
  color.height = H;
  const relief = document.createElement("canvas");
  relief.width = W;
  relief.height = H;
  const g = color.getContext("2d")!;
  const hg = relief.getContext("2d")!;
  hg.fillStyle = grey(0.08);
  hg.fillRect(0, 0, W, H);
  for (const ctx of [g, hg]) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  return { color, relief, g, hg };
}

/**
 * Lays one stroke along `pts`: its colour on `g`, and on `hg` a raised ridge
 * (a shoulder, then the crown, then a groove or two the bristles dragged).
 * `relief` is how thick the paint stands (0 lays it flat).
 */
function lay(
  g: CanvasRenderingContext2D,
  hg: CanvasRenderingContext2D,
  pts: [number, number][],
  width: number,
  color: string,
  relief: number,
) {
  const last = pts.length - 1;
  // Across the stroke, for the bristle grooves: the normal of its overall direction.
  const dx = pts[last][0] - pts[0][0];
  const dy = pts[last][1] - pts[0][1];
  const dl = Math.hypot(dx, dy) || 1;
  const nx = -dy / dl;
  const ny = dx / dl;
  const path = (ctx: CanvasRenderingContext2D, off: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + nx * off, pts[0][1] + ny * off);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + nx * off, pts[i][1] + ny * off);
    ctx.stroke();
  };
  g.strokeStyle = color;
  g.lineWidth = width;
  path(g, 0);
  if (relief <= 0) return;
  hg.strokeStyle = grey(relief * 0.6);
  hg.lineWidth = width;
  path(hg, 0);
  hg.strokeStyle = grey(relief);
  hg.lineWidth = width * 0.55;
  path(hg, 0);
  if (width > 3) {
    hg.strokeStyle = grey(relief * 0.55);
    hg.lineWidth = Math.max(0.8, width * 0.1);
    path(hg, width * 0.2);
    path(hg, -width * 0.3);
  }
}

/**
 * Paints the sky panorama. `width` is the canvas's width (all 360°); its
 * height keeps pixels square. Returns the colour, and a height map of the
 * same strokes (each a raised ridge with the grooves its bristles left), so
 * a shader can light the paint as if it stood up off the canvas.
 */
export async function paintSky(width: number, spec: SkySpec): Promise<Painted> {
  const W = width;
  const H = Math.round((W * (SKY_EL_MAX - SKY_EL_MIN)) / (Math.PI * 2));
  const { color: c, relief: r, g, hg } = canvases(W, H);
  const pxPerRad = W / (Math.PI * 2);
  const toX = (az: number) => (wrap(az) / (Math.PI * 2) + 0.5) * W;
  const toY = (el: number) => (1 - (el - SKY_EL_MIN) / (SKY_EL_MAX - SKY_EL_MIN)) * H;
  const elOf = (y: number) => SKY_EL_MIN + (1 - y / H) * (SKY_EL_MAX - SKY_EL_MIN);
  const rand = worldRandom(spec.seed);
  const stops = spec.tones.map(([t, hex]) => [t, rgb(hex)] as [number, RGB]);
  const groundTone = (el: number) => toneAt(stops, el);

  // The ground of the painting: a smooth wash, row by row.
  for (let y = 0; y < H; y += 2) {
    g.fillStyle = css(groundTone(elOf(y)));
    g.fillRect(0, y, W, 2);
  }

  /**
   * A stroke that follows the flow from (az, el), drawn again where it crosses
   * the seam. `relief` is how thick the paint stands (0 lays it flat).
   */
  const stroke = (
    az: number,
    el: number,
    len: number,
    width: number,
    color: string,
    relief = 0,
  ) => {
    const steps = 4;
    const pts: [number, number][] = [];
    let a = az;
    let e = el;
    let lastX = toX(a);
    for (let i = 0; i <= steps; i++) {
      let x = toX(a);
      // Keep the stroke continuous across the panorama's seam.
      while (x - lastX > W / 2) x -= W;
      while (lastX - x > W / 2) x += W;
      lastX = x;
      pts.push([x, toY(e)]);
      const f = spec.flow(a, e);
      const step = len / steps;
      a += (f.x * step) / Math.max(0.25, Math.cos(e));
      e += f.y * step;
    }
    for (const shift of [0, -W, W]) {
      const xs = pts.map((p) => p[0] + shift);
      if (Math.max(...xs) < -width || Math.min(...xs) > W + width) continue;
      lay(
        g,
        hg,
        pts.map(([x, y]) => [x + shift, y]),
        width,
        color,
        relief,
      );
    }
  };

  const scale = W / 4096;
  const deep = spec.deep.map(rgb);
  const swirl = spec.swirl.map(rgb);
  const seam = rgb(spec.seam);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  /** Where to put the next stroke: mostly in front, where the painting is. */
  const place = () => {
    const az =
      rand() < 0.7 ? (rand() - 0.5) * ((150 * Math.PI) / 180) : (rand() - 0.5) * Math.PI * 2;
    const el = SKY_EL_MIN + rand() * (SKY_EL_MAX - SKY_EL_MIN - 0.08);
    return { az, el };
  };

  // Underpainting: long, broad, thin strokes that set the swirl's colours down.
  for (let i = 0; i < spec.underStrokes; i++) {
    if (i % BREATH === BREATH - 1) await breathe();
    const { az, el } = place();
    const s = spec.swirlAt(az, el);
    const base = groundTone(el);
    const col = rand() < s ? lerp(base, pick(swirl), 0.55) : lerp(base, pick(deep), 0.35);
    g.globalAlpha = 0.35;
    stroke(az, el, 0.06 + rand() * 0.04, (8 + rand() * 6) * scale, css(col), 0.18 + rand() * 0.1);
  }
  g.globalAlpha = 1;

  // The strokes: short, thick, side by side, each one colour.
  const count = Math.round(spec.strokes * Math.min(1, 0.55 + scale * 0.45));
  for (let i = 0; i < count; i++) {
    if (i % BREATH === BREATH - 1) await breathe();
    const { az, el } = place();
    const near = nearestLight(spec.lights, az, el);
    let col: RGB;
    let len = 0.022 + rand() * 0.03;
    let width = (4.5 + rand() * 4) * scale;
    let relief = 0.55 + rand() * 0.35;
    if (near) {
      col = near.light.tint(near.d, pick);
      len *= 0.6;
    } else {
      const s = spec.swirlAt(az, el);
      const base = groundTone(el);
      if (rand() < s * 1.1) col = lerp(base, pick(swirl), 0.6 + 0.4 * rand());
      else col = lerp(base, pick(deep), 0.5 + 0.5 * rand());
      // Now and then a dark seam of blue between the strokes, as he drew them.
      if (rand() < spec.seamChance) {
        col = seam;
        width *= 0.55;
        relief = 0.2;
      }
    }
    stroke(az, el, len, width, css(col, 0.9 + rand() * 0.2), relief);
  }

  /** Rings of short dabs round a light, alternating its colours, as each star is painted. */
  const rings = (az: number, el: number, radius: number, colors: RGB[][], dab: number) => {
    const n = colors.length;
    for (let k = 0; k < n; k++) {
      const r = radius * ((k + 1) / (n + 0.4));
      const around = Math.max(8, Math.round((Math.PI * 2 * r) / (dab * 0.55)));
      for (let i = 0; i < around; i++) {
        const t = (i / around) * Math.PI * 2 + rand() * 0.2;
        const a = az + (Math.cos(t) * r) / Math.max(0.25, Math.cos(el));
        const e = el + Math.sin(t) * r;
        stroke(
          a,
          e,
          dab * (0.8 + rand() * 0.4),
          (4 + rand() * 3) * scale,
          css(pick(colors[k]), 0.92 + rand() * 0.16),
          0.8 + rand() * 0.2,
        );
      }
    }
  };
  for (const l of spec.lights) {
    if (l.rings) rings(l.az, l.el, l.rings.radius, l.rings.colors, l.rings.dab);
  }

  // The lights themselves: a hot core in each halo.
  const disc = (az: number, el: number, r: number, inner: string, outer: string) => {
    const x = toX(az);
    const y = toY(el);
    const rr = r * pxPerRad;
    for (const shift of [0, -W, W]) {
      const grad = g.createRadialGradient(x + shift, y, 0, x + shift, y, rr);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.55, inner);
      grad.addColorStop(1, outer);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x + shift, y, rr, 0, Math.PI * 2);
      g.fill();
      // A thick, round dab of paint at the core.
      const hgrad = hg.createRadialGradient(x + shift, y, 0, x + shift, y, rr * 0.7);
      hgrad.addColorStop(0, grey(1));
      hgrad.addColorStop(1, grey(0.6));
      hg.fillStyle = hgrad;
      hg.beginPath();
      hg.arc(x + shift, y, rr * 0.7, 0, Math.PI * 2);
      hg.fill();
    }
  };
  for (const l of spec.lights) {
    if (l.core) disc(l.az, l.el, l.core.radius, l.core.inner, l.core.outer);
    l.draw?.(g, { x: toX(l.az), y: toY(l.el), pxPerRad });
  }

  return { color: c, relief: r };
}

/**
 * The flow of the sky as a small data texture (RG = direction, in the
 * panorama's own pixel axes), for the shader that keeps the strokes moving.
 */
export function skyFlowData(width: number, height: number, spec: SkySpec): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const el = SKY_EL_MIN + (1 - (y + 0.5) / height) * (SKY_EL_MAX - SKY_EL_MIN);
    for (let x = 0; x < width; x++) {
      const az = ((x + 0.5) / width - 0.5) * Math.PI * 2;
      const f = spec.flow(az, el);
      // In panorama pixels, a step in azimuth is longer the higher up it is.
      let u = f.x / Math.max(0.25, Math.cos(el));
      let v = f.y;
      const len = Math.hypot(u, v) || 1;
      u /= len;
      v /= len;
      const i = (y * width + x) * 4;
      data[i] = Math.round((u * 0.5 + 0.5) * 255);
      // Texture v runs up the panorama, as elevation does.
      data[i + 1] = Math.round((v * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(spec.swirlAt(az, el) * 255);
      data[i + 3] = 255;
    }
  }
  return data;
}

/**
 * A square tile of brushwork, seamless when repeated: grey strokes over grey,
 * to be multiplied with a surface's own colour, and the height map of the
 * same strokes, for a bump map. `angle` is the strokes' main direction (0
 * along the tile's u), `wave` how much they bend about it.
 */
export function brushTile(
  size: number,
  {
    angle,
    wave,
    len,
    width,
    seed,
    dark = 0.55,
  }: { angle: number; wave: number; len: number; width: number; seed: number; dark?: number },
): Painted {
  const { color, relief, g, hg } = canvases(size, size);
  const rand = worldRandom(seed);
  g.fillStyle = "rgb(215,215,215)";
  g.fillRect(0, 0, size, size);
  const count = Math.round((size * size) / (len * width * 0.45));
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a =
      angle +
      Math.sin((x / size) * Math.PI * 4 + (y / size) * Math.PI * 2) * wave +
      (rand() - 0.5) * 0.3;
    const l = len * (0.6 + rand() * 0.8);
    const tone = Math.round(255 * (dark + rand() * (1 - dark)));
    const w = width * (0.7 + rand() * 0.6);
    const h = 0.5 + rand() * 0.45;
    const dx = Math.cos(a) * l;
    const dy = Math.sin(a) * l;
    const bend = (rand() - 0.5) * l * 0.4;
    // Drawn again on the far sides, so the tile repeats without a seam.
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const sx = x + ox;
        const sy = y + oy;
        if (sx + l < 0 || sx - l > size || sy + l < 0 || sy - l > size) continue;
        const curve = (ctx: CanvasRenderingContext2D, style: string, lw: number) => {
          ctx.strokeStyle = style;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(sx - dx / 2, sy - dy / 2);
          ctx.quadraticCurveTo(
            sx + bend * Math.sin(a),
            sy + bend * Math.cos(a),
            sx + dx / 2,
            sy + dy / 2,
          );
          ctx.stroke();
        };
        curve(g, `rgb(${tone},${tone},${tone})`, w);
        curve(hg, grey(h * 0.6), w);
        curve(hg, grey(h), w * 0.5);
      }
    }
  }
  return { color, relief };
}

/**
 * How to paint a flat surface (ground seen from above, or a hillside seen
 * from the front). Positions are in metres: `s` across the canvas, `t` down it.
 */
export type Surface = {
  /** The canvas, in pixels, and how many metres one pixel covers. */
  width: number;
  height: number;
  metresPerPx: number;
  /** How many strokes to lay. Where strokes are bigger, fewer go, so cover stays even. */
  count: number;
  seed: number;
  /** The colour under everything at a point. */
  wash(s: number, t: number): RGB;
  /** How long a stroke is here, in metres. */
  size(s: number, t: number): number;
  /** Which way strokes run here (any length). */
  flow(s: number, t: number): [number, number];
  /** One stroke's colour here, and how thick it stands (0–1). */
  paint(s: number, t: number, rand: () => number): { color: RGB; relief: number };
  /** A stroke's width as a share of its length. */
  aspect?: number;
  /** How far, in radians, a stroke may turn from the flow. */
  jitter?: number;
};

/** Paints a surface stroke by stroke: an even wash, a thin underpainting, then thick strokes on top. */
export async function paintSurface(o: Surface): Promise<Painted> {
  const { width: W, height: H, metresPerPx: mpp } = o;
  const { color, relief, g, hg } = canvases(W, H);
  const rand = worldRandom(o.seed);
  const aspect = o.aspect ?? 0.3;
  const jitter = o.jitter ?? 0.35;

  const cell = 12;
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      g.fillStyle = css(o.wash((x + cell / 2) * mpp, (y + cell / 2) * mpp));
      g.fillRect(x, y, cell, cell);
    }
  }

  // The smallest stroke anywhere, so bigger ones can be spread out in proportion.
  let minLen = Infinity;
  for (let i = 0; i < 400; i++)
    minLen = Math.min(minLen, o.size(rand() * W * mpp, rand() * H * mpp));

  const strokeAt = (s: number, t: number, len: number) => {
    const pts: [number, number][] = [];
    let a = s;
    let b = t;
    const steps = 3;
    const turn = (rand() - 0.5) * 2 * jitter;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    for (let i = 0; i <= steps; i++) {
      pts.push([a / mpp, b / mpp]);
      const [fx, fy] = o.flow(a, b);
      const fl = Math.hypot(fx, fy) || 1;
      a += (((fx * cos - fy * sin) / fl) * len) / steps;
      b += (((fx * sin + fy * cos) / fl) * len) / steps;
    }
    // Start half a stroke back, so it's centred on where it was put.
    const ox = (pts[0][0] - pts[steps][0]) / 2;
    const oy = (pts[0][1] - pts[steps][1]) / 2;
    return pts.map(([x, y]) => [x + ox, y + oy] as [number, number]);
  };

  const place = () => {
    for (;;) {
      const s = rand() * W * mpp;
      const t = rand() * H * mpp;
      const len = o.size(s, t);
      if (rand() < (minLen / len) ** 2) return { s, t, len };
    }
  };

  // Underpainting: long, thin, flat-ish strokes that set the colours down.
  for (let i = 0; i < o.count * 0.2; i++) {
    if (i % BREATH === BREATH - 1) await breathe();
    const { s, t, len } = place();
    const { color: c } = o.paint(s, t, rand);
    lay(
      g,
      hg,
      strokeAt(s, t, len * 1.8),
      (len * aspect * 1.6) / mpp,
      css(lerp(o.wash(s, t), c, 0.5)),
      0.2,
    );
  }
  // The strokes: short, thick, side by side, each one colour.
  for (let i = 0; i < o.count; i++) {
    if (i % BREATH === BREATH - 1) await breathe();
    const { s, t, len: l } = place();
    const len = l * (0.7 + rand() * 0.6);
    const { color: c, relief: h } = o.paint(s, t, rand);
    lay(
      g,
      hg,
      strokeAt(s, t, len),
      Math.max(1.2, (len * aspect) / mpp) * (0.8 + rand() * 0.4),
      css(c, 0.92 + rand() * 0.16),
      h,
    );
  }
  return { color, relief };
}

/**
 * Turns a height map into a normal map, in place: each pixel's slope (how
 * steeply the paint rises across and down it) as a direction, so a lit
 * surface shows every ridge and groove at whatever distance it's seen.
 * `height` is how many pixels tall the thickest paint stands; `wrap` reads
 * across the edges, for tiles.
 */
export async function reliefToNormals(
  relief: HTMLCanvasElement,
  height: number,
  wrap: boolean,
): Promise<HTMLCanvasElement> {
  const W = relief.width;
  const H = relief.height;
  const ctx = relief.getContext("2d")!;
  const src = ctx.getImageData(0, 0, W, H).data;
  const out = ctx.createImageData(W, H);
  const o = out.data;
  const at = (x: number, y: number) => {
    if (wrap) {
      x = (x + W) % W;
      y = (y + H) % H;
    } else {
      x = x < 0 ? 0 : x >= W ? W - 1 : x;
      y = y < 0 ? 0 : y >= H ? H - 1 : y;
    }
    return src[(y * W + x) * 4] / 255;
  };
  for (let y = 0; y < H; y++) {
    if (y % Math.max(1, Math.round(1e6 / W)) === 0 && y > 0) await breathe();
    for (let x = 0; x < W; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * height;
      // Canvas rows run down; texture v runs up, so a rise down the rows tilts the normal up.
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * height;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * W + x) * 4;
      o[i] = Math.round((-dx / l) * 127.5 + 127.5);
      o[i + 1] = Math.round((dy / l) * 127.5 + 127.5);
      o[i + 2] = Math.round((1 / l) * 127.5 + 127.5);
      o[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return relief;
}

/** A soft round glow, for the light that spills round each star and the moon. */
export function glow(size: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.2, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
