export const CUSTOM_STATUSES = ["draft", "submitted", "linked", "in_review", "proof_ready", "changes_requested", "approved", "custom_paid", "ready_to_ship", "closed"] as const;
export type CustomStatus = (typeof CUSTOM_STATUSES)[number];

export type CustomRequestRow = {
  id: string;
  reference: string;
  access_token: string;
  category: string;
  item_name: string;
  configuration_json: string;
  quantity: number;
  background_choice: string;
  status: CustomStatus;
  linked_order_reference: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  idempotency_key: string | null;
  customer_email: string | null;
  shipping_json: string | null;
  quote_amount: number | null;
  quote_notes: string | null;
  estimated_ready: string | null;
  customer_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomAssetRow = {
  id: string;
  request_id: string;
  kind: "design" | "proof" | "preview";
  version: number;
  r2_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

let initialized = false;
let initializationPromise: Promise<void> | null = null;

export async function getCustomizationBindings() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB || !env.UPLOADS) throw new Error("El almacenamiento de personalizaciones todavía no está disponible.");
  return { db: env.DB, bucket: env.UPLOADS };
}

export async function ensureCustomizationSchema() {
  if (initialized) return;
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const { db } = await getCustomizationBindings();
    await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS customization_requests (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      item_name TEXT NOT NULL,
      configuration_json TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      background_choice TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      linked_order_reference TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      idempotency_key TEXT,
      customer_email TEXT,
      shipping_json TEXT,
      quote_amount INTEGER,
      quote_notes TEXT,
      estimated_ready TEXT,
      customer_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customization_assets (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      r2_key TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customization_events (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES customization_requests(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customization_funnel_events (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      event_type TEXT NOT NULL,
      field_name TEXT,
      step INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
      db.prepare("CREATE INDEX IF NOT EXISTS customization_requests_status_idx ON customization_requests(status, updated_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS customization_requests_created_idx ON customization_requests(status, created_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS customization_assets_request_idx ON customization_assets(request_id, kind, version)"),
      db.prepare("CREATE INDEX IF NOT EXISTS customization_events_request_idx ON customization_events(request_id, created_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS customization_funnel_events_idx ON customization_funnel_events(category, event_type, created_at)"),
    ]);
    try {
      await db.prepare("ALTER TABLE customization_requests ADD COLUMN idempotency_key TEXT").run();
    } catch { /* Existing deployments already have the column. */ }
    await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS customization_requests_idempotency_idx ON customization_requests(idempotency_key)").run();
    initialized = true;
  })().catch((error) => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
}

export async function purgeExpiredCustomizations() {
  await ensureCustomizationSchema();
  const { db, bucket } = await getCustomizationBindings();
  const expired = (await db.prepare("SELECT id FROM customization_requests WHERE (status = 'draft' AND created_at < datetime('now', '-1 day')) OR (status = 'closed' AND updated_at < datetime('now', '-90 days')) LIMIT 50").all<{ id: string }>()).results;
  for (const request of expired) {
    const assets = (await db.prepare("SELECT r2_key FROM customization_assets WHERE request_id = ?").bind(request.id).all<{ r2_key: string }>()).results;
    await Promise.all(assets.map((asset) => bucket.delete(asset.r2_key)));
    await db.batch([
      db.prepare("DELETE FROM customization_assets WHERE request_id = ?").bind(request.id),
      db.prepare("DELETE FROM customization_events WHERE request_id = ?").bind(request.id),
      db.prepare("DELETE FROM customization_requests WHERE id = ?").bind(request.id),
    ]);
  }
}

export function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createRequestReference() {
  const date = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Hermosillo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  const day = `${parts.year}${parts.month}${parts.day}`;
  return `FIE-PER-${day}-${randomToken(4).slice(0, 6).toUpperCase()}`;
}

export function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "archivo";
}

export async function addCustomizationEvent(requestId: string, eventType: string, actor: "customer" | "admin" | "system", message?: string) {
  const { db } = await getCustomizationBindings();
  await db.prepare("INSERT INTO customization_events (id, request_id, event_type, actor, message) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), requestId, eventType, actor, message?.slice(0, 1000) || null).run();
}

export async function getRequestByToken(token: string) {
  const { db } = await getCustomizationBindings();
  return db.prepare("SELECT * FROM customization_requests WHERE access_token = ? LIMIT 1").bind(token).first<CustomRequestRow>();
}

export async function getRequestById(id: string) {
  const { db } = await getCustomizationBindings();
  return db.prepare("SELECT * FROM customization_requests WHERE id = ? LIMIT 1").bind(id).first<CustomRequestRow>();
}

export async function getRequestByIdempotencyKey(key: string) {
  const { db } = await getCustomizationBindings();
  return db.prepare("SELECT * FROM customization_requests WHERE idempotency_key = ? LIMIT 1").bind(key).first<CustomRequestRow>();
}

export async function getRequestAssets(requestId: string) {
  const { db } = await getCustomizationBindings();
  return (await db.prepare("SELECT * FROM customization_assets WHERE request_id = ? ORDER BY kind, version DESC, created_at DESC").bind(requestId).all<CustomAssetRow>()).results;
}

export function parseConfiguration(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export function publicRequest(row: CustomRequestRow, assets: CustomAssetRow[], token: string) {
  return {
    reference: row.reference,
    category: row.category,
    itemName: row.item_name,
    configuration: parseConfiguration(row.configuration_json),
    quantity: row.quantity,
    backgroundChoice: row.background_choice,
    status: row.status,
    linkedOrderReference: row.linked_order_reference,
    quoteAmount: row.quote_amount,
    quoteNotes: row.quote_notes,
    estimatedReady: row.estimated_ready,
    customerMessage: row.customer_message,
    createdAt: row.created_at,
    assets: assets.map((asset) => ({ id: asset.id, kind: asset.kind, version: asset.version, filename: asset.filename, mimeType: asset.mime_type, url: `/api/personalizados/archivo/${asset.id}?token=${encodeURIComponent(token)}` })),
  };
}

export function adminRequest(row: CustomRequestRow, assets: CustomAssetRow[]) {
  return {
    id: row.id,
    reference: row.reference,
    accessToken: row.access_token,
    category: row.category,
    itemName: row.item_name,
    configuration: parseConfiguration(row.configuration_json),
    quantity: row.quantity,
    backgroundChoice: row.background_choice,
    status: row.status,
    linkedOrderReference: row.linked_order_reference,
    customer: { name: row.customer_name, phone: row.customer_phone, email: row.customer_email },
    shipping: row.shipping_json ? JSON.parse(row.shipping_json) : null,
    quoteAmount: row.quote_amount,
    quoteNotes: row.quote_notes,
    estimatedReady: row.estimated_ready,
    customerMessage: row.customer_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    statusUrl: `/personalizados/solicitud/${row.access_token}`,
    assets: assets.map((asset) => ({ id: asset.id, kind: asset.kind, version: asset.version, filename: asset.filename, mimeType: asset.mime_type, url: `/api/personalizados/archivo/${asset.id}` })),
  };
}
