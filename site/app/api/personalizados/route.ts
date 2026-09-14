import { createRequestReference, ensureCustomizationSchema, getCustomizationBindings, getRequestByIdempotencyKey, randomToken, safeFileName } from "../../personalizados/storage";
import { getCustomPricing, isCustomCategory, normalizeCustomQuantity } from "../../personalizados/pricing";
import { getCategorySchema, requiresDesignFile, validateConfiguration } from "../../personalizados/schema";
import { apiServerError } from "../../lib/api-errors";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 3;

function existingRequestResponse(row: { id: string; access_token: string; reference: string }) {
  const statusUrl = `/personalizados/solicitud/${row.access_token}`;
  return Response.json({
    request: { requestId: row.id, accessToken: row.access_token, reference: row.reference, statusUrl },
    draft: { requestId: row.id, accessToken: row.access_token, reference: row.reference },
  }, { status: 200 });
}

function detectMime(bytes: Uint8Array, declared: string) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 4 && new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF") return "application/pdf";
  const head = new TextDecoder().decode(bytes.slice(0, 2048)).trimStart().toLowerCase();
  if ((declared === "image/svg+xml" || head.startsWith("<svg") || head.startsWith("<?xml")) && head.includes("<svg")) return "image/svg+xml";
  return null;
}

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  try {
    await ensureCustomizationSchema();
    const { db, bucket } = await getCustomizationBindings();
    const form = await request.formData();
    const category = String(form.get("category") ?? "");
    const itemName = String(form.get("itemName") ?? "").trim().slice(0, 100);
    const backgroundChoice = String(form.get("backgroundChoice") ?? "").trim().slice(0, 100);
    const backgroundDetected = String(form.get("backgroundDetected") ?? "") === "true";
    const backgroundChoiceSelected = String(form.get("backgroundChoiceSelected") ?? "") === "true";
    const directSubmit = String(form.get("directSubmit") ?? "") === "true";
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim().slice(0, 120) || null;
    const customerName = String(form.get("customerName") ?? "").trim().slice(0, 120);
    const customerPhone = String(form.get("customerPhone") ?? "").trim().slice(0, 40);
    const quantity = normalizeCustomQuantity(Number(form.get("quantity")));
    const rawConfiguration = String(form.get("configuration") ?? "{}");
    const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!isCustomCategory(category)) return Response.json({ error: "Selecciona un artículo válido." }, { status: 400 });
    if (directSubmit) {
      const phoneDigits = customerPhone.replace(/\D/g, "");
      if (customerName.length < 2 || phoneDigits.length < 10 || phoneDigits.length > 15) return Response.json({ error: "Revisa tu nombre y WhatsApp." }, { status: 400 });
    }
    if (directSubmit && idempotencyKey) {
      const existing = await getRequestByIdempotencyKey(idempotencyKey);
      if (existing) return existingRequestResponse(existing);
    }
    const schema = getCategorySchema(category);
    if (rawConfiguration.length > 5000) return Response.json({ error: "La configuración es demasiado extensa." }, { status: 400 });
    const parsed = JSON.parse(rawConfiguration) as Record<string, unknown>;
    const customerConfiguration = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string").map(([key, value]) => [key.slice(0, 50), value.slice(0, 150)]));
    const configurationError = validateConfiguration(category, customerConfiguration, quantity);
    if (configurationError) return Response.json({ error: configurationError }, { status: 400 });
    const fileRequired = requiresDesignFile(category, customerConfiguration);
    if ((fileRequired && !files.length) || files.length > MAX_FILES) return Response.json({ error: fileRequired ? "Agrega entre uno y tres archivos con tu logo real." : "Puedes agregar hasta tres archivos." }, { status: 400 });
    if (directSubmit && fileRequired && backgroundDetected && !backgroundChoiceSelected) return Response.json({ error: "Elige cómo debemos tratar el fondo claro de tu archivo." }, { status: 400 });
    const pricing = getCustomPricing(category, quantity);
    const configuration = { ...customerConfiguration, "Nivel de cantidad": pricing.priceLevel, "Tipo de simulación": "Logo de ejemplo; archivo real separado" };
    const requestId = crypto.randomUUID();
    const accessToken = randomToken();
    const reference = createRequestReference();
    const assetRows: { id: string; key: string; filename: string; mime: string; size: number }[] = [];

    const preparedFiles = await Promise.all(files.map(async (file) => ({ file, buffer: await file.arrayBuffer() })));
    for (const { file, buffer } of preparedFiles) {
      if (file.size > MAX_FILE_SIZE) return Response.json({ error: `${file.name} supera el límite de 15 MB.` }, { status: 400 });
      const mime = detectMime(new Uint8Array(buffer), file.type);
      if (!mime) return Response.json({ error: `${file.name} no es un PNG, JPG, WebP, PDF o SVG válido.` }, { status: 400 });
    }

    const previewFile = form.get("preview");
    const previewBuffer = previewFile instanceof File && previewFile.size > 0 && previewFile.size <= MAX_FILE_SIZE
      ? await previewFile.arrayBuffer()
      : null;
    const previewIsWebp = previewFile instanceof File && previewBuffer
      ? detectMime(new Uint8Array(previewBuffer), previewFile.type) === "image/webp"
      : false;
    const [uploadedAssets, previewRow] = await Promise.all([
      Promise.all(preparedFiles.map(async ({ file, buffer }) => {
        const mime = detectMime(new Uint8Array(buffer), file.type)!;
        const assetId = crypto.randomUUID();
        const filename = safeFileName(file.name);
        const key = `personalizados/${requestId}/disenos/${assetId}-${filename}`;
        await bucket.put(key, buffer, { httpMetadata: { contentType: mime }, customMetadata: { requestId, kind: "design", originalName: filename } });
        storedKeys.push(key);
        return { id: assetId, key, filename, mime, size: file.size };
      })),
      previewIsWebp && previewFile instanceof File && previewBuffer
        ? (async () => {
          const assetId = crypto.randomUUID();
          const key = `personalizados/${requestId}/preview/${assetId}-vista-previa.webp`;
          await bucket.put(key, previewBuffer, { httpMetadata: { contentType: "image/webp" }, customMetadata: { requestId, kind: "preview", originalName: "vista-previa.webp" } });
          storedKeys.push(key);
          return { id: assetId, key, size: previewFile.size };
        })()
        : Promise.resolve(null),
    ]);
    assetRows.push(...uploadedAssets);

    const requestStatement = directSubmit
      ? db.prepare("INSERT INTO customization_requests (id, reference, access_token, category, item_name, configuration_json, quantity, background_choice, status, customer_name, customer_phone, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)")
        .bind(requestId, reference, accessToken, category, schema.name || itemName, JSON.stringify(configuration), quantity, backgroundChoice || "No aplica", customerName, customerPhone, idempotencyKey)
      : db.prepare("INSERT INTO customization_requests (id, reference, access_token, category, item_name, configuration_json, quantity, background_choice, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')")
        .bind(requestId, reference, accessToken, category, schema.name || itemName, JSON.stringify(configuration), quantity, backgroundChoice || "No aplica");
    const statements = [
      requestStatement,
      ...assetRows.map((asset) => db.prepare("INSERT INTO customization_assets (id, request_id, kind, version, r2_key, filename, mime_type, size_bytes) VALUES (?, ?, 'design', 1, ?, ?, ?, ?)")
        .bind(asset.id, requestId, asset.key, asset.filename, asset.mime, asset.size)),
      ...(previewRow ? [db.prepare("INSERT INTO customization_assets (id, request_id, kind, version, r2_key, filename, mime_type, size_bytes) VALUES (?, ?, 'preview', 1, ?, 'vista-previa.webp', 'image/webp', ?)")
        .bind(previewRow.id, requestId, previewRow.key, previewRow.size)] : []),
    ];
    statements.push(db.prepare("INSERT INTO customization_events (id, request_id, event_type, actor, message) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), requestId, directSubmit ? "request_submitted" : "draft_created", "customer", `${assetRows.length} archivo(s) recibido(s)`));
    try {
      await db.batch(statements);
    } catch (error) {
      if (idempotencyKey) {
        const existing = await getRequestByIdempotencyKey(idempotencyKey);
        if (existing) {
          await Promise.all(storedKeys.map((key) => bucket.delete(key)));
          return existingRequestResponse(existing);
        }
      }
      throw error;
    }
    const statusUrl = `/personalizados/solicitud/${accessToken}`;
    return Response.json({
      request: { requestId, accessToken, reference, statusUrl },
      draft: { requestId, accessToken, reference },
    }, { status: 201 });
  } catch (error) {
    try {
      const { bucket } = await getCustomizationBindings();
      await Promise.all(storedKeys.map((key) => bucket.delete(key)));
    } catch { /* best effort cleanup */ }
    return apiServerError("api/personalizados", error, "No fue posible guardar la personalización.");
  }
}
