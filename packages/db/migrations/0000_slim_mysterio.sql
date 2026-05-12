CREATE TABLE `cards` (
	`slug` text PRIMARY KEY NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`set_code` text NOT NULL,
	`set_name` text NOT NULL,
	`collector_number` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`release_date` text,
	`rarity` text NOT NULL,
	`elements` text DEFAULT '[]' NOT NULL,
	`classes` text DEFAULT '[]' NOT NULL,
	`type` text NOT NULL,
	`subtypes` text DEFAULT '[]' NOT NULL,
	`reserve_cost` integer,
	`memory_cost` integer,
	`level` integer,
	`life` integer,
	`power` integer,
	`durability` integer,
	`effect_text` text,
	`flavor_text` text,
	`image_url` text DEFAULT '' NOT NULL,
	`illustrator` text
);
--> statement-breakpoint
CREATE TABLE `deck_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer NOT NULL,
	`card_slug` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`format` text DEFAULT 'standard' NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
