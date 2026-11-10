/**
 * Audio guides: a spoken explanation of a work, in each guide language. The
 * scripts live in `src/content/guides.ts`; `pnpm guides:voice` voices each one
 * once, and `src/content/guides-audio.generated.ts` records which audio
 * matches which text. Plain data, safe on the server and the client.
 */

export const GUIDE_LANGS = ["en", "fr", "zh"] as const;
export type GuideLang = (typeof GUIDE_LANGS)[number];

/** What each language is called, in itself, for the picker. */
export const GUIDE_LANG_NAMES: Record<GuideLang, string> = {
  en: "English",
  fr: "Français",
  zh: "中文",
};

/** Scripts, by artwork id, then language. */
export type Guides = Record<string, Partial<Record<GuideLang, string>>>;

/** Where a script's facts come from (`docs/AUDIO_GUIDES.md`): the holding museum's record first. */
export type GuideSource = { label: string; url: string; licence?: string };

/** Length a script should have in each language, as `docs/AUDIO_GUIDES.md` sets it (words, or characters for Chinese). */
export const GUIDE_LENGTH: Record<GuideLang, { min: number; max: number; unit: "words" | "characters" }> = {
  en: { min: 200, max: 240, unit: "words" },
  fr: { min: 200, max: 290, unit: "words" },
  zh: { min: 380, max: 520, unit: "characters" },
};

/** A script's length in its language's unit. */
export function guideLength(text: string, lang: GuideLang): number {
  return GUIDE_LENGTH[lang].unit === "words" ? text.trim().split(/\s+/).length : [...text.trim()].length;
}

/** A voiced script: its file, its length, and the text it was made from. */
export type GuideAudio = { src: string; seconds: number; hash: string };
export type GuidesAudio = Partial<Record<GuideLang, Record<string, GuideAudio>>>;

/**
 * A short fingerprint of a script (FNV-1a, 32-bit, hex), so audio made from
 * an older version of the text is never played under the new one.
 */
export function guideHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The language a visitor most likely wants, from their browser's list. */
export function preferredGuideLang(languages: readonly string[]): GuideLang {
  for (const l of languages) {
    const base = l.toLowerCase().split("-")[0];
    if ((GUIDE_LANGS as readonly string[]).includes(base)) return base as GuideLang;
  }
  return "en";
}
