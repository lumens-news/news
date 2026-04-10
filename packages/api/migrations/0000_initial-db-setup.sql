CREATE TABLE `brief_signals` (
	`brief_id` text,
	`signal_id` text,
	PRIMARY KEY(`brief_id`, `signal_id`),
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`compiled_by` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `briefs_date_unique` ON `briefs` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_index_brief_date` ON `briefs` (`date`);--> statement-breakpoint
CREATE TABLE `signals` (
	`id` text PRIMARY KEY NOT NULL,
	`correspondent` text NOT NULL,
	`beat` text NOT NULL,
	`headline` text NOT NULL,
	`body` text NOT NULL,
	`tags` text NOT NULL,
	`sources` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`filedAt` integer NOT NULL,
	`approvedAt` integer,
	`rejectedAt` integer,
	`rejection_reason` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `index_signal_correspondent` ON `signals` (`correspondent`);--> statement-breakpoint
CREATE INDEX `index_signal_beat` ON `signals` (`beat`);--> statement-breakpoint
CREATE INDEX `index_signal_correspondent_status` ON `signals` (`correspondent`,`status`);