import type { MetadataRoute } from "next";
import { getSiteOrigin } from "./lib/site-origin";

// Sitio en modo prelanzamiento: se bloquea la indexación completa hasta el
// lanzamiento oficial. Cuando el sitio esté listo para vender, quitar el
// `disallow: "/"` de abajo (dejando solo las rutas privadas/transaccionales).
const PRELAUNCH = true;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getSiteOrigin();
  const privatePaths = ["/checkout", "/admin", "/api", "/personalizados/solicitud"];
  return {
    rules: {
      userAgent: "*",
      disallow: PRELAUNCH ? "/" : privatePaths,
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
