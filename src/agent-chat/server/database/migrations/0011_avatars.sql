ALTER TABLE `agents` ADD `avatar_seed` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `avatar_file` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `avatar_updated_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_file` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_source` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_updated_at` integer;