"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getCustomPricing, type CustomCategory } from "../personalizados/pricing";

type AdminRequest = {
  id: string;
  reference: string;
  accessToken: string;
  category: CustomCategory;
  itemName: string;
  configuration: Record<string, string>;
  quantity: number;
  backgroundChoice: string;
  status: string;
  linkedOrderReference: string | null;
  customer: { name: string | null; phone: string | null; email: string | null };
  shipping: Record<string, string> | null;
  quoteAmount: number | null;
  quoteNotes: string | null;
  estimatedReady: string | null;
  customerMessage: string | null;
  statusUrl: string;
  assets: { id: string; kind: "design" | "proof" | "preview"; version: number; filename: string; mimeType: string; url: string }[];
};

const labels: Record<string, string> = { submitted: "Nueva solicitud", linked: "Recibida", in_review: "En revisión", proof_ready: "Muestra lista", changes_requested: "Cambios solicitados", approved: "Aprobada / pago pendiente", custom_paid: "Personalización pagada", ready_to_ship: "Lista para envío", closed: "Cerrada" };

export default function AdminPersonalizations() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [unitPrice, setUnitPrice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/personalizados", { cache: "no-store" });
    const payload = await response.json() as { error?: string; requests?: AdminRequest[] };
    if (!response.ok) { setError(payload.error ?? "No fue posible cargar las solicitudes."); return; }
    setRequests(payload.requests ?? []);
    setSelectedId((current) => current || payload.requests?.[0]?.id || "");
  }, []);
  // La carga es asíncrona; el estado sólo cambia después de recibir la respuesta.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  const selected = requests.find((item) => item.id === selectedId) ?? null;
  const pricing = selected ? getCustomPricing(selected.category, selected.quantity) : null;
  const quoteTotal = selected && unitPrice ? Math.round(Number(unitPrice) * selected.quantity) : null;
  useEffect(() => {
    // Sincroniza el editor cuando el administrador cambia de solicitud.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selected?.quoteAmount) { setUnitPrice(""); return; }
    const pricePerPiece = selected.quoteAmount / selected.quantity;
    setUnitPrice(pricePerPiece.toFixed(2).replace(/\.00$/, ""));
  }, [selected?.quantity, selected?.quoteAmount]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setError("");
    const response = await fetch(`/api/admin/personalizados/${selected.id}`, { method: "POST", body: new FormData(event.currentTarget) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) setError(payload.error ?? "No fue posible actualizar la solicitud.");
    else await load();
    setSaving(false);
  }

  function whatsappUrl(item: AdminRequest) {
    const phone = (item.customer.phone ?? "").replace(/\D/g, "");
    const absolute = `${window.location.origin}${item.statusUrl}`;
    const relation = item.linkedOrderReference ? `, ligada al pedido ${item.linkedOrderReference},` : "";
    const text = `Hola ${item.customer.name ?? ""}. La muestra de tu solicitud ${item.reference}${relation} está lista. Puedes revisarla y aprobarla aquí: ${absolute}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  return <section className="section admin-custom"><header><p className="eyebrow">Panel FIERRO</p><h1>Personalizaciones</h1><p>Revisa archivos, carga la muestra y prepara el mensaje para el cliente.</p></header>
    {error && <p className="form-message" role="alert">{error}</p>}
    <div className="admin-custom-layout"><aside className="admin-request-list">{requests.length ? requests.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span>{item.reference}</span><strong>{item.itemName}</strong><small>{labels[item.status] ?? item.status} · {item.customer.name}</small></button>) : <p>No hay solicitudes recibidas.</p>}</aside>
      {selected && <div className="admin-request-detail"><div className="admin-detail-heading"><div><p className="eyebrow">{selected.reference}</p><h2>{selected.itemName}</h2><p>{[selected.linkedOrderReference, selected.customer.name, selected.customer.phone].filter(Boolean).join(" · ")}</p></div><span className="status-pill">{labels[selected.status] ?? selected.status}</span></div>
        <div className="admin-info-grid"><div><h3>Configuración</h3>{Object.entries(selected.configuration).map(([key, value]) => <p key={key}><span>{key}</span><strong>{value}</strong></p>)}<p><span>Cantidad</span><strong>{selected.quantity}</strong></p><p><span>Fondo</span><strong>{selected.backgroundChoice}</strong></p></div><div><h3>{selected.linkedOrderReference ? "Entrega conjunta" : "Contacto directo"}</h3>{selected.linkedOrderReference && <p><span>Pedido</span><strong>{selected.linkedOrderReference}</strong></p>}<p><span>Nombre</span><strong>{selected.customer.name}</strong></p><p><span>WhatsApp</span><strong>{selected.customer.phone}</strong></p>{selected.shipping && Object.entries(selected.shipping).filter(([, value]) => value).map(([key, value]) => <p key={key}><span>{key}</span><strong>{value}</strong></p>)}</div></div>
        {selected.customerMessage && <div className="background-warning"><strong>Cambios solicitados por el cliente</strong><p>{selected.customerMessage}</p></div>}
        <div className="admin-assets"><h3>Recursos separados</h3>{selected.assets.map((asset) => <a href={asset.url} target="_blank" rel="noreferrer" key={asset.id}>{asset.kind === "proof" ? `Muestra real v${asset.version}` : asset.kind === "preview" ? "Simulación con logo de ejemplo" : "Archivo original del cliente"} · {asset.filename}</a>)}</div>
        <form className="admin-quote-form" onSubmit={save}><h3>Preparar muestra y cotización</h3><div className="two-column"><label>Precio unitario confirmado (MXN)<input type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></label><label>Total cotizado (MXN)<input type="number" value={quoteTotal ?? ""} readOnly /><input name="quote" type="hidden" value={quoteTotal ?? ""} /></label><label>Preparación estimada<input name="estimatedReady" placeholder="Ej. 7 a 10 días hábiles" defaultValue={selected.estimatedReady ?? ""} /></label></div>{pricing && <div className="admin-price-calculation"><strong>{selected.quantity} piezas × ${Number(unitPrice || 0).toLocaleString("es-MX")} MXN</strong><span>Nivel de cantidad: {pricing.priceLevel}</span><b>Total: ${(quoteTotal ?? 0).toLocaleString("es-MX")} MXN</b></div>}<label>Notas de la cotización<textarea name="quoteNotes" rows={3} defaultValue={selected.quoteNotes ?? ""} /></label><label>Muestra nueva con el logo real<input name="proof" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" /></label><label>Estado manual<select name="status" defaultValue={selected.status === "changes_requested" ? "in_review" : ["in_review", "proof_ready", "ready_to_ship", "closed"].includes(selected.status) ? selected.status : "in_review"}><option value="in_review">En revisión</option><option value="proof_ready">Muestra lista</option><option value="ready_to_ship">Lista para envío</option><option value="closed">Cerrar solicitud</option></select></label><button className="button primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar actualización"}</button><small>La simulación usa un logo ficticio. Para enviar una muestra, carga aquí la composición preparada con el archivo real del cliente.</small></form>
        {selected.customer.phone && ["proof_ready", "approved"].includes(selected.status) && <a className="button secondary block" href={whatsappUrl(selected)} target="_blank" rel="noreferrer">Preparar mensaje de WhatsApp</a>}
      </div>}
    </div>
  </section>;
}
