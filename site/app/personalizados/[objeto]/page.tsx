import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FierroSite from "../../components/FierroSite";
import { getSiteOrigin } from "../../lib/site-origin";
import type { CustomCategory } from "../pricing";

const objectCategories: Record<string, CustomCategory> = {
  gorras: "cap",
  aretes: "cattle-tag",
  placas: "pet-tag",
};

const objectTitles: Record<string, string> = {
  gorras: "Gorras personalizadas",
  aretes: "Aretes ganaderos personalizados",
  placas: "Placas para mascota personalizadas",
};

const objectDescriptions: Record<string, string> = {
  gorras: "Personaliza gorras FIERRO con tu marca o logo y envía tu solicitud para revisión y cotización.",
  aretes: "Personaliza aretes ganaderos con el nombre de tu rancho y número de serie, y envía tu solicitud para revisión.",
  placas: "Personaliza placas de identificación para mascota con nombre y teléfono, y envía tu solicitud para revisión.",
};

export async function generateMetadata({ params }: { params: Promise<{ objeto: string }> }): Promise<Metadata> {
  const { objeto } = await params;
  if (!objectCategories[objeto]) return {};
  const origin = await getSiteOrigin();
  const title = objectTitles[objeto];
  const description = objectDescriptions[objeto];
  return {
    title,
    description,
    openGraph: {
      title: `${title} · FIERRO`,
      description,
      images: [{ url: `${origin}/og-personalizados.png`, width: 1731, height: 909, alt: "FIERRO: personalización de gorras, aretes ganaderos y placas para mascota" }],
      locale: "es_MX",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · FIERRO`,
      description,
      images: [`${origin}/og-personalizados.png`],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ objeto: string }> }) {
  const { objeto } = await params;
  const category = objectCategories[objeto];
  if (!category) redirect("/personalizados");
  return <FierroSite page="custom" customCategory={category} />;
}
