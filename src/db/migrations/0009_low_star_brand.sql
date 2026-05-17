CREATE TABLE `email_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`domain` text NOT NULL,
	`resend_domain_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`dns_records` text,
	`region` text,
	`last_verified_at` text,
	`last_error_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_domains_account_idx` ON `email_domains` (`account_id`);--> statement-breakpoint
CREATE INDEX `email_domains_integration_idx` ON `email_domains` (`integration_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_domains_account_domain_idx` ON `email_domains` (`account_id`,`domain`);