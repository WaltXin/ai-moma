"use client";

import { useEffect, useRef, useState } from "react";
import { Range, Toggle, useInView, useReducedMotion, useWidth } from "./controls";

const CELLS = 14;
/** Points per cell edge, so warped edges curve smoothly. */
const STEPS = 6;

type Point = { x: number; y: number };

/**
 * Pushes points away from the center by an amount that fades with distance:
 * squares near the center grow and squares around them squeeze, which the
 * eye reads as a surface bulging toward it.
 */
function warp(p: Point, c: Point, swell: number, size: number): Point {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const r = Math.hypot(dx, dy) / size;
  const k = 1 + swell * 0.9 * Math.exp(-((r / 0.26) ** 2));
  return { x: c.x + dx * k, y: c.y + dy * k };
}

function draw(
  canvas: HTMLCanvasElement,
  size: number,
  center: Point,
  swell: number,
  showFlat: boolean,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(size * dpr)) {
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ink = getComputedStyle(canvas).color;
  ctx.fillStyle = "#0d0d0f";
  ctx.fillRect(0, 0, size, size);
  const cell = size / CELLS;
  const c = { x: center.x * size, y: center.y * size };
  const at = (gx: number, gy: number) => warp({ x: gx * cell, y: gy * cell }, c, swell, size);

  ctx.fillStyle = ink;
  for (let gy = 0; gy < CELLS; gy++) {
    for (let gx = 0; gx < CELLS; gx++) {
      if ((gx + gy) % 2) continue;
      ctx.beginPath();
      // Walk the square's four edges through the warp.
      const edge = (x0: number, y0: number, x1: number, y1: number, first: boolean) => {
        for (let s = first ? 0 : 1; s <= STEPS; s++) {
          const t = s / STEPS;
          const p = at(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
          if (first && s === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      };
      edge(gx, gy, gx + 1, gy, true);
      edge(gx + 1, gy, gx + 1, gy + 1, false);
      edge(gx + 1, gy + 1, gx, gy + 1, false);
      edge(gx, gy + 1, gx, gy, false);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (showFlat) {
    ctx.strokeStyle = "#ff2e63";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= CELLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
  }
}

/**
 * A checkerboard that swells toward the pointer. Nothing is shaded and
 * nothing is curved: only the sizes of flat squares change, and the eye
 * builds a bulge out of that, as in the distorted grids of Op Art.
 */
export function SwellingGrid() {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(stage);
  const inView = useInView(stage);
  const reduced = useReducedMotion();
  const size = Math.min(width, 560);

  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [swell, setSwell] = useState(0.85);
  const [showFlat, setShowFlat] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    const raf = requestAnimationFrame(() => draw(canvas.current!, size, center, swell, showFlat));
    return () => cancelAnimationFrame(raf);
  }, [size, center, swell, showFlat]);

  // The bulge wanders slowly until the visitor takes over.
  useEffect(() => {
    if (touched || reduced || !inView) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const s = (t - t0) / 1000;
      setCenter({ x: 0.5 + Math.cos(s * 0.45) * 0.18, y: 0.5 + Math.sin(s * 0.6) * 0.14 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [touched, reduced, inView]);

  return (
    <div className="space-y-6">
      <div ref={stage} className="grid w-full min-w-0 place-items-center">
        <canvas
          ref={canvas}
          className="touch-pan-y text-ink select-none"
          style={{ width: size, height: size }}
          onPointerMove={(e) => {
            if (!(e.pointerType === "mouse" || e.buttons > 0)) return;
            const r = e.currentTarget.getBoundingClientRect();
            setTouched(true);
            setCenter({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
          }}
          role="img"
          aria-label="A black and white checkerboard whose squares grow around one point, so the flat grid seems to bulge."
        />
      </div>

      <p className="text-lg font-semibold" aria-live="polite">
        {swell < 0.08
          ? "Flat: every square the same."
          : showFlat
            ? "The pink lines are the grid it started as."
            : "It bulges toward you, but nothing here is curved or shaded."}
      </p>

      <div className="grid gap-5">
        <Range
          label="Swell"
          value={swell}
          min={0}
          max={1}
          step={0.01}
          onChange={setSwell}
          valueText={swell < 0.08 ? "Flat" : `${Math.round(swell * 100)}%`}
        />
        <div>
          <Toggle pressed={showFlat} onChange={setShowFlat}>
            Show the flat grid
          </Toggle>
        </div>
      </div>
    </div>
  );
}
