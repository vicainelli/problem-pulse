CREATE TABLE `clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`pain_ids` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_document_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_name` text,
	`posted_at` text NOT NULL,
	`url` text,
	`sentiment` text DEFAULT 'neutral' NOT NULL,
	`buying_signals` text DEFAULT '[]' NOT NULL,
	`persona` text DEFAULT '{"role":"unknown","description":""}' NOT NULL,
	`normalized_at` text NOT NULL,
	FOREIGN KEY (`raw_document_id`) REFERENCES `raw_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_raw_document` ON `documents` (`raw_document_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_source` ON `documents` (`source`);--> statement-breakpoint
CREATE TABLE `embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`pain_id` text NOT NULL,
	`vector` text NOT NULL,
	`dimensions` integer NOT NULL,
	`model_version` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`pain_id`) REFERENCES `pains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_embeddings_pain` ON `embeddings` (`pain_id`);--> statement-breakpoint
CREATE INDEX `idx_embeddings_content_hash` ON `embeddings` (`content_hash`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`excerpt` text NOT NULL,
	`char_offset` integer NOT NULL,
	`char_length` integer NOT NULL,
	`confidence` real NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_document` ON `evidence` (`document_id`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`cluster_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`market_size` text,
	`priority_score` real DEFAULT 0 NOT NULL,
	`signals` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `clusters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_opportunities_cluster` ON `opportunities` (`cluster_id`);--> statement-breakpoint
CREATE TABLE `pains` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`target_market` text DEFAULT '{"segment":"unknown","description":""}' NOT NULL,
	`evidence_ids` text DEFAULT '[]' NOT NULL,
	`cluster_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `clusters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pains_cluster` ON `pains` (`cluster_id`);--> statement-breakpoint
CREATE TABLE `raw_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`raw_content` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`collected_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_raw_documents_source_external` ON `raw_documents` (`source`,`external_id`);