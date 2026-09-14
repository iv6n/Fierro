export function apiServerError(route: string, error: unknown, message: string) {
  const detail = error instanceof Error
    ? error.stack ?? `${error.name}: ${error.message}`
    : String(error);
  console.error(`[${route}] ${detail}`);
  return Response.json({ error: message }, { status: 500 });
}
