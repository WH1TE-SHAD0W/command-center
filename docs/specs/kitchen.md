# Spec: kitchen

- **Module:** `kitchen` · **Prefix:** `KIT` · **Epic:** #6
- **Intent:** context.md §5.1 · **ADRs:** 0007, 0008, 0009, 0013

## Purpose
A catalogue of the recipes the owner has cooked, shown as a restaurant-style menu grouped by dish
type. Tapping a dish opens the full recipe. Dishes mostly come in through Hermes over MCP. There is
no meal plan and no grocery list, and nothing is ever deleted.

## Requirements

### KIT-001 Recipe types are a fixed list in menu order
- **Status:** implemented
- **Delivered by:** #16 (PR #34)
- **Acceptance:**
  1. The types are exactly: starter, soup, main, side, dessert, breakfast, snack, drink, sauce, in
     that order. The order is the menu order.
  2. Validation rejects any other value.

### KIT-002 Recipe tags are a fixed, extendable list
- **Status:** implemented
- **Delivered by:** #16 (PR #34)
- **Acceptance:**
  1. The tags are: bbq, meat, sweet, slovak, sunday-dish, saturday-dish, friday-dish,
     wednesday-dish. Multi-word tags are stored in kebab-case.
  2. Validation rejects any other value. The list is an enum that is easy to extend.

### KIT-003 A recipe holds every field the owner gives it
- **Status:** accepted
- **Delivered by:** #17 (PR #50, open)
- **Acceptance:**
  1. A recipe has a text UUID id, a name, a normalised name, a variant label (`""` for the
     original), a type (KIT-001), tags (KIT-002, default none), optional servings, an optional
     source URL, ingredients (default none), optional steps (a list of strings), `archived_at`,
     `created_at` and `updated_at` (which moves on every update).
  2. An ingredient is `{ name, amount, unit, note }`. `amount` is an optional number; `amount` and
     `unit` may be empty, and "to taste" goes in `note`.
  3. Among active recipes (not archived), the normalised name and variant are unique together.
  4. A recipe with ingredients round-trips through the database unchanged.

### KIT-004 A recipe has photos
- **Status:** accepted
- **Delivered by:** #17 (PR #50, open)
- **Acceptance:**
  1. A photo has an id, its recipe's id, its R2 key, `created_at` and `archived_at`.
  2. Photos are archived, never deleted.

### KIT-005 Creating a recipe refuses a duplicate, ignoring case and accents
- **Status:** accepted
- **Delivered by:** #18
- **Acceptance:**
  1. Input is validated server-side, and the recipe is stored.
  2. Creating "Bryndzové halušky" while an active "bryndzove halusky" with the same variant exists
     is refused with a duplicate error carrying the existing recipe's id and name.
  3. An archived recipe does not block a new one with the same name.
  4. An unknown type or tag, an empty name or a malformed ingredient is refused with a field-level
     validation error.

### KIT-006 A recipe can be updated
- **Status:** accepted
- **Delivered by:** #19
- **Acceptance:**
  1. An update changes only the given fields and re-validates them.
  2. Changing the name runs the KIT-005 duplicate check.

### KIT-007 A recipe can be archived and unarchived, never deleted
- **Status:** accepted
- **Delivered by:** #19
- **Acceptance:**
  1. Archiving sets `archived_at`; archiving twice is harmless. Nothing is ever deleted.
  2. Archived recipes are left out of lists by default; getting one by id still returns it, marked
     archived.
  3. Unarchiving clears `archived_at`.
- **Open:** does unarchiving run the KIT-005 duplicate check against an active recipe with the same
  name and variant? Settle in a spec PR before #19 starts.

### KIT-008 Search finds recipes by name, tag or ingredient, ignoring accents
- **Status:** accepted
- **Delivered by:** #20
- **Acceptance:**
  1. An FTS5 index covers name, tags and ingredient names, with a tokenizer that removes diacritics;
     its migration is in the shared `api/migrations/` folder.
  2. "halusky" finds "Bryndzové halušky"; a tag finds its recipes; an ingredient name finds its
     recipes.
  3. Archived recipes aren't returned, and the index stays correct after create, update and archive.
  4. An empty or over-long query gets a validation error. The query is parameterised.

### KIT-009 The kitchen has HTTP routes
- **Status:** accepted
- **Delivered by:** #21
- **Acceptance:**
  1. `GET` and `POST /api/kitchen/recipes` (list with an optional search query, create),
     `GET` and `PATCH /api/kitchen/recipes/:id`, `POST /api/kitchen/recipes/:id/archive`, and an
     unarchive route. There is no `DELETE` route.
  2. Invalid input gets `400` with field errors, a duplicate `409` with the existing id, an unknown
     id `404`.
  3. Every route is behind the Access check (PLT-002); without it, `401`.
- **Open:** the unarchive route's path. Settle in a spec PR before #21 starts.

### KIT-010 Hermes manages recipes through MCP tools
- **Status:** accepted
- **Delivered by:** #22
- **Acceptance:**
  1. The tools `search_recipes`, `get_recipe`, `create_recipe` and `update_recipe` exist and only
     call the kitchen service.
  2. Their input is validated with the same schemas as the HTTP routes.
  3. A duplicate on `create_recipe` returns error text Hermes can relay: the existing recipe's name
     and id.

### KIT-011 Photos are uploaded through a one-time URL into R2
- **Status:** accepted
- **Delivered by:** #23
- **Acceptance:**
  1. The MCP tool `request_upload` returns `/uploads/<token>`: single use, valid for 10 minutes,
     at most 20 MB, jpeg, png or webp only. Tokens live in a D1 table.
  2. Uploading streams the bytes into the private R2 bucket under `kitchen/<uuid>.<ext>` and returns
     the key. A second use, an expired token, a wrong type or an oversize body is refused.
  3. The MCP tool `attach_photo` links a key to a recipe; a key that doesn't exist is refused.

### KIT-012 Recipe images are served resized
- **Status:** accepted
- **Delivered by:** #24
- **Acceptance:**
  1. `GET /img/<key>?w=<width>` reads the private R2 bucket, resizes with the Images binding, and
     returns long-lived cache headers. Widths: 320, 640, 960, 1280.
  2. An unknown key gets `404`; any other width `400`.
  3. The route is behind Access, and the web worker forwards `/img/*` over the binding.

### KIT-013 The menu page groups dishes by type
- **Status:** accepted
- **Delivered by:** #25 (on hold until UI design exists)
- **Acceptance:**
  1. Active recipes are grouped by type in KIT-001 order; empty groups are hidden.
  2. Each dish shows its name and first photo, if any; tapping it opens the recipe page.
  3. A search box filters through KIT-008, and "halusky" finds "halušky".
  4. Easy to use on a phone screen. User content is escaped, never `{@html}`.

### KIT-014 The recipe page shows every field
- **Status:** accepted
- **Delivered by:** #26 (on hold until UI design exists)
- **Acceptance:**
  1. It shows the name, type, servings, tags, source link (`rel="noopener noreferrer"`),
     ingredients (amount, unit, name, note), photos through KIT-012, and the steps if present.
  2. An archived recipe still opens, marked archived. An unknown id shows a 404 page.
  3. Easy to use on a phone screen. Escaping only, never `{@html}`.
