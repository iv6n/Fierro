let initialized = false;

export async function getContactBindings() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("El almacenamiento de contacto todavía no está disponible.");
  return { db: env.DB };
}

export async function ensureContactSchema() {
  if (initialized) return;
  const { db } = await getContactBindings();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages(created_at)"),
  ]);
  initialized = true;
}
