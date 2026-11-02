import { stubProvider } from "./stub";

/**
 * Black Forest Labs FLUX models, via the BFL API.
 * Status: not implemented. Requires: BFL_API_KEY
 * TODO: call the API and return a GenerationResult.
 */
export const bflProvider = stubProvider({
  id: "bfl",
  label: "Black Forest Labs (FLUX)",
  envKeys: ["BFL_API_KEY"],
  capabilities: { textToImage: true, imageToImage: true },
});
