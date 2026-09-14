import type { Metadata } from "next";
import FierroSite from "../../components/FierroSite";
import { getSiteOrigin } from "../../lib/site-origin";
import { getCatalogStatus, getProductVariants, products } from "../../content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product || getCatalogStatus(product) !== "active") {
    return { title: "Producto no disponible", robots: { index: false, follow: true } };
  }
  const origin = await getSiteOrigin();
  const image = getProductVariants(product)[0]?.image;
  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: {
      title: `${product.name} · FIERRO`,
      description: product.shortDescription,
      images: image?.src ? [{ url: `${origin}${image.src}`, alt: image.alt }] : undefined,
      locale: "es_MX",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · FIERRO`,
      description: product.shortDescription,
      images: image?.src ? [`${origin}${image.src}`] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FierroSite page="product" productSlug={slug} />;
}
