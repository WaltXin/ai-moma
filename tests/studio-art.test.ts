import { describe, expect, it } from "vitest";
import { getArtwork, getStudioArtworks } from "@/lib/museum/registry";
import {
  RECIPES,
  type RecipeName,
  frameCount,
  parseStudioArtFile,
  renderStudioArt,
  studioArtUrl,
} from "@/lib/studio-art";

const recipes = Object.keys(RECIPES) as RecipeName[];

describe("studio art recipes", () => {
  it.each(recipes)("%s renders a clean, deterministic SVG", (name) => {
    for (let f = 0; f < frameCount(name); f++) {
      const svg = renderStudioArt(name, 1234, f);
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg).toContain(`viewBox="0 0 ${RECIPES[name].width} ${RECIPES[name].height}"`);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderStudioArt(name, 1234, f)).toBe(svg);
    }
  });

  it("draws different pieces from different seeds, except fixed illustrations", () => {
    // These are designed compositions (the can grid, the comic panels, the
    // Agamograph views); every other recipe is generative.
    const illustrations = [
      "minimal-units",
      "pop-can",
      "pop-selfie",
      "pop-notification",
      "agam-two-skies",
      "agam-square-circle",
      "agam-three-rainbows",
    ];
    for (const name of recipes) {
      const varies = [2, 3, 4, 5].some(
        (s) => renderStudioArt(name, s) !== renderStudioArt(name, 1),
      );
      expect(varies, name).toBe(!illustrations.includes(name));
    }
  });

  it("gives each Agamograph view its own image", () => {
    for (const name of recipes.filter((r) => frameCount(r) > 1)) {
      expect(renderStudioArt(name, 7, 0)).not.toBe(renderStudioArt(name, 7, 1));
    }
  });

  it("maps file names to artworks and back", () => {
    expect(parseStudioArtFile("dream-logic-1.svg")).toEqual({ id: "dream-logic-1" });
    expect(parseStudioArtFile("angles-of-view-1.f1.svg")).toEqual({
      id: "angles-of-view-1",
      frame: 1,
    });
    expect(parseStudioArtFile("../etc/passwd")).toBeNull();
    for (const a of getStudioArtworks()) {
      expect(getArtwork(a.id)).toBe(a);
      const src =
        a.source.kind === "lenticular"
          ? a.source.frames[1].src
          : a.source.kind === "image"
            ? a.source.src
            : "";
      const file = src.replace("/studio-art/", "");
      expect(parseStudioArtFile(file)?.id).toBe(a.id);
      expect(src).toBe(studioArtUrl(a.id, a.source.kind === "lenticular" ? 1 : undefined));
    }
  });
});
