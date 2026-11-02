import { describe, expect, it } from "vitest";
import { getExhibitionsOnFloor, getFloors, validateMuseum } from "@/lib/museum/registry";
import type { Exhibition, Floor, Movement } from "@/lib/museum/types";
import { movements } from "@/content/movements";

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
    expect(validateMuseum([movement], [exhibition], [floor])).toEqual([]);
  });

  it("flags unknown movements, missing exhibitions and orphans", () => {
    const problems = validateMuseum(
      [movement],
      [
        { ...exhibition, movement: "nope" },
        { ...exhibition, slug: "orphan" },
      ],
      [{ ...floor, exhibitions: ["test-show", "ghost"] }],
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unknown movement "nope"'),
        expect.stringContaining('unknown exhibition "ghost"'),
        expect.stringContaining('"orphan" is not on any floor'),
      ]),
    );
  });

  it("flags non-kebab-case slugs", () => {
    const problems = validateMuseum(
      [movement],
      [{ ...exhibition, slug: "Bad Slug" }],
      [{ ...floor, exhibitions: ["Bad Slug"] }],
    );
    expect(problems).toContain('Invalid slug "Bad Slug" (use kebab-case)');
  });
});
