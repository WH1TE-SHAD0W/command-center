import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index";

/** The one Drizzle instance over D1, typed with the combined schema of every module (ADR 0013). */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;
