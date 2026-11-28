import { describe, it, expect } from "vitest";
import { RecipeType, recipeTypeSchema } from "../src/enums/recipe-type";
import { RecipeTag, recipeTagSchema } from "../src/enums/recipe-tag";

describe("#16 recipe type and recipe tag enums", () => {
  it("KIT-001 AC1: RecipeType contains exactly the nine types, in menu order", () => {
    expect(Object.values(RecipeType)).toEqual([
      "starter",
      "soup",
      "main",
      "side",
      "dessert",
      "breakfast",
      "snack",
      "drink",
      "sauce",
    ]);
  });

  it("KIT-002 AC2: RecipeTag contains exactly the agreed tag list", () => {
    expect(Object.values(RecipeTag)).toEqual([
      "bbq",
      "meat",
      "sweet",
      "slovak",
      "sunday-dish",
      "saturday-dish",
      "friday-dish",
      "wednesday-dish",
    ]);
  });

  it("KIT-001 AC3: recipeTypeSchema accepts every listed type", () => {
    for (const type of Object.values(RecipeType)) {
      expect(recipeTypeSchema.parse(type)).toBe(type);
    }
  });

  it("KIT-001 AC3: recipeTypeSchema rejects a value not in the list", () => {
    expect(recipeTypeSchema.safeParse("appetizer").success).toBe(false);
  });

  it("KIT-002 AC3: recipeTagSchema accepts every listed tag", () => {
    for (const tag of Object.values(RecipeTag)) {
      expect(recipeTagSchema.parse(tag)).toBe(tag);
    }
  });

  it("KIT-002 AC3: recipeTagSchema rejects a value not in the list", () => {
    expect(recipeTagSchema.safeParse("sunday dish").success).toBe(false);
  });
});
