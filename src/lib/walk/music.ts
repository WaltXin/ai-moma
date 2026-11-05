import { type FloorPlan, Tile, tileAt } from "./floor-plan";
import type { Vec } from "./motion";

/**
 * The sound of a walk, as data: each floor's musical mood, and what the
 * visitor's feet land on. The audio engine (`components/walk/audio.ts`) turns
 * these into sound, generating the music as it plays. Nothing is recorded, so
 * there's nothing to license, and every visit sounds a little different.
 */

export type Mood = {
  /** MIDI note the scale starts on. */
  root: number;
  /** Scale as semitones above the root. */
  scale: number[];
  /** Chords to drift between, as scale degrees (0 = root). */
  chords: number[][];
  /** Seconds per step of the score. */
  beat: number;
  /** Chance (0–1) of a melody note on each step. */
  density: number;
  /** Lowpass cutoff for the pad, in Hz: higher is brighter. */
  brightness: number;
  /** Lowest and highest scale degree the melody may reach. */
  range: [number, number];
  /** A soft bass note on every other step. */
  pulse?: boolean;
};

/** One mood per floor, chosen to suit its art, never a quotation of any piece. */
const FLOOR_MOODS: Record<string, Mood> = {
  // Impressionism: a bright, floating Lydian, unhurried.
  "light-and-color": {
    root: 62,
    scale: [0, 2, 4, 6, 7, 9, 11],
    chords: [
      [0, 2, 4, 6],
      [1, 3, 5, 0],
      [5, 0, 2, 4],
      [3, 5, 0, 2],
    ],
    beat: 0.6,
    density: 0.42,
    brightness: 2200,
    range: [4, 14],
  },
  // The avant-garde: whole tones, with nowhere to resolve.
  "avant-garde": {
    root: 60,
    scale: [0, 2, 4, 6, 8, 10],
    chords: [
      [0, 2, 4],
      [1, 3, 5],
      [0, 3, 5],
      [2, 4, 0],
    ],
    beat: 0.45,
    density: 0.5,
    brightness: 1900,
    range: [3, 13],
  },
  // Between the wars: a Dorian with jazz-age sevenths.
  "between-the-wars": {
    root: 57,
    scale: [0, 2, 3, 5, 7, 9, 10],
    chords: [
      [0, 2, 4, 6],
      [3, 5, 0, 2],
      [1, 3, 5, 0],
      [4, 6, 1, 3],
    ],
    beat: 0.5,
    density: 0.5,
    brightness: 2000,
    range: [5, 15],
  },
  // After the war: sparse, low and quiet, a lot of air between notes.
  postwar: {
    root: 52,
    scale: [0, 2, 3, 5, 7, 8, 10],
    chords: [
      [0, 4],
      [5, 2],
      [3, 0],
      [4, 1],
    ],
    beat: 0.95,
    density: 0.24,
    brightness: 1300,
    range: [5, 13],
  },
  // Pop: major pentatonic, brighter, with a gentle pulse.
  pop: {
    root: 65,
    scale: [0, 2, 4, 7, 9],
    chords: [
      [0, 1, 2],
      [3, 0, 1],
      [4, 1, 2],
      [2, 4, 0],
    ],
    beat: 0.36,
    density: 0.55,
    brightness: 3000,
    range: [3, 11],
    pulse: true,
  },
  // The Community Gallery: warm Mixolydian, welcoming.
  community: {
    root: 60,
    scale: [0, 2, 4, 5, 7, 9, 10],
    chords: [
      [0, 2, 4],
      [6, 1, 3],
      [3, 5, 0],
      [4, 6, 1],
    ],
    beat: 0.48,
    density: 0.46,
    brightness: 2400,
    range: [4, 13],
    pulse: true,
  },
};

const DEFAULT_MOOD: Mood = {
  root: 60,
  scale: [0, 2, 4, 5, 7, 9, 11],
  chords: [
    [0, 2, 4],
    [5, 0, 2],
    [3, 5, 0],
    [4, 6, 1],
  ],
  beat: 0.55,
  density: 0.42,
  brightness: 2200,
  range: [4, 13],
};

/** The mood for a floor; a new floor without one gets a calm major key. */
export function moodFor(slug: string): Mood {
  return FLOOR_MOODS[slug] ?? DEFAULT_MOOD;
}

/** MIDI note of a scale degree; degrees past the scale wrap into the next octave. */
export function noteOf(mood: Mood, degree: number): number {
  const n = mood.scale.length;
  const octave = Math.floor(degree / n);
  return mood.root + octave * 12 + mood.scale[((degree % n) + n) % n];
}

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * The next melody degree: mostly steps, sometimes a small leap, always inside
 * the mood's range, so the line wanders but never runs off.
 */
export function nextDegree(mood: Mood, from: number, rand: () => number): number {
  const r = rand();
  const move = r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : r < 0.97 ? 4 : -3;
  const [lo, hi] = mood.range;
  let next = from + move;
  if (next > hi) next = from - Math.abs(move);
  if (next < lo) next = from + Math.abs(move);
  return Math.max(lo, Math.min(hi, next));
}

/** Metres between footfalls; matches the head bob of the walk (two steps per sway). */
export const STEP = Math.PI / 4.2;

export type Surface = "wood" | "stone";

/** What the visitor is standing on: oak in the rooms and lounge, terrazzo in the corridor. */
export function surfaceAt(plan: FloorPlan, p: Vec): Surface {
  return tileAt(plan, Math.floor(p.x), Math.floor(p.z)) === Tile.Corridor ? "stone" : "wood";
}
