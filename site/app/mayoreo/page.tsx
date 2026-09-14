import type { Metadata } from "next";
import FierroSite from "../components/FierroSite";

export const metadata: Metadata = {
  title: "Mayoreo",
  description: "Cotiza piezas personalizadas de FIERRO por volumen para tu rancho, negocio o evento.",
};

export default function Page() { return <FierroSite page="wholesale" />; }
