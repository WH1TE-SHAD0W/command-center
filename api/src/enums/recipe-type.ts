import { z } from "zod";

/**
 * The type of a recipe (context.md §5.1).
 *
 * The declaration order is the menu order: the kitchen menu is grouped by type and shows the
 * groups in this order. Adding a type is a code change here, with no migration (ADR 0011 rule 5).
 */
export enum RecipeType {
  Starter = "starter",
  Soup = "soup",
  Main = "main",
  Side = "side",
  Dessert = "dessert",
  Breakfast = "breakfast",
  Snack = "snack",
  Drink = "drink",
  Sauce = "sauce",
}

/** Validates a recipe type at the edge (HTTP routes and MCP tools); rejects anything not listed. */
export const recipeTypeSchema = z.enum(RecipeType);
