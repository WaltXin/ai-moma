"use client";

import Link from "next/link";
import { useState } from "react";
import { Arrow, BUTTON, PaintChips } from "@/components/gallery/wall-parts";

export type StudioMovement = {
  slug: string;
  name: string;
  period: string;
  palette: string[];
  available: boolean;
  acceptsImage: boolean;
};
export type StudioProvider = { id: string; label: string };

type Result = { imageUrl: string; provider: string; model?: string };

const field =
  "w-full border border-ink/25 bg-white/60 px-3.5 py-2.5 text-base placeholder:text-muted focus:border-ink";
const label = "mb-2 block font-semibold";
const hint = "mt-2 text-sm text-muted";
const button = `${BUTTON} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink disabled:hover:text-wall`;

/** Errors read as a dark plaque on the wall, not as colored text. */
function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="bg-ink px-4 py-3 text-sm text-wall">
      {children}
    </p>
  );
}

export function StudioForm(props: {
  movements: StudioMovement[];
  providers: StudioProvider[];
  defaultProvider: string;
  initialMovement?: string;
}) {
  const [movement, setMovement] = useState(props.initialMovement ?? "");
  const [provider, setProvider] = useState(
    props.providers.some((p) => p.id === props.defaultProvider)
      ? props.defaultProvider
      : (props.providers[0]?.id ?? ""),
  );
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const current = props.movements.find((m) => m.slug === movement);

  function chooseFile(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const body = new FormData();
    body.set("movement", movement);
    body.set("prompt", prompt);
    body.set("provider", provider);
    if (file && current?.acceptsImage) body.set("image", file);
    try {
      const res = await fetch("/api/generate", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const open = props.movements.filter((m) => m.available);
  const soon = props.movements.filter((m) => !m.available);

  return (
    <div className="grid gap-x-10 gap-y-14 border-t border-line pt-10 md:grid-cols-12 md:pt-14">
      <form onSubmit={generate} className="space-y-8 md:col-span-6">
        <fieldset>
          <legend className={label}>Movement</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {open.map((m) => (
              <label
                key={m.slug}
                className="flex cursor-pointer flex-col gap-3 border border-ink/25 bg-white/40 p-4 transition-colors has-checked:border-ink has-checked:bg-white/80 has-focus-visible:outline-2 has-focus-visible:outline-offset-4"
              >
                <input
                  type="radio"
                  name="movement"
                  value={m.slug}
                  checked={movement === m.slug}
                  onChange={() => setMovement(m.slug)}
                  className="sr-only"
                />
                <PaintChips colors={m.palette} size="sm" decorative />
                <span>
                  <span className="block font-display text-xl font-bold [font-stretch:112%]">
                    {m.name}
                  </span>
                  <span className="block text-sm text-muted">{m.period}</span>
                </span>
              </label>
            ))}
          </div>
          {soon.length > 0 && (
            <p className={hint}>
              Coming to the Studio:{" "}
              {soon.map((m, i) => (
                <span key={m.slug}>
                  {i > 0 && ", "}
                  <Link href={`/learn/${m.slug}`} className="underline-offset-4 hover:underline">
                    {m.name}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </fieldset>

        <div>
          <label className={label} htmlFor="prompt">
            Describe your subject
          </label>
          <textarea
            id="prompt"
            className={`${field} min-h-28`}
            placeholder="e.g. my cat wearing sunglasses"
            maxLength={1000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {current?.acceptsImage && (
          <div>
            <label className={label} htmlFor="image">
              Or upload a photo (optional)
            </label>
            <input
              id="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full text-sm file:mr-4 file:cursor-pointer file:border file:border-ink file:bg-transparent file:px-4 file:py-2 file:font-semibold file:text-ink hover:file:bg-ink hover:file:text-wall"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Upload preview"
                className="frame frame-mat mt-4 h-32 w-auto"
              />
            )}
            <p className={hint}>
              Only upload photos you have the right to use. Please don&apos;t upload photos of other
              people without their consent.
            </p>
          </div>
        )}

        <div>
          <label className={label} htmlFor="provider">
            Image model
          </label>
          <select
            id="provider"
            className={field}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {props.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className={hint}>
            Only providers with API keys in <code>.env.local</code> appear here.
          </p>
        </div>

        <div className="space-y-4">
          <button
            type="submit"
            className={button}
            disabled={busy || !current?.available || (!prompt.trim() && !file)}
          >
            {busy ? "Generating…" : "Generate"}
            {!busy && <Arrow />}
          </button>
          {error && <Alert>{error}</Alert>}
        </div>
      </form>

      <div className="md:col-span-5 md:col-start-8">
        <div className={result ? undefined : "md:sticky md:top-8"}>
          {result ? (
            <figure>
              <div className="p-[clamp(4px,0.62vw,10px)]">
                {/* Generated images may be data: URLs or any host, so a plain <img>. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.imageUrl}
                  alt={`Your ${current?.name ?? ""} piece`}
                  className="frame frame-black h-auto w-full"
                />
              </div>
              <figcaption className="mt-6 text-[0.9375rem] leading-snug">
                <span className="block font-semibold">You</span>
                <span className="block">
                  <span className="italic">Untitled</span>, {new Date().getFullYear()}
                </span>
                <span className="mt-2 block text-muted">
                  {current?.name}, made with {result.provider}
                  {result.model ? ` (${result.model})` : ""}
                </span>
              </figcaption>
              <ExhibitionRequest movement={movement} prompt={prompt} result={result} />
            </figure>
          ) : (
            <div className="p-[clamp(4px,0.62vw,10px)]">
              <div
                className={`frame frame-black grid aspect-square w-full place-items-center bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgb(0_0_0/0.06)_10px_11px)] ${busy ? "animate-pulse" : ""}`}
              >
                <p className="px-8 text-center text-muted">
                  {busy ? "Painting your piece…" : "Your piece will hang here."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExhibitionRequest({
  movement,
  prompt,
  result,
}: {
  movement: string;
  prompt: string;
  result: Result;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        artist: data.get("artist"),
        statement: data.get("statement"),
        movement,
        imageUrl: result.imageUrl,
        provider: result.provider,
        model: result.model,
        prompt: prompt || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setState("sent");
      setMessage(`Request received (#${String(json.id).slice(0, 8)}). A curator will review it.`);
    } else {
      setState("error");
      setMessage(json.error ?? "Could not submit");
    }
  }

  if (state === "sent") {
    return (
      <p className="mt-8 bg-ink px-4 py-3 text-wall" role="status">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6 border-t border-line pt-8">
      <h2 className="font-display text-2xl font-bold [font-stretch:112%]">Request an exhibition</h2>
      <div>
        <label className={label} htmlFor="title">
          Title
        </label>
        <input id="title" name="title" required maxLength={120} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="artist">
          Your name (as shown on the label)
        </label>
        <input id="artist" name="artist" required maxLength={80} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="statement">
          Artist statement (optional)
        </label>
        <textarea
          id="statement"
          name="statement"
          maxLength={1000}
          className={`${field} min-h-24`}
        />
      </div>
      <button type="submit" className={button} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Submit for review"}
      </button>
      {state === "error" && <Alert>{message}</Alert>}
    </form>
  );
}
