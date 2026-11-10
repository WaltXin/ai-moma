"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Choice, Range } from "@/components/perception/controls";
import {
  averageOf,
  coolShare,
  type Dot,
  describe,
  GROUND,
  hex,
  inShade,
  PALETTE,
  type Reading,
  shadeEdge,
  touches,
} from "@/lib/stations/dots";
import { PalettePicker } from "./palette-picker";

/** The canvas, in its own pixels; it's drawn at whatever size fits. */
const W = 1200;
const H = 800;
/** "From across the room": the painting shrunk this small, where the dots blend. */
const TW = 150;
const TH = 100;

type Start = "sun-and-shade" | "blank";

const SHADE_PATH = (() => {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 20) pts.push(`${x},${shadeEdge(x).toFixed(1)}`);
  return `M${pts.join(" L")}`;
})();

/**
 * Paint with dots of pure colour, step back to watch them mix, and read what
 * you did. Then keep it: download it, or ask to hang it in the Community Gallery.
 */
export function DotPainting({ movement }: { movement: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<HTMLCanvasElement>(null);
  const dots = useRef<Dot[]>([]);
  /** Where each stroke began in `dots`, for undo. */
  const strokes = useRef<number[]>([]);
  const held = useRef<{ x: number; y: number; raf: number } | null>(null);

  const [main, setMain] = useState(5); // Green
  const [second, setSecond] = useState<number | null>(3); // Yellow
  const [share, setShare] = useState(35);
  const [size, setSize] = useState(5);
  const [spread, setSpread] = useState(50);
  const [start, setStart] = useState<Start>("sun-and-shade");
  const [back, setBack] = useState(0);
  const [reading, setReading] = useState<Reading>({ dots: 0, colours: 0, touches: [] });
  const [far, setFar] = useState<{ sun?: string; shade?: string }>({});
  const [canUndo, setCanUndo] = useState(false);

  const brush = useRef({ main, second, share, size, spread });
  useEffect(() => {
    brush.current = { main, second, share, size, spread };
  }, [main, second, share, size, spread]);

  const ctx = () => canvas.current?.getContext("2d") ?? null;

  const draw = (c: CanvasRenderingContext2D, d: Dot) => {
    c.fillStyle = PALETTE[d.c].hex;
    c.beginPath();
    c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    c.fill();
  };

  const redraw = useCallback(() => {
    const c = ctx();
    if (!c) return;
    c.fillStyle = GROUND;
    c.fillRect(0, 0, W, H);
    for (const d of dots.current) draw(c, d);
  }, []);

  /** Reads the painting: the dots, and how it looks shrunk to across-the-room size. */
  const read = useCallback(() => {
    const all = dots.current;
    const t = thumb.current;
    const src = canvas.current;
    let sun: Reading["sun"];
    let shade: Reading["shade"];
    const shaded = start === "sun-and-shade";
    if (t && src) {
      const tc = t.getContext("2d", { willReadFrequently: true })!;
      tc.imageSmoothingQuality = "high";
      tc.drawImage(src, 0, 0, TW, TH);
      if (shaded && all.length) {
        const px = tc.getImageData(0, 0, TW, TH).data;
        const at = (i: number) =>
          inShade(((i % TW) + 0.5) * (W / TW), (Math.floor(i / TW) + 0.5) * (H / TH));
        const sunC = averageOf(px, (i) => !at(i));
        const shadeC = averageOf(px, at);
        const sunDots = all.filter((d) => !inShade(d.x, d.y));
        const shadeDots = all.filter((d) => inShade(d.x, d.y));
        if (sunC && sunDots.length) sun = { colour: sunC, cool: coolShare(sunDots) };
        if (shadeC && shadeDots.length) shade = { colour: shadeC, cool: coolShare(shadeDots) };
      }
    }
    setReading({
      dots: all.length,
      colours: new Set(all.map((d) => d.c)).size,
      touches: touches(all),
      sun,
      shade,
    });
    setFar({ sun: sun && hex(sun.colour), shade: shade && hex(shade.colour) });
    setCanUndo(strokes.current.length > 0);
  }, [start]);

  useEffect(() => {
    redraw();
    read();
  }, [redraw, read]);

  /** Scatters `n` dots within `spread` of (x, y), in the brush's colours. */
  const spray = (x: number, y: number, n: number, spread = brush.current.spread) => {
    const c = ctx();
    if (!c) return;
    const b = brush.current;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      const d: Dot = {
        x: Math.min(W, Math.max(0, x + Math.cos(a) * r)),
        y: Math.min(H, Math.max(0, y + Math.sin(a) * r)),
        r: b.size * (0.8 + Math.random() * 0.4),
        c: b.second !== null && Math.random() * 100 < b.share ? b.second : b.main,
      };
      dots.current.push(d);
      draw(c, d);
    }
  };

  const toCanvas = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  // Holding still keeps spraying, slowly, like a brush dabbing in one place.
  const hold = () => {
    const h = held.current;
    if (!h) return;
    const b = brush.current;
    spray(h.x, h.y, Math.max(1, Math.round((b.spread / b.size) ** 2 * 0.025)));
    h.raf = requestAnimationFrame(hold);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    strokes.current.push(dots.current.length);
    const p = toCanvas(e);
    const b = brush.current;
    spray(p.x, p.y, Math.max(3, Math.round((b.spread / b.size) ** 2 * 0.08)));
    held.current = { ...p, raf: requestAnimationFrame(hold) };
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const h = held.current;
    if (!h) return;
    const p = toCanvas(e);
    const b = brush.current;
    const len = Math.hypot(p.x - h.x, p.y - h.y);
    const step = b.size * 2;
    const per = Math.max(1, Math.round((b.spread / b.size) * 0.7));
    for (let s = step; s <= len; s += step) {
      const t = s / len;
      spray(h.x + (p.x - h.x) * t, h.y + (p.y - h.y) * t, per);
    }
    if (len >= step) {
      h.x = p.x;
      h.y = p.y;
    }
  };

  const onUp = () => {
    const h = held.current;
    if (!h) return;
    cancelAnimationFrame(h.raf);
    held.current = null;
    read();
  };

  useEffect(() => () => cancelAnimationFrame(held.current?.raf ?? 0), []);

  /** Covers part of the canvas evenly, for a quick start (and for anyone painting by keyboard). */
  const fill = (where: "sun" | "shade" | "all") => {
    strokes.current.push(dots.current.length);
    const b = brush.current;
    const target = Math.round(((W * H) / (Math.PI * b.size * b.size)) * 0.9);
    let made = 0;
    for (let tries = 0; made < target && tries < target * 3; tries++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (where !== "all" && inShade(x, y) !== (where === "shade")) continue;
      // One dot at a time, through the brush, so the colours and sizes match it.
      spray(x, y, 1, 0);
      made++;
    }
    read();
  };

  const undo = () => {
    const from = strokes.current.pop();
    if (from === undefined) return;
    dots.current.length = from;
    redraw();
    read();
  };

  const clear = () => {
    dots.current = [];
    strokes.current = [];
    redraw();
    read();
  };

  const lines = describe(reading);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Start from</span>
        <Choice<Start>
          label="Start from"
          value={start}
          options={[
            { value: "sun-and-shade", label: "Sun and shade" },
            { value: "blank", label: "Blank canvas" },
          ]}
          onChange={setStart}
        />
      </div>

      <div className="relative -mt-4">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          role="img"
          aria-label={`Your dot painting: ${reading.dots} dots`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ filter: back ? `blur(${back}px)` : undefined }}
          className="block aspect-[3/2] w-full max-w-full cursor-crosshair touch-none shadow-[0_1rem_2rem_-1.25rem_rgb(0_0_0/0.45)]"
        />
        {start === "sun-and-shade" && (
          // The underdrawing: where the shadow falls. It isn't part of the painting you keep.
          <svg
            aria-hidden
            viewBox={`0 0 ${W} ${H}`}
            className="pointer-events-none absolute inset-0 size-full transition-opacity"
            style={{ opacity: back ? 0 : 0.55 }}
          >
            <path
              d={SHADE_PATH}
              fill="none"
              stroke="#3b3a36"
              strokeWidth="2.5"
              strokeDasharray="10 10"
            />
            <text x="40" y="90" fontSize="34" fill="#3b3a36" fontFamily="system-ui, sans-serif">
              sun
            </text>
            <text x="40" y={H - 50} fontSize="34" fill="#3b3a36" fontFamily="system-ui, sans-serif">
              shade
            </text>
          </svg>
        )}
      </div>

      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <PalettePicker
          label="Brush colour"
          value={main}
          onChange={(i) => i !== null && setMain(i)}
        />
        <PalettePicker label="Mixed in with it" value={second} onChange={setSecond} allowNone />
        {second !== null && (
          <Range
            label={`${PALETTE[second].name} dots in the brush`}
            value={share}
            min={5}
            max={95}
            step={5}
            onChange={setShare}
            valueText={`${share}%`}
          />
        )}
        <Range
          label="Dot size"
          value={size}
          min={3}
          max={10}
          step={0.5}
          onChange={setSize}
          valueText={`${size}`}
        />
        <Range
          label="Brush width"
          value={spread}
          min={15}
          max={120}
          step={5}
          onChange={setSpread}
          valueText={`${spread}`}
        />
        <Range
          label="Step back"
          value={back}
          min={0}
          max={8}
          step={0.5}
          onChange={setBack}
          valueText={back === 0 ? "Up close" : back < 4 ? "A few steps back" : "Across the room"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {start === "sun-and-shade" ? (
          <>
            <ActionButton onClick={() => fill("sun")}>Fill the sun</ActionButton>
            <ActionButton onClick={() => fill("shade")}>Fill the shade</ActionButton>
          </>
        ) : (
          <ActionButton onClick={() => fill("all")}>Fill the canvas</ActionButton>
        )}
        <ActionButton onClick={undo} disabled={!canUndo}>
          Undo
        </ActionButton>
        <ActionButton onClick={clear} disabled={!reading.dots}>
          Clear
        </ActionButton>
      </div>

      <section
        aria-labelledby="reading-title"
        className="grid gap-6 border-t border-line pt-6 sm:grid-cols-[auto_1fr]"
      >
        <figure className="m-0">
          <canvas
            ref={thumb}
            width={TW}
            height={TH}
            aria-hidden
            style={{ width: TW, height: TH }}
            className="block border border-black/10"
          />
          <figcaption className="mt-2 max-w-[150px] text-sm text-muted">
            From across the room
          </figcaption>
          {far.sun && far.shade && (
            <div className="mt-3 flex gap-3 text-sm text-muted">
              <Swatch colour={far.sun} label="Sun" />
              <Swatch colour={far.shade} label="Shade" />
            </div>
          )}
        </figure>
        <div className="min-w-0">
          <h3 id="reading-title" className="font-semibold">
            What you used
          </h3>
          <ul className="mt-2 space-y-2 leading-relaxed text-muted" aria-live="polite">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </section>

      <Keep movement={movement} canvas={canvas} dots={reading.dots} />
    </div>
  );
}

function Swatch({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-5 border border-black/10" style={{ background: colour }} />
      {label}
    </span>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-wall disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

const field = "mt-1 block w-full border border-line bg-transparent px-3 py-2";

/** Keep the painting: save it, or ask a curator to hang it in the Community Gallery. */
function Keep({
  movement,
  canvas,
  dots,
}: {
  movement: string;
  canvas: React.RefObject<HTMLCanvasElement | null>;
  dots: number;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const save = () => {
    const url = canvas.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "dots.png";
    a.click();
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const image = canvas.current?.toDataURL("image/jpeg", 0.9);
    if (!image || !dots) return;
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
        imageUrl: image,
        provider: "hand",
      }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setState("sent");
      setMessage(`Request received (#${String(json.id).slice(0, 8)}). A curator will review it.`);
    } else {
      setState("error");
      setMessage(json?.error ?? "Couldn't send it. Check your connection and try again.");
    }
  }

  return (
    <section aria-labelledby="keep-title" className="border-t border-line pt-6">
      <h3 id="keep-title" className="font-semibold">
        Keep it
      </h3>
      {state === "sent" ? (
        <p className="mt-3 bg-ink px-4 py-3 text-wall" role="status">
          {message}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Title
            <input
              name="title"
              required
              maxLength={120}
              defaultValue="Sun and Shade"
              className={field}
            />
          </label>
          <label className="text-sm font-semibold">
            Your name, as it should hang
            <input name="artist" required maxLength={80} className={field} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            A line about it (optional)
            <textarea name="statement" maxLength={1000} rows={2} className={field} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={!dots || state === "sending"}
              className="bg-ink px-4 py-2 text-sm font-semibold text-wall transition-colors hover:bg-accent disabled:opacity-40"
            >
              {state === "sending" ? "Sending…" : "Ask to hang it in the Community Gallery"}
            </button>
            <ActionButton onClick={save} disabled={!dots}>
              Download
            </ActionButton>
          </div>
          {state === "error" && (
            <p role="alert" className="text-sm text-accent sm:col-span-2">
              {message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
