#!/usr/bin/env node
/**
 * Voices the guided meditation's cues, once, so visitors play files instead
 * of waiting on a voice service.
 *
 *   pnpm meditation:voice             # voice anything new or changed
 *   pnpm meditation:voice --force     # re-voice everything
 *   pnpm meditation:voice --only settle
 *
 * Reads the cues in `src/content/meditation.ts`, asks Cartesia to read each
 * one, slowly, in the museum's English narrator's voice, saves
 * `public/meditation/<id>.mp3` (mono, 48 kbps, every cue at the same
 * loudness), and writes `src/content/meditation-audio.generated.ts` with each
 * file's length and the fingerprint of the text it was made from. A cue whose
 * text changes is voiced again; one that hasn't is skipped.
 *
 * Needs CARTESIA_API_KEY (in `.env.local`) and ffmpeg. Requests go one at a
 * time, as in `voice-guides.mjs`: the account's streams are shared with live calls.
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
const OUT_DIR = path.join(ROOT, "public/meditation");
const OUT_TS = path.join(ROOT, "src/content/meditation-audio.generated.ts");

const API = "https://api.cartesia.ai/tts/bytes";
const API_VERSION = "2025-04-16";
/** The same dated model and narrator as the audio guides, so the museum has one voice. */
const MODEL = "sonic-3.6-2026-08-27";
const VOICE = "26403c37-80c1-4a1a-8692-540551ca2ae5"; // Marian, Poised Narrator
/** Slower than a guide is read: there's no hurry here. */
const SPEED = 0.82;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const force = args.includes("--force");
const only = flag("--only");

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

async function voice(text, slow = true) {
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
      voice: { mode: "id", id: VOICE },
      language: "en",
      ...(slow ? { generation_config: { speed: SPEED } } : {}),
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 },
    }),
  });
  if (!res.ok) {
    const why = (await res.text()).slice(0, 300);
    // If the service won't take a speed, the narrator's own pace will do.
    if (slow && res.status >= 400 && res.status < 500 && /speed|generation_config/i.test(why)) {
      console.warn(`(no speed control: ${why.slice(0, 80)})`);
      return voice(text, false);
    }
    throw new Error(`Cartesia ${res.status}: ${why}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function seconds(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Math.round(Number(stdout.trim()) * 10) / 10;
}

async function main() {
  await loadEnv();
  if (!process.env.CARTESIA_API_KEY) throw new Error("Set CARTESIA_API_KEY (e.g. in .env.local).");
  const { meditationCues } = await import(path.join(ROOT, "src/content/meditation.ts"));
  const { guideHash } = await import(path.join(ROOT, "src/lib/museum/guides.ts"));
  let manifest = {};
  try {
    ({ meditationAudio: manifest } = await import(OUT_TS));
  } catch {
    manifest = {};
  }
  manifest = structuredClone(manifest ?? {});

  let made = 0;
  let kept = 0;
  for (const [id, text] of Object.entries(meditationCues)) {
    if (only && id !== only) continue;
    const hash = guideHash(text);
    const file = path.join(OUT_DIR, `${id}.mp3`);
    if (!force && manifest[id]?.hash === hash && existsSync(file)) {
      kept++;
      continue;
    }
    process.stdout.write(`${id} (${text.length} characters)… `);
    const wav = await voice(text);
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.wav`;
    await writeFile(tmp, wav);
    // Every cue to the same loudness, a little under the audio guides: it's spoken over quiet.
    await run("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      tmp,
      "-af",
      "loudnorm=I=-20:TP=-1.5:LRA=11",
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
    manifest[id] = { src: `/meditation/${id}.mp3`, seconds: s, hash };
    made++;
    console.log(`${s} s`);
  }

  // Drop entries whose cue is gone.
  for (const id of Object.keys(manifest)) if (!meditationCues[id]) delete manifest[id];
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((id) => [id, manifest[id]]));
  const source = `// Generated by scripts/voice-meditation.mjs. Do not edit by hand:
// change the cues in src/content/meditation.ts and run \`pnpm meditation:voice\`.
import type { CueAudio } from "@/lib/worlds/meditation";

export const meditationAudio: Record<string, CueAudio> = ${JSON.stringify(sorted)};
`;
  const options = (await prettier.resolveConfig(OUT_TS)) ?? {};
  await writeFile(OUT_TS, await prettier.format(source, { ...options, filepath: OUT_TS }));
  console.log(`Voiced ${made}, kept ${kept}.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
