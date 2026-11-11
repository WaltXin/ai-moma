import type { MeditationCues } from "@/lib/worlds/meditation";

/**
 * What the voice says during a guided meditation in a painting world: short
 * cues, a few seconds each, placed along the sitting by
 * `guidanceFor` (`src/lib/worlds/meditation.ts`) however long it is, with
 * long silences between. `pnpm meditation:voice` voices each one once.
 *
 * Written to be heard with the eyes shut: plain words, one thing at a time,
 * nothing to work out. A `look-<world>` cue is said only in that world.
 */
export const meditationCues: MeditationCues = {
  settle:
    "Welcome. Let yourself settle, right where you are. Let your shoulders drop. Let your hands rest. There is nothing to do here, but sit, and breathe.",
  breath:
    "Follow the sound of the breath. Breathe in, as it rises. And breathe out, slowly, as it falls. In, for four. And out, for six.",
  "look-starry-night":
    "Let your eyes rest on the sky. You don't have to follow it. Let it turn, the way it has turned over this hill all night.",
  "look-sunflowers":
    "Let your eyes rest on the flowers above you. Some are wide open. Some are tired. Some have gone to seed. All of them are standing in the same light.",
  "look-wheat-field-with-cypresses":
    "Let your eyes rest on the wheat. The wind moves through it, and the wheat lets it go.",
  listen:
    "Now, listen. Whatever is far away, let it be far away. Whatever is close, let it be close.",
  body: "Feel the weight of your body, held by the ground. Soften your jaw. Soften your hands.",
  wander:
    "If your mind has wandered, that's all right. It's what minds do. Notice where it went, and gently come back to the breath.",
  eyes: "If you'd like, let your eyes close. The breath will go on keeping time for you.",
  quiet: "I'll be quiet for a while now. Stay with the breath.",
  closing:
    "In a moment, the bowl will ring. Before it does, take one deeper breath, and notice how you feel.",
  end: "That's the time. If your eyes were closed, let them open. Stay as long as you like.",
};
