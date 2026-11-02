CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `creator_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `messages` ADD `sender_id` text REFERENCES users(id);--> statement-breakpoint
INSERT INTO `users` (`id`, `name`, `created_at`)
SELECT lower(substr(`h`, 1, 8) || '-' || substr(`h`, 9, 4) || '-4' || substr(`h`, 14, 3) || '-a' || substr(`h`, 18, 3) || '-' || substr(`h`, 21, 12)),
       `name`,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM (
    SELECT hex(randomblob(16)) AS `h`, `name`
    FROM (
        SELECT `sender_name` AS `name` FROM `messages` WHERE `sender_name` IS NOT NULL
        UNION
        SELECT `creator_name` FROM `conversations` WHERE `creator_name` IS NOT NULL
    )
);--> statement-breakpoint
UPDATE `messages` SET `sender_id` = (SELECT `id` FROM `users` WHERE `users`.`name` = `messages`.`sender_name`) WHERE `sender_name` IS NOT NULL;--> statement-breakpoint
UPDATE `conversations` SET `creator_id` = (SELECT `id` FROM `users` WHERE `users`.`name` = `conversations`.`creator_name`) WHERE `creator_name` IS NOT NULL;
