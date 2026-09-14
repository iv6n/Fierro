import { adminRequest, ensureCustomizationSchema, getCustomizationBindings, getRequestAssets, purgeExpiredCustomizations } from "../../../personalizados/storage";
import { requireCustomizationAdmin } from "../../../personalizados/admin";
import { apiServerError } from "../../../lib/api-errors";

export async function GET() {
  const admin = await requireCustomizationAdmin();
  if (!admin) return Response.json({ error: "No autorizado." }, { status: 403 });
  try {
    await ensureCustomizationSchema();
    await purgeExpiredCustomizations();
    const { db } = await getCustomizationBindings();
    const rows = (await db.prepare("SELECT * FROM customization_requests WHERE status <> 'draft' ORDER BY updated_at DESC LIMIT 100").all()).results as Parameters<typeof adminRequest>[0][];
    const requests = await Promise.all(rows.map(async (row) => adminRequest(row, await getRequestAssets(row.id))));
    return Response.json({ requests });
  } catch (error) {
    return apiServerError("api/admin/personalizados", error, "No fue posible cargar las solicitudes.");
  }
}
