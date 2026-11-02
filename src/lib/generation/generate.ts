import { getMovement } from "@/lib/museum/registry";
import { resolveProvider } from "./registry";
import type { GenerationResult, SourceImage } from "./types";

export class GenerationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationInputError";
  }
}

/**
 * Studio entry point: applies the movement's prompt template, checks the
 * inputs against what the movement and provider support, then calls the
 * provider.
 */
export async function generateArtwork(input: {
  movement: string;
  userPrompt: string;
  sourceImage?: SourceImage;
  provider?: string;
}): Promise<GenerationResult> {
  const movement = getMovement(input.movement);
  if (!movement) throw new GenerationInputError(`Unknown movement "${input.movement}"`);
  if (movement.studio.status !== "available") {
    throw new GenerationInputError(`The ${movement.name} studio is not open yet`);
  }
  if (!input.userPrompt && !input.sourceImage) {
    throw new GenerationInputError("Provide a prompt, an image, or both");
  }
  if (input.sourceImage && !movement.studio.inputs.includes("image")) {
    throw new GenerationInputError(`${movement.name} does not accept image uploads`);
  }

  let provider;
  try {
    provider = resolveProvider(input.provider);
  } catch (err) {
    throw new GenerationInputError((err as Error).message);
  }
  if (input.sourceImage && !provider.capabilities.imageToImage) {
    throw new GenerationInputError(`${provider.label} cannot transform images`);
  }

  return provider.generate({
    prompt: movement.studio.buildPrompt(input.userPrompt || "the uploaded photo"),
    userPrompt: input.userPrompt,
    movement: movement.slug,
    sourceImage: input.sourceImage,
    aspectRatio: "1:1",
  });
}
