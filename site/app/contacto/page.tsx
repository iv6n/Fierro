import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbenos a FIERRO: envía tu mensaje o encuéntranos en Instagram.",
};

export default function Page() { return <FierroSite page="contact" />; }
