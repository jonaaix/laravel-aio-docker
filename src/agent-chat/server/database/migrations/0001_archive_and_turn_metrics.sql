ALTER TABLE `conversations` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `model` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `input_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `output_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `cache_read_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `cache_creation_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `cost_usd` real;--> statement-breakpoint
ALTER TABLE `messages` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `outcome` text;