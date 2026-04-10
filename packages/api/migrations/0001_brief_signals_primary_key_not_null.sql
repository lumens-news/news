PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_brief_signals` (
	`brief_id` text NOT NULL,
	`signal_id` text NOT NULL,
	PRIMARY KEY(`brief_id`, `signal_id`),
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_brief_signals`("brief_id", "signal_id") SELECT "brief_id", "signal_id" FROM `brief_signals`;--> statement-breakpoint
DROP TABLE `brief_signals`;--> statement-breakpoint
ALTER TABLE `__new_brief_signals` RENAME TO `brief_signals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;