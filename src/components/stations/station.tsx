import type { ReactNode } from "react";

/** One station: the piece and its controls, with wall text beside it. */
export function Station({
  id,
  title,
  see,
  really,
  tryIt,
  note,
  last = false,
  children,
}: {
  id: string;
  title: string;
  see: string;
  really: string;
  tryIt: string;
  note: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`grid scroll-mt-6 gap-x-10 gap-y-8 border-t border-line pt-14 md:grid-cols-12 md:grid-rows-[auto_1fr] md:pt-20 ${last ? "pb-20 md:pb-28" : "pb-14 md:pb-20"}`}
    >
      {/* Phones read title, piece, then wall text; desktops hang the piece beside both. */}
      <h2
        id={`${id}-title`}
        className="wall-title text-[clamp(2rem,3.4vw,3rem)] md:col-span-4 md:col-start-9 md:row-start-1"
      >
        {title}
      </h2>
      <div className="min-w-0 md:col-span-7 md:col-start-1 md:row-span-2 md:row-start-1">
        {children}
      </div>
      <div className="md:col-span-4 md:col-start-9 md:row-start-2">
        <dl className="space-y-6 leading-relaxed">
          <div>
            <dt className="font-semibold">What you see</dt>
            <dd className="mt-1 text-muted">{see}</dd>
          </div>
          <div>
            <dt className="font-semibold">What is really there</dt>
            <dd className="mt-1 text-muted">{really}</dd>
          </div>
          <div>
            <dt className="font-semibold">Try</dt>
            <dd className="mt-1 text-muted">{tryIt}</dd>
          </div>
        </dl>
        <p className="mt-8 border-t border-line pt-5 text-sm leading-relaxed text-muted">{note}</p>
      </div>
    </section>
  );
}
