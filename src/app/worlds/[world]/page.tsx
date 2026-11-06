import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WallFallback } from "@/components/gallery/wall-fallback";
import { TEXT_LINK } from "@/components/gallery/wall-parts";
import { WorldView } from "@/components/worlds/world-view";
import { getExhibition, getWorld, getWorlds } from "@/lib/museum/registry";
import { worldRequestUrl } from "@/lib/worlds/request";

export function generateStaticParams() {
  return getWorlds().map((w) => ({ world: w.slug }));
}

export async function generateMetadata(props: PageProps<"/worlds/[world]">): Promise<Metadata> {
  const world = getWorld((await props.params).world);
  return {
    title: world ? `Step into ${world.title}` : "World not found",
    description: world?.intro,
  };
}

export default function WorldPage(props: PageProps<"/worlds/[world]">) {
  // The page reads its address, so it streams in behind the wall it replaces.
  return (
    <Suspense fallback={<WallFallback />}>
      <World params={props.params} />
    </Suspense>
  );
}

async function World({ params }: { params: PageProps<"/worlds/[world]">["params"] }) {
  const world = getWorld((await params).world);
  if (!world) notFound();
  const room = getExhibition(world.room);

  return (
    // Pull the world out to the full width of the window.
    <div className="-my-10 mx-[calc(50%-50vw)] bg-[#0e1a3d]">
      <section aria-labelledby="world-title">
        <h1 id="world-title" className="sr-only">
          Step into {world.title}, after {world.artist}
        </h1>
        <WorldView world={world} />
        <div className="mx-auto max-w-6xl px-4 py-6 text-[#c9d4ea] sm:px-6">
          <p>
            An interpretation in 3D of {world.artist}&apos;s {world.title} ({world.year}), drawn
            with code.{" "}
            {room && (
              <>
                Its painter hangs in{" "}
                <Link href={`/exhibitions/${room.slug}`} className={`${TEXT_LINK} text-white`}>
                  {room.title}
                </Link>
                .
              </>
            )}
          </p>
          <p className="mt-3">
            Another painting you&apos;d like to step into?{" "}
            <a
              href={worldRequestUrl()}
              target="_blank"
              rel="noreferrer"
              className={`${TEXT_LINK} text-white`}
            >
              Request a world<span className="sr-only"> (opens GitHub in a new tab)</span>
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
