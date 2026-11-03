import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WallFallback } from "@/components/gallery/wall-fallback";
import { FramedPicture, Tombstone, WallLabel, stillOf } from "@/components/gallery/hung-work";
import { LineHang } from "@/components/gallery/line-hang";
import { Arrow, BUTTON, FloorBadge, PaintChips, TEXT_LINK } from "@/components/gallery/wall-parts";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { floorWall, wallVars } from "@/components/gallery/walls";
import {
  getExhibitionsForMovement,
  getFloorForExhibition,
  getMovement,
  getMovements,
} from "@/lib/museum/registry";
import type { Artwork, Movement } from "@/lib/museum/types";

export function generateStaticParams() {
  return getMovements().map((m) => ({ movement: m.slug }));
}

export async function generateMetadata(props: PageProps<"/learn/[movement]">): Promise<Metadata> {
  const movement = getMovement((await props.params).movement);
  return {
    title: movement ? `Learn ${movement.name}` : "Not found",
    description: movement?.summary,
  };
}

/** Where a movement hangs, and the wall color it borrows from that floor. */
function homeOf(movement: Movement) {
  const room = getExhibitionsForMovement(movement.slug)[0];
  const floor = room ? getFloorForExhibition(room.slug) : undefined;
  return { room, floor, wall: floorWall(floor?.slug ?? "") };
}

export default function LearnMovementPage(props: PageProps<"/learn/[movement]">) {
  // The page reads its address, so it streams in behind the wall it replaces.
  return (
    <Suspense fallback={<WallFallback />}>
      <GuideWalls params={props.params} />
    </Suspense>
  );
}

async function GuideWalls({ params }: { params: PageProps<"/learn/[movement]">["params"] }) {
  const movement = getMovement((await params).movement);
  if (!movement) notFound();

  const { room, floor, wall } = homeOf(movement);
  const works: Artwork[] = getExhibitionsForMovement(movement.slug)
    .flatMap((r) => r.artworks)
    .filter((a) => stillOf(a));
  const [lead, ...rest] = works;
  // One work after each section but the last; the rest close the guide on the wall.
  const between = rest.slice(0, Math.max(movement.learn.length - 1, 0));
  const remaining = rest.slice(between.length);

  const all = getMovements();
  const next = all[all.findIndex((m) => m.slug === movement.slug) + 1];

  return (
    <WallRepaint id={`learn-${movement.slug}`} initial={wall}>
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(wall)} aria-labelledby="movement-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <nav
              aria-label="Where you are"
              className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-line py-5"
            >
              <Link
                href="/learn"
                className="inline-flex items-center gap-3 font-semibold hover:underline"
              >
                <Arrow direction="left" />
                All movements
              </Link>
              {room && floor && (
                <Link
                  href={`/exhibitions/${room.slug}`}
                  className="group inline-flex items-center gap-3"
                >
                  <FloorBadge level={floor.level} />
                  <span className="text-sm">
                    <span className="block text-muted">On the wall in</span>
                    <span className="block font-semibold underline-offset-4 group-hover:underline">
                      {room.title}
                    </span>
                  </span>
                </Link>
              )}
            </nav>

            <header className="grid gap-x-10 gap-y-12 pt-12 pb-16 md:grid-cols-12 md:pt-16 md:pb-24">
              <div className="md:col-span-7 md:self-end">
                <h1 id="movement-title" className="wall-title text-[clamp(2.25rem,5vw,4.5rem)]">
                  {movement.name}
                </h1>
                <p className="mt-3 text-lg text-muted">{movement.period}</p>
                <p className="mt-8 max-w-[44ch] text-xl leading-relaxed text-pretty md:text-2xl">
                  {movement.summary}
                </p>
                <div className="mt-8">
                  <PaintChips colors={movement.palette} />
                </div>
              </div>
              {lead && (
                <figure className="md:col-span-5 md:self-end">
                  <div className="flex p-[clamp(4px,0.62vw,10px)] md:justify-end">
                    <FramedPicture
                      artwork={lead}
                      sizes="(min-width: 768px) 38vw, 92vw"
                      eager
                      className="max-h-[62svh] w-auto"
                    />
                  </div>
                  <figcaption className="mt-5 md:text-right">
                    <Tombstone artwork={lead} />
                  </figcaption>
                </figure>
              )}
            </header>

            <div className="grid gap-x-10 gap-y-14 border-t border-line pt-14 pb-20 md:grid-cols-12 md:pt-20 md:pb-28">
              <article className="md:col-span-7">
                {movement.learn.map((section, i) => (
                  <section key={section.heading} className={i > 0 ? "mt-14" : undefined}>
                    <h2 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] leading-tight font-bold [font-stretch:112%] text-balance">
                      {section.heading}
                    </h2>
                    {section.body.map((paragraph, j) => (
                      <p key={j} className="mt-4 max-w-[65ch] text-lg leading-relaxed text-pretty">
                        {paragraph}
                      </p>
                    ))}
                    {/* A work from the room after each section, so the reading stays near the art. */}
                    {between[i] && (
                      <figure className="mt-12">
                        <div className="flex p-[clamp(4px,0.62vw,10px)]">
                          <FramedPicture
                            artwork={between[i]}
                            sizes="(min-width: 768px) 40vw, 92vw"
                            className="max-h-[56svh] w-auto"
                          />
                        </div>
                        <figcaption className="mt-5">
                          <WallLabel artwork={between[i]} />
                        </figcaption>
                      </figure>
                    )}
                  </section>
                ))}
              </article>

              <aside className="space-y-10 md:sticky md:top-8 md:col-span-4 md:col-start-9 md:self-start">
                <div>
                  <h2 className="font-semibold">Key artists</h2>
                  <ul className="mt-3 space-y-1.5 text-muted">
                    {movement.keyArtists.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="font-semibold">Techniques</h2>
                  <ul className="mt-3 divide-y divide-line border-y border-line">
                    {movement.techniques.map((t) => (
                      <li key={t} className="py-2.5">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                {movement.studio.status === "available" ? (
                  <div>
                    <p className="leading-relaxed">
                      Use these techniques on your own subject, then ask to hang the result.
                    </p>
                    <Link href={`/studio?movement=${movement.slug}`} className={`${BUTTON} mt-4`}>
                      Try it in the Studio
                      <Arrow />
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted">The Studio for {movement.name} is coming soon.</p>
                )}
              </aside>
            </div>
          </div>

          {room && (
            <div className="pb-20 md:pb-28">
              <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 sm:px-6 md:mb-16">
                <h2 className="wall-title text-[clamp(2rem,3.6vw,3.25rem)]">
                  {remaining.length > 0 ? "More on the wall" : `See it in ${room.title}`}
                </h2>
                <Link href={`/exhibitions/${room.slug}`} className={TEXT_LINK}>
                  Enter {room.title}
                </Link>
              </div>
              {remaining.length > 0 && (
                <div className="mt-12 md:mt-16">
                  <LineHang
                    items={remaining.slice(0, 4).map((artwork) => ({
                      artwork,
                      href: `/exhibitions/${room.slug}`,
                    }))}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {next && <NextGuide movement={next} />}
      </div>
    </WallRepaint>
  );
}

/** The next movement in history, painted in the wall of the floor where it hangs. */
function NextGuide({ movement }: { movement: Movement }) {
  const { wall } = homeOf(movement);
  return (
    <section
      data-wall=""
      style={wallVars(wall)}
      aria-labelledby="next-guide"
      className="py-20 md:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-6 px-4 sm:px-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <h2 id="next-guide" className="wall-title text-[clamp(2.25rem,4.6vw,4.25rem)]">
            <span className="sr-only">Next guide: </span>
            {movement.name}
          </h2>
          <p className="mt-3 text-muted">{movement.period}</p>
        </div>
        <div className="md:col-span-4 md:col-start-9 md:self-end">
          <p className="leading-relaxed">{movement.summary}</p>
          <Link href={`/learn/${movement.slug}`} className={`${BUTTON} mt-6`}>
            Next guide
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
