ALTER TABLE `users` DROP COLUMN `thinking_auto_open`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `working_auto_open`;--> statement-breakpoint
ALTER TABLE `users` ADD `thinking_auto_open` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `working_auto_open` integer DEFAULT false NOT NULL;
