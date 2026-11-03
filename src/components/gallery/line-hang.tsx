import Link from "next/link";
import type { CSSProperties } from "react";
import type { Artwork } from "@/lib/museum/types";
import { FramedAgamograph, FramedPicture, Tombstone, stillOf } from "./hung-work";

/** Relative sizes along a hang, so the line doesn't read as a row of thumbnails. */
const SCALE = [1, 0.8, 1.1, 0.88, 0.96];
const GAP = 4; // percent of the row, between works

export type HangItem = { artwork: Artwork; href?: string };

/**
 * Works hung on one eye-level line, centered on it like a gallery wall, each
 * with its wall label. On desktop the line spans the row; a short line keeps
 * the spacing of `slots` works and centers. On phones it scrolls sideways.
 */
export function LineHang({ items, slots = 4 }: { items: HangItem[]; slots?: number }) {
  const hung = items.filter((item) => stillOf(item.artwork));
  if (hung.length === 0) return null;

  const weights = hung.map(({ artwork }, i) => {
    const still = stillOf(artwork)!;
    return Math.sqrt(still.width / still.height) * SCALE[i % SCALE.length];
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const n = Math.max(hung.length, slots);
  // Pad a short line with average-sized gaps so its works keep their size.
  const total = sum + (n - hung.length) * (sum / hung.length);
  const share = 100 - GAP * (n - 1);

  return (
    <div className="hang-strip snap-x snap-mandatory scroll-px-4 overflow-x-auto md:mx-auto md:max-w-6xl md:overflow-visible md:px-6">
      <ul className="flex w-max items-center gap-10 px-4 pt-4 pb-6 sm:px-6 md:w-full md:justify-center md:gap-[4%] md:px-2.5">
        {hung.map(({ artwork, href }, i) => {
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
              ) : href ? (
                <Link href={href} className="block">
                  <FramedPicture
                    artwork={artwork}
                    sizes="(min-width: 768px) 28vw, 60vw"
                    className="w-full"
                  />
                </Link>
              ) : (
                <FramedPicture
                  artwork={artwork}
                  sizes="(min-width: 768px) 28vw, 60vw"
                  className="w-full"
                />
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
  );
}

/** Splits a room's works into lines of at most `max`, as evenly as possible. */
export function linesOf<T>(items: T[], max = 4): T[][] {
  const lines = Math.ceil(items.length / max);
  const per = Math.ceil(items.length / Math.max(lines, 1));
  return Array.from({ length: lines }, (_, i) => items.slice(i * per, (i + 1) * per));
}
