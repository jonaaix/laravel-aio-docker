CREATE TABLE `conversation_agents` (
	`conversation_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`conversation_id`, `agent_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
