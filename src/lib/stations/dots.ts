/**
 * Painting with dots, Seurat's way: a palette of pure colours, how the eye
 * mixes dots compared with how paint mixes on a palette, and a reading of a
 * dot painting (which opposites touch, how each part looks from a distance).
 * Plain functions, no DOM, so the station's teaching can be tested.
 */

/** Colour families on the colour circle Seurat read about in Chevreul. */
export type Family = "red" | "orange" | "yellow" | "green" | "blue" | "violet" | "white";

/** Opposites on that circle: side by side, each makes the other look stronger. */
export const COMPLEMENT: Record<Family, Family | null> = {
  red: "green",
  green: "red",
  orange: "blue",
  blue: "orange",
  yellow: "violet",
  violet: "yellow",
  white: null,
};

export type DotColour = { name: string; hex: string; family: Family };

/** Pure, unmixed colours, plus white to lighten (as Seurat did, instead of mixing). */
export const PALETTE: DotColour[] = [
  { name: "Vermilion", hex: "#e2431e", family: "red" },
  { name: "Rose", hex: "#d65a83", family: "red" },
  { name: "Orange", hex: "#f08a1d", family: "orange" },
  { name: "Yellow", hex: "#f4cf2a", family: "yellow" },
  { name: "Yellow-green", hex: "#a2c13c", family: "green" },
  { name: "Green", hex: "#3d9640", family: "green" },
  { name: "Emerald", hex: "#1d8466", family: "green" },
  { name: "Blue", hex: "#2f7dc6", family: "blue" },
  { name: "Ultramarine", hex: "#2d3e9c", family: "blue" },
  { name: "Violet", hex: "#77479f", family: "violet" },
  { name: "White", hex: "#f7f2e6", family: "white" },
];

/** The primed canvas under the dots. */
export const GROUND = "#ece4d2";

export type Rgb = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** A hex colour as linear light, 0–1 per channel. */
export function linear(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [
    toLinear(((n >> 16) & 255) / 255),
    toLinear(((n >> 8) & 255) / 255),
    toLinear((n & 255) / 255),
  ];
}

/** Linear light back to a hex colour. */
export function hex(rgb: Rgb): string {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** How light a colour looks, 0–1 (relative luminance). */
export function lightness(rgb: Rgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

type Part = { hex: string; weight: number };

/**
 * What the eye makes of dots too small to see apart: the light from each,
 * averaged. (The same as spinning them on a disc.)
 */
export function eyeMix(parts: Part[]): Rgb {
  const total = parts.reduce((s, p) => s + p.weight, 0) || 1;
  const out: Rgb = [0, 0, 0];
  for (const p of parts) {
    const c = linear(p.hex);
    for (let i = 0; i < 3; i++) out[i] += (c[i] * p.weight) / total;
  }
  return out;
}

/**
 * The same paints stirred together on a palette. Each pigment absorbs some of
 * the light the others reflect, so the mixture reflects roughly the product
 * of what each would (a weighted geometric mean): always darker than the eye's mix.
 */
export function paintMix(parts: Part[]): Rgb {
  const total = parts.reduce((s, p) => s + p.weight, 0) || 1;
  const out: Rgb = [0, 0, 0];
  for (const p of parts) {
    const c = linear(p.hex);
    for (let i = 0; i < 3; i++) out[i] += (Math.log(Math.max(c[i], 1e-4)) * p.weight) / total;
  }
  return out.map(Math.exp) as Rgb;
}

/** A dot on the station's canvas: centre and radius in canvas pixels, colour as a `PALETTE` index. */
export type Dot = { x: number; y: number; r: number; c: number };

/** Opposite colours touching: which pair, and how many times. */
export type Touches = { a: Family; b: Family; n: number };

/** Opposite pairs, each named once, warm colour first. */
const PAIRS: [Family, Family][] = [
  ["orange", "blue"],
  ["yellow", "violet"],
  ["red", "green"],
];

/**
 * How many times dots of opposite colours sit side by side (close enough
 * that the eye sees them together), for each pair of opposites.
 */
export function touches(dots: readonly Dot[]): Touches[] {
  const counts = new Map<string, number>(PAIRS.map(([a, b]) => [`${a}-${b}`, 0]));
  const cell = 24;
  const grid = new Map<string, number[]>();
  dots.forEach((d, i) => {
    const key = `${Math.floor(d.x / cell)},${Math.floor(d.y / cell)}`;
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  dots.forEach((d, i) => {
    const fam = PALETTE[d.c]?.family;
    const opp = fam ? COMPLEMENT[fam] : null;
    if (!fam || !opp) return;
    const gx = Math.floor(d.x / cell);
    const gy = Math.floor(d.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          // Each pair once.
          if (j <= i) continue;
          const e = dots[j];
          if (PALETTE[e.c]?.family !== opp) continue;
          const reach = (d.r + e.r) * 1.6;
          if ((d.x - e.x) ** 2 + (d.y - e.y) ** 2 > reach * reach) continue;
          const key = PAIRS.find(
            ([a, b]) => (a === fam && b === opp) || (a === opp && b === fam),
          )!.join("-");
          counts.set(key, counts.get(key)! + 1);
        }
      }
    }
  });
  return PAIRS.map(([a, b]) => ({ a, b, n: counts.get(`${a}-${b}`)! }));
}

/** Share of dots that are cool (blue or violet), 0–1. */
export function coolShare(dots: readonly Dot[]): number {
  if (!dots.length) return 0;
  const cool = dots.filter((d) => {
    const f = PALETTE[d.c]?.family;
    return f === "blue" || f === "violet";
  }).length;
  return cool / dots.length;
}

/**
 * The average colour of some pixels, as linear light: what that part of the
 * painting looks like from across the room. `pixels` is RGBA bytes;
 * `keep(i)` picks which pixels (by index) to count.
 */
export function averageOf(
  pixels: ArrayLike<number>,
  keep: (i: number) => boolean = () => true,
): Rgb | null {
  const sum: Rgb = [0, 0, 0];
  let n = 0;
  for (let i = 0; i * 4 < pixels.length; i++) {
    if (!keep(i)) continue;
    for (let k = 0; k < 3; k++) sum[k] += toLinear(pixels[i * 4 + k] / 255);
    n++;
  }
  return n ? (sum.map((s) => s / n) as Rgb) : null;
}

/** The "sun and shade" lawn: where the shadow's edge runs, as the canvas's y at `x` (1200 × 800). */
export function shadeEdge(x: number): number {
  return 470 - 0.07 * x + 38 * Math.sin(x / 165);
}

export const inShade = (x: number, y: number) => y > shadeEdge(x);

export type Reading = {
  dots: number;
  colours: number;
  touches: Touches[];
  sun?: { colour: Rgb; cool: number };
  shade?: { colour: Rgb; cool: number };
};

/**
 * What the visitor did, in a few plain sentences: what they used, and why it
 * matters to how the picture looks. Every claim here is about their own dots.
 */
export function describe(r: Reading): string[] {
  if (!r.dots) return ["No dots yet. Pick a colour or two and drag across the canvas."];
  const lines: string[] = [
    `${r.dots.toLocaleString("en")} dots in ${r.colours} ${r.colours === 1 ? "colour" : "colours"}, none of them mixed with another.`,
  ];
  const opposite = r.touches.filter((t) => t.n > 0).sort((a, b) => b.n - a.n);
  if (opposite.length) {
    const [top] = opposite;
    lines.push(
      `${cap(top.a)} touches ${top.b} ${top.n.toLocaleString("en")} times. They're opposites on the colour circle Seurat studied: side by side, each makes the other look stronger.`,
    );
  } else {
    lines.push(
      "No opposite colours touch yet. Try a few orange dots among blue ones, or violet among yellow: Seurat set opposites side by side so each would look stronger.",
    );
  }
  if (r.sun && r.shade) {
    const darker = lightness(r.shade.colour) < lightness(r.sun.colour) * 0.85;
    const cooler = r.shade.cool > r.sun.cool + 0.1;
    if (darker && cooler)
      lines.push(
        "From across the room your shade is darker and cooler than your sun, without a touch of black or grey. That's how the shadows on La Grande Jatte's grass work: look for the blue dots in them.",
      );
    else if (!cooler)
      lines.push(
        "Seurat's shadows aren't grey or black. Try blue and violet dots among the greens in the shade, then step back.",
      );
    else
      lines.push(
        "Your shade is cooler than your sun. Put its dots closer together, or use darker colours, to make it read as shadow from across the room.",
      );
  }
  return lines;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
