import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Resuelve tus dudas sobre pedidos, personalización, tiempos y pagos en FIERRO.",
};

export default function Page() { return <FierroSite page="faq" />; }
