"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FRAME_W,
  type FloorPlan,
  type PlanArtwork,
  type PlanRoom,
  ROW,
  TILE,
  canSee,
  findPath,
  isElevatorTile,
  isWalkable,
  tileAt,
} from "@/lib/walk/floor-plan";
import { type Camera, type Visitor, drawScene, frameKey } from "./draw";
import { ArtworkViewer, ElevatorPanel, RoomInfo } from "./walk-overlays";

/**
 * A Gather-style walkable floor. The visitor moves tile by tile with the
 * keyboard, or walks to wherever you click or tap. Standing in front of a
 * painting, a room's info stand or the elevator shows a prompt; pressing E
 * (or clicking the thing) opens it.
 */

export type Focus =
  { kind: "art"; art: PlanArtwork } | { kind: "room"; room: PlanRoom } | { kind: "elevator" };

type Point = { x: number; y: number };
type Dir = Visitor["dir"];

/** Tiles per second. */
const SPEED = 6.5;

const MOVE_KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};
const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const INTERACT_KEYS = new Set(["e", "E", "Enter", " "]);

const focusKey = (f: Focus | null) =>
  !f ? "" : f.kind === "art" ? f.art.id : f.kind === "room" ? `room:${f.room.slug}` : "elevator";

function dirBetween(a: Point, b: Point): Dir {
  if (b.x > a.x) return "right";
  if (b.x < a.x) return "left";
  return b.y > a.y ? "down" : "up";
}

export function WalkableFloor({ plan }: { plan: FloorPlan }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [focus, setFocus] = useState<Focus | null>(null);
  const [overlay, setOverlay] = useState<Focus | null>(null);
  const [hint, setHint] = useState(true);
  const [help, setHelp] = useState(false);

  // Game state lives in refs so the animation loop doesn't re-render React.
  const game = useRef({
    pos: { ...plan.spawn } as Point,
    next: null as Point | null,
    progress: 0,
    dir: "down" as Dir,
    path: [] as Point[],
    pending: null as Focus | null,
    held: [] as Dir[],
    focus: null as Focus | null,
    hoverId: null as string | null,
    overlay: null as Focus | null,
    cam: { x: 0, y: 0, zoom: 1, dpr: 1, w: 0, h: 0 } as Camera,
  });

  const open = useCallback((f: Focus | null) => {
    if (!f) return;
    const g = game.current;
    g.held = [];
    g.path = [];
    g.pending = null;
    g.overlay = f;
    setOverlay(f);
  }, []);

  const close = useCallback(() => {
    game.current.overlay = null;
    setOverlay(null);
    containerRef.current?.focus();
  }, []);

  const roomArt = useCallback(
    (room: number) => plan.artworks.filter((a) => a.room === room),
    [plan.artworks],
  );

  /** What the visitor is standing in front of. */
  const focusAt = useCallback(
    (p: Point): Focus | null => {
      const art = plan.artworks.find((a) => canSee(a, p.x, p.y));
      if (art) return { kind: "art", art };
      if (isElevatorTile(plan, p.x, p.y)) return { kind: "elevator" };
      const room = plan.rooms.find(
        (r) => Math.abs(r.pedestal.x - p.x) <= 1 && Math.abs(r.pedestal.y - p.y) <= 1,
      );
      if (room) return { kind: "room", room };
      return null;
    },
    [plan],
  );

  // Preload artwork images.
  const images = useRef(new Map<string, HTMLImageElement>());
  useEffect(() => {
    const load = (key: string, src: string) => {
      if (images.current.has(key)) return;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      images.current.set(key, img);
    };
    for (const art of plan.artworks) {
      if (art.frames) art.frames.forEach((f, i) => load(frameKey(art.id, i), f.src));
      else if (art.image) load(art.id, art.image.src);
    }
  }, [plan.artworks]);

  // Size the canvas to its container.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const cam = game.current.cam;
      cam.w = width;
      cam.h = height;
      cam.dpr = dpr;
      // Fit the whole floor height; scroll sideways.
      cam.zoom = Math.max(0.75, Math.min(2.4, height / (plan.rows * TILE)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [plan.rows]);

  // Animation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const font = getComputedStyle(canvas).fontFamily || "system-ui, sans-serif";
    const g = game.current;
    let raf = 0;
    let last = performance.now();

    const arrive = (p: Point, from: Point) => {
      if (isElevatorTile(plan, p.x, p.y) && !isElevatorTile(plan, from.x, from.y)) {
        open({ kind: "elevator" });
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Advance the current step, chaining into the next one.
      let budget = dt * SPEED;
      while (budget > 0) {
        if (g.next) {
          const left = 1 - g.progress;
          if (budget < left) {
            g.progress += budget;
            budget = 0;
            break;
          }
          budget -= left;
          const from = g.pos;
          g.pos = g.next;
          g.next = null;
          g.progress = 0;
          arrive(g.pos, from);
        }
        if (g.overlay) break;
        const held = g.held.at(-1);
        let step: Point | null = null;
        if (held) {
          g.path = [];
          g.pending = null;
          g.dir = held;
          const cand = { x: g.pos.x + STEP[held].x, y: g.pos.y + STEP[held].y };
          if (isWalkable(tileAt(plan, cand.x, cand.y))) step = cand;
        } else if (g.path.length) {
          step = g.path.shift()!;
        } else if (g.pending) {
          const pending = g.pending;
          g.pending = null;
          open(pending);
        }
        if (!step) break;
        g.dir = dirBetween(g.pos, step);
        g.next = step;
      }

      const f = g.overlay ? g.focus : focusAt(g.pos);
      if (focusKey(f) !== focusKey(g.focus)) {
        g.focus = f;
        setFocus(f);
      }

      // Camera follows the visitor, clamped to the floor.
      const cam = g.cam;
      const vx = g.next ? g.pos.x + (g.next.x - g.pos.x) * g.progress : g.pos.x;
      const vy = g.next ? g.pos.y + (g.next.y - g.pos.y) * g.progress : g.pos.y;
      const viewW = cam.w / cam.zoom;
      const viewH = cam.h / cam.zoom;
      const worldW = plan.cols * TILE;
      const worldH = plan.rows * TILE;
      cam.x =
        worldW <= viewW
          ? (worldW - viewW) / 2
          : Math.max(0, Math.min(worldW - viewW, vx * TILE + TILE / 2 - viewW / 2));
      cam.y =
        worldH <= viewH
          ? (worldH - viewH) / 2
          : Math.max(0, Math.min(worldH - viewH, vy * TILE + TILE / 2 - viewH / 2));

      drawScene(ctx, plan, cam, {
        visitor: { x: vx, y: vy, dir: g.dir, moving: g.next !== null },
        time: now / 1000,
        focusId: focusKey(g.focus) || null,
        hoverId: g.hoverId,
        images: images.current,
        font,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plan, focusAt, open]);

  // Keyboard.
  useEffect(() => {
    const g = game.current;
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
      const dir = MOVE_KEYS[e.key];
      if (dir) {
        e.preventDefault();
        g.held = [...g.held.filter((d) => d !== dir), dir];
        setHint(false);
      } else if (INTERACT_KEYS.has(e.key) && g.focus) {
        e.preventDefault();
        open(g.focus);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const dir = MOVE_KEYS[e.key];
      if (dir) g.held = g.held.filter((d) => d !== dir);
    };
    const onBlur = () => {
      g.held = [];
    };
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

  /** Screen point → tile. */
  const toTile = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cam = game.current.cam;
    return {
      x: Math.floor(((e.clientX - rect.left) / cam.zoom + cam.x) / TILE),
      y: Math.floor(((e.clientY - rect.top) / cam.zoom + cam.y) / TILE),
    };
  };

  /** Whatever is drawn at a tile: a painting, an empty frame, a stand, the lift. */
  const targetAt = (t: Point): Focus | null => {
    const onWall = t.y >= ROW.faceTop && t.y <= ROW.faceBottom;
    if (onWall) {
      const art = plan.artworks.find((a) => t.x >= a.x && t.x < a.x + FRAME_W);
      if (art) return { kind: "art", art };
      const room = plan.rooms.find((r) =>
        r.emptySlots.some((sx) => t.x >= sx && t.x < sx + FRAME_W),
      );
      if (room) return { kind: "room", room };
      if (t.x >= plan.elevator.x && t.x < plan.elevator.x + plan.elevator.w + 1) {
        return { kind: "elevator" };
      }
    }
    const room = plan.rooms.find(
      (r) =>
        (r.pedestal.x === t.x && r.pedestal.y === t.y) ||
        (t.y === ROW.roomWall && t.x >= r.doorX + 2 && t.x < r.x + r.w),
    );
    if (room) return { kind: "room", room };
    return null;
  };

  const walkTo = (target: Point, then: Focus | null) => {
    const g = game.current;
    const start = g.next ?? g.pos;
    const path = findPath(plan, start, target);
    if (!path) return;
    g.held = [];
    g.path = path;
    g.pending = then;
    setHint(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (game.current.overlay) return;
    containerRef.current?.focus({ preventScroll: true });
    const g = game.current;
    const t = toTile(e);
    const target = targetAt(t);
    const here = g.next ?? g.pos;

    if (target?.kind === "art") {
      const art = target.art;
      if (canSee(art, here.x, here.y) && !g.next) return open(target);
      const x = Math.max(art.x, Math.min(art.x + FRAME_W - 1, here.x));
      return walkTo({ x, y: ROW.roomTop }, target);
    }
    if (target?.kind === "elevator") {
      if (isElevatorTile(plan, here.x, here.y) && !g.next) return open(target);
      // Arriving on the lift tile opens the panel.
      return walkTo({ x: plan.elevator.x + 1, y: ROW.roomTop }, null);
    }
    if (target?.kind === "room") {
      const p = target.room.pedestal;
      const spots = [
        { x: p.x - 1, y: p.y },
        { x: p.x + 1, y: p.y },
        { x: p.x, y: p.y - 1 },
      ].filter((s) => isWalkable(tileAt(plan, s.x, s.y)));
      if (spots.some((s) => s.x === here.x && s.y === here.y) && !g.next) return open(target);
      const best = spots.sort(
        (a, b) =>
          Math.abs(a.x - here.x) +
          Math.abs(a.y - here.y) -
          Math.abs(b.x - here.x) -
          Math.abs(b.y - here.y),
      )[0];
      if (best) walkTo(best, target);
      return;
    }
    if (isWalkable(tileAt(plan, t.x, t.y))) walkTo(t, null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const target = targetAt(toTile(e));
    game.current.hoverId = target?.kind === "art" ? target.art.id : null;
    canvasRef.current!.style.cursor = target ? "pointer" : "default";
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

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label={`Walkable map of Floor ${plan.floor.level}, ${plan.floor.name}. Use arrow keys or WASD to walk and E to look at what's in front of you.`}
        className="relative h-[min(72vh,680px)] min-h-[380px] w-full overflow-hidden border border-line bg-[#1b1a20] outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          aria-hidden
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="rounded bg-black/70 px-3 py-1.5 text-white backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/60">
              Floor {plan.floor.level}
            </p>
            <p className="text-sm font-bold leading-tight">{plan.floor.name}</p>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              onClick={() => setHelp((h) => !h)}
              aria-expanded={help}
              className="rounded bg-black/70 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-black"
            >
              Controls
            </button>
            <Link
              href={`/floors/${plan.floor.slug}`}
              className="rounded bg-black/70 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-black"
            >
              List view
            </Link>
          </div>
        </div>

        {(help || (hint && !focus)) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
            <div className="max-w-md rounded bg-black/75 px-4 py-3 text-center text-sm text-white backdrop-blur">
              Walk with <Kbd>W</Kbd>
              <Kbd>A</Kbd>
              <Kbd>S</Kbd>
              <Kbd>D</Kbd> or the arrow keys, or click / tap where you want to go. Stand in front of
              a painting and press <Kbd>E</Kbd> to look closer. The elevator is on the left.
            </div>
          </div>
        )}

        {focus && focusLabel && !overlay && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-3">
            <button
              type="button"
              onClick={() => open(focus)}
              className="max-w-full truncate rounded-full bg-black/80 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur hover:bg-black"
            >
              <Kbd>E</Kbd> {focusLabel}
            </button>
          </div>
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-block min-w-5 rounded border border-white/30 bg-white/10 px-1 font-mono text-xs">
      {children}
    </kbd>
  );
}
