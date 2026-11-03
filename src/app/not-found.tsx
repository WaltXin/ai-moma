import Link from "next/link";
import { Arrow, BUTTON, Elevator, TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { LOBBY_WALL, wallVars } from "@/components/gallery/walls";
import { getFloors } from "@/lib/museum/registry";

/** A closed gallery: an empty frame where a work should hang, and a way back. */
export default function NotFound() {
  return (
    <WallRepaint id="not-found" initial={LOBBY_WALL}>
      {/* Pull the wall out to the full width of the window. */}
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(LOBBY_WALL)} aria-labelledby="not-found-title">
          <div className="mx-auto grid max-w-6xl items-center gap-x-10 gap-y-14 px-4 py-12 sm:px-6 md:grid-cols-12 md:py-24">
            <figure className="md:col-span-5">
              <div className="w-[min(55%,14rem)] p-[clamp(4px,0.62vw,10px)] md:w-[min(100%,22rem)]">
                <div
                  aria-hidden
                  className="frame frame-gilt aspect-[4/5] w-full bg-[repeating-linear-gradient(135deg,transparent_0_12px,rgb(0_0_0/0.12)_12px_13px)]"
                />
              </div>
              <figcaption className="mt-5 text-[0.9375rem] leading-snug md:mt-6">
                <span className="block">
                  <span className="italic">Untitled (Not Found)</span>, 404
                </span>
                <span className="mt-2 block text-muted">Temporarily off view.</span>
              </figcaption>
            </figure>

            <div className="max-md:order-first md:col-span-6 md:col-start-7">
              <h1 id="not-found-title" className="wall-title text-[clamp(2.75rem,6vw,5.25rem)]">
                This room is closed.
              </h1>
              <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-pretty">
                Nothing hangs at this address. The work may have moved to another floor, or the link
                may be wrong.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/" className={`${BUTTON} px-6 py-3.5 text-lg`}>
                  Back to the lobby
                  <Arrow />
                </Link>
                <Link href="/learn" className={TEXT_LINK}>
                  Learn the movements
                </Link>
              </div>
              <div className="mt-12 border-t border-line pt-6">
                <p className="mb-4 text-muted">Or take the elevator to a floor:</p>
                <Elevator floors={getFloors()} row />
              </div>
            </div>
          </div>
        </section>
      </div>
    </WallRepaint>
  );
}
