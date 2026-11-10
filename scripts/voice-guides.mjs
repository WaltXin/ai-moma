#!/usr/bin/env node
/**
 * Voices the audio guides, once, so visitors play files instead of waiting on
 * a voice service.
 *
 *   pnpm guides:voice                 # voice anything new or changed
 *   pnpm guides:voice --force         # re-voice everything
 *   pnpm guides:voice --only aic-27992 --lang fr
 *
 * Reads the scripts in `src/content/guides.ts`, asks Cartesia to read each one
 * in its language's voice, saves `public/guides/<lang>/<id>.mp3` (mono, 48 kbps:
 * plenty for speech; every voice brought to the same loudness), and writes `src/content/guides-audio.generated.ts` with
 * each file's length and the fingerprint of the text it was made from. A script
 * whose text changes is voiced again; one that hasn't is skipped.
 *
 * Needs CARTESIA_API_KEY (in `.env.local`) and ffmpeg. Requests go one at a
 * time: the account's few concurrent streams are shared with live phone calls
 * (OrangeChat), and a batch here should never crowd them out.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as prettier from "prettier";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public/guides");
const OUT_TS = path.join(ROOT, "src/content/guides-audio.generated.ts");

const API = "https://api.cartesia.ai/tts/bytes";
const API_VERSION = "2025-04-16";
/** The same dated model OrangeChat uses, so a Cartesia-side change can't drift the voice. */
const MODEL = "sonic-3.6-2026-08-27";
/** A calm narrator per language, from Cartesia's library. */
const VOICES = {
  en: "26403c37-80c1-4a1a-8692-540551ca2ae5", // Marian, Poised Narrator
  fr: "8832a0b5-47b2-4751-bb22-6a8e2149303d", // French Narrator Lady
  zh: "b8cd71e3-bc14-4538-a530-d6314731c036", // Xia, Calm Companion
};

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const force = args.includes("--force");
const only = flag("--only");
const onlyLang = flag("--lang");

async function loadEnv() {
  if (process.env.CARTESIA_API_KEY) return;
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of (await readFile(p, "utf8")).split("\n")) {
      const m = line.match(/^\s*CARTESIA_API_KEY\s*=\s*"?([^"\s]+)"?/);
      if (m) process.env.CARTESIA_API_KEY = m[1];
    }
  }
}

async function voice(text, lang) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.CARTESIA_API_KEY,
      "Cartesia-Version": API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: MODEL,
      transcript: text,
      voice: { mode: "id", id: VOICES[lang] },
      language: lang,
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 },
    }),
  });
  if (!res.ok) throw new Error(`Cartesia ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function seconds(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Math.round(Number(stdout.trim()) * 10) / 10;
}

async function main() {
  await loadEnv();
  if (!process.env.CARTESIA_API_KEY) throw new Error("Set CARTESIA_API_KEY (e.g. in .env.local).");
  const { guides } = await import(path.join(ROOT, "src/content/guides.ts"));
  const { GUIDE_LANGS, guideHash } = await import(path.join(ROOT, "src/lib/museum/guides.ts"));
  let manifest = {};
  try {
    ({ guidesAudio: manifest } = await import(OUT_TS));
  } catch {
    manifest = {};
  }
  manifest = structuredClone(manifest ?? {});

  let made = 0;
  let kept = 0;
  for (const [id, byLang] of Object.entries(guides)) {
    if (only && id !== only) continue;
    for (const lang of GUIDE_LANGS) {
      const text = byLang[lang];
      if (!text || (onlyLang && lang !== onlyLang)) continue;
      const hash = guideHash(text);
      const file = path.join(OUT_DIR, lang, `${id}.mp3`);
      const have = manifest[lang]?.[id];
      if (!force && have?.hash === hash && existsSync(file)) {
        kept++;
        continue;
      }
      process.stdout.write(`${lang} ${id} (${text.length} characters)… `);
      const wav = await voice(text, lang);
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.wav`;
      await writeFile(tmp, wav);
      // Every voice to the same loudness, so switching language doesn't jump in volume.
      await run("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-i",
        tmp,
        "-af",
        "loudnorm=I=-18:TP=-1.5:LRA=11",
        "-ac",
        "1",
        "-ar",
        "24000",
        "-b:a",
        "48k",
        file,
      ]);
      await rm(tmp);
      const s = await seconds(file);
      manifest[lang] ??= {};
      manifest[lang][id] = { src: `/guides/${lang}/${id}.mp3`, seconds: s, hash };
      made++;
      console.log(`${s} s`);
    }
  }

  // Drop entries whose script is gone.
  for (const lang of Object.keys(manifest)) {
    for (const id of Object.keys(manifest[lang])) if (!guides[id]?.[lang]) delete manifest[lang][id];
  }
  const sorted = Object.fromEntries(
    GUIDE_LANGS.filter((l) => manifest[l]).map((l) => [
      l,
      Object.fromEntries(Object.keys(manifest[l]).sort().map((id) => [id, manifest[l][id]])),
    ]),
  );
  const source = `// Generated by scripts/voice-guides.mjs. Do not edit by hand:
// change the scripts in src/content/guides.ts and run \`pnpm guides:voice\`.
import type { GuidesAudio } from "@/lib/museum/guides";

export const guidesAudio: GuidesAudio = ${JSON.stringify(sorted)};
`;
  const options = (await prettier.resolveConfig(OUT_TS)) ?? {};
  await writeFile(OUT_TS, await prettier.format(source, { ...options, filepath: OUT_TS }));
  console.log(`Voiced ${made}, kept ${kept}.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
