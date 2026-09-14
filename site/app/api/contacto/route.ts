import { ensureContactSchema, getContactBindings } from "../../contacto/storage";
import { apiServerError } from "../../lib/api-errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  company?: string;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json() as ContactPayload;

    // Honeypot: campo oculto que un humano nunca llena. Si viene con
    // contenido, se descarta en silencio en vez de persistir el mensaje.
    if (payload.company?.trim()) return Response.json({ ok: true });

    const name = payload.name?.trim().slice(0, 120) ?? "";
    const email = payload.email?.trim().slice(0, 160) ?? "";
    const phone = payload.phone?.trim().slice(0, 40) ?? "";
    const message = payload.message?.trim().slice(0, 2000) ?? "";

    if (!name || !message) return Response.json({ error: "Falta tu nombre o tu mensaje." }, { status: 400 });
    if (!EMAIL_PATTERN.test(email)) return Response.json({ error: "Ingresa un correo válido." }, { status: 400 });

    await ensureContactSchema();
    const { db } = await getContactBindings();
    await db.prepare("INSERT INTO contact_messages (id, name, email, phone, message) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), name, email, phone || null, message).run();

    return Response.json({ ok: true });
  } catch (error) {
    return apiServerError("api/contacto", error, "No fue posible enviar tu mensaje.");
  }
}
