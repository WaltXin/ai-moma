import { bflProvider } from "./providers/bfl";
import { googleProvider } from "./providers/google";
import { mockProvider } from "./providers/mock";
import { openaiProvider } from "./providers/openai";
import { qwenProvider } from "./providers/qwen";
import type { ImageProvider, ProviderId } from "./types";

/**
 * All known providers. Midjourney is deliberately absent: it has no
 * official public API, and automating its Discord/web UI breaks its
 * Terms of Service. See docs/ARCHITECTURE.md.
 */
export const providers: Record<ProviderId, ImageProvider> = {
  mock: mockProvider,
  openai: openaiProvider,
  google: googleProvider,
  bfl: bflProvider,
  qwen: qwenProvider,
};

export function isProviderId(value: string): value is ProviderId {
  return Object.hasOwn(providers, value);
}

/** Providers whose env vars are set, for the Studio's dropdown. */
export function listAvailableProviders(): ImageProvider[] {
  return Object.values(providers).filter((p) => p.isConfigured());
}

/**
 * Picks a provider in this order: explicit request, `IMAGE_PROVIDER`
 * env var, then `mock`. Throws if the chosen provider is unknown or
 * missing credentials.
 */
export function resolveProvider(requested?: string): ImageProvider {
  const id = requested || process.env.IMAGE_PROVIDER || "mock";
  if (!isProviderId(id)) throw new Error(`Unknown image provider "${id}"`);
  const provider = providers[id];
  if (!provider.isConfigured()) {
    throw new Error(`Image provider "${id}" is not configured. Check .env.local.`);
  }
  return provider;
}
