import { seededRandom } from "@/lib/museum/placeholder";
import type { PlaceholderPattern } from "@/lib/museum/types";

/**
 * Everything the 3D floor paints on a canvas before handing it to the GPU:
 * floors, wall text, labels, light pools, the view from the lounge and the
 * stand-ins for works without an image yet. No image files, so it all works
 * offline and in any wall color.
 */

export type Fonts = { sans: string; display: string };

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mixes `hex` toward `toward` by `amount` (0–1). */
export function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function luma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Oak planks running along the floor, 2 m of floor per tile of texture. */
export function woodFloor(): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 1024);
  const rand = seededRandom(7);
  const plank = 1024 / 14; // ≈ 14 cm boards
  for (let row = 0; row < 14; row++) {
    const y = row * plank;
    // Boards of random length, staggered from row to row.
    let x = -rand() * 600;
    while (x < 1024) {
      const len = 420 + rand() * 520;
      const tone = 0.94 + rand() * 0.09;
      const r = Math.round(184 * tone);
      const g = Math.round(152 * tone);
      const b = Math.round(118 * tone);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, len, plank);
      // Grain.
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = `rgba(${r * 0.7},${g * 0.66},${b * 0.6},${0.12 + rand() * 0.14})`;
        ctx.lineWidth = 0.6 + rand() * 1.4;
        const gy = y + 4 + rand() * (plank - 8);
        ctx.beginPath();
        ctx.moveTo(x, gy);
        for (let gx = x; gx < x + len; gx += 40) {
          ctx.lineTo(gx + 40, gy + Math.sin(gx * 0.013 + i) * 2.4);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(60,38,20,0.35)";
      ctx.fillRect(x, y, 2, plank);
      x += len;
    }
    ctx.fillStyle = "rgba(60,38,20,0.32)";
    ctx.fillRect(0, y, 1024, 2);
  }
  return c;
}

/** Honed limestone in big slabs, for the lobby: 4 m of floor per tile of texture. */
export function stoneFloor(): HTMLCanvasElement {
  const [c, ctx] = canvas(1024, 1024);
  const rand = seededRandom(11);
  const slab = 256; // 1 m × 2 m slabs, staggered
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col < 3; col++) {
      const x = col * slab * 2 + (row % 2) * slab;
      const tone = 0.95 + rand() * 0.06;
      ctx.fillStyle = `rgb(${Math.round(214 * tone)},${Math.round(207 * tone)},${Math.round(194 * tone)})`;
      ctx.fillRect(x, row * slab, slab * 2, slab);
    }
  }
  // Fossil flecks and soft clouds in the stone.
  for (let i = 0; i < 260; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const shade = rand() < 0.5 ? "120,110,96" : "250,246,238";
    g.addColorStop(0, `rgba(${shade},0.10)`);
    g.addColorStop(1, `rgba(${shade},0)`);
    ctx.save();
    ctx.translate(rand() * 1024, rand() * 1024);
    ctx.scale(20 + rand() * 70, 8 + rand() * 30);
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(110,100,86,${0.08 + rand() * 0.2})`;
    ctx.fillRect(rand() * 1024, rand() * 1024, 1 + rand() * 2, 1 + rand() * 1.5);
  }
  ctx.fillStyle = "rgba(96,88,78,0.45)";
  for (let row = 0; row < 4; row++) {
    ctx.fillRect(0, row * slab, 1024, 2);
    for (let col = -1; col < 3; col++) ctx.fillRect(col * slab * 2 + (row % 2) * slab, row * slab, 2, slab);
  }
  return c;
}

/**
 * Adds `weight` × smooth noise that tiles into `out` (size × size): `cells`
 * random values across the tile each way, eased between. Cell lookups are
 * worked out once per row and column, so the inner loop is a few reads.
 */
function addTilingNoise(out: Float32Array, size: number, cells: number, seed: number, weight: number) {
  const rand = seededRandom(seed);
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = (rand() + rand()) / 2;
  const c0 = new Int32Array(size);
  const c1 = new Int32Array(size);
  const t = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / size) * cells;
    const x0 = Math.floor(x);
    const f = x - x0;
    c0[i] = x0 % cells;
    c1[i] = (x0 + 1) % cells;
    t[i] = f * f * (3 - 2 * f);
  }
  for (let j = 0; j < size; j++) {
    const r0 = c0[j] * cells;
    const r1 = c1[j] * cells;
    const ty = t[j];
    const row = j * size;
    for (let i = 0; i < size; i++) {
      const tx = t[i];
      const a = grid[r0 + c0[i]] + (grid[r0 + c1[i]] - grid[r0 + c0[i]]) * tx;
      const b = grid[r1 + c0[i]] + (grid[r1 + c1[i]] - grid[r1 + c0[i]]) * tx;
      out[row + i] += weight * (a + (b - a) * ty);
    }
  }
}

/**
 * Painted plaster, 2 m per tile. `map` is a near-white tint (linear, to be
 * multiplied into the wall's paint): the faint clouding of a hand-finished
 * wall under emulsion. `bump` is its relief: the orange peel a roller
 * leaves, and the gentle waves of the plaster under it.
 */
export function plaster(size: number): { map: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const [map, mctx] = canvas(size, size);
  const [bump, bctx] = canvas(size, size);
  const n = size * size;
  const cloud = new Float32Array(n);
  addTilingNoise(cloud, size, 3, 21, 0.5);
  addTilingNoise(cloud, size, 7, 22, 0.3);
  addTilingNoise(cloud, size, 16, 23, 0.2);
  const fine = new Float32Array(n);
  addTilingNoise(fine, size, Math.round(size / 6), 24, 0.6);
  addTilingNoise(fine, size, Math.round(size / 3), 25, 0.4);
  const waves = new Float32Array(n);
  addTilingNoise(waves, size, 10, 26, 1);
  const rand = seededRandom(27);
  const m = mctx.createImageData(size, size);
  const h = bctx.createImageData(size, size);
  for (let k = 0; k < n; k++) {
    // Within 4% of white: enough to break up a flat colour, never enough to look dirty.
    const tint = 1 - 0.03 * cloud[k] - 0.012 * fine[k] - 0.004 * rand();
    const o = k * 4;
    m.data[o] = m.data[o + 1] = m.data[o + 2] = Math.round(tint * 255);
    m.data[o + 3] = 255;
    const relief = 0.7 * fine[k] + 0.3 * waves[k];
    h.data[o] = h.data[o + 1] = h.data[o + 2] = Math.round(relief * 255);
    h.data[o + 3] = 255;
  }
  mctx.putImageData(m, 0, 0);
  bctx.putImageData(h, 0, 0);
  return { map, bump };
}

/** Pale concrete pavers for the sidewalk, 4 m per tile. */
export function pavement(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 512);
  const rand = seededRandom(31);
  ctx.fillStyle = "#b9b4ab";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      const t = 0.92 + rand() * 0.12;
      ctx.fillStyle = `rgba(${Math.round(190 * t)},${Math.round(185 * t)},${Math.round(176 * t)},1)`;
      ctx.fillRect(x + 1, y + 1, 126, 126);
    }
  }
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = rand() < 0.5 ? "rgba(70,66,60,0.12)" : "rgba(255,255,250,0.12)";
    ctx.fillRect(rand() * 512, rand() * 512, 1.5, 1.5);
  }
  // A few stains, so it's been walked on.
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(60,56,50,${0.04 + rand() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(rand() * 512, rand() * 512, 6 + rand() * 22, 4 + rand() * 14, rand() * 3, 0, 7);
    ctx.fill();
  }
  return c;
}

/** Asphalt with its grain, 4 m per tile. */
export function asphalt(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 512);
  const rand = seededRandom(37);
  ctx.fillStyle = "#3d3e40";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const v = Math.round(40 + rand() * 50);
    ctx.fillStyle = `rgba(${v},${v},${v + 2},0.5)`;
    ctx.fillRect(rand() * 512, rand() * 512, 1.6, 1.6);
  }
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = "rgba(20,20,22,0.35)";
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    let x = rand() * 512;
    let y = rand() * 512;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rand() - 0.5) * 60;
      y += (rand() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

/** Weathered hardwood decking for the terrace, 2 m per tile. */
export function deck(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 512);
  const rand = seededRandom(41);
  const board = 512 / 14;
  for (let i = 0; i < 14; i++) {
    const t = 0.9 + rand() * 0.16;
    ctx.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(128 * t)},${Math.round(104 * t)})`;
    ctx.fillRect(i * board, 0, board - 3, 512);
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = `rgba(80,62,44,${0.1 + rand() * 0.12})`;
      ctx.fillRect(i * board + 2 + rand() * (board - 8), 0, 1, 512);
    }
  }
  return c;
}

/**
 * The façade's white panels: horizontal ripples, like wind on water, that
 * catch the light on their upper faces. Shading is painted in, so it reads
 * outdoors without a sun lamp. 4 m wide by 2 m tall per tile.
 */
export function facadeRipples(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 512);
  const rand = seededRandom(43);
  const img = ctx.createImageData(512, 512);
  const phases = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      // Ripples whose spacing and depth drift across the panel.
      const u = x / 512;
      const v = y / 512;
      const wave =
        Math.sin(v * Math.PI * 2 * 9 + Math.sin(u * Math.PI * 2 + phases[0]) * 1.6 + phases[1]) *
          (0.6 + 0.4 * Math.sin(u * Math.PI * 2 * 2 + phases[2])) +
        0.35 * Math.sin(v * Math.PI * 2 * 23 + Math.sin(u * Math.PI * 4 + phases[3]) * 2);
      const slope = wave;
      const shade = 236 + slope * 13;
      const i = (y * 512 + x) * 4;
      img.data[i] = shade;
      img.data[i + 1] = shade - 1;
      img.data[i + 2] = shade - 4;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Panel joints.
  ctx.fillStyle = "rgba(120,118,112,0.5)";
  ctx.fillRect(0, 0, 512, 2);
  ctx.fillRect(0, 0, 2, 512);
  return c;
}

/** A building's face of windows: glass, mullions, a few lit or with blinds down. */
export function cityWindows(variant: number): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 256);
  const rand = seededRandom(51 + variant * 7);
  const walls = ["#c9c1b4", "#a7a49e", "#d8d2c6", "#8f8a84", "#b9a58f"];
  ctx.fillStyle = walls[variant % walls.length];
  ctx.fillRect(0, 0, 256, 256);
  const cols = variant % 2 === 0 ? 4 : 3;
  const rows = 4;
  const cw = 256 / cols;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = k * cw + cw * 0.16;
      const y = r * rh + rh * 0.22;
      const w = cw * 0.68;
      const h = rh * 0.56;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      const lit = rand() < 0.12;
      g.addColorStop(0, lit ? "#f3dfae" : "#6f8297");
      g.addColorStop(1, lit ? "#d9b878" : "#2f3a46");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      if (rand() < 0.3) {
        ctx.fillStyle = "rgba(230,226,214,0.85)";
        ctx.fillRect(x, y, w, h * (0.2 + rand() * 0.6));
      }
      ctx.fillStyle = "rgba(30,30,30,0.5)";
      ctx.fillRect(x + w / 2 - 1, y, 2, h);
    }
  }
  return c;
}

/** A wall of plants: hundreds of leaves in many greens, 3 m per tile. */
export function livingWall(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 512);
  const rand = seededRandom(61);
  ctx.fillStyle = "#1f3a22";
  ctx.fillRect(0, 0, 512, 512);
  const greens = ["#2f5a2c", "#3f7a37", "#5c8f3c", "#284d2a", "#6fa04a", "#3b6a45", "#86a95a", "#4d7a52"];
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const s = 3 + rand() * 9;
    ctx.fillStyle = greens[Math.floor(rand() * greens.length)];
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * (0.35 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // Light on the top of each leaf.
    ctx.fillStyle = "rgba(220,240,180,0.10)";
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.2, s * 0.6, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Clumps of flowers.
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rand() < 0.5 ? "rgba(214,120,150,0.8)" : "rgba(240,220,140,0.8)";
    const x = rand() * 512;
    const y = rand() * 512;
    for (let k = 0; k < 8; k++) ctx.fillRect(x + (rand() - 0.5) * 14, y + (rand() - 0.5) * 14, 2.5, 2.5);
  }
  return c;
}

/** Spines of books on a shelf, for the store and the reading rooms. */
export function bookSpines(variant: number): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 128);
  const rand = seededRandom(71 + variant);
  ctx.fillStyle = "#2a241f";
  ctx.fillRect(0, 0, 512, 128);
  const colors = ["#c8442f", "#1f4e79", "#e5d8b8", "#2f6b4f", "#d9a62e", "#111111", "#f2efe8", "#7a3b5a", "#5b6d7a"];
  let x = 0;
  while (x < 512) {
    const w = 6 + rand() * 14;
    const h = 80 + rand() * 46;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(x, 128 - h, w - 1, h);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 1, 128 - h + 8, w - 3, 2);
    x += w;
  }
  return c;
}

/** Lightmap for a floor: dark under walls and furniture, softening away from them. */
export function floorShade(
  size: { w: number; h: number },
  pxPerM: number,
  solids: { x0: number; z0: number; x1: number; z1: number; dark: number }[],
  origin: { x: number; z: number },
): HTMLCanvasElement {
  const w = Math.max(1, Math.ceil(size.w * pxPerM));
  const h = Math.max(1, Math.ceil(size.h * pxPerM));
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  for (const s of solids) {
    ctx.fillStyle = `rgba(0,0,0,${s.dark})`;
    ctx.fillRect(
      (s.x0 - origin.x) * pxPerM,
      (s.z0 - origin.z) * pxPerM,
      (s.x1 - s.x0) * pxPerM,
      (s.z1 - s.z0) * pxPerM,
    );
  }
  // Blur in place: three box passes make a soft falloff.
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) src[i] = img.data[i * 4];
  const tmp = new Float32Array(w * h);
  const r = Math.max(1, Math.round(pxPerM * 0.35));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * r + 1);
        acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    // Gentle: 255 in the open, never below about 40% against a wall.
    const v = 100 + (src[i] / 255) * 155;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Light falling through glass: a bright panel crossed by the mullions' shadows. */
export function sunThroughGlass(cols: number, transom: number): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(255,236,200,0.9)");
  g.addColorStop(1, "rgba(255,236,200,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  for (let i = 0; i <= cols; i++) ctx.fillRect((i * 512) / cols - 4, 0, 8, 256);
  if (transom > 0 && transom < 1) ctx.fillRect(0, transom * 256 - 5, 512, 10);
  // Soft edges.
  ctx.globalCompositeOperation = "destination-in";
  const e = ctx.createLinearGradient(0, 0, 512, 0);
  e.addColorStop(0, "rgba(0,0,0,0)");
  e.addColorStop(0.04, "rgba(0,0,0,1)");
  e.addColorStop(0.96, "rgba(0,0,0,1)");
  e.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = e;
  ctx.fillRect(0, 0, 512, 256);
  return c;
}

/** A soft vertical shaft of light, for the beam under the oculus. */
export function lightBeam(): HTMLCanvasElement {
  const [c, ctx] = canvas(128, 256);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, "rgba(255,246,226,0)");
  g.addColorStop(0.5, "rgba(255,246,226,1)");
  g.addColorStop(1, "rgba(255,246,226,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  ctx.globalCompositeOperation = "destination-in";
  const v = ctx.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, "rgba(0,0,0,0.9)");
  v.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 128, 256);
  return c;
}

/** The skyline far off, as a band of silhouettes against the haze. */
export function skyline(): HTMLCanvasElement {
  const [c, ctx] = canvas(2048, 256);
  const rand = seededRandom(83);
  for (const [base, tone, maxH] of [
    [256, "rgba(150,162,176,0.55)", 150],
    [256, "rgba(118,128,142,0.7)", 100],
  ] as const) {
    let x = 0;
    while (x < 2048) {
      const bw = 14 + rand() * 60;
      const bh = 20 + rand() * maxH * (rand() < 0.1 ? 1.6 : 1);
      ctx.fillStyle = tone;
      ctx.fillRect(x, base - bh, bw, bh);
      x += bw + rand() * 6;
    }
  }
  return c;
}

/** A soft pool of light for the wall around each painting. */
export function lightPool(): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 110, 4, 128, 128, 128);
  g.addColorStop(0, "rgba(255,244,222,1)");
  g.addColorStop(0.45, "rgba(255,240,214,0.45)");
  g.addColorStop(1, "rgba(255,236,206,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}

/** A soft dark spot, laid under furniture so it sits on the floor. */
export function contactShadow(): HTMLCanvasElement {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.5)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

/**
 * Large lettering painted on a wall, in the wall's ink. Transparent elsewhere.
 * The canvas grows to fit the longest line, so nothing is cut short.
 */
export function wallLettering(
  lines: { text: string; size: number; weight?: number; font?: "sans" | "display" }[],
  ink: string,
  fonts: Fonts,
  minWidth = 1024,
): { canvas: HTMLCanvasElement; aspect: number } {
  const pad = 8;
  const gap = 0.32;
  const fontOf = (l: (typeof lines)[number]) =>
    `${l.weight ?? 600} ${l.size}px ${l.font === "display" ? fonts.display : fonts.sans}`;
  const [, probe] = canvas(1, 1);
  const widest = Math.max(
    ...lines.map((l) => {
      probe.font = fontOf(l);
      return probe.measureText(l.text).width;
    }),
  );
  const width = Math.min(4096, Math.max(minWidth, Math.ceil(widest + pad * 2)));
  const height = Math.ceil(lines.reduce((h, l, i) => h + l.size * (i ? 1 + gap : 1.05), 0) + pad * 2);
  const [c, ctx] = canvas(width, height);
  ctx.fillStyle = ink;
  ctx.textBaseline = "top";
  let y = pad;
  lines.forEach((l, i) => {
    if (i) y += l.size * gap;
    ctx.font = fontOf(l);
    ctx.fillText(fit(ctx, l.text, width - pad * 2), pad, y);
    y += l.size;
  });
  return { canvas: c, aspect: width / height };
}

/** The little card beside a painting: title, artist, date, medium. */
export function wallLabel(
  art: { title: string; artist: string; date: string; medium: string },
  fonts: Fonts,
): HTMLCanvasElement {
  const [c, ctx] = canvas(480, 300);
  ctx.fillStyle = "#f7f4ee";
  ctx.fillRect(0, 0, 480, 300);
  ctx.fillStyle = "#151515";
  ctx.textBaseline = "top";
  ctx.font = `600 34px ${fonts.sans}`;
  const title = wrap(ctx, art.title, 432).slice(0, 2);
  title.forEach((line, i) => ctx.fillText(line, 24, 26 + i * 40));
  let y = 26 + title.length * 40 + 14;
  ctx.font = `400 28px ${fonts.sans}`;
  ctx.fillText(fit(ctx, art.artist, 432), 24, y);
  y += 36;
  ctx.fillStyle = "#555";
  ctx.font = `400 24px ${fonts.sans}`;
  ctx.fillText(fit(ctx, art.date, 432), 24, y);
  y += 32;
  wrap(ctx, art.medium, 432)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, 24, y + i * 30));
  return c;
}

/** The info stand's top: the room's movement and title, inviting a closer look. */
export function standTop(
  room: { title: string; movement: { name: string; period: string; palette: string[] } },
  fonts: Fonts,
): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 360);
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(0, 0, 512, 360);
  room.movement.palette.slice(0, 5).forEach((p, i, all) => {
    ctx.fillStyle = p;
    ctx.fillRect((i * 512) / all.length, 0, 512 / all.length + 1, 18);
  });
  ctx.fillStyle = "#f4f0e8";
  ctx.textBaseline = "top";
  ctx.font = `700 46px ${fonts.display}`;
  wrap(ctx, room.movement.name, 460)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, 26, 50 + i * 52));
  ctx.font = `400 28px ${fonts.sans}`;
  ctx.fillStyle = "#bdb8ae";
  ctx.fillText(fit(ctx, room.movement.period, 460), 26, 170);
  ctx.fillStyle = "#f4f0e8";
  wrap(ctx, room.title, 460)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, 26, 216 + i * 36));
  ctx.fillStyle = "#ff2e63";
  ctx.font = `600 24px ${fonts.sans}`;
  ctx.fillText("Press E or tap to read more", 26, 312);
  return c;
}

/** The lit floor number over the lift doors. */
export function floorIndicator(level: number, fonts: Fonts): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 96);
  ctx.fillStyle = "#101112";
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#ffb347";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 64px ${fonts.sans}`;
  ctx.fillText(String(level), 128, 52);
  ctx.font = `600 28px ${fonts.sans}`;
  ctx.fillText("▲", 54, 50);
  ctx.fillText("▼", 202, 50);
  return c;
}

/** An empty frame's card in the Community Gallery. */
export function waitingCard(ink: string, wall: string, fonts: Fonts): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 384);
  ctx.fillStyle = mix(wall, luma(wall) < 110 ? "#ffffff" : "#000000", 0.08);
  ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 34px ${fonts.sans}`;
  ctx.fillText("This frame is waiting", 256, 170);
  ctx.font = `400 26px ${fonts.sans}`;
  ctx.globalAlpha = 0.75;
  ctx.fillText("Make something in the Studio", 256, 220);
  return c;
}

/** Canvas twin of the SVG placeholders in `artwork-frame.tsx`. */
export function placeholderArt(
  pattern: PlaceholderPattern,
  palette: string[],
  s: number,
  w = 640,
  h = 480,
): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const pick = (n: number) => palette[(s + n) % palette.length];
  switch (pattern) {
    case "stripes": {
      const count = 10 + (s % 8);
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = i % 2 ? pick(0) : pick(1);
        ctx.fillRect((i * w) / count, 0, w / count + 1, h);
      }
      ctx.fillStyle = pick(2);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * (0.22 + (s % 12) / 100), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "grid": {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = pick(i);
        ctx.fillRect((i % 2) * (w / 2), Math.floor(i / 2) * (h / 2), w / 2 + 1, h / 2 + 1);
      }
      break;
    }
    case "field": {
      ctx.fillStyle = pick(0);
      ctx.fillRect(0, 0, w, h);
      const bands = 2 + (s % 2);
      const m = w * 0.06;
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = pick(i + 1);
        const bh = (h - m * 2) / bands - m / 2;
        ctx.fillRect(m, m + i * (bh + m / 2), w - m * 2, bh);
      }
      break;
    }
    case "gesture": {
      ctx.fillStyle = palette[palette.length - 1];
      ctx.fillRect(0, 0, w, h);
      const rand = seededRandom(s);
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = pick(i);
        ctx.lineWidth = 12 + rand() * 24;
        ctx.beginPath();
        ctx.moveTo(rand() * w, rand() * h);
        ctx.bezierCurveTo(rand() * w, rand() * h, rand() * w, rand() * h, rand() * w, rand() * h);
        ctx.stroke();
      }
      break;
    }
    default: {
      // ben-day
      ctx.fillStyle = pick(1);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = pick(0);
      for (let dy = 8; dy < h; dy += 16) {
        for (let dx = 8; dx < w; dx += 16) {
          ctx.beginPath();
          ctx.arc(dx, dy, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = pick(2);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w * (0.35 + (s % 30) / 100), h * 0.45, Math.min(w, h) * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  return c;
}

/**
 * Loads an artwork (JPEG or Studio SVG) and rasterizes it at a size the GPU
 * likes, so vector pieces stay crisp up close.
 */
export function loadArt(src: string, w: number, h: number, max = 1024): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(w, h)) || 1;
      const [c, ctx] = canvas(
        Math.max(1, Math.round(w * scale)),
        Math.max(1, Math.round(h * scale)),
      );
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
