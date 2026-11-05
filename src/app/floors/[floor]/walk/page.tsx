import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WallFallback } from "@/components/gallery/wall-fallback";
import { TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { WALK_WALL, wallVars } from "@/components/gallery/walls";
import { FLOOR_LABS, PerceptionLab } from "@/components/perception/perception-lab";
import { museumBuilding } from "@/components/walk/museum-building";
import { WalkableBuilding } from "@/components/walk/walkable-building";
import { getFloor, getFloors } from "@/lib/museum/registry";

export function generateStaticParams() {
  return getFloors().map((f) => ({ floor: f.slug }));
}

export async function generateMetadata(props: PageProps<"/floors/[floor]/walk">): Promise<Metadata> {
  const floor = getFloor((await props.params).floor);
  return {
    title: floor ? `Walk Floor ${floor.level}: ${floor.name}` : "Floor not found",
    description: floor?.tagline,
  };
}

export default function WalkFloorPage(props: PageProps<"/floors/[floor]/walk">) {
  // The page reads its address, so it streams in behind the wall it replaces.
  return (
    <Suspense fallback={<WallFallback />}>
      <WalkFloor params={props.params} />
    </Suspense>
  );
}

async function WalkFloor({ params }: { params: PageProps<"/floors/[floor]/walk">["params"] }) {
  const floor = getFloor((await params).floor);
  if (!floor) notFound();

  // Some floors are better shown as a hands-on lab.
  if (FLOOR_LABS.has(floor.slug)) return <PerceptionLab floor={floor} />;

  const building = museumBuilding();
  const level = building.levels.findIndex((l) => l.slug === floor.slug);

  return (
    <WallRepaint id={`walk-${floor.slug}`} initial={WALK_WALL}>
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(WALK_WALL)} aria-labelledby="walk-title">
          <h1 id="walk-title" className="sr-only">
            Walk floor {floor.level}: {floor.name}
          </h1>
          {/* Remount per floor, so the visit starts in the lift on the floor asked for. */}
          <WalkableBuilding key={floor.slug} building={building} start={{ kind: "lift", level }} />
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <p className="text-muted">
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
