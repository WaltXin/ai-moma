import { describe, expect, it } from "vitest";
import { createMemorySubmissionStore, submissionInputSchema } from "@/lib/submissions/store";

describe("submissions", () => {
  const valid = {
    title: "Cat",
    artist: "Walt",
    movement: "pop-art",
    imageUrl: "data:image/svg+xml;base64,AA==",
  };

  it("validates input and trims strings", () => {
    const parsed = submissionInputSchema.parse({ ...valid, title: "  Cat  " });
    expect(parsed.title).toBe("Cat");
    expect(parsed.statement).toBe("");
    expect(submissionInputSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });

  it("stores new submissions as pending", async () => {
    const store = createMemorySubmissionStore();
    const s = await store.create(submissionInputSchema.parse(valid));
    expect(s.status).toBe("pending");
    expect(await store.list()).toHaveLength(1);
  });
});
