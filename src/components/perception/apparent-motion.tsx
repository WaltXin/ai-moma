"use client";

import { useEffect, useRef, useState } from "react";
import { Choice, Range, useInView, useReducedMotion, useWidth } from "./controls";

type Layout = "pair" | "ring";

const SLOWEST = 1000; // ms between flashes
const FASTEST = 60;

/** Slider position (0–1) to milliseconds, on a log scale so the interesting range gets room. */
const msAt = (v: number) => Math.round(SLOWEST * (FASTEST / SLOWEST) ** v);

/**
 * Lights that only switch on and off, one after another. Slow, they are
 * separate blinks; faster, most people see one light moving between them.
 * Film, flip-books and much kinetic art rely on this apparent motion.
 * The lights are small and never fill the view, so nothing flashes broadly.
 */
export function ApparentMotion() {
  const stage = useRef<HTMLDivElement>(null);
  const width = useWidth(stage);
  const inView = useInView(stage);
  const reduced = useReducedMotion();
  const size = Math.min(width, 560);

  const [layout, setLayout] = useState<Layout>("pair");
  const [speed, setSpeed] = useState(0.15);
  // Plays on its own unless the visitor asked for less motion; their choice wins after that.
  const [choice, setChoice] = useState<boolean | null>(null);
  const playing = choice ?? !reduced;
  const [lit, setLit] = useState(0);
  const ms = msAt(speed);
  const count = layout === "pair" ? 2 : 12;
  const running = playing && inView;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLit((i) => (i + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [running, ms, count]);

  const dots = Array.from({ length: count }, (_, i) => {
    if (layout === "pair") return { x: i === 0 ? 0.32 : 0.68, y: 0.5 };
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: 0.5 + Math.cos(a) * 0.34, y: 0.5 + Math.sin(a) * 0.34 };
  });
  const r = size * (layout === "pair" ? 0.06 : 0.04);

  const reading = !playing
    ? "Paused. Press play to start the lights."
    : ms >= 400
      ? layout === "pair"
        ? "Two separate blinks: one light, then the other."
        : "Separate blinks, one light after another."
      : ms >= 90
        ? layout === "pair"
          ? "Most people now see one light jumping across."
          : "Most people now see one light running round the ring."
        : "Very fast: the lights may seem to flicker together.";

  return (
    <div className="space-y-6">
      <div ref={stage} className="grid w-full min-w-0 place-items-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${count} small lights that switch on one after another, ${ms} milliseconds apart.`}
        >
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x * size}
              cy={d.y * size}
              r={r}
              fill={i === lit % count ? "currentColor" : "none"}
              stroke="currentColor"
              strokeOpacity={i === lit % count ? 1 : 0.25}
              strokeWidth={1.5}
              className="text-ink"
            />
          ))}
        </svg>
      </div>

      <p className="text-lg font-semibold" aria-live="polite">
        {reading}
      </p>

      <div className="grid gap-5">
        <Range
          label="Time between flashes"
          value={speed}
          min={0}
          max={1}
          step={0.01}
          onChange={setSpeed}
          valueText={`${ms} ms`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setChoice(!playing)}
            aria-pressed={!playing}
            className="border border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-wall"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <Choice
            label="Lights"
            value={layout}
            options={[
              { value: "pair", label: "Two lights" },
              { value: "ring", label: "A ring of twelve" },
            ]}
            onChange={(v) => {
              setLayout(v);
              setLit(0);
            }}
          />
        </div>
      </div>
    </div>
  );
}
