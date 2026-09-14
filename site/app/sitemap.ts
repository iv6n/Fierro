import type { MetadataRoute } from "next";
import { getSiteOrigin } from "./lib/site-origin";
import { activeProducts } from "./content";

const staticRoutes = [
  "/",
  "/tienda",
  "/nuestra-historia",
  "/contacto",
  "/preguntas-frecuentes",
  "/mayoreo",
  "/personalizados",
  "/personalizados/gorras",
  "/personalizados/aretes",
  "/personalizados/placas",
  "/terminos",
  "/privacidad",
  "/envios-cambios-y-devoluciones",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getSiteOrigin();
  const staticEntries = staticRoutes.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date(),
  }));
  const productEntries = activeProducts.map((product) => ({
    url: `${origin}/producto/${product.slug}`,
    lastModified: new Date(),
  }));
  return [...staticEntries, ...productEntries];
}
