import { addCustomizationEvent, ensureCustomizationSchema, getCustomizationBindings, getRequestAssets, getRequestById, safeFileName } from "../../../../personalizados/storage";
import { requireCustomizationAdmin } from "../../../../personalizados/admin";
import { apiServerError } from "../../../../lib/api-errors";

const allowedStatuses = new Set(["in_review", "proof_ready", "ready_to_ship", "closed"]);
const allowedProofTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCustomizationAdmin();
  if (!admin) return Response.json({ error: "No autorizado." }, { status: 403 });
  try {
    await ensureCustomizationSchema();
    const { db, bucket } = await getCustomizationBindings();
    const { id } = await context.params;
    const current = await getRequestById(id);
    if (!current) return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
    const form = await request.formData();
    const rawQuote = String(form.get("quote") ?? "").trim();
    const quote = rawQuote ? Math.max(0, Math.round(Number(rawQuote))) : current.quote_amount;
    if (quote !== null && !Number.isFinite(quote)) return Response.json({ error: "Ingresa una cotización válida." }, { status: 400 });
    const quoteNotes = String(form.get("quoteNotes") ?? "").trim().slice(0, 1000) || null;
    const estimatedReady = String(form.get("estimatedReady") ?? "").trim().slice(0, 120) || null;
    const requestedStatus = String(form.get("status") ?? "in_review");
    const proof = form.get("proof");
    let status = allowedStatuses.has(requestedStatus) ? requestedStatus : "in_review";
    const previousProofs = (await getRequestAssets(id)).filter((asset) => asset.kind === "proof");

    if (proof instanceof File && proof.size > 0) {
      if (quote === null) return Response.json({ error: "Agrega el precio antes de enviar la muestra al cliente." }, { status: 400 });
      if (proof.size > 15 * 1024 * 1024 || !allowedProofTypes.has(proof.type)) return Response.json({ error: "La muestra debe ser PNG, JPG, WebP o PDF y pesar máximo 15 MB." }, { status: 400 });
      const version = Math.max(0, ...previousProofs.map((asset) => asset.version)) + 1;
      const assetId = crypto.randomUUID();
      const filename = safeFileName(proof.name);
      const key = `personalizados/${id}/muestras/v${version}-${assetId}-${filename}`;
      await bucket.put(key, await proof.arrayBuffer(), { httpMetadata: { contentType: proof.type }, customMetadata: { requestId: id, kind: "proof", version: String(version) } });
      await db.prepare("INSERT INTO customization_assets (id, request_id, kind, version, r2_key, filename, mime_type, size_bytes) VALUES (?, ?, 'proof', ?, ?, ?, ?, ?)")
        .bind(assetId, id, version, key, filename, proof.type, proof.size).run();
      status = "proof_ready";
      await addCustomizationEvent(id, "proof_uploaded", "admin", `Versión ${version}`);
    }
    if (status === "proof_ready" && (!previousProofs.length || quote === null) && !(proof instanceof File && proof.size > 0)) return Response.json({ error: "Carga una muestra y una cotización antes de marcarla como lista." }, { status: 400 });

    await db.prepare("UPDATE customization_requests SET status = ?, quote_amount = ?, quote_notes = ?, estimated_ready = ?, customer_message = CASE WHEN ? = 'proof_ready' THEN NULL ELSE customer_message END, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(status, quote, quoteNotes, estimatedReady, status, id).run();
    await addCustomizationEvent(id, "admin_update", "admin", status);
    return Response.json({ ok: true });
  } catch (error) {
    return apiServerError("api/admin/personalizados/id", error, "No fue posible actualizar la solicitud.");
  }
}
