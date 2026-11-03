import Link from "next/link";
import { type CSSProperties, Fragment } from "react";
import { FramedAgamograph, FramedPicture, Tombstone, stillOf } from "@/components/lobby/hung-work";
import { WallRepaint } from "@/components/lobby/wall-repaint";
import {
  getArtwork,
  getExhibitions,
  getExhibitionsOnFloor,
  getFloors,
  getMovement,
  getMovements,
} from "@/lib/museum/registry";
import type { Artwork, Exhibition, Floor } from "@/lib/museum/types";

/** Wall colors, one per floor, like rooms in a real museum. */
type Wall = { wall: string; ink: string; muted: string; line: string };

const LOBBY_WALL: Wall = { wall: "#5a1820", ink: "#f6ead8", muted: "#dcbcab", line: "#7b3a40" };

const FLOOR_WALLS: Record<string, Wall> = {
  "light-and-color": { wall: "#1d2f4f", ink: "#f3efe6", muted: "#b9c5d8", line: "#3a4f73" },
  "avant-garde": { wall: "#113c35", ink: "#eff1e7", muted: "#a8cbbe", line: "#2d5a51" },
  "between-the-wars": { wall: "#e7e2d7", ink: "#1a1a18", muted: "#57524a", line: "#c8c0b0" },
  postwar: { wall: "#f7f7f5", ink: "#121212", muted: "#5c5c5c", line: "#dcdcd9" },
  pop: { wall: "#f6c500", ink: "#141414", muted: "#463a00", line: "#d7aa00" },
  perception: { wall: "#0d0d0f", ink: "#f2f2f2", muted: "#a4a4aa", line: "#2b2b30" },
  community: { wall: "#ff2e63", ink: "#17070b", muted: "#4a0c1c", line: "#ff6f93" },
};
const DEFAULT_WALL = FLOOR_WALLS.postwar;

function wallStyle(w: Wall): CSSProperties {
  return {
    "--floor-wall": w.wall,
    "--floor-ink": w.ink,
    "--floor-muted": w.muted,
    "--floor-line": w.line,
  } as CSSProperties;
}

/**
 * The salon wall in the lobby. Grid areas are `row / col / row-end / col-end`
 * on a 12×4 desktop grid (`d`) and a 6×6 phone grid (`m`, optional).
 */
const SALON: { id: string; d: string; m?: string }[] = [
  { id: "aic-64818", d: "1 / 1 / 3 / 3" }, // Monet, Stacks of Wheat
  { id: "aic-17229", d: "3 / 1 / 5 / 3", m: "1 / 5 / 3 / 7" }, // Munch, The Scream
  { id: "cma-144595", d: "3 / 3 / 5 / 4" }, // Mucha, Oriental Poppies
  { id: "aic-27992", d: "1 / 3 / 3 / 8", m: "1 / 1 / 3 / 5" }, // Seurat, La Grande Jatte
  { id: "aic-28560", d: "3 / 4 / 5 / 6", m: "3 / 3 / 5 / 7" }, // van Gogh, The Bedroom
  { id: "everyday-icons-1", d: "3 / 6 / 5 / 7" }, // Studio, Can, Four Ways
  { id: "cma-136592", d: "3 / 7 / 5 / 8" }, // Klee, Tightrope Walker
  { id: "aic-8991", d: "1 / 8 / 3 / 10", m: "3 / 1 / 5 / 3" }, // Kandinsky, Improvisation 30
  { id: "cma-143278", d: "1 / 10 / 2 / 11", m: "5 / 3 / 6 / 4" }, // Mondrian
  { id: "angles-of-view-6", d: "2 / 10 / 3 / 11", m: "6 / 3 / 7 / 4" }, // Studio, Swelling Grid
  { id: "aic-80607", d: "1 / 11 / 3 / 13", m: "5 / 1 / 7 / 3" }, // van Gogh, Self-Portrait
  { id: "aic-20684", d: "3 / 8 / 5 / 11" }, // Caillebotte, Paris Street; Rainy Day
  { id: "cma-136595", d: "3 / 11 / 5 / 13", m: "5 / 4 / 7 / 7" }, // Marc, Tiger
];

/** How much of the viewport a grid area spans, for responsive image sizes. */
function slotSizes(d: string, m?: string): string {
  const span = (area: string, cols: number) => {
    const [, c1, , c2] = area.split("/").map((n) => Number(n.trim()));
    return Math.ceil(((c2 - c1) / cols) * 100);
  };
  return `(min-width: 768px) ${span(d, 12)}vw, ${m ? span(m, 6) : 1}vw`;
}

/** Relative sizes along a floor's hang, so the line doesn't read as a row of thumbnails. */
const HANG_SCALE = [1, 0.8, 1.1, 0.88, 0.96];
const HANG_GAP = 4; // percent of the row, between works

/** Up to five works per floor, taken in turn from each room so every room is represented. */
function hangFor(exhibitions: Exhibition[]): { artwork: Artwork; room: Exhibition }[] {
  const picked: { artwork: Artwork; room: Exhibition }[] = [];
  for (let i = 0; picked.length < 5; i++) {
    const row = exhibitions.filter((e) => e.artworks[i]);
    if (row.length === 0) break;
    for (const room of row) {
      if (picked.length < 5 && stillOf(room.artworks[i])) {
        picked.push({ artwork: room.artworks[i], room });
      }
    }
  }
  return picked;
}

export default function LobbyPage() {
  const floors = getFloors();
  const exhibitions = getExhibitions();
  const roomOf = (id: string) => exhibitions.find((e) => e.artworks.some((a) => a.id === id));

  // Walk in on the first floor that has art on its walls.
  const firstHung = floors.find((f) => getExhibitionsOnFloor(f).some((e) => e.artworks.length > 0));
  // Historical order up the building, ending on the visitors' own floor.
  const community = floors.filter((f) =>
    getExhibitionsOnFloor(f).every((e) => e.kind === "community"),
  );
  const curated = floors.filter((f) => !community.includes(f));

  const works = exhibitions.flatMap((e) => e.artworks);
  const publicDomain = works.filter((a) => a.credit).length;
  const studioPieces = works.filter((a) => a.recipe).length;
  const salon = SALON.map((s) => ({ ...s, artwork: getArtwork(s.id) })).filter(
    (s): s is typeof s & { artwork: Artwork } => s.artwork !== undefined,
  );

  return (
    <WallRepaint>
      {/* Pull the lobby out to the full width of the window. */}
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallStyle(LOBBY_WALL)} aria-labelledby="lobby-title">
          <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 md:pt-10">
            <div className="salon">
              {salon.map(({ id, d, m, artwork }, i) => {
                const room = roomOf(id);
                return (
                  <Link
                    key={id}
                    href={room ? `/exhibitions/${room.slug}` : "/"}
                    className={`salon-slot group relative flex min-h-0 min-w-0 items-center justify-center p-[clamp(4px,0.62vw,10px)] ${m ? "" : "max-md:hidden"}`}
                    style={{ "--d": d, "--m": m } as CSSProperties}
                  >
                    <FramedPicture
                      artwork={artwork}
                      sizes={slotSizes(d, m)}
                      eager={i < 6}
                      className="transition-transform duration-500 ease-out group-hover:-translate-y-1"
                    />
                    <span className="pointer-events-none absolute top-full left-1/2 z-10 w-max max-w-[14rem] -translate-x-1/2 -translate-y-2 bg-ink px-2.5 py-1.5 text-wall opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Tombstone artwork={artwork} />
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="grid gap-8 pt-8 pb-12 md:grid-cols-12 md:gap-10 md:pt-12 md:pb-14">
              <h1
                id="lobby-title"
                className="wall-title text-[clamp(2.5rem,4.6vw,4.5rem)] md:col-span-8"
              >
                A museum of modern art,{" "}
                <span className="font-light md:block">made of modern art.</span>
              </h1>
              <div className="flex flex-col justify-end gap-6 md:col-span-4">
                <p className="leading-relaxed text-pretty md:text-lg">
                  Walk the floors, learn how each movement worked, make your own piece in the
                  Studio, then ask to have it exhibited. AI MoMA is open source, so anyone can add a
                  movement.
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 max-md:order-first">
                  {firstHung && (
                    <Link
                      href={`/floors/${firstHung.slug}/walk`}
                      className="inline-flex items-center gap-3 bg-ink px-6 py-3.5 text-lg font-semibold text-wall transition-colors hover:bg-accent hover:text-white"
                    >
                      Walk in
                      <Arrow />
                    </Link>
                  )}
                  <Link
                    href="/studio"
                    className="font-semibold underline decoration-1 underline-offset-[6px] hover:decoration-2"
                  >
                    Make a piece in the Studio
                  </Link>
                </div>
              </div>
            </div>

            <p className="border-t border-line py-5 text-sm text-muted">
              {floors.length} floors · {getMovements().length} movements · {publicDomain}{" "}
              public-domain works from the Art Institute of Chicago and the Cleveland Museum of Art
              · {studioPieces} Studio pieces drawn in code
            </p>
          </div>
        </section>

        {curated.map((floor) => (
          <FloorWall key={floor.slug} floor={floor} />
        ))}
        {community.map((floor) => (
          <CommunityWall key={floor.slug} floor={floor} />
        ))}
      </div>
    </WallRepaint>
  );
}

function FloorWall({ floor }: { floor: Floor }) {
  const rooms = getExhibitionsOnFloor(floor);
  const hang = hangFor(rooms);
  const weights = hang.map(({ artwork }, i) => {
    const still = stillOf(artwork)!;
    return Math.sqrt(still.width / still.height) * HANG_SCALE[i % HANG_SCALE.length];
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const share = 100 - HANG_GAP * (hang.length - 1);

  return (
    <section
      data-wall=""
      style={wallStyle(FLOOR_WALLS[floor.slug] ?? DEFAULT_WALL)}
      aria-labelledby={`floor-${floor.slug}`}
      className="py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-12">
          <p aria-hidden className="floor-numeral text-[clamp(6rem,14vw,11rem)] md:col-span-2">
            {floor.level}
          </p>
          <div className="md:col-span-6">
            <h2
              id={`floor-${floor.slug}`}
              className="wall-title text-[clamp(2.25rem,4.6vw,4.25rem)]"
            >
              <span className="sr-only">Floor {floor.level}: </span>
              <KeepHyphens text={floor.name} />
            </h2>
            <p className="mt-4 max-w-[42ch] text-lg text-muted">{floor.tagline}</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={`/floors/${floor.slug}/walk`}
                className="inline-flex items-center gap-3 bg-ink px-5 py-3 font-semibold text-wall transition-colors hover:bg-accent hover:text-white"
              >
                Walk floor {floor.level}
                <Arrow />
              </Link>
              <Link
                href={`/floors/${floor.slug}`}
                className="font-semibold underline decoration-1 underline-offset-[6px] hover:decoration-2"
              >
                Floor guide
              </Link>
            </div>
          </div>
          <ol className="divide-y divide-line border-y border-line md:col-span-4 md:self-end">
            {rooms.map((room) => {
              const movement = getMovement(room.movement);
              return (
                <li key={room.slug} className="flex items-baseline justify-between gap-4 py-3">
                  <Link
                    href={`/exhibitions/${room.slug}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {room.title}
                  </Link>
                  {movement && (
                    <Link
                      href={`/learn/${movement.slug}`}
                      className="shrink-0 text-right text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      {movement.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {hang.length > 0 && (
        <div className="hang-strip mt-14 snap-x snap-mandatory scroll-px-4 overflow-x-auto md:mx-auto md:mt-20 md:max-w-6xl md:overflow-visible md:px-6">
          <ul className="flex w-max items-center gap-10 px-4 pt-4 pb-6 sm:px-6 md:w-full md:gap-[4%] md:px-2.5">
            {hang.map(({ artwork, room }, i) => {
              const live = artwork.source.kind === "lenticular";
              return (
                <li
                  key={artwork.id}
                  className="w-[calc(var(--k)*52vw)] shrink-0 snap-start md:w-[var(--pct)]"
                  style={
                    {
                      "--k": weights[i].toFixed(3),
                      "--pct": `${((weights[i] / total) * share).toFixed(2)}%`,
                    } as CSSProperties
                  }
                >
                  {live ? (
                    <FramedAgamograph artwork={artwork} />
                  ) : (
                    <Link href={`/exhibitions/${room.slug}`} className="block">
                      <FramedPicture
                        artwork={artwork}
                        sizes="(min-width: 768px) 28vw, 60vw"
                        className="w-full"
                      />
                    </Link>
                  )}
                  <div className="mt-6">
                    <Tombstone artwork={artwork} medium={live} />
                    {live && (
                      <span className="mt-2 block text-[0.8125rem] font-semibold">
                        Move across it to change the view.
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function CommunityWall({ floor }: { floor: Floor }) {
  const rooms = getExhibitionsOnFloor(floor);
  const works = rooms.flatMap((r) => r.artworks).filter((a) => stillOf(a));
  // Empty frames wait for visitors' work. Sizes echo a small hang.
  const emptyFrames = ["aspect-[4/5] w-[30%]", "aspect-square w-[24%]", "aspect-[3/4] w-[20%]"];

  return (
    <section
      data-wall=""
      style={wallStyle(FLOOR_WALLS[floor.slug] ?? DEFAULT_WALL)}
      aria-labelledby={`floor-${floor.slug}`}
      className="py-20 md:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-5">
          <p aria-hidden className="floor-numeral text-[clamp(6rem,14vw,11rem)]">
            {floor.level}
          </p>
          <h2
            id={`floor-${floor.slug}`}
            className="wall-title mt-8 text-[clamp(2.5rem,4.4vw,4rem)]"
          >
            <span className="sr-only">Floor {floor.level}: </span>
            {floor.name}
          </h2>
          <p className="mt-5 max-w-[40ch] text-lg leading-relaxed">
            {floor.tagline} Make one from a prompt or a photo, then ask to have it hung here.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-3 bg-ink px-6 py-3.5 text-lg font-semibold text-wall transition-colors hover:bg-white hover:text-ink"
            >
              Open the Studio
              <Arrow />
            </Link>
            <Link
              href={`/floors/${floor.slug}`}
              className="font-semibold underline decoration-1 underline-offset-[6px] hover:decoration-2"
            >
              Floor guide
            </Link>
          </div>
        </div>

        <ul
          className="flex items-center justify-between gap-[4%] self-center md:col-span-7"
          aria-label={works.length ? `Work in the ${floor.name}` : "Empty frames waiting for work"}
        >
          {works.length > 0
            ? works.slice(0, 3).map((artwork) => (
                <li key={artwork.id} className="flex-1">
                  <FramedPicture artwork={artwork} sizes="(min-width: 768px) 20vw, 30vw" />
                  <div className="mt-5">
                    <Tombstone artwork={artwork} />
                  </div>
                </li>
              ))
            : emptyFrames.map((size, i) => (
                <li key={size} className={size.split(" ")[1]}>
                  <div
                    className={`frame frame-black ${size.split(" ")[0]} w-full bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgb(0_0_0/0.06)_10px_11px)]`}
                  />
                  <div className="mt-5 text-[0.8125rem] leading-snug">
                    <span className="block font-semibold">You</span>
                    <span className="block">
                      <span className="italic">{["Untitled", "Self-Portrait", "Study"][i]}</span>,
                      2026
                    </span>
                  </div>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}

/** Keeps hyphenated words like "Avant-Garde" on one line in big type. */
function KeepHyphens({ text }: { text: string }) {
  return text.split(" ").map((word, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className={word.includes("-") ? "whitespace-nowrap" : undefined}>{word}</span>
    </Fragment>
  ));
}

function Arrow() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 12"
      className="h-3 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M0 6h18M13 1l5 5-5 5" />
    </svg>
  );
}
