// Synthetic fixture: module "alpha" imports module "beta" in the same folder. Must be flagged.
import { betaValue } from "./beta";

export const alphaValue = betaValue + 1;
