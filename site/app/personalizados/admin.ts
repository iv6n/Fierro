import { getChatGPTUser } from "../chatgpt-auth";

const DEFAULT_ADMIN_EMAILS = ["iv6nder@gmail.com"];

async function getAdminEmails() {
  try {
    const { env } = await import("cloudflare:workers");
    const configured = env.FIERRO_ADMIN_EMAILS?.split(",").map((email) => email.trim()).filter(Boolean) ?? [];
    return new Set((configured.length ? configured : DEFAULT_ADMIN_EMAILS).map((email) => email.toLowerCase()));
  } catch {
    return new Set(DEFAULT_ADMIN_EMAILS);
  }
}

export async function isCustomizationAdmin(email: string | null | undefined) {
  if (!email) return false;
  return (await getAdminEmails()).has(email.toLowerCase());
}

export async function requireCustomizationAdmin() {
  const user = await getChatGPTUser();
  if (!user || !(await isCustomizationAdmin(user.email))) return null;
  return user;
}
