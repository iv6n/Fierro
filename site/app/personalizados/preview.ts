import type { CustomCategory } from "./pricing";
import { demoMarks, layoutNeedsBarcode, layoutNeedsLogo, layoutNeedsNumber, layoutNeedsRanchName } from "./schema";

export type PreviewLine = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
};

export type PreviewMark = {
  src: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  treatment: "patch" | "embroidery" | "print";
};

export type PreviewBarcode = {
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResolvedPreview = {
  src: string;
  fallbackSrc: string;
  alt: string;
  width: number;
  height: number;
  tint: string | null;
  scale: number;
  lines: PreviewLine[];
  mark: PreviewMark | null;
  barcode: PreviewBarcode | null;
  printArea: { x: number; y: number; width: number; height: number; rotate: number };
};

const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 1500;

type BarcodeRenderer = Pick<typeof import("@bwip-js/browser"), "toCanvas">;
let barcodeRendererPromise: Promise<BarcodeRenderer> | null = null;
let previewFontPromise: Promise<FontFace[]> | null = null;
const imagePromises = new Map<string, Promise<HTMLImageElement>>();

export function getBarcodeRenderer() {
  return barcodeRendererPromise ??= import("@bwip-js/browser").then((module) => (module as unknown as { default: BarcodeRenderer }).default);
}

const fallbackImages: Record<CustomCategory, { src: string; alt: string }> = {
  cap: { src: "/media/personalizados/gorra-personalizada.webp", alt: "Gorra preparada para personalizar" },
  "cattle-tag": { src: "/media/personalizados/arete-ganadero.webp", alt: "Aretes ganaderos de identificación" },
  "pet-tag": { src: "/media/personalizados/tags-mascotas.webp", alt: "Placas para mascota" },
};

const capModels: Record<string, string> = { Trucker: "trucker", "Clásica ajustable": "clasica" };
const capColors: Record<string, string> = { Arena: "arena", Negra: "negra", Olivo: "olivo" };
const tagFormats: Record<string, string> = { "Visual grande": "grande", "Visual mediano": "mediano" };
const tagTints: Record<string, string> = { Amarillo: "#f0b429", Naranja: "#dd6b20", Blanco: "#f7f4ec" };
const petShapes: Record<string, string> = { Hueso: "hueso", Redonda: "redonda", Escudo: "escudo" };
const petFinishes: Record<string, string> = { Latón: "laton", Plateado: "plateado", Negro: "negro" };
const petSizes: Record<string, number> = { Pequeña: 0.84, Mediana: 1, Grande: 1.14 };

function resolveDemoMark(value: string) {
  return demoMarks.find((mark) => mark.value === value) ?? demoMarks[0];
}

function splitLines(value: string, maxPerLine: number) {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return [];
  if (text.length <= maxPerLine) return [text];
  const words = text.split(" ");
  let first = "";
  while (words.length && `${first} ${words[0]}`.trim().length <= maxPerLine) first = `${first} ${words.shift()}`.trim();
  const second = words.join(" ");
  return second ? [first || text.slice(0, maxPerLine), second] : [first || text];
}

function capPreview(configuration: Record<string, string>): ResolvedPreview {
  const model = capModels[configuration.model] ?? "trucker";
  const color = capColors[configuration.color] ?? "arena";
  const technique = configuration.technique;
  const demo = resolveDemoMark(configuration.demoMark);
  const lightThread = color === "negra" || color === "olivo";
  const ranchText = configuration.designMode === "Logo + texto" ? configuration.ranchText?.trim() ?? "" : "";
  return {
    src: `/media/configurador/cap/${model}-${color}.webp`,
    fallbackSrc: fallbackImages.cap.src,
    alt: `Gorra ${configuration.model ?? ""} en ${configuration.color ?? ""}`.replace(/\s+/g, " ").trim(),
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    tint: null,
    scale: 1,
    mark: technique ? {
      src: demo.image ?? demoMarks[0].image!,
      name: demo.value,
      x: 0.5,
      y: ranchText ? 0.455 : 0.475,
      width: technique === "Parche de cuero" ? 0.17 : 0.15,
      height: technique === "Parche de cuero" ? 0.105 : 0.12,
      color: technique === "Parche de cuero" ? "#2c1b12" : lightThread ? "#efe4cf" : "#38261b",
      treatment: technique === "Parche de cuero" ? "patch" : "embroidery",
    } : null,
    lines: ranchText ? [{ text: ranchText.toUpperCase(), x: 0.5, y: 0.535, fontSize: 0.035, color: technique === "Bordado directo" && lightThread ? "#efe4cf" : "#38261b" }] : [],
    barcode: null,
    printArea: model === "clasica"
      ? { x: 0.34, y: 0.38, width: 0.32, height: 0.2, rotate: 0 }
      : { x: 0.33, y: 0.38, width: 0.34, height: 0.2, rotate: 0 },
  };
}

function cattleTagPreview(configuration: Record<string, string>): ResolvedPreview {
  const format = tagFormats[configuration.format] ?? "grande";
  const tint = tagTints[configuration.color] ?? tagTints.Amarillo;
  const layout = configuration.layout ?? "Número + nombre del rancho";
  const hasLogo = layoutNeedsLogo(layout);
  const hasNumber = layoutNeedsNumber(layout);
  const hasRanch = layoutNeedsRanchName(layout);
  const hasBarcode = layoutNeedsBarcode(layout);
  const demo = resolveDemoMark(configuration.demoMark);
  const number = configuration.numberMode === "Serie consecutiva"
    ? `${configuration.seriesStart || "001"}–${configuration.seriesEnd || "050"}`
    : configuration.tagNumber?.trim() ?? "";
  const lines: PreviewLine[] = [];
  if (hasNumber && number) lines.push({ text: number.toUpperCase(), x: 0.5, y: hasLogo ? 0.535 : 0.485, fontSize: hasBarcode ? 0.06 : 0.085, color: "#25251f" });
  if (hasRanch && configuration.ranchName?.trim()) {
    splitLines(configuration.ranchName, 15).forEach((text, index) => lines.push({ text: text.toUpperCase(), x: 0.5, y: 0.58 + index * 0.055, fontSize: 0.038, color: "#25251f" }));
  }
  return {
    src: `/media/configurador/cattle-tag/${format}-neutro.webp`,
    fallbackSrc: fallbackImages["cattle-tag"].src,
    alt: `Arete ganadero ${configuration.format ?? ""} en ${configuration.color ?? ""}`.replace(/\s+/g, " ").trim(),
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    tint,
    scale: format === "mediano" ? 0.88 : 1,
    mark: hasLogo ? {
      src: demo.image ?? demoMarks[0].image!,
      name: demo.value,
      x: 0.5,
      y: hasNumber || hasBarcode ? 0.445 : 0.515,
      width: hasNumber || hasBarcode ? 0.12 : 0.19,
      height: hasNumber || hasBarcode ? 0.105 : 0.17,
      color: "#25251f",
      treatment: "print",
    } : null,
    lines,
    barcode: hasBarcode && configuration.barcodeValue ? { value: configuration.barcodeValue, x: 0.5, y: 0.665, width: 0.27, height: 0.085 } : null,
    printArea: { x: 0.3, y: 0.38, width: 0.4, height: 0.34, rotate: 0 },
  };
}

function petTagPreview(configuration: Record<string, string>): ResolvedPreview {
  const shape = petShapes[configuration.shape] ?? "hueso";
  const finish = petFinishes[configuration.finish] ?? "laton";
  const color = finish === "negro" ? "#efe7d7" : "#2b2b26";
  const name = (configuration.petName ?? "").trim();
  const phone = (configuration.phone ?? "").trim();
  const lines: PreviewLine[] = [];
  if (name) lines.push({ text: name.toUpperCase().slice(0, 20), x: 0.5, y: 0.49, fontSize: 0.075, color });
  if (phone) lines.push({ text: phone.slice(0, 20), x: 0.5, y: 0.575, fontSize: 0.045, color });
  return {
    src: `/media/configurador/pet-tag/${shape}-${finish}.webp`,
    fallbackSrc: fallbackImages["pet-tag"].src,
    alt: `Placa ${configuration.shape ?? ""} acabado ${configuration.finish ?? ""}`.replace(/\s+/g, " ").trim(),
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    tint: null,
    scale: petSizes[configuration.size] ?? 1,
    mark: null,
    lines,
    barcode: null,
    printArea: { x: 0.34, y: 0.38, width: 0.32, height: 0.24, rotate: 0 },
  };
}

export function resolvePreviewBase(category: CustomCategory, configuration: Record<string, string>): ResolvedPreview {
  if (category === "cattle-tag") return cattleTagPreview(configuration);
  if (category === "pet-tag") return petTagPreview(configuration);
  return capPreview(configuration);
}

export function previewFallback(category: CustomCategory) {
  return fallbackImages[category] ?? fallbackImages.cap;
}

function loadImage(src: string) {
  const cached = imagePromises.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement("img");
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No fue posible cargar ${src}`));
    image.src = src;
  });
  imagePromises.set(src, promise);
  promise.catch(() => {
    if (imagePromises.get(src) === promise) imagePromises.delete(src);
  });
  return promise;
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function drawTintedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, mark: PreviewMark) {
  const x = Math.round((mark.x - mark.width / 2) * PREVIEW_WIDTH);
  const y = Math.round((mark.y - mark.height / 2) * PREVIEW_HEIGHT);
  const width = Math.max(1, Math.round(mark.width * PREVIEW_WIDTH));
  const height = Math.max(1, Math.round(mark.height * PREVIEW_HEIGHT));
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerContext = layer.getContext("2d");
  if (!layerContext) return;
  layerContext.drawImage(image, 0, 0, width, height);
  layerContext.globalCompositeOperation = "source-in";
  layerContext.fillStyle = mark.color;
  layerContext.fillRect(0, 0, width, height);
  if (mark.treatment === "embroidery") {
    context.save();
    context.shadowColor = "rgba(0,0,0,.32)";
    context.shadowBlur = 2;
    context.shadowOffsetY = 1;
    context.drawImage(layer, x, y);
    context.restore();
  } else {
    context.drawImage(layer, x, y);
  }
}

export async function renderPreviewToBlob(preview: ResolvedPreview): Promise<Blob | null> {
  try {
    let usedFallback = false;
    const base = await loadImage(preview.src).catch(() => {
      usedFallback = true;
      return loadImage(preview.fallbackSrc);
    });
    const canvas = document.createElement("canvas");
    canvas.width = preview.width;
    canvas.height = preview.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const ratio = Math.min(canvas.width / base.naturalWidth, canvas.height / base.naturalHeight) * preview.scale;
    const drawWidth = base.naturalWidth * ratio;
    const drawHeight = base.naturalHeight * ratio;
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;
    context.drawImage(base, offsetX, offsetY, drawWidth, drawHeight);

    if (preview.tint && !usedFallback) {
      context.globalCompositeOperation = "multiply";
      context.fillStyle = preview.tint;
      context.fillRect(offsetX, offsetY, drawWidth, drawHeight);
      context.globalCompositeOperation = "destination-in";
      context.drawImage(base, offsetX, offsetY, drawWidth, drawHeight);
      context.globalCompositeOperation = "source-over";
    }

    if (preview.mark?.treatment === "patch") {
      const area = preview.printArea;
      const x = area.x * PREVIEW_WIDTH;
      const y = area.y * PREVIEW_HEIGHT;
      const width = area.width * PREVIEW_WIDTH;
      const height = area.height * PREVIEW_HEIGHT;
      context.save();
      context.shadowColor = "rgba(32,19,10,.28)";
      context.shadowBlur = 16;
      context.shadowOffsetY = 8;
      drawRoundedRect(context, x, y, width, height, 18);
      context.fillStyle = "#9a6039";
      context.fill();
      context.shadowColor = "transparent";
      context.strokeStyle = "#5a321d";
      context.lineWidth = 8;
      context.setLineDash([11, 9]);
      drawRoundedRect(context, x + 12, y + 12, width - 24, height - 24, 12);
      context.stroke();
      context.restore();
    }

    if (preview.mark) {
      const markImage = await loadImage(preview.mark.src).catch(() => null);
      if (markImage) drawTintedImage(context, markImage, preview.mark);
    }

    if (preview.lines.length) {
      previewFontPromise ??= document.fonts.load(`400 ${Math.round(PREVIEW_WIDTH * 0.1)}px "Bebas Neue"`).catch(() => []);
      await previewFontPromise;
      context.textAlign = "center";
      context.textBaseline = "middle";
      for (const line of preview.lines) {
        context.fillStyle = line.color;
        context.font = `400 ${Math.round(line.fontSize * preview.width)}px "Bebas Neue", Impact, sans-serif`;
        context.fillText(line.text, line.x * preview.width, line.y * preview.height);
      }
    }

    if (preview.barcode) {
      const bwipjs = await getBarcodeRenderer();
      const barcodeCanvas = document.createElement("canvas");
      bwipjs.toCanvas(barcodeCanvas, { bcid: "code128", text: preview.barcode.value, scale: 3, height: 8, includetext: true, textxalign: "center" });
      context.drawImage(barcodeCanvas, (preview.barcode.x - preview.barcode.width / 2) * PREVIEW_WIDTH, (preview.barcode.y - preview.barcode.height / 2) * PREVIEW_HEIGHT, preview.barcode.width * PREVIEW_WIDTH, preview.barcode.height * PREVIEW_HEIGHT);
    }

    context.fillStyle = "rgba(37,37,31,.86)";
    context.fillRect(20, PREVIEW_HEIGHT - 58, 360, 38);
    context.fillStyle = "#f7f0e4";
    context.font = "700 20px sans-serif";
    context.textAlign = "left";
    context.fillText("SIMULACIÓN · LOGO DE EJEMPLO", 36, PREVIEW_HEIGHT - 38);

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  } catch {
    return null;
  }
}
