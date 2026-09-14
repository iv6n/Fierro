import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const customizationRequests = sqliteTable("customization_requests", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  accessToken: text("access_token").notNull().unique(),
  category: text("category").notNull(),
  itemName: text("item_name").notNull(),
  configurationJson: text("configuration_json").notNull(),
  quantity: integer("quantity").notNull(),
  backgroundChoice: text("background_choice").notNull(),
  status: text("status").notNull().default("draft"),
  linkedOrderReference: text("linked_order_reference"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  idempotencyKey: text("idempotency_key"),
  customerEmail: text("customer_email"),
  shippingJson: text("shipping_json"),
  quoteAmount: integer("quote_amount"),
  quoteNotes: text("quote_notes"),
  estimatedReady: text("estimated_ready"),
  customerMessage: text("customer_message"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("customization_requests_status_idx").on(table.status, table.updatedAt), uniqueIndex("customization_requests_idempotency_idx").on(table.idempotencyKey)]);

export const customizationAssets = sqliteTable("customization_assets", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => customizationRequests.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  version: integer("version").notNull().default(1),
  r2Key: text("r2_key").notNull().unique(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("customization_assets_request_idx").on(table.requestId, table.kind, table.version)]);

export const customizationEvents = sqliteTable("customization_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => customizationRequests.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  message: text("message"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("customization_events_request_idx").on(table.requestId, table.createdAt)]);

export const customizationFunnelEvents = sqliteTable("customization_funnel_events", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  eventType: text("event_type").notNull(),
  fieldName: text("field_name"),
  step: integer("step").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("customization_funnel_events_idx").on(table.category, table.eventType, table.createdAt)]);

export const contactMessages = sqliteTable("contact_messages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("contact_messages_created_idx").on(table.createdAt)]);
