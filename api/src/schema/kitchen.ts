import { isNull } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { RecipeTag } from "../enums/recipe-tag";
import type { RecipeType } from "../enums/recipe-type";

/**
 * One ingredient line of a recipe (context.md §5.1, owner's decisions on #17).
 *
 * `amount` and `unit` are optional: "to taste" or "a pinch" goes in `note`.
 */
export interface Ingredient {
  name: string;
  amount?: number | null;
  unit?: string | null;
  note?: string | null;
}

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/** NULL means active; "remove" sets it and "restore" clears it (ADR 0009). */
const archivedAt = () => integer("archived_at", { mode: "timestamp_ms" });

/**
 * The recipes the owner has cooked, shown as the kitchen menu (context.md §5.1).
 *
 * `type` and `tags` are typed with the #16 enums but have no CHECK in SQL: they are validated at
 * the edge, so adding a type or a tag needs no migration (ADR 0011 rule 5).
 */
export const kitchenRecipes = sqliteTable(
  "kitchen_recipes",
  {
    id: id(),
    name: text("name").notNull(),
    /** The name folded for duplicate checks (case and accents ignored, #18). */
    nameNormalized: text("name_normalized").notNull(),
    /**
     * Marks a genuine variant of a dish ("vegetarian"); `""` for the original. Not NULL, because
     * SQLite treats NULLs as distinct in a unique index and two originals would slip through.
     */
    variant: text("variant").notNull().default(""),
    type: text("type").$type<RecipeType>().notNull(),
    servings: integer("servings"),
    tags: text("tags", { mode: "json" }).$type<RecipeTag[]>().notNull().default([]),
    sourceUrl: text("source_url"),
    ingredients: text("ingredients", { mode: "json" }).$type<Ingredient[]>().notNull().default([]),
    steps: text("steps", { mode: "json" }).$type<string[]>(),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  // One active recipe per dish and variant (owner's decisions on #17 and #18, 2026-11-28): an
  // archived recipe does not block a new one with the same name and variant.
  (t) => [
    uniqueIndex("kitchen_recipes_name_variant_active_unique")
      .on(t.nameNormalized, t.variant)
      .where(isNull(t.archivedAt)),
  ],
);

/** Photos of a recipe; the image itself lives in the private R2 bucket under `r2Key` (ADR 0008). */
export const kitchenRecipePhotos = sqliteTable(
  "kitchen_recipe_photos",
  {
    id: id(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => kitchenRecipes.id),
    r2Key: text("r2_key").notNull().unique(),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
  },
  (t) => [index("kitchen_recipe_photos_recipe_id_idx").on(t.recipeId)],
);

export type KitchenRecipe = typeof kitchenRecipes.$inferSelect;
export type NewKitchenRecipe = typeof kitchenRecipes.$inferInsert;
export type KitchenRecipePhoto = typeof kitchenRecipePhotos.$inferSelect;
export type NewKitchenRecipePhoto = typeof kitchenRecipePhotos.$inferInsert;
