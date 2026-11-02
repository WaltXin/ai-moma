"use client";

import { useState } from "react";

export type StudioMovement = {
  slug: string;
  name: string;
  available: boolean;
  acceptsImage: boolean;
};
export type StudioProvider = { id: string; label: string };

type Result = { imageUrl: string; provider: string; model?: string };

const field = "w-full border border-line bg-plinth px-3 py-2 focus:border-ink focus:outline-none";
const label = "mb-1 block text-sm font-medium";
const button =
  "bg-ink px-5 py-2.5 font-medium text-wall hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40";

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

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <form onSubmit={generate} className="space-y-5">
        <div>
          <label className={label} htmlFor="movement">
            Movement
          </label>
          <select
            id="movement"
            className={field}
            value={movement}
            onChange={(e) => setMovement(e.target.value)}
          >
            {props.movements.map((m) => (
              <option key={m.slug} value={m.slug} disabled={!m.available}>
                {m.name}
                {m.available ? "" : " (coming soon)"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="prompt">
            Describe your subject
          </label>
          <textarea
            id="prompt"
            className={`${field} min-h-24`}
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
              className="text-sm"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Upload preview"
                className="mt-3 h-32 w-32 border border-line object-cover"
              />
            )}
            <p className="mt-1 text-xs text-muted">
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
          <p className="mt-1 text-xs text-muted">
            Only providers with API keys in <code>.env.local</code> appear here.
          </p>
        </div>

        <button
          type="submit"
          className={button}
          disabled={busy || !current?.available || (!prompt.trim() && !file)}
        >
          {busy ? "Generating…" : "Generate"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-accent">
            {error}
          </p>
        )}
      </form>

      <div>
        {result ? (
          <>
            <div className="aspect-square border-[10px] border-ink bg-plinth">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt="Generated artwork"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-2 font-mono text-xs text-muted">
              via {result.provider}
              {result.model ? ` / ${result.model}` : ""}
            </p>
            <ExhibitionRequest movement={movement} prompt={prompt} result={result} />
          </>
        ) : (
          <div className="flex aspect-square items-center justify-center border border-dashed border-line text-muted">
            Your piece will appear here.
          </div>
        )}
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

  if (state === "sent") return <p className="mt-6 border-l-4 border-ink pl-3">{message}</p>;

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 border-t border-line pt-6">
      <h2 className="text-xl font-bold">Request an exhibition</h2>
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
          className={`${field} min-h-20`}
        />
      </div>
      <button type="submit" className={button} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Submit for review"}
      </button>
      {state === "error" && (
        <p role="alert" className="text-sm text-accent">
          {message}
        </p>
      )}
    </form>
  );
}
