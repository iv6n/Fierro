"use client";

import { useEffect, useId, useMemo, useState } from "react";

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,.svg";

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function isPreviewable(file: File) {
  return /^image\/(png|jpeg|webp)$/i.test(file.type);
}

function extensionOf(file: File) {
  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  return (match ? match[1] : "archivo").toUpperCase();
}

/** Zona de carga con arrastre real, miniatura por archivo y borrado individual. */
export default function FileDropzone({ files, invalid, onChange }: { files: File[]; invalid: boolean; onChange: (files: File[]) => void }) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  // Las miniaturas viven en memoria del navegador; se liberan al cambiar la lista.
  const thumbs = useMemo(() => Object.fromEntries(files.filter(isPreviewable).map((file) => [fileKey(file), URL.createObjectURL(file)])), [files]);
  useEffect(() => () => Object.values(thumbs).forEach((url) => URL.revokeObjectURL(url)), [thumbs]);

  function append(incoming: File[]) {
    const merged = [...files];
    for (const file of incoming) {
      if (merged.length >= MAX_FILES) break;
      if (merged.some((existing) => fileKey(existing) === fileKey(file))) continue;
      merged.push(file);
    }
    onChange(merged);
  }

  const full = files.length >= MAX_FILES;

  return (
    <div className="cfg-upload" id="campo-archivos">
      <div
        className={`cfg-drop${dragging ? " is-dragging" : ""}${invalid ? " is-invalid" : ""}${full ? " is-full" : ""}`}
        onDragOver={(event) => { event.preventDefault(); if (!full) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!full) append(Array.from(event.dataTransfer.files)); }}
      >
        <label htmlFor={inputId}>
          <strong>{full ? "Ya tienes 3 archivos" : dragging ? "Suelta aquí tus archivos" : "Toca para elegir tu archivo"}</strong>
          <span>PNG transparente recomendado · también aceptamos JPG, WebP, PDF o SVG</span>
          <small>Máximo {MAX_FILES} archivos de 15 MB cada uno.</small>
        </label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={full}
          onChange={(event) => { append(Array.from(event.target.files ?? [])); event.target.value = ""; }}
        />
      </div>

      {files.length > 0 && (
        <ul className="cfg-files">
          {files.map((file) => {
            const key = fileKey(file);
            const tooBig = file.size > MAX_FILE_BYTES;
            return (
              <li key={key} className={tooBig ? "is-invalid" : ""}>
                <span className="cfg-file-art">
                  {thumbs[key] ? <img src={thumbs[key]} alt="" /> : <b>{extensionOf(file)}</b>}
                </span>
                <span className="cfg-file-meta">
                  <strong>{file.name}</strong>
                  <small>{tooBig ? `${(file.size / 1024 / 1024).toFixed(1)} MB · pasa del límite de 15 MB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</small>
                </span>
                <button type="button" onClick={() => onChange(files.filter((item) => fileKey(item) !== key))} aria-label={`Quitar ${file.name}`}>✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
