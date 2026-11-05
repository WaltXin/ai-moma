"use client";

import { useEffect, useRef, useState } from "react";
import { Choice, Range, Toggle, useInView, useReducedMotion, useWidth } from "./controls";

type Pattern = "rings" | "rays";

const TOP_SCALE = 1.5;

/** Draws one plain grating: evenly spaced rings or rays around the center. */
function drawGrating(canvas: HTMLCanvasElement, size: number, pattern: Pattern, gap: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = getComputedStyle(canvas).color;
  const c = size / 2;
  if (pattern === "rings") {
    ctx.lineWidth = gap * 0.45;
    for (let r = gap; r < size * 0.75; r += gap) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const rays = Math.round(720 / gap);
    const reach = size * 0.75;
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2;
      const a1 = a0 + (Math.PI / rays) * 0.9;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, reach, a0, a1);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  }
}

/**
 * Two identical gratings, one over the other. Sliding the top one makes
 * broad waves appear that neither layer contains: moiré, the interference
 * Op artists used to make a still surface shimmer.
 */
export function MoireStation() {
  const stage = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const top = useRef<HTMLCanvasElement>(null);
  const width = useWidth(stage);
  const inView = useInView(stage);
  const reduced = useReducedMotion();
  const size = Math.min(width, 560);

  const [pattern, setPattern] = useState<Pattern>("rings");
  const [gap, setGap] = useState(9);
  const [lift, setLiftState] = useState(false);
  // Ease while the layer lifts or lands; otherwise follow the pointer directly.
  const [turning, setTurning] = useState(false);
  const setLift = (next: boolean) => {
    setLiftState(next);
    setTurning(true);
    window.setTimeout(() => setTurning(false), 800);
  };
  const ease = reduced ? undefined : "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)";
  const [offset, setOffset] = useState({ x: 26, y: 12 });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (base.current) drawGrating(base.current, size, pattern, gap);
    // The top layer is drawn larger, so sliding it never shows its edge.
    if (top.current) drawGrating(top.current, size * TOP_SCALE, pattern, gap);
  }, [size, pattern, gap]);

  // A slow drift until the visitor takes over.
  useEffect(() => {
    if (touched || reduced || !inView) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const s = (t - t0) / 1000;
      setOffset({ x: Math.cos(s * 0.5) * 34, y: Math.sin(s * 0.7) * 20 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [touched, reduced, inView]);

  const reach = size * 0.18;
  return (
    <div className="space-y-6">
      <div
        ref={stage}
        className="w-full min-w-0 relative grid touch-pan-y place-items-center select-none"
        style={{ height: size, perspective: 1400 }}
        onPointerMove={(e) => {
          if (lift || !(e.pointerType === "mouse" || e.buttons > 0)) return;
          const r = e.currentTarget.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          setTouched(true);
          setOffset({ x: nx * reach * 2, y: ny * reach * 2 });
        }}
        role="img"
        aria-label="Two identical patterns of lines laid over each other. Where they cross, broad waves appear."
      >
        <div
          className="relative"
          style={{
            width: size,
            height: size,
            transformStyle: "preserve-3d",
            transition: ease,
            transform: lift ? "rotateX(58deg) rotateZ(-24deg) scale(0.78)" : "none",
          }}
        >
          <div
            className={`absolute inset-0 ${lift ? "outline outline-1 outline-line" : "overflow-hidden"}`}
            style={{ transformStyle: "preserve-3d" }}
          >
            <canvas
              ref={base}
              className="absolute inset-0 text-ink"
              style={{ width: size, height: size }}
            />
            {/* The top layer: a square the size of the base, lifted in 3D on request. */}
            <div
              className={`absolute inset-0 overflow-hidden ${lift ? "outline outline-1 outline-line" : ""}`}
              style={{
                transform: `translateZ(${lift ? size * 0.32 : 0}px)`,
                transition: turning ? ease : undefined,
              }}
            >
              <canvas
                ref={top}
                className="absolute text-ink"
                style={{
                  width: size * TOP_SCALE,
                  height: size * TOP_SCALE,
                  left: (size - size * TOP_SCALE) / 2,
                  top: (size - size * TOP_SCALE) / 2,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <p className="text-lg font-semibold" aria-live="polite">
        {lift
          ? "Two plain patterns. No waves on either one."
          : "Waves where the lines cross. Slide the top layer and they move."}
      </p>

      <div className="grid gap-5">
        <Range
          label="Line spacing"
          value={gap}
          min={6}
          max={16}
          step={1}
          onChange={setGap}
          valueText={`${gap}px`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Toggle pressed={lift} onChange={setLift}>
            Lift the top layer
          </Toggle>
          <Choice
            label="Pattern"
            value={pattern}
            options={[
              { value: "rings", label: "Rings" },
              { value: "rays", label: "Rays" },
            ]}
            onChange={setPattern}
          />
        </div>
      </div>
    </div>
  );
}
