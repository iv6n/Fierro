"use client";

export type PersonalizationEvent =
  | "step_viewed"
  | "validation_failed"
  | "review_confirmed"
  | "submit_started"
  | "submit_succeeded";

export function trackPersonalizationEvent(category: string, event: PersonalizationEvent, field?: string, step?: number) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ category, event, field, step });
  try {
    const body = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/personalizados/telemetry", body)) return;
    void fetch("/api/personalizados/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Funnel measurement must never interrupt the personalization flow.
  }
}
