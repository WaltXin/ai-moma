import { getMovement } from "@/lib/museum/registry";
import { submissionInputSchema, submissionStore } from "@/lib/submissions/store";

/**
 * POST /api/submissions  (application/json)
 * A visitor asks for their generated piece to be exhibited. The request
 * is stored as "pending" until a curator reviews it.
 *
 * There is no public GET: pending work is unmoderated.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const parsed = submissionInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid submission", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (!getMovement(parsed.data.movement)) {
    return Response.json({ error: "Unknown movement" }, { status: 400 });
  }

  const submission = await submissionStore.create(parsed.data);
  return Response.json({ id: submission.id, status: submission.status }, { status: 201 });
}
