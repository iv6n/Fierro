import { isCustomCategory } from "../../../personalizados/pricing";
import { ensureCustomizationSchema, getCustomizationBindings } from "../../../personalizados/storage";
import { apiServerError } from "../../../lib/api-errors";

const EVENTS = new Set(["step_viewed", "validation_failed", "review_confirmed", "submit_started", "submit_succeeded"]);

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { category?: unknown; event?: unknown; field?: unknown; step?: unknown };
    const category = typeof payload.category === "string" ? payload.category : "";
    const event = typeof payload.event === "string" ? payload.event : "";
    const field = typeof payload.field === "string" ? payload.field : null;
    const step = Number(payload.step);
    if (!isCustomCategory(category) || !EVENTS.has(event) || (field !== null && !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(field)) || !Number.isInteger(step) || step < 1 || step > 4) {
      return new Response(null, { status: 204 });
    }
    await ensureCustomizationSchema();
    const { db } = await getCustomizationBindings();
    await db.prepare("INSERT INTO customization_funnel_events (id, category, event_type, field_name, step) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), category, event, field, step)
      .run();
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiServerError("api/personalizados/telemetry", error, "No fue posible registrar el evento.");
  }
}
