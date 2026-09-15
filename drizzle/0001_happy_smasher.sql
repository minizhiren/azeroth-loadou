CREATE INDEX `idx_packages_status_created_at` ON `packages` (`status`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
