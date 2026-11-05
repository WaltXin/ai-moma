/// <reference lib="webworker" />
import type { Building } from "@/lib/walk/building";
import { BAKE_HIGH, BAKE_LOW, bakeLevel, lightLayout } from "@/lib/walk/light";
import { paintAt } from "./paint";

/**
 * Bakes the building's light off the main thread, a floor at a time in the
 * order asked (the visitor's floor first), posting each as it's done.
 */
export type BakeRequest = { building: Building; low: boolean; order: number[] };

self.onmessage = (e: MessageEvent<BakeRequest>) => {
  const { building, low, order } = e.data;
  for (const i of order) {
    const layout = lightLayout(building.levels[i], low ? BAKE_LOW : BAKE_HIGH);
    const baked = bakeLevel(building, layout, paintAt);
    (self as unknown as Worker).postMessage(baked, [
      baked.atlas.buffer,
      baked.floor.buffer,
      baked.ceiling.buffer,
    ]);
  }
};
