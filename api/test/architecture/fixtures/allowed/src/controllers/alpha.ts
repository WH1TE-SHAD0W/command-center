// Synthetic fixture: module "alpha"'s controller calls its own service and validation. Allowed.
import { describeAlpha } from "../services/alpha";
import { isAlphaId } from "../validation/alpha";

export const showAlpha = (id: number) => (isAlphaId(id) ? describeAlpha(id) : null);
