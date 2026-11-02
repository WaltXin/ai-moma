/**
 * Core domain model for AI MoMA.
 *
 *   Museum ─┬─ Floor ──── Exhibition ──── Artwork
 *           └─ Movement (Pop Art, Op Art, …)
 *                ├─ learn   → education content
 *                ├─ studio  → how visitors generate art in this style
 *                └─ viewer  → how its artworks are displayed
 *
 * Movements are the main extension point for contributors: add a folder
 * under `src/content/movements/` and register it. See CONTRIBUTING.md.
 */

/** URL-safe identifier, e.g. "pop-art". */
export type Slug = string;

/**
 * How an artwork is presented in the gallery.
 * - `wall`        flat 2D image hung on a wall (default)
 * - `agamograph`  lenticular piece whose image changes with viewing angle
 * - `room3d`      3D model / walk-through scene
 *
 * Only `wall` is rendered today; the others fall back to `wall` until
 * their viewers are built (see docs/ROADMAP.md).
 */
export type ViewerKind = "wall" | "agamograph" | "room3d";

/** What a visitor gives the studio. */
export type StudioInput = "prompt" | "image";

/** What the studio produces. */
export type StudioOutput = "image" | "lenticular" | "model3d";

export type LearnSection = {
  heading: string;
  /** Plain text paragraphs. (MDX can replace this later.) */
  body: string[];
};

export type Movement = {
  slug: Slug;
  name: string;
  /** e.g. "1950s–1970s" */
  period: string;
  /** One or two sentences shown on cards and wall labels. */
  summary: string;
  /**
   * Artists associated with the movement, named for education only.
   * We teach styles and techniques; we never reproduce copyrighted works.
   */
  keyArtists: string[];
  techniques: string[];
  /** 3–5 hex colors used for placeholders and accents. */
  palette: string[];
  /** Pattern used to draw a placeholder when an artwork has no image yet. */
  placeholderPattern: "ben-day" | "stripes" | "grid";
  viewer: ViewerKind;
  learn: LearnSection[];
  studio: {
    status: "available" | "planned";
    inputs: StudioInput[];
    output: StudioOutput;
    /**
     * Turns a visitor's prompt into a model prompt for this movement.
     * Keep it about style and technique, never "in the style of <living artist>".
     */
    buildPrompt: (userPrompt: string) => string;
  };
};

export type ArtworkSource =
  | { kind: "placeholder" }
  | { kind: "image"; src: string; width: number; height: number }
  | { kind: "model3d"; src: string };

export type Artwork = {
  id: string;
  title: string;
  /** Display name of the creator (human, AI-assisted, or community member). */
  artist: string;
  year: number;
  medium: string;
  source: ArtworkSource;
  /** Provenance for AI-generated work, shown on the wall label. */
  generation?: {
    provider: string;
    model?: string;
    prompt?: string;
  };
};

export type Exhibition = {
  slug: Slug;
  title: string;
  movement: Slug;
  /** Curatorial wall text. */
  description: string;
  curator: string;
  /** Who can add work: the core team, or community submissions. */
  kind: "curated" | "community";
  artworks: Artwork[];
};

export type Floor = {
  /** 1-based, like a real building. */
  level: number;
  slug: Slug;
  name: string;
  tagline: string;
  /** Exhibition slugs on this floor, in walking order. */
  exhibitions: Slug[];
};
