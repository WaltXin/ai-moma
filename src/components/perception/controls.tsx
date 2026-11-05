"use client";

import { type RefObject, useEffect, useId, useState } from "react";

/** True when the visitor asked their system for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** True while the element is on screen, so animations can rest off-screen. */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      rootMargin: "100px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

/** Width of an element, kept up to date. */
export function useWidth(ref: RefObject<Element | null>, fallback = 320): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** A labelled slider in the wall's ink. */
export function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueText,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  valueText?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {valueText && (
          <span className="text-muted tabular-nums" aria-hidden>
            {valueText}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full [accent-color:var(--ink)]"
      />
    </div>
  );
}

/** A switch-like button: outlined when off, filled with ink when on. */
export function Toggle({
  pressed,
  onChange,
  children,
}: {
  pressed: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className="border border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-wall aria-pressed:bg-ink aria-pressed:text-wall"
    >
      {children}
    </button>
  );
}

/** One choice among a few, as a row of buttons. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="border border-line px-3 py-1.5 text-sm font-semibold transition-colors hover:border-ink aria-checked:border-ink aria-checked:bg-ink aria-checked:text-wall"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Asks for device orientation (iOS needs permission) and reports left–right tilt as −1…1. */
export function useTilt(onTilt: (pos: number) => void) {
  const [state, setState] = useState<"off" | "on" | "unavailable">("off");
  useEffect(() => {
    if (state !== "on") return;
    const handle = (e: DeviceOrientationEvent) => {
      if (e.gamma === null) return;
      onTilt(Math.max(-1, Math.min(1, e.gamma / 30)));
    };
    window.addEventListener("deviceorientation", handle);
    return () => window.removeEventListener("deviceorientation", handle);
  }, [state, onTilt]);

  const enable = async () => {
    const DOE = window.DeviceOrientationEvent as
      (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }) | undefined;
    if (!DOE) return setState("unavailable");
    try {
      if (DOE.requestPermission && (await DOE.requestPermission()) !== "granted") {
        return setState("unavailable");
      }
      setState("on");
    } catch {
      setState("unavailable");
    }
  };
  return { state, enable };
}
