import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { WallRepaint } from "@/components/gallery/wall-repaint";
import { STUDIO_WALL, wallVars } from "@/components/gallery/walls";
import { listAvailableProviders } from "@/lib/generation/registry";
import { getMovements } from "@/lib/museum/registry";
import { StudioForm, type StudioMovement, type StudioProvider } from "./studio-form";

export const metadata: Metadata = {
  title: "Studio",
  description: "Make a piece in a modern art movement's style, then ask to hang it.",
};

export default function StudioPage(props: PageProps<"/studio">) {
  return (
    <WallRepaint id="studio" initial={STUDIO_WALL}>
      <div className="-my-10 mx-[calc(50%-50vw)]">
        <section data-wall="" style={wallVars(STUDIO_WALL)} aria-labelledby="studio-title">
          <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:pb-28">
            <header className="grid gap-x-10 gap-y-6 pt-12 pb-12 md:grid-cols-12 md:pt-20 md:pb-16">
              <h1
                id="studio-title"
                className="wall-title text-[clamp(2.75rem,6vw,5.5rem)] md:col-span-7"
              >
                Make modern art
              </h1>
              <p className="max-w-[44ch] text-lg leading-relaxed text-pretty md:col-span-4 md:col-start-9 md:self-end">
                Choose a movement, describe a subject or upload a photo, and generate a piece. If
                you like it, ask to hang it in the Community Gallery on Floor 1.
              </p>
            </header>
            <Suspense
              fallback={
                <p className="border-t border-line pt-10 text-lg text-muted">Opening the studio…</p>
              }
            >
              <StudioLoader searchParams={props.searchParams} />
            </Suspense>
          </div>
        </section>
      </div>
    </WallRepaint>
  );
}

async function StudioLoader({
  searchParams,
}: {
  searchParams: PageProps<"/studio">["searchParams"];
}) {
  // Provider availability depends on runtime env vars, so render per request.
  await connection();
  const { movement } = await searchParams;

  const movements: StudioMovement[] = getMovements().map((m) => ({
    slug: m.slug,
    name: m.name,
    period: m.period,
    palette: m.palette,
    available: m.studio.status === "available",
    acceptsImage: m.studio.inputs.includes("image"),
  }));
  const providers: StudioProvider[] = listAvailableProviders().map((p) => ({
    id: p.id,
    label: p.label,
  }));
  const initial =
    typeof movement === "string" && movements.some((m) => m.slug === movement && m.available)
      ? movement
      : movements.find((m) => m.available)?.slug;

  return (
    <StudioForm
      movements={movements}
      providers={providers}
      defaultProvider={process.env.IMAGE_PROVIDER || "mock"}
      initialMovement={initial}
    />
  );
}
