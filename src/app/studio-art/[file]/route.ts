import { getArtwork, getStudioArtworks } from "@/lib/museum/registry";
import { type RecipeName, frameCount, parseStudioArtFile, renderStudioArt } from "@/lib/studio-art";

/**
 * Serves Studio pieces drawn with code as SVG: `/studio-art/<id>.svg`, and
 * `/studio-art/<id>.f<n>.svg` for each view of an Agamograph. Every file is
 * prerendered at build time.
 */
export function generateStaticParams() {
  return getStudioArtworks().flatMap((a) => {
    const frames = frameCount(a.recipe!.name as RecipeName);
    return frames > 1
      ? Array.from({ length: frames }, (_, f) => ({ file: `${a.id}.f${f}.svg` }))
      : [{ file: `${a.id}.svg` }];
  });
}

export async function GET(_request: Request, ctx: RouteContext<"/studio-art/[file]">) {
  const parsed = parseStudioArtFile((await ctx.params).file);
  const artwork = parsed && getArtwork(parsed.id);
  const recipe = artwork?.recipe?.name as RecipeName | undefined;
  if (!parsed || !artwork?.recipe || !recipe) return new Response("Not found", { status: 404 });
  const frames = frameCount(recipe);
  const frame = parsed.frame ?? 0;
  if (frames > 1 !== (parsed.frame !== undefined) || frame >= frames) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderStudioArt(recipe, artwork.recipe.seed, frame), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
