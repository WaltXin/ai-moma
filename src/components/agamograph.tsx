"use client";

import { useEffect, useId, useState } from "react";
import type { ImageFile } from "@/lib/museum/types";

/**
 * A virtual Agamograph: a lenticular piece that shows a different image from
 * each viewing angle. Move the pointer across it, drag on touch screens, tilt
 * the phone, or use the slider. Between two views, the next one appears in
 * thin vertical strips, like the folds of a real print.
 */
export function Agamograph({
  frames,
  alt,
  className = "",
  showControls = true,
}: {
  frames: ImageFile[];
  alt: string;
  className?: string;
  showControls?: boolean;
}) {
  const max = frames.length - 1;
  const [position, setPosition] = useState(0);
  const [tilt, setTilt] = useState<"off" | "on" | "unavailable">("off");
  const sliderId = useId();

  useEffect(() => {
    if (tilt !== "on") return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null) return;
      // Phone tilted 30° left → first view, 30° right → last view.
      const t = Math.max(0, Math.min(1, (e.gamma + 30) / 60));
      setPosition(t * max);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [tilt, max]);

  const enableTilt = async () => {
    const DOE = window.DeviceOrientationEvent as
      (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }) | undefined;
    if (!DOE) return setTilt("unavailable");
    try {
      if (DOE.requestPermission && (await DOE.requestPermission()) !== "granted") {
        return setTilt("unavailable");
      }
      setTilt("on");
    } catch {
      setTilt("unavailable");
    }
  };

  const base = Math.min(max, Math.floor(position));
  const frac = position - base;
  const period = 18;
  const reveal = frac * period;
  const mask = `repeating-linear-gradient(90deg, #000 0, #000 ${reveal}px, transparent ${reveal}px, transparent ${period}px)`;
  const { width, height } = frames[0];

  return (
    <div className={className}>
      <div
        className="relative w-full touch-pan-y select-none"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons > 0 || e.pointerType === "touch") {
            const rect = e.currentTarget.getBoundingClientRect();
            const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setPosition(t * max);
          }
        }}
        role="img"
        aria-label={`${alt}. A lenticular image with ${frames.length} views.`}
      >
        {frames.map((f, i) => {
          const visible = i === base || (i === base + 1 && frac > 0);
          return (
            // Generated SVG frames; plain <img> keeps them stacked at natural size.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.src}
              src={f.src}
              width={f.width}
              height={f.height}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                opacity: visible ? 1 : 0,
                ...(i === base + 1 ? { maskImage: mask, WebkitMaskImage: mask } : {}),
              }}
            />
          );
        })}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${period - 1}px, rgba(0,0,0,0.08) ${period - 1}px, rgba(0,0,0,0.08) ${period}px)`,
          }}
        />
      </div>
      {showControls && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          <label htmlFor={sliderId}>Viewing angle</label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={max}
            step={0.01}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="min-w-32 flex-1 accent-[var(--accent)]"
          />
          {tilt === "off" && (
            <button
              type="button"
              onClick={enableTilt}
              className="border border-line px-2 py-1 font-medium text-ink hover:border-ink"
            >
              Use phone tilt
            </button>
          )}
          {tilt === "on" && <span>Tilt your phone</span>}
          {tilt === "unavailable" && <span>Tilt isn&apos;t available here</span>}
        </div>
      )}
    </div>
  );
}
