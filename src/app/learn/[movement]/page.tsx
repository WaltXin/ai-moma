import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovement, getMovements } from "@/lib/museum/registry";

export function generateStaticParams() {
  return getMovements().map((m) => ({ movement: m.slug }));
}

export async function generateMetadata(props: PageProps<"/learn/[movement]">): Promise<Metadata> {
  const movement = getMovement((await props.params).movement);
  return {
    title: movement ? `Learn ${movement.name}` : "Not found",
    description: movement?.summary,
  };
}

export default async function LearnMovementPage(props: PageProps<"/learn/[movement]">) {
  const movement = getMovement((await props.params).movement);
  if (!movement) notFound();

  return (
    <article className="grid gap-12 lg:grid-cols-[1fr_18rem]">
      <div className="max-w-2xl">
        <Link
          href="/learn"
          className="font-mono text-xs uppercase tracking-widest text-muted hover:text-ink"
        >
          ← All movements
        </Link>
        <h1 className="mt-2 text-5xl font-black tracking-tight">{movement.name}</h1>
        <p className="mt-2 text-muted">{movement.period}</p>
        <p className="mt-6 text-xl">{movement.summary}</p>

        {movement.learn.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-2xl font-bold">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-3 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <aside className="space-y-8 text-sm">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted">Key artists</h2>
          <ul className="mt-2 space-y-1">
            {movement.keyArtists.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted">Techniques</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {movement.techniques.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          {movement.studio.status === "available" ? (
            <Link
              href={`/studio?movement=${movement.slug}`}
              className="inline-block bg-ink px-4 py-2 font-medium text-wall hover:bg-accent"
            >
              Try it in the Studio →
            </Link>
          ) : (
            <p className="text-muted">The Studio for this movement is coming soon.</p>
          )}
        </div>
      </aside>
    </article>
  );
}
