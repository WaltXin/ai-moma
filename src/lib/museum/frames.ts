import type { Artwork } from "./types";

/** How a work is framed on the wall, on the site and on the walkable map. */
export type FrameKind = "gilt" | "black" | "mat";

const ON_PAPER =
  /lithograph|print|paper|watercolou?r|gouache|pencil|crayon|charcoal|etching|woodcut|collage|portfolio|plate/i;

/** The frame a curator would reach for: mats for paper, gilt for 19th-century oils, black after. */
export function frameFor(artwork: Pick<Artwork, "recipe" | "medium" | "year">): FrameKind {
  if (artwork.recipe) return "black";
  if (ON_PAPER.test(artwork.medium)) return "mat";
  return artwork.year < 1905 ? "gilt" : "black";
}
