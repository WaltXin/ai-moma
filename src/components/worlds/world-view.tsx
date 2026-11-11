"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Arrow } from "@/components/gallery/wall-parts";
import { getAudio, startAudio } from "@/components/walk/audio";
import { Stick } from "@/components/walk/stick";
import type { PaintingWorld } from "@/lib/museum/types";
import { type Cue, SITTING, cueSeconds, guidanceFor } from "@/lib/worlds/meditation";
import { arrivalOf } from "@/lib/worlds/place";
import { getPlace } from "@/lib/worlds/places";
import { Creators } from "./creators";
import type { WorldScene } from "./kit";
import { SCENES } from "./scenes";

/**
 * Stepping into a painting. You come in a few steps behind where you'll
 * stand and walk the last of the way, so you arrive on foot. Walk the place
 * with WASD / the arrow keys, the stick on phones, or by clicking the ground;
 * drag to look. You walk as a person does: you gather speed and lose it, your
 * head rises and falls with each step and leans a little from foot to foot,
 * and each footfall is heard. "Sit" lowers you
 * into the grass and tips your head back, and after a while every control
 * fades away, leaving only the painting. In full screen they fade sooner,
 * sitting or not; move the mouse, tap, or press a key to bring them back. Nothing here can be touched or
 * changed: you are part of its weather.
 *
 * "Meditate" is sitting with a clock: for as long as the visitor sets by
 * dragging a bar (1 to 30 minutes), a ring low in the view swells with each
 * breath in and sinks with each breath out, the same breath is heard as a
 * soft tone (so the eyes can close), a bowl is struck to begin and three
 * times to end, and the screen is kept awake. With guidance, a voice settles
 * them, speaks a few times with long silences between, and says when the end
 * is near; its words show too, for anyone sitting in silence. Standing up ends it.
 *
 * The three.js scene loads on demand, behind a welcome card that says what
 * the painting is and where the real one hangs.
 */

const EYE = 1.6;
const SIT_EYE = 0.9;
const WALK = 1.4;
const RUN = 2.8;
const TAP_WALK = 1.7;
/** Coming in: an unhurried walk up to where the visitor will stand. */
const WALK_IN = 1.15;
/** How quickly a walker gathers speed and loses it, and the head follows the hand (per second). */
const GATHER = 7;
const SETTLE = 9;
const HEAD = 16;
/** A step's length at a walk and at a run, in metres. */
const STEP = 0.72;
const RUN_STEP = 1.0;
/** How far the head rises and falls over a step, and leans toward the standing foot (metres). */
const BOB = 0.045;
const LEAN = 0.022;
const TURN = 1.8;
const LOOK = 0.0042;
const MAX_PITCH = 1.15;
const MIN_PITCH = -0.7;
/** Seconds sitting still before the controls fade, leaving only the painting. */
const FADE_AFTER = 4;
/** In full screen, seconds without a tap, key or mouse move before they fade. */
const FADE_COVERED = 2.5;
/** A meditation's breath: seconds in, seconds out. Six breaths a minute, the pace that calms. */
const BREATH_IN = 4;
const BREATH_OUT = 6;
/** Where the visitor's last choice of sitting is kept, in their browser. */
const SITTING_PREF = "ai-moma:sitting";
/** How far the view rises with a breath in, while meditating (metres). */
const BREATH_RISE = 0.014;

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
const keyOf = (e: KeyboardEvent | React.KeyboardEvent) =>
  e.key.length === 1 ? e.key.toLowerCase() : e.key;
const smooth = (t: number) => t * t * (3 - 2 * t);

type Mode = "loading" | "ready" | "unsupported";

/** The page's clock, in milliseconds: the one animation frames are timed by. */
const pageClock = () => performance.now();

/** How full the lungs are, 0 to 1, `t` seconds into a meditation. */
function breathAt(t: number): number {
  const p = t % (BREATH_IN + BREATH_OUT);
  return p < BREATH_IN ? smooth(p / BREATH_IN) : 1 - smooth((p - BREATH_IN) / BREATH_OUT);
}

/** Minutes and seconds left of a sitting, counted only while it's looked at. */
function Remaining({ endAt }: { endAt: number }) {
  const [left, setLeft] = useState(() => Math.max(0, endAt - performance.now()));
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, endAt - performance.now())), 500);
    return () => window.clearInterval(id);
  }, [endAt]);
  const s = Math.ceil(left / 1000);
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/** The length and kind of sitting the visitor last chose, or the first offered. */
function lastSitting(): { minutes: number; guided: boolean } {
  const first = { minutes: SITTING.first, guided: true };
  if (typeof window === "undefined") return first;
  try {
    const kept = JSON.parse(window.localStorage.getItem(SITTING_PREF) ?? "null");
    const minutes = Math.round(Number(kept?.minutes));
    if (minutes >= SITTING.min && minutes <= SITTING.max)
      return { minutes, guided: kept.guided !== false };
  } catch {
    // Nothing kept, or nowhere to keep it.
  }
  return first;
}

export function WorldView({
  world,
  back,
  guidance,
}: {
  world: PaintingWorld;
  back: string;
  /** The guided meditation's cues, with their voice. */
  guidance: Record<string, Cue>;
}) {
  const place = getPlace(world.slug);
  const { start, mood } = place;
  // Out in the open, in the painting's own room, or (with no air of its own) a room of the museum.
  const acoustics = !place.air ? "room" : place.air.indoors ? "interior" : "open";
  // Worked out once: where they come in, a few steps behind where they'll stand.
  const [arrival] = useState(() => arrivalOf(place));
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [entered, setEntered] = useState(false);
  const [sitting, setSitting] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [sound, setSound] = useState(true);
  const [touch, setTouch] = useState(false);
  const [hint, setHint] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  /**
   * The page's own stand-in for full screen, where the browser won't give a
   * page the real thing (iPhone): the world covers the whole page instead.
   */
  const [immersive, setImmersive] = useState(false);
  const covering = fullscreen || immersive;
  /** A meditation under way: how long it is, and when it ends (on the page's clock). */
  const [sitFor, setSitFor] = useState<{ minutes: number; endAt: number } | null>(null);
  /** Choosing how long to sit, and whether to be guided. */
  const [choosing, setChoosing] = useState(false);
  const [plan, setPlan] = useState(lastSitting);
  /** What the guide is saying now, shown as words too. */
  const [caption, setCaption] = useState("");
  const captionTimers = useRef<number[]>([]);
  const barId = useId();
  /** A sitting has just ended: its last words stay up a while. */
  const [rested, setRested] = useState(false);
  const sitting$ = useRef<{
    stopSound: () => void;
    timer: number;
    lock: WakeLockSentinel | null;
  } | null>(null);

  const game = useRef({
    x: arrival.x,
    z: arrival.z,
    yaw: start.yaw,
    pitch: start.pitch,
    /** Where the head is looking: it follows `yaw` and `pitch` a moment behind. */
    viewYaw: start.yaw,
    viewPitch: start.pitch,
    /** Speed over the ground, in metres a second. */
    vx: 0,
    vz: 0,
    /** How far through the walk cycle: π a step. */
    phase: 0,
    steps: 0,
    /** How much of a walker's sway the head has, from standing still (0) to full stride (1). */
    gait: 0,
    clock: 0,
    /** The visitor asked their device for less motion: no sway, no walking in. */
    calm: false,
    keys: new Set<string>(),
    stick: { x: 0, y: 0 },
    goal: null as { x: number; z: number; speed?: number } | null,
    sit: 0,
    sitting: false,
    sinceSit: 0,
    /** When the meditation under way began (the page's clock), or 0. */
    breathing: 0,
    choosing: false,
    still: 0,
    covering: false,
    drag: null as {
      id: number;
      x: number;
      y: number;
      sx: number;
      sy: number;
      moved: boolean;
    } | null,
  });

  const wake = useCallback(() => {
    game.current.still = 0;
    setQuiet(false);
  }, []);

  /** Ends a meditation: when its time is up (`done`), or early. */
  const endSitting = useCallback(
    (done: boolean) => {
      const s = sitting$.current;
      if (!s) return;
      sitting$.current = null;
      window.clearTimeout(s.timer);
      void s.lock?.release().catch(() => {});
      // Ended early, the bowl isn't struck and the guide falls silent; at its end, the
      // three strokes ring on and the guide has a last word.
      if (!done) {
        s.stopSound();
        for (const id of captionTimers.current) window.clearTimeout(id);
        captionTimers.current = [];
        setCaption("");
      }
      game.current.breathing = 0;
      setSitFor(null);
      // The button that ended it is gone; keep the keys working.
      containerRef.current?.focus({ preventScroll: true });
      if (done) {
        setRested(true);
        window.setTimeout(() => setRested(false), 14000);
      }
      wake();
    },
    [wake],
  );

  const setSit = useCallback(
    (on: boolean) => {
      const g = game.current;
      if (g.sitting === on) return;
      g.sitting = on;
      g.sinceSit = 0;
      g.goal = null;
      setSitting(on);
      // Standing up ends a meditation.
      if (!on) endSitting(false);
      wake();
    },
    [wake, endSitting],
  );

  const beginSitting = ({ minutes, guided }: { minutes: number; guided: boolean }) => {
    endSitting(false);
    try {
      window.localStorage.setItem(SITTING_PREF, JSON.stringify({ minutes, guided }));
    } catch {
      // Not kept; they'll set it again next time.
    }
    setChoosing(false);
    setRested(false);
    setSit(true);
    const g = game.current;
    const seconds = minutes * 60;
    g.breathing = pageClock();
    // The controls fall away almost at once.
    g.still = FADE_AFTER - 1.5;
    // The guide's cues, placed along a sitting of this length: heard, and shown as words.
    const cues = guided ? guidanceFor(seconds, world.slug, guidance) : [];
    for (const id of captionTimers.current) window.clearTimeout(id);
    captionTimers.current = cues.flatMap((cue) => [
      window.setTimeout(() => setCaption(cue.text), cue.at * 1000),
      window.setTimeout(
        () => setCaption((now) => (now === cue.text ? "" : now)),
        (cue.at + cueSeconds(cue) + 1.5) * 1000,
      ),
    ]);
    const held = {
      stopSound:
        getAudio()?.meditate({
          seconds,
          breathIn: BREATH_IN,
          breathOut: BREATH_OUT,
          voice: cues.flatMap((cue) => (cue.audio ? [{ src: cue.audio.src, at: cue.at }] : [])),
        }) ?? (() => {}),
      timer: window.setTimeout(() => endSitting(true), seconds * 1000),
      lock: null as WakeLockSentinel | null,
    };
    sitting$.current = held;
    // Keep the screen from sleeping while they sit, where the browser can.
    void navigator.wakeLock
      ?.request("screen")
      .then((lock) => {
        if (sitting$.current === held) held.lock = lock;
        else void lock.release();
      })
      .catch(() => {});
    setSitFor({ minutes, endAt: g.breathing + seconds * 1000 });
    containerRef.current?.focus({ preventScroll: true });
  };

  // Leaving the page ends it too.
  useEffect(
    () => () => {
      endSitting(false);
      for (const id of captionTimers.current) window.clearTimeout(id);
    },
    [endSitting],
  );

  // While they're choosing, the controls stay.
  useEffect(() => {
    game.current.choosing = choosing;
  }, [choosing]);

  // ── The scene, loaded once the page is up ──
  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    let cancelled = false;
    let scene: WorldScene | null = null;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    // Asked for less motion, they start where they'll stand, and the view holds steady.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      game.current.calm = true;
      game.current.x = start.x;
      game.current.z = start.z;
    }

    const run = async () => {
      const makeScene = await SCENES[world.slug]();
      if (cancelled) return;
      setTouch(coarse);
      try {
        // Painted a little at a time, so the welcome stays responsive meanwhile.
        const made = await makeScene(canvas, { low: coarse });
        if (cancelled) {
          made.dispose();
          return;
        }
        scene = made;
      } catch (err) {
        console.error(err);
        if (!cancelled) setMode("unsupported");
        return;
      }
      sceneRef.current = scene;
      // Lets a browser console move the visitor around while developing.
      if (process.env.NODE_ENV === "development")
        Object.assign(window, { __world: game.current, __audio: getAudio });
      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        scene!.resize(Math.max(1, width), Math.max(1, height));
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(container);
      setMode("ready");

      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const g = game.current;
        const k = g.keys;
        if (k.has("ArrowLeft")) g.yaw += TURN * dt;
        if (k.has("ArrowRight")) g.yaw -= TURN * dt;
        const ahead =
          (k.has("w") || k.has("ArrowUp") ? 1 : 0) -
          (k.has("s") || k.has("ArrowDown") ? 1 : 0) -
          g.stick.y;
        const side = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + g.stick.x;
        // The speed they're after: from the keys or the stick, or toward where they tapped.
        let wantX = 0;
        let wantZ = 0;
        let running = false;
        if (ahead || side) {
          g.goal = null;
          if (g.sitting) {
            g.sitting = false;
            setSitting(false);
            endSitting(false);
          }
          running = k.has("Shift");
          const speed = running ? RUN : WALK;
          // Forward is (−sin yaw, −cos yaw); right is (cos yaw, −sin yaw).
          let fx = -Math.sin(g.yaw) * ahead + Math.cos(g.yaw) * side;
          let fz = -Math.cos(g.yaw) * ahead - Math.sin(g.yaw) * side;
          const len = Math.hypot(fx, fz);
          if (len > 1) {
            fx /= len;
            fz /= len;
          }
          wantX = fx * speed;
          wantZ = fz * speed;
        } else if (g.goal) {
          const dx = g.goal.x - g.x;
          const dz = g.goal.z - g.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.15) g.goal = null;
          else {
            // Slowing over the last steps, as anyone does coming to a stop.
            const speed = Math.min(g.goal.speed ?? TAP_WALK, 0.35 + d * 2.2);
            wantX = (dx / d) * speed;
            wantZ = (dz / d) * speed;
          }
        }
        // A body gathers speed and loses it; it doesn't start or stop dead.
        const pull = Math.min(1, dt * (wantX || wantZ ? GATHER : SETTLE));
        g.vx += (wantX - g.vx) * pull;
        g.vz += (wantZ - g.vz) * pull;
        if (!wantX && !wantZ && Math.hypot(g.vx, g.vz) < 0.03) g.vx = g.vz = 0;
        let moved = 0;
        if (g.vx || g.vz) {
          // Slide round trees; stay where the world lets you walk.
          let nx = g.x + g.vx * dt;
          let nz = g.z + g.vz * dt;
          if (place.blocked(nx, nz)) {
            if (!place.blocked(nx, g.z)) nz = g.z;
            else if (!place.blocked(g.x, nz)) nx = g.x;
            else {
              nx = g.x;
              nz = g.z;
              g.goal = null;
            }
          }
          const c = place.clampToBounds(nx, nz);
          moved = Math.hypot(c.x - g.x, c.z - g.z);
          // Stopped by a tree or the edge, the walker has no speed left that way.
          if (dt > 0 && moved < Math.hypot(g.vx, g.vz) * dt * 0.98) {
            g.vx = (c.x - g.x) / dt;
            g.vz = (c.z - g.z) / dt;
          }
          g.x = c.x;
          g.z = c.z;
        }
        g.sit += ((g.sitting ? 1 : 0) - g.sit) * Math.min(1, dt * 1.6);
        if (g.sitting) {
          g.sinceSit += dt;
          // Settle in, then let the head tip back toward the sky.
          if (g.sinceSit > 0.6 && g.sinceSit < 3.5 && !g.drag)
            g.pitch += (Math.max(g.pitch, 0.42) - g.pitch) * Math.min(1, dt * 1.2);
        }
        // Holding the stick keeps it in sight.
        if (g.stick.x || g.stick.y) g.still = 0;
        if (g.choosing) g.still = 0;
        else if (g.sitting || g.covering) {
          g.still += dt;
          if (g.still > (g.covering ? FADE_COVERED : FADE_AFTER)) {
            setQuiet(true);
            // The choice of how long to sit goes away with the controls.
            setChoosing(false);
          }
        }

        // ── The walk: each step a rise and fall of the head, a lean onto the standing foot, a footfall ──
        g.clock += dt;
        const speed = dt > 0 ? moved / dt : 0;
        const stride = running ? RUN_STEP : STEP;
        g.phase += (moved / stride) * Math.PI;
        const steps = Math.floor(g.phase / Math.PI);
        if (steps !== g.steps) {
          g.steps = steps;
          // Louder the faster they go.
          if (place.footing && speed > 0.4)
            // Boards ring under a foot; here they're a table under a very small one.
            getAudio()?.footstep(
              place.footing,
              Math.min(1.25, 0.5 + speed / RUN) * (place.footing === "wood" ? 0.4 : 1),
            );
        }
        g.gait += ((g.calm ? 0 : Math.min(1, speed / 0.9)) - g.gait) * Math.min(1, dt * 6);
        const sway = g.gait * (running ? 1.35 : 1);
        // Lowest as a foot lands, highest as the body passes over it.
        const bob = -0.5 * Math.cos(g.phase * 2) * BOB * sway;
        // One lean to each side every two steps.
        const lean = Math.sin(g.phase) * sway;
        // Standing or sitting still, they still breathe.
        // Meditating, the view rises and sinks with the breath the ring keeps.
        const breath = g.calm
          ? 0
          : g.breathing
            ? (breathAt((now - g.breathing) / 1000) - 0.5) * BREATH_RISE
            : Math.sin(g.clock * 1.15) * 0.005 * (1 - g.gait);
        // The head follows the hand a moment behind, as a head does.
        const follow = Math.min(1, dt * HEAD);
        g.viewYaw += (g.yaw - g.viewYaw) * follow;
        g.viewPitch += (g.pitch - g.viewPitch) * follow;
        const y = place.heightAt(g.x, g.z) + EYE - (EYE - SIT_EYE) * smooth(g.sit) + bob + breath;
        scene!.frame(
          {
            // Leaning is a step to the side of where the feet are.
            x: g.x + Math.cos(g.viewYaw) * lean * LEAN,
            y,
            z: g.z - Math.sin(g.viewYaw) * lean * LEAN,
            yaw: g.viewYaw,
            pitch: g.viewPitch + Math.sin(g.phase * 2) * 0.0035 * sway,
            roll: -lean * 0.007,
          },
          dt,
        );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    void run();

    const onFull = () => {
      setFullscreen(document.fullscreenElement === shellRef.current);
      game.current.still = 0;
      setQuiet(false);
    };
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      scene?.dispose();
      sceneRef.current = null;
      document.removeEventListener("fullscreenchange", onFull);
      getAudio()?.release(mood);
    };
    // One world per mount: the page remounts the view for another world.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Full screen starts the countdown to fading the controls afresh.
  useEffect(() => {
    game.current.covering = covering;
    game.current.still = 0;
  }, [covering]);

  // While the world covers the page, the page behind it mustn't scroll.
  useEffect(() => {
    if (!immersive) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      root.style.overflow = before;
    };
  }, [immersive]);

  /** The welcome's buttons: start the sound (browsers need a click for it) and go in. */
  const enter = (withSound: boolean) => {
    const audio = startAudio(withSound);
    audio?.setMuted(!withSound);
    audio?.play(mood);
    audio?.setPlace(acoustics);
    audio?.air(place.air ?? null);
    setSound(withSound && Boolean(audio));
    setEntered(true);
    // Walk the last few steps in, unless they've asked for less motion; any key or tap takes over.
    const g = game.current;
    if (!g.calm && (g.x !== start.x || g.z !== start.z))
      g.goal = { x: start.x, z: start.z, speed: WALK_IN };
    containerRef.current?.focus({ preventScroll: true });
    window.setTimeout(() => setHint(false), 9000);
  };

  const toggleSound = () => {
    // Turning sound on picks the audio session before anything plays.
    const audio = startAudio(getAudio()?.muted);
    if (!audio) return;
    const on = audio.muted;
    audio.setMuted(!on);
    audio.play(mood);
    audio.setPlace(acoustics);
    if (on) audio.air(place.air ?? null);
    setSound(on);
  };

  const toggleFullscreen = () => {
    if (immersive) setImmersive(false);
    else if (document.fullscreenElement) void document.exitFullscreen();
    else if (document.fullscreenEnabled && shellRef.current?.requestFullscreen) {
      void shellRef.current.requestFullscreen().catch(() => setImmersive(true));
    } else setImmersive(true);
  };

  // ── Input ──
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!entered) return;
    // The bar that sets a sitting's length takes the arrow keys itself.
    if (e.target instanceof HTMLInputElement) return;
    const key = keyOf(e);
    // Walking in full screen leaves the controls hidden; any other key shows them.
    if (!covering || !MOVE_KEYS.has(key)) wake();
    if (key === "Escape" && immersive) {
      setImmersive(false);
      return;
    }
    if (MOVE_KEYS.has(key)) {
      e.preventDefault();
      game.current.keys.add(key);
      setHint(false);
    } else if (key === "c") {
      setSit(!game.current.sitting);
    } else if (key === "m") {
      // M to meditate: asks how long, or ends the one under way.
      if (sitting$.current) endSitting(false);
      else setChoosing((on) => !on);
    }
  };
  const onKeyUp = (e: React.KeyboardEvent) => game.current.keys.delete(keyOf(e));

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!entered) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    game.current.drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current;
    const d = g.drag;
    // Moving the mouse shows the controls; dragging to look around doesn't.
    if (!d && e.pointerType === "mouse" && Math.abs(e.movementX) + Math.abs(e.movementY) > 2)
      wake();
    if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    g.yaw += (e.clientX - d.x) * LOOK;
    g.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, g.pitch + (e.clientY - d.y) * LOOK));
    d.x = e.clientX;
    d.y = e.clientY;
    if (d.moved) setHint(false);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = game.current;
    const d = g.drag;
    g.drag = null;
    if (!d || d.moved || !entered) return;
    // While the controls are hidden, a tap only brings them back.
    if (quiet) {
      wake();
      return;
    }
    // A click on the ground: walk there.
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const at = sceneRef.current?.pick(nx, ny);
    if (at) {
      if (g.sitting) setSit(false);
      g.goal = at;
      setHint(false);
    }
  };

  return (
    <div
      ref={shellRef}
      className={
        fullscreen
          ? "h-full w-full bg-black"
          : immersive
            ? "fixed inset-0 z-[100] h-[100dvh] w-full bg-black"
            : undefined
      }
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => game.current.keys.clear()}
        aria-label={`${world.title} in 3D. Use W and S or the up and down arrows to walk, A and D to step sideways, the left and right arrows to turn, C to sit down or stand up, and M to meditate.`}
        style={{ background: place.background }}
        className={`relative w-full overflow-hidden outline-none ${
          covering ? "h-full" : "h-[max(460px,calc(100dvh-4.1rem))]"
        } ${quiet ? "cursor-none" : ""}`}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (game.current.drag = null)}
          onContextMenu={(e) => e.preventDefault()}
          aria-hidden
        />

        {/* The corners fall away into the dark, as they do for an eye at night. */}
        {place.vignette && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 46%, transparent 52%, ${place.vignette} 135%)`,
            }}
          />
        )}
        {/* The dark the welcome sits on; it lifts as they step in. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-[#0b1638] transition-opacity duration-[2200ms] ease-out ${entered ? "opacity-0" : "opacity-70"}`}
        />

        {/* The breath, kept low in the view: in as the ring swells, out as it sinks. */}
        {sitFor && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-[11%] flex flex-col items-center gap-3 text-white"
          >
            <div className="relative grid size-28 place-items-center">
              <div
                className="breath-ring absolute inset-0 rounded-full border border-white/80 bg-white/10 shadow-[0_0_28px_rgba(255,255,255,0.35)]"
                style={{ animationDuration: `${BREATH_IN + BREATH_OUT}s` }}
              />
              <div className="size-1.5 rounded-full bg-white/80" />
            </div>
            {/* The words for the first minute; after that the ring is enough. */}
            <div className="breath-words relative h-6 w-40 text-center text-sm font-semibold tracking-wide [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
              <span
                className="breath-in absolute inset-0"
                style={{ animationDuration: `${BREATH_IN + BREATH_OUT}s` }}
              >
                Breathe in
              </span>
              <span
                className="breath-out absolute inset-0"
                style={{ animationDuration: `${BREATH_IN + BREATH_OUT}s` }}
              >
                Breathe out
              </span>
            </div>
          </div>
        )}
        {/* What the guide is saying, for anyone sitting in silence or hard of hearing. */}
        {caption && (
          <p
            key={caption}
            aria-hidden
            className="fade-in pointer-events-none absolute inset-x-0 bottom-[calc(11%+11.5rem)] mx-auto max-w-md px-6 text-center text-base leading-relaxed text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.75)] sm:text-lg"
          >
            {caption}
          </p>
        )}
        {rested && !sitFor && !caption && (
          <p className="fade-in pointer-events-none absolute inset-x-0 bottom-[14%] px-6 text-center text-lg text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.7)]">
            That&apos;s the time. Stay as long as you like.
          </p>
        )}
        <p role="status" className="sr-only">
          {caption
            ? caption
            : sitFor
            ? `Meditation started, ${sitFor.minutes} ${sitFor.minutes === 1 ? "minute" : "minutes"}. Breathe in for ${BREATH_IN} seconds and out for ${BREATH_OUT}; a soft tone rises and falls with the breath. A bowl rings three times at the end.`
            : rested
              ? "The meditation has ended. Stay as long as you like."
              : ""}
        </p>

        {mode === "unsupported" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <p className="max-w-sm">
              This browser can&apos;t draw the 3D world (WebGL is off or missing).
            </p>
          </div>
        )}

        {!entered && mode !== "unsupported" && (
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md bg-[#f3efe2] p-6 text-[#141414] shadow-2xl sm:p-8">
              <p className="text-sm font-semibold tracking-wide text-[#5c5c5c] uppercase">
                Step into a painting
              </p>
              <h2 className="mt-2 text-3xl leading-tight font-semibold sm:text-4xl">
                {world.title}
              </h2>
              <p className="mt-1 text-[#5c5c5c]">
                After {world.artist}, {world.year}
              </p>
              <p className="mt-4 leading-relaxed">{world.intro}</p>
              <p className="mt-3 leading-relaxed">
                When you&apos;ve found a place you like, choose Meditate to sit and breathe there
                for a few minutes.
              </p>
              {world.creators?.length ? (
                <p className="mt-4 text-sm text-[#5c5c5c]">
                  A painting world by <Creators creators={world.creators} />.
                </p>
              ) : null}
              <p className={`${world.creators?.length ? "mt-1" : "mt-4"} text-sm text-[#5c5c5c]`}>
                Drawn with code, not copied from a photograph. The painting itself is at{" "}
                <a
                  href={world.heldBy.url}
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {world.heldBy.institution}
                </a>
                .
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={mode !== "ready"}
                  onClick={() => enter(true)}
                  className="inline-flex items-center gap-2 bg-[#141414] px-5 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {mode === "ready" ? "Enter with sound" : "Painting the world…"}
                  {mode === "ready" && <Arrow />}
                </button>
                {mode === "ready" && (
                  <button
                    type="button"
                    onClick={() => enter(false)}
                    className="px-3 py-3 font-semibold underline underline-offset-4"
                  >
                    Enter in silence
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {entered && (
          // Hidden controls can't be pressed by accident: the first tap only shows them.
          <div
            onPointerDownCapture={wake}
            className={`pointer-events-none absolute inset-0 transition-[opacity,visibility] ${quiet ? "invisible opacity-0 duration-[1500ms]" : "opacity-100 duration-300"}`}
          >
            {/* The title, and the hint under it however many lines the title takes. */}
            <div className="absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2">
              <div className="pointer-events-auto bg-[#f3efe2] px-3.5 py-2 text-sm text-[#141414] shadow-lg">
                <span className="font-semibold">{world.title}</span>
                <span className="text-[#5c5c5c]">
                  {" "}
                  · after {world.artist}, {world.year}
                </span>
              </div>

              {hint && (
                <p className="max-w-xs bg-black/45 px-3 py-2 text-sm text-white backdrop-blur-sm">
                  {touch
                    ? `Drag to look around. Walk with the stick, or tap ${place.ground} to walk there.`
                    : `Drag to look around. Walk with WASD or the arrow keys, or click ${place.ground}. Press C to sit.`}
                </p>
              )}
            </div>

            <div className="pointer-events-auto absolute right-3 bottom-3 flex flex-wrap items-end justify-end gap-2 max-sm:flex-col">
              {sitFor ? (
                <button
                  type="button"
                  onClick={() => endSitting(false)}
                  className="bg-[#f3efe2] px-4 py-2.5 text-sm font-semibold text-[#141414] shadow-lg"
                >
                  End meditation · <Remaining endAt={sitFor.endAt} />
                </button>
              ) : choosing ? (
                <div
                  role="group"
                  aria-label="Meditate"
                  className="w-72 max-w-[calc(100vw-1.5rem)] bg-[#f3efe2] p-4 text-[#141414] shadow-lg"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor={barId} className="text-sm font-semibold">
                      Meditate for
                    </label>
                    <output htmlFor={barId} className="text-2xl font-semibold tabular-nums">
                      {plan.minutes} min
                    </output>
                  </div>
                  {/* Drag the bar to set how long. */}
                  <input
                    id={barId}
                    type="range"
                    autoFocus
                    min={SITTING.min}
                    max={SITTING.max}
                    step={1}
                    value={plan.minutes}
                    onChange={(e) => setPlan({ ...plan, minutes: Number(e.target.value) })}
                    aria-valuetext={`${plan.minutes} ${plan.minutes === 1 ? "minute" : "minutes"}`}
                    style={{
                      "--fill": `${((plan.minutes - SITTING.min) / (SITTING.max - SITTING.min)) * 100}%`,
                    } as React.CSSProperties}
                    className="sitting-bar mt-2 w-full"
                  />
                  <div aria-hidden className="flex justify-between text-xs text-[#5c5c5c]">
                    <span>{SITTING.min} min</span>
                    <span>drag to set</span>
                    <span>{SITTING.max} min</span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Guidance"
                    className="mt-4 grid grid-cols-2 border border-[#141414]/30 text-sm font-semibold"
                  >
                    {[true, false].map((guided) => (
                      <button
                        key={String(guided)}
                        type="button"
                        role="radio"
                        aria-checked={plan.guided === guided}
                        onClick={() => setPlan({ ...plan, guided })}
                        className={`px-2 py-2 ${plan.guided === guided ? "bg-[#141414] text-white" : "hover:bg-white"}`}
                      >
                        {guided ? "With guidance" : "Without"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-[#5c5c5c]">
                    {!plan.guided
                      ? "Only the breath: the ring, the tone and the bowl."
                      : sound
                        ? "A voice settles you, speaks a few times, then leaves you to it."
                        : "Sound is off, so the guidance will show as words."}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => beginSitting(plan)}
                      className="inline-flex flex-1 items-center justify-center gap-2 bg-[#141414] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Begin <Arrow />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChoosing(false);
                        containerRef.current?.focus({ preventScroll: true });
                      }}
                      className="px-3 py-2.5 text-sm font-semibold underline underline-offset-4"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setChoosing(true)}
                  className="bg-[#f3efe2] px-4 py-2.5 text-sm font-semibold text-[#141414] shadow-lg"
                >
                  Meditate
                </button>
              )}
              <button
                type="button"
                onClick={() => setSit(!sitting)}
                className="bg-black/50 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
              >
                {sitting ? "Stand up" : "Sit for a while"}
              </button>
              <button
                type="button"
                onClick={toggleSound}
                className="bg-black/50 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
              >
                {sound ? "Sound off" : "Sound on"}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="bg-black/50 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
              >
                {covering ? "Exit full screen" : "Full screen"}
              </button>
              <Link
                href={back}
                className="inline-flex items-center gap-1.5 bg-black/50 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
              >
                Back to the museum <Arrow />
              </Link>
            </div>

            {touch && !sitting && (
              <div className="pointer-events-auto">
                <Stick
                  onChange={(x, y) => {
                    game.current.stick = { x, y };
                    if (x || y) setHint(false);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
