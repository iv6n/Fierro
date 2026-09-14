import { ensureCustomizationSchema, getCustomizationBindings } from "../../../personalizados/storage";
import { apiServerError } from "../../../lib/api-errors";

type LinkPayload = {
  orderReference?: string;
  customer?: { name?: string; phone?: string; email?: string; address?: string; city?: string; state?: string; postalCode?: string; notes?: string };
  requests?: { requestId?: string; accessToken?: string }[];
};

export async function POST(request: Request) {
  try {
    await ensureCustomizationSchema();
    const { db } = await getCustomizationBindings();
    const payload = await request.json() as LinkPayload;
    const orderReference = payload.orderReference?.trim().slice(0, 60) ?? "";
    const customer = payload.customer;
    const requests = payload.requests ?? [];
    if (!orderReference || !customer?.name?.trim() || !customer.phone?.trim() || !customer.email?.trim() || !requests.length) return Response.json({ error: "Falta información para vincular el pedido." }, { status: 400 });
    const requested = requests.slice(0, 10);
    if (requested.some((item) => !item.requestId || !item.accessToken)) return Response.json({ error: "Hay una personalización incompleta en el carrito." }, { status: 400 });
    const rows = await Promise.all(requested.map(async (item) => ({
      item,
      row: await db.prepare("SELECT reference, access_token, status FROM customization_requests WHERE id = ? AND access_token = ? LIMIT 1").bind(item.requestId, item.accessToken).first<{ reference: string; access_token: string; status: string }>(),
    })));
    if (rows.some(({ row }) => !row || row.status !== "draft")) return Response.json({ error: "Una personalización ya fue vinculada o dejó de estar disponible." }, { status: 409 });
    const shipping = JSON.stringify({ address: customer.address?.slice(0, 200) ?? "", city: customer.city?.slice(0, 100) ?? "", state: customer.state?.slice(0, 100) ?? "", postalCode: customer.postalCode?.slice(0, 10) ?? "", notes: customer.notes?.slice(0, 500) ?? "" });
    await db.batch([
      ...rows.map(({ item }) => db.prepare("UPDATE customization_requests SET status = 'linked', linked_order_reference = ?, customer_name = ?, customer_phone = ?, customer_email = ?, shipping_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND access_token = ?")
        .bind(orderReference, customer.name!.trim().slice(0, 120), customer.phone!.trim().slice(0, 40), customer.email!.trim().slice(0, 160), shipping, item.requestId, item.accessToken)),
      ...rows.map(({ item }) => db.prepare("INSERT INTO customization_events (id, request_id, event_type, actor, message) VALUES (?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), item.requestId, "linked_to_order", "customer", orderReference)),
    ]);
    const statusLinks = rows.map(({ row }) => ({ reference: row!.reference, url: `/personalizados/solicitud/${row!.access_token}` }));
    return Response.json({ orderReference, statusLinks });
  } catch (error) {
    return apiServerError("api/personalizados/vincular", error, "No fue posible vincular el pedido.");
  }
}
