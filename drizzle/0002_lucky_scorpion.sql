CREATE TABLE `entries_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text NOT NULL,
	`source` text NOT NULL,
	`temperature` real NOT NULL
);
