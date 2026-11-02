import { stubProvider } from "./stub";

/**
 * Google image models (e.g. the Nano Banana / Gemini image family).
 * Status: not implemented. Requires: GOOGLE_API_KEY
 * TODO: call the API and return a GenerationResult.
 */
export const googleProvider = stubProvider({
  id: "google",
  label: "Google (Nano Banana)",
  envKeys: ["GOOGLE_API_KEY"],
  capabilities: { textToImage: true, imageToImage: true },
});
