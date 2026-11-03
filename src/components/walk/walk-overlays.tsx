"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { Agamograph } from "@/components/agamograph";
import { ArtworkPlaceholder } from "@/components/artwork-frame";
import type { FloorPlan, PlanArtwork, PlanRoom } from "@/lib/walk/floor-plan";

/** Modal shell: dark backdrop, focus moves in on open, click outside to close. */
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
        className={`relative max-h-full w-full overflow-auto border border-line bg-plinth p-5 text-ink shadow-2xl outline-none sm:p-7 ${
          wide ? "max-w-6xl" : "max-w-lg"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-8 w-8 rounded-full text-xl leading-none text-muted hover:bg-wall hover:text-ink"
        >
          ×
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
      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <div className="flex min-h-[40vh] items-center justify-center bg-wall p-3 sm:p-6">
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
                className="[&>div:first-child]:border-[6px] [&>div:first-child]:border-[#2a2118] [&>div:first-child]:shadow-xl"
              />
            </div>
          ) : art.image ? (
            // Local public-domain files; a plain <img> keeps natural sizing in the modal.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={art.id}
              src={art.image.src}
              width={art.image.width}
              height={art.image.height}
              alt={`${art.title} by ${art.artist}`}
              className="max-h-[70vh] w-auto max-w-full border-[6px] border-[#2a2118] object-contain shadow-xl"
            />
          ) : (
            <div className="aspect-square w-full max-w-md border-[6px] border-[#2a2118]">
              <ArtworkPlaceholder
                id={art.id}
                palette={room.movement.palette}
                pattern={room.movement.pattern}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col pr-6 text-sm">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {room.movement.name} · {room.title}
          </p>
          <h2 id={titleId} className="mt-3 text-2xl font-bold italic leading-tight">
            {art.title}
          </h2>
          <p className="mt-2 text-base font-semibold">{art.artist}</p>
          <p>{art.date}</p>
          <p className="text-muted">{art.medium}</p>

          {art.credit && (
            <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
              {art.credit.institution}
              {art.credit.line ? `, ${art.credit.line}` : ""}. Public domain (CC0).{" "}
              <a href={art.credit.url} className="font-medium text-ink underline">
                See it at the museum ↗
              </a>
            </p>
          )}
          {art.generative && (
            <p className="mt-4 border-t border-line pt-4 text-muted">
              An original piece drawn with code in the AI MoMA Studio, using {room.movement.name}{" "}
              techniques. It hangs here until visitors&apos; AI-made work joins it.
              {art.frames &&
                " Move your pointer across it, or drag on a touch screen, to change the view."}
            </p>
          )}
          {!art.image && (
            <p className="mt-4 border-t border-line pt-4 text-muted">
              This frame is waiting for a Studio piece made with {room.movement.name} techniques.{" "}
              <Link
                href={`/learn/${room.movement.slug}`}
                className="font-medium text-ink underline"
              >
                Learn the techniques
              </Link>
              {room.movement.studioOpen && (
                <>
                  {" "}
                  or{" "}
                  <Link
                    href={`/studio?movement=${room.movement.slug}`}
                    className="font-medium text-ink underline"
                  >
                    make one
                  </Link>
                </>
              )}
              .
            </p>
          )}
          {art.generation && (
            <p className="mt-2 font-mono text-xs text-muted">
              via {art.generation.provider}
              {art.generation.model ? ` / ${art.generation.model}` : ""}
            </p>
          )}

          {siblings.length > 1 && (
            <div className="mt-auto flex items-center justify-between gap-2 pt-6 font-medium">
              <button
                type="button"
                onClick={() => onNavigate(prev)}
                className="border border-line px-3 py-1.5 hover:border-ink"
              >
                ← Prev
              </button>
              <span className="text-xs text-muted">
                {i + 1} / {siblings.length}
              </span>
              <button
                type="button"
                onClick={() => onNavigate(next)}
                className="border border-line px-3 py-1.5 hover:border-ink"
              >
                Next →
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
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        {room.movement.name} · {room.movement.period}
      </p>
      <h2 id={titleId} className="mt-3 text-3xl font-black tracking-tight">
        {room.title}
      </h2>
      <p className="mt-3 text-lg">{room.description}</p>
      <p className="mt-4 border-l-4 border-ink pl-3 text-sm">{room.movement.summary}</p>
      <p className="mt-3 text-xs text-muted">Curated by {room.curator}</p>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
        <Link href={`/learn/${room.movement.slug}`} className="hover:text-accent">
          Learn {room.movement.name} →
        </Link>
        {room.movement.studioOpen && (
          <Link href={`/studio?movement=${room.movement.slug}`} className="hover:text-accent">
            Make one in the Studio →
          </Link>
        )}
        <Link href={`/exhibitions/${room.slug}`} className="hover:text-accent">
          See this room as a list →
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
  floors: FloorPlan["floors"];
  current: string;
  onChoose: (slug: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="font-mono text-xs uppercase tracking-widest text-muted">
        Elevator
      </h2>
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {[...floors].reverse().map((f) => {
          const here = f.slug === current;
          return (
            <li key={f.slug}>
              <button
                type="button"
                disabled={here}
                onClick={() => onChoose(f.slug)}
                className="grid w-full grid-cols-[3rem_1fr_auto] items-baseline gap-3 py-3 text-left hover:text-accent disabled:cursor-default disabled:text-muted disabled:hover:text-muted"
              >
                <span className="text-3xl font-black tabular-nums">{f.level}</span>
                <span className="text-lg font-bold">{f.name}</span>
                {here && <span className="text-xs">You are here</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <Link href="/" className="mt-4 inline-block text-sm font-medium hover:text-accent">
        Leave to the lobby →
      </Link>
    </Dialog>
  );
}
