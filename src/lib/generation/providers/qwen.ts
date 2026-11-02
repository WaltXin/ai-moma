import { stubProvider } from "./stub";

/**
 * Qwen-Image (open weights). Self-host or use any hosted endpoint.
 * Status: not implemented. Requires: QWEN_IMAGE_BASE_URL
 * TODO: call the API and return a GenerationResult.
 */
export const qwenProvider = stubProvider({
  id: "qwen",
  label: "Qwen-Image (self-hosted)",
  envKeys: ["QWEN_IMAGE_BASE_URL"],
  capabilities: { textToImage: true, imageToImage: true },
});
