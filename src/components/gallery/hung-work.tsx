import Image from "next/image";
import { Agamograph } from "@/components/agamograph";
import type { Artwork, ImageFile } from "@/lib/museum/types";

export type FrameKind = "gilt" | "black" | "mat";

const ON_PAPER =
  /lithograph|print|paper|watercolou?r|gouache|pencil|crayon|charcoal|etching|woodcut|collage|portfolio|plate/i;

/** The frame a curator would reach for: mats for paper, gilt for 19th-century oils, black after. */
export function frameFor(artwork: Artwork): FrameKind {
  if (artwork.recipe) return "black";
  if (ON_PAPER.test(artwork.medium)) return "mat";
  return artwork.year < 1905 ? "gilt" : "black";
}

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

/** A live Agamograph in a black frame: it changes as the pointer crosses it. */
export function FramedAgamograph({ artwork }: { artwork: Artwork }) {
  if (artwork.source.kind !== "lenticular") return null;
  return (
    <div className="frame frame-black w-full">
      <Agamograph frames={artwork.source.frames} alt={artwork.title} showControls={false} />
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
