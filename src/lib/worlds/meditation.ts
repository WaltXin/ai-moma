/**
 * A guided meditation in a painting world: what is said, and when. The words
 * live in `src/content/meditation.ts`; `pnpm meditation:voice` voices each cue
 * once, and `src/content/meditation-audio.generated.ts` records which audio
 * matches which text. Plain data and functions, safe on the server and the client.
 */

/** Every cue's words, by id. `look-<world slug>` is said only in that world. */
export type MeditationCues = Record<string, string>;

/** A voiced cue: its file, its length, and the text it was made from. */
export type CueAudio = { src: string; seconds: number; hash: string };

/** A cue as a visitor meets it: its words, and its voice if the voice was made from these words. */
export type Cue = { text: string; audio?: { src: string; seconds: number } };

/** A cue placed in a sitting: said `at` seconds after it begins. */
export type PlacedCue = Cue & { id: string; at: number };

/** The shortest and longest sitting, and the one offered first, in minutes. */
export const SITTING = { min: 1, max: 30, first: 5 };

/** A cue with no voice still takes this long to read, about. */
const readingTime = (text: string) => 2 + text.trim().split(/\s+/).length * 0.42;
export const cueSeconds = (cue: Cue) => cue.audio?.seconds ?? readingTime(cue.text);

/** The same fingerprint the audio guides use: a cue whose text changes must be voiced again. */
export { guideHash as cueHash } from "@/lib/museum/guides";

/** Silence left after one cue before the next may begin, in seconds. */
const REST = 12;
/** The cues of the middle of a sitting, in the order they come, as there's room for them. */
const MIDDLE = ["listen", "body", "wander", "eyes"];

/**
 * Where the voice comes in over a sitting of `seconds`, in the world `slug`.
 * It opens by settling the visitor and giving them the breath and something
 * to look at, speaks a few times through the middle with long silences
 * between (more of them the longer the sitting), says when the end is near,
 * and has the last word after the bowl. A short sitting gets only what fits:
 * nothing is ever said over anything else, or over the bowl.
 */
export function guidanceFor(
  seconds: number,
  slug: string,
  cues: Record<string, Cue>,
): PlacedCue[] {
  const placed: PlacedCue[] = [];
  const say = (id: string, at: number) => {
    const cue = cues[id];
    if (cue) placed.push({ ...cue, id, at });
    return cue ? at + cueSeconds(cue) : at;
  };
  const length = (id: string) => (cues[id] ? cueSeconds(cues[id]) : 0);

  // The closing words end a breath or two before the bowl.
  const closingAt = seconds - length("closing") - 14;
  // The opening: after the bowl has rung a moment.
  let t = say("settle", 4);
  for (const id of ["breath", `look-${slug}`]) {
    // Only what leaves the visitor some silence before the close.
    if (t + REST + length(id) + REST > closingAt) break;
    t = say(id, t + REST);
  }
  const opened = t;

  // The middle: as many cues as have a minute or so of their own, spread evenly.
  const span = closingAt - opened;
  const room = Math.max(0, Math.floor((span - 30) / 70));
  const middle = MIDDLE.slice(0, room);
  // In a long sitting the voice says it will leave them alone, and does.
  if (room > MIDDLE.length && cues.quiet) middle.push("quiet");
  middle.forEach((id, i) => {
    // Early in the stretch rather than evenly to its end, so a long sitting ends in a long silence.
    const share = Math.min(span / (middle.length + 1), 150);
    say(id, opened + share * (i + 1) - length(id) / 2);
  });

  if (closingAt > t + REST) say("closing", closingAt);
  // After the bowl's three strokes have rung.
  say("end", seconds + 12);
  return placed.sort((a, b) => a.at - b.at);
}
