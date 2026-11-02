import {
  ProviderNotImplementedError,
  type ImageProvider,
  type ProviderCapabilities,
  type ProviderId,
} from "../types";

/**
 * Builds a placeholder provider that knows its env vars but cannot
 * generate yet. Replace `generate` with a real API call when you
 * implement one.
 */
export function stubProvider(opts: {
  id: ProviderId;
  label: string;
  envKeys: string[];
  capabilities: ProviderCapabilities;
}): ImageProvider {
  return {
    id: opts.id,
    label: opts.label,
    capabilities: opts.capabilities,
    isConfigured: () => opts.envKeys.every((k) => Boolean(process.env[k])),
    async generate() {
      throw new ProviderNotImplementedError(opts.id);
    },
  };
}
