import { afterEach, describe, expect, it, vi } from "vitest";
import { generateArtwork, GenerationInputError } from "@/lib/generation/generate";
import { listAvailableProviders, resolveProvider } from "@/lib/generation/registry";
import { ProviderNotImplementedError } from "@/lib/generation/types";

const PNG_1PX = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function decodeSvg(dataUrl: string): string {
  return Buffer.from(dataUrl.split(",")[1], "base64").toString("utf8");
}

afterEach(() => vi.unstubAllEnvs());

describe("provider registry", () => {
  it("defaults to the mock provider", () => {
    vi.stubEnv("IMAGE_PROVIDER", "");
    expect(resolveProvider().id).toBe("mock");
  });

  it("rejects unknown and unconfigured providers", () => {
    expect(() => resolveProvider("midjourney")).toThrow(/Unknown image provider/);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => resolveProvider("openai")).toThrow(/not configured/);
  });

  it("only lists providers whose env vars are set", () => {
    vi.stubEnv("BFL_API_KEY", "");
    expect(listAvailableProviders().map((p) => p.id)).not.toContain("bfl");
    vi.stubEnv("BFL_API_KEY", "test");
    expect(listAvailableProviders().map((p) => p.id)).toContain("bfl");
  });
});

describe("generateArtwork", () => {
  it("makes a prompt-only poster with the mock provider", async () => {
    const result = await generateArtwork({
      movement: "pop-art",
      userPrompt: "soup & <cans>",
      provider: "mock",
    });
    expect(result.provider).toBe("mock");
    expect(result.mimeType).toBe("image/svg+xml");
    const svg = decodeSvg(result.imageUrl);
    expect(svg).toContain("soup &amp; &lt;cans&gt;");
  });

  it("makes a 2x2 grid from an uploaded photo", async () => {
    const result = await generateArtwork({
      movement: "pop-art",
      userPrompt: "",
      sourceImage: { data: PNG_1PX, mimeType: "image/png" },
      provider: "mock",
    });
    const svg = decodeSvg(result.imageUrl);
    expect(svg.match(/<image /g)).toHaveLength(4);
    expect(svg).toContain("data:image/png;base64,");
  });

  it("validates input", async () => {
    await expect(generateArtwork({ movement: "nope", userPrompt: "x" })).rejects.toBeInstanceOf(
      GenerationInputError,
    );
    await expect(generateArtwork({ movement: "pop-art", userPrompt: "" })).rejects.toThrow(
      /prompt, an image/,
    );
    await expect(generateArtwork({ movement: "op-art", userPrompt: "x" })).rejects.toThrow(
      /not open yet/,
    );
  });

  it("surfaces unimplemented providers distinctly", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "test");
    await expect(
      generateArtwork({ movement: "pop-art", userPrompt: "x", provider: "google" }),
    ).rejects.toBeInstanceOf(ProviderNotImplementedError);
  });
});
