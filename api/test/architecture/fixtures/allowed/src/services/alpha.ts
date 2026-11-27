// Synthetic fixture: module "alpha" uses its own schema plus core enums/ and events/. Allowed.
import { Colour } from "../enums/colour";
import type { AlphaCreated } from "../events/index";
import { alphaTable } from "../schema/alpha";

export const describeAlpha = (id: number): AlphaCreated & { table: string; colour: Colour } => ({
  type: "alpha.created",
  id,
  table: alphaTable,
  colour: Colour.Red,
});
