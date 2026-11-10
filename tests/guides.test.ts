import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { guideSources, guides } from "@/content/guides";
import { guidesAudio } from "@/content/guides-audio.generated";
import { GUIDE_LANGS, GUIDE_LENGTH, guideHash, guideLength, preferredGuideLang } from "@/lib/museum/guides";
import { getArtwork, getGuide } from "@/lib/museum/registry";

describe("audio guides", () => {
  it("are for works in the museum, in every guide language", () => {
    for (const [id, byLang] of Object.entries(guides)) {
      expect(getArtwork(id), id).toBeDefined();
      for (const lang of GUIDE_LANGS) expect(byLang[lang]?.trim(), `${id} ${lang}`).toBeTruthy();
    }
  });

  it("are the length the standard sets: about a minute and a half, in every language", () => {
    for (const [id, byLang] of Object.entries(guides)) {
      for (const lang of GUIDE_LANGS) {
        const n = guideLength(byLang[lang]!, lang);
        const { min, max, unit } = GUIDE_LENGTH[lang];
        expect(n, `${id} ${lang}: ${n} ${unit}`).toBeGreaterThanOrEqual(min);
        expect(n, `${id} ${lang}: ${n} ${unit}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it("list their sources, the holding museum's own record first for a public-domain work", () => {
    for (const id of Object.keys(guides)) {
      const sources = guideSources[id] ?? [];
      expect(sources.length, `${id}: add its sources to guideSources`).toBeGreaterThan(0);
      for (const s of sources) expect(s.url, `${id}: ${s.label}`).toMatch(/^(https:\/\/|\/)/);
      const art = getArtwork(id)!;
      if (art.credit) expect(sources[0].url, `${id}: the holding museum's record comes first`).toBe(art.credit.url);
    }
  });

  it("are written for a voice: no symbols or abbreviations it would misread", () => {
    for (const [id, byLang] of Object.entries(guides)) {
      for (const [lang, text] of Object.entries(byLang)) {
        expect(text, `${id} ${lang}`).not.toMatch(/[&/%—()[\]{}#*_<>]|https?:|\bc\.\s|\bSt\.\s/);
        expect(text, `${id} ${lang}`).not.toMatch(/\n/);
      }
    }
  });

  it("have a recording of their current text, in every language", () => {
    for (const [id, byLang] of Object.entries(guides)) {
      for (const lang of GUIDE_LANGS) {
        const audio = guidesAudio[lang]?.[id];
        expect(audio, `${id} ${lang}: run pnpm guides:voice`).toBeDefined();
        expect(audio!.hash, `${id} ${lang}: the script changed; run pnpm guides:voice`).toBe(guideHash(byLang[lang]!));
        expect(existsSync(path.join("public", audio!.src)), audio!.src).toBe(true);
        expect(audio!.seconds).toBeGreaterThan(20);
      }
    }
  });

  it("never pairs a recording with a script it wasn't made from", () => {
    const [id] = Object.keys(guides);
    const guide = getGuide(id)!;
    for (const lang of GUIDE_LANGS) expect(guide[lang]?.audio?.src).toBe(guidesAudio[lang]?.[id]?.src);
    // The same text with a word changed has another fingerprint.
    expect(guideHash(guides[id].en!)).not.toBe(guideHash(`${guides[id].en} `));
    expect(getGuide("no-such-work")).toBeUndefined();
  });

  it("speaks the visitor's language when it can, English otherwise", () => {
    expect(preferredGuideLang(["fr-CA", "en"])).toBe("fr");
    expect(preferredGuideLang(["zh-Hans-CN"])).toBe("zh");
    expect(preferredGuideLang(["de-DE", "en-GB"])).toBe("en");
    expect(preferredGuideLang([])).toBe("en");
  });
});
