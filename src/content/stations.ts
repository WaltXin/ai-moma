/**
 * Hands-on stations: try a movement's technique with your own hands, see why
 * it works, then keep what you made. Keyed by movement slug; each has a page
 * at `/studio/<movement>` and a kiosk in that movement's room in the walk.
 * The station itself is a component, listed in `src/components/stations/`.
 */
export type StationInfo = {
  /** What the visitor does, as the kiosk and links name it. */
  title: string;
  blurb: string;
};

export const stations: Record<string, StationInfo> = {
  "neo-impressionism": {
    title: "Paint with dots",
    blurb:
      "Mix colours the way Seurat did, in the eye instead of on the palette. Paint a lawn in sun and shade with dots, step back, and ask to hang it.",
  },
};
