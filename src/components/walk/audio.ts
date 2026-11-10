import { type Mood, type Surface, hz, nextDegree, noteOf } from "@/lib/walk/music";
import type { Air } from "@/lib/worlds/place";

/**
 * The museum's sound, made live with the Web Audio API: a generative score in
 * each floor's mood (`lib/walk/music.ts`), the hum of a quiet building,
 * footsteps on oak or terrazzo, the lift's chime and doors, all in one shared
 * reverb so they sound like the same big room.
 *
 * One engine lives for the whole visit, so taking the lift crossfades the
 * music instead of cutting it. Browsers only allow sound after a click or key
 * press, so it starts from the "Enter" button.
 */

const PREF = "ai-moma:sound";

/** Whether the visitor last chose sound on (the default) or off. */
export function soundPreferred(): boolean {
  try {
    return localStorage.getItem(PREF) !== "off";
  } catch {
    return true;
  }
}

function rememberSound(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? "on" : "off");
  } catch {
    // Private windows can refuse storage; the choice just won't be remembered.
  }
}

let engine: MuseumAudio | null = null;
let entered = false;

/** Whether the visitor has already come in through the welcome during this visit. */
export const hasEntered = () => entered;
export const markEntered = () => {
  entered = true;
};

/** The running engine, if sound has been started. */
export const getAudio = () => engine;

/**
 * On iPhone, Safari silences web audio while the ring/silent switch is on
 * silent. Asking for a "playback" session (Safari 16.4+) lets the music play
 * as a music app's would; "auto" hands the choice back when sound is off.
 */
function audioSession(playing: boolean) {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = playing ? "playback" : "auto";
  } catch {
    // Older Safari: the switch decides.
  }
}

/**
 * Starts (or wakes) the engine. Call from a click or key handler. Pass
 * `withSound` when the click says whether the visitor wants sound: the
 * iPhone's audio session has to be chosen before the context starts, and
 * an earlier "Sound off" remembered in storage mustn't choose it instead.
 */
export function startAudio(withSound?: boolean): MuseumAudio | null {
  const on = withSound ?? (engine ? !engine.muted : soundPreferred());
  // Before the context starts, or Safari keeps the ringer's say.
  audioSession(on);
  if (!engine) {
    try {
      engine = new MuseumAudio(!on);
    } catch {
      return null;
    }
  }
  if (on) void engine.ctx.resume();
  return engine;
}

export class MuseumAudio {
  readonly ctx: AudioContext;
  muted: boolean;
  private focused = false;
  private voiced = false;
  /** Everything musical goes through here, so a painting up close can muffle it. */
  readonly musicBus: GainNode;
  /** Send to the shared reverb. */
  readonly wet: GainNode;
  private readonly master: GainNode;
  private readonly musicLevel: GainNode;
  private readonly musicTone: BiquadFilterNode;
  private readonly sfx: GainNode;
  private readonly hum: GainNode;
  private readonly noise: AudioBuffer;
  /** Return from the reverb: more in the atrium, none in the street. */
  private readonly reverbOut: GainNode;
  /** Voices far off in a big room: the murmur of other visitors. */
  private readonly murmur: GainNode;
  /** The street: traffic's rumble, louder as a car goes by, and where it is. */
  private readonly street: GainNode;
  private readonly car: GainNode;
  private readonly carPan: StereoPannerNode;
  private readonly carTone: BiquadFilterNode;
  private readonly brown: AudioBuffer;
  /** The air of a painting world, while the visitor is in one: wind, crickets, a far bell. */
  private airNow: { out: GainNode; stop(): void; silence(): void } | null = null;
  private place: "outside" | "hall" | "room" | "open" = "room";
  private score: Score | null = null;
  private mood: Mood | null = null;
  private suspendTimer = 0;

  constructor(muted = !soundPreferred()) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("No Web Audio");
    this.ctx = new Ctx({ latencyHint: "interactive" });
    const ctx = this.ctx;
    this.muted = muted;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    limiter.connect(ctx.destination);
    this.master = gain(ctx, this.muted ? 0 : 0.9, limiter);

    this.musicLevel = gain(ctx, 0.34, this.master);
    this.musicTone = ctx.createBiquadFilter();
    this.musicTone.type = "lowpass";
    this.musicTone.frequency.value = 16000;
    this.musicTone.connect(this.musicLevel);
    this.musicBus = gain(ctx, 1, this.musicTone);
    this.sfx = gain(ctx, 0.55, this.master);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.4);
    this.reverbOut = gain(ctx, 0.5, this.master);
    reverb.connect(this.reverbOut);
    this.wet = gain(ctx, 1, reverb);

    // White noise for footsteps and doors.
    this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.5), ctx.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

    // The building's hum: brown noise, low and soft, always there.
    const brown = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    this.brown = brown;
    const b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < b.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }
    const hum = ctx.createBufferSource();
    hum.buffer = brown;
    hum.loop = true;
    const humTone = ctx.createBiquadFilter();
    humTone.type = "lowpass";
    humTone.frequency.value = 240;
    this.hum = gain(ctx, 0, this.master);
    hum.connect(humTone).connect(this.hum);
    hum.start();

    // Murmur: pink-ish noise through a band of voices, swelling and fading slowly.
    const voices = ctx.createBufferSource();
    voices.buffer = brown;
    voices.loop = true;
    voices.playbackRate.value = 3.2;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 480;
    band.Q.value = 0.9;
    const swell = ctx.createGain();
    swell.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.21;
    const lfoDepth = gain(ctx, 0.35);
    lfo.connect(lfoDepth);
    lfoDepth.connect(swell.gain);
    lfo.start();
    this.murmur = gain(ctx, 0, this.master);
    voices.connect(band).connect(swell).connect(this.murmur);
    swell.connect(gain(ctx, 0.6, this.wet));
    voices.start();

    // The street: a low wash of distant traffic, and the car going by.
    const traffic = ctx.createBufferSource();
    traffic.buffer = brown;
    traffic.loop = true;
    const trafficTone = ctx.createBiquadFilter();
    trafficTone.type = "lowpass";
    trafficTone.frequency.value = 420;
    this.street = gain(ctx, 0, this.master);
    traffic.connect(trafficTone).connect(this.street);
    traffic.start();
    const tyres = ctx.createBufferSource();
    tyres.buffer = this.noise;
    tyres.loop = true;
    this.carTone = ctx.createBiquadFilter();
    this.carTone.type = "bandpass";
    this.carTone.frequency.value = 700;
    this.carTone.Q.value = 0.6;
    this.carPan = ctx.createStereoPanner();
    this.car = gain(ctx, 0, this.carPan);
    this.carPan.connect(this.master);
    tyres.connect(this.carTone).connect(this.car);
    tyres.start();

    // Stop work in a hidden tab, pick up where it left off on return.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void ctx.suspend();
      else this.wake();
    });
    // iPhone stops the sound when the screen locks, a call or another app
    // takes over, or the tab goes to the background ("interrupted"), and
    // only lets it start again from a tap or key. So every tap tries.
    for (const type of ["touchend", "pointerup", "click", "keydown"])
      document.addEventListener(type, () => this.wake(), { capture: true, passive: true });
  }

  /** Starts the sound again after the system stopped it, unless the visitor turned it off. */
  wake() {
    if (this.muted || document.hidden || (this.ctx.state as string) === "running") return;
    audioSession(true);
    void this.ctx.resume();
  }

  /** Plays a floor's music, crossfading from whatever was playing. */
  play(mood: Mood) {
    const t = this.ctx.currentTime;
    this.hum.gain.setTargetAtTime(0.045, t, 0.8);
    if (this.mood === mood && this.score) return;
    this.score?.stop(3);
    this.mood = mood;
    this.score = new Score(this, mood);
  }

  /**
   * Fades everything out when the visitor leaves the walk for another page.
   * Only if `mood` is still playing: a floor arrived at by lift may already have taken over.
   */
  release(mood: Mood) {
    if (this.mood !== mood) return;
    this.score?.stop(1.5);
    this.score = null;
    this.mood = null;
    const t = this.ctx.currentTime;
    for (const g of [this.hum, this.murmur, this.street, this.car])
      g.gain.setTargetAtTime(0, t, 0.4);
    this.air(null);
    this.place = "room";
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    rememberSound(!muted);
    const t = this.ctx.currentTime;
    window.clearTimeout(this.suspendTimer);
    audioSession(!muted);
    if (muted) {
      this.master.gain.setTargetAtTime(0, t, 0.08);
      this.suspendTimer = window.setTimeout(() => void this.ctx.suspend(), 600);
    } else {
      void this.ctx.resume();
      this.master.gain.setTargetAtTime(0.9, t, 0.15);
    }
  }

  /**
   * Where the visitor is: out in the street (traffic, no echo, the music far
   * off), in a big hall (long echo, a murmur of voices), in a room, or out in
   * the open in a painting (no building round them at all).
   */
  setPlace(place: "outside" | "hall" | "room" | "open") {
    if (place === this.place) return;
    this.place = place;
    const t = this.ctx.currentTime;
    this.reverbOut.gain.setTargetAtTime(
      place === "outside" ? 0.08 : place === "hall" ? 0.75 : place === "open" ? 0.3 : 0.45,
      t,
      0.6,
    );
    this.murmur.gain.setTargetAtTime(place === "hall" ? 0.05 : place === "room" ? 0.012 : 0, t, 1);
    this.street.gain.setTargetAtTime(
      place === "outside" ? 0.22 : place === "open" ? 0 : 0.015,
      t,
      0.8,
    );
    this.musicLevel.gain.setTargetAtTime(place === "outside" ? 0.1 : 0.34, t, 1.2);
    this.hum.gain.setTargetAtTime(place === "outside" || place === "open" ? 0 : 0.045, t, 0.8);
  }

  /**
   * The air of a painting world: wind that comes and goes in gusts, crickets
   * in the grass on either side, and now and then a bell from far below.
   * `null` stills it.
   */
  air(air: Air | null) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.airNow) {
      const old = this.airNow;
      this.airNow = null;
      // No more bells from now; the rest fades, then stops.
      old.silence();
      old.out.gain.setTargetAtTime(0, t, 0.5);
      window.setTimeout(() => old.stop(), 3000);
    }
    if (!air) return;
    const out = gain(ctx, 0, this.master);
    out.gain.setTargetAtTime(1, t, 1.5);
    const running: AudioScheduledSourceNode[] = [];
    const start = <T extends AudioScheduledSourceNode>(node: T) => {
      node.start();
      running.push(node);
      return node;
    };
    /** A slow sine that swings a gain or a filter about its own value. */
    const swing = (to: AudioParam, rate: number, depth: number) => {
      const lfo = start(ctx.createOscillator());
      lfo.frequency.value = rate;
      lfo.connect(gain(ctx, depth)).connect(to);
    };

    if (air.wind > 0) {
      // Gusts: two slow swells that drift in and out of step, so no two are alike.
      const gusts = gain(ctx, 0.55, out);
      swing(gusts.gain, 0.071, 0.27);
      swing(gusts.gain, 0.19, 0.16);
      // The body of the wind, low and wide.
      const body = start(ctx.createBufferSource());
      body.buffer = this.brown;
      body.loop = true;
      body.playbackRate.value = 1.7;
      const bodyTone = ctx.createBiquadFilter();
      bodyTone.type = "bandpass";
      bodyTone.frequency.value = 360;
      bodyTone.Q.value = 0.45;
      swing(bodyTone.frequency, 0.11, 130);
      body.connect(bodyTone).connect(gain(ctx, 0.19 * air.wind, gusts));
      // And the hiss of it in the grass and the cypress.
      const hiss = start(ctx.createBufferSource());
      hiss.buffer = this.noise;
      hiss.loop = true;
      const hissTone = ctx.createBiquadFilter();
      hissTone.type = "bandpass";
      hissTone.frequency.value = 3200;
      hissTone.Q.value = 0.6;
      swing(hissTone.frequency, 0.13, 900);
      hiss.connect(hissTone).connect(gain(ctx, 0.012 * air.wind, gusts));
    }

    if (air.crickets > 0) {
      // Each cricket: a high note, pulsed fast, trilling for a while and resting for a while.
      for (const [pitch, pulse, rest, pan] of [
        [4300, 21, 0.31, -0.7],
        [4850, 25, 0.23, 0.6],
        [3950, 18, 0.17, 0.15],
      ]) {
        const note = start(ctx.createOscillator());
        note.frequency.value = pitch;
        const pulsed = gain(ctx, 0.5);
        swing(pulsed.gain, pulse, 0.5);
        // Only the top of a slow swell opens it, so each trill has silence after it.
        const trill = gain(ctx, 0);
        const swell = start(ctx.createOscillator());
        swell.frequency.value = rest;
        const top = ctx.createWaveShaper();
        top.curve = new Float32Array([0, 0, 0, 0.5, 1]);
        swell.connect(top).connect(trill.gain);
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        note.connect(pulsed).connect(trill).connect(p);
        p.connect(gain(ctx, 0.012 * air.crickets, out));
      }
    }

    let bellTimer = 0;
    if (air.bell > 0) {
      const toll = () => {
        if (!this.muted && !document.hidden) {
          const strokes = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < strokes; i++)
            this.bell(out, ctx.currentTime + 0.1 + i * 2.6, air.bell);
        }
        bellTimer = window.setTimeout(toll, (95 + Math.random() * 70) * 1000);
      };
      bellTimer = window.setTimeout(toll, (22 + Math.random() * 14) * 1000);
    }

    this.airNow = {
      out,
      stop() {
        for (const node of running) node.stop();
        out.disconnect();
      },
      silence: () => window.clearTimeout(bellTimer),
    };
  }

  /** One stroke of a church bell a long way off: its partials, dulled by the distance, in a long echo. */
  private bell(to: AudioNode, t: number, level: number) {
    const ctx = this.ctx;
    const far = ctx.createBiquadFilter();
    far.type = "lowpass";
    far.frequency.value = 1100;
    far.connect(gain(ctx, 0.05 * level, to));
    far.connect(gain(ctx, 0.05 * level, this.wet));
    // Hum, prime, the minor third that makes a bell a bell, quint, nominal.
    for (const [ratio, peak, decay] of [
      [0.5, 0.5, 5.5],
      [1, 1, 4],
      [1.19, 0.55, 2.6],
      [1.5, 0.3, 1.8],
      [2, 0.45, 1.4],
      [2.67, 0.12, 0.8],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = 311 * ratio;
      o.connect(envelope(ctx, t, peak, decay)).connect(far);
      o.start(t);
      o.stop(t + decay + 0.2);
    }
  }

  /** A car `dist` metres off, `pan` −1 (left) to 1 (right); quieter indoors. */
  traffic(dist: number, pan: number, speed: number) {
    const t = this.ctx.currentTime;
    const near = Math.max(0, 1 - dist / 40);
    const through = this.place === "outside" ? 1 : 0.08;
    this.car.gain.setTargetAtTime(
      near * near * 0.12 * through * Math.min(1.3, speed / 10),
      t,
      0.08,
    );
    this.carPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.08);
    this.carTone.frequency.setTargetAtTime(500 + near * 700, t, 0.1);
  }

  /** Up close to a painting, the music steps back and softens. */
  focus(on: boolean) {
    this.focused = on;
    const t = this.ctx.currentTime;
    this.musicTone.frequency.setTargetAtTime(on ? 1100 : 16000, t, 0.35);
    this.musicLevel.gain.setTargetAtTime(this.voiced ? 0.05 : on ? 0.22 : 0.34, t, 0.35);
  }

  /** While an audio guide speaks, the music sinks almost away, and comes back after. */
  underVoice(on: boolean) {
    this.voiced = on;
    this.focus(this.focused);
  }

  footstep(surface: Surface | "grass", strength = 1) {
    if (this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    if (surface === "grass") {
      // A foot pressing grass down: a soft brush of it, and the dull give of the earth under.
      const brush = ctx.createBufferSource();
      brush.buffer = this.noise;
      brush.playbackRate.value = 0.7 + Math.random() * 0.4;
      const tone = ctx.createBiquadFilter();
      tone.type = "bandpass";
      tone.frequency.value = 1500 + Math.random() * 900;
      tone.Q.value = 0.5;
      const env = ctx.createGain();
      const peak = 0.16 * strength * (0.75 + Math.random() * 0.5);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.035);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 + Math.random() * 0.06);
      brush.connect(tone).connect(env).connect(this.sfx);
      brush.start(t, Math.random() * 1.2, 0.35);
      const thud = ctx.createOscillator();
      thud.frequency.setValueAtTime(82, t);
      thud.frequency.exponentialRampToValueAtTime(48, t + 0.09);
      thud.connect(envelope(ctx, t, 0.16 * strength, 0.09)).connect(this.sfx);
      thud.start(t);
      thud.stop(t + 0.16);
      return;
    }
    // Decking sounds like boards; the pavement like stone, without the echo.
    const wood = surface === "wood" || surface === "deck";
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = (wood ? 520 : 2400) * (0.9 + Math.random() * 0.2);
    band.Q.value = wood ? 1.1 : 0.7;
    const level = (wood ? 0.55 : 0.32) * strength * (0.8 + Math.random() * 0.3);
    const env = envelope(ctx, t, level, wood ? 0.1 : 0.065);
    src.connect(band).connect(env);
    env.connect(this.sfx);
    env.connect(
      gain(ctx, surface === "street" || surface === "deck" ? 0.02 : wood ? 0.12 : 0.3, this.wet),
    );
    src.start(t, Math.random() * 1.2, 0.2);

    if (wood) {
      // The boards give a little: a soft low knock under the scuff.
      const knock = ctx.createOscillator();
      knock.frequency.setValueAtTime(110, t);
      knock.frequency.exponentialRampToValueAtTime(60, t + 0.08);
      const kEnv = envelope(ctx, t, 0.22 * strength, 0.08);
      knock.connect(kEnv).connect(this.sfx);
      knock.start(t);
      knock.stop(t + 0.15);
    }
  }

  /** The lift's two-note chime, placed left or right of the listener. */
  chime(pan = 0, level = 1) {
    if (this.muted) return;
    const ctx = this.ctx;
    const out = panned(ctx, pan, level, this.sfx, this.wet);
    [1318.5, 1046.5].forEach((f, i) => {
      const t = ctx.currentTime + 0.02 + i * 0.42;
      for (const [ratio, amp] of [
        [1, 0.16],
        [2.76, 0.05],
        [5.4, 0.02],
      ]) {
        const o = ctx.createOscillator();
        o.frequency.value = f * ratio;
        const env = envelope(ctx, t, amp, 1.6 / ratio);
        o.connect(env).connect(out);
        o.start(t);
        o.stop(t + 2);
      }
    });
  }

  /** The lift doors sliding. */
  doors(pan = 0, level = 1, opening = true) {
    if (this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const out = panned(ctx, pan, level, this.sfx, this.wet);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 2.2;
    band.frequency.setValueAtTime(opening ? 260 : 700, t);
    band.frequency.linearRampToValueAtTime(opening ? 700 : 260, t + 1.1);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16, t + 0.15);
    env.gain.setValueAtTime(0.16, t + 0.85);
    env.gain.linearRampToValueAtTime(0, t + 1.2);
    src.connect(band).connect(env).connect(out);
    src.start(t, 0, 1.3);
  }
}

/** One floor's music: a scheduler that writes a few notes ahead of the clock. */
class Score {
  private readonly out: GainNode;
  private readonly timer: number;
  private next: number;
  private step = 0;
  private degree: number;
  private chord: number[];

  constructor(
    private readonly audio: MuseumAudio,
    private readonly mood: Mood,
  ) {
    const ctx = audio.ctx;
    this.out = gain(ctx, 0, audio.musicBus);
    this.out.connect(gain(ctx, 0.85, audio.wet));
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    this.degree = Math.round((mood.range[0] + mood.range[1]) / 2);
    this.chord = mood.chords[0];
    this.next = ctx.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(fade: number) {
    window.clearInterval(this.timer);
    const t = this.audio.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, fade / 4);
    window.setTimeout(() => this.out.disconnect(), (fade + 6) * 1000);
  }

  private schedule() {
    const now = this.audio.ctx.currentTime;
    // After a pause (muted, hidden tab), carry on from now instead of catching up.
    if (this.next < now) this.next = now + 0.05;
    while (this.next < now + 0.3) {
      this.play(this.next);
      this.next += this.mood.beat;
      this.step++;
    }
  }

  private play(t: number) {
    const { mood } = this;
    const bar = 16;
    if (this.step % bar === 0) {
      this.chord = mood.chords[(this.step / bar) % mood.chords.length];
      this.pad(t, bar * mood.beat + 3);
    }
    if (mood.pulse && this.step % 2 === 0) {
      this.pluck(t, noteOf(mood, this.chord[0]) - 24, this.step % 8 === 0 ? 0.11 : 0.07);
    }
    // Lean on the strong beats; leave space on the weak ones.
    const odds = mood.density * (this.step % 4 === 0 ? 1.35 : 0.75);
    if (Math.random() < odds) {
      this.degree = nextDegree(mood, this.degree, Math.random);
      const swing = Math.random() * 0.03;
      const vel = 0.07 + Math.random() * 0.06;
      this.bell(t + swing, noteOf(mood, this.degree), vel);
      if (Math.random() < 0.18)
        this.bell(t + swing + 0.01, noteOf(mood, this.degree - 2), vel * 0.6);
    }
  }

  /** A slow, soft chord: two detuned voices per note through a gentle filter. */
  private pad(t: number, dur: number) {
    const ctx = this.audio.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.mood.brightness * 0.55;
    filter.Q.value = 0.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.05, t + 2.8);
    env.gain.setValueAtTime(0.05, t + dur - 3);
    env.gain.linearRampToValueAtTime(0, t + dur);
    filter.connect(env).connect(this.out);
    for (const d of this.chord) {
      const f = hz(noteOf(this.mood, d) - 12);
      for (const [type, cents] of [
        ["triangle", -5],
        ["sawtooth", 6],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = cents;
        const level = gain(ctx, type === "sawtooth" ? 0.35 : 1, filter);
        o.connect(level);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  /** A soft electric-piano note: a sine shaped by a fading modulator. */
  private bell(t: number, midi: number, vel: number) {
    const ctx = this.audio.ctx;
    const f = hz(midi);
    const carrier = ctx.createOscillator();
    carrier.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(f * 1.1, t);
    depth.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.7);
    mod.connect(depth).connect(carrier.frequency);
    const env = envelope(ctx, t, vel, 2.6);
    carrier.connect(env).connect(this.out);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + 3);
    mod.stop(t + 3);
  }

  /** A short, round bass note. */
  private pluck(t: number, midi: number, vel: number) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = hz(midi);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(900, t);
    tone.frequency.exponentialRampToValueAtTime(220, t + 0.4);
    const env = envelope(ctx, t, vel, 0.5);
    o.connect(tone).connect(env).connect(this.out);
    o.start(t);
    o.stop(t + 0.7);
  }
}

function gain(ctx: AudioContext, value: number, to?: AudioNode): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  if (to) g.connect(to);
  return g;
}

/** A quick attack and an exponential fade: the shape of anything struck. */
function envelope(ctx: AudioContext, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.005 + decay);
  return g;
}

function panned(ctx: AudioContext, pan: number, level: number, dry: AudioNode, wet: AudioNode) {
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  const g = gain(ctx, level, p);
  p.connect(dry);
  p.connect(gain(ctx, 0.5, wet));
  return g;
}

/** A big, soft room: decaying stereo noise after a short pre-delay. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.round(ctx.sampleRate * seconds);
  const pre = Math.round(ctx.sampleRate * 0.025);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = pre; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - (i - pre) / (len - pre)) ** 3.2;
    }
  }
  return buf;
}
