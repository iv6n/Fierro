"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getBarcodeRenderer, type PreviewBarcode, type ResolvedPreview } from "../../personalizados/preview";

function BarcodePreview({ barcode }: { barcode: PreviewBarcode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    async function draw() {
      if (!ref.current) return;
      const bwipjs = await getBarcodeRenderer();
      if (!active || !ref.current) return;
      try {
        bwipjs.toCanvas(ref.current, { bcid: "code128", text: barcode.value, scale: 2, height: 7, includetext: true, textxalign: "center" });
      } catch { /* La validación del campo muestra el error al usuario. */ }
    }
    draw();
    return () => { active = false; };
  }, [barcode.value]);
  return <canvas className="cfg-stage-barcode" ref={ref} style={{ left: `${barcode.x * 100}%`, top: `${barcode.y * 100}%`, width: `${barcode.width * 100}%`, height: `${barcode.height * 100}%` }} aria-label={`Código de barras de ejemplo ${barcode.value}`} />;
}

/**
 * Capas de la vista previa: fotografía base, tinte aplicado con máscara y los
 * textos que van grabados. Es la misma composición que se guarda en el WebP
 * enviado al servidor, así que lo que ve el cliente es lo que recibe FIERRO.
 */
function PreviewArt({ preview, failed, onFailed }: { preview: ResolvedPreview; failed: boolean; onFailed: (value: boolean) => void }) {
  const src = failed ? preview.fallbackSrc : preview.src;
  const tint = failed ? null : preview.tint;
  return (
    <div className="cfg-stage-layers" style={{ transform: `scale(${preview.scale})` }}>
      <Image src={src} alt={preview.alt} width={preview.width} height={preview.height} onError={() => onFailed(true)} unoptimized />
      {tint && <span className="cfg-stage-tint" style={{ backgroundColor: tint, maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }} />}
      {preview.mark?.treatment === "patch" && <span className="cfg-stage-patch" style={{ left: `${preview.printArea.x * 100}%`, top: `${preview.printArea.y * 100}%`, width: `${preview.printArea.width * 100}%`, height: `${preview.printArea.height * 100}%` }} />}
      {preview.mark && <span className={`cfg-stage-mark is-${preview.mark.treatment}`} style={{ left: `${preview.mark.x * 100}%`, top: `${preview.mark.y * 100}%`, width: `${preview.mark.width * 100}%`, height: `${preview.mark.height * 100}%`, backgroundColor: preview.mark.color, maskImage: `url(${preview.mark.src})`, WebkitMaskImage: `url(${preview.mark.src})` }} aria-hidden="true" />}
      {preview.lines.map((line) => <span className="cfg-stage-line" key={`${line.text}-${line.y}`} style={{ left: `${line.x * 100}%`, top: `${line.y * 100}%`, color: line.color, fontSize: `${line.fontSize * 100}cqw` }}>{line.text}</span>)}
      {preview.barcode && <BarcodePreview barcode={preview.barcode} />}
      {preview.mark && <span className="cfg-example-badge">Logo de ejemplo</span>}
    </div>
  );
}

export default function PreviewStage({ preview, title, failed, onFailed, children }: { preview: ResolvedPreview; title: string; failed: boolean; onFailed: (value: boolean) => void; children?: React.ReactNode }) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setZoomed(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <figure className="cfg-stage">
      <div className="cfg-stage-frame">
        <PreviewArt preview={preview} failed={failed} onFailed={onFailed} />
        <button type="button" className="cfg-zoom" onClick={() => setZoomed(true)}>Ampliar</button>
        <span className="cfg-stage-tag">Vista previa</span>
      </div>
      <figcaption>
        {children}
        <small>{preview.mark ? "Simulación de características con un logo ficticio. Tu archivo real no se aplica automáticamente; FIERRO preparará la muestra final." : "Simulación de características. FIERRO confirmará el acomodo final antes de producir."}</small>
      </figcaption>

      {zoomed && (
        <div className="cfg-lightbox" role="dialog" aria-modal="true" aria-label={`Vista previa de ${title}`} onClick={() => setZoomed(false)}>
          <div className="cfg-lightbox-art" onClick={(event) => event.stopPropagation()}>
            <PreviewArt preview={preview} failed={failed} onFailed={onFailed} />
          </div>
          <button type="button" className="cfg-lightbox-close" onClick={() => setZoomed(false)} autoFocus>Cerrar</button>
        </div>
      )}
    </figure>
  );
}

/** Miniatura para la barra fija de móvil. */
export function PreviewThumb({ preview, failed, onFailed }: { preview: ResolvedPreview; failed: boolean; onFailed: (value: boolean) => void }) {
  return (
    <span className="cfg-thumbnail">
      <Image src={failed ? preview.fallbackSrc : preview.src} alt="" width={preview.width} height={preview.height} onError={() => onFailed(true)} unoptimized />
    </span>
  );
}
