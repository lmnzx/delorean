CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone_number` text,
	`email` text,
	`linked_id` integer,
	`link_precedence` text DEFAULT 'primary',
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`deleted_at` integer
);
