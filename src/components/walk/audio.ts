import { type Mood, type Surface, hz, nextDegree, noteOf } from "@/lib/walk/music";

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

/** Starts (or wakes) the engine. Call from a click or key handler. */
export function startAudio(): MuseumAudio | null {
  // Before the context starts, or Safari keeps the ringer's say.
  audioSession(engine ? !engine.muted : soundPreferred());
  if (!engine) {
    try {
      engine = new MuseumAudio();
    } catch {
      return null;
    }
  }
  if (!engine.muted) void engine.ctx.resume();
  return engine;
}

export class MuseumAudio {
  readonly ctx: AudioContext;
  muted: boolean;
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
  private place: "outside" | "hall" | "room" = "room";
  private score: Score | null = null;
  private mood: Mood | null = null;
  private suspendTimer = 0;

  constructor() {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("No Web Audio");
    this.ctx = new Ctx({ latencyHint: "interactive" });
    const ctx = this.ctx;
    this.muted = !soundPreferred();

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
      else if (!this.muted) void ctx.resume();
    });
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
   * off), in a big hall (long echo, a murmur of voices) or in a room.
   */
  setPlace(place: "outside" | "hall" | "room") {
    if (place === this.place) return;
    this.place = place;
    const t = this.ctx.currentTime;
    this.reverbOut.gain.setTargetAtTime(
      place === "outside" ? 0.08 : place === "hall" ? 0.75 : 0.45,
      t,
      0.6,
    );
    this.murmur.gain.setTargetAtTime(place === "hall" ? 0.05 : place === "room" ? 0.012 : 0, t, 1);
    this.street.gain.setTargetAtTime(place === "outside" ? 0.22 : 0.015, t, 0.8);
    this.musicLevel.gain.setTargetAtTime(place === "outside" ? 0.1 : 0.34, t, 1.2);
    this.hum.gain.setTargetAtTime(place === "outside" ? 0 : 0.045, t, 0.8);
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
    const t = this.ctx.currentTime;
    this.musicTone.frequency.setTargetAtTime(on ? 1100 : 16000, t, 0.35);
    this.musicLevel.gain.setTargetAtTime(on ? 0.22 : 0.34, t, 0.35);
  }

  footstep(surface: Surface, strength = 1) {
    if (this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
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
