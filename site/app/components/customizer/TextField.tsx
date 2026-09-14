"use client";

import type { TextInputField } from "../../personalizados/schema";
import { memo } from "react";

/** Campo de texto grabado en la pieza: contador vivo y aviso de que se ve en la vista previa. */
function TextField({ field, value, invalid, onChange }: { field: TextInputField; value: string; invalid: boolean; onChange: (name: string, value: string) => void }) {
  const used = value.length;
  return (
    <div className={`cfg-text${invalid ? " is-invalid" : ""}`} id={`campo-${field.name}`}>
      <label htmlFor={`cfg-${field.name}`}>
        <span className="cfg-text-label">
          {field.label}
          {field.required && <em>Necesario</em>}
          {field.inPreview && <em>Se graba en la pieza</em>}
        </span>
        <input
          id={`cfg-${field.name}`}
          type={field.kind === "tel" ? "tel" : "text"}
          inputMode={field.kind === "tel" ? "tel" : undefined}
          value={value}
          maxLength={field.maxLength}
          required={field.required}
          placeholder={field.placeholder}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      </label>
      <p className="cfg-text-foot">
        <span>{invalid ? "Completa este dato para continuar." : field.hint ?? ""}</span>
        <small>{used}/{field.maxLength}</small>
      </p>
    </div>
  );
}

export default memo(TextField);
