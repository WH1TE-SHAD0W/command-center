CREATE TABLE `kitchen_recipe_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `kitchen_recipes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen_recipe_photos_r2_key_unique` ON `kitchen_recipe_photos` (`r2_key`);--> statement-breakpoint
CREATE INDEX `kitchen_recipe_photos_recipe_id_idx` ON `kitchen_recipe_photos` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `kitchen_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`type` text NOT NULL,
	`servings` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	`source_url` text,
	`ingredients` text DEFAULT '[]' NOT NULL,
	`steps` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen_recipes_name_normalized_unique` ON `kitchen_recipes` (`name_normalized`);