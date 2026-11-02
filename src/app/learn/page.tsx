import type { Metadata } from "next";
import Link from "next/link";
import { getMovements } from "@/lib/museum/registry";

export const metadata: Metadata = { title: "Learn" };

export default function LearnIndexPage() {
  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Education</p>
        <h1 className="mt-2 text-5xl font-black tracking-tight">Learn the movements</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Short, plain-language guides to what each movement was about and how its artists worked.
        </p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2">
        {getMovements().map((m) => (
          <li key={m.slug}>
            <Link
              href={`/learn/${m.slug}`}
              className="block border border-line bg-plinth p-6 hover:border-ink"
            >
              <div className="mb-4 flex h-2">
                {m.palette.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <h2 className="text-2xl font-bold">{m.name}</h2>
              <p className="text-sm text-muted">{m.period}</p>
              <p className="mt-3">{m.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
