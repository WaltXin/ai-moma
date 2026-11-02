import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkFrame } from "@/components/artwork-frame";
import { getExhibitionsOnFloor, getFloor, getFloors, getMovement } from "@/lib/museum/registry";

export function generateStaticParams() {
  return getFloors().map((f) => ({ floor: f.slug }));
}

export async function generateMetadata(props: PageProps<"/floors/[floor]">): Promise<Metadata> {
  const floor = getFloor((await props.params).floor);
  return { title: floor ? `Floor ${floor.level}: ${floor.name}` : "Floor not found" };
}

export default async function FloorPage(props: PageProps<"/floors/[floor]">) {
  const floor = getFloor((await props.params).floor);
  if (!floor) notFound();

  const floors = getFloors();
  const index = floors.findIndex((f) => f.slug === floor.slug);
  const below = floors[index - 1];
  const above = floors[index + 1];

  return (
    <div className="space-y-14">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Floor {floor.level}
        </p>
        <h1 className="mt-2 text-5xl font-black tracking-tight">{floor.name}</h1>
        <p className="mt-3 text-lg text-muted">{floor.tagline}</p>
      </header>

      {getExhibitionsOnFloor(floor).map((exhibition) => {
        const movement = getMovement(exhibition.movement)!;
        return (
          <section key={exhibition.slug} className="border-t border-line pt-8">
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-3xl font-bold">
                  <Link href={`/exhibitions/${exhibition.slug}`} className="hover:text-accent">
                    {exhibition.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted">
                  {movement.name} · {exhibition.artworks.length} works
                </p>
              </div>
              <Link
                href={`/exhibitions/${exhibition.slug}`}
                className="text-sm font-medium hover:text-accent"
              >
                Enter gallery →
              </Link>
            </div>
            {exhibition.artworks.length > 0 ? (
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                {exhibition.artworks.slice(0, 3).map((artwork) => (
                  <ArtworkFrame key={artwork.id} artwork={artwork} movement={movement} />
                ))}
              </div>
            ) : (
              <EmptyWall />
            )}
          </section>
        );
      })}

      <nav className="flex justify-between border-t border-line pt-6 text-sm font-medium">
        {below ? (
          <Link href={`/floors/${below.slug}`}>
            ↓ Floor {below.level}: {below.name}
          </Link>
        ) : (
          <span />
        )}
        {above ? (
          <Link href={`/floors/${above.slug}`}>
            ↑ Floor {above.level}: {above.name}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function EmptyWall() {
  return (
    <div className="border border-dashed border-line p-10 text-center text-muted">
      This wall is empty.{" "}
      <Link href="/studio" className="font-medium text-ink underline">
        Make something in the Studio
      </Link>{" "}
      and request an exhibition.
    </div>
  );
}
