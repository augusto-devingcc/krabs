CREATE TABLE `agent_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`api_key_id` text NOT NULL,
	`operation` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`intent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_actions_account_created_idx` ON `agent_actions` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `agent_actions_target_idx` ON `agent_actions` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `agent_actions_actor_idx` ON `agent_actions` (`api_key_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`primary_email` text,
	`primary_phone` text,
	`status` text DEFAULT 'lead' NOT NULL,
	`custom_fields` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contacts_account_idx` ON `contacts` (`account_id`);--> statement-breakpoint
CREATE INDEX `contacts_account_email_idx` ON `contacts` (`account_id`,`primary_email`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`api_key_id` text NOT NULL,
	`key` text NOT NULL,
	`operation` text NOT NULL,
	`response_status` integer NOT NULL,
	`response_body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_keys_account_key_idx` ON `idempotency_keys` (`account_id`,`key`);--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`confidence` integer DEFAULT 100 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `identities_contact_idx` ON `identities` (`contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `identities_account_kind_value_idx` ON `identities` (`account_id`,`kind`,`value`);