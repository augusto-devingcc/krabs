ALTER TABLE `accounts` ADD `clerk_user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_clerk_user_id_idx` ON `accounts` (`clerk_user_id`);