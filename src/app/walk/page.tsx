import type { Metadata } from "next";
import Link from "next/link";
import { TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { WALK_WALL, wallVars } from "@/components/gallery/walls";
import { museumBuilding } from "@/components/walk/museum-building";
import { WalkableBuilding } from "@/components/walk/walkable-building";

export const metadata: Metadata = {
  title: "Walk the museum",
  description:
    "Walk into AI MoMA in 3D: through the lobby, up the grand stair and round a skylit atrium, floor after floor of modern art, and paintings to step into at the top.",
};

export default function WalkPage() {
  return (
    <WallRepaint id="walk" initial={WALK_WALL}>
      {/* Pull the walk out to the full width of the window. */}
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(WALK_WALL)} aria-labelledby="walk-title">
          <h1 id="walk-title" className="sr-only">
            Walk the museum
          </h1>
          <WalkableBuilding building={museumBuilding()} start={{ kind: "lobby" }} />
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <p className="text-muted">
              Prefer reading?{" "}
              <Link href="/" className={`${TEXT_LINK} text-ink`}>
                See every floor as a guide
              </Link>
            </p>
          </div>
        </section>
      </div>
    </WallRepaint>
  );
}
