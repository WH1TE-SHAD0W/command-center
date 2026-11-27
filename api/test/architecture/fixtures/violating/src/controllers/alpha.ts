// Synthetic fixture: module "alpha" imports module "beta" across folders (type-only). Must be flagged.
import type { betaTable } from "../schema/beta";

export type AlphaTable = typeof betaTable;
