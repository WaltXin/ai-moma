import { z } from "zod";

/**
 * Exhibition requests: a visitor asks for a generated piece to be shown
 * in the Community Gallery. Curators review the request before it goes on
 * a wall.
 *
 * Storage is in memory for now (lost on restart). Swap in a database
 * implementation of `SubmissionStore` when we add one (see ROADMAP).
 */

export const submissionInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().min(1).max(80),
  movement: z.string().trim().min(1),
  statement: z.string().trim().max(1000).default(""),
  /** URL of the generated image. Object-storage upload comes later. */
  imageUrl: z.string().trim().min(1),
  /** Provenance from the generator, if any. */
  provider: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().max(2000).optional(),
});

export type SubmissionInput = z.infer<typeof submissionInputSchema>;

export type Submission = SubmissionInput & {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export interface SubmissionStore {
  create(input: SubmissionInput): Promise<Submission>;
  list(): Promise<Submission[]>;
}

export function createMemorySubmissionStore(): SubmissionStore {
  const items: Submission[] = [];
  return {
    async create(input) {
      const submission: Submission = {
        ...input,
        id: crypto.randomUUID(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      items.push(submission);
      return submission;
    },
    async list() {
      return [...items];
    },
  };
}

// One shared store per server process.
const globalForStore = globalThis as unknown as { __aiMomaSubmissions?: SubmissionStore };
export const submissionStore: SubmissionStore = (globalForStore.__aiMomaSubmissions ??=
  createMemorySubmissionStore());
