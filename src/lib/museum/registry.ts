import { exhibitions as allExhibitions } from "@/content/exhibitions";
import { floors as allFloors } from "@/content/floors";
import { movements as allMovements } from "@/content/movements";
import { RECIPES } from "@/lib/studio-art";
import type { Artwork, Exhibition, Floor, Movement } from "./types";

/**
 * Read-only access to museum content. Pages go through these helpers
 * rather than importing `src/content` directly, so the storage can move
 * to a database later without touching UI code.
 */

export function getFloors(): Floor[] {
  return [...allFloors].sort((a, b) => a.level - b.level);
}

export function getFloor(slug: string): Floor | undefined {
  return allFloors.find((f) => f.slug === slug);
}

export function getMovements(): Movement[] {
  return allMovements;
}

export function getMovement(slug: string): Movement | undefined {
  return allMovements.find((m) => m.slug === slug);
}

export function getExhibitions(): Exhibition[] {
  return allExhibitions;
}

export function getExhibition(slug: string): Exhibition | undefined {
  return allExhibitions.find((e) => e.slug === slug);
}

export function getExhibitionsOnFloor(floor: Floor): Exhibition[] {
  return floor.exhibitions
    .map((slug) => getExhibition(slug))
    .filter((e): e is Exhibition => e !== undefined);
}

/**
 * Rooms that hang a movement, in the order a visitor meets them going up the
 * building, curated rooms before community ones. The first is its home room.
 */
export function getExhibitionsForMovement(slug: string): Exhibition[] {
  const rooms = getFloors()
    .flatMap((f) => getExhibitionsOnFloor(f))
    .filter((e) => e.movement === slug);
  return [
    ...rooms.filter((e) => e.kind === "curated"),
    ...rooms.filter((e) => e.kind !== "curated"),
  ];
}

export function getArtwork(id: string): Artwork | undefined {
  for (const e of allExhibitions) {
    const found = e.artworks.find((a) => a.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Every Studio piece drawn with code, for prerendering `/studio-art/*`. */
export function getStudioArtworks(): Artwork[] {
  return allExhibitions.flatMap((e) => e.artworks.filter((a) => a.recipe));
}

export function getFloorForExhibition(slug: string): Floor | undefined {
  return allFloors.find((f) => f.exhibitions.includes(slug));
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Checks that the content graph is consistent. Run in tests and CI so a
 * contributor's PR fails fast if it references a missing movement, etc.
 * Returns a list of human-readable problems (empty = valid).
 */
export function validateMuseum(
  movements: Movement[] = allMovements,
  exhibitions: Exhibition[] = allExhibitions,
  floors: Floor[] = allFloors,
): string[] {
  const problems: string[] = [];

  const dupes = (label: string, keys: (string | number)[]) => {
    const seen = new Set<string | number>();
    for (const k of keys) {
      if (seen.has(k)) problems.push(`Duplicate ${label}: ${k}`);
      seen.add(k);
    }
  };
  dupes(
    "movement slug",
    movements.map((m) => m.slug),
  );
  dupes(
    "exhibition slug",
    exhibitions.map((e) => e.slug),
  );
  dupes(
    "floor slug",
    floors.map((f) => f.slug),
  );
  dupes(
    "floor level",
    floors.map((f) => f.level),
  );
  dupes(
    "artwork id",
    exhibitions.flatMap((e) => e.artworks.map((a) => a.id)),
  );

  for (const slug of [
    ...movements.map((m) => m.slug),
    ...exhibitions.map((e) => e.slug),
    ...floors.map((f) => f.slug),
  ]) {
    if (!SLUG_RE.test(slug)) problems.push(`Invalid slug "${slug}" (use kebab-case)`);
  }

  const movementSlugs = new Set(movements.map((m) => m.slug));
  for (const e of exhibitions) {
    if (!movementSlugs.has(e.movement)) {
      problems.push(`Exhibition "${e.slug}" references unknown movement "${e.movement}"`);
    }
  }

  const exhibitionSlugs = new Set(exhibitions.map((e) => e.slug));
  const placed = new Map<string, string>();
  for (const f of floors) {
    for (const slug of f.exhibitions) {
      if (!exhibitionSlugs.has(slug)) {
        problems.push(`Floor "${f.slug}" references unknown exhibition "${slug}"`);
      }
      const other = placed.get(slug);
      if (other) problems.push(`Exhibition "${slug}" is on two floors: ${other}, ${f.slug}`);
      placed.set(slug, f.slug);
    }
  }
  for (const e of exhibitions) {
    if (!placed.has(e.slug)) problems.push(`Exhibition "${e.slug}" is not on any floor`);
  }

  for (const e of exhibitions) {
    for (const a of e.artworks) {
      if (a.source.kind === "image" && a.source.src.startsWith("/art/") && !a.credit) {
        problems.push(`Artwork "${a.id}" uses a collection image but has no credit`);
      }
      if (a.recipe && !(a.recipe.name in RECIPES)) {
        problems.push(`Artwork "${a.id}" uses unknown recipe "${a.recipe.name}"`);
      }
    }
  }

  for (const m of movements) {
    if (m.palette.length < 3) problems.push(`Movement "${m.slug}" needs at least 3 palette colors`);
    if (m.learn.length === 0) problems.push(`Movement "${m.slug}" has no learn sections`);
  }

  return problems;
}
