import { getGuide, getGuideIds } from "@/lib/museum/registry";

/**
 * A work's audio guide: its script and recorded voice in each language.
 * Built once per work at build time; the walk fetches it when a work is opened.
 */
export function generateStaticParams() {
  return getGuideIds().map((id) => ({ id }));
}

export async function GET(_request: Request, ctx: RouteContext<"/api/guides/[id]">) {
  const { id } = await ctx.params;
  const guide = getGuide(id);
  if (!guide) return Response.json({ error: "No guide for this work" }, { status: 404 });
  return Response.json(guide);
}
