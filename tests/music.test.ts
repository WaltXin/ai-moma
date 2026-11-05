import { describe, expect, it } from "vitest";
import { seededRandom } from "@/lib/museum/placeholder";
import { getExhibitionsOnFloor, getFloors, getMovements } from "@/lib/museum/registry";
import { buildBuilding } from "@/lib/walk/building";
import { startPose, viewpoint } from "@/lib/walk/motion";
import { acousticsAt, hz, moodAt, moodFor, nextDegree, noteOf, surfaceAt } from "@/lib/walk/music";

describe("floor music", () => {
  it("gives every floor a playable mood, and new floors a default one", () => {
    for (const floor of [...getFloors(), { slug: "not-built-yet" }]) {
      const mood = moodFor(floor.slug);
      expect(mood.scale[0]).toBe(0);
      expect(mood.chords.length).toBeGreaterThan(0);
      for (const chord of mood.chords) {
        for (const d of chord) expect(d).toBeLessThan(mood.scale.length);
      }
      expect(mood.beat).toBeGreaterThan(0.2);
      expect(mood.density).toBeGreaterThan(0);
      expect(mood.density).toBeLessThanOrEqual(1);
      expect(mood.range[0]).toBeLessThan(mood.range[1]);
    }
  });

  it("gives floors with different art different moods", () => {
    expect(moodFor("light-and-color")).not.toEqual(moodFor("pop"));
    expect(moodFor("postwar").beat).toBeGreaterThan(moodFor("pop").beat);
  });

  it("maps scale degrees to notes, wrapping into the next octave", () => {
    const mood = moodFor("light-and-color");
    expect(noteOf(mood, 0)).toBe(mood.root);
    expect(noteOf(mood, mood.scale.length)).toBe(mood.root + 12);
    expect(noteOf(mood, -1)).toBe(mood.root - 12 + mood.scale.at(-1)!);
    expect(hz(69)).toBe(440);
  });

  it("keeps the melody wandering inside its range", () => {
    for (const floor of getFloors()) {
      const mood = moodFor(floor.slug);
      const rand = seededRandom(5);
      let d = mood.range[0];
      const seen = new Set<number>();
      for (let i = 0; i < 2000; i++) {
        const next = nextDegree(mood, d, rand);
        expect(next).toBeGreaterThanOrEqual(mood.range[0]);
        expect(next).toBeLessThanOrEqual(mood.range[1]);
        expect(Math.abs(next - d)).toBeLessThanOrEqual(4);
        seen.add(next);
        d = next;
      }
      // It actually moves around.
      expect(seen.size).toBeGreaterThan(4);
    }
  });
});

describe("the sound of the building", () => {
  const b = buildBuilding({ floors: getFloors(), exhibitionsOn: getExhibitionsOnFloor, movements: getMovements() });
  const lobby = { level: 0, pos: startPose(b).pos };
  const art = b.artworks[0];
  const gallery = { level: art.level, pos: viewpoint(b, { kind: "art", art }).at };
  const street = { level: 0, pos: { x: 24, z: 46 } };
  const terraceSpace = b.levels.flatMap((l) => l.spaces.map((s) => ({ l, s }))).find(({ s }) => s.kind === "terrace")!;
  const terrace = { level: terraceSpace.l.index, pos: { x: terraceSpace.s.rect.x0 + 3, z: 18 } };

  it("puts stone underfoot in the lobby, oak in the galleries, decking on the terrace, pavement outside", () => {
    expect(surfaceAt(b, lobby)).toBe("stone");
    expect(surfaceAt(b, gallery)).toBe("wood");
    expect(surfaceAt(b, terrace)).toBe("deck");
    expect(surfaceAt(b, street)).toBe("street");
  });

  it("plays the lobby's music downstairs and each floor's own up in the galleries", () => {
    expect(moodAt(b, lobby)).toBe(moodAt(b, street));
    expect(moodAt(b, gallery)).toBe(moodFor(b.levels[art.level].slug));
    expect(moodAt(b, gallery)).not.toBe(moodAt(b, lobby));
  });

  it("echoes in the halls, not in the street", () => {
    expect(acousticsAt(b, lobby)).toBe("hall");
    expect(acousticsAt(b, gallery)).toBe("room");
    expect(acousticsAt(b, street)).toBe("outside");
    expect(acousticsAt(b, terrace)).toBe("outside");
  });
});
