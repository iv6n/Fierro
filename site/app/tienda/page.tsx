import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";
import { collections } from "../content";

const productCategories = new Set(["playeras", "gorras", "hoodies", "accesorios"]);
const categoryLabels: Record<string, string> = { playeras: "Playeras", gorras: "Gorras", hoodies: "Hoodies", accesorios: "Accesorios" };

type ShopSearchParams = { tipo?: string | string[]; q?: string | string[]; coleccion?: string | string[] };

function readShopParams({ tipo, q, coleccion }: ShopSearchParams) {
  const requestedCategory = Array.isArray(tipo) ? tipo[0] : tipo;
  const initialCategory = requestedCategory && productCategories.has(requestedCategory) ? requestedCategory : "all";
  const requestedQuery = Array.isArray(q) ? q[0] : q;
  const initialQuery = requestedQuery?.trim() ?? "";
  const requestedCollection = Array.isArray(coleccion) ? coleccion[0] : coleccion;
  const initialCollection = requestedCollection && collections.some((item) => item.id === requestedCollection) ? requestedCollection : "all";
  return { initialCategory, initialQuery, initialCollection };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<ShopSearchParams> }): Promise<Metadata> {
  const { initialCategory, initialCollection } = readShopParams(await searchParams);
  const collection = collections.find((item) => item.id === initialCollection);
  const label = collection ? collection.name : categoryLabels[initialCategory];
  const title = label ? `${label} · Tienda` : "Tienda";
  const description = collection?.description ?? "Gorras, playeras y accesorios FIERRO inspirados en Sonora, el ganado y la vida de campo.";
  return { title, description };
}

export default async function Page({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  const { initialCategory, initialQuery, initialCollection } = readShopParams(await searchParams);
  return <FierroSite page="shop" initialCategory={initialCategory} initialQuery={initialQuery} initialCollection={initialCollection} />;
}
