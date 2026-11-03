import Link from "next/link";
import { getExhibitionsOnFloor, getFloors } from "@/lib/museum/registry";
import type { Floor } from "@/lib/museum/types";
import { LineHang } from "./line-hang";
import { Arrow, BUTTON, KeepHyphens } from "./wall-parts";
import { floorWall, wallVars } from "./walls";

/** The elevator goes up, and from the top floor back down to the first. */
export function nextFloor(floor: Floor): Floor | undefined {
  const floors = getFloors();
  const index = floors.findIndex((f) => f.slug === floor.slug);
  return floors[index + 1] ?? (index > 0 ? floors[0] : undefined);
}

/** The end of the floor: the elevator opens onto the next one, painted in its color. */
export function ElevatorDoors({ from, to }: { from: Floor; to: Floor }) {
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
