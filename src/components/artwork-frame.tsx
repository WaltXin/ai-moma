import { Agamograph } from "@/components/agamograph";
import { seedFrom, seededRandom } from "@/lib/museum/placeholder";
import type { Artwork, Movement, PlaceholderPattern } from "@/lib/museum/types";

/**
 * Generative stand-in drawn from a movement's palette and pattern.
 * Used until an artwork has a real image. The walkable floor draws the same
 * patterns on canvas (`components/walk/textures.ts`).
 */
export function ArtworkPlaceholder({
  id,
  palette: p,
  pattern,
}: {
  id: string;
  palette: string[];
  pattern: PlaceholderPattern;
}) {
  const s = seedFrom(id);
  const pick = (n: number) => p[(s + n) % p.length];
  const pid = `pat-${id}`;

  if (pattern === "stripes") {
    const count = 10 + (s % 8);
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <rect
            key={i}
            x={(i * 100) / count}
            width={100 / count}
            height="100"
            fill={i % 2 ? pick(0) : pick(1)}
          />
        ))}
        <circle cx="50" cy="50" r={22 + (s % 12)} fill={pick(2)} opacity="0.9" />
      </svg>
    );
  }

  if (pattern === "grid") {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={(i % 2) * 50}
            y={Math.floor(i / 2) * 50}
            width="50"
            height="50"
            fill={pick(i)}
          />
        ))}
      </svg>
    );
  }

  if (pattern === "field") {
    const bands = 2 + (s % 2);
    const bh = 92 / bands - 4;
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <rect width="100" height="100" fill={pick(0)} />
        {Array.from({ length: bands }, (_, i) => (
          <rect key={i} x="6" y={6 + i * (bh + 4)} width="88" height={bh} fill={pick(i + 1)} />
        ))}
      </svg>
    );
  }

  if (pattern === "gesture") {
    const rand = seededRandom(s);
    const r = () => Math.round(rand() * 100);
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <rect width="100" height="100" fill={p[p.length - 1]} />
        {Array.from({ length: 7 }, (_, i) => (
          <path
            key={i}
            d={`M${r()} ${r()} C${r()} ${r()} ${r()} ${r()} ${r()} ${r()}`}
            stroke={pick(i)}
            strokeWidth={2 + rand() * 4}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </svg>
    );
  }

  // ben-day
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <defs>
        <pattern id={pid} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.4" fill={pick(0)} />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={pick(1)} />
      <rect width="100" height="100" fill={`url(#${pid})`} />
      <circle
        cx={35 + (s % 30)}
        cy={40 + (s % 20)}
        r="24"
        fill={pick(2)}
        stroke="#111"
        strokeWidth="2"
      />
    </svg>
  );
}

export function ArtworkFrame({ artwork, movement }: { artwork: Artwork; movement: Movement }) {
  return (
    <figure className="group">
      <div className="aspect-square overflow-hidden border-[10px] border-ink bg-plinth shadow-[0_18px_40px_-20px_rgba(0,0,0,0.5)]">
        {artwork.source.kind === "lenticular" ? (
          <div className="flex h-full items-center">
            <Agamograph
              frames={artwork.source.frames}
              alt={artwork.title}
              className="w-full"
              showControls={false}
            />
          </div>
        ) : artwork.source.kind === "image" ? (
          // Generated images may be data: URLs or arbitrary hosts, so use a plain <img> for now.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork.source.src}
            width={artwork.source.width}
            height={artwork.source.height}
            alt={artwork.title}
            loading="lazy"
            // Never crop a painting: matte it inside the square frame instead.
            className="h-full w-full object-contain"
          />
        ) : (
          <ArtworkPlaceholder
            id={artwork.id}
            palette={movement.palette}
            pattern={movement.placeholderPattern}
          />
        )}
      </div>
      <figcaption className="mt-4 text-sm leading-snug">
        <div className="font-semibold">{artwork.artist}</div>
        <div>
          <span className="italic">{artwork.title}</span>, {artwork.dateLabel ?? artwork.year}
        </div>
        <div className="text-muted">{artwork.medium}</div>
        {artwork.credit && (
          <div className="mt-1 text-xs text-muted">
            <a href={artwork.credit.url} className="underline hover:text-ink">
              {artwork.credit.institution}
            </a>{" "}
            · Public domain (CC0)
          </div>
        )}
        {artwork.generation && (
          <div className="mt-1 font-mono text-xs text-muted">
            via {artwork.generation.provider}
            {artwork.generation.model ? ` / ${artwork.generation.model}` : ""}
          </div>
        )}
      </figcaption>
    </figure>
  );
}
