CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `agent_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`api_key_id` text NOT NULL,
	`operation` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`intent` text,
	`metadata` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_actions_account_created_idx` ON `agent_actions` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `agent_actions_target_idx` ON `agent_actions` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `agent_actions_actor_idx` ON `agent_actions` (`api_key_id`);--> statement-breakpoint
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
CREATE INDEX `api_keys_hash_idx` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`category` text NOT NULL,
	`vendor` text,
	`description` text,
	`occurred_at` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`custom_fields` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expenses_account_occurred_idx` ON `expenses` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `expenses_account_category_idx` ON `expenses` (`account_id`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_source_ref_idx` ON `expenses` (`account_id`,`source`,`source_ref`);--> statement-breakpoint
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
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`counterparty` text,
	`subscription_id` text,
	`number` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_at` text NOT NULL,
	`due_at` text,
	`paid_at` text,
	`voided_at` text,
	`note` text,
	`custom_fields` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invoices_account_status_idx` ON `invoices` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `invoices_subscription_idx` ON `invoices` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `invoices_account_issued_idx` ON `invoices` (`account_id`,`issued_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_account_number_idx` ON `invoices` (`account_id`,`number`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'saas' NOT NULL,
	`pricing_model` text DEFAULT 'recurring' NOT NULL,
	`unit_amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`billing_cycle` text,
	`custom_cycle_days` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`custom_fields` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `products_account_idx` ON `products` (`account_id`);--> statement-breakpoint
CREATE INDEX `products_account_status_idx` ON `products` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`counterparty` text,
	`product_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`billing_cycle` text NOT NULL,
	`custom_cycle_days` integer,
	`mrr_cents` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text NOT NULL,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`canceled_at` text,
	`cancel_at` text,
	`cancel_reason` text,
	`custom_fields` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `subs_account_status_idx` ON `subscriptions` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `subs_product_idx` ON `subscriptions` (`product_id`);--> statement-breakpoint
CREATE INDEX `subs_period_end_idx` ON `subscriptions` (`account_id`,`current_period_end`);