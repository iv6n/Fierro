import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";

export const metadata: Metadata = {
  title: "Envíos, cambios y devoluciones",
  description: "Política de envíos, cambios y devoluciones de FIERRO.",
};

export default function ShippingPage() {
  return <FierroSite page="shipping" />;
}
