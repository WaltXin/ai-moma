import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { listAvailableProviders } from "@/lib/generation/registry";
import { getMovements } from "@/lib/museum/registry";
import { StudioForm, type StudioMovement, type StudioProvider } from "./studio-form";

export const metadata: Metadata = { title: "Studio" };

export default function StudioPage(props: PageProps<"/studio">) {
  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Studio</p>
        <h1 className="mt-2 text-5xl font-black tracking-tight">Make modern art</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Choose a movement, upload a photo or describe a subject, and generate a piece. If you like
          it, request an exhibition in the Community Gallery.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Opening the studio…</p>}>
        <StudioLoader searchParams={props.searchParams} />
      </Suspense>
    </div>
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
