import type { GenerationRequest, GenerationResult, ImageProvider } from "../types";

/**
 * Offline provider used for development, tests and demos. No API key,
 * no cost. It returns an SVG:
 *  - with an uploaded photo: a 2x2 posterized "silkscreen" grid
 *  - with only a prompt: a Ben-Day dot poster with the prompt as a caption
 *
 * This is NOT meant to be good art. It shows the full
 * upload → generate → display → submit loop working.
 */

const PANEL_TONES: [string, string, string][] = [
  ["#1d1d6b", "#ff2e63", "#fde047"],
  ["#0b3d2e", "#22d3ee", "#fef3c7"],
  ["#3b0764", "#f97316", "#a3e635"],
  ["#111111", "#ec4899", "#93c5fd"],
];

function hexToUnit(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(3)) as unknown as [
    number,
    number,
    number,
  ];
}

function escapeXml(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

/** Grayscale → three flat tones per panel: a cheap posterize/duotone. */
function toneFilter(id: string, tones: [string, string, string]): string {
  const [d, m, l] = tones.map(hexToUnit);
  const ch = (i: 0 | 1 | 2) => `${d[i]} ${m[i]} ${l[i]}`;
  return `<filter id="${id}" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer>
      <feFuncR type="discrete" tableValues="${ch(0)}"/>
      <feFuncG type="discrete" tableValues="${ch(1)}"/>
      <feFuncB type="discrete" tableValues="${ch(2)}"/>
    </feComponentTransfer>
  </filter>`;
}

const DOTS = `<pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse">
  <circle cx="5" cy="5" r="2.2" fill="#000" fill-opacity="0.18"/>
</pattern>`;

function photoGrid(image: { data: Uint8Array; mimeType: string }): string {
  const href = `data:${image.mimeType};base64,${Buffer.from(image.data).toString("base64")}`;
  const size = 512;
  const panels = PANEL_TONES.map((tones, i) => {
    const x = (i % 2) * size;
    const y = Math.floor(i / 2) * size;
    return `<image href="${href}" x="${x}" y="${y}" width="${size}" height="${size}"
      preserveAspectRatio="xMidYMid slice" filter="url(#tone${i})"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs>${PANEL_TONES.map((t, i) => toneFilter(`tone${i}`, t)).join("")}${DOTS}</defs>
    ${panels}
    <rect width="1024" height="1024" fill="url(#dots)"/>
    <path d="M512 0V1024M0 512H1024" stroke="#111" stroke-width="12"/>
  </svg>`;
}

function promptPoster(userPrompt: string): string {
  const caption = escapeXml(userPrompt.slice(0, 80) || "Untitled");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs>
      <pattern id="big" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="9" fill="#ff2e63"/>
      </pattern>
    </defs>
    <rect width="1024" height="1024" fill="#fde047"/>
    <rect width="1024" height="1024" fill="url(#big)" opacity="0.85"/>
    <rect x="64" y="760" width="896" height="200" fill="#fff" stroke="#111" stroke-width="10"/>
    <text x="512" y="875" text-anchor="middle" font-family="Arial Black, Arial, sans-serif"
      font-size="44" font-weight="900" fill="#111">${caption}</text>
  </svg>`;
}

export const mockProvider: ImageProvider = {
  id: "mock",
  label: "Mock (offline, no API key)",
  capabilities: { textToImage: true, imageToImage: true },
  isConfigured: () => true,
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const svg = request.sourceImage
      ? photoGrid(request.sourceImage)
      : promptPoster(request.userPrompt);
    return {
      imageUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      mimeType: "image/svg+xml",
      provider: "mock",
      model: "mock-svg-v1",
    };
  },
};
