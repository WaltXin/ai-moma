"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { Agamograph } from "@/components/agamograph";
import { ArtworkPlaceholder } from "@/components/artwork-frame";
import { Arrow, BUTTON, TEXT_LINK } from "@/components/gallery/wall-parts";
import type { Building, PlanArtwork, PlanRoom, Portal } from "@/lib/walk/building";

/** A floor as the lift and the directory list it. */
export type FloorChoice = { slug: string; level: number; name: string; tagline?: string };

/**
 * Modal shell: a panel of the floor's own wall over a dark backdrop. Focus
 * moves in on open; click outside or press Escape (handled by the floor) to close.
 */
function Dialog({
  labelledBy,
  onClose,
  wide,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative max-h-full w-full overflow-auto bg-wall p-6 text-ink shadow-[0_2rem_4rem_-1rem_rgb(0_0_0/0.7)] outline-none sm:p-8 ${
          wide ? "max-w-6xl" : "max-w-lg"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full transition-colors hover:bg-ink hover:text-wall"
        >
          <svg
            aria-hidden
            viewBox="0 0 14 14"
            className="size-3.5"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

export function ArtworkViewer({
  art,
  room,
  siblings,
  onNavigate,
  onClose,
}: {
  art: PlanArtwork;
  room: PlanRoom;
  siblings: PlanArtwork[];
  onNavigate: (art: PlanArtwork) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const i = siblings.findIndex((a) => a.id === art.id);
  const prev = siblings[(i - 1 + siblings.length) % siblings.length];
  const next = siblings[(i + 1) % siblings.length];

  return (
    <Dialog labelledBy={titleId} onClose={onClose} wide>
      <div className="grid gap-8 lg:grid-cols-[1fr_19rem] lg:gap-10">
        <div className="flex min-h-[40vh] items-center justify-center p-[clamp(4px,0.62vw,10px)]">
          {art.frames ? (
            <div
              key={art.id}
              className="w-full"
              style={{
                maxWidth: `min(100%, calc(62vh * ${art.frames[0].width / art.frames[0].height}))`,
              }}
            >
              <Agamograph
                frames={art.frames}
                alt={art.title}
                imageClassName="frame frame-black"
                className="[&_.frame]:mb-[var(--fw)]"
              />
            </div>
          ) : art.image ? (
            // Local public-domain files and Studio SVGs; a plain <img> keeps natural sizing.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={art.id}
              src={art.image.src}
              width={art.image.width}
              height={art.image.height}
              alt={`${art.title} by ${art.artist}`}
              className={`frame frame-${art.frame} max-h-[68vh] w-auto max-w-full`}
            />
          ) : (
            <div className="frame frame-black aspect-square w-full max-w-md">
              <ArtworkPlaceholder
                id={art.id}
                palette={room.movement.palette}
                pattern={room.movement.pattern}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col pr-8 lg:pr-0 lg:pt-12">
          <div className="text-[0.9375rem] leading-snug">
            <p className="font-semibold">{art.artist}</p>
            <h2 id={titleId} className="mt-0.5">
              <span className="italic">{art.title}</span>, {art.date}
            </h2>
            <p className="mt-3 text-muted">{art.medium}</p>

            {art.credit && (
              <p className="mt-3 text-sm text-muted">
                {art.credit.line && <span className="block">{art.credit.line}</span>}
                <a
                  href={art.credit.url}
                  className="mt-1 inline-block text-ink underline underline-offset-4 hover:decoration-2"
                >
                  {art.credit.institution}
                </a>{" "}
                · Public domain (CC0)
              </p>
            )}
            {art.generative && (
              <p className="mt-3 text-sm text-muted">
                Drawn in code by the Studio with {room.movement.name} techniques. Not a copy of any
                existing work.
                {art.frames &&
                  " Move your pointer across it, drag on a touch screen, or use the slider to change the view."}
              </p>
            )}
            {art.generation && (
              <p className="mt-3 text-sm text-muted">
                Made with {art.generation.provider}
                {art.generation.model ? ` (${art.generation.model})` : ""}
              </p>
            )}
            {!art.image && (
              <p className="mt-3 text-sm text-muted">
                This frame is waiting for a Studio piece made with {room.movement.name} techniques.{" "}
                <Link href={`/learn/${room.movement.slug}`} className="text-ink underline">
                  Learn the techniques
                </Link>
                {room.movement.studioOpen && (
                  <>
                    {" "}
                    or{" "}
                    <Link
                      href={`/studio?movement=${room.movement.slug}`}
                      className="text-ink underline"
                    >
                      make one
                    </Link>
                  </>
                )}
                .
              </p>
            )}
          </div>

          <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
            In{" "}
            <Link
              href={`/exhibitions/${room.slug}`}
              className="text-ink underline-offset-4 hover:underline"
            >
              {room.title}
            </Link>{" "}
            · {room.movement.name}
          </p>

          {siblings.length > 1 && (
            <div className="mt-auto flex items-center justify-between gap-3 pt-8">
              <button
                type="button"
                onClick={() => onNavigate(prev)}
                className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
              >
                <Arrow direction="left" />
                Previous
              </button>
              <span className="text-sm text-muted tabular-nums">
                {i + 1} of {siblings.length}
              </span>
              <button
                type="button"
                onClick={() => onNavigate(next)}
                className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
              >
                Next
                <Arrow />
              </button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function RoomInfo({ room, onClose }: { room: PlanRoom; onClose: () => void }) {
  const titleId = useId();
  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="wall-title pr-10 text-[clamp(2rem,5vw,2.75rem)]">
        {room.title}
      </h2>
      <p className="mt-2 text-muted">
        {room.movement.name} · {room.movement.period}
      </p>
      <p className="mt-6 text-lg leading-relaxed text-pretty">{room.description}</p>
      <p className="mt-5 border-t border-line pt-5 leading-relaxed">{room.movement.summary}</p>
      <p className="mt-3 text-sm text-muted">Curated by {room.curator}</p>
      <div className="mt-7 flex flex-col items-start gap-3">
        <Link href={`/learn/${room.movement.slug}`} className={TEXT_LINK}>
          How {room.movement.name} worked
        </Link>
        {room.movement.studioOpen && (
          <Link href={`/studio?movement=${room.movement.slug}`} className={TEXT_LINK}>
            Make one in the Studio
          </Link>
        )}
        <Link href={`/exhibitions/${room.slug}`} className={TEXT_LINK}>
          See this room as a page
        </Link>
      </div>
    </Dialog>
  );
}

export function ElevatorPanel({
  floors,
  current,
  onChoose,
  onClose,
}: {
  floors: FloorChoice[];
  current: string;
  onChoose: (slug: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="wall-title text-[clamp(2rem,5vw,2.75rem)]">
        Lift
      </h2>
      <ol className="mt-6 space-y-1">
        {[...floors].reverse().map((f) => {
          const here = f.slug === current;
          return (
            <li key={f.slug}>
              <button
                type="button"
                disabled={here}
                onClick={() => onChoose(f.slug)}
                aria-current={here ? "page" : undefined}
                className="group flex w-full items-center gap-4 py-1.5 text-left disabled:cursor-default"
              >
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-full border font-display text-lg font-bold tabular-nums transition-colors ${
                    here
                      ? "border-ink bg-ink text-wall"
                      : "border-line group-hover:border-ink group-hover:bg-ink group-hover:text-wall"
                  }`}
                >
                  {f.level}
                </span>
                <span className="font-semibold underline-offset-4 group-enabled:group-hover:underline">
                  {f.name}
                </span>
                {here && <span className="ml-auto text-sm text-muted">You are here</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <Link href="/" className={`${TEXT_LINK} mt-8 inline-block`}>
        Leave the museum
      </Link>
    </Dialog>
  );
}

/**
 * The floor directory, as the information desk hands it out: every floor and
 * its rooms, with the lift to take you there.
 */
export function Directory({
  building,
  current,
  onGo,
  onClose,
}: {
  building: Building;
  current: number;
  onGo: (level: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="wall-title pr-10 text-[clamp(2rem,5vw,2.75rem)]">
        Floor directory
      </h2>
      <p className="mt-2 text-muted">
        Take the lift, or the stairs across the atrium. The grand stair in the lobby goes up to Floor 2.
      </p>
      <ol className="mt-6 divide-y divide-line border-y border-line">
        {[...building.levels].reverse().map((l) => {
          const rooms = building.rooms.filter((r) => r.level === l.index);
          const here = l.index === current;
          return (
            <li key={l.slug} className="flex items-start gap-4 py-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-full border font-display font-bold tabular-nums ${
                  here ? "border-ink bg-ink text-wall" : "border-line"
                }`}
              >
                {l.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.index === 0 ? `Lobby · ${l.name}` : l.name}</p>
                <p className="text-sm text-muted">
                  {rooms.map((r) => r.movement.name).join(" · ") || l.tagline}
                  {building.portals.some((p) => p.level === l.index && p.kind !== "learn") &&
                    ` · ${building.portals
                      .filter((p) => p.level === l.index && p.kind !== "learn")
                      .map((p) => p.title)
                      .join(" · ")}`}
                </p>
              </div>
              {here ? (
                <span className="shrink-0 self-center text-sm text-muted">You are here</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onGo(l.index)}
                  className="shrink-0 self-center text-sm font-semibold underline underline-offset-4 hover:text-accent"
                >
                  Go
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </Dialog>
  );
}

/** A kiosk's screen: where it leads, and the way there. */
export function PortalPanel({ portal, onClose }: { portal: Portal; onClose: () => void }) {
  const titleId = useId();
  const label = portal.kind === "studio" ? "Open the Studio" : portal.kind === "lab" ? "Step into the lab" : "Read the guides";
  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="wall-title pr-10 text-[clamp(2rem,5vw,2.75rem)]">
        {portal.title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-pretty">{portal.blurb}</p>
      <Link href={portal.href} className={`${BUTTON} mt-8`}>
        {label}
        <Arrow />
      </Link>
    </Dialog>
  );
}
