CREATE TABLE `contact_tags` (
	`contact_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_tags_pk` ON `contact_tags` (`contact_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `contact_tags_tag_idx` ON `contact_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`contact_id` text,
	`title` text NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`value` integer,
	`currency` text,
	`expected_close_date` text,
	`custom_fields` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `deals_account_idx` ON `deals` (`account_id`);--> statement-breakpoint
CREATE INDEX `deals_contact_idx` ON `deals` (`contact_id`);--> statement-breakpoint
CREATE INDEX `deals_account_stage_idx` ON `deals` (`account_id`,`stage`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`contact_id` text,
	`deal_id` text,
	`title` text,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `notes_account_idx` ON `notes` (`account_id`);--> statement-breakpoint
CREATE INDEX `notes_contact_idx` ON `notes` (`contact_id`);--> statement-breakpoint
CREATE INDEX `notes_deal_idx` ON `notes` (`deal_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_account_name_idx` ON `tags` (`account_id`,`name`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`contact_id` text,
	`deal_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_account_status_idx` ON `tasks` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `tasks_contact_idx` ON `tasks` (`contact_id`);--> statement-breakpoint
CREATE INDEX `tasks_deal_idx` ON `tasks` (`deal_id`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`account_id`,`due_at`);