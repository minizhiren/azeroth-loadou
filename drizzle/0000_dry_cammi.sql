CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`uploader` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`game_version` text DEFAULT 'retail' NOT NULL,
	`size_bytes` integer NOT NULL,
	`total_parts` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
