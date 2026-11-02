-- Custom SQL migration file, put your code below! --
UPDATE `messages` SET `agent_id` = (SELECT `id` FROM `agents` WHERE `lead` = 1);
