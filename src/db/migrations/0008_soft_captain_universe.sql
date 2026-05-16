CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`secret_key_encrypted` text NOT NULL,
	`webhook_secret_encrypted` text,
	`webhook_endpoint_id` text,
	`provider_account_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_synced_at` text,
	`last_error_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_account_provider_idx` ON `integrations` (`account_id`,`provider`);--> statement-breakpoint
CREATE INDEX `integrations_status_idx` ON `integrations` (`status`);--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`type` text NOT NULL,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`processed_at` text,
	`payload` text NOT NULL,
	`error_message` text,
	`retries` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stripe_events_account_received_idx` ON `stripe_events` (`account_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `stripe_events_type_idx` ON `stripe_events` (`type`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `stripe_customer_id` text;--> statement-breakpoint
CREATE INDEX `contacts_stripe_customer_idx` ON `contacts` (`account_id`,`stripe_customer_id`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `stripe_invoice_id` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `stripe_charge_id` text;--> statement-breakpoint
CREATE INDEX `invoices_stripe_id_idx` ON `invoices` (`account_id`,`stripe_invoice_id`);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripe_subscription_id` text;--> statement-breakpoint
CREATE INDEX `subs_stripe_id_idx` ON `subscriptions` (`account_id`,`stripe_subscription_id`);