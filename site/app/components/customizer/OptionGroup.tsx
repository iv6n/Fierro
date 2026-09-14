"use client";

import Image from "next/image";
import { memo } from "react";
import type { ChoiceField } from "../../personalizados/schema";

/**
 * Un grupo de opciones de una pieza. Usa radios reales para conservar la
 * navegación con flechas y la lectura del grupo completo en lector de pantalla;
 * el input se oculta visualmente y la etiqueta es el control que se ve.
 */
function OptionGroup({ field, groupId, value, invalid, onChange }: { field: ChoiceField; groupId: string; value: string; invalid?: boolean; onChange: (name: string, value: string) => void }) {
  return (
    <fieldset className={`cfg-group cfg-group-${field.kind}${invalid ? " is-invalid" : ""}`} id={`campo-${field.name}`} aria-invalid={invalid || undefined}>
      <legend>{field.label}{field.required && <em>Necesario</em>}</legend>
      <div className="cfg-options">
        {field.choices.map((choice) => {
          const id = `${groupId}-${field.name}-${choice.value}`;
          return (
            <label key={choice.value} className={`cfg-option${choice.ghost ? " is-ghost" : ""}${value === choice.value ? " is-selected" : ""}`} htmlFor={id}>
              <input
                id={id}
                type="radio"
                name={`${groupId}-${field.name}`}
                value={choice.value}
                checked={value === choice.value}
                onChange={() => onChange(field.name, choice.value)}
              />
              {field.kind === "swatch" && (choice.swatch
                ? <span className="cfg-swatch" style={{ backgroundColor: choice.swatch }} aria-hidden="true" />
                : <span className="cfg-swatch is-open" aria-hidden="true">?</span>)}
              {field.kind === "thumb" && (choice.image
                ? <span className="cfg-thumb"><Image src={choice.image} alt="" width={240} height={300} unoptimized /></span>
                : <span className="cfg-thumb is-open" aria-hidden="true">?</span>)}
              <span className="cfg-option-text">
                <b>{choice.value}</b>
                {choice.hint && <small>{choice.hint}</small>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default memo(OptionGroup);
