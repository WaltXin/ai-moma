import type { Movement } from "@/lib/museum/types";

/**
 * Studio settings for a movement whose prompt template hasn't been
 * benchmarked yet. `describe` turns the visitor's words into a prompt about
 * style and technique, never "in the style of <artist>".
 */
export function plannedStudio(describe: (userPrompt: string) => string): Movement["studio"] {
  return { status: "planned", inputs: ["prompt", "image"], output: "image", buildPrompt: describe };
}
