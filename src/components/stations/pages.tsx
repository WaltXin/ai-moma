import type { ComponentType } from "react";
import { DotPainting } from "./dot-painting";
import { EyeMix } from "./eye-mix";
import { Station } from "./station";

/**
 * Each hands-on station's page body, by movement slug: an opening line, then
 * its stations. Its title and kiosk text are in `src/content/stations.ts`;
 * a test checks the two lists match.
 */
export const STATION_PAGES: Record<
  string,
  { intro: string; Body: ComponentType<{ movement: string }> }
> = {
  "neo-impressionism": {
    intro:
      "Georges Seurat didn’t mix his colours on the palette. He set dots of pure colour side by side and left your eye to mix them. Try it for yourself: first two colours, then a whole lawn.",
    Body: SeuratStations,
  },
};

function SeuratStations({ movement }: { movement: string }) {
  return (
    <>
      <Station
        id="mix-in-the-eye"
        title="Mix in the eye"
        see="Two colours of dots. Step back, and they melt into one."
        really="Separate dots of pure colour. Once they're too small to tell apart, their light reaches your eye together and is averaged. Stir the same two paints together on a palette and each soaks up some of the light the other reflects, so the mixture comes out darker."
        tryIt="Drag Step back all the way, then compare the two swatches. Change the colours: the eye's mix is lighter every time."
        note="Seurat read colour scientists such as Michel-Eugène Chevreul and Ogden Rood, and believed colour mixed in the eye would look more brilliant than colour mixed on a palette."
      >
        <EyeMix />
      </Station>

      <Station
        id="sun-and-shade"
        title="Paint the sun and the shade"
        see="A lawn in sunshine with a shadow falling across it."
        really="Nothing but dots of pure colour on bare canvas. The sunlight and the shadow are made entirely by which colours you put side by side."
        tryIt="Paint the sun with green and yellow, and the shade with green and blue or violet. Step back, read what you used, then keep it."
        note="The grass in A Sunday on La Grande Jatte is painted this way: look for the blue dots hidden in its shadows. Seurat spent two years on that canvas; a lawn takes a few minutes."
        last
      >
        <DotPainting movement={movement} />
      </Station>
    </>
  );
}
