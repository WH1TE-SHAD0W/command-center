// Synthetic fixture: module "gamma" (a folder-style module) imports module "alpha". Must be flagged.
import type { AlphaTable } from "../../controllers/alpha";

export type GammaInput = { table: AlphaTable };
