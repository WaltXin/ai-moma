"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageFile } from "@/lib/museum/types";
import { Choice, Range, Toggle, useInView, useReducedMotion, useTilt, useWidth } from "./controls";

export type ReliefPiece = { id: string; title: string; views: [ImageFile, ImageFile] };

/** Folds across the relief. Real Agamographs use many more; a dozen keeps the folds readable. */
const FOLDS = 12;
/** How far the relief turns as the visitor walks from one side to the other. */
const MAX_TURN = 42;

/**
 * An Agamograph built as a real folded surface in 3D. Each fold has a
 * left-facing face carrying a strip of one picture and a right-facing face
 * carrying a strip of the other, so where you stand decides what you see.
 */
export function AgamographRelief({ pieces }: { pieces: ReliefPiece[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const width = useWidth(stage);
  const inView = useInView(stage);
  const reduced = useReducedMotion();

  const [pos, setPos] = useState(-0.85); // −1 far left … 1 far right
  const [touched, setTouched] = useState(false);
  const [folds, setFolds] = useState(false);
  const [pieceId, setPieceId] = useState(pieces[0]?.id);
  const piece = pieces.find((p) => p.id === pieceId) ?? pieces[0];

  const move = useCallback((p: number) => {
    setTouched(true);
    setPos(p);
  }, []);
  const tilt = useTilt(move);

  // Until the visitor moves, the relief sways slowly, like walking past it.
  useEffect(() => {
    if (touched || reduced || !inView) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      setPos(Math.sin(((t - t0) / 1000) * 0.6 - 1.1) * 0.9);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [touched, reduced, inView]);

  const size = Math.min(width, 560);
  const faces = useMemo(() => {
    if (!piece) return null;
    const w = size / FOLDS;
    const half = w / 2;
    // Steep folds: past about 30° to one side, the other picture's faces are hidden.
    const depth = w * 0.9;
    const len = Math.hypot(half, depth);
    const angle = (Math.atan2(depth, half) * 180) / Math.PI;
    const face = (src: string, i: number, shade: string) => ({
      position: "absolute" as const,
      top: 0,
      width: len + 0.5,
      height: size,
      transformOrigin: "0 50%",
      backfaceVisibility: "hidden" as const,
      backgroundImage: `${shade}, url(${src})`,
      backgroundSize: `100% 100%, ${FOLDS * len}px ${size}px`,
      backgroundPosition: `0 0, ${-i * len}px 0`,
    });
    return Array.from({ length: FOLDS }, (_, i) => [
      <div
        key={`a${i}`}
        style={{
          ...face(
            piece.views[0].src,
            i,
            "linear-gradient(90deg, rgb(0 0 0 / 0.22), transparent 70%)",
          ),
          left: i * w,
          transform: `rotateY(${-angle}deg)`,
        }}
      />,
      <div
        key={`b${i}`}
        style={{
          ...face(
            piece.views[1].src,
            i,
            "linear-gradient(90deg, transparent 30%, rgb(0 0 0 / 0.28))",
          ),
          left: i * w + half,
          transform: `translateZ(${depth}px) rotateY(${angle}deg)`,
        }}
      />,
    ]);
  }, [piece, size]);

  const where =
    pos < -0.35
      ? "From the left you see the first picture."
      : pos > 0.35
        ? "From the right you see the second."
        : "Straight on, strips of both.";

  return (
    <div className="space-y-6">
      <div
        ref={stage}
        className="w-full min-w-0 relative grid touch-pan-y place-items-center select-none"
        style={{ height: size, perspective: 1500 }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons > 0) {
            const r = e.currentTarget.getBoundingClientRect();
            move(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)));
          }
        }}
        role="img"
        aria-label={`${piece?.title}: a folded surface showing one picture from the left and another from the right.`}
      >
        <div
          style={{
            width: size,
            height: size,
            transformStyle: "preserve-3d",
            transform: `rotateY(${-pos * MAX_TURN}deg)`,
            transition: reduced ? undefined : "transform 120ms linear",
          }}
        >
          {faces}
        </div>
      </div>

      {folds && <PlanView pos={pos} />}

      <p className="text-lg font-semibold" aria-live="polite">
        {folds ? "From above: you see the faces turned toward you." : where}
      </p>

      <div className="grid gap-5">
        <Range
          label="Where you stand"
          value={pos}
          min={-1}
          max={1}
          step={0.01}
          onChange={move}
          valueText={pos < -0.35 ? "Left" : pos > 0.35 ? "Right" : "In front"}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Toggle pressed={folds} onChange={setFolds}>
            Show the folds
          </Toggle>
          {tilt.state === "off" && (
            <button
              type="button"
              onClick={tilt.enable}
              className="text-sm font-semibold underline underline-offset-4 hover:decoration-2"
            >
              Use phone tilt
            </button>
          )}
          {tilt.state === "on" && <span className="text-sm text-muted">Tilt your phone</span>}
        </div>
        {pieces.length > 1 && (
          <Choice
            label="Piece"
            value={piece.id}
            options={pieces.map((p) => ({ value: p.id, label: p.title }))}
            onChange={setPieceId}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The relief seen from above, as a diagram: the zig-zag of folds, where the
 * visitor stands, and which faces turn toward them. It moves with the relief.
 */
function PlanView({ pos }: { pos: number }) {
  const W = 600;
  const left = 40;
  const span = W - left * 2;
  const w = span / FOLDS;
  const half = w / 2;
  const back = 40;
  const front = back + half * 0.9 * 2; // same steepness as the relief
  const eye = { x: W / 2 + pos * (span / 2 + 20), y: 210 };

  const faces = Array.from({ length: FOLDS }, (_, i) => {
    const x = left + i * w;
    const a = { x1: x, y1: back, x2: x + half, y2: front, n: { x: -(front - back), y: half } };
    const b = { x1: x + half, y1: front, x2: x + w, y2: back, n: { x: front - back, y: half } };
    return [a, b].map((f, k) => {
      const mx = (f.x1 + f.x2) / 2;
      const my = (f.y1 + f.y2) / 2;
      const seen = f.n.x * (eye.x - mx) + f.n.y * (eye.y - my) > 0;
      return { ...f, k, mx, my, seen };
    });
  }).flat();

  return (
    <figure className="border border-line p-4">
      <svg
        viewBox={`0 0 ${W} 240`}
        className="w-full"
        role="img"
        aria-label="Plan view: a zig-zag of folds seen from above, with your position below it. Faces turned toward you are bright."
      >
        {faces
          .filter((f) => f.seen && f.k === (pos <= 0 ? 0 : 1))
          .filter((_, i) => i % 3 === 1)
          .map((f, i) => (
            <line
              key={`ray${i}`}
              x1={eye.x}
              y1={eye.y}
              x2={f.mx}
              y2={f.my}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeDasharray="3 4"
            />
          ))}
        {faces.map((f, i) => (
          <line
            key={i}
            x1={f.x1}
            y1={f.y1}
            x2={f.x2}
            y2={f.y2}
            stroke={f.k === 0 ? "#7fc8f8" : "#ff2e63"}
            strokeWidth={f.seen ? 4 : 2}
            strokeOpacity={f.seen ? 1 : 0.22}
            strokeLinecap="round"
          />
        ))}
        <g transform={`translate(${eye.x} ${eye.y})`}>
          <circle r={9} fill="currentColor" />
          <circle r={3.5} fill="#0d0d0f" />
        </g>
        <text x={left} y={20} fontSize={13} fill="#7fc8f8">
          Faces with the first picture
        </text>
        <text x={W - left} y={20} fontSize={13} fill="#ff2e63" textAnchor="end">
          Faces with the second
        </text>
        <text x={eye.x} y={236} fontSize={12} fill="currentColor" textAnchor="middle" opacity={0.7}>
          You
        </text>
      </svg>
    </figure>
  );
}
