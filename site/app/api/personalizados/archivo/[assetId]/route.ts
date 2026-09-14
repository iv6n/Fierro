import { ensureCustomizationSchema, getCustomizationBindings, getRequestByToken } from "../../../../personalizados/storage";
import { requireCustomizationAdmin } from "../../../../personalizados/admin";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    await ensureCustomizationSchema();
    const { db, bucket } = await getCustomizationBindings();
    const { assetId } = await context.params;
    const asset = await db.prepare("SELECT * FROM customization_assets WHERE id = ? LIMIT 1").bind(assetId).first<{ request_id: string; r2_key: string; filename: string; mime_type: string }>();
    if (!asset) return new Response("No encontrado", { status: 404 });
    const admin = await requireCustomizationAdmin();
    if (!admin) {
      const token = new URL(request.url).searchParams.get("token") ?? "";
      const owner = await getRequestByToken(token);
      if (!owner || owner.id !== asset.request_id) return new Response("No autorizado", { status: 403 });
    }
    const object = await bucket.get(asset.r2_key);
    if (!object) return new Response("No encontrado", { status: 404 });
    const inline = ["image/png", "image/jpeg", "image/webp"].includes(asset.mime_type);
    const safeName = asset.filename.replaceAll('"', "");
    return new Response(object.body, { headers: {
      "content-type": asset.mime_type,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    } });
  } catch {
    return new Response("No fue posible abrir el archivo", { status: 500 });
  }
}
