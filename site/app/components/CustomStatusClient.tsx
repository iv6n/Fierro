"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type RequestStatus = {
  reference: string;
  itemName: string;
  configuration: Record<string, string>;
  quantity: number;
  status: string;
  linkedOrderReference: string | null;
  quoteAmount: number | null;
  quoteNotes: string | null;
  estimatedReady: string | null;
  customerMessage: string | null;
  assets: { id: string; kind: "design" | "proof" | "preview"; version: number; filename: string; mimeType: string; url: string }[];
};

const statusCopy: Record<string, { label: string; description: string }> = {
  draft: { label: "Borrador", description: "La pieza todavía no está ligada a un pedido." },
  submitted: { label: "Recibida", description: "Recibimos tus datos. FIERRO revisará la configuración y el archivo antes de preparar la muestra." },
  linked: { label: "Recibida", description: "Tu pieza comparte folio con el pedido de catálogo y está pendiente de revisión." },
  in_review: { label: "En revisión", description: "FIERRO está revisando el archivo y las opciones solicitadas." },
  proof_ready: { label: "Muestra lista", description: "Revisa la propuesta y apruébala o solicita un cambio." },
  changes_requested: { label: "Cambios solicitados", description: "Recibimos tus comentarios y prepararemos una nueva muestra." },
  approved: { label: "Aprobada", description: "La muestra está aprobada. Falta completar el segundo pago." },
  custom_paid: { label: "Pago vinculado", description: "La personalización ya comparte el folio y el envío del pedido original." },
  ready_to_ship: { label: "Lista para envío conjunto", description: "La pieza personalizada y el catálogo están listos para salir juntos." },
  closed: { label: "Cerrada", description: "Esta solicitud fue cerrada." },
};

export default function CustomStatusClient({ token }: { token: string }) {
  const [data, setData] = useState<RequestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/personalizados/solicitud/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json() as { error?: string; request?: RequestStatus };
      if (!response.ok || !payload.request) throw new Error(payload.error ?? "Solicitud no encontrada.");
      setData(payload.request);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible consultar la solicitud."); }
    finally { setLoading(false); }
  }, [token]);
  // La carga es asíncrona; el estado sólo cambia después de recibir la respuesta.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function act(action: "approve" | "changes" | "pay_demo", note?: string) {
    setError("");
    const response = await fetch(`/api/personalizados/solicitud/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, message: note }) });
    const payload = await response.json() as { error?: string; request?: RequestStatus };
    if (!response.ok || !payload.request) { setError(payload.error ?? "No fue posible actualizar la solicitud."); return; }
    setData(payload.request);
    setMessage("");
  }

  if (loading) return <section className="section status-page"><p>Cargando solicitud…</p></section>;
  if (error && !data) return <section className="section status-page"><p className="eyebrow">Personalizados</p><h1>No pudimos abrir esta solicitud.</h1><p>{error}</p><Link className="button primary" href="/personalizados">Volver a personalizados</Link></section>;
  if (!data) return null;
  const copy = statusCopy[data.status] ?? statusCopy.linked;
  const proofs = data.assets.filter((asset) => asset.kind === "proof");
  return <section className="section status-page">
    <header><p className="eyebrow">Seguimiento · {data.reference}</p><h1>{data.itemName}</h1><div className="status-pill">{copy.label}</div><p>{copy.description}</p>{data.linkedOrderReference && <p className="order-link-note">Pedido ligado: <strong>{data.linkedOrderReference}</strong> · Envío conjunto</p>}</header>
    <div className="status-layout"><div className="status-main">
      {proofs.length > 0 ? <div className="proof-card"><div><p className="eyebrow">Muestra v{proofs[0].version}</p><h2>Propuesta de FIERRO</h2></div>{proofs[0].mimeType.startsWith("image/") ? <img src={proofs[0].url} alt={`Muestra para ${data.itemName}`} /> : <a className="button secondary" href={proofs[0].url}>Descargar muestra PDF</a>}</div> : <div className="proof-empty"><span aria-hidden="true">◇</span><h2>La muestra aparecerá aquí.</h2><p>FIERRO te avisará por WhatsApp cuando esté lista.</p></div>}
      {data.status === "proof_ready" && <div className="decision-box"><h2>¿La muestra está lista para producir?</h2><div className="button-row"><button className="button primary" type="button" onClick={() => act("approve")}>Aprobar muestra</button><button className="button secondary" type="button" onClick={() => setMessage(message ? "" : " ")}>Solicitar cambios</button></div>{message && <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); act("changes", message); }}><label>Describe el cambio<textarea required rows={4} value={message.trimStart()} onChange={(event) => setMessage(event.target.value)} /></label><button className="button primary" type="submit">Enviar comentario</button></form>}</div>}
      {data.status === "approved" && <div className="decision-box payment-stage"><p className="eyebrow">Pago de personalización</p><h2>{data.quoteAmount !== null ? `$${data.quoteAmount.toLocaleString("es-MX")} MXN` : "Cotización pendiente"}</h2><p>Este pago corresponde únicamente a la solicitud personalizada que aprobaste.</p>{data.quoteAmount !== null && <button className="button primary" type="button" onClick={() => act("pay_demo")}>Simular pago personalizado</button>}<small>Modo de prueba: este botón no cobra dinero.</small></div>}
      {data.status === "custom_paid" && <div className="decision-box success-box"><strong>✓ Pago de prueba vinculado</strong><p>El pedido permanece unido. FIERRO lo liberará cuando la pieza personalizada esté lista.</p></div>}
      {error && <p className="form-message" role="alert">{error}</p>}
    </div><aside className="status-summary"><h2>Resumen</h2>{Object.entries(data.configuration).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}<div><span>Cantidad</span><strong>{data.quantity}</strong></div><div><span>Personalización</span><strong>{data.quoteAmount === null ? "Por cotizar" : `$${data.quoteAmount.toLocaleString("es-MX")} MXN`}</strong></div>{data.estimatedReady && <div><span>Preparación estimada</span><strong>{data.estimatedReady}</strong></div>}{data.quoteNotes && <p>{data.quoteNotes}</p>}</aside></div>
  </section>;
}
