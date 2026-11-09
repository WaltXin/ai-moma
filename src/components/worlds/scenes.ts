import type { SceneMaker } from "./kit";

/**
 * Every painting world's scene, by slug, loaded only when someone steps in
 * (three.js and the painting code stay out of every other page).
 */
export const SCENES: Record<string, () => Promise<SceneMaker>> = {
  "starry-night": () => import("./starry-night-scene").then((m) => m.createStarryNightScene),
  "wheat-field-with-cypresses": () =>
    import("./wheat-field-scene").then((m) => m.createWheatFieldScene),
};
