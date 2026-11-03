import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkFrame } from "@/components/artwork-frame";
import {
  getExhibition,
  getExhibitions,
  getFloorForExhibition,
  getMovement,
} from "@/lib/museum/registry";

export function generateStaticParams() {
  return getExhibitions().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata(props: PageProps<"/exhibitions/[slug]">): Promise<Metadata> {
  const exhibition = getExhibition((await props.params).slug);
  return {
    title: exhibition?.title ?? "Exhibition not found",
    description: exhibition?.description,
  };
}

export default async function ExhibitionPage(props: PageProps<"/exhibitions/[slug]">) {
  const exhibition = getExhibition((await props.params).slug);
  if (!exhibition) notFound();
  const movement = getMovement(exhibition.movement)!;
  const floor = getFloorForExhibition(exhibition.slug);

  return (
    <div className="space-y-12">
      <header className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          {floor && (
            <Link
              href={`/floors/${floor.slug}`}
              className="font-mono text-xs uppercase tracking-widest text-muted hover:text-ink"
            >
              ← Floor {floor.level}: {floor.name}
            </Link>
          )}
          <h1 className="mt-2 text-5xl font-black tracking-tight">{exhibition.title}</h1>
          <p className="mt-4 max-w-2xl text-lg">{exhibition.description}</p>
        </div>
        {/* Wall text */}
        <aside className="border-l-4 border-ink pl-4 text-sm">
          <p className="font-semibold">{movement.name}</p>
          <p className="text-muted">{movement.period}</p>
          <p className="mt-2">{movement.summary}</p>
          <p className="mt-2 text-muted">Curated by {exhibition.curator}</p>
          <div className="mt-3 flex gap-4 font-medium">
            <Link href={`/learn/${movement.slug}`} className="hover:text-accent">
              Learn →
            </Link>
            {movement.studio.status === "available" && (
              <Link href={`/studio?movement=${movement.slug}`} className="hover:text-accent">
                Make one →
              </Link>
            )}
          </div>
        </aside>
      </header>

      {movement.viewer === "agamograph" && (
        <p className="border border-dashed border-line p-4 text-sm text-muted">
          Some works here are <strong>Agamographs</strong>: move your pointer across them, or drag
          on a touch screen, and one image turns into another.{" "}
          {floor && (
            <>
              <Link href={`/floors/${floor.slug}/walk`} className="font-medium text-ink underline">
                Walk past them
              </Link>{" "}
              for the full effect.
            </>
          )}
        </p>
      )}
      {movement.viewer === "room3d" && (
        <p className="border border-dashed border-line p-4 text-sm text-muted">
          Works in this movement will use the <strong>3D room</strong> viewer, which is on the
          roadmap. For now they hang flat on the wall.
        </p>
      )}

      {exhibition.artworks.length > 0 ? (
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {exhibition.artworks.map((artwork) => (
            <ArtworkFrame key={artwork.id} artwork={artwork} movement={movement} />
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-line p-10 text-center text-muted">
          No works yet.{" "}
          {exhibition.kind === "community" && (
            <Link
              href={`/studio?movement=${movement.slug}`}
              className="font-medium text-ink underline"
            >
              Be the first to submit one.
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
