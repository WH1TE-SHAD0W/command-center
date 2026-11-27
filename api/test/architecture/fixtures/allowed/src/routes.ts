// Synthetic fixture: the core router imports module controllers. Allowed.
import { showAlpha } from "./controllers/alpha";

export const alphaRoutes = { "/api/alpha/:id": showAlpha };
