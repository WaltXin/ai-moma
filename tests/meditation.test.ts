import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { meditationCues } from "@/content/meditation";
import { getMeditationCues, getWorlds } from "@/lib/museum/registry";
import { SITTING, cueSeconds, guidanceFor } from "@/lib/worlds/meditation";

const cues = getMeditationCues();

describe("the guided meditation", () => {
  it("has a voice for every cue, made from the words as they stand", () => {
    for (const [id, cue] of Object.entries(cues)) {
      expect(cue.text, id).toBe(meditationCues[id]);
      // Run `pnpm meditation:voice` after changing a cue.
      expect(cue.audio, `${id} needs voicing`).toBeDefined();
      expect(existsSync(path.join(process.cwd(), "public", cue.audio!.src)), id).toBe(true);
      expect(cue.audio!.seconds).toBeGreaterThan(2);
    }
  });

  it("gives every world something of its own to look at", () => {
    for (const world of getWorlds()) expect(cues[`look-${world.slug}`], world.slug).toBeDefined();
  });

  it("never speaks over itself, the opening bowl or the closing one, however long the sitting", () => {
    for (const world of getWorlds()) {
      for (let minutes = SITTING.min; minutes <= SITTING.max; minutes++) {
        const seconds = minutes * 60;
        const placed = guidanceFor(seconds, world.slug, cues);
        const label = `${world.slug}, ${minutes} min`;
        // It opens by settling them, and has the last word after the bowl has rung.
        expect(placed[0].id, label).toBe("settle");
        expect(placed[0].at, label).toBeGreaterThanOrEqual(3);
        expect(placed.at(-1)!.id, label).toBe("end");
        expect(placed.at(-1)!.at, label).toBeGreaterThanOrEqual(seconds + 10);
        // Nothing said twice.
        expect(new Set(placed.map((c) => c.id)).size, label).toBe(placed.length);
        for (const [i, cue] of placed.entries()) {
          const ends = cue.at + cueSeconds(cue);
          const next = placed[i + 1];
          // A good silence after each, before the next.
          if (next) expect(next.at - ends, `${label}: after ${cue.id}`).toBeGreaterThanOrEqual(8);
          // Quiet as the bowl is struck to end.
          if (cue.id !== "end") expect(ends, `${label}: ${cue.id}`).toBeLessThanOrEqual(seconds - 8);
        }
        // Another world's cue is never said here.
        for (const cue of placed)
          if (cue.id.startsWith("look-")) expect(cue.id, label).toBe(`look-${world.slug}`);
      }
    }
  });

  it("says more in a long sitting than a short one, and leaves long silences in both", () => {
    const short = guidanceFor(60, "starry-night", cues);
    const usual = guidanceFor(5 * 60, "starry-night", cues);
    const long = guidanceFor(30 * 60, "starry-night", cues);
    expect(short.map((c) => c.id)).toEqual(["settle", "closing", "end"]);
    expect(usual.map((c) => c.id)).toEqual(
      expect.arrayContaining(["settle", "breath", "look-starry-night", "closing", "end"]),
    );
    expect(long.length).toBeGreaterThan(usual.length);
    // In half an hour the voice says it will be quiet, and then is, for most of it.
    const quiet = long.find((c) => c.id === "quiet")!;
    const closing = long.find((c) => c.id === "closing")!;
    expect(closing.at - quiet.at).toBeGreaterThan(10 * 60);
    // Speech is a small part of any sitting.
    for (const placed of [usual, long]) {
      const spoken = placed.reduce((sum, c) => sum + cueSeconds(c), 0);
      const seconds = placed.at(-1)!.at;
      expect(spoken / seconds).toBeLessThan(0.3);
    }
  });
});
