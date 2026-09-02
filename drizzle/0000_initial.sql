CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token_hash` ON `sessions` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `experiments` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL UNIQUE,
  `question` text NOT NULL,
  `metric` text NOT NULL,
  `unit` text NOT NULL,
  `calculation` text NOT NULL,
  `missing_rule` text NOT NULL,
  `duplicate_rule` text NOT NULL,
  `outlier_rule` text NOT NULL,
  `rounding_rule` text NOT NULL,
  `week_start` text NOT NULL,
  `plan_before` text NOT NULL,
  `plan_after` text,
  `changed_at` text,
  `changed_reason` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `records` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `record_date` text NOT NULL,
  `value` real NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `phase` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_records_user_date` ON `records` (`user_id`,`record_date`);
--> statement-breakpoint
CREATE INDEX `idx_records_user_date` ON `records` (`user_id`,`record_date`);
--> statement-breakpoint
CREATE TABLE `legacy_records` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `legacy_id` text NOT NULL,
  `record_date` text NOT NULL,
  `value` real NOT NULL,
  `unit` text NOT NULL,
  `memo` text NOT NULL,
  `tag` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_legacy_records_user_id` ON `legacy_records` (`user_id`,`legacy_id`);
--> statement-breakpoint
CREATE INDEX `idx_legacy_records_user_date` ON `legacy_records` (`user_id`,`record_date`);
