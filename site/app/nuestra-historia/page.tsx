import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";

export const metadata: Metadata = {
  title: "Nuestra historia",
  description: "Conoce el origen de FIERRO y la identidad sonorense detrás de cada diseño.",
};

export default function Page() { return <FierroSite page="about" />; }
