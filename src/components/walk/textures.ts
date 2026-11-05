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

/** Pale terrazzo laid in 1 m squares, for the corridor and the lift lobby. */
export function stoneFloor(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 512);
  const rand = seededRandom(11);
  ctx.fillStyle = "#c4bdb2";
  ctx.fillRect(0, 0, 512, 512);
  const chips = ["#a9a296", "#dcd7cf", "#8d867b", "#b9a990", "#6f6a62"];
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = chips[Math.floor(rand() * chips.length)];
    const s = 1 + rand() * 3.2;
    ctx.beginPath();
    ctx.ellipse(rand() * 512, rand() * 512, s, s * (0.5 + rand() * 0.6), rand() * 3, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(90,84,76,0.35)";
  for (const p of [0, 256]) {
    ctx.fillRect(p, 0, 2, 512);
    ctx.fillRect(0, p, 512, 2);
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

/** The view from the lounge windows: an evening sky over a low city. */
export function windowView(widthM: number): HTMLCanvasElement {
  const w = Math.min(4096, Math.round(widthM * 160));
  const [c, ctx] = canvas(w, 420);
  const sky = ctx.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, "#7fa4c9");
  sky.addColorStop(0.55, "#c9d6df");
  sky.addColorStop(0.8, "#f1d9b5");
  sky.addColorStop(1, "#e9c79c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, 420);
  const rand = seededRandom(23);
  // Two rows of buildings, the far one hazier.
  for (const [base, tone, maxH] of [
    [330, "rgba(108,122,140,0.55)", 150],
    [370, "rgba(70,78,92,0.85)", 120],
  ] as const) {
    let x = 0;
    while (x < w) {
      const bw = 30 + rand() * 90;
      const bh = 20 + rand() * maxH;
      ctx.fillStyle = tone;
      ctx.fillRect(x, base - bh, bw, 420);
      x += bw + rand() * 8;
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, w, 420);
  return c;
}

/** Large lettering painted on a wall, in the wall's ink. Transparent elsewhere. */
export function wallLettering(
  lines: { text: string; size: number; weight?: number; font?: "sans" | "display" }[],
  ink: string,
  fonts: Fonts,
  width = 1024,
): { canvas: HTMLCanvasElement; aspect: number } {
  const pad = 8;
  const gap = 0.32;
  const height = Math.ceil(
    lines.reduce((h, l, i) => h + l.size * (i ? 1 + gap : 1.05), 0) + pad * 2,
  );
  const [c, ctx] = canvas(width, height);
  ctx.fillStyle = ink;
  ctx.textBaseline = "top";
  let y = pad;
  lines.forEach((l, i) => {
    if (i) y += l.size * gap;
    ctx.font = `${l.weight ?? 600} ${l.size}px ${l.font === "display" ? fonts.display : fonts.sans}`;
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
