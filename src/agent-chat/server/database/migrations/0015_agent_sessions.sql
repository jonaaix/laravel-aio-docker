ALTER TABLE `conversation_agents` ADD `session_ref` text;--> statement-breakpoint
ALTER TABLE `conversation_agents` ADD `session_started` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `conversation_agents` ADD `announced_agents` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `agent_id` text REFERENCES agents(id);