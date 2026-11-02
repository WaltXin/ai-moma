/**
 * Image generation is provider-agnostic. Each backend (OpenAI, Google,
 * Black Forest Labs, a self-hosted Qwen-Image, …) implements
 * `ImageProvider`, and the rest of the app only talks to this interface.
 *
 * Which model is "best" for a movement is an open question (see
 * docs/ROADMAP.md). Keeping providers swappable lets us benchmark them
 * side by side and lets self-hosters pick whatever they can afford.
 */

export type ProviderId = "mock" | "openai" | "google" | "bfl" | "qwen";

export type SourceImage = {
  /** Raw bytes of an uploaded image. */
  data: Uint8Array;
  mimeType: string;
};

export type GenerationRequest = {
  /** Final prompt, already shaped by the movement's `buildPrompt`. */
  prompt: string;
  /** The visitor's original words, kept for provenance. */
  userPrompt: string;
  movement: string;
  /** Present for image-to-image ("make my photo Pop Art"). */
  sourceImage?: SourceImage;
  /** Hint for providers that let you choose an aspect ratio. */
  aspectRatio?: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
};

export type GenerationResult = {
  /** Generated image. A data: URL for now; object storage later. */
  imageUrl: string;
  mimeType: string;
  provider: ProviderId;
  model?: string;
};

export type ProviderCapabilities = {
  textToImage: boolean;
  imageToImage: boolean;
};

export interface ImageProvider {
  id: ProviderId;
  label: string;
  capabilities: ProviderCapabilities;
  /** True when the env vars this provider needs are present. */
  isConfigured(): boolean;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: ProviderId) {
    super(
      `The "${provider}" provider is not implemented yet. ` +
        `See src/lib/generation/providers/${provider}.ts and CONTRIBUTING.md.`,
    );
    this.name = "ProviderNotImplementedError";
  }
}
