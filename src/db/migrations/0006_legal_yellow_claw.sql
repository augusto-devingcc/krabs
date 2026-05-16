CREATE TABLE `device_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`account_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`client_meta` text,
	`approved_api_key_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`expires_at` text NOT NULL,
	`approved_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_authorizations_device_code_unique` ON `device_authorizations` (`device_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_authorizations_user_code_unique` ON `device_authorizations` (`user_code`);--> statement-breakpoint
CREATE INDEX `device_authorizations_status_idx` ON `device_authorizations` (`status`);--> statement-breakpoint
CREATE INDEX `device_authorizations_expires_idx` ON `device_authorizations` (`expires_at`);