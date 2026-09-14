"use client";

import { getCustomPricingTiers, hasVolumePricing, MAX_CUSTOM_QUANTITY, type CustomCategory, type CustomPricingTier } from "../../personalizados/pricing";

/**
 * Escala de volumen sin prometer descuentos antes de conocer técnica y archivo.
 * Los tramos sólo clasifican la solicitud para facilitar la cotización manual.
 */
export default function QuantityScale({ category, categoryName, quantity, pricing, onChange }: { category: CustomCategory; categoryName: string; quantity: number; pricing: CustomPricingTier; onChange: (quantity: number) => void }) {
  const tiers = getCustomPricingTiers(category);
  const volume = hasVolumePricing(category);
  const nextTier = tiers.find((tier) => tier.minimum > quantity);

  return (
    <div className="cfg-quantity">
      <div className="cfg-quantity-head">
        <label className="cfg-quantity-input" htmlFor="cfg-cantidad">
          Cantidad solicitada
          <input
            id="cfg-cantidad"
            type="number"
            inputMode="numeric"
            min="1"
            max={MAX_CUSTOM_QUANTITY}
            value={quantity}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </label>
        <p className="cfg-quantity-level">
          <strong>{pricing.priceLevel}</strong>
          <span>{volume ? "FIERRO cotizará este nivel después de revisar tu archivo." : "Cotización individual después de revisar la pieza."}</span>
        </p>
      </div>
      {volume && (
        <div className="cfg-scale" role="group" aria-label={`Niveles de cantidad para ${categoryName}`}>
          {tiers.map((tier) => {
            const active = pricing.minimum === tier.minimum;
            const reached = quantity >= tier.minimum;
            return (
              <button
                key={tier.minimum}
                type="button"
                className={`cfg-scale-step${active ? " is-active" : ""}${reached ? " is-reached" : ""}`}
                aria-pressed={active}
                onClick={() => onChange(tier.minimum)}
              >
                <strong>{tier.shortcutLabel}</strong>
                <small>{tier.priceLevel.split(" · ")[0]}</small>
              </button>
            );
          })}
        </div>
      )}
      <p className="cfg-quantity-note">
        {volume
          ? <>{nextTier
              ? <>Agrega <strong>{nextTier.minimum - quantity}</strong> {nextTier.minimum - quantity === 1 ? "pieza" : "piezas"} más para pasar al nivel {nextTier.priceLevel.split(" · ")[0].toLowerCase()}.</>
              : <>Tu solicitud ya está clasificada como volumen.</>}
            {" "}Puedes pedir cualquier cantidad entre 1 y {MAX_CUSTOM_QUANTITY.toLocaleString("es-MX")} piezas. El precio se confirma después de revisar técnica y archivo.</>
          : <><strong>{categoryName}</strong> se cotiza pieza por pieza. Puedes pedir cualquier cantidad entre 1 y {MAX_CUSTOM_QUANTITY.toLocaleString("es-MX")}.</>}
      </p>
    </div>
  );
}
