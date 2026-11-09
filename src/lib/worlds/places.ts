import type { WorldPlace } from "./place";
import { STARRY_NIGHT } from "./starry-night";
import { WHEAT_FIELD } from "./wheat-field";

/** Every painting world's place, by its slug in `src/content/worlds.ts`. */
export const PLACES: Record<string, WorldPlace> = {
  "starry-night": STARRY_NIGHT,
  "wheat-field-with-cypresses": WHEAT_FIELD,
};

export function getPlace(slug: string): WorldPlace {
  const place = PLACES[slug];
  if (!place)
    throw new Error(`No place for the world "${slug}": add it to src/lib/worlds/places.ts`);
  return place;
}
