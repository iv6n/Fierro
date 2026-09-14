import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";
import { getSiteOrigin } from "../lib/site-origin";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  const title = "Personalizados";
  const description = "Elige tu objeto, personaliza sus características y envía una solicitud para revisión y cotización.";
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

export default function Page() {
  return <FierroSite page="custom-index" />;
}
