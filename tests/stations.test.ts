import { describe, expect, it } from "vitest";
import { STATION_PAGES } from "@/components/stations/pages";
import { stations } from "@/content/stations";
import { getExhibitionsForMovement, getMovement, getStationMovements } from "@/lib/museum/registry";
import { buildBuilding } from "@/lib/walk/building";
import { getExhibitionsOnFloor, getFloors, getMovements, getStation } from "@/lib/museum/registry";
import {
  COMPLEMENT,
  type Dot,
  PALETTE,
  averageOf,
  coolShare,
  describe as describeReading,
  eyeMix,
  hex,
  inShade,
  lightness,
  paintMix,
  touches,
} from "@/lib/stations/dots";

const at = (name: string) => PALETTE.findIndex((c) => c.name === name);

describe("hands-on stations", () => {
  it("are for real movements that hang in a room, each with a page", () => {
    for (const slug of getStationMovements()) {
      expect(getMovement(slug), slug).toBeDefined();
      expect(getExhibitionsForMovement(slug).length, `${slug}: no room for its kiosk`).toBeGreaterThan(0);
      expect(STATION_PAGES[slug], `${slug}: add its page body to STATION_PAGES`).toBeDefined();
    }
    expect(Object.keys(STATION_PAGES).sort()).toEqual(Object.keys(stations).sort());
  });

  it("each have a kiosk in their movement's room in the walk", () => {
    const building = buildBuilding({
      floors: getFloors(),
      exhibitionsOn: getExhibitionsOnFloor,
      movements: getMovements(),
      stations: Object.fromEntries(getStationMovements().map((m) => [m, getStation(m)!])),
    });
    for (const slug of getStationMovements()) {
      const kiosk = building.portals.find((p) => p.kind === "station" && p.href === `/studio/${slug}`);
      expect(kiosk, slug).toBeDefined();
      const room = building.rooms.find((r) => r.movement.slug === slug)!;
      expect(room.movement.station).toBe(`/studio/${slug}`);
      expect(kiosk!.level).toBe(room.level);
      const { x0, x1, z0, z1 } = room.rect;
      expect(kiosk!.at.x > x0 && kiosk!.at.x < x1 && kiosk!.at.z > z0 && kiosk!.at.z < z1, "kiosk inside the room").toBe(true);
    }
  });
});

describe("painting with dots", () => {
  it("mixes lighter in the eye than on the palette, for every pair of colours", () => {
    for (const a of PALETTE) {
      for (const b of PALETTE) {
        const parts = [
          { hex: a.hex, weight: 1 },
          { hex: b.hex, weight: 1 },
        ];
        expect(lightness(eyeMix(parts))).toBeGreaterThanOrEqual(lightness(paintMix(parts)) - 1e-9);
      }
    }
    // One colour mixed with itself is itself, either way.
    expect(hex(eyeMix([{ hex: "#f08a1d", weight: 1 }]))).toBe("#f08a1d");
    expect(hex(paintMix([{ hex: "#f08a1d", weight: 2 }]))).toBe("#f08a1d");
  });

  it("pairs opposites both ways round", () => {
    for (const [a, b] of Object.entries(COMPLEMENT)) if (b) expect(COMPLEMENT[b]).toBe(a);
  });

  it("counts opposite colours that touch, not ones far apart or alike", () => {
    const orange = at("Orange");
    const blue = at("Blue");
    const green = at("Green");
    const dots: Dot[] = [
      { x: 100, y: 100, r: 5, c: orange },
      { x: 110, y: 100, r: 5, c: blue }, // touching the orange
      { x: 400, y: 400, r: 5, c: blue }, // far off
      { x: 120, y: 100, r: 5, c: green }, // touching, but not an opposite of blue
    ];
    expect(touches(dots).find((t) => t.a === "orange")!.n).toBe(1);
    expect(touches(dots).find((t) => t.a === "red")!.n).toBe(0);
  });

  it("averages pixels as light, the way distance blends them", () => {
    // Half black, half white pixels average to a mid light, not to #808080's darker mid.
    const px = [0, 0, 0, 255, 255, 255, 255, 255];
    expect(hex(averageOf(px)!)).toBe("#bcbcbc");
    expect(averageOf(px, () => false)).toBeNull();
  });

  it("tells the visitor what they did: opposites, and whether the shade reads as shade", () => {
    expect(describeReading({ dots: 0, colours: 0, touches: [] })[0]).toMatch(/No dots yet/);
    const lines = describeReading({
      dots: 1200,
      colours: 3,
      touches: [
        { a: "orange", b: "blue", n: 40 },
        { a: "yellow", b: "violet", n: 0 },
        { a: "red", b: "green", n: 0 },
      ],
      sun: { colour: [0.5, 0.6, 0.2], cool: 0 },
      shade: { colour: [0.1, 0.15, 0.2], cool: 0.4 },
    });
    expect(lines[0]).toMatch(/1,200 dots in 3 colours/);
    expect(lines[1]).toMatch(/Orange touches blue 40 times/);
    expect(lines[2]).toMatch(/darker and cooler/);
    const grey = describeReading({
      dots: 10,
      colours: 1,
      touches: [],
      sun: { colour: [0.5, 0.5, 0.5], cool: 0 },
      shade: { colour: [0.2, 0.2, 0.2], cool: 0 },
    });
    expect(grey.at(-1)).toMatch(/blue and violet/);
  });

  it("splits the lawn into sun above and shade below", () => {
    expect(inShade(600, 100)).toBe(false);
    expect(inShade(600, 750)).toBe(true);
    expect(coolShare([{ x: 0, y: 0, r: 1, c: at("Violet") }, { x: 0, y: 0, r: 1, c: at("Yellow") }])).toBe(0.5);
  });
});
