import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Aviso de privacidad de FIERRO sobre el tratamiento de tus datos personales.",
};

export default function PrivacyPage() {
  return <FierroSite page="privacy" />;
}
