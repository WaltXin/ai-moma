/**
 * Asking for a painting to step into. A request opens the "Request a
 * painting world" issue form on GitHub, filled in with the painting, so
 * requests are public, can be upvoted, and wait there for a contributor
 * to build them (see CONTRIBUTING.md → Build a painting world).
 */

const NEW_ISSUE = "https://github.com/WaltXin/ai-moma/issues/new";
/** Matches `.github/ISSUE_TEMPLATE/4-world_request.yml`. */
export const WORLD_REQUEST_TEMPLATE = "4-world_request.yml";
/** Every open request, for a visitor checking theirs hasn't been asked for already. */
export const WORLD_REQUESTS =
  "https://github.com/WaltXin/ai-moma/issues?q=is%3Aissue+label%3Aworld";

export type WorldWish = {
  title: string;
  artist: string;
  /** The painting's page at the museum that holds it. */
  url?: string;
};

/** A link to the request form, with the painting already filled in when there is one. */
export function worldRequestUrl(painting?: WorldWish): string {
  const query = new URLSearchParams({ template: WORLD_REQUEST_TEMPLATE });
  if (painting) {
    query.set("title", `World request: ${painting.title}, ${painting.artist}`);
    query.set("painting", painting.title);
    query.set("artist", painting.artist);
    if (painting.url) query.set("link", painting.url);
  } else query.set("title", "World request: ");
  return `${NEW_ISSUE}?${query}`;
}
