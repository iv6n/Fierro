import { ensureCustomizationSchema, getCustomizationBindings, getRequestAssets, getRequestByToken, publicRequest } from "../../../../personalizados/storage";
import { apiServerError } from "../../../../lib/api-errors";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureCustomizationSchema();
    const { token } = await context.params;
    const row = await getRequestByToken(token);
    if (!row) return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
    return Response.json({ request: publicRequest(row, await getRequestAssets(row.id), token) });
  } catch (error) {
    return apiServerError("api/personalizados/solicitud/get", error, "No fue posible consultar la solicitud.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureCustomizationSchema();
    const { db } = await getCustomizationBindings();
    const { token } = await context.params;
    const row = await getRequestByToken(token);
    if (!row) return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
    const payload = await request.json() as { action?: "approve" | "changes" | "pay_demo"; message?: string };
    let eventType = "";
    let eventMessage: string | null = null;
    let updateStatement;
    if (payload.action === "approve" && row.status === "proof_ready") {
      updateStatement = db.prepare("UPDATE customization_requests SET status = 'approved', customer_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id);
      eventType = "proof_approved";
    } else if (payload.action === "changes" && row.status === "proof_ready") {
      const message = payload.message?.trim().slice(0, 1000) ?? "";
      if (!message) return Response.json({ error: "Describe el cambio que necesitas." }, { status: 400 });
      updateStatement = db.prepare("UPDATE customization_requests SET status = 'changes_requested', customer_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(message, row.id);
      eventType = "changes_requested";
      eventMessage = message;
    } else if (payload.action === "pay_demo" && row.status === "approved" && row.quote_amount !== null) {
      updateStatement = db.prepare("UPDATE customization_requests SET status = 'custom_paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id);
      eventType = "custom_payment_demo";
      eventMessage = String(row.quote_amount);
    } else {
      return Response.json({ error: "Esta acción no está disponible en el estado actual." }, { status: 409 });
    }
    await db.batch([
      updateStatement!,
      db.prepare("INSERT INTO customization_events (id, request_id, event_type, actor, message) VALUES (?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), row.id, eventType, "customer", eventMessage),
    ]);
    const updated = await getRequestByToken(token);
    return Response.json({ request: updated ? publicRequest(updated, await getRequestAssets(updated.id), token) : null });
  } catch (error) {
    return apiServerError("api/personalizados/solicitud/post", error, "No fue posible actualizar la solicitud.");
  }
}
