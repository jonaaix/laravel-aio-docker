ALTER TABLE `users` ADD `app_user_ref` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_app_user_ref_unique` ON `users` (`app_user_ref`);