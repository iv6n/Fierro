CREATE INDEX `customization_assets_request_idx` ON `customization_assets` (`request_id`,`kind`,`version`);--> statement-breakpoint
CREATE INDEX `customization_events_request_idx` ON `customization_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `customization_requests_status_idx` ON `customization_requests` (`status`,`updated_at`);