ALTER TABLE `conversations` ADD `last_posted_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `posted_at` integer;--> statement-breakpoint
UPDATE `messages` SET `posted_at` = `created_at` WHERE `role` = 'user';--> statement-breakpoint
UPDATE `messages` SET `posted_at` = `created_at` + COALESCE(`duration_ms`, 0) WHERE `role` = 'assistant' AND `outcome` IS NOT NULL;--> statement-breakpoint
UPDATE `conversations` SET `last_posted_at` = (SELECT MAX(`posted_at`) FROM `messages` WHERE `messages`.`conversation_id` = `conversations`.`id`);--> statement-breakpoint
UPDATE `conversation_reads` SET `seen_answer_at` = (SELECT `last_posted_at` FROM `conversations` WHERE `conversations`.`id` = `conversation_reads`.`conversation_id`)
WHERE `seen_answer_at` >= COALESCE((SELECT `last_answer_at` FROM `conversations` WHERE `conversations`.`id` = `conversation_reads`.`conversation_id`), 0)
AND COALESCE((SELECT `last_posted_at` FROM `conversations` WHERE `conversations`.`id` = `conversation_reads`.`conversation_id`), 0) > `seen_answer_at`;
