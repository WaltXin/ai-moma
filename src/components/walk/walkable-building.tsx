"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/gallery/wall-parts";
import { type Wall, floorWall } from "@/components/gallery/walls";
import type { ScreenRect } from "@/components/zoom-image";
import { type Building, spaceAt } from "@/lib/walk/building";
import {
  EYE,
  type Focus,
  type Place,
  RADIUS,
  type Vec,
  atLift,
  collides,
  focusKey,
  forward,
  groundAt,
  liftExitPose,
  lookingAt,
  move,
  placeName,
  route,
  startPose,
  viewpoint,
  yawToward,
} from "@/lib/walk/motion";
import { STEP, acousticsAt, moodAt, surfaceAt } from "@/lib/walk/music";
import { getAudio, hasEntered, markEntered, soundPreferred, startAudio } from "./audio";
import type { MuseumScene } from "./scene";
import { ArtworkViewer, Directory, ElevatorPanel, PortalPanel, RoomInfo } from "./walk-overlays";

/**
 * The museum as one building you walk through in first person. Drag to look
 * around; walk with WASD / the arrow keys, the on-screen stick on phones, or
 * by clicking the floor (on any floor you can see: the walk takes the
 * stairs). Click a painting to walk up to it; press E (or click again) to
 * open what's in front of you: a painting, a room's lectern, the lift, the
 * information desk, a kiosk.
 *
 * A visit starts in the lobby, or in the lift on a floor picked from the
 * site. The three.js scene (`scene.ts`) loads on demand, so the page's own
 * text arrives first. Movement, stairs and routes come from `lib/walk/motion.ts`.
 */

/** Metres per second. */
const WALK = 1.7;
const RUN = 3.4;
const AUTO_WALK = 2.2;
/** Radians per second for the turn keys. */
const TURN = 1.9;
/** Radians per pixel dragged. */
const LOOK = 0.0042;
const MAX_PITCH = 0.85;
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
const MOVE_KEYS = new Set(["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"]);

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const approach = (a: number, b: number, step: number) => {
  const d = angleDiff(a, b);
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
};
const keyOf = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
const smooth = (t: number) => t * t * (3 - 2 * t);
const span = (t: number, from: number, to: number) => smooth(Math.max(0, Math.min(1, (t - from) / (to - from))));

type Mode = "loading" | "ready" | "unsupported";
/** Waiting for "Enter", the first look round the lobby, stepping out of the lift, walking, riding the lift. */
type Phase = "waiting" | "intro" | "arriving" | "free" | "riding";
export type Start = { kind: "lobby" } | { kind: "lift"; level: number };

/** Into the lobby: a few steps in, and a long look up the atrium to the oculus. */
const INTRO = { walkTo: 6.5, lookFrom: 1.2, lookUp: 3.6, hold: 5, lookDown: 7.2, end: 7.6 };
/** Out of the lift on arrival: chime, doors, step out, look round. */
const ARRIVAL = { chime: 0.25, doors: 0.9, walkFrom: 1.5, walkTo: 4.6, turnFrom: 2.8, turnTo: 5, end: 5.4 };

type Ride = { from: number; to: number; from0: Vec; travel: number };
/** The ride's timetable, in seconds, given how long the car takes to travel. */
const rideTimes = (travel: number) => {
  const move = 2.7;
  const arrive = move + travel;
  return { walkIn: 1.3, turnIn: 1.6, close: 1.7, move, arrive, open: arrive + 0.1, turnOut: arrive + 0.6, walkOut: arrive + 0.9, end: arrive + 3 };
};

/** Neutral plaques in the public spaces; each floor's own colours in its galleries. */
const NEUTRAL: Wall = { wall: "#f3f1ec", ink: "#141414", muted: "#5c5c5c", line: "#d9d6cf" };

export function WalkableBuilding({ building: b, start }: { building: Building; start: Start }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MuseumScene | null>(null);

  const [mode, setMode] = useState<Mode>("loading");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [overlay, setOverlay] = useState<Focus | { kind: "directory" } | null>(null);
  /** Where the painting being opened hangs on screen, so it can grow from there. */
  const [artFrom, setArtFrom] = useState<ScreenRect | null>(null);
  /** The art viewer's own close, which shrinks the picture back onto the wall. */
  const exitArt = useRef<(() => void) | null>(null);
  const [place, setPlace] = useState({ level: start.kind === "lift" ? start.level : 0, name: "" });
  const [hint, setHint] = useState(true);
  const [help, setHelp] = useState(false);
  const [touch, setTouch] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [phase, setPhase] = useState<Phase>(() => (hasEntered() ? (start.kind === "lobby" ? "intro" : "arriving") : "waiting"));
  const [sound, setSound] = useState(true);
  const [hasAudio, setHasAudio] = useState(false);
  const [wall, setWall] = useState<Wall>(NEUTRAL);
  /** Black over the view while it loads. */
  const [veil, setVeil] = useState(true);

  // Walking state lives in a ref so the animation loop doesn't re-render React.
  const game = useRef<{
    at: Place;
    yaw: number;
    pitch: number;
    vel: Vec;
    keys: Set<string>;
    stick: { x: number; y: number };
    legs: Vec[];
    goal: Place | null;
    /** Which way to face once a click-to-walk arrives. */
    arrive: { yaw: number; pitch: number } | null;
    pending: Focus | { kind: "ride"; to: number } | null;
    stuck: number;
    stride: number;
    atLift: boolean;
    focus: Focus | null;
    hoverId: string | null;
    overlay: Focus | { kind: "directory" } | null;
    drag: { id: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null;
    pinch: { id: number; x: number; y: number; dist: number; zoom: number } | null;
    zoom: number;
    zoomTo: number;
    phase: Phase;
    /** Seconds into the intro, arrival or ride. */
    clock: number;
    steps: number;
    lift: { y: number; at: number | null; open: number };
    ride: Ride | null;
    nearLift: boolean;
  }>(null);
  if (game.current == null) {
    const lobby = start.kind === "lobby";
    const pose = lobby ? startPose(b) : { level: start.level, pos: b.lift.car, yaw: Math.PI / 2 };
    game.current = {
      at: { level: pose.level, pos: pose.pos },
      yaw: pose.yaw,
      pitch: 0,
      vel: { x: 0, z: 0 },
      keys: new Set(),
      stick: { x: 0, y: 0 },
      legs: [],
      goal: null,
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
      phase: hasEntered() ? (lobby ? "intro" : "arriving") : "waiting",
      clock: 0,
      steps: 0,
      lift: { y: b.levels[pose.level].y, at: pose.level, open: 0 },
      ride: null,
      nearLift: !lobby,
    };
  }

  /** Where a painting is on screen now, in viewport pixels. */
  const rectOf = useCallback((id: string): ScreenRect | null => {
    const r = sceneRef.current?.artRect(id);
    const c = canvasRef.current?.getBoundingClientRect();
    if (!r || !c) return null;
    return { left: c.left + r.left, top: c.top + r.top, width: r.width, height: r.height };
  }, []);

  const open = useCallback((f: Focus | { kind: "directory" } | null) => {
    if (!f) return;
    const g = game.current!;
    if (f.kind === "art" && g.overlay?.kind !== "art") setArtFrom(rectOf(f.art.id));
    g.keys.clear();
    g.stick = { x: 0, y: 0 };
    g.legs = [];
    g.goal = null;
    g.pending = null;
    g.overlay = f;
    setOverlay(f);
  }, [rectOf]);

  const close = useCallback(() => {
    game.current!.overlay = null;
    setOverlay(null);
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  /** Done with the intro, the arrival or the ride (or skipped it): hand the visitor the controls. */
  const finishScript = useCallback(() => {
    const g = game.current!;
    if (g.phase === "arriving" || (g.phase === "riding" && g.ride)) {
      const to = g.phase === "riding" ? g.ride!.to : g.at.level;
      const exit = liftExitPose(b, to);
      g.at = { level: to, pos: exit.pos };
      g.yaw = exit.yaw;
      g.pitch = 0;
      g.lift = { y: b.levels[to].y, at: to, open: 1 };
      g.ride = null;
      g.nearLift = true;
    } else if (g.phase === "intro") {
      g.pitch = 0;
    }
    if (g.phase !== "free") {
      g.phase = "free";
      setPhase("free");
    }
  }, [b]);

  /** Into the lift and off to another floor. */
  const ride = useCallback(
    (to: number) => {
      const g = game.current!;
      g.overlay = null;
      setOverlay(null);
      if (to === g.at.level) return;
      const travel = Math.max(3, Math.min(9, Math.abs(b.levels[to].y - b.levels[g.at.level].y) / 3.2));
      g.ride = { from: g.at.level, to, from0: { ...g.at.pos }, travel };
      g.legs = [];
      g.goal = null;
      g.pending = null;
      g.phase = "riding";
      g.clock = 0;
      setPhase("riding");
      containerRef.current?.focus({ preventScroll: true });
    },
    [b],
  );

  /** Walks to `to` (any floor), then turns to face `arrive` and opens or does `then`. */
  const walkTo = useCallback(
    (to: Place, arrive: { yaw: number; pitch: number } | null, then: Focus | { kind: "ride"; to: number } | null) => {
      const g = game.current!;
      const legs = route(b, g.at, to);
      if (!legs) return false;
      g.legs = legs;
      g.goal = to;
      g.arrive = arrive;
      g.pending = then;
      setHint(false);
      return true;
    },
    [b],
  );

  /** From the directory: to the lift, then up or down. */
  const goToFloor = useCallback(
    (level: number) => {
      const g = game.current!;
      g.overlay = null;
      setOverlay(null);
      containerRef.current?.focus({ preventScroll: true });
      if (Math.hypot(g.at.pos.x - b.lift.call.x, g.at.pos.z - b.lift.call.z) < 1.6) return ride(level);
      const view = viewpoint(b, { kind: "lift" }, g.at.level);
      walkTo({ level: g.at.level, pos: view.at }, view, { kind: "ride", to: level });
    },
    [b, ride, walkTo],
  );

  /** The welcome's buttons: start the sound (a click is what browsers need) and go in. */
  const enter = (withSound: boolean) => {
    const audio = startAudio();
    audio?.setMuted(!withSound);
    const g = game.current!;
    audio?.play(moodAt(b, g.at));
    audio?.setPlace(acousticsAt(b, g.at));
    setSound(withSound && Boolean(audio));
    markEntered();
    g.phase = start.kind === "lobby" ? "intro" : "arriving";
    g.clock = 0;
    setPhase(g.phase);
    containerRef.current?.focus({ preventScroll: true });
  };

  const toggleSound = useCallback(() => {
    const audio = startAudio();
    if (!audio) return;
    const on = audio.muted;
    audio.setMuted(!on);
    const g = game.current!;
    audio.play(moodAt(b, g.at));
    audio.setPlace(acousticsAt(b, g.at));
    setSound(on);
  }, [b]);

  // Up close to a painting, the music steps back.
  useEffect(() => {
    getAudio()?.focus(overlay?.kind === "art");
  }, [overlay]);

  const roomArt = useCallback((room: number) => b.artworks.filter((a) => a.room === room), [b.artworks]);

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

    const run = async () => {
      const [{ createMuseumScene }] = await Promise.all([import("./scene"), document.fonts?.ready.catch(() => undefined)]);
      if (cancelled) return;
      const sans = getComputedStyle(container).fontFamily || "system-ui, sans-serif";
      const display = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || sans;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      try {
        scene = createMuseumScene(canvas, { building: b, fonts: { sans, display }, low: coarse });
      } catch (err) {
        console.error(err);
        setMode("unsupported");
        return;
      }
      sceneRef.current = scene;
      // Lets a browser console (or a test script) move the visitor around while developing.
      if (process.env.NODE_ENV === "development") {
        Object.assign(window, { __walk: g, __audio: getAudio, __building: b });
      }

      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        scene!.resize(width, height, Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(container);

      let last = performance.now();
      let lastPlace = "";
      let lastWall = "";
      let lastMood: unknown = null;
      let lastSound = "";
      const tick = (now: number) => {
        const real = Math.min(0.25, (now - last) / 1000);
        const dt = Math.min(0.05, real);
        last = now;
        const k = g.keys;
        const strideAtStart = g.stride;
        const audio = getAudio();
        let ground: number | null = null;

        // ── Scripted moments: the intro, stepping out of the lift, the ride ──
        if (g.phase === "intro") {
          g.clock += real;
          const t = g.clock;
          const from = b.entrance.at;
          const to = { x: from.x, z: from.z - 7.2 };
          const w = span(t, 0, INTRO.walkTo);
          const before = g.at.pos;
          g.at = { level: 0, pos: { x: from.x + (to.x - from.x) * w, z: from.z + (to.z - from.z) * w } };
          g.stride += Math.hypot(g.at.pos.x - before.x, g.at.pos.z - before.z);
          const up = reduced ? 0 : span(t, INTRO.lookFrom, INTRO.lookUp) * (1 - span(t, INTRO.hold, INTRO.lookDown));
          g.pitch = up * 0.95;
          if (t >= INTRO.end) finishScript();
        } else if (g.phase === "arriving") {
          const t0 = g.clock;
          g.clock += real;
          const t = g.clock;
          const crossed = (at: number) => t0 < at && t >= at;
          if (crossed(ARRIVAL.chime)) audio?.chime(0, 0.9);
          if (crossed(ARRIVAL.doors)) audio?.doors(0, 0.9, true);
          g.lift = { y: b.levels[g.at.level].y, at: g.at.level, open: span(t, ARRIVAL.doors, ARRIVAL.doors + 0.9) };
          if (reduced && t >= ARRIVAL.doors + 0.6) g.clock = ARRIVAL.end;
          const exit = liftExitPose(b, g.at.level);
          const w = span(t, ARRIVAL.walkFrom, ARRIVAL.walkTo);
          const before = g.at.pos;
          g.at = { level: g.at.level, pos: { x: b.lift.car.x + (exit.pos.x - b.lift.car.x) * w, z: b.lift.car.z + (exit.pos.z - b.lift.car.z) * w } };
          g.stride += Math.hypot(g.at.pos.x - before.x, g.at.pos.z - before.z);
          g.yaw = Math.PI / 2 + angleDiff(Math.PI / 2, exit.yaw) * span(t, ARRIVAL.turnFrom, ARRIVAL.turnTo);
          ground = b.levels[g.at.level].y;
          if (g.clock >= ARRIVAL.end) finishScript();
        } else if (g.phase === "riding" && g.ride) {
          const r = g.ride;
          const T = rideTimes(r.travel);
          const t0 = g.clock;
          g.clock += real;
          const t = g.clock;
          const crossed = (at: number) => t0 < at && t >= at;
          const y0 = b.levels[r.from].y;
          const y1 = b.levels[r.to].y;
          if (crossed(T.close)) audio?.doors(0, 0.8, false);
          if (crossed(T.arrive - 0.3)) audio?.chime(0, 0.8);
          if (crossed(T.open)) audio?.doors(0, 0.8, true);
          // In, turn to the glass, doors shut; up (or down); doors open, turn, out.
          const before = g.at.pos;
          const inside = b.lift.car;
          if (t < T.move) {
            const w = span(t, 0, T.walkIn);
            g.at = { level: r.from, pos: { x: r.from0.x + (inside.x - r.from0.x) * w, z: r.from0.z + (inside.z - r.from0.z) * w } };
            g.yaw = approach(g.yaw, -Math.PI / 2, dt * 2.6);
            g.pitch = approach(g.pitch, 0, dt);
            g.lift = { y: y0, at: r.from, open: 1 - span(t, T.close, T.close + 0.9) };
          } else if (t < T.arrive) {
            const w = span(t, T.move, T.arrive);
            g.lift = { y: y0 + (y1 - y0) * w, at: null, open: 0 };
            g.at = { level: w > 0.5 ? r.to : r.from, pos: inside };
            // Look out through the glass, up or down the atrium as it passes.
            g.pitch = approach(g.pitch, Math.sign(y1 - y0) * 0.18 * (1 - Math.abs(w - 0.5) * 2), dt * 0.6);
          } else {
            const exit = liftExitPose(b, r.to);
            g.lift = { y: y1, at: r.to, open: span(t, T.open, T.open + 0.9) };
            const w = span(t, T.walkOut, T.walkOut + 1.9);
            g.at = { level: r.to, pos: { x: inside.x + (exit.pos.x - inside.x) * w, z: inside.z + (exit.pos.z - inside.z) * w } };
            g.yaw = -Math.PI / 2 + angleDiff(-Math.PI / 2, exit.yaw) * span(t, T.turnOut, T.walkOut + 2);
            g.pitch = approach(g.pitch, 0, dt);
          }
          g.stride += Math.hypot(g.at.pos.x - before.x, g.at.pos.z - before.z);
          ground = g.lift.y;
          if (t >= T.end) finishScript();
        } else if (g.phase === "waiting") {
          if (start.kind === "lift") ground = g.lift.y;
        }
        const walking = g.phase === "free";

        if (!g.overlay && walking) {
          g.yaw += ((k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0)) * TURN * dt;
        }
        let ahead = (k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0) - g.stick.y;
        let side = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + g.stick.x;
        const amount = Math.hypot(ahead, side);
        if (amount > 1) {
          ahead /= amount;
          side /= amount;
        }

        let want: Vec = { x: 0, z: 0 };
        if (g.overlay || !walking) {
          // Stand still while something is open.
        } else if (amount > 0.05) {
          g.legs = [];
          g.goal = null;
          g.pending = null;
          g.arrive = null;
          const f = forward(g.yaw);
          const speed = k.has("Shift") ? RUN : WALK;
          want = { x: (f.x * ahead - f.z * side) * speed, z: (f.z * ahead + f.x * side) * speed };
        } else if (g.legs.length) {
          const target = g.legs[0];
          const dx = target.x - g.at.pos.x;
          const dz = target.z - g.at.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.08) {
            g.legs.shift();
            if (!g.legs.length) {
              g.goal = null;
              const pending = g.pending;
              g.pending = null;
              if (pending?.kind === "ride") ride(pending.to);
              else if (pending) open(pending);
            }
          } else {
            const speed = Math.min(AUTO_WALK, 0.4 + dist * 2.5);
            want = { x: (dx / dist) * speed, z: (dz / dist) * speed };
            // Look where you're going, unless you're looking around.
            const final = g.legs[g.legs.length - 1];
            const lookAhead = Math.hypot(final.x - g.at.pos.x, final.z - g.at.pos.z) > 1.2 || g.legs.length > 1;
            if (!g.drag?.moved && lookAhead) {
              g.yaw = approach(g.yaw, yawToward(g.at.pos, target), dt * 2.6);
              g.pitch = approach(g.pitch, 0, dt * 0.8);
            }
          }
        } else if (g.arrive && !g.drag?.moved) {
          g.yaw = approach(g.yaw, g.arrive.yaw, dt * 3);
          g.pitch = approach(g.pitch, g.arrive.pitch, dt * 1.5);
          if (g.yaw === g.arrive.yaw && g.pitch === g.arrive.pitch) g.arrive = null;
        }

        const ease = 1 - Math.exp(-dt * 10);
        g.vel = { x: g.vel.x + (want.x - g.vel.x) * ease, z: g.vel.z + (want.z - g.vel.z) * ease };
        const before = g.at.pos;
        if (walking) {
          g.at = move(b, g.at, { x: g.vel.x * dt, z: g.vel.z * dt });
          // Don't walk through other visitors: step round them.
          for (const o of scene!.obstacles(g.at.level)) {
            const dx = g.at.pos.x - o.x;
            const dz = g.at.pos.z - o.z;
            const d = Math.hypot(dx, dz);
            const min = o.r + RADIUS * 0.85;
            if (d > 1e-3 && d < min) {
              const p = { x: o.x + (dx / d) * min, z: o.z + (dz / d) * min };
              if (!collides(b, g.at.level, p)) g.at = { level: g.at.level, pos: p };
            }
          }
        }
        const moved = Math.hypot(g.at.pos.x - before.x, g.at.pos.z - before.z);
        if (walking) g.stride += moved;

        // A route blocked by something gives up rather than walking on the spot.
        if (g.legs.length && walking && moved < dt * 0.05) {
          g.stuck += dt;
          if (g.stuck > 0.8) {
            g.legs = [];
            g.goal = null;
            g.pending = null;
          }
        } else g.stuck = 0;

        // The lift: waiting on your floor, doors opening as you come near.
        const toCall = Math.hypot(g.at.pos.x - b.lift.call.x, g.at.pos.z - b.lift.call.z);
        const nearLift = walking && toCall < 2.4;
        if (walking) {
          const target = nearLift ? 1 : 0;
          g.lift = {
            y: b.levels[g.at.level].y,
            at: g.at.level,
            open: g.lift.open + (target - g.lift.open) * Math.min(1, dt * 2.2),
          };
          if (nearLift !== g.nearLift && audio) {
            const f = forward(g.yaw);
            const to = { x: b.lift.shaft.x0 - g.at.pos.x, z: b.lift.call.z - g.at.pos.z };
            const pan = (-f.z * to.x + f.x * to.z) / (Math.hypot(to.x, to.z) || 1);
            if (nearLift) audio.chime(pan, 0.5);
            audio.doors(pan, 0.6, nearLift);
          }
          g.nearLift = nearLift;
          // Walking right up to the doors calls it.
          const here = atLift(b, g.at.pos);
          if (here && !g.atLift && !g.overlay && !g.pending) open({ kind: "lift" });
          g.atLift = here;
        }

        const f = g.overlay ? g.focus : walking ? lookingAt(b, g.at, g.yaw) : null;
        if (focusKey(f) !== focusKey(g.focus)) {
          g.focus = f;
          setFocus(f);
        }
        const level = b.levels[g.at.level];
        const here = `${g.at.level}|${placeName(b, g.at)}`;
        if (here !== lastPlace) {
          lastPlace = here;
          setPlace({ level: g.at.level, name: placeName(b, g.at) });
        }
        const space = spaceAt(level, g.at.pos);
        const w = space?.kind === "gallery" ? floorWall(level.slug) : NEUTRAL;
        if (w.wall !== lastWall) {
          lastWall = w.wall;
          setWall(w);
        }

        // ── Sound: the music of where you are, the room's acoustics, the street ──
        if (audio && g.phase !== "waiting") {
          const mood = moodAt(b, g.at);
          if (mood !== lastMood) {
            lastMood = mood;
            audio.play(mood);
          }
          const acoustics = acousticsAt(b, g.at);
          if (acoustics !== lastSound) {
            lastSound = acoustics;
            audio.setPlace(acoustics);
          }
          const car = scene!.nearestCar(g.at.pos);
          const fw = forward(g.yaw);
          const right = { x: -fw.z, z: fw.x };
          audio.traffic(car.dist, (car.dx * right.x) / Math.max(4, car.dist), car.speed);
        }

        // How fast the visitor is going, by their own feet or stepping out of the lift.
        const pace = Math.min(1, (g.stride - strideAtStart) / dt / WALK);
        // A footfall every stride, on whatever is underfoot.
        const steps = Math.floor(g.stride / STEP);
        if (steps !== g.steps) {
          g.steps = steps;
          if (pace > 0.2 && g.zoom < 0.5) audio?.footstep(surfaceAt(b, g.at), Math.min(1, 0.45 + pace * 0.55));
        }
        const bob = reduced ? 0 : Math.sin(g.stride * 4.2) * 0.022 * pace;
        g.zoom += (g.zoomTo - g.zoom) * (reduced ? 1 : Math.min(1, dt * 8));
        scene!.render({
          at: g.at,
          ground: ground ?? groundAt(b, g.at.level, g.at.pos),
          yaw: g.yaw,
          pitch: g.pitch,
          eye: EYE + bob,
          time: now / 1000,
          dt: real,
          focusId: g.focus?.kind === "art" ? g.focus.art.id : null,
          hoverId: g.hoverId,
          marker: g.legs.length ? g.goal : null,
          zoom: g.zoom,
          stride: g.stride,
          pace,
          rush: walking && k.has("Shift") ? Math.min(1, pace) : 0,
          lift: g.lift,
          riding: g.phase === "riding",
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // The on-screen controls depend on the device, so they appear with the scene.
      setTouch(coarse);
      setCanFullscreen(Boolean(document.fullscreenEnabled));
      setHasAudio(typeof window.AudioContext === "function");
      setSound(getAudio() ? !getAudio()!.muted : soundPreferred());
      setMode("ready");
      setVeil(false);
    };
    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      scene?.dispose();
      sceneRef.current = null;
      // Leaving the walk: let the music fade.
      const audio = getAudio();
      if (audio) audio.release(moodAt(b, game.current!.at));
    };
  }, [b, start.kind, open, ride, finishScript]);

  // Keyboard.
  useEffect(() => {
    const g = game.current!;
    const isActive = () => {
      const el = document.activeElement;
      return !el || el === document.body || containerRef.current?.contains(el);
    };
    const onDown = (e: KeyboardEvent) => {
      if (g.overlay) {
        if (e.key === "Escape") return exitArt.current ? exitArt.current() : close();
        // Let sliders and buttons inside the overlay keep their own arrow keys.
        const inControl = e.target instanceof HTMLInputElement;
        if (!inControl && g.overlay.kind === "art" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
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
      if (key === "m") return toggleSound();
      if (g.phase === "intro" || g.phase === "arriving" || g.phase === "riding") {
        // Any key skips ahead.
        finishScript();
        return;
      }
      if (g.phase !== "free") return;
      if (MOVE_KEYS.has(key)) {
        if (key !== "Shift") e.preventDefault();
        g.keys.add(key);
        if (key !== "Shift") setHint(false);
      } else if (key === "v") {
        // Step out to see yourself, or back in.
        g.zoomTo = g.zoomTo > 0 ? 0 : THIRD_PERSON;
      } else if (key === "f") {
        open({ kind: "directory" });
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
  }, [close, open, roomArt, toggleSound, finishScript]);

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

  const pickAt = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return sceneRef.current?.pick(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1) ?? null;
  };

  const onClick = (clientX: number, clientY: number) => {
    const g = game.current!;
    const hit = pickAt(clientX, clientY);
    if (!hit) return;
    if ("focus" in hit) {
      const f = hit.focus;
      // Already standing in front of it: open it.
      if (focusKey(f) === focusKey(g.focus) && !g.legs.length) return open(f);
      const view = viewpoint(b, f, g.at.level);
      walkTo({ level: view.level, pos: view.at }, view, f.kind === "art" ? null : f);
      return;
    }
    // Walk to the spot, or as near it as there's room to stand.
    const { level, pos } = hit.place;
    let target = pos;
    for (let t = 0; t <= 1 && collides(b, level, target); t += 0.1) {
      target = { x: pos.x + (g.at.pos.x - pos.x) * t, z: pos.z + (g.at.pos.z - pos.z) * t };
    }
    if (!collides(b, level, target)) walkTo({ level, pos: target }, null, null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current!;
    if (g.overlay || g.phase === "waiting") return;
    if (g.phase !== "free") return finishScript();
    if (g.drag && !g.pinch && e.pointerType === "touch") {
      const d = g.drag;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      g.pinch = { id: e.pointerId, x: e.clientX, y: e.clientY, dist: Math.hypot(e.clientX - d.x, e.clientY - d.y) || 1, zoom: g.zoomTo };
      return;
    }
    if (g.drag) return;
    containerRef.current?.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    g.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
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
        : focus?.kind === "lift"
          ? "Take the lift"
          : focus?.kind === "desk"
            ? "Floor directory"
            : focus?.kind === "portal"
              ? focus.portal.title
              : null;

  const level = b.levels[place.level];
  const floors = b.levels.map((l) => ({ slug: l.slug, level: l.number, name: l.index === 0 ? `Lobby · ${l.name}` : l.name }));
  const startLevel = b.levels[start.kind === "lift" ? start.level : 0];

  return (
    <div
      ref={shellRef}
      className={fullscreen ? "h-full w-full bg-black" : undefined}
      style={
        {
          "--wall": wall.wall,
          "--ink": wall.ink,
          "--muted": wall.muted,
          "--line": wall.line,
        } as React.CSSProperties
      }
    >
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label={`${b.name} in 3D. Use W and S or the up and down arrows to walk, A and D to step sideways, the left and right arrows to turn, E to look at what's in front of you, and F for the floor directory.`}
        className={`relative w-full overflow-hidden bg-[#1a1918] outline-none focus-visible:outline-none ${
          fullscreen ? "h-full" : "h-[max(440px,calc(100dvh-4.1rem))]"
        }`}
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

        {/* Fades the view in once it's built. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-1000 ${veil ? "opacity-100" : "opacity-0"}`}
        />

        {mode === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <p className={`px-4 py-3 text-sm ${PLAQUE_BASE}`}>Opening the doors…</p>
          </div>
        )}
        {mode === "unsupported" && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className={`max-w-sm px-5 py-4 text-sm leading-relaxed ${PLAQUE_BASE}`}>
              This browser can’t show the museum in 3D (WebGL is turned off or unavailable).{" "}
              <Link href={`/floors/${startLevel.slug}`} className="font-semibold underline">
                See the floor as a guide
              </Link>{" "}
              instead.
            </div>
          </div>
        )}

        {/* A soft vignette, like the edges of your own vision. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_58%,rgb(0_0_0/0.32))]"
        />

        {mode === "ready" && phase === "waiting" && (
          <div className="absolute inset-0 grid place-items-center bg-black/35 p-4">
            <div className={`w-full max-w-sm px-6 py-7 text-center ${PLAQUE_BASE}`}>
              {start.kind === "lobby" ? (
                <>
                  <h2 className="wall-title text-[clamp(2.25rem,8vw,3rem)]">{b.name}</h2>
                  <p className="mt-2 text-muted">
                    {b.levels.length} floors of modern art round a skylit atrium. Walk in.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold tracking-wide text-muted">Floor {startLevel.number}</p>
                  <h2 className="wall-title mt-1 text-[clamp(1.75rem,6vw,2.5rem)]">{startLevel.name}</h2>
                  <p className="mt-2 text-muted">{startLevel.tagline}</p>
                </>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => enter(true)}
                className="mt-6 inline-flex items-center gap-2 bg-ink px-5 py-3 font-semibold text-wall transition-colors hover:bg-accent hover:text-white"
              >
                Enter with sound
                <Arrow />
              </button>
              <p className="mt-3">
                <button type="button" onClick={() => enter(false)} className="text-sm font-semibold underline underline-offset-4">
                  Enter without sound
                </button>
              </p>
              <p className="mt-4 text-xs text-muted">Music is composed live as you walk. Headphones recommended.</p>
            </div>
          </div>
        )}

        {mode === "ready" && phase !== "waiting" && (
          <>
            {/* Where you are aiming; E opens what's under it. */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full bg-white/80 shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              <p aria-live="polite" className={`${PLAQUE} flex max-w-[52%] items-center gap-2 truncate`}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink font-display text-xs font-bold text-wall tabular-nums">
                  {level.number}
                </span>
                <span className="truncate">{place.name || level.name}</span>
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => open({ kind: "directory" })}
                  title="Floor directory (F)"
                  className={`pointer-events-auto ${PLAQUE} hover:bg-ink hover:text-wall`}
                >
                  Floors
                </button>
                {hasAudio && (
                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={sound}
                    title="Sound (M)"
                    className={`pointer-events-auto ${PLAQUE} hover:bg-ink hover:text-wall`}
                  >
                    <span className="sm:hidden">{sound ? "♪" : "♪̸"}</span>
                    <span className="max-sm:hidden">{sound ? "Sound on" : "Sound off"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHelp((h) => !h)}
                  aria-expanded={help}
                  aria-label="Controls"
                  className={`pointer-events-auto ${PLAQUE} hover:bg-ink hover:text-wall`}
                >
                  <span className="sm:hidden">?</span>
                  <span className="max-sm:hidden">Controls</span>
                </button>
                {canFullscreen && (
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={`pointer-events-auto ${PLAQUE} hover:bg-ink hover:text-wall max-sm:hidden`}
                  >
                    {fullscreen ? "Exit full screen" : "Full screen"}
                  </button>
                )}
              </div>
            </div>

            {(phase === "intro" || phase === "arriving" || phase === "riding") && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
                <p className={`px-3.5 py-2 text-sm ${PLAQUE_BASE}`}>
                  {phase === "riding" ? "Riding the lift · " : ""}
                  {touch ? "Tap" : "Press any key"} to skip ahead
                </p>
              </div>
            )}

            {phase === "free" && (help || (hint && !focus)) && (
              <div className={`pointer-events-none absolute inset-x-0 flex justify-center px-3 ${touch ? "bottom-40" : "bottom-4"}`}>
                <div className={`max-w-md px-4 py-3 text-center text-sm leading-relaxed ${PLAQUE_BASE}`}>
                  {touch ? (
                    <>
                      Drag to look around. Walk with the stick, or tap the floor to walk there, even on another floor.
                      Tap a painting to go up to it. Pinch to step back and see yourself.
                    </>
                  ) : (
                    <>
                      Drag to look around. Walk with <Kbd>W</Kbd>
                      <Kbd>A</Kbd>
                      <Kbd>S</Kbd>
                      <Kbd>D</Kbd> or the arrow keys (hold <Kbd>Shift</Kbd> to hurry), or click the floor to walk there,
                      even on another floor. Click a painting, then press <Kbd>E</Kbd>. <Kbd>F</Kbd> opens the floor
                      directory; scroll (or <Kbd>V</Kbd>) steps back to see yourself; <Kbd>M</Kbd> is the sound.
                    </>
                  )}
                </div>
              </div>
            )}

            {phase === "free" && focus && focusLabel && !overlay && (
              <div className={`absolute flex justify-center px-3 ${touch ? "right-0 bottom-6 left-36" : "inset-x-0 bottom-4"}`}>
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

            {touch && phase === "free" && (
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
          room={b.rooms[overlay.art.room]}
          siblings={roomArt(overlay.art.room)}
          from={artFrom}
          rectOf={rectOf}
          exitRef={exitArt}
          onNavigate={(art) => open({ kind: "art", art })}
          onClose={close}
        />
      )}
      {overlay?.kind === "room" && <RoomInfo room={overlay.room} onClose={close} />}
      {overlay?.kind === "lift" && (
        <ElevatorPanel
          floors={floors}
          current={level.slug}
          onChoose={(slug) => ride(b.levels.findIndex((l) => l.slug === slug))}
          onClose={close}
        />
      )}
      {(overlay?.kind === "desk" || overlay?.kind === "directory") && (
        <Directory building={b} current={place.level} onGo={goToFloor} onClose={close} />
      )}
      {overlay?.kind === "portal" && <PortalPanel portal={overlay.portal} onClose={close} />}
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
      <div className="size-12 rounded-full bg-white/85 shadow-lg" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

/** A wall plaque set over the view: the wall's own colors, solid, with a soft shadow. */
const PLAQUE_BASE = "bg-wall text-ink shadow-[0_0.5rem_1rem_-0.5rem_rgb(0_0_0/0.6)] transition-colors duration-700";
const PLAQUE = `${PLAQUE_BASE} px-3.5 py-2 text-sm font-semibold`;

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-grid min-w-6 place-items-center border border-current/40 px-1 font-mono text-xs leading-5">
      {children}
    </kbd>
  );
}
