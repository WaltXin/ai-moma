import Link from "next/link";
import { getExhibitionsOnFloor, getFloors } from "@/lib/museum/registry";

export default function LobbyPage() {
  // Elevator order: top floor first.
  const floors = getFloors().reverse();

  return (
    <div className="space-y-16">
      <section className="max-w-3xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Lobby</p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
          A museum of modern art,
          <br />
          <span className="text-accent">made of modern art.</span>
        </h1>
        <p className="mt-6 text-lg text-muted">
          Walk the floors, learn how each movement worked, make your own piece in the Studio, then
          ask to have it exhibited. AI MoMA is open source, so anyone can add a movement.
        </p>
      </section>

      <section aria-labelledby="directory">
        <h2 id="directory" className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
          Floor directory
        </h2>
        <ol className="divide-y divide-line border-y border-line">
          {floors.map((floor) => {
            const exhibitions = getExhibitionsOnFloor(floor);
            return (
              <li key={floor.slug}>
                <Link
                  href={`/floors/${floor.slug}`}
                  className="group grid grid-cols-[3.5rem_1fr] items-baseline gap-4 py-6 sm:grid-cols-[5rem_1fr_auto]"
                >
                  <span className="text-4xl font-black tabular-nums sm:text-6xl">
                    {floor.level}
                  </span>
                  <span>
                    <span className="block text-2xl font-bold group-hover:text-accent">
                      {floor.name}
                    </span>
                    <span className="block text-muted">{floor.tagline}</span>
                  </span>
                  <span className="col-start-2 text-sm text-muted sm:col-start-3">
                    {exhibitions.map((e) => e.title).join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {[
          { href: "/", title: "Visit", body: "Each floor holds exhibitions from one movement." },
          { href: "/learn", title: "Learn", body: "Short guides to how each movement worked." },
          {
            href: "/studio",
            title: "Create",
            body: "Upload a photo or write a prompt, then submit the result.",
          },
        ].map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="border border-line bg-plinth p-6 transition hover:border-ink"
          >
            <h3 className="text-xl font-bold">{card.title}</h3>
            <p className="mt-2 text-sm text-muted">{card.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
