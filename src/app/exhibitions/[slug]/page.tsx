import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkPlaceholder } from "@/components/artwork-frame";
import { ElevatorDoors, nextFloor } from "@/components/gallery/elevator-doors";
import { FramedAgamograph, FramedPicture, WallLabel } from "@/components/gallery/hung-work";
import { LineHang } from "@/components/gallery/line-hang";
import {
  Arrow,
  BUTTON,
  EmptyFrames,
  KeepHyphens,
  TEXT_LINK,
  worksLabel,
} from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { floorWall, wallVars } from "@/components/gallery/walls";
import {
  getExhibition,
  getExhibitions,
  getExhibitionsOnFloor,
  getFloorForExhibition,
  getMovement,
} from "@/lib/museum/registry";
import type { Artwork, Exhibition, Floor, Movement } from "@/lib/museum/types";

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
  const wall = floorWall(floor?.slug ?? "");

  // Rooms on this floor, in walking order: the next one, or the elevator.
  const rooms = floor ? getExhibitionsOnFloor(floor) : [exhibition];
  const nextRoom = rooms[rooms.findIndex((r) => r.slug === exhibition.slug) + 1];
  const upstairs = floor && !nextRoom ? nextFloor(floor) : undefined;

  return (
    <WallRepaint id={`room-${exhibition.slug}`} initial={wall}>
      {/* Pull the room out to the full width of the window. */}
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(wall)} aria-labelledby="room-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {floor && <FloorPlan floor={floor} rooms={rooms} current={exhibition.slug} />}

            <header className="grid gap-x-10 gap-y-10 pt-12 pb-4 md:grid-cols-12 md:pt-16 md:pb-6">
              <div className="md:col-span-7">
                <h1 id="room-title" className="wall-title text-[clamp(2.75rem,6vw,5.5rem)]">
                  <KeepHyphens text={exhibition.title} />
                </h1>
                <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-pretty md:text-xl">
                  {exhibition.description}
                </p>
                <p className="mt-4 text-sm text-muted">
                  Curated by {exhibition.curator} · {worksLabel(exhibition.artworks.length)}
                </p>
              </div>
              {/* On phones the art comes first; this panel follows the works. */}
              <MovementPanel movement={movement} floor={floor} className="max-md:hidden" />
            </header>
          </div>

          {exhibition.artworks.length > 0 ? (
            <ol aria-label={`Works in ${exhibition.title}`} className="pb-16 md:pb-24">
              {exhibition.artworks.map((artwork, i) => (
                <Bay key={artwork.id} artwork={artwork} movement={movement} index={i} />
              ))}
            </ol>
          ) : (
            <EmptyRoom room={exhibition} movement={movement} />
          )}
          <div className="px-4 pb-16 sm:px-6 md:hidden">
            <MovementPanel movement={movement} floor={floor} />
          </div>
        </section>

        {nextRoom && <NextRoom room={nextRoom} />}
        {upstairs && floor && <ElevatorDoors from={floor} to={upstairs} />}
      </div>
    </WallRepaint>
  );
}

/** The sign at a room's door: which floor you're on and the rooms along it. */
function FloorPlan({
  floor,
  rooms,
  current,
}: {
  floor: Floor;
  rooms: Exhibition[];
  current: string;
}) {
  return (
    <nav
      aria-label={`Rooms on floor ${floor.level}`}
      className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-line py-5"
    >
      <Link href={`/floors/${floor.slug}`} className="group inline-flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-ink font-display text-lg font-bold text-wall">
          {floor.level}
        </span>
        <span className="font-semibold underline-offset-4 group-hover:underline">
          <span className="sr-only">Floor {floor.level}: </span>
          {floor.name}
        </span>
      </Link>
      {rooms.length > 1 && (
        <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {rooms.map((room) => (
            <li key={room.slug}>
              <Link
                href={`/exhibitions/${room.slug}`}
                aria-current={room.slug === current ? "page" : undefined}
                className={
                  room.slug === current
                    ? "font-semibold underline underline-offset-4"
                    : "text-muted underline-offset-4 hover:text-ink hover:underline"
                }
              >
                {room.title}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

/** Wall text about the movement, set to one side of the entrance. */
function MovementPanel({
  movement,
  floor,
  className = "",
}: {
  movement: Movement;
  floor?: Floor;
  className?: string;
}) {
  return (
    <aside
      aria-label={`About ${movement.name}`}
      className={`border-t border-line pt-6 md:col-span-4 md:col-start-9 md:self-end ${className}`}
    >
      <p className="font-display text-2xl font-bold [font-stretch:112%]">{movement.name}</p>
      <p className="text-muted">{movement.period}</p>
      <p className="mt-4 leading-relaxed">{movement.summary}</p>
      {movement.viewer === "agamograph" && (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The Agamographs here change with your viewing angle. Move your pointer across them, drag
          on a touch screen, or use the slider under each one.
          {floor && (
            <>
              {" "}
              <Link href={`/floors/${floor.slug}/walk`} className="text-ink underline">
                Walk past them
              </Link>{" "}
              for the full effect.
            </>
          )}
        </p>
      )}
      {movement.viewer === "room3d" && (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          These works will get a 3D room viewer, which is on the roadmap. For now they hang flat.
        </p>
      )}
      <div className="mt-6 flex flex-col items-start gap-3">
        <Link href={`/learn/${movement.slug}`} className={TEXT_LINK}>
          How {movement.name} worked
        </Link>
        {movement.studio.status === "available" && (
          <Link href={`/studio?movement=${movement.slug}`} className={TEXT_LINK}>
            Make one in the Studio
          </Link>
        )}
      </div>
    </aside>
  );
}

/** One work, hung large on its own stretch of wall, with its label beside it. */
function Bay({
  artwork,
  movement,
  index,
}: {
  artwork: Artwork;
  movement: Movement;
  index: number;
}) {
  // Labels alternate sides as you walk along the room.
  const flip = index % 2 === 1;
  const kind = artwork.source.kind;

  return (
    <li className="mx-auto grid max-w-6xl items-end gap-x-10 gap-y-8 px-4 py-12 sm:px-6 md:grid-cols-12 md:py-20">
      <div
        className={`flex md:col-span-8 ${flip ? "md:order-2 md:col-start-5 md:justify-start" : "md:justify-end"}`}
      >
        {kind === "lenticular" ? (
          <div className="w-full max-w-[min(100%,72svh)] p-[clamp(4px,0.62vw,10px)]">
            <FramedAgamograph artwork={artwork} controls />
          </div>
        ) : kind === "image" ? (
          <div className="p-[clamp(4px,0.62vw,10px)]">
            <FramedPicture
              artwork={artwork}
              sizes="(min-width: 768px) 60vw, 92vw"
              eager={index === 0}
              className="max-h-[78svh] w-auto"
            />
          </div>
        ) : (
          <div className="frame frame-black aspect-square w-full max-w-[min(100%,72svh)]">
            <ArtworkPlaceholder
              id={artwork.id}
              palette={movement.palette}
              pattern={movement.placeholderPattern}
            />
          </div>
        )}
      </div>
      <div className={`md:col-span-4 ${flip ? "md:order-1 md:col-start-1" : ""}`}>
        <WallLabel artwork={artwork} />
      </div>
    </li>
  );
}

function EmptyRoom({ room, movement }: { room: Exhibition; movement: Movement }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-20 sm:px-6 md:grid-cols-12 md:pt-16 md:pb-28">
      <div className="md:col-span-7">
        <EmptyFrames />
      </div>
      <div className="md:col-span-4 md:col-start-9 md:self-center">
        <p className="text-lg leading-relaxed">
          {room.kind === "community"
            ? `Nothing hangs in ${room.title} yet. Make a piece from a prompt or a photo, then ask to have it hung here.`
            : "This room is still being hung."}
        </p>
        {room.kind === "community" && (
          <Link
            href={`/studio?movement=${movement.slug}`}
            className={`${BUTTON} mt-6 hover:bg-white hover:text-ink`}
          >
            Be the first
            <Arrow />
          </Link>
        )}
      </div>
    </div>
  );
}

/** The doorway at the end of the room, opening onto the next room on the floor. */
function NextRoom({ room }: { room: Exhibition }) {
  const movement = getMovement(room.movement);
  const href = `/exhibitions/${room.slug}`;
  return (
    <section aria-labelledby="next-room" className="pb-20 md:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-x-10 gap-y-6 border-t border-line pt-16 md:grid-cols-12 md:pt-24">
          <div className="md:col-span-7">
            <h2 id="next-room" className="wall-title text-[clamp(2.25rem,4.6vw,4.25rem)]">
              <span className="sr-only">Next room: </span>
              <KeepHyphens text={room.title} />
            </h2>
            {movement && (
              <p className="mt-3 text-muted">
                {movement.name} · {movement.period}
              </p>
            )}
          </div>
          <div className="md:col-span-4 md:col-start-9 md:self-end">
            <p className="leading-relaxed">{room.description}</p>
            <Link href={href} className={`${BUTTON} mt-6`}>
              Next room
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
      {room.artworks.length > 0 && (
        <div className="mt-14 md:mt-20">
          <LineHang
            items={room.artworks.slice(0, 3).map((artwork) => ({ artwork, href }))}
            slots={5}
          />
        </div>
      )}
    </section>
  );
}
