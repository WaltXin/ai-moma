import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineHang, linesOf } from "@/components/gallery/line-hang";
import {
  Arrow,
  BUTTON,
  Elevator,
  EmptyFrames,
  KeepHyphens,
  TEXT_LINK,
} from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { floorWall, wallVars } from "@/components/gallery/walls";
import { getExhibitionsOnFloor, getFloor, getFloors, getMovement } from "@/lib/museum/registry";
import type { Exhibition, Floor } from "@/lib/museum/types";

export function generateStaticParams() {
  return getFloors().map((f) => ({ floor: f.slug }));
}

export async function generateMetadata(props: PageProps<"/floors/[floor]">): Promise<Metadata> {
  const floor = getFloor((await props.params).floor);
  return {
    title: floor ? `Floor ${floor.level}: ${floor.name}` : "Floor not found",
    description: floor?.tagline,
  };
}

export default async function FloorPage(props: PageProps<"/floors/[floor]">) {
  const floor = getFloor((await props.params).floor);
  if (!floor) notFound();

  const floors = getFloors();
  const rooms = getExhibitionsOnFloor(floor);
  const wall = floorWall(floor.slug);
  // The elevator goes up, and from the top floor back down to the first.
  const index = floors.findIndex((f) => f.slug === floor.slug);
  const next = floors[index + 1] ?? (index > 0 ? floors[0] : undefined);

  return (
    <WallRepaint id={`floor-${floor.slug}`} initial={wall}>
      {/* Pull the floor out to the full width of the window. */}
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(wall)} aria-labelledby="floor-title">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 md:pt-16 md:pb-20">
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-12">
              <p aria-hidden className="floor-numeral text-[clamp(7rem,17vw,13rem)] md:col-span-3">
                {floor.level}
              </p>
              <div className="md:col-span-6 md:self-end">
                <h1 id="floor-title" className="wall-title text-[clamp(2.75rem,5.6vw,5.25rem)]">
                  <span className="sr-only">Floor {floor.level}: </span>
                  <KeepHyphens text={floor.name} />
                </h1>
                <p className="mt-5 max-w-[44ch] text-lg text-muted md:text-xl">{floor.tagline}</p>
                {rooms.some((r) => r.artworks.length > 0) && (
                  <Link href={`/floors/${floor.slug}/walk`} className={`${BUTTON} mt-8`}>
                    Walk floor {floor.level}
                    <Arrow />
                  </Link>
                )}
              </div>
              <div className="md:col-span-3 md:justify-self-end">
                <Elevator floors={floors} current={floor.slug} />
              </div>
            </div>

            {rooms.length > 1 && (
              <nav aria-label="Rooms on this floor" className="mt-14 md:mt-20">
                <ol className="border-t border-line md:flex">
                  {rooms.map((room) => {
                    const movement = getMovement(room.movement);
                    return (
                      <li
                        key={room.slug}
                        className="border-b border-line md:flex-1 md:border-b-0 md:border-l md:first:border-l-0 md:first:[&>a]:pl-0"
                      >
                        <a href={`#${room.slug}`} className="group block py-4 md:px-5 md:py-5">
                          <span className="block font-semibold group-hover:underline group-hover:underline-offset-4">
                            {room.title}
                          </span>
                          <span className="block text-sm text-muted">
                            {movement?.name} · {worksLabel(room.artworks.length)}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
          </div>

          {rooms.map((room) => (
            <Room key={room.slug} room={room} />
          ))}
        </section>

        {next && <ElevatorDoors from={floor} to={next} />}
      </div>
    </WallRepaint>
  );
}

function worksLabel(n: number): string {
  return n === 0 ? "No work yet" : n === 1 ? "1 work" : `${n} works`;
}

function Room({ room }: { room: Exhibition }) {
  const movement = getMovement(room.movement)!;
  const href = `/exhibitions/${room.slug}`;
  const items = room.artworks.map((artwork) => ({ artwork, href }));

  return (
    <article id={room.slug} aria-labelledby={`${room.slug}-title`} className="scroll-mt-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-x-10 gap-y-6 border-t border-line pt-14 md:grid-cols-12 md:pt-20">
          <div className="md:col-span-5">
            <h2 id={`${room.slug}-title`} className="wall-title text-[clamp(2rem,3.6vw,3.25rem)]">
              <Link href={href} className="underline-offset-[0.12em] hover:underline">
                {room.title}
              </Link>
            </h2>
            <p className="mt-3 text-muted">
              <Link href={`/learn/${movement.slug}`} className="underline-offset-4 hover:underline">
                {movement.name}
              </Link>{" "}
              · {movement.period}
            </p>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="max-w-[60ch] text-lg leading-relaxed text-pretty">{room.description}</p>
            <p className="mt-3 text-sm text-muted">
              Curated by {room.curator} · {worksLabel(room.artworks.length)}
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              <Link href={href} className={TEXT_LINK}>
                Enter the room
              </Link>
              <Link href={`/learn/${movement.slug}`} className={TEXT_LINK}>
                How {movement.name} worked
              </Link>
              {movement.studio.status === "available" && (
                <Link href={`/studio?movement=${movement.slug}`} className={TEXT_LINK}>
                  Make one in the Studio
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-14 pt-14 pb-20 md:space-y-20 md:pt-20 md:pb-28">
          {linesOf(items).map((line) => (
            <LineHang key={line[0].artwork.id} items={line} />
          ))}
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-14 pb-20 sm:px-6 md:grid-cols-12 md:pt-20 md:pb-28">
          <div className="md:col-span-7">
            <EmptyFrames />
          </div>
          <div className="md:col-span-4 md:col-start-9 md:self-center">
            <p className="text-lg leading-relaxed">
              These walls are waiting. Make a piece from a prompt or a photo, then ask to have it
              hung in {room.title}.
            </p>
            <Link href="/studio" className={`${BUTTON} mt-6 hover:bg-white hover:text-ink`}>
              Open the Studio
              <Arrow />
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

/** The end of the floor: the elevator opens onto the next one, painted in its color. */
function ElevatorDoors({ from, to }: { from: Floor; to: Floor }) {
  const up = to.level > from.level;
  const preview = getExhibitionsOnFloor(to)
    .flatMap((room) =>
      room.artworks.slice(0, 1).map((artwork) => ({ artwork, href: `/exhibitions/${room.slug}` })),
    )
    .slice(0, 3);

  return (
    <section
      data-wall=""
      style={wallVars(floorWall(to.slug))}
      aria-labelledby="next-floor"
      className="py-20 md:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-4 sm:px-6 md:grid-cols-12">
        <p aria-hidden className="floor-numeral text-[clamp(6rem,14vw,11rem)] md:col-span-3">
          {to.level}
        </p>
        <div className="md:col-span-9 md:self-end">
          <h2 id="next-floor" className="wall-title text-[clamp(2.25rem,4.6vw,4.25rem)]">
            <span className="sr-only">
              {up ? "Next floor up" : "Back down to"}: Floor {to.level},{" "}
            </span>
            <KeepHyphens text={to.name} />
          </h2>
          <p className="mt-4 max-w-[44ch] text-lg text-muted">{to.tagline}</p>
          <Link href={`/floors/${to.slug}`} className={`${BUTTON} mt-8`}>
            {up ? "Up" : "Down"} to floor {to.level}
            <Arrow direction={up ? "up" : "down"} />
          </Link>
        </div>
      </div>
      {preview.length > 0 && (
        <div className="mt-14 md:mt-20">
          <LineHang items={preview} slots={5} />
        </div>
      )}
    </section>
  );
}
