import Link from "next/link";
import { Fragment } from "react";
import type { Floor } from "@/lib/museum/types";

/** Keeps hyphenated words like "Avant-Garde" on one line in big type. */
export function KeepHyphens({ text }: { text: string }) {
  return text.split(" ").map((word, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className={word.includes("-") ? "whitespace-nowrap" : undefined}>{word}</span>
    </Fragment>
  ));
}

export function Arrow({ direction = "right" }: { direction?: "right" | "left" | "up" | "down" }) {
  const rotate = { right: "", left: "rotate-180", up: "-rotate-90", down: "rotate-90" }[direction];
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 12"
      className={`h-3 w-5 ${rotate}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M0 6h18M13 1l5 5-5 5" />
    </svg>
  );
}

/** "No work yet", "1 work", "8 works". */
export function worksLabel(n: number): string {
  return n === 0 ? "No work yet" : n === 1 ? "1 work" : `${n} works`;
}

/** Solid action on a painted wall: ink on the wall's color, inverted. */
export const BUTTON =
  "inline-flex items-center gap-3 bg-ink px-5 py-3 font-semibold text-wall transition-colors hover:bg-accent hover:text-white";

/** Quiet action: an underlined link. */
export const TEXT_LINK =
  "font-semibold underline decoration-1 underline-offset-[6px] hover:decoration-2";

/** A movement's palette as paint chips. */
export function PaintChips({
  colors,
  size = "md",
  decorative = false,
}: {
  colors: string[];
  size?: "sm" | "md";
  /** Hide from screen readers when the chips sit inside a labelled control. */
  decorative?: boolean;
}) {
  return (
    <ul
      aria-label={decorative ? undefined : "Palette"}
      aria-hidden={decorative || undefined}
      className="flex gap-1.5"
    >
      {colors.map((c) => (
        <li
          key={c}
          title={c}
          className={`${size === "sm" ? "h-5 w-3.5" : "h-9 w-6"} shadow-[0_2px_4px_-1px_rgb(0_0_0/0.35)]`}
          style={{ background: c }}
        >
          <span className="sr-only">{c}</span>
        </li>
      ))}
    </ul>
  );
}

/** Floor number in a lit elevator button, for wayfinding rows. */
export function FloorBadge({ level }: { level: number }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-bold text-wall">
      {level}
    </span>
  );
}

/** Round elevator buttons, top floor first; the current floor is lit. A column on desktop. */
export function Elevator({ floors, current }: { floors: Floor[]; current?: string }) {
  return (
    <nav aria-label="Elevator">
      <ol className="flex flex-wrap gap-2 md:flex-col md:flex-nowrap">
        {[...floors].reverse().map((floor) => {
          const here = floor.slug === current;
          return (
            <li key={floor.slug}>
              <Link
                href={`/floors/${floor.slug}`}
                aria-current={here ? "page" : undefined}
                title={`Floor ${floor.level}: ${floor.name}`}
                className={`grid size-10 place-items-center rounded-full border font-display text-lg font-bold tabular-nums transition-colors ${
                  here
                    ? "border-ink bg-ink text-wall"
                    : "border-line hover:border-ink hover:bg-ink hover:text-wall"
                }`}
              >
                {floor.level}
                <span className="sr-only">: {floor.name}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Empty frames waiting for visitors' work, with their wall labels. */
export function EmptyFrames() {
  const frames = [
    { shape: "aspect-[4/5] w-[30%]", title: "Untitled" },
    { shape: "aspect-square w-[24%]", title: "Self-Portrait" },
    { shape: "aspect-[3/4] w-[20%]", title: "Study" },
  ];
  return (
    <ul
      className="flex items-center justify-between gap-[4%]"
      aria-label="Empty frames waiting for work"
    >
      {frames.map(({ shape, title }) => {
        const [aspect, width] = shape.split(" ");
        return (
          <li key={title} className={width}>
            <div
              className={`frame frame-black ${aspect} w-full bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgb(0_0_0/0.06)_10px_11px)]`}
            />
            <div className="mt-5 text-[0.8125rem] leading-snug">
              <span className="block font-semibold">You</span>
              <span className="block">
                <span className="italic">{title}</span>, 2026
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
