import type { Movement } from "@/lib/museum/types";
import { opArt } from "./op-art";
import { popArt } from "./pop-art";

/**
 * Every art movement in the museum.
 * To add one: create `<slug>.ts` next to this file and append it here.
 */
export const movements: Movement[] = [popArt, opArt];
