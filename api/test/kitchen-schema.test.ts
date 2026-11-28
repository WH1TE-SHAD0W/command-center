import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "../src/db";
import { RecipeTag } from "../src/enums/recipe-tag";
import { RecipeType } from "../src/enums/recipe-type";
import { kitchenRecipePhotos, kitchenRecipes, type NewKitchenRecipe } from "../src/schema";

// Synthetic recipes only (the repository is public). The local D1 is shared by the tests in this
// file, so every test makes its own recipe with a distinct name.
function syntheticRecipe(label: string) {
  return {
    name: `Synthetic ${label} Dumplings`,
    nameNormalized: `synthetic ${label.toLowerCase()} dumplings`,
    type: RecipeType.Main,
    servings: 4,
    tags: [RecipeTag.Slovak, RecipeTag.SundayDish],
    sourceUrl: "https://recipes.example.test/synthetic-dumplings",
    ingredients: [
      { name: "test flour", amount: 250, unit: "g", note: null },
      { name: "test potato", amount: 2, unit: null, note: "large" },
      { name: "test salt", note: "to taste" },
    ],
    steps: ["Mix the test ingredients.", "Boil for 5 minutes."],
  } satisfies NewKitchenRecipe;
}

/** Drizzle wraps D1 errors in "Failed query: …"; the constraint message is on the cause. */
async function constraintError(query: PromiseLike<unknown>): Promise<string> {
  try {
    await query;
  } catch (error) {
    return String((error as Error).cause ?? error);
  }
  throw new Error("expected the query to be refused");
}

interface Column {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

async function columns(table: string): Promise<Record<string, Omit<Column, "name">>> {
  const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all<Column>();
  return Object.fromEntries(results.map(({ name, type, notnull, pk }) => [name, { type, notnull, pk }]));
}

describe("#17 kitchen schema and its first migration", () => {
  const db = createDb(env.DB);

  it("AC4: the migrations apply to the local D1 and one synthetic recipe with ingredients round-trips", async () => {
    const recipe = syntheticRecipe("Roundtrip");
    const [created] = await db.insert(kitchenRecipes).values(recipe).returning();

    const read = await db.query.kitchenRecipes.findFirst({
      where: eq(kitchenRecipes.id, created.id),
    });

    expect(read).toEqual({
      ...recipe,
      id: created.id,
      variant: "",
      archivedAt: null,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
    expect(read?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(read?.createdAt).toBeInstanceOf(Date);
    expect(read?.updatedAt).toBeInstanceOf(Date);
    // The JSON columns are stored as JSON text, so SQLite's json functions (and FTS, #20) can read them.
    const raw = await env.DB.prepare(
      "SELECT json_extract(ingredients, '$[0].name') AS first, json_array_length(tags) AS tagCount FROM kitchen_recipes WHERE id = ?",
    )
      .bind(created.id)
      .first<{ first: string; tagCount: number }>();
    expect(raw).toEqual({ first: "test flour", tagCount: 2 });
  });

  it("AC1: kitchen_recipes has every listed column, with servings, source URL and steps optional", async () => {
    expect(await columns("kitchen_recipes")).toEqual({
      id: { type: "TEXT", notnull: 1, pk: 1 },
      name: { type: "TEXT", notnull: 1, pk: 0 },
      name_normalized: { type: "TEXT", notnull: 1, pk: 0 },
      variant: { type: "TEXT", notnull: 1, pk: 0 },
      type: { type: "TEXT", notnull: 1, pk: 0 },
      servings: { type: "INTEGER", notnull: 0, pk: 0 },
      tags: { type: "TEXT", notnull: 1, pk: 0 },
      source_url: { type: "TEXT", notnull: 0, pk: 0 },
      ingredients: { type: "TEXT", notnull: 1, pk: 0 },
      steps: { type: "TEXT", notnull: 0, pk: 0 },
      archived_at: { type: "INTEGER", notnull: 0, pk: 0 },
      created_at: { type: "INTEGER", notnull: 1, pk: 0 },
      updated_at: { type: "INTEGER", notnull: 1, pk: 0 },
    });
  });

  it("AC1: a minimal recipe gets a UUID, empty tags and ingredients, null optionals and timestamps", async () => {
    const [created] = await db
      .insert(kitchenRecipes)
      .values({ name: "Synthetic Tea", nameNormalized: "synthetic tea", type: RecipeType.Drink })
      .returning();

    expect(created).toMatchObject({
      variant: "",
      servings: null,
      tags: [],
      sourceUrl: null,
      ingredients: [],
      steps: null,
      archivedAt: null,
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt.getTime()).toBe(created.updatedAt.getTime());
  });

  it("AC1: updating a recipe moves updated_at forward and keeps created_at", async () => {
    const [created] = await db.insert(kitchenRecipes).values(syntheticRecipe("Update")).returning();
    await new Promise((resolve) => setTimeout(resolve, 5));

    const [updated] = await db
      .update(kitchenRecipes)
      .set({ servings: 6 })
      .where(eq(kitchenRecipes.id, created.id))
      .returning();

    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });

  it("AC1: a second original with the same normalised name is refused", async () => {
    const recipe = syntheticRecipe("Unique");
    await db.insert(kitchenRecipes).values(recipe);

    expect(
      await constraintError(db.insert(kitchenRecipes).values({ ...recipe, name: "SYNTHETIC UNIQUE DUMPLINGS" })),
    ).toMatch(/UNIQUE constraint failed: kitchen_recipes\.name_normalized, kitchen_recipes\.variant/);
  });

  it("AC1: a named variant of the same dish is allowed once", async () => {
    const recipe = syntheticRecipe("Variant");
    await db.insert(kitchenRecipes).values(recipe);

    const [variant] = await db
      .insert(kitchenRecipes)
      .values({ ...recipe, variant: "vegetarian" })
      .returning();

    expect(variant).toMatchObject({ nameNormalized: recipe.nameNormalized, variant: "vegetarian" });
    expect(
      await constraintError(db.insert(kitchenRecipes).values({ ...recipe, variant: "vegetarian" })),
    ).toMatch(/UNIQUE constraint failed: kitchen_recipes\.name_normalized, kitchen_recipes\.variant/);
  });

  it("AC1: an archived recipe does not block a new one with the same name and variant (#18)", async () => {
    const recipe = syntheticRecipe("Rearchived");
    const [first] = await db.insert(kitchenRecipes).values(recipe).returning();
    await db
      .update(kitchenRecipes)
      .set({ archivedAt: new Date("2026-01-01T12:00:00Z") })
      .where(eq(kitchenRecipes.id, first.id));

    const [second] = await db.insert(kitchenRecipes).values(recipe).returning();

    expect(second.id).not.toBe(first.id);
    expect(second.archivedAt).toBeNull();
    // Restoring the archived one would make two active originals, so the database refuses it.
    expect(
      await constraintError(
        db.update(kitchenRecipes).set({ archivedAt: null }).where(eq(kitchenRecipes.id, first.id)),
      ),
    ).toMatch(/UNIQUE constraint failed: kitchen_recipes\.name_normalized, kitchen_recipes\.variant/);
  });

  it("AC2: kitchen_recipe_photos has id, recipe id, R2 key, archived_at and created_at", async () => {
    expect(await columns("kitchen_recipe_photos")).toEqual({
      id: { type: "TEXT", notnull: 1, pk: 1 },
      recipe_id: { type: "TEXT", notnull: 1, pk: 0 },
      r2_key: { type: "TEXT", notnull: 1, pk: 0 },
      archived_at: { type: "INTEGER", notnull: 0, pk: 0 },
      created_at: { type: "INTEGER", notnull: 1, pk: 0 },
    });
  });

  it("AC2: a photo belongs to an existing recipe, and an R2 key is used once", async () => {
    const [recipe] = await db.insert(kitchenRecipes).values(syntheticRecipe("Photo")).returning();
    const [photo] = await db
      .insert(kitchenRecipePhotos)
      .values({ recipeId: recipe.id, r2Key: "kitchen/synthetic-1.jpg" })
      .returning();

    expect(photo).toMatchObject({ recipeId: recipe.id, r2Key: "kitchen/synthetic-1.jpg", archivedAt: null });
    expect(
      await constraintError(db.insert(kitchenRecipePhotos).values({ recipeId: crypto.randomUUID(), r2Key: "kitchen/synthetic-2.jpg" })),
    ).toMatch(/FOREIGN KEY constraint failed/);
    expect(
      await constraintError(db.insert(kitchenRecipePhotos).values({ recipeId: recipe.id, r2Key: "kitchen/synthetic-1.jpg" })),
    ).toMatch(/UNIQUE constraint failed: kitchen_recipe_photos\.r2_key/);
  });

  it("AC2: recipes and photos are archived, not deleted (ADR 0009)", async () => {
    const [recipe] = await db.insert(kitchenRecipes).values(syntheticRecipe("Archive")).returning();
    const [photo] = await db
      .insert(kitchenRecipePhotos)
      .values({ recipeId: recipe.id, r2Key: "kitchen/synthetic-archive.jpg" })
      .returning();
    const archivedAt = new Date("2026-01-01T12:00:00Z");

    await db.update(kitchenRecipes).set({ archivedAt }).where(eq(kitchenRecipes.id, recipe.id));
    await db.update(kitchenRecipePhotos).set({ archivedAt }).where(eq(kitchenRecipePhotos.id, photo.id));

    const recipes = await db.select().from(kitchenRecipes).where(eq(kitchenRecipes.id, recipe.id));
    const photos = await db.select().from(kitchenRecipePhotos).where(eq(kitchenRecipePhotos.id, photo.id));
    expect(recipes.map((r) => r.archivedAt)).toEqual([archivedAt]);
    expect(photos.map((p) => p.archivedAt)).toEqual([archivedAt]);
  });

  it("AC3: the kitchen migration was generated into api/migrations/ and is applied", async () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);
    expect(names).toContain("0000_kitchen_schema.sql");

    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'kitchen_%' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["kitchen_recipe_photos", "kitchen_recipes"]);
  });
});
