import Link from "next/link";
import { ElevatorDoors, nextFloor } from "@/components/gallery/elevator-doors";
import { LineHang } from "@/components/gallery/line-hang";
import { Elevator, KeepHyphens, TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { floorWall, wallVars } from "@/components/gallery/walls";
import { getExhibitionsOnFloor, getFloors, getMovement } from "@/lib/museum/registry";
import type { Floor } from "@/lib/museum/types";
import { AgamographRelief, type ReliefPiece } from "./agamograph-relief";
import { ApparentMotion } from "./apparent-motion";
import { Station } from "@/components/stations/station";
import { MoireStation } from "./moire-station";
import { SwellingGrid } from "./swelling-grid";

/** Floors whose walk is a hands-on lab instead of the walkable map. */
export const FLOOR_LABS = new Set(["perception"]);

/**
 * Floor 7 as a lab: four stations, each one an effect the visitor makes
 * happen by moving, then takes apart to see what their eyes are doing.
 */
export function PerceptionLab({ floor }: { floor: Floor }) {
  const floors = getFloors();
  const wall = floorWall(floor.slug);
  const rooms = getExhibitionsOnFloor(floor);
  const room = rooms[0];
  const movement = room ? getMovement(room.movement) : undefined;
  const works = rooms.flatMap((r) => r.artworks);

  // Two-view Agamographs from the floor's own collection become folded reliefs.
  const pieces: ReliefPiece[] = works.flatMap((a) =>
    a.source.kind === "lenticular" && a.source.frames.length === 2
      ? [{ id: a.id, title: a.title, views: [a.source.frames[0], a.source.frames[1]] }]
      : [],
  );
  const next = nextFloor(floor);

  return (
    <WallRepaint id={`lab-${floor.slug}`} initial={wall}>
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(wall)} aria-labelledby="lab-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="grid gap-x-10 gap-y-8 pt-10 pb-16 md:grid-cols-12 md:pt-16 md:pb-24">
              <div className="md:col-span-8">
                <Elevator floors={floors} current={floor.slug} walk row />
                <h1 id="lab-title" className="wall-title mt-10 text-[clamp(2.75rem,6.4vw,5.75rem)]">
                  <span className="sr-only">Floor {floor.level}: </span>
                  <KeepHyphens text={floor.name} />
                </h1>
                <p className="mt-6 max-w-[48ch] text-xl leading-relaxed text-pretty">
                  On this floor the art moves because you do. Each station below makes one effect
                  happen, then takes it apart so you can see what your eyes are doing.
                </p>
              </div>
              <nav aria-label="Stations" className="md:col-span-4 md:col-start-9 md:self-end">
                <ol className="divide-y divide-line border-y border-line">
                  {STATIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="flex items-baseline justify-between gap-4 py-3 font-semibold underline-offset-4 hover:underline"
                      >
                        {s.title}
                        <span className="text-sm font-normal text-muted">{s.effect}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </header>

            <Station
              id="where-you-stand"
              title="Where you stand"
              see="One picture from the left, a different one from the right, and stripes of both when you stand in front."
              really="A folded surface. Every fold has two faces: the left-facing ones carry thin strips of one picture, the right-facing ones carry strips of the other. From any angle you mostly see one set of faces."
              tryIt="Move across it, drag, or tilt your phone. Then press Show the folds to see the ridges from above and which faces reach your eye."
              note="Yaacov Agam painted on folded surfaces like this from the 1950s. His Agamograph prints do the same with a ridged plastic lens."
            >
              {pieces.length > 0 ? (
                <AgamographRelief pieces={pieces} />
              ) : (
                <p className="text-muted">The Agamographs for this station are being hung.</p>
              )}
            </Station>

            <Station
              id="two-layers"
              title="Two layers, one wave"
              see="Broad dark and light waves rippling through fine lines."
              really="Two identical patterns of evenly spaced lines, one on top of the other. Where the lines line up, the gaps between them show through; where they fall between each other, they fill the gaps. That difference is the wave. Neither layer has one."
              tryIt="Move over it to slide the top layer, change the spacing, then lift the top layer off."
              note="This interference is called moiré. Jesús Rafael Soto layered lines on clear Plexiglas over striped backgrounds, so his works shimmer as you walk past."
            >
              <MoireStation />
            </Station>

            <Station
              id="flat-grid"
              title="A flat grid that swells"
              see="A checkerboard that bulges out toward you, following your pointer."
              really="Flat black and white squares. Near the bulge the squares are drawn bigger; around it, squeezed. Your eye reads that change in size as a curved surface coming closer."
              tryIt="Move the bulge around, turn Swell down to zero, then show the grid it started as."
              note="Victor Vasarely and Bridget Riley built whole paintings from grids distorted this way."
            >
              <SwellingGrid />
            </Station>

            <Station
              id="motion-from-stillness"
              title="Motion from stillness"
              see="At first, two lights taking turns. Make the gap shorter and one light seems to travel."
              really="Lights that only switch on and off. Nothing moves between them. When the gap is short enough, your visual system fills in the journey."
              tryIt="Drag Time between flashes from slow to fast and watch for the moment the blinks become a single moving light."
              note="This apparent motion is what makes film and flip-books move, and what much kinetic art plays with."
              last
            >
              <ApparentMotion />
            </Station>
          </div>

          {room && (
            <div className="pb-20 md:pb-28">
              <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 border-t border-line px-4 pt-16 sm:px-6 md:pt-24">
                <div>
                  <h2 className="wall-title text-[clamp(2rem,3.6vw,3.25rem)]">On the wall</h2>
                  <p className="mt-3 max-w-[48ch] text-muted">
                    The works on this floor, in {room.title}. Move across the Agamographs to change
                    them.
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <Link href={`/exhibitions/${room.slug}`} className={TEXT_LINK}>
                    Enter {room.title}
                  </Link>
                  {movement && (
                    <Link href={`/learn/${movement.slug}`} className={TEXT_LINK}>
                      How {movement.name} worked
                    </Link>
                  )}
                </div>
              </div>
              <div className="mt-12 md:mt-16">
                <LineHang
                  items={works.slice(0, 4).map((artwork) => ({
                    artwork,
                    href: `/exhibitions/${room.slug}`,
                  }))}
                />
              </div>
            </div>
          )}
        </section>

        {next && <ElevatorDoors from={floor} to={next} />}
      </div>
    </WallRepaint>
  );
}

const STATIONS = [
  { id: "where-you-stand", title: "Where you stand", effect: "Agamograph" },
  { id: "two-layers", title: "Two layers, one wave", effect: "Moiré" },
  { id: "flat-grid", title: "A flat grid that swells", effect: "Distorted grid" },
  { id: "motion-from-stillness", title: "Motion from stillness", effect: "Apparent motion" },
];
