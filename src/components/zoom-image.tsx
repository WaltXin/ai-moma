"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ImageFile } from "@/lib/museum/types";

/** A rectangle on screen, in CSS pixels from the viewport's top left. */
export type ScreenRect = { left: number; top: number; width: number; height: number };

export type ZoomImageHandle = {
  /** Shrinks the picture back into `to` (or fades it), then calls `done`. */
  leave(to: ScreenRect | null, done: () => void): void;
};

type View = { s: number; x: number; y: number };

const FLY_MS = 620;
const PAD = 24;

/**
 * A picture you can look into: scroll, pinch or double-click to zoom, drag to
 * move about. It shows `image` at once and swaps in the large `zoom` copy as
 * it arrives. Given `from`, it grows out of that rectangle (a painting on the
 * wall of the 3D walk) to fill the stage.
 */
export function ZoomImage({
  image,
  zoom,
  alt,
  from,
  ref,
}: {
  image: ImageFile;
  zoom?: ImageFile;
  alt: string;
  from?: ScreenRect | null;
  ref?: React.Ref<ZoomImageHandle>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<{ w: number; h: number; left: number; top: number } | null>(
    null,
  );
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [sharp, setSharp] = useState(false);
  /** Flying in or out: drawn over everything, unclipped, since the wall can be anywhere on screen. */
  const [flying, setFlying] = useState(Boolean(from));
  // The view as of the latest event; state follows it, to draw.
  const viewRef = useRef(view);
  const apply = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
  }, []);
  const tween = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    dist: number;
    s: number;
    mid: { x: number; y: number };
    view: View;
  } | null>(null);
  const lastTap = useRef(0);

  const big = zoom ?? image;
  const aspect = image.width / image.height;
  // Fit inside the stage, with a little air round it.
  const fit = stage
    ? (() => {
        const w = Math.max(1, stage.w - PAD * 2);
        const h = Math.max(1, stage.h - PAD * 2);
        return w / h > aspect ? { w: h * aspect, h } : { w, h: w / aspect };
      })()
    : null;
  // As far as twice the large copy's own pixels; vector pictures as far as you like.
  const maxS = fit
    ? Math.max(
        2,
        Math.min(
          16,
          big.src.endsWith(".svg")
            ? 10
            : ((big.width / fit.w) * 2) / (window.devicePixelRatio || 1),
        ),
      )
    : 4;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setStage({ w: r.width, h: r.height, left: r.left, top: r.top });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Keeps the picture from being dragged out of sight. */
  const clamp = useCallback(
    (v: View): View => {
      if (!fit || !stage) return v;
      const s = Math.min(maxS, Math.max(1, v.s));
      const w = fit.w * s;
      const h = fit.h * s;
      const mx = Math.max(0, (w - stage.w) / 2 + PAD);
      const my = Math.max(0, (h - stage.h) / 2 + PAD);
      return { s, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) };
    },
    [fit, stage, maxS],
  );

  const set = useCallback((v: View) => apply(clamp(v)), [apply, clamp]);

  /** Eases to a view, for buttons and double-clicks. */
  const glide = useCallback(
    (to: View) => {
      cancelAnimationFrame(tween.current);
      const start = viewRef.current;
      const end = clamp(to);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 320);
        const e = 1 - (1 - t) ** 3;
        apply({
          s: start.s + (end.s - start.s) * e,
          x: start.x + (end.x - start.x) * e,
          y: start.y + (end.y - start.y) * e,
        });
        if (t < 1) tween.current = requestAnimationFrame(step);
      };
      tween.current = requestAnimationFrame(step);
    },
    [apply, clamp],
  );

  /** Zooms by `factor`, keeping the point `p` (from the stage's centre) where it is. */
  const zoomAt = useCallback(
    (factor: number, p: { x: number; y: number }, base = viewRef.current, animate = false) => {
      const s = Math.min(maxS, Math.max(1, base.s * factor));
      const k = s / base.s;
      const next = { s, x: p.x - (p.x - base.x) * k, y: p.y - (p.y - base.y) * k };
      if (animate) glide(next);
      else set(next);
    },
    [glide, set, maxS],
  );

  const local = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  // The wheel zooms (non-passive, so the page behind doesn't scroll).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(tween.current);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // Trackpad pinches arrive as ctrl+wheel with small deltas; make them count.
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022)), local(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // + and − zoom, 0 shows the whole picture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomAt(1.6, { x: 0, y: 0 }, viewRef.current, true);
      else if (e.key === "-" || e.key === "_")
        zoomAt(1 / 1.6, { x: 0, y: 0 }, viewRef.current, true);
      else if (e.key === "0") glide({ s: 1, x: 0, y: 0 });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomAt, glide]);

  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  // The fly-in: start where the painting hangs, grow to fit the stage.
  const flew = useRef(false);
  useLayoutEffect(() => {
    const el = flyRef.current;
    if (!el || !fit || !stage || flew.current) return;
    flew.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = {
      left: stage.left + (stage.w - fit.w) / 2,
      top: stage.top + (stage.h - fit.h) / 2,
      width: fit.w,
      height: fit.h,
    };
    el.style.transition = "none";
    el.style.transform = from && !reduced ? toRect(target, from) : "scale(0.97)";
    el.style.opacity = from && !reduced ? "1" : "0";
    void el.offsetWidth;
    el.style.transition = `transform ${from ? FLY_MS : 260}ms cubic-bezier(0.2, 0.7, 0.1, 1), opacity 260ms ease-out`;
    el.style.transform = "none";
    el.style.opacity = "1";
    const t = window.setTimeout(() => setFlying(false), from ? FLY_MS : 0);
    return () => window.clearTimeout(t);
  }, [fit, stage, from]);

  useImperativeHandle(
    ref,
    () => ({
      leave(to, done) {
        const el = flyRef.current;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!el || !fit || !stage || reduced) return done();
        setFlying(true);
        const v = viewRef.current;
        // The box the transform works on, and where the picture is in it now, zoomed or not.
        const box = {
          left: stage.left + (stage.w - fit.w) / 2,
          top: stage.top + (stage.h - fit.h) / 2,
        };
        const now = {
          left: stage.left + stage.w / 2 + v.x - (fit.w * v.s) / 2,
          top: stage.top + stage.h / 2 + v.y - (fit.h * v.s) / 2,
          width: fit.w * v.s,
          height: fit.h * v.s,
        };
        el.style.transition = `transform ${to ? 420 : 200}ms cubic-bezier(0.4, 0, 0.6, 1), opacity ${to ? 420 : 200}ms ease-in`;
        if (to) el.style.transform = toRect(now, to, box);
        else el.style.opacity = "0";
        window.setTimeout(done, to ? 400 : 190);
      },
    }),
    [fit, stage],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(tween.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        s: viewRef.current.s,
        mid: local((a.x + b.x) / 2, (a.y + b.y) / 2),
        view: viewRef.current,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const g = gesture.current;
    if (g && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const factor = (Math.hypot(a.x - b.x, a.y - b.y) || 1) / g.dist;
      const s = Math.min(maxS, Math.max(1, g.s * factor));
      const k = s / g.view.s;
      // Pinch round where the fingers started, and follow them as they move.
      set({
        s,
        x: g.mid.x - (g.mid.x - g.view.x) * k + (mid.x - g.mid.x),
        y: g.mid.y - (g.mid.y - g.view.y) * k + (mid.y - g.mid.y),
      });
      return;
    }
    if (pointers.current.size === 1)
      set({ ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  const toggle = (clientX: number, clientY: number) => {
    if (viewRef.current.s > 1.4) glide({ s: 1, x: 0, y: 0 });
    else zoomAt(Math.min(3, maxS), local(clientX, clientY), viewRef.current, true);
  };

  // Double-tap on touch screens, where dblclick doesn't always fire.
  const onPointerUpTap = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const now = performance.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      toggle(e.clientX, e.clientY);
    } else lastTap.current = now;
  };

  const zoomed = view.s > 1.01;
  const w = fit ? fit.w * view.s : 0;
  const h = fit ? fit.h * view.s : 0;

  return (
    <div className={`absolute inset-0 select-none ${flying ? "z-10" : ""}`}>
      <div
        ref={stageRef}
        className={`absolute inset-0 touch-none ${flying ? "" : "overflow-hidden"} ${zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          onPointerUp(e);
          onPointerUpTap(e);
        }}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => toggle(e.clientX, e.clientY)}
      >
        {fit && (
          <div
            ref={flyRef}
            className="absolute top-1/2 left-1/2 origin-top-left"
            style={{ width: fit.w, height: fit.h, marginLeft: -fit.w / 2, marginTop: -fit.h / 2 }}
          >
            {/* Sized directly rather than scaled, so the browser draws the large copy sharp at every zoom. */}
            <div
              className="absolute shadow-[0_1.5rem_3rem_-1rem_rgb(0_0_0/0.8)]"
              style={{
                width: w,
                height: h,
                left: (fit.w - w) / 2 + view.x,
                top: (fit.h - h) / 2 + view.y,
              }}
            >
              {/* Local public-domain files and Studio SVGs; plain <img> so no optimizer resamples them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={alt}
                draggable={false}
                className="absolute inset-0 size-full"
              />
              {zoom && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={zoom.src}
                  alt=""
                  aria-hidden
                  draggable={false}
                  decoding="async"
                  onLoad={() => setSharp(true)}
                  className={`absolute inset-0 size-full transition-opacity duration-500 ${sharp ? "opacity-100" : "opacity-0"}`}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
        <p className="pointer-events-none hidden text-xs text-white/60 sm:block" aria-hidden>
          {zoomed
            ? "Drag to look around · double-click to see it whole"
            : "Scroll, pinch or double-click to look closer"}
        </p>
        <div className="pointer-events-auto ml-auto flex overflow-hidden rounded-full bg-black/60 text-white backdrop-blur">
          <ZoomButton
            label="Zoom out"
            disabled={!zoomed}
            onClick={() => zoomAt(1 / 1.6, { x: 0, y: 0 }, viewRef.current, true)}
          >
            <path d="M3 8h10" />
          </ZoomButton>
          <ZoomButton
            label="Zoom in"
            disabled={view.s >= maxS - 0.01}
            onClick={() => zoomAt(1.6, { x: 0, y: 0 }, viewRef.current, true)}
          >
            <path d="M3 8h10M8 3v10" />
          </ZoomButton>
          <ZoomButton
            label="See the whole picture"
            disabled={!zoomed}
            onClick={() => glide({ s: 1, x: 0, y: 0 })}
          >
            <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
          </ZoomButton>
        </div>
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        {children}
      </svg>
    </button>
  );
}

/**
 * A transform that lays rectangle `a` over rectangle `b`, for an element
 * whose transform origin (its top left) is at `origin` (by default, `a`'s).
 */
function toRect(a: ScreenRect, b: ScreenRect, origin: { left: number; top: number } = a): string {
  const sx = b.width / Math.max(1, a.width);
  const sy = b.height / Math.max(1, a.height);
  const tx = b.left - origin.left - sx * (a.left - origin.left);
  const ty = b.top - origin.top - sy * (a.top - origin.top);
  return `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
}
