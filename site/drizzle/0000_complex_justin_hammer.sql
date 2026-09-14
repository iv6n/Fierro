CREATE TABLE `customization_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`kind` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `customization_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customization_assets_r2_key_unique` ON `customization_assets` (`r2_key`);--> statement-breakpoint
CREATE TABLE `customization_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor` text NOT NULL,
	`message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `customization_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customization_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`access_token` text NOT NULL,
	`category` text NOT NULL,
	`item_name` text NOT NULL,
	`configuration_json` text NOT NULL,
	`quantity` integer NOT NULL,
	`background_choice` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`linked_order_reference` text,
	`customer_name` text,
	`customer_phone` text,
	`customer_email` text,
	`shipping_json` text,
	`quote_amount` integer,
	`quote_notes` text,
	`estimated_ready` text,
	`customer_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customization_requests_reference_unique` ON `customization_requests` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `customization_requests_access_token_unique` ON `customization_requests` (`access_token`);