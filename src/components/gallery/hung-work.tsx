import Image from "next/image";
import { Agamograph } from "@/components/agamograph";
import { frameFor } from "@/lib/museum/frames";
import type { Artwork, ImageFile } from "@/lib/museum/types";

export { type FrameKind, frameFor } from "@/lib/museum/frames";

/** The still image to hang: the picture itself, or an Agamograph's first view. */
export function stillOf(artwork: Artwork): ImageFile | null {
  const s = artwork.source;
  if (s.kind === "image") return s;
  if (s.kind === "lenticular") return s.frames[0] ?? null;
  return null;
}

/** A framed picture. Sizing comes from the parent; the picture never crops. */
export function FramedPicture({
  artwork,
  sizes,
  eager = false,
  className = "",
}: {
  artwork: Artwork;
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  const still = stillOf(artwork);
  if (!still) return null;
  return (
    <Image
      src={still.src}
      width={still.width}
      height={still.height}
      alt={`${artwork.title}, ${artwork.artist}`}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      className={`frame frame-${frameFor(artwork)} ${className}`}
    />
  );
}

/**
 * A live Agamograph in a black frame: it changes as the pointer crosses it.
 * With `controls`, a viewing-angle slider and tilt button sit under the frame.
 */
export function FramedAgamograph({
  artwork,
  controls = false,
}: {
  artwork: Artwork;
  controls?: boolean;
}) {
  if (artwork.source.kind !== "lenticular") return null;
  return controls ? (
    <Agamograph
      frames={artwork.source.frames}
      alt={artwork.title}
      imageClassName="frame frame-black"
      className="[&_.frame]:mb-[var(--fw)]"
    />
  ) : (
    <div className="frame frame-black w-full">
      <Agamograph frames={artwork.source.frames} alt={artwork.title} showControls={false} />
    </div>
  );
}

/**
 * The full label beside a work in its room: artist, title and date, medium,
 * then where it comes from (museum credit and license, or how it was made).
 */
export function WallLabel({ artwork }: { artwork: Artwork }) {
  return (
    <div className="max-w-[34ch] text-[0.9375rem] leading-snug">
      <p className="font-semibold">{artwork.artist}</p>
      <p className="mt-0.5">
        <span className="italic">{artwork.title}</span>, {artwork.dateLabel ?? artwork.year}
      </p>
      <p className="mt-3 text-muted">{artwork.medium}</p>
      {artwork.credit && (
        <p className="mt-3 text-sm text-muted">
          {artwork.credit.line && <span className="block">{artwork.credit.line}</span>}
          <a
            href={artwork.credit.url}
            className="mt-1 inline-block text-ink underline underline-offset-4 hover:decoration-2"
          >
            {artwork.credit.institution}
          </a>{" "}
          · Public domain (CC0)
        </p>
      )}
      {artwork.recipe && (
        <p className="mt-3 text-sm text-muted">
          Drawn in code by the Studio with the movement&apos;s techniques. Not a copy of any
          existing work.
        </p>
      )}
      {artwork.generation && (
        <p className="mt-3 text-sm text-muted">
          Made with {artwork.generation.provider}
          {artwork.generation.model ? ` (${artwork.generation.model})` : ""}
          {artwork.generation.prompt && (
            <span className="mt-1 block">Prompt: “{artwork.generation.prompt}”</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Museum wall label: artist, title and date, then medium in small type. */
export function Tombstone({ artwork, medium = false }: { artwork: Artwork; medium?: boolean }) {
  return (
    <span className="block text-[0.8125rem] leading-snug">
      <span className="block font-semibold">{artwork.artist}</span>
      <span className="block">
        <span className="italic">{artwork.title}</span>, {artwork.dateLabel ?? artwork.year}
      </span>
      {medium && <span className="block text-muted">{artwork.medium}</span>}
    </span>
  );
}
