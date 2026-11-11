import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getExhibitions,
  getExhibitionsOnFloor,
  getFloor,
  getFloorForWorld,
  getFloors,
  getWorlds,
  getWorldsOnFloor,
  validateMuseum,
} from "@/lib/museum/registry";
import type { Exhibition, Floor, Movement } from "@/lib/museum/types";
import { movements } from "@/content/movements";
import { collection } from "@/content/collection.generated";

describe("museum content", () => {
  it("is internally consistent", () => {
    expect(validateMuseum()).toEqual([]);
  });

  it("lists floors bottom-up", () => {
    const levels = getFloors().map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("resolves every exhibition on every floor", () => {
    for (const floor of getFloors()) {
      expect(getExhibitionsOnFloor(floor)).toHaveLength(floor.exhibitions.length);
    }
  });

  it("hangs at least four works in every curated room", () => {
    for (const e of getExhibitions().filter((x) => x.kind === "curated")) {
      expect(e.artworks.length, e.slug).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps every collection image, and a larger copy to zoom into, on disk", () => {
    for (const [key, work] of Object.entries(collection)) {
      const s = work.source;
      if (s.kind !== "image") continue;
      expect(existsSync(path.join("public", s.src)), key).toBe(true);
      if (!s.zoom) continue;
      expect(existsSync(path.join("public", s.zoom.src)), key).toBe(true);
      expect(s.zoom.width, key).toBeGreaterThan(s.width);
      // Same picture: the large copy keeps the wall image's proportions.
      expect(s.zoom.width / s.zoom.height, key).toBeCloseTo(s.width / s.height, 1);
    }
  });

  it("gives every movement on display at least one room", () => {
    const shown = new Set(getExhibitions().map((e) => e.movement));
    for (const m of movements) expect(shown.has(m.slug), m.slug).toBe(true);
  });

  it("builds movement prompts that include the visitor's words", () => {
    for (const m of movements) {
      expect(m.studio.buildPrompt("a red bicycle")).toContain("a red bicycle");
    }
  });
});

describe("validateMuseum", () => {
  const movement = movements[0] as Movement;
  const exhibition: Exhibition = {
    slug: "test-show",
    title: "Test",
    movement: movement.slug,
    description: "",
    curator: "x",
    kind: "curated",
    artworks: [],
  };
  const floor: Floor = {
    level: 1,
    slug: "one",
    name: "One",
    tagline: "",
    exhibitions: ["test-show"],
  };

  it("accepts a minimal valid museum", () => {
    expect(validateMuseum([movement], [exhibition], [floor], [])).toEqual([]);
  });

  it("flags unknown movements, missing exhibitions and orphans", () => {
    const problems = validateMuseum(
      [movement],
      [
        { ...exhibition, movement: "nope" },
        { ...exhibition, slug: "orphan" },
      ],
      [{ ...floor, exhibitions: ["test-show", "ghost"] }],
      [],
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unknown movement "nope"'),
        expect.stringContaining('unknown exhibition "ghost"'),
        expect.stringContaining('"orphan" is not on any floor'),
      ]),
    );
  });

  it("flags a world that points at a missing room or movement", () => {
    const world = {
      slug: "test-world",
      title: "Test",
      artist: "Test",
      year: 1900,
      heldBy: { institution: "Test", url: "https://example.org" },
      movement: "nope",
      room: "ghost-room",
      intro: "",
    };
    const problems = validateMuseum([movement], [exhibition], [floor], [world]);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('World "test-world" references unknown movement "nope"'),
        expect.stringContaining('World "test-world" references unknown room "ghost-room"'),
      ]),
    );
  });

  it("has a floor of painting worlds: Vibe, with the Starry Night and the Sunflowers on it", () => {
    const vibe = getFloor("vibe");
    expect(vibe).toBeDefined();
    const worlds = getWorldsOnFloor(vibe!).map((w) => w.slug);
    expect(worlds).toEqual(expect.arrayContaining(["starry-night", "sunflowers"]));
    // Every world is entered from exactly one floor, and comes back to it.
    for (const world of getWorlds()) expect(getFloorForWorld(world.slug)?.slug).toBe("vibe");
  });

  it("flags a floor that leads into a missing world, or a world on two floors", () => {
    const world = {
      slug: "test-world",
      title: "Test",
      artist: "Test",
      year: 1900,
      heldBy: { institution: "Test", url: "https://example.org" },
      movement: movement.slug,
      room: exhibition.slug,
      intro: "",
    };
    const upstairs: Floor = {
      level: floor.level + 1,
      slug: "upstairs",
      name: "Upstairs",
      tagline: "",
      exhibitions: [],
      worlds: ["test-world", "no-such-world"],
    };
    const again: Floor = { ...upstairs, level: floor.level + 2, slug: "again", worlds: ["test-world"] };
    const problems = validateMuseum([movement], [exhibition], [floor, upstairs, again], [world]);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Floor "upstairs" references unknown world "no-such-world"'),
        expect.stringContaining('World "test-world" is on two floors: upstairs, again'),
      ]),
    );
  });

  it("flags non-kebab-case slugs", () => {
    const problems = validateMuseum(
      [movement],
      [{ ...exhibition, slug: "Bad Slug" }],
      [{ ...floor, exhibitions: ["Bad Slug"] }],
      [],
    );
    expect(problems).toContain('Invalid slug "Bad Slug" (use kebab-case)');
  });
});
