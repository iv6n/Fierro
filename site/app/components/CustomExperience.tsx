"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCustomPricing, normalizeCustomQuantity, type CustomCategory } from "../personalizados/pricing";
import { renderPreviewToBlob, resolvePreviewBase } from "../personalizados/preview";
import { buildDefaults, getCategorySchema, getVisibleFields, isChoiceField, layoutNeedsLogo, missingRequiredFields, requiresDesignFile, validateConfiguration, type CustomField } from "../personalizados/schema";
import FileDropzone, { MAX_FILE_BYTES } from "./customizer/FileDropzone";
import OptionGroup from "./customizer/OptionGroup";
import PreviewStage from "./customizer/PreviewStage";
import QuantityScale from "./customizer/QuantityScale";
import TextField from "./customizer/TextField";
import ReviewSummary from "./customizer/ReviewSummary";
import { trackPersonalizationEvent } from "../personalizados/telemetry";

const TOTAL_STEPS = 4;
const DEFAULT_BACKGROUND_CHOICE = "Mi archivo ya est\u00e1 listo";
const BACKGROUND_CHOICES = [
  DEFAULT_BACKGROUND_CHOICE,
  "Conservar el fondo",
  "Necesito ayuda para retirar el fondo",
];

const TAG_LAYOUTS = [
  "Sólo número",
  "Número + nombre del rancho",
  "Logo + número",
  "Logo + número + código de barras",
  "Sólo logo",
  "Número + código de barras",
];

const layoutHints: Record<string, { art: string; title: string; description: string }> = {
  "Sólo número": { art: "024", title: "Sólo número", description: "Lectura rápida a distancia" },
  "Número + nombre del rancho": { art: "024\nRANCHO", title: "Número + rancho", description: "La opción más completa sin logo" },
  "Sólo logo": { art: "RM", title: "Sólo logo", description: "Identidad visual protagonista" },
  "Logo + número": { art: "RM · 024", title: "Logo + número", description: "Marca y control visual" },
  "Número + código de barras": { art: "024\n▥▥▥", title: "Número + código", description: "Identificación y lectura digital" },
  "Logo + número + código de barras": { art: "RM · 024\n▥▥▥", title: "Logo + número + código", description: "Todos los datos en una pieza" },
};

async function appearsToHaveWhiteBackground(file: File): Promise<boolean> {
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) return false;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0, 24, 24);
    return [[1, 1], [22, 1], [1, 22], [22, 22]].every(([x, y]) => {
      const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
      return alpha > 245 && red > 238 && green > 238 && blue > 238;
    });
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function TemplateCard({ layout, selected, onSelect }: { layout: string; selected: boolean; onSelect: (layout: string) => void }) {
  const hint = layoutHints[layout];
  return <button type="button" className={`tag-template${selected ? " is-selected" : ""}`} onClick={() => onSelect(layout)} aria-pressed={selected}>
    <span className="tag-template-art" aria-hidden="true">{hint.art.split("\n").map((line) => <b key={line}>{line}</b>)}</span>
    <span><strong>{hint.title}</strong><small>{hint.description}</small></span>
    <i aria-hidden="true">{selected ? "✓" : ""}</i>
  </button>;
}

function AppHeader({ step }: { step: number }) {
  return <header className="tag-app-header">
    <Link href="/" aria-label="Salir al inicio de FIERRO"><Image src="/brand/fierro-lockup-black.png" alt="FIERRO" width={148} height={52} priority unoptimized /></Link>
    <div><span>Paso {step} de {TOTAL_STEPS}</span><div className="tag-progress" aria-label={`Paso ${step} de ${TOTAL_STEPS}`}>{Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((item) => <i key={item} className={item <= step ? "is-filled" : ""} />)}</div></div>
    <Link href="/personalizados" className="tag-app-exit">Objetos</Link>
  </header>;
}

export default function CustomExperience({ category }: { category: CustomCategory }) {
  const isCattleTag = category === "cattle-tag";
  const [configuration, setConfiguration] = useState<Record<string, string>>(() => buildDefaults(category));
  const [files, setFiles] = useState<File[]>([]);
  const [whiteBackground, setWhiteBackground] = useState(false);
  const [backgroundChoice, setBackgroundChoice] = useState("");
  const [quantity, setQuantity] = useState(category === "pet-tag" ? 1 : 10);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [backgroundChoiceSelected, setBackgroundChoiceSelected] = useState(false);
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false);
  const [textConfirmed, setTextConfirmed] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [submissionKey, setSubmissionKey] = useState("");
  const [confirmation, setConfirmation] = useState<{ reference: string; statusUrl: string } | null>(null);
  const stepHeadingRef = useRef<HTMLElement>(null);

  const schema = getCategorySchema(category);
  const pricing = getCustomPricing(category, quantity);

  useEffect(() => {
    trackPersonalizationEvent(category, "step_viewed", undefined, activeStep);
    window.requestAnimationFrame(() => stepHeadingRef.current?.focus({ preventScroll: true }));
  }, [activeStep, category]);
  const previewConfiguration = useMemo(() => ({
    model: configuration.model,
    color: configuration.color,
    technique: configuration.technique,
    designMode: configuration.designMode,
    demoMark: configuration.demoMark,
    ranchText: configuration.ranchText,
    format: configuration.format,
    layout: configuration.layout,
    numberMode: configuration.numberMode,
    seriesStart: configuration.seriesStart,
    seriesEnd: configuration.seriesEnd,
    tagNumber: configuration.tagNumber,
    ranchName: configuration.ranchName,
    barcodeValue: configuration.barcodeValue,
    shape: configuration.shape,
    finish: configuration.finish,
    size: configuration.size,
    petName: configuration.petName,
    phone: configuration.phone,
  }), [
    configuration.model,
    configuration.color,
    configuration.technique,
    configuration.designMode,
    configuration.demoMark,
    configuration.ranchText,
    configuration.format,
    configuration.layout,
    configuration.numberMode,
    configuration.seriesStart,
    configuration.seriesEnd,
    configuration.tagNumber,
    configuration.ranchName,
    configuration.barcodeValue,
    configuration.shape,
    configuration.finish,
    configuration.size,
    configuration.petName,
    configuration.phone,
  ]);
  const preview = useMemo(() => resolvePreviewBase(category, previewConfiguration), [category, previewConfiguration]);
  const fileRequired = requiresDesignFile(category, configuration);
  const oversized = files.some((file) => file.size > MAX_FILE_BYTES);
  const visibilityConfiguration = useMemo(() => ({
    designMode: configuration.designMode,
    layout: configuration.layout,
    numberMode: configuration.numberMode,
  }), [configuration.designMode, configuration.layout, configuration.numberMode]);
  const visibleFields = useMemo(
    () => getVisibleFields(category, visibilityConfiguration),
    [category, visibilityConfiguration],
  );
  const dataFields = useMemo(() => visibleFields.filter((field) => field.section === "design" && field.name !== "layout"), [visibleFields]);
  const physicalFields = useMemo(() => visibleFields.filter((field) => field.section === "physical"), [visibleFields]);
  const physicalFieldNames = useMemo(() => new Set(schema.fields.filter((field) => field.section === "physical").map((field) => field.name)), [schema.fields]);
  const physicalSummary = physicalFields.map((field) => configuration[field.name]).filter(Boolean).join(" · ");
  const designSummary = visibleFields.filter((field) => field.section === "design" && field.name !== "demoMark").map((field) => configuration[field.name]).filter(Boolean).join(" · ");

  const clearInvalid = useCallback((...names: string[]) => {
    setInvalid((current) => current.filter((item) => !names.includes(item)));
  }, []);

  const invalidateSubmissionKey = useCallback(() => {
    if (status !== "saving") setSubmissionKey("");
  }, [status]);

  const updateConfiguration = useCallback((name: string, value: string) => {
    const normalized = name === "barcodeValue" ? value.toUpperCase() : value;
    setConfiguration((current) => ({ ...current, [name]: normalized }));
    setPreviewFailed(false);
    setStatus("idle");
    setPhysicalConfirmed(false);
    setTextConfirmed(false);
    invalidateSubmissionKey();
    clearInvalid(name);
  }, [clearInvalid, invalidateSubmissionKey]);

  function selectLayout(layout: string) {
    if (!layoutNeedsLogo(layout) && files.length) {
      setFiles([]);
      setWhiteBackground(false);
      setBackgroundChoiceSelected(false);
      setBackgroundChoice("");
    }
    updateConfiguration("layout", layout);
  }

  async function updateFiles(next: File[]) {
    setFiles(next);
    setPhysicalConfirmed(false);
    setTextConfirmed(false);
    setBackgroundChoiceSelected(false);
    invalidateSubmissionKey();
    clearInvalid("archivos");
    setWhiteBackground((await Promise.all(next.map(appearsToHaveWhiteBackground))).some(Boolean));
  }

  function renderField(field: CustomField) {
    return isChoiceField(field)
      ? <OptionGroup key={field.name} field={field} groupId={category} value={configuration[field.name] ?? ""} invalid={invalid.includes(field.name)} onChange={updateConfiguration} />
      : <TextField key={field.name} field={field} value={configuration[field.name] ?? ""} invalid={invalid.includes(field.name)} onChange={updateConfiguration} />;
  }

  function editField(name: string) {
    const step = name === "archivos" || !physicalFieldNames.has(name) ? 2 : 1;
    setActiveStep(step);
    if (step === 2) setSettingsOpen(false);
    window.setTimeout(() => document.getElementById(`campo-${name}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  function validatePhysicalStep() {
    const missing = missingRequiredFields(category, configuration, "physical");
    if (!missing.length) return true;
    setInvalid(missing.map((field) => field.name));
    trackPersonalizationEvent(category, "validation_failed", missing[0].name, 1);
    setMessage(`Selecciona ${missing[0].label.toLowerCase()} para continuar.`);
    document.getElementById(`campo-${missing[0].name}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  function validateDesignStep() {
    const missing = missingRequiredFields(category, configuration, "design").filter((field) => field.name !== "demoMark");
    if (missing.length) {
      setInvalid(missing.map((field) => field.name));
      trackPersonalizationEvent(category, "validation_failed", missing[0].name, 2);
      setMessage(`Completa ${missing[0].label.toLowerCase()} para continuar.`);
      document.getElementById(`campo-${missing[0].name}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    const error = validateConfiguration(category, configuration, quantity);
    if (error) { trackPersonalizationEvent(category, "validation_failed", "configuration", 2); setMessage(error); return false; }
    if (fileRequired && !files.length) {
      setInvalid(["archivos"]);
      trackPersonalizationEvent(category, "validation_failed", "archivos", 2);
      setMessage("Sube el logo real que FIERRO debe revisar.");
      document.getElementById("campo-archivos")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (whiteBackground && !backgroundChoiceSelected) {
      setInvalid(["backgroundChoice"]);
      trackPersonalizationEvent(category, "validation_failed", "backgroundChoice", 2);
      setMessage("Elige cómo debemos tratar el fondo claro de tu archivo.");
      document.getElementById("campo-backgroundChoice")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (oversized) {
      setInvalid(["archivos"]);
      trackPersonalizationEvent(category, "validation_failed", "archivos", 2);
      setMessage("Cada archivo debe pesar 15 MB o menos.");
      return false;
    }
    return true;
  }

  function validateReviewStep() {
    const missing: string[] = [];
    if (!physicalConfirmed) missing.push("physicalConfirmation");
    if (!textConfirmed) missing.push("textConfirmation");
    if (!missing.length) return true;
    setInvalid(missing);
    trackPersonalizationEvent(category, "validation_failed", missing[0], 3);
    setMessage("Confirma que revisaste las características y los datos de tu brief.");
    document.getElementById(`campo-${missing[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  function goNext() {
    setMessage("");
    if (activeStep === 1 && !validatePhysicalStep()) return;
    if (activeStep === 2 && !validateDesignStep()) return;
    if (activeStep === 3 && !validateReviewStep()) return;
    if (activeStep === 3) trackPersonalizationEvent(category, "review_confirmed", undefined, 3);
    setInvalid([]);
    setActiveStep((current) => Math.min(TOTAL_STEPS, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setMessage("");
    setInvalid([]);
    setActiveStep((current) => Math.max(1, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setConfiguration(buildDefaults(category));
    setFiles([]);
    setWhiteBackground(false);
    setBackgroundChoiceSelected(false);
    setBackgroundChoice("");
    setQuantity(category === "pet-tag" ? 1 : 10);
    setCustomerName("");
    setCustomerPhone("");
    setConsent(false);
    setPhysicalConfirmed(false);
    setTextConfirmed(false);
    setActiveStep(1);
    setStatus("idle");
    setMessage("");
    setInvalid([]);
    setSubmissionKey("");
    setConfirmation(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!validatePhysicalStep()) { setActiveStep(1); return; }
    if (!validateDesignStep()) { setActiveStep(2); return; }
    if (!validateReviewStep()) { setActiveStep(3); return; }
    const phoneDigits = customerPhone.replace(/\D/g, "");
    const contactInvalid: string[] = [];
    if (customerName.trim().length < 2) contactInvalid.push("customerName");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) contactInvalid.push("customerPhone");
    if (!consent) contactInvalid.push("consent");
    if (contactInvalid.length) {
      setInvalid(contactInvalid);
      trackPersonalizationEvent(category, "validation_failed", contactInvalid[0], 4);
      if (customerName.trim().length < 2) setMessage("Escribe un nombre de al menos 2 caracteres.");
      else if (phoneDigits.length < 10 || phoneDigits.length > 15) setMessage("Escribe un WhatsApp válido de 10 a 15 dígitos.");
      else setMessage("Confirma que tienes permiso para utilizar el diseño.");
      return;
    }
    const requestKey = submissionKey || crypto.randomUUID();
    if (!submissionKey) setSubmissionKey(requestKey);
    trackPersonalizationEvent(category, "submit_started", undefined, 4);
    setStatus("saving");
    try {
      const body = new FormData();
      body.set("category", category);
      body.set("itemName", schema.name);
      body.set("quantity", String(quantity));
      body.set("configuration", JSON.stringify(configuration));
      body.set("backgroundChoice", fileRequired ? backgroundChoice || "No se detectó fondo claro" : "No aplica");
      body.set("backgroundDetected", String(whiteBackground));
      body.set("backgroundChoiceSelected", String(backgroundChoiceSelected));
      body.set("customerName", customerName.trim());
      body.set("customerPhone", customerPhone.trim());
      body.set("directSubmit", "true");
      if (fileRequired) files.forEach((file) => body.append("files", file));
      const previewBlob = await renderPreviewToBlob(preview);
      if (previewBlob) body.set("preview", previewBlob, "simulacion-logo-ejemplo.webp");
      const response = await fetch("/api/personalizados", { method: "POST", headers: { "Idempotency-Key": requestKey }, body });
      const payload = await response.json() as { error?: string; request?: { reference: string; statusUrl: string } };
      if (!response.ok || !payload.request) throw new Error(payload.error ?? "No fue posible enviar tu solicitud.");
      setConfirmation(payload.request);
      setStatus("saved");
      trackPersonalizationEvent(category, "submit_succeeded", undefined, 4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setStatus("idle");
      setMessage(error instanceof Error ? error.message : "No fue posible enviar tu solicitud.");
    }
  }

  if (confirmation) return <div className="tag-app">
    <AppHeader step={4} />
    <main className="tag-success" aria-live="polite">
      <span className="tag-success-check" aria-hidden="true">✓</span>
      <p className="eyebrow">Solicitud enviada</p>
      <h1>Ya recibimos tu solicitud.</h1>
      <p>FIERRO revisará los datos y, si agregaste un logo, preparará una muestra real antes de cotizar.</p>
      <div className="tag-folio"><small>Tu folio</small><strong>{confirmation.reference}</strong></div>
      <Link className="button primary block" href={confirmation.statusUrl}>Ver solicitud</Link>
      <button className="button secondary block" type="button" onClick={reset}>Crear otro igual</button>
      <Link className="text-link" href="/personalizados">Elegir otro objeto</Link>
      <Link className="text-link" href="/">Volver a FIERRO</Link>
    </main>
  </div>;

  return <div className="tag-app">
    <AppHeader step={activeStep} />
    <main className="tag-app-main">
      <section className="tag-app-preview" aria-label={`Vista previa de ${schema.name.toLowerCase()}`}>
        <div><span>Vista previa</span><small>{preview.mark ? "Logo de ejemplo" : "Ejemplo"}</small></div>
        <PreviewStage preview={preview} title={schema.name} failed={previewFailed} onFailed={setPreviewFailed} />
      </section>

      <form className="tag-app-form" onSubmit={submit}>
        {message && <p className="cfg-message" role="alert">{message}</p>}

        {activeStep === 1 && isCattleTag && <section className="tag-screen" ref={stepHeadingRef} tabIndex={-1}>
          <header><p className="eyebrow">Objeto</p><h1>Elige sus características.</h1><p>Define la base física del arete antes de elegir su distribución.</p></header>
          <div className="tag-settings-fields is-open">{physicalFields.map(renderField)}</div>
          {schema.note && <p className="cfg-legal">{schema.note}</p>}
        </section>}

        {activeStep === 2 && isCattleTag && <section className="tag-screen" ref={stepHeadingRef} tabIndex={-1}>
          <header><p className="eyebrow">Diseño</p><h1>¿Qué quieres mostrar?</h1><p>Elige una distribución. Podrás cambiarla después.</p></header>
          <div className="tag-template-grid" id="campo-layout">{TAG_LAYOUTS.map((layout) => <TemplateCard key={layout} layout={layout} selected={configuration.layout === layout} onSelect={selectLayout} />)}</div>
        </section>}

        {activeStep === 1 && !isCattleTag && <section className="tag-screen" ref={stepHeadingRef} tabIndex={-1}>
          <header><p className="eyebrow">Objeto</p><h1>Elige sus características.</h1><p>Configura la base de tu {schema.name.toLowerCase()} antes de agregar los datos.</p></header>
          <div className="tag-settings-fields is-open">{physicalFields.map(renderField)}</div>
          {schema.note && <p className="cfg-legal">{schema.note}</p>}
        </section>}

        {activeStep === 2 && <section className="tag-screen" ref={stepHeadingRef} tabIndex={-1}>
          <header><p className="eyebrow">Personalización</p><h1>Agrega la información.</h1><p>Sólo pedimos lo que necesita el objeto elegido.</p></header>
          {isCattleTag && <div className="tag-product-settings">
            <button type="button" onClick={() => setSettingsOpen((current) => !current)} aria-expanded={settingsOpen}><span><small>Tu arete</small><strong>{physicalSummary}</strong></span><b>{settingsOpen ? "Cerrar" : "Cambiar arete"}</b></button>
            {settingsOpen && <div className="tag-settings-fields">{physicalFields.map(renderField)}</div>}
          </div>}
          <div className="tag-data-fields">{dataFields.map(renderField)}</div>
          {fileRequired && <div className="tag-logo-upload">
            <div><p className="eyebrow">Logo real</p><h2>Sube el archivo para revisión</h2><p>No se aplica en esta simulación. FIERRO lo guarda aparte para preparar tu muestra.</p></div>
            <FileDropzone files={files} invalid={invalid.includes("archivos")} onChange={updateFiles} />
            {whiteBackground && <div className="cfg-warning"><strong>Detectamos un fondo claro.</strong><p>Puedes continuar y decirnos cómo tratarlo.</p></div>}
            <label className={`cfg-select${invalid.includes("backgroundChoice") ? " is-invalid" : ""}`} id="campo-backgroundChoice">Tratamiento del fondo<select value={backgroundChoice} onChange={(event) => { setBackgroundChoice(event.target.value); setBackgroundChoiceSelected(true); setPhysicalConfirmed(false); setTextConfirmed(false); clearInvalid("backgroundChoice"); invalidateSubmissionKey(); }}><option value="">Selecciona cómo tratarlo</option>{BACKGROUND_CHOICES.map((choice) => <option key={choice}>{choice}</option>)}</select></label>
          </div>}
          {configuration.barcodeValue && <p className="cfg-reference-note">El Code 128 es una referencia. Su lectura física se confirmará en la muestra de producción.</p>}
          {schema.note && <p className="cfg-legal">{schema.note}</p>}
        </section>}

        {activeStep === 3 && <section className="tag-screen" ref={stepHeadingRef} tabIndex={-1}>
          <header><p className="eyebrow">Revisa tu brief</p><h1>Confirma los datos antes de enviarlos.</h1><p>Este resumen ayuda a FIERRO a preparar una muestra y cotizar sin pedirte los mismos datos otra vez.</p></header>
          <ReviewSummary schema={schema} configuration={configuration} quantity={quantity} priceLevel={pricing.priceLevel} onEdit={editField} />
          <div className="tag-review-files" id="campo-archivos">
            <div><small>Archivos para revisión</small><strong>{fileRequired ? `${files.length} archivo(s) de logo real` : "No requiere archivo"}</strong></div>
            {fileRequired && <div><small>Tratamiento del fondo</small><strong>{backgroundChoice || (whiteBackground ? "Por elegir" : "No se detectó fondo claro")}</strong></div>}
            {files.length > 0 && <ul>{files.map((file) => <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>)}</ul>}
            {fileRequired && <button type="button" className="text-link" onClick={() => editField("archivos")}>Editar archivos</button>}
          </div>
          <div className="tag-review-confirmations">
            <label className={`cfg-consent${invalid.includes("physicalConfirmation") ? " is-invalid" : ""}`} id="campo-physicalConfirmation">
              <input type="checkbox" checked={physicalConfirmed} onChange={(event) => { setPhysicalConfirmed(event.target.checked); clearInvalid("physicalConfirmation"); invalidateSubmissionKey(); }} />
              Confirmo que revisé las características físicas y la distribución elegida.
            </label>
            <label className={`cfg-consent${invalid.includes("textConfirmation") ? " is-invalid" : ""}`} id="campo-textConfirmation">
              <input type="checkbox" checked={textConfirmed} onChange={(event) => { setTextConfirmed(event.target.checked); clearInvalid("textConfirmation"); invalidateSubmissionKey(); }} />
              Confirmo que nombres, números y códigos están escritos como deben aparecer.
            </label>
          </div>
          <p className="cfg-legal">La vista previa usa un logo de ejemplo. El archivo real viaja por separado para que FIERRO lo revise antes de preparar la muestra.</p>
        </section>}

        {activeStep === 4 && <section className="tag-screen" ref={stepHeadingRef} tabIndex={-1}>
          <header><p className="eyebrow">Pedido</p><h1>¿Cuántos necesitas?</h1><p>Envíanos la solicitud. Revisaremos viabilidad y precio antes de producir.</p></header>
          <QuantityScale category={category} categoryName={schema.name} quantity={quantity} pricing={pricing} onChange={(next) => { setQuantity(normalizeCustomQuantity(next)); setPhysicalConfirmed(false); setTextConfirmed(false); invalidateSubmissionKey(); }} />
          <div className="tag-order-summary"><div><small>Objeto</small><strong>{schema.name}</strong></div><div><small>Características</small><strong>{physicalSummary}</strong></div><div><small>Personalización</small><strong>{designSummary}</strong></div><div><small>Cantidad</small><strong>{quantity.toLocaleString("es-MX")} piezas</strong></div></div>
          <div className="tag-contact-fields">
            <label className={invalid.includes("customerName") ? "is-invalid" : ""}>Tu nombre<input type="text" autoComplete="name" value={customerName} maxLength={120} placeholder="Ej. José Martínez" onChange={(event) => { setCustomerName(event.target.value); clearInvalid("customerName"); invalidateSubmissionKey(); }} /></label>
            <label className={invalid.includes("customerPhone") ? "is-invalid" : ""}>WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" value={customerPhone} maxLength={24} placeholder="Ej. 662 123 4567" onChange={(event) => { setCustomerPhone(event.target.value); clearInvalid("customerPhone"); invalidateSubmissionKey(); }} /><small>Te avisaremos aquí cuando la muestra esté lista.</small></label>
          </div>
          <label className={`cfg-consent${invalid.includes("consent") ? " is-invalid" : ""}`}><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); clearInvalid("consent"); invalidateSubmissionKey(); }} />Confirmo que tengo permiso para usar el diseño y autorizo a FIERRO a revisarlo para preparar una muestra.</label>
          <p className="tag-privacy">Tus datos y archivos se usan únicamente para revisar, cotizar y dar seguimiento a esta solicitud. <Link href="/privacidad">Aviso de privacidad</Link>.</p>
        </section>}

        <div className="tag-app-actions">
          {activeStep > 1 && <button className="button secondary" type="button" onClick={goBack}>Atrás</button>}
          {activeStep < TOTAL_STEPS
            ? <button className="button primary" type="button" onClick={goNext}>{activeStep === 1 ? (isCattleTag ? "Continuar con las características" : "Continuar con el diseño") : activeStep === 2 ? "Revisar brief" : "Continuar al pedido"}</button>
            : <button className="button primary" type="submit" disabled={status === "saving"}>{status === "saving" ? "Enviando…" : "Enviar solicitud"}</button>}
        </div>
      </form>
    </main>
  </div>;
}
