import { generateArtwork, GenerationInputError } from "@/lib/generation/generate";
import { ProviderNotImplementedError } from "@/lib/generation/types";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * POST /api/generate  (multipart/form-data)
 *   movement  string   required, e.g. "pop-art"
 *   prompt    string   optional if image is given
 *   image     File     optional, png/jpeg/webp, ≤ 8 MB
 *   provider  string   optional, defaults to IMAGE_PROVIDER or "mock"
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const movement = String(form.get("movement") ?? "");
  const userPrompt = String(form.get("prompt") ?? "")
    .trim()
    .slice(0, 1000);
  const provider = String(form.get("provider") ?? "") || undefined;
  const file = form.get("image");

  let sourceImage;
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: "Image must be PNG, JPEG or WebP" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "Image must be 8 MB or smaller" }, { status: 413 });
    }
    sourceImage = { data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type };
  }

  try {
    const result = await generateArtwork({ movement, userPrompt, sourceImage, provider });
    return Response.json(result);
  } catch (err) {
    if (err instanceof GenerationInputError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ProviderNotImplementedError) {
      return Response.json({ error: err.message }, { status: 501 });
    }
    console.error("[api/generate]", err);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
