ALTER TABLE `cards` ADD `card_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `cards` ADD `edition_json` text DEFAULT '{}' NOT NULL;