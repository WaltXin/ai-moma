import Link from "next/link";
import { Arrow } from "@/components/gallery/wall-parts";
import type { PaintingWorld } from "@/lib/museum/types";
import { Creators } from "./creators";

/** A way into a painting's world: what it is, who made it, and the door. */
export function WorldDoor({ world, level = 2 }: { world: PaintingWorld; level?: 2 | 3 }) {
  const Title = level === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={`world-${world.slug}`} className="bg-[#0e1a3d] text-[#e9eefb]">
      <div className="mx-auto grid max-w-6xl gap-6 border-t border-[#2b3b6b] px-4 py-12 sm:px-6 md:grid-cols-12 md:py-16">
        <div className="md:col-span-7">
          <p className="text-sm font-semibold tracking-wide text-[#f8e27a] uppercase">
            Step into a painting
          </p>
          <Title
            id={`world-${world.slug}`}
            className="mt-3 text-3xl leading-tight font-semibold md:text-4xl"
          >
            {world.title}
          </Title>
          <p className="mt-1 text-[#aebbd8]">
            After {world.artist}, {world.year}
          </p>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-pretty">{world.intro}</p>
          {world.creators?.length ? (
            <p className="mt-4 text-sm text-[#aebbd8]">
              A painting world by{" "}
              <Creators
                creators={world.creators}
                className="text-[#e9eefb] underline underline-offset-2"
              />
              .
            </p>
          ) : null}
        </div>
        <div className="flex items-end md:col-span-5 md:justify-end">
          <Link
            href={`/worlds/${world.slug}`}
            className="inline-flex items-center gap-2 bg-[#f3efe2] px-5 py-3 font-semibold text-[#141414]"
          >
            Walk into it<span className="sr-only">: {world.title}</span> <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
