"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Agamograph } from "@/components/agamograph";
import { AudioGuide } from "@/components/audio-guide";
import { ArtworkPlaceholder } from "@/components/artwork-frame";
import { Arrow, BUTTON, TEXT_LINK } from "@/components/gallery/wall-parts";
import { type ScreenRect, ZoomImage, type ZoomImageHandle } from "@/components/zoom-image";
import type { Building, PlanArtwork, PlanRoom, Portal } from "@/lib/walk/building";
import { getAudio } from "./audio";

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

/**
 * Up close to a work, as you'd step up to it in a gallery: the picture fills
 * the screen (growing out of its place on the wall) and you can zoom right
 * into it; the label sits beside it, or under it on a phone.
 */
export function ArtworkViewer({
  art,
  room,
  siblings,
  from,
  rectOf,
  exitRef,
  onNavigate,
  onClose,
}: {
  art: PlanArtwork;
  room: PlanRoom;
  siblings: PlanArtwork[];
  /** Where the work hangs on screen, to grow it from there. */
  from?: ScreenRect | null;
  /** Where a work hangs on screen now, to shrink it back on the way out. */
  rectOf?: (id: string) => ScreenRect | null;
  /** Filled with the animated close, for the floor's Escape key. */
  exitRef?: React.RefObject<(() => void) | null>;
  onNavigate: (art: PlanArtwork) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomImageHandle>(null);
  const [leaving, setLeaving] = useState(false);
  const i = siblings.findIndex((a) => a.id === art.id);
  const prev = siblings[(i - 1 + siblings.length) % siblings.length];
  const next = siblings[(i + 1) % siblings.length];
  // Fly in only from the work you clicked, not when stepping along the wall.
  const [first] = useState(art.id);
  const flyFrom = art.id === first ? from : null;

  const leave = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    const z = zoomRef.current;
    if (!z) return onClose();
    z.leave(rectOf?.(art.id) ?? null, onClose);
  }, [leaving, onClose, rectOf, art.id]);

  useEffect(() => {
    if (!exitRef) return;
    exitRef.current = leave;
    return () => {
      exitRef.current = null;
    };
  }, [exitRef, leave]);

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  const alt = `${art.title} by ${art.artist}`;
  const underVoice = useCallback((on: boolean) => getAudio()?.underVoice(on), []);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain outline-none lg:flex-row lg:overflow-hidden"
    >
      <div
        aria-hidden
        className={`absolute inset-0 bg-[#121110] transition-opacity ease-out ${leaving ? "opacity-0 duration-400" : "animate-[fade-in_500ms_ease-out_both]"}`}
      />

      <div className="relative h-[62svh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1">
        {art.image && !art.frames ? (
          <ZoomImage key={art.id} ref={zoomRef} image={art.image} zoom={art.zoom} alt={alt} from={flyFrom} />
        ) : (
          <div key={art.id} className="absolute inset-0 flex animate-[fade-in_300ms_ease-out_both] items-center justify-center p-6 sm:p-10">
            {art.frames ? (
              <div
                className="w-full"
                style={{ maxWidth: `min(100%, calc(56svh * ${art.frames[0].width / art.frames[0].height}))` }}
              >
                <Agamograph
                  frames={art.frames}
                  alt={art.title}
                  imageClassName="frame frame-black"
                  className="[&_.frame]:mb-[var(--fw)]"
                />
              </div>
            ) : (
              <div className="frame frame-black aspect-square w-full max-w-md">
                <ArtworkPlaceholder id={art.id} palette={room.movement.palette} pattern={room.movement.pattern} />
              </div>
            )}
          </div>
        )}
      </div>

      <aside
        className={`relative flex shrink-0 flex-col bg-wall p-6 text-ink transition-[translate,opacity] duration-500 ease-out sm:p-8 lg:w-[23rem] lg:overflow-y-auto lg:pt-16 ${
          leaving ? "translate-y-4 opacity-0 lg:translate-x-8 lg:translate-y-0" : "animate-[panel-up_520ms_cubic-bezier(0.2,0.7,0.1,1)_both] lg:animate-[panel-side_520ms_cubic-bezier(0.2,0.7,0.1,1)_both]"
        }`}
      >
        <button
          type="button"
          onClick={leave}
          aria-label="Close"
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full transition-colors hover:bg-ink hover:text-wall"
        >
          <svg aria-hidden viewBox="0 0 14 14" className="size-3.5" stroke="currentColor" strokeWidth="1.75">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        <div className="pr-8 text-[0.9375rem] leading-snug">
          <p className="font-semibold">{art.artist}</p>
          <h2 id={titleId} className="mt-0.5">
            <span className="italic">{art.title}</span>, {art.date}
          </h2>
          <p className="mt-3 text-muted">{art.medium}</p>

          {art.credit && (
            <p className="mt-3 text-sm text-muted">
              {art.credit.line && <span className="block">{art.credit.line}</span>}
              <a href={art.credit.url} className="mt-1 inline-block text-ink underline underline-offset-4 hover:decoration-2">
                {art.credit.institution}
              </a>{" "}
              · Public domain (CC0)
            </p>
          )}
          {art.generative && (
            <p className="mt-3 text-sm text-muted">
              Drawn in code by the Studio with {room.movement.name} techniques. Not a copy of any existing work.
              {art.frames && " Move your pointer across it, drag on a touch screen, or use the slider to change the view."}
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
                  <Link href={`/studio?movement=${room.movement.slug}`} className="text-ink underline">
                    make one
                  </Link>
                </>
              )}
              .
            </p>
          )}
        </div>

        <AudioGuide key={art.id} artId={art.id} onSpeaking={underVoice} />

        <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
          In{" "}
          <Link href={`/exhibitions/${room.slug}`} className="text-ink underline-offset-4 hover:underline">
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
      </aside>
    </div>
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
        {room.movement.station && (
          <Link href={room.movement.station} className={TEXT_LINK}>
            Try the technique yourself
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
  const label =
    portal.kind === "studio"
      ? "Open the Studio"
      : portal.kind === "lab"
        ? "Step into the lab"
        : portal.kind === "station"
          ? "Try it"
          : "Read the guides";
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
