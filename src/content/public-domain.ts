import type { Artwork } from "@/lib/museum/types";
import { collection } from "./collection.generated";

/**
 * A public-domain work from a museum's open-access collection.
 *
 *   pd("aic", 27992)   Art Institute of Chicago object 27992
 *   pd("cma", 143278)  Cleveland Museum of Art object 143278
 *   pd("met", 436535)  The Metropolitan Museum of Art object 436535
 *   pd("nga", 106382)  National Gallery of Art object 106382
 *
 * `pnpm art:fetch` reads these calls from exhibitions.ts, checks the work is
 * public domain, downloads the image to `public/art/` and records its
 * metadata in `collection.generated.ts`.
 */
export function pd(source: "aic" | "cma" | "met" | "nga", id: number): Artwork {
  const key = `${source}-${id}`;
  const work = collection[key];
  if (!work) {
    throw new Error(`Public-domain work ${key} hasn't been fetched yet. Run \`pnpm art:fetch\`.`);
  }
  return { id: key, ...work };
}
