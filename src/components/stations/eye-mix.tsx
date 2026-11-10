"use client";

import { useEffect, useRef, useState } from "react";
import { Range, useWidth } from "@/components/perception/controls";
import { eyeMix, hex, PALETTE, paintMix } from "@/lib/stations/dots";
import { PalettePicker } from "./palette-picker";

/** A repeatable 0–1 number for a grid cell, so the dots stay put as you step back. */
const noise = (i: number, j: number, k: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Two colours as dots, side by side. Step back and they become one colour,
 * shown next to the same two paints stirred together on a palette.
 */
export function EyeMix() {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(box, 480);
  const [a, setA] = useState(3); // Yellow
  const [b, setB] = useState(0); // Vermilion
  const [share, setShare] = useState(50);
  const [distance, setDistance] = useState(1);

  const height = Math.round(width * 0.62);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(width * dpr);
    el.height = Math.round(height * dpr);
    const ctx = el.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ece4d2";
    ctx.fillRect(0, 0, width, height);
    // Dots shrink as you step back, as they do across a room: too small to tell apart, they blend.
    // (Further back, a slight blur on the canvas does what the screen's pixels can't.)
    const r = 7 / distance;
    const gap = r * 2.05;
    const colours = [PALETTE[a].hex, PALETTE[b].hex];
    for (let j = 0; j * gap * 0.87 < height + gap; j++) {
      for (let i = 0; i * gap < width + gap; i++) {
        const x = i * gap + (j % 2 ? gap / 2 : 0) + (noise(i, j, 1) - 0.5) * r * 0.5;
        const y = j * gap * 0.87 + (noise(i, j, 2) - 0.5) * r * 0.5;
        ctx.fillStyle = colours[noise(i, j, 3) * 100 < share ? 1 : 0];
        if (r < 1.2) ctx.fillRect(x - r, y - r, r * 2, r * 2);
        else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [width, height, a, b, share, distance]);

  const parts = [
    { hex: PALETTE[a].hex, weight: 100 - share },
    { hex: PALETTE[b].hex, weight: share },
  ];
  const far = distance >= 6;

  return (
    <div className="grid gap-6">
      <div ref={box} className="relative min-w-0 overflow-hidden">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Dots of ${PALETTE[a].name.toLowerCase()} and ${PALETTE[b].name.toLowerCase()}, ${far ? "seen from across the room" : "seen up close"}`}
          style={{ width, height, filter: distance > 3 ? `blur(${((distance - 3) * 0.12).toFixed(2)}px)` : undefined }}
          className="block shadow-[0_1rem_2rem_-1.25rem_rgb(0_0_0/0.45)]"
        />
      </div>

      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Range
          label="Step back"
          value={distance}
          min={1}
          max={10}
          step={0.1}
          onChange={setDistance}
          valueText={
            distance < 2 ? "Up close" : distance < 6 ? "A few steps back" : "Across the room"
          }
        />
        <Range
          label={`${PALETTE[b].name} dots`}
          value={share}
          min={0}
          max={100}
          step={5}
          onChange={setShare}
          valueText={`${share}%`}
        />
        <PalettePicker label="First colour" value={a} onChange={(i) => i !== null && setA(i)} />
        <PalettePicker label="Second colour" value={b} onChange={(i) => i !== null && setB(i)} />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-line pt-5">
        <Mixed label="Stirred together on a palette" colour={hex(paintMix(parts))} />
        <Mixed label="Mixed in your eye, from across the room" colour={hex(eyeMix(parts))} />
      </div>
    </div>
  );
}

function Mixed({ label, colour }: { label: string; colour: string }) {
  return (
    <figure className="m-0">
      <div className="h-16 border border-black/10" style={{ background: colour }} />
      <figcaption className="mt-2 text-sm text-muted">{label}</figcaption>
    </figure>
  );
}
