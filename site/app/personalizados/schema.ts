import type { CustomCategory } from "./pricing";

export type FieldSection = "physical" | "design";

export type VisibleWhen = {
  field: string;
  values: string[];
};

export type OptionChoice = {
  value: string;
  swatch?: string;
  image?: string;
  hint?: string;
  ghost?: boolean;
};

export type ChoiceField = {
  kind: "swatch" | "thumb" | "pill";
  section: FieldSection;
  name: string;
  label: string;
  choices: OptionChoice[];
  defaultValue?: string;
  required?: boolean;
  visibleWhen?: VisibleWhen | VisibleWhen[];
};

export type TextInputField = {
  kind: "text" | "tel";
  section: FieldSection;
  name: string;
  label: string;
  maxLength: number;
  required: boolean;
  placeholder?: string;
  hint?: string;
  inPreview?: boolean;
  visibleWhen?: VisibleWhen | VisibleWhen[];
};

export type CustomField = ChoiceField | TextInputField;

export type CategorySchema = {
  id: CustomCategory;
  name: string;
  shortName: string;
  description: string;
  image: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  filePolicy: "required" | "conditional" | "none";
  fields: CustomField[];
  note?: string;
};

export const demoMarks = [
  { value: "Rancho Mezquite", image: "/media/configurador/demo/rancho-mezquite.png", hint: "Monograma ganadero" },
  { value: "La Herradura", image: "/media/configurador/demo/la-herradura.png", hint: "Sello tradicional" },
  { value: "Ganadería del Desierto", image: "/media/configurador/demo/ganaderia-desierto.png", hint: "Ganado y paisaje" },
] satisfies OptionChoice[];

const cattleLayouts = [
  "Sólo número",
  "Número + nombre del rancho",
  "Sólo logo",
  "Logo + número",
  "Número + código de barras",
  "Logo + número + código de barras",
] as const;

export function isChoiceField(field: CustomField): field is ChoiceField {
  return field.kind === "swatch" || field.kind === "thumb" || field.kind === "pill";
}

export function layoutNeedsNumber(layout: string) {
  return layout.includes("número") || layout.includes("Número");
}

export function layoutNeedsRanchName(layout: string) {
  return layout.includes("nombre del rancho");
}

export function layoutNeedsLogo(layout: string) {
  return layout.includes("logo") || layout.includes("Logo");
}

export function layoutNeedsBarcode(layout: string) {
  return layout.includes("código de barras");
}

export const categorySchemas: CategorySchema[] = [
  {
    id: "cap",
    name: "Gorra personalizada",
    shortName: "Gorras",
    description: "Dos estilos y tres colores limpios. Elige parche de cuero o bordado y sube tu logo para revisión.",
    image: "/media/personalizados/gorra-personalizada.webp",
    imageAlt: "Gorra arena y café preparada para personalizar",
    imageWidth: 1122,
    imageHeight: 1402,
    filePolicy: "required",
    fields: [
      {
        kind: "thumb",
        section: "physical",
        name: "model",
        required: true,
        label: "Estilo",
        choices: [
          { value: "Trucker", image: "/media/configurador/cap/trucker-arena.webp", hint: "Malla posterior" },
          { value: "Clásica ajustable", image: "/media/configurador/cap/clasica-arena.webp", hint: "Seis paneles" },
        ],
      },
      {
        kind: "swatch",
        section: "physical",
        name: "color",
        required: true,
        label: "Color",
        choices: [
          { value: "Arena", swatch: "#d8bea0" },
          { value: "Negra", swatch: "#25251f" },
          { value: "Olivo", swatch: "#5d6245" },
        ],
      },
      {
        kind: "pill",
        section: "design",
        name: "technique",
        label: "Aplicación obligatoria",
        required: true,
        defaultValue: "",
        choices: [
          { value: "Parche de cuero", hint: "Rectangular, con volumen y costura" },
          { value: "Bordado directo", hint: "Hilo aplicado sobre la tela" },
        ],
      },
      {
        kind: "pill",
        section: "design",
        name: "placement",
        required: true,
        label: "Ubicación",
        choices: [
          { value: "Frente" },
          { value: "Frente y lateral", hint: "La muestra confirmará el área lateral" },
        ],
      },
      {
        kind: "pill",
        section: "design",
        name: "designMode",
        required: true,
        label: "Contenido",
        choices: [
          { value: "Logo" },
          { value: "Logo + texto" },
        ],
      },
      {
        kind: "thumb",
        section: "design",
        name: "demoMark",
        label: "Logo de ejemplo",
        choices: demoMarks,
      },
      {
        kind: "text",
        section: "design",
        name: "ranchText",
        label: "Texto orientativo",
        maxLength: 24,
        required: true,
        placeholder: "Ej. Rancho El Mezquite",
        hint: "Se muestra sólo como referencia.",
        inPreview: true,
        visibleWhen: { field: "designMode", values: ["Logo + texto"] },
      },
    ],
  },
  {
    id: "cattle-tag",
    name: "Aretes ganaderos",
    shortName: "Identificación de ganado",
    description: "Combina número, nombre del rancho, logo y código de barras en distribuciones claras.",
    image: "/media/personalizados/arete-ganadero.webp",
    imageAlt: "Aretes ganaderos de identificación en amarillo, naranja y blanco",
    imageWidth: 1122,
    imageHeight: 1402,
    filePolicy: "conditional",
    note: "Identificación visual personalizada. No sustituye aretes oficiales de trazabilidad o campañas zoosanitarias.",
    fields: [
      {
        kind: "pill",
        section: "physical",
        name: "animal",
        required: true,
        label: "Ganado",
        choices: [
          { value: "Bovino" },
          { value: "Ovino" },
          { value: "Caprino" },
          { value: "Otro por confirmar", ghost: true },
        ],
      },
      {
        kind: "thumb",
        section: "physical",
        name: "format",
        required: true,
        label: "Formato",
        choices: [
          { value: "Visual grande", image: "/media/configurador/cattle-tag/grande-neutro.webp", hint: "Lectura a distancia" },
          { value: "Visual mediano", image: "/media/configurador/cattle-tag/mediano-neutro.webp", hint: "Perfil discreto" },
        ],
      },
      {
        kind: "swatch",
        section: "physical",
        name: "color",
        required: true,
        label: "Color",
        choices: [
          { value: "Amarillo", swatch: "#f0b429" },
          { value: "Naranja", swatch: "#dd6b20" },
          { value: "Blanco", swatch: "#f7f4ec" },
        ],
      },
      {
        kind: "pill",
        section: "design",
        name: "layout",
        required: true,
        label: "Distribución de información",
        choices: cattleLayouts.map((value) => ({ value })),
      },
      {
        kind: "pill",
        section: "design",
        name: "numberMode",
        required: true,
        label: "Numeración",
        choices: [{ value: "Pieza individual" }, { value: "Serie consecutiva" }],
        visibleWhen: { field: "layout", values: cattleLayouts.filter(layoutNeedsNumber) },
      },
      {
        kind: "text",
        section: "design",
        name: "tagNumber",
        label: "Número o clave",
        maxLength: 12,
        required: true,
        placeholder: "Ej. 024",
        inPreview: true,
        visibleWhen: [
          { field: "layout", values: cattleLayouts.filter(layoutNeedsNumber) },
          { field: "numberMode", values: ["Pieza individual"] },
        ],
      },
      {
        kind: "text",
        section: "design",
        name: "seriesStart",
        label: "Número inicial",
        maxLength: 12,
        required: true,
        placeholder: "Ej. 001",
        visibleWhen: [
          { field: "layout", values: cattleLayouts.filter(layoutNeedsNumber) },
          { field: "numberMode", values: ["Serie consecutiva"] },
        ],
      },
      {
        kind: "text",
        section: "design",
        name: "seriesEnd",
        label: "Número final",
        maxLength: 12,
        required: true,
        placeholder: "Ej. 050",
        visibleWhen: [
          { field: "layout", values: cattleLayouts.filter(layoutNeedsNumber) },
          { field: "numberMode", values: ["Serie consecutiva"] },
        ],
      },
      {
        kind: "text",
        section: "design",
        name: "ranchName",
        label: "Nombre o clave del rancho",
        maxLength: 24,
        required: true,
        placeholder: "Ej. Rancho Mezquite",
        inPreview: true,
        visibleWhen: { field: "layout", values: cattleLayouts.filter(layoutNeedsRanchName) },
      },
      {
        kind: "thumb",
        section: "design",
        name: "demoMark",
        label: "Logo de ejemplo",
        choices: demoMarks,
        visibleWhen: { field: "layout", values: cattleLayouts.filter(layoutNeedsLogo) },
      },
      {
        kind: "text",
        section: "design",
        name: "barcodeValue",
        label: "Clave para código de barras",
        maxLength: 20,
        required: true,
        placeholder: "Ej. RANCHO-024",
        hint: "Usa mayúsculas, números y guiones.",
        inPreview: true,
        visibleWhen: { field: "layout", values: cattleLayouts.filter(layoutNeedsBarcode) },
      },
    ],
  },
  {
    id: "pet-tag",
    name: "Placa para mascota",
    shortName: "Perros y gatos",
    description: "Placa de identificación con nombre al frente y teléfono al reverso.",
    image: "/media/personalizados/tags-mascotas.webp",
    imageAlt: "Placas redonda y en forma de hueso sobre collares de cuero",
    imageWidth: 1122,
    imageHeight: 1402,
    filePolicy: "none",
    fields: [
      {
        kind: "pill",
        section: "physical",
        name: "pet",
        required: true,
        label: "Mascota",
        choices: [{ value: "Perro" }, { value: "Gato" }],
      },
      {
        kind: "thumb",
        section: "physical",
        name: "shape",
        required: true,
        label: "Forma",
        choices: [
          { value: "Hueso", image: "/media/configurador/pet-tag/hueso-laton.webp" },
          { value: "Redonda", image: "/media/configurador/pet-tag/redonda-laton.webp" },
          { value: "Escudo", image: "/media/configurador/pet-tag/escudo-laton.webp" },
        ],
      },
      {
        kind: "swatch",
        section: "physical",
        name: "finish",
        required: true,
        label: "Acabado",
        choices: [
          { value: "Latón", swatch: "#b08d57" },
          { value: "Plateado", swatch: "#c9c9c4" },
          { value: "Negro", swatch: "#25251f" },
        ],
      },
      {
        kind: "pill",
        section: "physical",
        name: "size",
        required: true,
        label: "Tamaño",
        choices: [
          { value: "Pequeña", hint: "Razas chicas" },
          { value: "Mediana", hint: "Uso general" },
          { value: "Grande", hint: "Más superficie" },
        ],
      },
      {
        kind: "text",
        section: "design",
        name: "petName",
        label: "Nombre de la mascota",
        maxLength: 20,
        required: true,
        placeholder: "Ej. Canela",
        inPreview: true,
      },
      {
        kind: "tel",
        section: "design",
        name: "phone",
        label: "Teléfono para el reverso",
        maxLength: 20,
        required: true,
        placeholder: "Ej. 662 123 4567",
        inPreview: true,
      },
    ],
  },
];

export function getCategorySchema(category: CustomCategory): CategorySchema {
  return categorySchemas.find((item) => item.id === category) ?? categorySchemas[0];
}

export function isFieldVisible(field: CustomField, configuration: Record<string, string>) {
  if (!field.visibleWhen) return true;
  const conditions = Array.isArray(field.visibleWhen) ? field.visibleWhen : [field.visibleWhen];
  return conditions.every((condition) => condition.values.includes(configuration[condition.field] ?? ""));
}

export function getVisibleFields(category: CustomCategory, configuration: Record<string, string>, section?: FieldSection) {
  return getCategorySchema(category).fields.filter((field) => (!section || field.section === section) && isFieldVisible(field, configuration));
}

export function buildDefaults(category: CustomCategory): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const field of getCategorySchema(category).fields) {
    defaults[field.name] = isChoiceField(field) && !field.required ? field.defaultValue ?? "" : "";
  }
  return defaults;
}

export function requiresDesignFile(category: CustomCategory, configuration: Record<string, string>) {
  const schema = getCategorySchema(category);
  if (schema.filePolicy === "required") return true;
  if (schema.filePolicy === "none") return false;
  return layoutNeedsLogo(configuration.layout ?? "");
}

export function missingRequiredFields(category: CustomCategory, configuration: Record<string, string>, section?: FieldSection) {
  return getVisibleFields(category, configuration, section).filter((field) => {
    const required = isChoiceField(field) ? field.required : field.required;
    return required && !(configuration[field.name] ?? "").trim();
  });
}

export function validateConfiguration(category: CustomCategory, configuration: Record<string, string>, quantity?: number) {
  const schema = getCategorySchema(category);
  for (const field of schema.fields) {
    const value = configuration[field.name] ?? "";
    if (isChoiceField(field)) {
      if (value && !field.choices.some((choice) => choice.value === value)) return `${field.label} no es una opción válida.`;
    } else if (value.length > field.maxLength) {
      return `${field.label} es demasiado largo.`;
    } else if (field.kind === "tel" && value && !/^\d{10,15}$/.test(value.replace(/\D/g, ""))) {
      return `${field.label} debe tener entre 10 y 15 dÃ­gitos.`;
    }
  }
  const missing = missingRequiredFields(category, configuration);
  if (missing.length) return `Falta completar ${missing[0].label.toLowerCase()}.`;
  if (layoutNeedsBarcode(configuration.layout ?? "") && configuration.barcodeValue && !/^[A-Z0-9-]{4,20}$/.test(configuration.barcodeValue)) return "La clave del código de barras sólo puede usar mayúsculas, números y guiones.";
  if (layoutNeedsNumber(configuration.layout ?? "") && configuration.numberMode === "Serie consecutiva") {
    const start = Number(configuration.seriesStart);
    const end = Number(configuration.seriesEnd);
    if (quantity !== undefined && Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start + 1 !== quantity) return `La serie consecutiva contiene ${end - start + 1} piezas; ajusta la cantidad del pedido.`;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) return "La serie consecutiva debe tener un inicio y final válidos.";
  }
  return null;
}
