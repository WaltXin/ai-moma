import type { PaintingWorld } from "@/lib/museum/types";

/** "Liya Tian and Walt Xin", each name linking to its maker. */
export function Creators({
  creators,
  className = "underline underline-offset-2",
}: {
  creators: PaintingWorld["creators"];
  className?: string;
}) {
  return creators.map((c, i) => (
    <span key={c.name}>
      {i > 0 && (i === creators.length - 1 ? " and " : ", ")}
      {c.url ? (
        <a href={c.url} target="_blank" rel="noreferrer" className={className}>
          {c.name}
        </a>
      ) : (
        c.name
      )}
    </span>
  ));
}
