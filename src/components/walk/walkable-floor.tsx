"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/gallery/wall-parts";
import type { Wall } from "@/components/gallery/walls";
import type { FloorPlan } from "@/lib/walk/floor-plan";
import {
  EYE,
  type Focus,
  type Vec,
  atElevator,
  collides,
  focusKey,
  forward,
  lookingAt,
  move,
  roomAt,
  route,
  spawnPose,
  viewpoint,
  yawToward,
} from "@/lib/walk/motion";
import type { MuseumScene } from "./scene";
import { mix } from "./textures";
import { ArtworkViewer, ElevatorPanel, RoomInfo } from "./walk-overlays";

/**
 * A floor you walk through in first person. Drag to look around; walk with
 * WASD / the arrow keys, the on-screen stick on phones, or by clicking the
 * floor. Click a painting to walk up to it; when you're in front of a
 * painting, an info stand or the lift, press E (or click it) to open it.
 *
 * The three.js scene (`scene.ts`) loads on demand, so the page shell and its
 * text arrive first. Movement and collisions come from `lib/walk/motion.ts`.
 */

/** Metres per second. */
const WALK = 1.7;
const RUN = 3.4;
const AUTO_WALK = 2.2;
/** Radians per second for the turn keys. */
const TURN = 1.9;
/** Radians per pixel dragged. */
const LOOK = 0.0042;
const MAX_PITCH = 0.75;
/** How far back the camera can step to show the visitor, in metres. */
const MAX_ZOOM = 3.4;
const THIRD_PERSON = 2.4;
/** Steps the camera from `from` toward `to`, snapping in and out of the visitor's eyes. */
const stepZoom = (from: number, to: number) => {
  const c = Math.max(0, Math.min(MAX_ZOOM, to));
  // Halfway inside your own head is no view at all: jump straight out, or straight back in.
  if (from === 0 && c > 0) return Math.max(c, 0.8);
  return c < 0.6 ? 0 : c;
};

const INTERACT_KEYS = new Set(["e", "Enter", " "]);
const MOVE_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Shift",
]);

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const approach = (a: number, b: number, step: number) => {
  const d = angleDiff(a, b);
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
};
const keyOf = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

type Mode = "loading" | "ready" | "unsupported";

export function WalkableFloor({ plan, wall }: { plan: FloorPlan; wall: Wall }) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MuseumScene | null>(null);

  const [mode, setMode] = useState<Mode>("loading");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [overlay, setOverlay] = useState<Focus | null>(null);
  const [place, setPlace] = useState("");
  const [hint, setHint] = useState(true);
  const [help, setHelp] = useState(false);
  const [touch, setTouch] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Walking state lives in a ref so the animation loop doesn't re-render React.
  const game = useRef<{
    pos: Vec;
    yaw: number;
    pitch: number;
    vel: Vec;
    keys: Set<string>;
    stick: { x: number; y: number };
    legs: Vec[];
    /** Which way to face once a click-to-walk arrives. */
    arrive: { yaw: number; pitch: number } | null;
    pending: Focus | null;
    stuck: number;
    stride: number;
    atLift: boolean;
    focus: Focus | null;
    hoverId: string | null;
    overlay: Focus | null;
    drag: { id: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null;
    /** A second finger on the screen: pinching steps the camera in and out. */
    pinch: { id: number; x: number; y: number; dist: number; zoom: number } | null;
    /** Camera distance behind the visitor, and where it's easing to. */
    zoom: number;
    zoomTo: number;
  }>(null);
  if (game.current == null) {
    const spawn = spawnPose(plan);
    game.current = {
      pos: spawn.at,
      yaw: spawn.yaw,
      pitch: 0,
      vel: { x: 0, z: 0 },
      keys: new Set(),
      stick: { x: 0, y: 0 },
      legs: [],
      arrive: null,
      pending: null,
      stuck: 0,
      stride: 0,
      atLift: false,
      focus: null,
      hoverId: null,
      overlay: null,
      drag: null,
      pinch: null,
      zoom: 0,
      zoomTo: 0,
    };
  }

  const open = useCallback((f: Focus | null) => {
    if (!f) return;
    const g = game.current!;
    g.keys.clear();
    g.stick = { x: 0, y: 0 };
    g.legs = [];
    g.pending = null;
    g.overlay = f;
    setOverlay(f);
  }, []);

  const close = useCallback(() => {
    game.current!.overlay = null;
    setOverlay(null);
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const roomArt = useCallback(
    (room: number) => plan.artworks.filter((a) => a.room === room),
    [plan.artworks],
  );

  const placeName = useCallback(
    (p: Vec) => {
      const room = roomAt(plan, p);
      if (room) return room.title;
      if (p.x >= plan.lounge.x && p.z < plan.rows - 5) return "Lounge";
      if (p.x < (plan.rooms[0]?.x ?? plan.lounge.x) - 1) return "Lift lobby";
      return "Corridor";
    },
    [plan],
  );

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Build the scene and run the walk.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const g = game.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    let scene: MuseumScene | null = null;

    const start = async () => {
      const [{ createMuseumScene }] = await Promise.all([
        import("./scene"),
        document.fonts?.ready.catch(() => undefined),
      ]);
      if (cancelled) return;
      const sans = getComputedStyle(container).fontFamily || "system-ui, sans-serif";
      const display =
        getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() ||
        sans;
      try {
        scene = createMuseumScene(canvas, { plan, wall, fonts: { sans, display } });
      } catch {
        setMode("unsupported");
        return;
      }
      sceneRef.current = scene;
      // Lets a browser console (or a test script) move the visitor around while developing.
      if (process.env.NODE_ENV === "development") Object.assign(window, { __walk: g });

      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        scene!.resize(width, height, Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(container);

      let last = performance.now();
      let lastPlace = "";
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const k = g.keys;

        if (!g.overlay) {
          g.yaw += ((k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0)) * TURN * dt;
        }
        let ahead =
          (k.has("w") || k.has("ArrowUp") ? 1 : 0) -
          (k.has("s") || k.has("ArrowDown") ? 1 : 0) -
          g.stick.y;
        let side = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + g.stick.x;
        const amount = Math.hypot(ahead, side);
        if (amount > 1) {
          ahead /= amount;
          side /= amount;
        }

        let want: Vec = { x: 0, z: 0 };
        if (g.overlay) {
          // Stand still while something is open.
        } else if (amount > 0.05) {
          g.legs = [];
          g.pending = null;
          g.arrive = null;
          const f = forward(g.yaw);
          const speed = k.has("Shift") ? RUN : WALK;
          want = {
            x: (f.x * ahead - f.z * side) * speed,
            z: (f.z * ahead + f.x * side) * speed,
          };
        } else if (g.legs.length) {
          const target = g.legs[0];
          const dx = target.x - g.pos.x;
          const dz = target.z - g.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.08) {
            g.legs.shift();
            if (!g.legs.length && g.pending) {
              const pending = g.pending;
              g.pending = null;
              open(pending);
            }
          } else {
            const speed = Math.min(AUTO_WALK, 0.4 + dist * 2.5);
            want = { x: (dx / dist) * speed, z: (dz / dist) * speed };
            // Look where you're going, unless you're looking around.
            const final = g.legs[g.legs.length - 1];
            const lookAhead = Math.hypot(final.x - g.pos.x, final.z - g.pos.z) > 1.2;
            if (!g.drag?.moved && lookAhead)
              g.yaw = approach(g.yaw, yawToward(g.pos, target), dt * 2.6);
          }
        } else if (g.arrive && !g.drag?.moved) {
          g.yaw = approach(g.yaw, g.arrive.yaw, dt * 3);
          g.pitch = approach(g.pitch, g.arrive.pitch, dt * 1.5);
          if (g.yaw === g.arrive.yaw && g.pitch === g.arrive.pitch) g.arrive = null;
        }

        const ease = 1 - Math.exp(-dt * 10);
        g.vel = { x: g.vel.x + (want.x - g.vel.x) * ease, z: g.vel.z + (want.z - g.vel.z) * ease };
        const before = g.pos;
        g.pos = move(plan, g.pos, { x: g.vel.x * dt, z: g.vel.z * dt });
        const moved = Math.hypot(g.pos.x - before.x, g.pos.z - before.z);
        g.stride += moved;

        // A route blocked by something gives up rather than walking on the spot.
        if (g.legs.length && moved < dt * 0.05) {
          g.stuck += dt;
          if (g.stuck > 0.6) {
            g.legs = [];
            g.pending = null;
          }
        } else g.stuck = 0;

        // Walking right up to the lift calls it.
        const atLift = atElevator(plan, g.pos);
        if (atLift && !g.atLift && !g.overlay) open({ kind: "elevator" });
        g.atLift = atLift;

        const f = g.overlay ? g.focus : lookingAt(plan, g.pos, g.yaw);
        if (focusKey(f) !== focusKey(g.focus)) {
          g.focus = f;
          setFocus(f);
        }
        const here = placeName(g.pos);
        if (here !== lastPlace) {
          lastPlace = here;
          setPlace(here);
        }

        const pace = Math.min(1, moved / dt / WALK);
        const bob = reduced ? 0 : Math.sin(g.stride * 4.2) * 0.022 * pace;
        g.zoom += (g.zoomTo - g.zoom) * (reduced ? 1 : Math.min(1, dt * 8));
        scene!.render({
          pos: g.pos,
          yaw: g.yaw,
          pitch: g.pitch,
          eye: EYE + bob,
          time: now / 1000,
          focusId: g.focus?.kind === "art" ? g.focus.art.id : null,
          hoverId: g.hoverId,
          marker: g.legs.length ? g.legs[g.legs.length - 1] : null,
          zoom: g.zoom,
          stride: g.stride,
          pace,
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // The on-screen controls depend on the device, so they appear with the scene.
      setTouch(window.matchMedia("(pointer: coarse)").matches);
      setCanFullscreen(Boolean(document.fullscreenEnabled));
      setMode("ready");
    };
    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [plan, wall, open, placeName]);

  // Keyboard.
  useEffect(() => {
    const g = game.current!;
    const isActive = () => {
      const el = document.activeElement;
      return !el || el === document.body || containerRef.current?.contains(el);
    };
    const onDown = (e: KeyboardEvent) => {
      if (g.overlay) {
        if (e.key === "Escape") return close();
        // Let sliders and buttons inside the overlay keep their own arrow keys.
        const inControl = e.target instanceof HTMLInputElement;
        if (
          !inControl &&
          g.overlay.kind === "art" &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight")
        ) {
          const art = g.overlay.art;
          const list = roomArt(art.room);
          const i = list.findIndex((a) => a.id === art.id);
          const next = list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
          open({ kind: "art", art: next });
        }
        return;
      }
      if (!isActive() || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = keyOf(e);
      if (MOVE_KEYS.has(key)) {
        if (key !== "Shift") e.preventDefault();
        g.keys.add(key);
        if (key !== "Shift") setHint(false);
      } else if (key === "v") {
        // Step out to see yourself, or back in.
        g.zoomTo = g.zoomTo > 0 ? 0 : THIRD_PERSON;
      } else if (INTERACT_KEYS.has(key) && g.focus) {
        e.preventDefault();
        open(g.focus);
      }
    };
    const onUp = (e: KeyboardEvent) => g.keys.delete(keyOf(e));
    const onBlur = () => g.keys.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [close, open, roomArt]);

  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  // The wheel steps the camera back to show the visitor (non-passive, so the page doesn't scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const g = game.current!;
      if (g.overlay) return;
      e.preventDefault();
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      g.zoomTo = stepZoom(g.zoomTo, g.zoomTo + step / 250);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  /** Walks to `at` around the walls, then turns to face `arrive` and opens `then`. */
  const walkTo = (at: Vec, arrive: { yaw: number; pitch: number } | null, then: Focus | null) => {
    const g = game.current!;
    const legs = route(plan, g.pos, at);
    if (!legs) return;
    g.legs = legs;
    g.arrive = arrive;
    g.pending = then;
    setHint(false);
  };

  const pickAt = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return (
      sceneRef.current?.pick(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ) ?? null
    );
  };

  const onClick = (clientX: number, clientY: number) => {
    const g = game.current!;
    const hit = pickAt(clientX, clientY);
    if (!hit) return;
    if ("focus" in hit) {
      const f = hit.focus;
      // Already standing in front of it: open it.
      if (focusKey(f) === focusKey(g.focus) && !g.legs.length) return open(f);
      const view = viewpoint(plan, f);
      walkTo(view.at, view, f.kind === "art" ? null : f);
      return;
    }
    // Walk to the floor spot, or as near it as there's room to stand.
    let target = hit.floor;
    for (let t = 0; t <= 1 && collides(plan, target); t += 0.1) {
      target = {
        x: hit.floor.x + (g.pos.x - hit.floor.x) * t,
        z: hit.floor.z + (g.pos.z - hit.floor.z) * t,
      };
    }
    if (!collides(plan, target)) walkTo(target, null, null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current!;
    if (g.overlay) return;
    if (g.drag && !g.pinch && e.pointerType === "touch") {
      const d = g.drag;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      g.pinch = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        dist: Math.hypot(e.clientX - d.x, e.clientY - d.y) || 1,
        zoom: g.zoomTo,
      };
      return;
    }
    if (g.drag) return;
    containerRef.current?.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    g.drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current!;
    const d = g.drag;
    const p = g.pinch;
    if (d && p && (d.id === e.pointerId || p.id === e.pointerId)) {
      const me = d.id === e.pointerId ? d : p;
      me.x = e.clientX;
      me.y = e.clientY;
      // Fingers apart: step in. Together: step back.
      const dist = Math.hypot(d.x - p.x, d.y - p.y) || 1;
      g.zoomTo = stepZoom(g.zoomTo, p.zoom + (p.dist - dist) / 80);
      return;
    }
    if (d && d.id === e.pointerId) {
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) {
        d.moved = true;
        g.arrive = null;
        setHint(false);
      }
      if (d.moved) {
        // Grab the view and drag it, like a photo sphere.
        g.yaw += (e.clientX - d.x) * LOOK;
        g.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, g.pitch + (e.clientY - d.y) * LOOK));
      }
      d.x = e.clientX;
      d.y = e.clientY;
      return;
    }
    if (e.pointerType !== "mouse" || g.overlay) return;
    const hit = pickAt(e.clientX, e.clientY);
    const f = hit && "focus" in hit ? hit.focus : null;
    g.hoverId = f?.kind === "art" ? f.art.id : null;
    e.currentTarget.style.cursor = f ? "pointer" : hit ? "crosshair" : "grab";
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>, click: boolean) => {
    const g = game.current!;
    const d = g.drag;
    if (g.pinch) {
      // Lifting either finger ends the pinch; whichever stays keeps looking around.
      if (g.pinch.id === e.pointerId) g.pinch = null;
      else if (d && d.id === e.pointerId) {
        g.drag = { ...d, id: g.pinch.id, x: g.pinch.x, y: g.pinch.y };
        g.pinch = null;
      }
      return;
    }
    if (!d || d.id !== e.pointerId) return;
    g.drag = null;
    if (click && !d.moved) onClick(e.clientX, e.clientY);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen().catch(() => {});
  };

  const focusLabel =
    focus?.kind === "art"
      ? focus.art.frames
        ? `View “${focus.art.title}” · walk past it to watch it change`
        : `View “${focus.art.title}” · ${focus.art.artist}`
      : focus?.kind === "room"
        ? `About “${focus.room.title}”`
        : focus?.kind === "elevator"
          ? "Take the elevator"
          : null;

  const background = mix(wall.wall, "#000000", 0.5);

  return (
    <div ref={shellRef} className={fullscreen ? "h-full w-full bg-black" : undefined}>
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label={`Floor ${plan.floor.level}, ${plan.floor.name}, in 3D. Use W and S or the up and down arrows to walk, A and D to step sideways, the left and right arrows to turn, and E to look at what's in front of you.`}
        className={`relative w-full overflow-hidden focus-visible:outline-line ${
          fullscreen ? "h-full" : "h-[max(420px,calc(100dvh-12rem))]"
        }`}
        style={{ background }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-grab touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e, false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-hidden
        />

        {mode === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <p className={`px-4 py-3 text-sm ${PLAQUE_BASE}`}>Opening the galleries…</p>
          </div>
        )}
        {mode === "unsupported" && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className={`max-w-sm px-5 py-4 text-sm leading-relaxed ${PLAQUE_BASE}`}>
              This browser can’t show the floor in 3D (WebGL is turned off or unavailable).{" "}
              <Link href={`/floors/${plan.floor.slug}`} className="font-semibold underline">
                See the floor as a guide
              </Link>{" "}
              instead.
            </div>
          </div>
        )}

        {mode === "ready" && (
          <>
            {/* Where you are aiming; E opens what's under it. */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full bg-white/80 shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              <p aria-live="polite" className={`${PLAQUE} max-w-[45%] truncate`}>
                {place}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHelp((h) => !h)}
                  aria-expanded={help}
                  className={`pointer-events-auto ${PLAQUE} hover:bg-ink hover:text-wall`}
                >
                  Controls
                </button>
                {canFullscreen && (
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={`pointer-events-auto ${PLAQUE} hover:bg-ink hover:text-wall`}
                  >
                    {fullscreen ? "Exit full screen" : "Full screen"}
                  </button>
                )}
                {!fullscreen && (
                  <Link
                    href={`/floors/${plan.floor.slug}`}
                    className={`pointer-events-auto ${PLAQUE} hover:bg-ink hover:text-wall max-sm:hidden`}
                  >
                    Floor guide
                  </Link>
                )}
              </div>
            </div>

            {(help || (hint && !focus)) && (
              <div
                className={`pointer-events-none absolute inset-x-0 flex justify-center px-3 ${touch ? "bottom-40" : "bottom-4"}`}
              >
                <div
                  className={`max-w-md px-4 py-3 text-center text-sm leading-relaxed ${PLAQUE_BASE}`}
                >
                  {touch ? (
                    <>
                      Drag to look around. Walk with the stick, or tap the floor to walk there. Tap
                      a painting to go up to it. Pinch to step back and see yourself.
                    </>
                  ) : (
                    <>
                      Drag to look around. Walk with <Kbd>W</Kbd>
                      <Kbd>A</Kbd>
                      <Kbd>S</Kbd>
                      <Kbd>D</Kbd> or the arrow keys (hold <Kbd>Shift</Kbd> to hurry), or click the
                      floor to walk there. Click a painting to go up to it, then press <Kbd>E</Kbd>.
                      Scroll (or <Kbd>V</Kbd>) to step back and see yourself.
                    </>
                  )}
                </div>
              </div>
            )}

            {focus && focusLabel && !overlay && (
              <div
                className={`absolute flex justify-center px-3 ${touch ? "right-0 bottom-6 left-36" : "inset-x-0 bottom-4"}`}
              >
                <button
                  type="button"
                  onClick={() => open(focus)}
                  className="inline-flex max-w-full items-center gap-2 bg-ink px-4 py-2.5 text-sm font-semibold text-wall shadow-lg transition-colors hover:bg-accent hover:text-white"
                >
                  {!touch && <Kbd>E</Kbd>}
                  <span className="truncate">{focusLabel}</span>
                  <Arrow />
                </button>
              </div>
            )}

            {touch && (
              <Stick
                onChange={(x, y) => {
                  game.current!.stick = { x, y };
                  if (x || y) setHint(false);
                }}
              />
            )}
          </>
        )}
      </div>

      {overlay?.kind === "art" && (
        <ArtworkViewer
          art={overlay.art}
          room={plan.rooms[overlay.art.room]}
          siblings={roomArt(overlay.art.room)}
          onNavigate={(art) => open({ kind: "art", art })}
          onClose={close}
        />
      )}
      {overlay?.kind === "room" && <RoomInfo room={overlay.room} onClose={close} />}
      {overlay?.kind === "elevator" && (
        <ElevatorPanel
          floors={plan.floors}
          current={plan.floor.slug}
          onChoose={(slug) => router.push(`/floors/${slug}/walk`)}
          onClose={close}
        />
      )}
    </div>
  );
}

/** A thumb stick for touch screens: push it the way you want to walk. */
function Stick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const R = 44;

  const update = (e: React.PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let x = e.clientX - (rect.left + rect.width / 2);
    let y = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(x, y);
    if (len > R) {
      x = (x / len) * R;
      y = (y / len) * R;
    }
    setKnob({ x, y });
    onChange(x / R, y / R);
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={base}
      role="presentation"
      className="absolute bottom-6 left-6 grid size-28 touch-none place-items-center rounded-full border border-white/40 bg-black/25 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (active.current !== null) return;
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="size-12 rounded-full bg-white/85 shadow-lg"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}

/** A wall plaque set over the view: the wall's own colors, solid, with a soft shadow. */
const PLAQUE_BASE = "bg-wall text-ink shadow-[0_0.5rem_1rem_-0.5rem_rgb(0_0_0/0.6)]";
const PLAQUE = `${PLAQUE_BASE} px-3.5 py-2 text-sm font-semibold transition-colors`;

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-grid min-w-6 place-items-center border border-current/40 px-1 font-mono text-xs leading-5">
      {children}
    </kbd>
  );
}
