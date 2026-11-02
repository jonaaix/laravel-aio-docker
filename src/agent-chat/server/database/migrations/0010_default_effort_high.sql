-- Custom SQL migration file, put your code below! --
UPDATE `agents` SET `effort` = 'high' WHERE `effort` IS NULL;
