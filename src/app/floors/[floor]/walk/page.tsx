import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Elevator, FloorBadge, KeepHyphens, TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { floorWall, wallVars } from "@/components/gallery/walls";
import { WalkableFloor } from "@/components/walk/walkable-floor";
import { getExhibitionsOnFloor, getFloor, getFloors, getMovements } from "@/lib/museum/registry";
import { buildFloorPlan } from "@/lib/walk/floor-plan";

export function generateStaticParams() {
  return getFloors().map((f) => ({ floor: f.slug }));
}

export async function generateMetadata(
  props: PageProps<"/floors/[floor]/walk">,
): Promise<Metadata> {
  const floor = getFloor((await props.params).floor);
  return {
    title: floor ? `Walk Floor ${floor.level}: ${floor.name}` : "Floor not found",
    description: floor?.tagline,
  };
}

export default async function WalkFloorPage(props: PageProps<"/floors/[floor]/walk">) {
  const floor = getFloor((await props.params).floor);
  if (!floor) notFound();

  const floors = getFloors();
  const wall = floorWall(floor.slug);
  const plan = buildFloorPlan({
    floor,
    exhibitions: getExhibitionsOnFloor(floor),
    movements: getMovements(),
    floors,
  });

  return (
    <WallRepaint id={`walk-${floor.slug}`} initial={wall}>
      {/* Pull the floor out to the full width of the window. */}
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section
          data-wall=""
          style={wallVars(wall)}
          aria-labelledby="walk-title"
          className="pb-12 md:pb-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pt-8 pb-8 md:pt-10">
              <div className="flex items-center gap-4">
                <FloorBadge level={floor.level} />
                <div>
                  <h1 id="walk-title" className="wall-title text-[clamp(1.75rem,3.4vw,2.75rem)]">
                    <span className="sr-only">Walk floor {floor.level}: </span>
                    <KeepHyphens text={floor.name} />
                  </h1>
                  <p className="mt-1 text-muted">{floor.tagline}</p>
                </div>
              </div>
              <Elevator floors={floors} current={floor.slug} walk row />
            </header>

            {/* Remount per floor so the visitor starts at the elevator. */}
            <WalkableFloor key={plan.floor.slug} plan={plan} wall={wall} />

            <p className="mt-6 text-muted">
              Prefer reading?{" "}
              <Link href={`/floors/${floor.slug}`} className={`${TEXT_LINK} text-ink`}>
                See this floor as a guide
              </Link>
            </p>
          </div>
        </section>
      </div>
    </WallRepaint>
  );
}
