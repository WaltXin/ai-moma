import type { Artwork, Movement } from "@/lib/museum/types";

/** Small deterministic hash so each placeholder looks a little different. */
function seed(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Generative stand-in drawn from the movement's palette and pattern.
 * Used until an artwork has a real image.
 */
function Placeholder({ artwork, movement }: { artwork: Artwork; movement: Movement }) {
  const s = seed(artwork.id);
  const p = movement.palette;
  const pick = (n: number) => p[(s + n) % p.length];
  const pid = `pat-${artwork.id}`;

  if (movement.placeholderPattern === "stripes") {
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

  if (movement.placeholderPattern === "grid") {
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
        {artwork.source.kind === "image" ? (
          // Generated images may be data: URLs or arbitrary hosts, so use a plain <img> for now.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork.source.src}
            width={artwork.source.width}
            height={artwork.source.height}
            alt={artwork.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Placeholder artwork={artwork} movement={movement} />
        )}
      </div>
      <figcaption className="mt-4 text-sm leading-snug">
        <div className="font-semibold">{artwork.artist}</div>
        <div>
          <span className="italic">{artwork.title}</span>, {artwork.year}
        </div>
        <div className="text-muted">{artwork.medium}</div>
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
