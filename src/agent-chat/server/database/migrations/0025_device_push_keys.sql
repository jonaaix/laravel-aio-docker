ALTER TABLE `push_subscriptions` ADD `vapid_public_key` text;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `vapid_private_key` text;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `hub_ref` text;