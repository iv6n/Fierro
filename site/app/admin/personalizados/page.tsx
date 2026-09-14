import { requireChatGPTUser } from "../../chatgpt-auth";
import { isCustomizationAdmin } from "../../personalizados/admin";
import AdminPersonalizations from "../../components/AdminPersonalizations";

export const dynamic = "force-dynamic";

async function ProtectedAdmin() {
  const user = await requireChatGPTUser("/admin/personalizados");
  if (!(await isCustomizationAdmin(user.email))) return <section className="section"><p className="eyebrow">Administración</p><h1>Acceso restringido.</h1><p>Esta cuenta no está autorizada para revisar solicitudes FIERRO.</p></section>;
  return <AdminPersonalizations />;
}

export default function Page() {
  return <ProtectedAdmin />;
}
