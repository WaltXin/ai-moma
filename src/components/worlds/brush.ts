import { worldRandom } from "@/lib/worlds/random";
import { MOON, SKY, STARS, skyFlow, swirlAt, wrap } from "@/lib/worlds/starry-night";

/**
 * Paint for the Starry Night world, laid down stroke by stroke on canvases:
 * the whole sky as one panorama (every stroke following the swirls), and
 * small tiles of brushwork that the hills, houses and cypress are painted with.
 */

/** The sky panorama covers every azimuth, and elevations from just below the horizon to straight up. */
export const SKY_EL_MIN = (-12 * Math.PI) / 180;
export const SKY_EL_MAX = Math.PI / 2;

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lerp = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: RGB, k = 1) =>
  `rgb(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))})`;

/** The sky's colour behind the strokes at an elevation: pale at the horizon, deep ultramarine overhead. */
function groundTone(el: number): RGB {
  const t = (el - SKY_EL_MIN) / (SKY_EL_MAX - SKY_EL_MIN);
  const stops: [number, RGB][] = [
    [0, rgb(SKY.horizon)],
    [0.16, rgb(SKY.low)],
    [0.42, rgb(SKY.high)],
    [1, rgb(SKY.zenith)],
  ];
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

/** How far a sky point is from a star or the moon, in that light's own radii (Infinity if none near). */
function nearestLight(az: number, el: number): { kind: "star" | "moon"; d: number } | null {
  let best: { kind: "star" | "moon"; d: number } | null = null;
  const test = (kind: "star" | "moon", p: { az: number; el: number }, r: number) => {
    const d = Math.hypot(wrap(az - p.az) * Math.cos(el), el - p.el) / r;
    if (d < 1 && (!best || d < best.d)) best = { kind, d };
  };
  for (const s of STARS) test("star", s, 0.06 * s.size);
  test("moon", MOON, MOON.size * 1.6);
  return best;
}

/**
 * Paints the sky panorama. `width` is the canvas's width (all 360°); its
 * height keeps pixels square. Returns the canvas ready to use as a texture.
 */
export function paintSky(width: number): HTMLCanvasElement {
  const W = width;
  const H = Math.round((W * (SKY_EL_MAX - SKY_EL_MIN)) / (Math.PI * 2));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const pxPerRad = W / (Math.PI * 2);
  const toX = (az: number) => (wrap(az) / (Math.PI * 2) + 0.5) * W;
  const toY = (el: number) => (1 - (el - SKY_EL_MIN) / (SKY_EL_MAX - SKY_EL_MIN)) * H;
  const elOf = (y: number) => SKY_EL_MIN + (1 - y / H) * (SKY_EL_MAX - SKY_EL_MIN);
  const rand = worldRandom(1889);

  // The ground of the painting: a smooth wash, row by row.
  for (let y = 0; y < H; y += 2) {
    g.fillStyle = css(groundTone(elOf(y)));
    g.fillRect(0, y, W, 2);
  }

  g.lineCap = "round";
  g.lineJoin = "round";

  /** A stroke that follows the flow from (az, el), drawn twice where it crosses the seam. */
  const stroke = (az: number, el: number, len: number, width: number, color: string) => {
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
      const f = skyFlow(a, e);
      const step = len / steps;
      a += (f.x * step) / Math.max(0.25, Math.cos(e));
      e += f.y * step;
    }
    g.strokeStyle = color;
    g.lineWidth = width;
    for (const shift of [0, -W, W]) {
      const xs = pts.map((p) => p[0] + shift);
      if (Math.max(...xs) < -width || Math.min(...xs) > W + width) continue;
      g.beginPath();
      g.moveTo(xs[0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(xs[i], pts[i][1]);
      g.stroke();
    }
  };

  const scale = W / 4096;
  const deep = SKY.deep.map(rgb);
  const swirl = SKY.swirl.map(rgb);
  const halo = SKY.halo.map(rgb);
  const starC = SKY.star.map(rgb);
  const moonC = SKY.moon.map(rgb);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  /** Where to put the next stroke: mostly in front, where the painting is. */
  const place = () => {
    const az =
      rand() < 0.7 ? (rand() - 0.5) * ((150 * Math.PI) / 180) : (rand() - 0.5) * Math.PI * 2;
    const el = SKY_EL_MIN + rand() * (SKY_EL_MAX - SKY_EL_MIN - 0.08);
    return { az, el };
  };

  // Underpainting: long, broad, thin strokes that set the swirl's colours down.
  for (let i = 0; i < 9000; i++) {
    const { az, el } = place();
    const s = swirlAt(az, el);
    const base = groundTone(el);
    const col = rand() < s ? lerp(base, pick(swirl), 0.55) : lerp(base, pick(deep), 0.35);
    g.globalAlpha = 0.35;
    stroke(az, el, 0.06 + rand() * 0.04, (8 + rand() * 6) * scale, css(col));
  }
  g.globalAlpha = 1;

  // The strokes: short, thick, side by side, each one colour.
  const count = Math.round(70000 * Math.min(1, 0.55 + scale * 0.45));
  for (let i = 0; i < count; i++) {
    const { az, el } = place();
    const light = nearestLight(az, el);
    let col: RGB;
    let len = 0.022 + rand() * 0.03;
    let width = (4.5 + rand() * 4) * scale;
    if (light?.kind === "star") {
      col =
        light.d < 0.45
          ? pick(starC)
          : light.d < 0.75
            ? lerp(pick(starC), pick(halo), 0.6)
            : pick(halo);
      len *= 0.6;
    } else if (light?.kind === "moon") {
      col = light.d < 0.5 ? pick(moonC) : lerp(pick(moonC), rgb(SKY.star[1]), 0.5);
      len *= 0.6;
    } else {
      const s = swirlAt(az, el);
      const base = groundTone(el);
      if (rand() < s * 1.1) col = lerp(base, pick(swirl), 0.6 + 0.4 * rand());
      else col = lerp(base, pick(deep), 0.5 + 0.5 * rand());
      // Now and then a dark seam of blue between the strokes, as he drew them.
      if (rand() < 0.12) {
        col = rgb("#0c1c4a");
        width *= 0.55;
      }
    }
    stroke(az, el, len, width, css(col, 0.9 + rand() * 0.2));
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
        );
      }
    }
  };
  for (const s of STARS) {
    rings(
      s.az,
      s.el,
      0.05 * s.size,
      [starC, [...starC, ...halo], halo, [...halo, ...swirl]],
      0.012,
    );
  }
  rings(
    MOON.az,
    MOON.el,
    MOON.size * 1.45,
    [moonC, [moonC[0], moonC[1], starC[1]], [starC[1], starC[3]], [...halo, starC[1]]],
    0.016,
  );

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
    }
  };
  for (const s of STARS) disc(s.az, s.el, 0.016 * s.size, "#fffdf0", "rgba(248,226,122,0)");

  // The moon: an orange disc, and a lemon crescent on it.
  disc(MOON.az, MOON.el, MOON.size * 0.75, SKY.moon[1], "rgba(224,125,34,0)");
  const mx = toX(MOON.az);
  const my = toY(MOON.el);
  const mr = MOON.size * 0.5 * pxPerRad;
  g.save();
  g.beginPath();
  g.arc(mx, my, mr, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = SKY.moon[0];
  g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  g.fillStyle = SKY.moon[2];
  g.beginPath();
  g.arc(mx + mr * 0.55, my - mr * 0.25, mr * 0.95, 0, Math.PI * 2);
  g.fill();
  g.restore();

  return c;
}

/**
 * The flow of the sky as a small data texture (RG = direction, in the
 * panorama's own pixel axes), for the shader that keeps the strokes moving.
 */
export function skyFlowData(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const el = SKY_EL_MIN + (1 - (y + 0.5) / height) * (SKY_EL_MAX - SKY_EL_MIN);
    for (let x = 0; x < width; x++) {
      const az = ((x + 0.5) / width - 0.5) * Math.PI * 2;
      const f = skyFlow(az, el);
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
      data[i + 2] = Math.round(swirlAt(az, el) * 255);
      data[i + 3] = 255;
    }
  }
  return data;
}

/**
 * A square tile of brushwork, seamless when repeated: grey strokes over grey,
 * to be multiplied with a surface's own colour. `angle` is the strokes' main
 * direction (0 along the tile's u), `wave` how much they bend about it.
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
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const rand = worldRandom(seed);
  g.fillStyle = "rgb(215,215,215)";
  g.fillRect(0, 0, size, size);
  g.lineCap = "round";
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
    g.strokeStyle = `rgb(${tone},${tone},${tone})`;
    g.lineWidth = width * (0.7 + rand() * 0.6);
    const dx = Math.cos(a) * l;
    const dy = Math.sin(a) * l;
    const bend = (rand() - 0.5) * l * 0.4;
    // Drawn again on the far sides, so the tile repeats without a seam.
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const sx = x + ox;
        const sy = y + oy;
        if (sx + l < 0 || sx - l > size || sy + l < 0 || sy - l > size) continue;
        g.beginPath();
        g.moveTo(sx - dx / 2, sy - dy / 2);
        g.quadraticCurveTo(
          sx - dy * 0.0 + bend * Math.sin(a),
          sy + bend * Math.cos(a),
          sx + dx / 2,
          sy + dy / 2,
        );
        g.stroke();
      }
    }
  }
  return c;
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
