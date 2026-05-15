CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_preview` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_unique` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_account_idx` ON `api_keys` (`account_id`);--> statement-breakpoint
CREATE INDEX `api_keys_hash_idx` ON `api_keys` (`token_hash`);