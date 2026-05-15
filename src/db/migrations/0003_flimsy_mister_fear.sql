CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`contact_id` text,
	`kind` text NOT NULL,
	`direction` text,
	`source` text,
	`subject` text,
	`body` text,
	`metadata` text,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `interactions_account_occurred_idx` ON `interactions` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `interactions_contact_occurred_idx` ON `interactions` (`contact_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `interactions_kind_idx` ON `interactions` (`account_id`,`kind`);