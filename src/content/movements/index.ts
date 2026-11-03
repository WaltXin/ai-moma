import type { Movement } from "@/lib/museum/types";
import { abstractExpressionism } from "./abstract-expressionism";
import { artNouveau } from "./art-nouveau";
import { bauhaus } from "./bauhaus";
import { constructivism } from "./constructivism";
import { cubism } from "./cubism";
import { dada } from "./dada";
import { deStijl } from "./de-stijl";
import { expressionism } from "./expressionism";
import { fauvism } from "./fauvism";
import { futurism } from "./futurism";
import { impressionism } from "./impressionism";
import { minimalism } from "./minimalism";
import { neoImpressionism } from "./neo-impressionism";
import { opArt } from "./op-art";
import { popArt } from "./pop-art";
import { postImpressionism } from "./post-impressionism";
import { surrealism } from "./surrealism";

/**
 * Every art movement in the museum, roughly in historical order.
 * To add one: create `<slug>.ts` next to this file and append it here.
 */
export const movements: Movement[] = [
  impressionism,
  neoImpressionism,
  postImpressionism,
  artNouveau,
  fauvism,
  expressionism,
  cubism,
  futurism,
  dada,
  deStijl,
  constructivism,
  bauhaus,
  surrealism,
  abstractExpressionism,
  popArt,
  minimalism,
  opArt,
];
