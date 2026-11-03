import { type Rng, n, pts } from "./rng";

/**
 * Generative "Studio pieces": original artworks drawn with code, using a
 * movement's techniques (never copying a specific work). They hang in rooms
 * whose historic works are still under copyright, until visitors' AI-made
 * pieces replace them.
 *
 * Every recipe is deterministic: the same seed always draws the same SVG.
 * SVGs use only system fonts so they also render inside <canvas>.
 */

export type Recipe = {
  width: number;
  height: number;
  /** Lenticular pieces have several frames; everything else has one. */
  frames?: number;
  render: (rng: Rng, frame: number) => string;
};

const SANS = "Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

/** Short, fat, round-capped strokes: a quick painterly texture over a region. */
function brush(
  rng: Rng,
  count: number,
  box: { x: number; y: number; w: number; h: number },
  colors: readonly string[],
  opts: { len?: [number, number]; width?: [number, number]; angle?: number; opacity?: number } = {},
) {
  const [l0, l1] = opts.len ?? [18, 50];
  const [w0, w1] = opts.width ?? [6, 14];
  const base = opts.angle ?? 0;
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = box.x + rng() * box.w;
    const y = box.y + rng() * box.h;
    const a = base + rng.range(-0.5, 0.5);
    const l = rng.range(l0, l1);
    out += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x + Math.cos(a) * l)}" y2="${n(y + Math.sin(a) * l)}" stroke="${rng.pick(colors)}" stroke-width="${n(rng.range(w0, w1))}" stroke-linecap="round" opacity="${opts.opacity ?? 0.55}"/>`;
  }
  return out;
}

/** A wavy band from the left edge to the right edge, filled down to `bottom`. */
function wave(rng: Rng, w: number, y: number, amp: number, bottom: number) {
  const k = rng.range(1.2, 2.8);
  const phase = rng.range(0, Math.PI * 2);
  const points: [number, number][] = [];
  for (let x = 0; x <= w; x += 20)
    points.push([x, y + Math.sin((x / w) * Math.PI * k + phase) * amp]);
  return `M0 ${bottom} L${pts(points).replaceAll(" ", " L")} L${w} ${bottom} Z`;
}

const benDay = (id: string, color: string, size = 12, r = 3.2) =>
  `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}"/></pattern>`;

// ── Fauvism ──────────────────────────────────────────────────────────────

const FAUVE = [
  "#e63946",
  "#ff9f1c",
  "#2a9d8f",
  "#6a4c93",
  "#1d4ed8",
  "#22c55e",
  "#f72585",
  "#ffd166",
];

function fauveScene(rng: Rng, harbor: boolean) {
  const W = 800;
  const H = 800;
  const sky = rng.pick(["#ff7eb6", "#ffb347", "#7fd1ff", "#c084fc"]);
  const horizon = H * rng.range(0.4, 0.5);
  let s = `<rect width="${W}" height="${H}" fill="${sky}"/>`;
  s += brush(rng, 120, { x: 0, y: 0, w: W, h: horizon }, FAUVE, { opacity: 0.45 });
  const sx = rng.range(120, 680);
  s += `<circle cx="${n(sx)}" cy="${n(horizon * 0.4)}" r="${n(rng.range(48, 76))}" fill="${rng.pick(["#f9e04b", "#7ee081", "#ff5d8f"])}" stroke="#ff6b00" stroke-width="10"/>`;
  if (harbor) {
    s += `<rect y="${n(horizon)}" width="${W}" height="${n(H - horizon)}" fill="#1d4ed8"/>`;
    s += brush(rng, 260, { x: 0, y: horizon, w: W, h: H - horizon }, FAUVE, {
      len: [30, 80],
      width: [8, 16],
      opacity: 0.7,
    });
    // Hills on the far shore
    s += `<path d="${wave(rng, W, horizon - 40, 26, horizon + 4)}" fill="${rng.pick(FAUVE)}" stroke="#1e2a78" stroke-width="6"/>`;
    for (let i = 0; i < rng.int(3, 5); i++) {
      const bx = rng.range(40, 680);
      const by = rng.range(horizon + 80, H - 120);
      const bw = rng.range(90, 150);
      const hull = rng.pick(FAUVE);
      s += `<polygon points="${pts([
        [bx, by],
        [bx + bw, by],
        [bx + bw * 0.82, by + 34],
        [bx + bw * 0.16, by + 34],
      ])}" fill="${hull}" stroke="#1e2a78" stroke-width="5"/>`;
      const mx = bx + bw * 0.5;
      s += `<line x1="${n(mx)}" y1="${n(by)}" x2="${n(mx)}" y2="${n(by - 120)}" stroke="#1e2a78" stroke-width="5"/>`;
      s += `<polygon points="${pts([
        [mx + 4, by - 116],
        [mx + 4, by - 10],
        [mx + rng.range(50, 80), by - 10],
      ])}" fill="${rng.pick(["#ffd166", "#ffffff", "#f72585", "#22c55e"])}" stroke="#1e2a78" stroke-width="4"/>`;
      for (let k = 0; k < 4; k++) {
        const rx = bx + rng.range(10, bw - 10);
        s += `<path d="M${n(rx)} ${n(by + 40)} q 8 14 0 28 q -8 14 0 28" stroke="${hull}" stroke-width="5" fill="none" opacity="0.8"/>`;
      }
    }
  } else {
    let y = horizon;
    const bands = rng.int(3, 4);
    for (let i = 0; i < bands; i++) {
      s += `<path d="${wave(rng, W, y, rng.range(20, 50), H)}" fill="${rng.pick(FAUVE)}" stroke="#1e2a78" stroke-width="6"/>`;
      y += (H - horizon) / bands;
    }
    for (let i = 0; i < rng.int(3, 6); i++) {
      const tx = rng.range(40, 760);
      const ty = rng.range(horizon + 40, H - 60);
      s += `<line x1="${n(tx)}" y1="${n(ty)}" x2="${n(tx + rng.range(-10, 10))}" y2="${n(ty - 110)}" stroke="#6a1b9a" stroke-width="12" stroke-linecap="round"/>`;
      s += `<circle cx="${n(tx)}" cy="${n(ty - 140)}" r="${n(rng.range(40, 60))}" fill="${rng.pick(FAUVE)}" stroke="#1e2a78" stroke-width="5"/>`;
    }
    s += brush(rng, 140, { x: 0, y: horizon, w: W, h: H - horizon }, FAUVE, { opacity: 0.5 });
  }
  return s;
}

function fauvePortrait(rng: Rng) {
  const [left, right] = rng.pick([
    ["#ff9f1c", "#6a4c93"],
    ["#2a9d8f", "#e63946"],
    ["#f72585", "#22c55e"],
  ]);
  let s = `<rect width="400" height="800" fill="${left}"/><rect x="400" width="400" height="800" fill="${right}"/>`;
  s += brush(rng, 160, { x: 0, y: 0, w: 800, h: 800 }, FAUVE, { opacity: 0.35 });
  // Shoulders and dress
  s += `<path d="M150 800 C170 640 290 600 400 600 C510 600 630 640 650 800 Z" fill="${rng.pick(["#1d4ed8", "#e63946", "#6a4c93"])}" stroke="#1e2a78" stroke-width="8"/>`;
  s += `<rect x="360" y="500" width="80" height="120" fill="#f4a261" stroke="#1e2a78" stroke-width="6"/>`;
  // Face: two halves in different colors, a green stripe down the middle
  s += `<clipPath id="face"><ellipse cx="400" cy="380" rx="150" ry="190"/></clipPath>`;
  s += `<g clip-path="url(#face)"><rect x="240" y="180" width="160" height="400" fill="#f4a6a6"/><rect x="400" y="180" width="160" height="400" fill="#c5e17a"/><rect x="392" y="190" width="18" height="300" fill="#2f9e44"/></g>`;
  s += `<ellipse cx="400" cy="380" rx="150" ry="190" fill="none" stroke="#1e2a78" stroke-width="8"/>`;
  // Hair
  s += `<path d="M245 340 C230 180 330 150 400 150 C480 150 580 190 556 340 C540 260 470 230 400 236 C330 230 270 260 245 340 Z" fill="#1b1464" stroke="#1e2a78" stroke-width="6"/>`;
  // Features
  for (const [ex, c] of [
    [335, "#1b1464"],
    [465, "#1b1464"],
  ] as const) {
    s += `<path d="M${ex - 34} 360 Q ${ex} 336 ${ex + 34} 360 Q ${ex} 378 ${ex - 34} 360 Z" fill="#fff" stroke="${c}" stroke-width="5"/><circle cx="${ex}" cy="359" r="9" fill="${c}"/>`;
    s += `<path d="M${ex - 40} 324 Q ${ex} 304 ${ex + 40} 322" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  }
  s += `<path d="M400 380 L382 450 L410 452" stroke="#1e2a78" stroke-width="6" fill="none" stroke-linejoin="round"/>`;
  s += `<path d="M352 498 Q 400 520 448 498 Q 400 486 352 498 Z" fill="#d00000" stroke="#7a0000" stroke-width="3"/>`;
  return s;
}

// ── Cubism ───────────────────────────────────────────────────────────────

const CUBIST = [
  "#8d6e63",
  "#a1887f",
  "#c0a062",
  "#6d7f5f",
  "#546e7a",
  "#d7ccc8",
  "#bcaaa4",
  "#4e342e",
];

function cubist(rng: Rng) {
  const W = 800;
  const H = 1000;
  const cols = 6;
  const rows = 8;
  const grid: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    grid.push([]);
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      const jx = edge ? 0 : rng.range(-50, 50);
      const jy = edge ? 0 : rng.range(-50, 50);
      grid[j].push([(i / cols) * W + jx, (j / rows) * H + jy]);
    }
  }
  let s = `<defs><pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#3e2723" opacity="0.5"/></pattern></defs>`;
  s += `<rect width="${W}" height="${H}" fill="#bcaaa4"/>`;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const d = grid[j + 1][i];
      const tris = rng.chance(0.5)
        ? [
            [a, b, c],
            [a, c, d],
          ]
        : [
            [a, b, d],
            [b, c, d],
          ];
      for (const t of tris) {
        s += `<polygon points="${pts(t as [number, number][])}" fill="${rng.pick(CUBIST)}" stroke="#3e2723" stroke-width="2"/>`;
        if (rng.chance(0.18))
          s += `<polygon points="${pts(t as [number, number][])}" fill="url(#grain)"/>`;
        if (rng.chance(0.3))
          s += `<polygon points="${pts(t as [number, number][])}" fill="${rng.chance(0.5) ? "#fff" : "#000"}" opacity="0.14"/>`;
      }
    }
  }
  // A guitar seen from two sides at once
  const gx = rng.range(300, 480);
  const gy = rng.range(420, 560);
  s += `<g fill="none" stroke="#2b1d16" stroke-width="7">`;
  s += `<path d="M${n(gx - 130)} ${n(gy)} a 130 150 0 0 0 260 0" fill="#c0a062" fill-opacity="0.85"/>`;
  s += `<path d="M${n(gx - 90)} ${n(gy + 20)} a 110 110 0 0 1 200 -40" fill="#8d6e63" fill-opacity="0.8"/>`;
  s += `<circle cx="${n(gx)}" cy="${n(gy + 20)}" r="38" fill="#2b1d16"/>`;
  for (let k = -2; k <= 2; k++) {
    s += `<line x1="${n(gx + k * 9)}" y1="${n(gy - 300)}" x2="${n(gx + k * 9)}" y2="${n(gy + 120)}" stroke-width="2"/>`;
  }
  s += `<rect x="${n(gx - 26)}" y="${n(gy - 330)}" width="52" height="220" fill="#6d4c41" fill-opacity="0.9"/>`;
  s += `</g>`;
  // A bottle drawn twice, front and side
  const bx = rng.range(90, 200);
  s += `<path d="M${n(bx)} 700 v-170 q0 -40 30 -60 v-90 h40 v90 q30 20 30 60 v170 z" fill="#6d7f5f" fill-opacity="0.75" stroke="#2b1d16" stroke-width="6"/>`;
  s += `<path d="M${n(bx + 40)} 720 v-170 q0 -40 30 -60 v-90 h40" fill="none" stroke="#2b1d16" stroke-width="4" stroke-dasharray="12 8"/>`;
  // Newspaper fragment
  const nx = rng.range(460, 600);
  s += `<g transform="rotate(${n(rng.range(-12, 12))} ${n(nx)} 230)"><rect x="${n(nx)}" y="170" width="190" height="110" fill="#ece3cf" stroke="#3e2723" stroke-width="3"/><text x="${n(nx + 14)}" y="220" font-family="${SERIF}" font-size="42" font-weight="bold" fill="#2b1d16">JOURN</text>`;
  for (let k = 0; k < 4; k++)
    s += `<line x1="${n(nx + 14)}" y1="${240 + k * 9}" x2="${n(nx + 176)}" y2="${240 + k * 9}" stroke="#8d6e63" stroke-width="3"/>`;
  s += `</g>`;
  return s;
}

// ── Futurism ─────────────────────────────────────────────────────────────

function futurist(rng: Rng, subject: "tram" | "cyclist" | "station") {
  const W = 1000;
  const H = 700;
  const warm = ["#d62828", "#f77f00", "#fcbf49", "#eae2b7"];
  let s = `<rect width="${W}" height="${H}" fill="#003049"/>`;
  // Lines of force radiating from a vanishing point
  const vx = rng.range(700, 900);
  const vy = rng.range(250, 400);
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * Math.PI * 2 + rng.range(-0.05, 0.05);
    const a1 = a0 + rng.range(0.08, 0.2);
    const r = 1400;
    s += `<polygon points="${pts([
      [vx, vy],
      [vx + Math.cos(a0) * r, vy + Math.sin(a0) * r],
      [vx + Math.cos(a1) * r, vy + Math.sin(a1) * r],
    ])}" fill="${warm[i % warm.length]}" opacity="${n(rng.range(0.35, 0.8))}"/>`;
  }
  for (let i = 0; i < 40; i++) {
    const y = rng.range(0, H);
    s += `<line x1="0" y1="${n(y)}" x2="${n(rng.range(300, W))}" y2="${n(y + rng.range(-60, 60))}" stroke="#fff" stroke-width="${n(rng.range(1, 4))}" opacity="0.35"/>`;
  }
  // The same subject repeated in overlapping stages, like a chronophotograph
  const copies = 6;
  for (let k = 0; k < copies; k++) {
    const t = k / (copies - 1);
    const ox = 80 + t * 420;
    const op = n(0.25 + t * 0.75);
    s += `<g transform="translate(${n(ox)} ${n(t * -30)})" opacity="${op}">`;
    if (subject === "tram") {
      s += `<polygon points="${pts([
        [60, 300],
        [380, 270],
        [400, 470],
        [40, 480],
      ])}" fill="${warm[k % 3]}" stroke="#111" stroke-width="6"/>`;
      for (let w = 0; w < 4; w++)
        s += `<rect x="${80 + w * 75}" y="${310 - w * 6}" width="52" height="60" fill="#003049" stroke="#111" stroke-width="4"/>`;
      s += `<circle cx="110" cy="490" r="38" fill="none" stroke="#111" stroke-width="8"/><circle cx="330" cy="485" r="38" fill="none" stroke="#111" stroke-width="8"/>`;
      s += `<line x1="200" y1="270" x2="260" y2="150" stroke="#111" stroke-width="5"/>`;
    } else if (subject === "cyclist") {
      for (const cx of [110, 330]) {
        s += `<circle cx="${cx}" cy="480" r="80" fill="none" stroke="#111" stroke-width="7"/>`;
        for (let sp = 0; sp < 8; sp++) {
          const a = (sp / 8) * Math.PI + k * 0.4;
          s += `<line x1="${n(cx - Math.cos(a) * 78)}" y1="${n(480 - Math.sin(a) * 78)}" x2="${n(cx + Math.cos(a) * 78)}" y2="${n(480 + Math.sin(a) * 78)}" stroke="#111" stroke-width="2"/>`;
        }
      }
      s += `<path d="M110 480 L200 360 L330 480 M200 360 L290 340 L330 480" stroke="${warm[k % 3]}" stroke-width="12" fill="none" stroke-linejoin="round"/>`;
      s += `<path d="M220 350 C 230 260 270 220 300 200" stroke="#111" stroke-width="22" stroke-linecap="round" fill="none"/>`;
      s += `<circle cx="320" cy="180" r="30" fill="${warm[(k + 1) % 3]}" stroke="#111" stroke-width="5"/>`;
    } else {
      // Station: arches and a plume of steam
      for (let a = 0; a < 3; a++)
        s += `<path d="M${40 + a * 120} 520 v-180 a 60 60 0 0 1 120 0 v180" fill="none" stroke="${warm[(k + a) % 4]}" stroke-width="10"/>`;
      s += `<path d="M120 300 C 160 200 240 220 260 130 C 300 60 380 90 420 40" stroke="#eae2b7" stroke-width="26" fill="none" stroke-linecap="round"/>`;
    }
    s += `</g>`;
  }
  return s;
}

// ── Dada ─────────────────────────────────────────────────────────────────

const SCRAP_WORDS = [
  "NEIN",
  "KUNST?",
  "ANNONCE",
  "Nº 37",
  "1/2",
  "BILLET",
  "ABC",
  "OHNE",
  "ja ja",
  "7",
  "ZUG",
  "TICKET",
  "PREIS 20",
];

function dada(rng: Rng) {
  const W = 800;
  const H = 1000;
  let s = `<rect width="${W}" height="${H}" fill="#efe6d2"/>`;
  const fills = [
    "#d9d4c7",
    "#c1121f",
    "#669bbc",
    "#222",
    "#c19a6b",
    "#fdf6e3",
    "#e9c46a",
    "#b7b7a4",
  ];
  const scraps = rng.int(16, 22);
  for (let i = 0; i < scraps; i++) {
    const w = rng.range(80, 320);
    const h = rng.range(50, 220);
    const x = rng.range(-40, W - w + 40);
    const y = rng.range(-20, H - h + 20);
    const rot = rng.range(-18, 18);
    const fill = rng.pick(fills);
    const dark = fill === "#222" || fill === "#c1121f" || fill === "#669bbc";
    s += `<g transform="rotate(${n(rot)} ${n(x + w / 2)} ${n(y + h / 2)})">`;
    s += `<rect x="${n(x + 4)}" y="${n(y + 5)}" width="${n(w)}" height="${n(h)}" fill="#000" opacity="0.12"/>`;
    s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;
    const kind = rng.int(0, 3);
    if (kind === 0) {
      for (let l = y + 14; l < y + h - 6; l += 9)
        s += `<line x1="${n(x + 8)}" y1="${n(l)}" x2="${n(x + w - rng.range(8, 50))}" y2="${n(l)}" stroke="${dark ? "#fff" : "#444"}" stroke-width="2.5" opacity="0.7"/>`;
    } else if (kind === 1) {
      s += `<rect x="${n(x + 6)}" y="${n(y + 6)}" width="${n(w - 12)}" height="${n(h - 12)}" fill="none" stroke="${dark ? "#fff" : "#222"}" stroke-width="2" stroke-dasharray="6 4"/>`;
      s += `<text x="${n(x + 16)}" y="${n(y + h / 2 + 10)}" font-family="${SANS}" font-size="${n(Math.min(30, h / 3))}" font-weight="bold" fill="${dark ? "#fff" : "#222"}">${rng.pick(SCRAP_WORDS)}</text>`;
    } else if (kind === 2) {
      s += `<text x="${n(x + 10)}" y="${n(y + h * 0.75)}" font-family="${rng.chance(0.5) ? SERIF : SANS}" font-size="${n(Math.min(h * 0.8, w / 2.2))}" font-weight="900" fill="${dark ? "#efe6d2" : "#111"}">${rng.pick(SCRAP_WORDS)}</text>`;
    }
    s += `</g>`;
  }
  // A red stamp and a few cut lines
  const cx = rng.range(150, 650);
  const cy = rng.range(150, 850);
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="70" fill="none" stroke="#c1121f" stroke-width="6" opacity="0.85"/><circle cx="${n(cx)}" cy="${n(cy)}" r="54" fill="none" stroke="#c1121f" stroke-width="2"/><text x="${n(cx)}" y="${n(cy + 9)}" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="bold" fill="#c1121f">ZUFALL</text>`;
  for (let i = 0; i < 3; i++)
    s += `<line x1="${n(rng.range(0, W))}" y1="${n(rng.range(0, H))}" x2="${n(rng.range(0, W))}" y2="${n(rng.range(0, H))}" stroke="#111" stroke-width="${n(rng.range(3, 10))}"/>`;
  return s;
}

// ── Suprematism & Constructivism ─────────────────────────────────────────

function constructivist(rng: Rng, variant: "wedge" | "planes" | "poster" | "circle") {
  const W = 800;
  const H = 1000;
  let s = `<rect width="${W}" height="${H}" fill="#efe9dc"/>`;
  if (variant === "wedge") {
    s += `<rect x="400" width="400" height="${H}" fill="#111"/>`;
    s += `<circle cx="560" cy="460" r="200" fill="#efe9dc"/>`;
    s += `<polygon points="${pts([
      [60, 260],
      [520, 470],
      [80, 640],
    ])}" fill="#c1121f"/>`;
    for (let i = 0; i < 5; i++)
      s += `<rect x="${n(rng.range(80, 320))}" y="${n(rng.range(700, 920))}" width="${n(rng.range(20, 90))}" height="${n(rng.range(10, 30))}" fill="${rng.pick(["#111", "#c1121f"])}" transform="rotate(${n(rng.range(-40, 40))} 200 800)"/>`;
    s += `<polygon points="${pts([
      [640, 760],
      [760, 820],
      [690, 880],
    ])}" fill="#c1121f"/>`;
  } else {
    const angle = rng.range(-35, -15);
    if (variant === "circle" || variant === "poster") {
      s += `<circle cx="${n(rng.range(420, 600))}" cy="${n(rng.range(260, 380))}" r="${n(rng.range(150, 210))}" fill="#c1121f"/>`;
    }
    s += `<g transform="rotate(${n(angle)} 400 500)">`;
    const count = variant === "planes" ? 14 : 7;
    for (let i = 0; i < count; i++) {
      const w = rng.range(60, variant === "planes" ? 420 : 300);
      const h = rng.range(12, variant === "planes" ? 90 : 40);
      s += `<rect x="${n(rng.range(40, 760 - w))}" y="${n(rng.range(120, 880))}" width="${n(w)}" height="${n(h)}" fill="${rng.pick(["#111", "#111", "#c1121f", "#8d99ae", "#d8b26e"])}"/>`;
    }
    s += `<rect x="-200" y="${n(rng.range(520, 640))}" width="1200" height="${n(rng.range(40, 70))}" fill="#111"/>`;
    s += `</g>`;
    if (variant === "poster") {
      s += `<g transform="translate(70 930) rotate(-24)"><text x="0" y="0" font-family="${SANS}" font-size="120" font-weight="900" fill="#111" letter-spacing="-4">ВПЕРЁД</text><rect x="0" y="22" width="520" height="16" fill="#c1121f"/></g>`;
      s += `<text x="60" y="110" font-family="${SANS}" font-size="38" font-weight="900" fill="#c1121f">КЛУБ · 1924</text>`;
    }
    s += `<line x1="0" y1="${n(rng.range(0, 200))}" x2="${W}" y2="${n(rng.range(800, 1000))}" stroke="#111" stroke-width="3"/>`;
  }
  return s;
}

// ── Surrealism ───────────────────────────────────────────────────────────

function surreal(rng: Rng, variant: "clock" | "stairs" | "door" | "corpse") {
  const W = 800;
  const H = 1000;
  const horizon = 600;
  let s = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2a5a"/><stop offset="0.6" stop-color="#6c7fb8"/><stop offset="1" stop-color="#f4c6a5"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset="1" stop-color="#7a4a2a"/></linearGradient>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05061a"/><stop offset="1" stop-color="#26306b"/></linearGradient>
  </defs>`;
  s += `<rect width="${W}" height="${horizon}" fill="url(#sky)"/>`;
  s += `<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#ground)"/>`;
  for (let i = -6; i <= 6; i++)
    s += `<line x1="400" y1="${horizon}" x2="${400 + i * 160}" y2="${H}" stroke="#5a3418" stroke-width="1.5" opacity="0.35"/>`;
  // Small clouds and a distant figure
  for (let i = 0; i < 3; i++) {
    const cx = rng.range(80, 720);
    const cy = rng.range(80, 300);
    s += `<g fill="#fff" opacity="0.8"><ellipse cx="${n(cx)}" cy="${n(cy)}" rx="60" ry="22"/><ellipse cx="${n(cx + 40)}" cy="${n(cy - 14)}" rx="40" ry="20"/><ellipse cx="${n(cx - 40)}" cy="${n(cy - 8)}" rx="34" ry="16"/></g>`;
  }
  const fx = rng.range(80, 720);
  s += `<polygon points="${pts([
    [fx, horizon + 30],
    [fx + 60, horizon + 40],
    [fx + 6, horizon + 34],
  ])}" fill="#3b2412" opacity="0.6"/><rect x="${n(fx - 3)}" y="${horizon + 8}" width="6" height="22" fill="#222"/><circle cx="${n(fx)}" cy="${horizon + 5}" r="4" fill="#222"/>`;

  if (variant === "clock") {
    s += `<g fill="#9aa4c8" opacity="0.95"><ellipse cx="400" cy="250" rx="150" ry="50"/><ellipse cx="320" cy="230" rx="90" ry="44"/><ellipse cx="480" cy="226" rx="100" ry="46"/></g>`;
    for (let i = 0; i < 40; i++) {
      const x = rng.range(270, 530);
      const y = rng.range(300, 560);
      s += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x - 6)}" y2="${n(y + 26)}" stroke="#bcd" stroke-width="2"/>`;
    }
    s += `<polygon points="${pts([
      [330, 820],
      [470, 820],
      [780, 930],
      [700, 960],
    ])}" fill="#3b2412" opacity="0.55"/>`;
    s += `<circle cx="400" cy="700" r="130" fill="#f2efe6" stroke="#5a4632" stroke-width="16"/>`;
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      s += `<line x1="${n(400 + Math.cos(a) * 100)}" y1="${n(700 + Math.sin(a) * 100)}" x2="${n(400 + Math.cos(a) * 115)}" y2="${n(700 + Math.sin(a) * 115)}" stroke="#222" stroke-width="${h % 3 ? 3 : 7}"/>`;
    }
    s += `<line x1="400" y1="700" x2="400" y2="610" stroke="#222" stroke-width="8" stroke-linecap="round"/><line x1="400" y1="700" x2="460" y2="730" stroke="#222" stroke-width="6" stroke-linecap="round"/>`;
    s += `<path d="M300 790 q 40 30 100 40" stroke="#5a4632" stroke-width="4" fill="none"/>`;
  } else if (variant === "stairs") {
    s += `<rect y="${horizon - 70}" width="${W}" height="70" fill="#2d6a8f"/>`;
    for (let k = 0; k < 9; k++) {
      const t = k / 9;
      const y = H - 40 - t * 420;
      const half = 200 - t * 150;
      const rise = 46 - t * 30;
      s += `<polygon points="${pts([
        [400 - half, y],
        [400 + half, y],
        [400 + half, y - rise],
        [400 - half, y - rise],
      ])}" fill="${k % 2 ? "#e8e0d0" : "#d6cbb5"}" stroke="#8a7a60" stroke-width="2"/>`;
      s += `<polygon points="${pts([
        [400 + half, y],
        [400 + half + 40 * (1 - t), y - 20],
        [400 + half + 40 * (1 - t), y - rise - 20],
        [400 + half, y - rise],
      ])}" fill="#3b2412" opacity="0.4"/>`;
    }
    s += `<circle cx="${n(rng.range(150, 250))}" cy="${n(rng.range(330, 420))}" r="46" fill="#f2efe6"/><ellipse cx="200" cy="${horizon + 60}" rx="50" ry="8" fill="#3b2412" opacity="0.4"/>`;
  } else if (variant === "door") {
    s += `<polygon points="${pts([
      [300, 860],
      [500, 860],
      [790, 940],
      [610, 980],
    ])}" fill="#3b2412" opacity="0.55"/>`;
    s += `<rect x="300" y="420" width="200" height="440" fill="#5a3a22"/>`;
    s += `<rect x="320" y="440" width="160" height="420" fill="url(#night)"/>`;
    s += `<circle cx="420" cy="520" r="30" fill="#f7f1c8"/><circle cx="408" cy="512" r="28" fill="#0c1033"/>`;
    for (let i = 0; i < 18; i++)
      s += `<circle cx="${n(rng.range(325, 475))}" cy="${n(rng.range(450, 840))}" r="${n(rng.range(1, 2.6))}" fill="#fff"/>`;
    s += `<polygon points="${pts([
      [500, 420],
      [560, 400],
      [560, 880],
      [500, 860],
    ])}" fill="#7a5235"/><circle cx="545" cy="650" r="7" fill="#d4a017"/>`;
  } else {
    // Exquisite corpse: three folds, each drawn without seeing the others
    const bands = [0, 333, 666, 1000];
    s = `<rect width="${W}" height="${H}" fill="#f2ead8"/>`;
    s += `<g stroke="#222" stroke-width="5" fill="none">`;
    const head = rng.pick(["#9aa4c8", "#e9c46a", "#8fbf9f", "#e5989b"]);
    const body = rng.pick([
      ["#c86b3c", "#e09a6a"],
      ["#6d597a", "#b56576"],
      ["#2a9d8f", "#8ab17d"],
    ]);
    s += `<circle cx="400" cy="180" r="120" fill="${head}"/><ellipse cx="400" cy="180" rx="60" ry="34" fill="#fff"/><circle cx="400" cy="180" r="20" fill="#222"/>`;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      s += `<line x1="${n(400 + Math.cos(a) * 120)}" y1="${n(180 + Math.sin(a) * 120)}" x2="${n(400 + Math.cos(a) * 170)}" y2="${n(180 + Math.sin(a) * 170)}"/>`;
    }
    s += `<rect x="250" y="340" width="300" height="310" fill="${body[0]}"/>`;
    for (let d = 0; d < 3; d++)
      s += `<rect x="275" y="${360 + d * 95}" width="250" height="80" fill="${body[1]}"/><circle cx="400" cy="${400 + d * 95}" r="9" fill="#222"/>`;
    s += `<path d="M300 670 C 280 800 260 880 230 960 h 70 M500 670 C 520 800 540 880 570 960 h -70"/>`;
    s += `</g>`;
    for (const y of bands.slice(1, 3))
      s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#8a7a60" stroke-width="2" stroke-dasharray="10 8"/>`;
  }
  return s;
}

// ── Abstract Expressionism ───────────────────────────────────────────────

function pour(rng: Rng) {
  const W = 1000;
  const H = 700;
  let s = `<rect width="${W}" height="${H}" fill="#e9e2d0"/>`;
  const layers: [string, number, [number, number]][] = [
    ["#c9b79c", 14, [3, 8]],
    ["#111", 34, [1.5, 6]],
    ["#f5f2ea", 22, [1.5, 5]],
    ["#b08d57", 12, [1, 4]],
    ["#4a6b6f", 10, [1, 3]],
  ];
  for (const [color, count, [w0, w1]] of layers) {
    for (let i = 0; i < count; i++) {
      let x = rng.range(-50, W + 50);
      let y = rng.range(-50, H + 50);
      let a = rng.range(0, Math.PI * 2);
      let d = `M${n(x)} ${n(y)}`;
      const steps = rng.int(20, 60);
      for (let k = 0; k < steps; k++) {
        a += rng.range(-0.9, 0.9);
        const step = rng.range(10, 34);
        const cx = x + Math.cos(a) * step * 0.6;
        const cy = y + Math.sin(a) * step * 0.6;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        d += ` Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`;
      }
      s += `<path d="${d}" stroke="${color}" stroke-width="${n(rng.range(w0, w1))}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
    }
    for (let i = 0; i < count * 6; i++)
      s += `<circle cx="${n(rng.range(0, W))}" cy="${n(rng.range(0, H))}" r="${n(rng.range(0.8, 5))}" fill="${color}"/>`;
  }
  return s;
}

function gesture(rng: Rng) {
  const W = 1000;
  const H = 750;
  let s = `<rect width="${W}" height="${H}" fill="#f4f1ea"/>`;
  for (let i = 0; i < rng.int(6, 9); i++) {
    const x1 = rng.range(-50, W + 50);
    const y1 = rng.range(-50, H + 50);
    const a = rng.chance(0.5) ? rng.range(-0.3, 0.3) : Math.PI / 2 + rng.range(-0.3, 0.3);
    const l = rng.range(300, 900);
    const x2 = x1 + Math.cos(a) * l;
    const y2 = y1 + Math.sin(a) * l;
    const w = rng.range(40, 110);
    const color = rng.chance(0.82) ? "#111" : "#6b6b6b";
    s += `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${n(w)}" stroke-linecap="square"/>`;
    // Dry-brush edges
    for (let k = 0; k < 6; k++) {
      const off = rng.range(-w / 2, w / 2);
      const ox = -Math.sin(a) * off;
      const oy = Math.cos(a) * off;
      const ext = rng.range(10, 60);
      s += `<line x1="${n(x2 + ox)}" y1="${n(y2 + oy)}" x2="${n(x2 + ox + Math.cos(a) * ext)}" y2="${n(y2 + oy + Math.sin(a) * ext)}" stroke="${color}" stroke-width="${n(rng.range(2, 8))}" opacity="0.8"/>`;
    }
  }
  return s;
}

function colorField(rng: Rng, variant: "red-brown" | "blue") {
  const W = 800;
  const H = 1000;
  const [bg, top, bottom] =
    variant === "red-brown" ? ["#4a1f17", "#c0392b", "#6d3b1f"] : ["#0f2a4a", "#3b6db3", "#152e57"];
  let s = `<defs><filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${rng.int(1, 99)}"/><feDisplacementMap in="SourceGraphic" scale="14"/><feGaussianBlur stdDeviation="5"/></filter></defs>`;
  s += `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  const split = rng.range(0.52, 0.6);
  s += `<g filter="url(#soft)">`;
  s += `<rect x="70" y="70" width="660" height="${n(H * split - 100)}" fill="${top}"/>`;
  s += `<rect x="70" y="${n(H * split)}" width="660" height="${n(H * (1 - split) - 70)}" fill="${bottom}"/>`;
  for (let i = 0; i < 6; i++)
    s += `<rect x="${n(rng.range(80, 140))}" y="${n(rng.range(80, H * split - 200))}" width="${n(rng.range(400, 600))}" height="${n(rng.range(60, 160))}" fill="#fff" opacity="0.05"/>`;
  s += `</g>`;
  return s;
}

// ── Minimalism ───────────────────────────────────────────────────────────

function minimal(rng: Rng, variant: "units" | "grid" | "light" | "floor") {
  if (variant === "units") {
    let s = `<defs><linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f7f5"/><stop offset="1" stop-color="#e3e2de"/></linearGradient><linearGradient id="alu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c5c9ce"/><stop offset="1" stop-color="#979ca3"/></linearGradient></defs>`;
    s += `<rect width="800" height="1000" fill="url(#wall)"/>`;
    for (let i = 0; i < 6; i++) {
      const y = 70 + i * 150;
      s += `<rect x="300" y="${y + 90}" width="220" height="14" fill="#000" opacity="0.08"/>`;
      s += `<polygon points="${pts([
        [280, y],
        [520, y],
        [540, y - 14],
        [300, y - 14],
      ])}" fill="#d9dcdf"/>`;
      s += `<polygon points="${pts([
        [520, y],
        [540, y - 14],
        [540, y + 62],
        [520, y + 76],
      ])}" fill="#7f858c"/>`;
      s += `<rect x="280" y="${y}" width="240" height="76" fill="url(#alu)"/>`;
    }
    return s;
  }
  if (variant === "grid") {
    let s = `<rect width="900" height="900" fill="#efece4"/>`;
    for (let i = 0; i < 6; i++)
      s += `<rect x="60" y="${60 + i * 130}" width="780" height="65" fill="#f6e9e4" opacity="0.6"/>`;
    for (let k = 0; k <= 60; k++) {
      const y = 60 + k * 13;
      s += `<line x1="60" y1="${n(y + rng.range(-0.6, 0.6))}" x2="840" y2="${n(y + rng.range(-0.6, 0.6))}" stroke="#6b6b6b" stroke-width="0.8" opacity="0.55"/>`;
    }
    for (let k = 0; k <= 30; k++) {
      const x = 60 + k * 26;
      s += `<line x1="${n(x + rng.range(-0.6, 0.6))}" y1="60" x2="${n(x + rng.range(-0.6, 0.6))}" y2="840" stroke="#6b6b6b" stroke-width="0.8" opacity="0.4"/>`;
    }
    return s;
  }
  if (variant === "floor") {
    let s = `<rect width="900" height="900" fill="#d9d6cf"/>`;
    const tones = ["#8e9196", "#7d8086", "#9a9da2", "#868a90"];
    for (let j = 0; j < 6; j++)
      for (let i = 0; i < 6; i++)
        s += `<rect x="${150 + i * 100}" y="${150 + j * 100}" width="98" height="98" fill="${rng.pick(tones)}"/>`;
    return s;
  }
  const glow = rng.pick(["#ff4fa3", "#4fffb0", "#5aa9ff", "#ffd84f"]);
  let s = `<defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${glow}" stop-opacity="0.85"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>`;
  s += `<rect width="800" height="1000" fill="#2a2a2e"/>`;
  s += `<polygon points="0,0 400,80 400,1000 0,1000" fill="#38383d"/>`;
  s += `<polygon points="400,80 800,0 800,1000 400,1000" fill="#303035"/>`;
  s += `<ellipse cx="400" cy="520" rx="380" ry="520" fill="url(#g)"/>`;
  s += `<rect x="392" y="140" width="16" height="760" rx="8" fill="#fff"/>`;
  s += `<rect x="388" y="140" width="24" height="760" rx="12" fill="${glow}" opacity="0.5"/>`;
  return s;
}

// ── Pop Art ──────────────────────────────────────────────────────────────

function pop(rng: Rng, variant: "can" | "selfie" | "notification" | "burst") {
  const W = 800;
  const H = 800;
  if (variant === "can") {
    const schemes = [
      ["#ff2e63", "#fde047", "#22d3ee"],
      ["#22d3ee", "#ff2e63", "#fde047"],
      ["#fde047", "#2563eb", "#ff2e63"],
      ["#a3e635", "#f97316", "#7c3aed"],
    ];
    let s = `<defs>${schemes.map((c, i) => benDay(`d${i}`, c[2], 10, 2.4)).join("")}</defs>`;
    schemes.forEach(([bg, band], i) => {
      const x = (i % 2) * 400;
      const y = Math.floor(i / 2) * 400;
      s += `<rect x="${x}" y="${y}" width="400" height="400" fill="${bg}"/><rect x="${x}" y="${y}" width="400" height="400" fill="url(#d${i})" opacity="0.45"/>`;
      s += `<g stroke="#111" stroke-width="6">`;
      s += `<rect x="${x + 120}" y="${y + 80}" width="160" height="240" fill="#f5f5f5"/>`;
      s += `<rect x="${x + 120}" y="${y + 110}" width="160" height="100" fill="${band}"/>`;
      s += `<ellipse cx="${x + 200}" cy="${y + 80}" rx="80" ry="18" fill="#d4d4d4"/>`;
      s += `<path d="M${x + 120} ${y + 320} a 80 18 0 0 0 160 0" fill="#d4d4d4"/>`;
      s += `</g>`;
      s += `<text x="${x + 200}" y="${y + 172}" text-anchor="middle" font-family="${SANS}" font-size="34" font-weight="900" fill="#fff" stroke="#111" stroke-width="5" paint-order="stroke">BEANS</text>`;
      s += `<text x="${x + 200}" y="${y + 260}" text-anchor="middle" font-family="${SERIF}" font-size="22" font-style="italic" fill="#111">condensed</text>`;
    });
    s += `<path d="M400 0V800M0 400H800" stroke="#111" stroke-width="10"/>`;
    return s;
  }
  if (variant === "selfie") {
    let s = `<defs>${benDay("dots", "#ff2e63", 14, 3.6)}</defs>`;
    s += `<rect width="${W}" height="${H}" fill="#fde047"/><rect width="${W}" height="${H}" fill="url(#dots)" opacity="0.6"/>`;
    s += `<rect x="230" y="90" width="340" height="620" rx="44" fill="#111"/>`;
    s += `<rect x="252" y="140" width="296" height="520" fill="#22d3ee"/>`;
    s += `<circle cx="400" cy="360" r="110" fill="#ffd6b8" stroke="#111" stroke-width="8"/>`;
    s += `<path d="M290 330 C 300 230 500 230 510 330 C 470 280 330 280 290 330 Z" fill="#111"/>`;
    s += `<circle cx="360" cy="365" r="12" fill="#111"/><circle cx="440" cy="365" r="12" fill="#111"/>`;
    s += `<path d="M350 420 Q 400 470 450 420" stroke="#111" stroke-width="8" fill="#ff2e63"/>`;
    s += `<path d="M260 660 C 300 560 500 560 540 660 Z" fill="#ff2e63" stroke="#111" stroke-width="8"/>`;
    s += `<polygon points="${pts([
      [600, 140],
      [640, 210],
      [720, 200],
      [660, 260],
      [700, 330],
      [620, 300],
      [570, 360],
      [575, 280],
      [510, 250],
      [585, 220],
    ])}" fill="#fff" stroke="#111" stroke-width="6"/><text x="612" y="268" text-anchor="middle" font-family="${SANS}" font-size="30" font-weight="900" fill="#ff2e63">CLICK</text>`;
    return s;
  }
  if (variant === "notification") {
    let s = `<defs>${benDay("dots", "#93c5fd", 12, 3)}</defs>`;
    s += `<rect width="${W}" height="${H}" fill="#e0f2fe"/><rect width="${W}" height="${H}" fill="url(#dots)"/>`;
    s += `<g stroke="#111" stroke-width="8" stroke-linejoin="round">`;
    s += `<path d="M120 800 C 100 520 180 300 330 260 C 520 210 640 330 620 520 C 610 640 650 720 700 800 Z" fill="#fde047"/>`;
    s += `<path d="M300 800 C 300 700 320 640 360 600 C 330 520 340 420 400 380 C 470 340 560 380 560 480 C 565 540 545 580 520 600 C 540 660 540 740 520 800 Z" fill="#ffd6b8"/>`;
    s += `<path d="M330 330 C 420 300 520 330 580 420 C 520 380 440 370 380 400 Z" fill="#fde047"/>`;
    s += `</g>`;
    s += `<path d="M420 480 q 30 -18 60 0" stroke="#111" stroke-width="7" fill="none"/>`;
    for (let i = 0; i < 4; i++)
      s += `<line x1="${430 + i * 14}" y1="${478 - (i % 2) * 2}" x2="${424 + i * 16}" y2="458" stroke="#111" stroke-width="4"/>`;
    s += `<path d="M430 560 q 30 14 60 -4 q -30 -10 -60 4 z" fill="#ff2e63" stroke="#111" stroke-width="4"/>`;
    s += `<circle cx="505" cy="510" r="7" fill="#22d3ee" stroke="#111" stroke-width="3"/>`;
    s += `<path d="M60 60 h420 a30 30 0 0 1 30 30 v90 a30 30 0 0 1 -30 30 h-260 l-60 60 l10 -60 h-110 a30 30 0 0 1 -30 -30 v-90 a30 30 0 0 1 30 -30 z" fill="#fff" stroke="#111" stroke-width="8"/>`;
    s += `<text x="270" y="155" text-anchor="middle" font-family="${SANS}" font-size="44" font-weight="900" fill="#111">1 NEW MESSAGE!</text>`;
    s += `<circle cx="700" cy="110" r="56" fill="#ff2e63" stroke="#111" stroke-width="8"/><text x="700" y="132" text-anchor="middle" font-family="${SANS}" font-size="62" font-weight="900" fill="#fff">1</text>`;
    return s;
  }
  let s = `<defs>${benDay("dots", "#2563eb", 16, 4)}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="#22d3ee"/><rect width="${W}" height="${H}" fill="url(#dots)" opacity="0.5"/>`;
  const spikes: [number, number][] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = i % 2 ? rng.range(170, 210) : rng.range(300, 360);
    spikes.push([400 + Math.cos(a) * r, 400 + Math.sin(a) * r]);
  }
  s += `<polygon points="${pts(spikes)}" fill="#fde047" stroke="#ff2e63" stroke-width="14" stroke-linejoin="round"/>`;
  s += `<text x="400" y="450" text-anchor="middle" font-family="${SANS}" font-size="150" font-weight="900" fill="#ff2e63" stroke="#111" stroke-width="6" transform="rotate(-8 400 400)">POP!</text>`;
  return s;
}

// ── Op Art and Agamographs ───────────────────────────────────────────────

function opMoire(rng: Rng) {
  const ox = rng.range(30, 70);
  const oy = rng.range(-40, 40);
  let s = `<rect width="800" height="800" fill="#f5f5f5"/>`;
  for (const [cx, cy] of [
    [400, 400],
    [400 + ox, 400 + oy],
  ]) {
    s += `<g fill="none" stroke="#111" stroke-width="4.5">`;
    for (let r = 8; r < 620; r += 11) s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}"/>`;
    s += `</g>`;
  }
  return s;
}

function opWaves(rng: Rng) {
  const stripes = 46;
  const amp = rng.range(26, 40);
  const freq = rng.range(2.5, 4);
  let s = `<rect width="800" height="800" fill="#f5f5f5"/>`;
  const edge = (i: number, y: number) =>
    (i / stripes) * 800 +
    Math.sin((y / 800) * Math.PI * freq + (i / stripes) * Math.PI * 1.5) *
      amp *
      Math.sin((i / stripes) * Math.PI);
  for (let i = 0; i < stripes; i += 2) {
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let y = 0; y <= 800; y += 16) {
      left.push([edge(i, y), y]);
      right.push([edge(i + 1, y), y]);
    }
    s += `<polygon points="${pts([...left, ...right.reverse()])}" fill="#111"/>`;
  }
  return s;
}

function opChecker(rng: Rng) {
  const N = 16;
  const cx = rng.range(0.4, 0.6);
  const cy = rng.range(0.4, 0.6);
  const warp = (u: number, v: number): [number, number] => {
    const dx = u - cx;
    const dy = v - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    const k = 1 + 0.9 * Math.max(0, 0.42 - d);
    return [(cx + dx * k) * 800, (cy + dy * k) * 800];
  };
  const [a, b] = rng.pick([
    ["#111", "#f5f5f5"],
    ["#2563eb", "#f97316"],
    ["#7c3aed", "#a3e635"],
  ]);
  let s = `<rect width="800" height="800" fill="${b}"/>`;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if ((i + j) % 2) continue;
      s += `<polygon points="${pts([
        warp(i / N, j / N),
        warp((i + 1) / N, j / N),
        warp((i + 1) / N, (j + 1) / N),
        warp(i / N, (j + 1) / N),
      ])}" fill="${a}"/>`;
    }
  return s;
}

/** Frames for lenticular pieces: what you see from the left, centre and right. */
function agamograph(
  rng: Rng,
  variant: "two-skies" | "square-circle" | "three-rainbows",
  frame: number,
) {
  const RAINBOW = ["#e63946", "#f77f00", "#fcbf49", "#2a9d8f", "#2563eb", "#7c3aed"];
  if (variant === "two-skies") {
    if (frame === 0) {
      let s = `<rect width="800" height="800" fill="#7fd1ff"/>`;
      ["#ffe066", "#ffd43b", "#fcc419", "#fab005", "#f59f00"].forEach((c, i) => {
        s += `<circle cx="400" cy="420" r="${330 - i * 60}" fill="${c}" opacity="${0.35 + i * 0.15}"/>`;
      });
      for (let i = 0; i < 6; i++)
        s += `<rect y="${600 + i * 34}" width="800" height="17" fill="#2a9d8f" opacity="${0.4 + i * 0.1}"/>`;
      return s;
    }
    let s = `<rect width="800" height="800" fill="#0b1033"/>`;
    for (let i = 0; i < 120; i++)
      s += `<circle cx="${n(rng.range(0, 800))}" cy="${n(rng.range(0, 600))}" r="${n(rng.range(0.8, 3))}" fill="#fff"/>`;
    s += `<circle cx="400" cy="320" r="120" fill="#f7f1c8"/><circle cx="360" cy="300" r="112" fill="#0b1033"/>`;
    for (let i = 0; i < 6; i++)
      s += `<rect y="${600 + i * 34}" width="800" height="17" fill="#7c3aed" opacity="${0.4 + i * 0.1}"/>`;
    return s;
  }
  if (variant === "square-circle") {
    let s = `<rect width="800" height="800" fill="${frame === 0 ? "#111" : "#f5f5f5"}"/>`;
    for (let i = 0; i < 12; i++) {
      const c = RAINBOW[(i + (frame === 0 ? 0 : 3)) % RAINBOW.length];
      const r = 380 - i * 31;
      s +=
        frame === 0
          ? `<rect x="${400 - r}" y="${400 - r}" width="${r * 2}" height="${r * 2}" fill="${c}"/>`
          : `<circle cx="400" cy="400" r="${r}" fill="${c}"/>`;
    }
    return s;
  }
  // three-rainbows
  let s = `<rect width="800" height="800" fill="#f5f5f5"/>`;
  const angle = [0, 90, 45][frame] ?? 0;
  s += `<g transform="rotate(${angle} 400 400)">`;
  for (let i = -8; i < 16; i++)
    s += `<rect x="-400" y="${i * 66}" width="1600" height="66" fill="${RAINBOW[((i % 6) + 6) % 6]}"/>`;
  s += `</g>`;
  return s;
}

// ── Registry ─────────────────────────────────────────────────────────────

export const RECIPES = {
  "fauve-harbor": { width: 800, height: 800, render: (r) => fauveScene(r, true) },
  "fauve-landscape": { width: 800, height: 800, render: (r) => fauveScene(r, false) },
  "fauve-portrait": { width: 800, height: 800, render: fauvePortrait },
  cubist: { width: 800, height: 1000, render: cubist },
  "futurist-tram": { width: 1000, height: 700, render: (r) => futurist(r, "tram") },
  "futurist-cyclist": { width: 1000, height: 700, render: (r) => futurist(r, "cyclist") },
  "futurist-station": { width: 1000, height: 700, render: (r) => futurist(r, "station") },
  dada: { width: 800, height: 1000, render: dada },
  "constructivist-wedge": { width: 800, height: 1000, render: (r) => constructivist(r, "wedge") },
  "constructivist-planes": { width: 800, height: 1000, render: (r) => constructivist(r, "planes") },
  "constructivist-poster": { width: 800, height: 1000, render: (r) => constructivist(r, "poster") },
  "constructivist-circle": { width: 800, height: 1000, render: (r) => constructivist(r, "circle") },
  "surreal-clock": { width: 800, height: 1000, render: (r) => surreal(r, "clock") },
  "surreal-stairs": { width: 800, height: 1000, render: (r) => surreal(r, "stairs") },
  "surreal-door": { width: 800, height: 1000, render: (r) => surreal(r, "door") },
  "surreal-corpse": { width: 800, height: 1000, render: (r) => surreal(r, "corpse") },
  "abex-pour": { width: 1000, height: 700, render: pour },
  "abex-gesture": { width: 1000, height: 750, render: gesture },
  "abex-field-red": { width: 800, height: 1000, render: (r) => colorField(r, "red-brown") },
  "abex-field-blue": { width: 800, height: 1000, render: (r) => colorField(r, "blue") },
  "minimal-units": { width: 800, height: 1000, render: (r) => minimal(r, "units") },
  "minimal-grid": { width: 900, height: 900, render: (r) => minimal(r, "grid") },
  "minimal-light": { width: 800, height: 1000, render: (r) => minimal(r, "light") },
  "minimal-floor": { width: 900, height: 900, render: (r) => minimal(r, "floor") },
  "pop-can": { width: 800, height: 800, render: (r) => pop(r, "can") },
  "pop-selfie": { width: 800, height: 800, render: (r) => pop(r, "selfie") },
  "pop-notification": { width: 800, height: 800, render: (r) => pop(r, "notification") },
  "pop-burst": { width: 800, height: 800, render: (r) => pop(r, "burst") },
  "op-moire": { width: 800, height: 800, render: opMoire },
  "op-waves": { width: 800, height: 800, render: opWaves },
  "op-checker": { width: 800, height: 800, render: opChecker },
  "agam-two-skies": {
    width: 800,
    height: 800,
    frames: 2,
    render: (r, f) => agamograph(r, "two-skies", f),
  },
  "agam-square-circle": {
    width: 800,
    height: 800,
    frames: 2,
    render: (r, f) => agamograph(r, "square-circle", f),
  },
  "agam-three-rainbows": {
    width: 800,
    height: 800,
    frames: 3,
    render: (r, f) => agamograph(r, "three-rainbows", f),
  },
} satisfies Record<string, Recipe>;

export type RecipeName = keyof typeof RECIPES;
