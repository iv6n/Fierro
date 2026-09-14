import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Términos y condiciones de uso del sitio FIERRO.",
};

export default function TermsPage() {
  return <FierroSite page="terms" />;
}
