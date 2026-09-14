"use client";

import { getVisibleFields, type CategorySchema } from "../../personalizados/schema";

function focusField(name: string) {
  const target = document.getElementById(`campo-${name}`);
  if (!target) return;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  const control = target.querySelector<HTMLElement>("input:not([type=radio]), input[type=radio]:checked, input");
  control?.focus({ preventScroll: true });
}

/**
 * Resumen vivo de la configuración. Cada dato es un atajo al control que lo
 * definió, para corregir sin buscar dentro del formulario.
 */
export default function ReviewSummary({ schema, configuration, quantity, priceLevel, onEdit }: { schema: CategorySchema; configuration: Record<string, string>; quantity: number; priceLevel: string; onEdit?: (fieldName: string) => void }) {
  return (
    <div className="cfg-summary">
      <p className="sr-only" aria-live="polite">{schema.name}: {Object.values(configuration).filter(Boolean).join(", ")}</p>
      <ul className="cfg-chips">
        {getVisibleFields(schema.id, configuration).filter((field) => field.required || (configuration[field.name] ?? "").trim()).map((field) => {
          const value = configuration[field.name] ?? "";
          const pending = field.required && !value.trim();
          return (
            <li key={field.name}>
              <button type="button" className={`cfg-chip${pending ? " is-pending" : ""}`} onClick={() => { if (onEdit) onEdit(field.name); else focusField(field.name); }}>
                <small>{field.label}</small>
                <b>{pending ? "Por completar" : value}</b>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="cfg-summary-price">
        <span>{quantity.toLocaleString("es-MX")} {quantity === 1 ? "pieza" : "piezas"} · {priceLevel}</span>
        <strong>Precio por cotizar</strong>
      </p>
    </div>
  );
}
