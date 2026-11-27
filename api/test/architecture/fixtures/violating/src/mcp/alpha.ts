// Synthetic fixture: module "alpha" imports module "alphabet". Must be flagged despite the shared prefix.
import { onAlphabet } from "../listeners/alphabet";

export const alphaTool = () => onAlphabet();
