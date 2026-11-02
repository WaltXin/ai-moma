import { stubProvider } from "./stub";

/**
 * OpenAI image models (e.g. the GPT Image family).
 * Status: not implemented. Requires: OPENAI_API_KEY
 * TODO: call the API and return a GenerationResult.
 */
export const openaiProvider = stubProvider({
  id: "openai",
  label: "OpenAI (GPT Image)",
  envKeys: ["OPENAI_API_KEY"],
  capabilities: { textToImage: true, imageToImage: true },
});
