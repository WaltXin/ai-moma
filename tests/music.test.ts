import { describe, expect, it } from "vitest";
import { seededRandom } from "@/lib/museum/placeholder";
import { getExhibitionsOnFloor, getFloors, getMovements } from "@/lib/museum/registry";
import { ROW, buildFloorPlan } from "@/lib/walk/floor-plan";
import { spawnPose, viewpoint } from "@/lib/walk/motion";
import { hz, moodFor, nextDegree, noteOf, surfaceAt } from "@/lib/walk/music";

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

describe("footsteps", () => {
  it("sound like oak in the rooms and terrazzo in the corridor", () => {
    const plan = getFloors()
      .map((floor) =>
        buildFloorPlan({
          floor,
          exhibitions: getExhibitionsOnFloor(floor),
          movements: getMovements(),
          floors: getFloors(),
        }),
      )
      .find((p) => p.artworks.length > 0)!;
    expect(surfaceAt(plan, spawnPose(plan).at)).toBe("stone");
    const inRoom = viewpoint(plan, { kind: "art", art: plan.artworks[0] }).at;
    expect(surfaceAt(plan, inRoom)).toBe("wood");
    expect(surfaceAt(plan, { x: plan.lounge.x + 2, z: ROW.roomTop + 1 })).toBe("wood");
  });
});
