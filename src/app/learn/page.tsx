import type { Metadata } from "next";
import Link from "next/link";
import { FramedPicture, stillOf } from "@/components/gallery/hung-work";
import { FloorBadge, KeepHyphens, PaintChips, TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { type Wall, floorWall, wallVars } from "@/components/gallery/walls";
import { getExhibitionsForMovement, getFloors, getMovements } from "@/lib/museum/registry";
import type { Floor, Movement } from "@/lib/museum/types";

export const metadata: Metadata = {
  title: "Learn",
  description: "Short, plain-language guides to every movement in the museum.",
};

type Group = { floor?: Floor; wall: Wall; movements: Movement[] };

/** Movements grouped by the floor of their home room, going up the building. */
function byFloor(): Group[] {
  const homes = getMovements().map((m) => ({ m, room: getExhibitionsForMovement(m.slug)[0] }));
  const groups: Group[] = getFloors()
    .map((floor) => ({
      floor,
      wall: floorWall(floor.slug),
      movements: homes
        .filter((h) => floor.exhibitions.includes(h.room?.slug ?? ""))
        .map((h) => h.m),
    }))
    .filter((g) => g.movements.length > 0)
    // Historical order: the Community Gallery's movements already appear upstairs.
    .sort(
      (a, b) => (a.floor.slug === "community" ? 1 : 0) - (b.floor.slug === "community" ? 1 : 0),
    );
  const unhung = homes.filter((h) => !h.room).map((h) => h.m);
  if (unhung.length > 0) groups.push({ wall: floorWall(""), movements: unhung });
  return groups;
}

export default function LearnIndexPage() {
  const groups = byFloor();
  const first = groups[0]?.wall ?? floorWall("");

  return (
    <WallRepaint id="learn" initial={first}>
      <div className="-my-10 mx-[calc(50%-50vw)]">
        {groups.map((group, i) => (
          <section
            key={group.floor?.slug ?? "unhung"}
            data-wall=""
            style={wallVars(group.wall)}
            aria-labelledby={`group-${i}`}
            className={i === 0 ? "pb-16 md:pb-24" : "py-16 md:py-24"}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              {i === 0 && (
                <header className="grid gap-x-10 gap-y-6 pt-12 pb-16 md:grid-cols-12 md:pt-20 md:pb-24">
                  <h1 className="wall-title text-[clamp(2.75rem,6vw,5.5rem)] md:col-span-7">
                    Learn the movements
                  </h1>
                  <p className="max-w-[44ch] text-lg leading-relaxed text-pretty md:col-span-4 md:col-start-9 md:self-end">
                    Short, plain-language guides to what each movement was about and how its artists
                    worked, in the order you meet them going up the building.
                  </p>
                </header>
              )}

              <h2 id={`group-${i}`} className="flex items-center gap-4">
                {group.floor ? (
                  <Link
                    href={`/floors/${group.floor.slug}`}
                    className="group flex items-center gap-4"
                  >
                    <FloorBadge level={group.floor.level} />
                    <span className="font-display text-2xl font-bold [font-stretch:112%] underline-offset-4 group-hover:underline">
                      <span className="sr-only">Floor {group.floor.level}: </span>
                      <KeepHyphens text={group.floor.name} />
                    </span>
                  </Link>
                ) : (
                  <span className="font-display text-2xl font-bold [font-stretch:112%]">
                    Not on the walls yet
                  </span>
                )}
              </h2>

              <ol className="mt-8">
                {group.movements.map((m) => (
                  <MovementRow key={m.slug} movement={m} />
                ))}
              </ol>
            </div>
          </section>
        ))}
      </div>
    </WallRepaint>
  );
}

function MovementRow({ movement }: { movement: Movement }) {
  const href = `/learn/${movement.slug}`;
  const work = getExhibitionsForMovement(movement.slug)
    .flatMap((r) => r.artworks)
    .find((a) => stillOf(a));

  return (
    <li className="grid gap-x-10 gap-y-5 border-t border-line py-8 md:grid-cols-12 md:items-center md:py-10">
      <div className="md:col-span-4">
        <h3 className="wall-title text-[clamp(1.75rem,2.6vw,2.25rem)]">
          <Link href={href} className="underline-offset-[0.12em] hover:underline">
            {movement.name}
          </Link>
        </h3>
        <p className="mt-2 text-muted">{movement.period}</p>
      </div>
      <div className="md:col-span-5">
        <p className="max-w-[52ch] leading-relaxed text-pretty">{movement.summary}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <PaintChips colors={movement.palette} size="sm" />
          <Link href={href} className={TEXT_LINK}>
            Read the guide
          </Link>
        </div>
      </div>
      {work && (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="hidden p-[clamp(4px,0.62vw,10px)] md:col-span-3 md:flex md:justify-end"
        >
          <FramedPicture artwork={work} sizes="12rem" className="max-h-36 w-auto" />
        </Link>
      )}
    </li>
  );
}
