import type { Metadata } from "next";
import { getSiteOrigin } from "./lib/site-origin";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return {
    title: {
      default: "FIERRO · Hecho para la gente de trabajo",
      template: "%s · FIERRO",
    },
    description: "Ropa y accesorios ranchera con identidad sonorense: gorras, playeras y personalización de aretes ganaderos y placas para mascota.",
    icons: {
      icon: "/brand/fierro-symbol-black.png",
      shortcut: "/brand/fierro-symbol-black.png",
      apple: "/brand/fierro-symbol-black.png",
    },
    openGraph: {
      title: "FIERRO · Hecho para la gente de trabajo",
      description: "Ropa y accesorios ranchera con identidad sonorense: gorras, playeras y personalización de aretes ganaderos y placas para mascota.",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "FIERRO: ropa y accesorios con identidad sonorense" }],
      locale: "es_MX",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "FIERRO · Hecho para la gente de trabajo",
      description: "Ropa y accesorios ranchera con identidad sonorense.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
