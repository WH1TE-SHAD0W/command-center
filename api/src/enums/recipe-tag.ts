import { z } from "zod";

/**
 * The fixed list of recipe tags (context.md §5.1, owner's decision on #16).
 *
 * The list is expected to grow: adding a tag is one new line here, with no migration
 * (ADR 0011 rule 5). Stored values are lowercase kebab-case.
 */
export enum RecipeTag {
  Bbq = "bbq",
  Meat = "meat",
  Sweet = "sweet",
  Slovak = "slovak",
  SundayDish = "sunday-dish",
  SaturdayDish = "saturday-dish",
  FridayDish = "friday-dish",
  WednesdayDish = "wednesday-dish",
}

/** Validates a recipe tag at the edge (HTTP routes and MCP tools); rejects anything not listed. */
export const recipeTagSchema = z.enum(RecipeTag);
