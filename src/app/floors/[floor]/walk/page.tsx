import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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

  const plan = buildFloorPlan({
    floor,
    exhibitions: getExhibitionsOnFloor(floor),
    movements: getMovements(),
    floors: getFloors(),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Floor {floor.level}
          </p>
          <h1 className="text-3xl font-black tracking-tight">{floor.name}</h1>
        </div>
        <p className="text-sm text-muted">{floor.tagline}</p>
      </header>
      {/* Remount per floor so the visitor starts at the elevator. */}
      <WalkableFloor key={plan.floor.slug} plan={plan} />
      <p className="text-sm text-muted">
        Prefer reading?{" "}
        <Link href={`/floors/${floor.slug}`} className="font-medium text-ink underline">
          See this floor as a list
        </Link>
        .
      </p>
    </div>
  );
}
