import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LineHang } from "@/components/gallery/line-hang";
import { WallFallback } from "@/components/gallery/wall-fallback";
import { TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { floorWall, wallVars } from "@/components/gallery/walls";
import { STATION_PAGES } from "@/components/stations/pages";
import {
  getExhibitionsForMovement,
  getFloorForExhibition,
  getMovement,
  getStation,
  getStationMovements,
} from "@/lib/museum/registry";

export function generateStaticParams() {
  return getStationMovements().map((movement) => ({ movement }));
}

export async function generateMetadata(props: PageProps<"/studio/[movement]">): Promise<Metadata> {
  const slug = (await props.params).movement;
  const station = getStation(slug);
  const movement = getMovement(slug);
  return {
    title: station && movement ? `${station.title}: ${movement.name}` : "Not found",
    description: station?.blurb,
  };
}

export default function StationPage(props: PageProps<"/studio/[movement]">) {
  // The page reads its address, so it streams in behind the wall it replaces.
  return (
    <Suspense fallback={<WallFallback />}>
      <StationWalls params={props.params} />
    </Suspense>
  );
}

async function StationWalls({ params }: { params: PageProps<"/studio/[movement]">["params"] }) {
  const slug = (await params).movement;
  const station = getStation(slug);
  const movement = getMovement(slug);
  const page = STATION_PAGES[slug];
  if (!station || !movement || !page) notFound();
  const { intro, Body } = page;

  const room = getExhibitionsForMovement(slug)[0];
  const floor = room ? getFloorForExhibition(room.slug) : undefined;
  const wall = floorWall(floor?.slug ?? "");

  return (
    <WallRepaint id={`station-${slug}`} initial={wall}>
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(wall)} aria-labelledby="station-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="grid gap-x-10 gap-y-6 pt-10 pb-16 md:grid-cols-12 md:pt-16 md:pb-24">
              <div className="md:col-span-8">
                <p className="text-sm font-semibold tracking-wide text-muted uppercase">
                  {movement.name} · Hands-on
                </p>
                <h1
                  id="station-title"
                  className="wall-title mt-4 text-[clamp(2.75rem,6.4vw,5.75rem)]"
                >
                  {station.title}
                </h1>
                <p className="mt-6 max-w-[48ch] text-xl leading-relaxed text-pretty">{intro}</p>
              </div>
              <nav
                aria-label="Around this station"
                className="flex flex-col gap-3 md:col-span-4 md:col-start-9 md:self-end"
              >
                {floor && (
                  <Link href={`/floors/${floor.slug}/walk`} className={TEXT_LINK}>
                    Back to the walk
                  </Link>
                )}
                <Link href={`/learn/${movement.slug}`} className={TEXT_LINK}>
                  How {movement.name} worked
                </Link>
              </nav>
            </header>

            <Body movement={movement.slug} />
          </div>

          {room && (
            <div className="pb-20 md:pb-28">
              <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 border-t border-line px-4 pt-16 sm:px-6 md:pt-24">
                <div>
                  <h2 className="wall-title text-[clamp(2rem,3.6vw,3.25rem)]">On the wall</h2>
                  <p className="mt-3 max-w-[48ch] text-muted">
                    Now look at how they did it, in {room.title}.
                  </p>
                </div>
                <Link href={`/exhibitions/${room.slug}`} className={TEXT_LINK}>
                  Enter {room.title}
                </Link>
              </div>
              <div className="mt-12 md:mt-16">
                <LineHang
                  items={room.artworks
                    .slice(0, 4)
                    .map((artwork) => ({ artwork, href: `/exhibitions/${room.slug}` }))}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </WallRepaint>
  );
}
