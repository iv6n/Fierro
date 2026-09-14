import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function readWebpMeta(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  let width = 0;
  let height = 0;
  let hasAlpha = false;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === "VP8X") {
      hasAlpha ||= Boolean(buffer[data] & 0x10);
      width ||= 1 + buffer.readUIntLE(data + 4, 3);
      height ||= 1 + buffer.readUIntLE(data + 7, 3);
    } else if (type === "VP8L" && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      width ||= (bits & 0x3fff) + 1;
      height ||= ((bits >>> 14) & 0x3fff) + 1;
      hasAlpha ||= Boolean((bits >>> 28) & 1);
    } else if (type === "VP8 " && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      width ||= buffer.readUInt16LE(data + 6) & 0x3fff;
      height ||= buffer.readUInt16LE(data + 8) & 0x3fff;
    } else if (type === "ALPH") {
      hasAlpha = true;
    }
    offset = data + size + (size % 2);
  }
  return { width, height, hasAlpha };
}

test("renders the FIERRO storefront without starter content", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /FIERRO/);
  assert.match(html, /Hecho para la gente de trabajo/);
  assert.match(html, /Ver colecci/);
  assert.match(html, /src="\/media\/nuestra-raiz-ganado\.webp"/);
  assert.match(html, /Jinete guiando ganado por un rancho sonorense/);
  for (const image of ["flora-del-desierto", "ganado-sonorense", "rio-sonora", "gente-de-trabajo", "gorras-fierro"]) {
    assert.match(html, new RegExp(`src="/media/collections/${image}\\.webp"`));
  }
  assert.match(html, /historia-caballo-organos\.webp/);
  assert.match(html, /Cabalgata entre .*rganos/);
  assert.doesNotMatch(html, /_vinext\/image[^>]+(?:nuestra-raiz-ganado|historia-caballo-organos)/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships both homepage editorial photographs as direct public assets", async () => {
  for (const name of ["nuestra-raiz-ganado.webp", "historia-caballo-organos.webp"]) {
    const asset = await readFile(new URL(`../public/media/${name}`, import.meta.url));
    assert.ok(asset.length > 10_000, `${name} should contain an optimized photograph`);
  }
});

test("ships five optimized collection photographs", async () => {
  const root = new URL("../public/media/collections/", import.meta.url);
  const files = await readdir(root);
  assert.deepEqual(files.sort(), ["flora-del-desierto.webp", "ganado-sonorense.webp", "gente-de-trabajo.webp", "gorras-fierro.webp", "rio-sonora.webp"]);
  for (const file of files) assert.ok((await readFile(new URL(file, root))).length > 10_000);
});

test("renders active hats and six shirt designs while keeping checkout provisional", async () => {
  const [shopResponse, checkoutResponse, shirtsResponse, shirtResponse, retiredShirtResponse] = await Promise.all([
    render("/tienda?tipo=gorras"),
    render("/checkout"),
    render("/tienda?tipo=playeras"),
    render("/producto/playera-brangus"),
    render("/producto/playera-organo-del-monte"),
  ]);
  assert.equal(shopResponse.status, 200);
  assert.equal(checkoutResponse.status, 200);
  const shopHtml = await shopResponse.text();
  assert.match(shopHtml, /Gorra Bronco/);
  assert.doesNotMatch(shopHtml, /producto\/playera-brangus/);
  assert.match(shopHtml, /Hecho para el rancho/);
  assert.match(shopHtml, /Dise.*ado para todos los d.*as/);
  assert.match(shopHtml, /Aplicar filtros/);
  assert.match(shopHtml, /Ordenar por/);
  assert.match(shopHtml, /Primera colecci.*n en camino/);
  const checkoutHtml = await checkoutResponse.text();
  assert.match(checkoutHtml, /Checkout de prueba/);
  assert.match(checkoutHtml, /carrito est/);
  const shirtsHtml = await shirtsResponse.text();
  for (const name of ["Brangus", "Caballo del Desierto", "F de Herrar", "Gallo de Rancho", "Hecho en Sonora", "Truck del Desierto"]) {
    assert.match(shirtsHtml, new RegExp(name));
  }
  for (const image of [
    "brangus/olivo.webp",
    "caballo-desierto/oxido.webp",
    "f-de-herrar/natural-dos-tintas.webp",
    "gallo-de-rancho/arena.webp",
    "hecho-en-sonora/carbon-oro.webp",
    "truck-del-desierto/indigo-workwear.webp",
  ]) {
    assert.match(shirtsHtml, new RegExp(image));
  }
  const shirtHtml = await shirtResponse.text();
  assert.match(shirtHtml, /Carbón/);
  assert.match(shirtHtml, /Arena/);
  assert.match(shirtHtml, /Olivo/);
  assert.match(shirtHtml, /\$(?:<!-- -->)?599(?:<!-- -->)? MXN/);
  assert.match(shirtHtml, /Modo de prueba/);
  assert.match(shirtHtml, /Dise.*o de espalda/);
  assert.match(shirtHtml, /Mockup completo/);
  assert.match(await retiredShirtResponse.text(), /Este producto ya no está disponible/);
});

test("publishes an editorial personalized landing with shareable focused configurators", async () => {
  const [shop, custom, caps, cattleTags, petTags, unknownObject, wholesale, collections, customSource, siteSource, pricingSource, customSchema, previewSource] = await Promise.all([
    render("/tienda"),
    render("/personalizados"),
    render("/personalizados/gorras"),
    render("/personalizados/aretes"),
    render("/personalizados/placas"),
    render("/personalizados/no-existe"),
    render("/mayoreo"),
    render("/colecciones"),
    readFile(new URL("../app/components/CustomExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FierroSite.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/personalizados/pricing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/personalizados/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/personalizados/preview.ts", import.meta.url), "utf8"),
  ]);
  const shopHtml = await shop.text();
  const customHtml = await custom.text();
  const capsHtml = await caps.text();
  const cattleTagsHtml = await cattleTags.text();
  const petTagsHtml = await petTags.text();
  const wholesaleHtml = await wholesale.text();
  assert.match(shopHtml, /PR.XIMAMENTE/);
  for (const label of ["Tienda", "Gorras", "Playeras", "Personalizados", "Nuestra historia"]) assert.match(shopHtml, new RegExp(label));
  assert.match(customHtml, /Elige la pieza/i);
  assert.match(customHtml, /¿Qu.* quieres personalizar/i);
  assert.match(customHtml, /Gorra personalizada/i);
  assert.match(customHtml, /Aretes ganaderos/i);
  assert.match(customHtml, /Placa para mascota/i);
  assert.match(customHtml, /Personalizar/i);
  assert.match(customHtml, /href="\/personalizados\/gorras"/i);
  assert.match(customHtml, /href="\/personalizados\/aretes"/i);
  assert.match(customHtml, /href="\/personalizados\/placas"/i);
  assert.match(customHtml, /desktop-nav|site-footer/i);
  assert.match(customHtml, /El archivo original siempre viaja por separado/i);
  assert.doesNotMatch(customHtml, /Paso .*1.* de 3/i);
  for (const [html, name] of [[capsHtml, "Gorra personalizada"], [cattleTagsHtml, "Aretes ganaderos"], [petTagsHtml, "Placa para mascota"]]) {
    assert.match(html, /Paso .*1.* de 4/i);
    assert.match(html, new RegExp(name, "i"));
    assert.match(html, /href="\/personalizados"[^>]*>Objetos</i);
    assert.doesNotMatch(html, /desktop-nav|site-footer/i);
  }
  assert.equal(unknownObject.status, 307);
  assert.equal(new URL(unknownObject.headers.get("location")).pathname, "/personalizados");
  assert.match(customSource, /TOTAL_STEPS = 4/);
  assert.match(customSource, /¿Qu.* quieres mostrar/i);
  assert.match(customSource, /S.*lo n.*mero/i);
  assert.match(customSource, /TAG_LAYOUTS\.map/);
  assert.doesNotMatch(customSource, /showMore|Ver m.*s dise.*os|Ocultar dise.*os/i);
  assert.doesNotMatch(customSource, /categorySchemas|ObjectPicker|ProductFlow/);
  assert.match(customSource, /href="\/personalizados"/);
  assert.match(siteSource, /custom-index/);
  assert.match(siteSource, /href: "\/personalizados\/gorras"/);
  assert.match(siteSource, /href: "\/personalizados\/aretes"/);
  assert.match(siteSource, /href: "\/personalizados\/placas"/);
  assert.match(customSchema, /No sustituye aretes oficiales/i);
  assert.match(customSchema, /!field\.required/);
  assert.match(customSchema, /quantity\?: number/);
  assert.doesNotMatch(customHtml, /Aretes grabados|Bronce envejecido|Par de aretes/i);
  assert.match(customSource, /Vista previa/i);
  assert.match(customSource, /No se aplica en esta simulaci.*n/i);
  assert.match(customSource, /normalizeCustomQuantity/);
  assert.match(customSource, /directSubmit/);
  assert.match(customSource, /customerName/);
  assert.match(customSource, /customerPhone/);
  assert.match(customSource, /activeStep.*3/);
  assert.match(customSource, /activeStep.*4/);
  assert.match(customSource, /Revisa tu brief/);
  assert.match(customSource, /physicalConfirmed/);
  assert.match(customSource, /textConfirmed/);
  assert.match(customSource, /Idempotency-Key/);
  assert.doesNotMatch(customSource, /createCustomCartLine|onAdd/);
  assert.match(customSource, /renderPreviewToBlob\(preview\)/);
  assert.match(customSchema, /Parche de cuero/);
  assert.match(customSchema, /Bordado directo/);
  for (const layout of ["Sólo número", "Número + nombre del rancho", "Sólo logo", "Logo + número", "Número + código de barras", "Logo + número + código de barras"]) assert.ok(customSchema.includes(layout), `missing cattle-tag layout: ${layout}`);
  assert.match(previewSource, /Logo de ejemplo; archivo real separado|SIMULACIÓN · LOGO DE EJEMPLO/);
  assert.doesNotMatch(pricingSource, /discountPercent/);
  assert.match(wholesaleHtml, /cualquier cantidad entre .*1.*5,000 piezas/i);
  assert.match(wholesaleHtml, /Placas para mascota/);
  assert.match(wholesaleHtml, /confirmar.*precio.*plazo/i);
  assert.equal(collections.status, 404);
});

test("ships three optimized personalized-product mockups", async () => {
  const root = new URL("../public/media/personalizados/", import.meta.url);
  const files = (await readdir(root)).sort();
  assert.deepEqual(files, ["arete-ganadero.webp", "gorra-personalizada.webp", "tags-mascotas.webp"]);
  for (const file of files) assert.ok((await readFile(new URL(file, root))).length > 50_000);
});

test("ships all 17 customizer base photos with the expected variants", async () => {
  const root = new URL("../public/media/configurador/", import.meta.url);
  const expected = {
    cap: [
      "clasica-arena.webp",
      "clasica-negra.webp",
      "clasica-olivo.webp",
      "trucker-arena.webp",
      "trucker-negra.webp",
      "trucker-olivo.webp",
    ],
    "cattle-tag": ["grande-neutro.webp", "mediano-neutro.webp"],
    "pet-tag": [
      "escudo-laton.webp",
      "escudo-negro.webp",
      "escudo-plateado.webp",
      "hueso-laton.webp",
      "hueso-negro.webp",
      "hueso-plateado.webp",
      "redonda-laton.webp",
      "redonda-negro.webp",
      "redonda-plateado.webp",
    ],
  };
  const previewSource = await readFile(new URL("../app/personalizados/preview.ts", import.meta.url), "utf8");
  assert.match(previewSource, /\/media\/configurador\/cap\/\$\{model\}-\$\{color\}\.webp/);
  assert.match(previewSource, /\/media\/configurador\/cattle-tag\/\$\{format\}-neutro\.webp/);
  assert.match(previewSource, /\/media\/configurador\/pet-tag\/\$\{shape\}-\$\{finish\}\.webp/);

  let total = 0;
  for (const [directory, names] of Object.entries(expected)) {
    assert.deepEqual((await readdir(new URL(`${directory}/`, root))).sort(), names);
    for (const name of names) {
      const data = await readFile(new URL(`${directory}/${name}`, root));
      assert.ok(data.length > 50_000, `${directory}/${name} should contain an optimized photograph`);
      const meta = readWebpMeta(data);
      assert.deepEqual([meta.width, meta.height], [1200, 1500], `${directory}/${name} should use the 4:5 customizer canvas`);
      assert.equal(meta.hasAlpha, directory === "cattle-tag", `${directory}/${name} alpha mode should match its preview behavior`);
      total += 1;
    }
  }
  assert.equal(total, 17);
});

test("ships three transparent fictional ranch marks for safe previews", async () => {
  const root = new URL("../public/media/configurador/demo/", import.meta.url);
  const expected = ["ganaderia-desierto.png", "la-herradura.png", "rancho-mezquite.png"];
  assert.deepEqual((await readdir(root)).sort(), expected);
  for (const name of expected) {
    const data = await readFile(new URL(name, root));
    assert.ok(data.length > 20_000, `${name} should contain a detailed demonstration mark`);
    assert.equal(data.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(data[25], 6, `${name} should be RGBA with transparency support`);
  }
});

test("ships 21 selected shirt variant mockups and variant-aware cart interfaces", async () => {
  const root = new URL("../public/media/products/playeras/", import.meta.url);
  const groups = ["brangus", "caballo-desierto", "f-de-herrar", "gallo-de-rancho", "hecho-en-sonora", "truck-del-desierto"];
  const files = (await Promise.all(groups.map(async (group) => (await readdir(new URL(`${group}/`, root))).map((name) => `${group}/${name}`)))).flat();
  assert.equal(files.length, 21);
  assert.ok(files.every((name) => name.endsWith(".webp")));
  const [cart, component, content] = await Promise.all([
    readFile(new URL("../app/cart.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FierroSite.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
  ]);
  assert.match(cart, /fierro-cart-v3/);
  assert.match(cart, /variantId/);
  assert.match(cart, /variantLabel/);
  assert.match(cart, /product\.id.*variant\.id.*size/);
  assert.match(component, /setVariantId/);
  assert.match(component, /createCartLine\(product, selectedVariant, size, quantity\)/);
  assert.match(content, /type ProductVariant/);
});

test("publishes prelaunch legal information and the confirmed Instagram profile", async () => {
  const [terms, privacy, shipping, contact] = await Promise.all([
    render("/terminos"),
    render("/privacidad"),
    render("/envios-cambios-y-devoluciones"),
    render("/contacto"),
  ]);
  const pages = await Promise.all([terms, privacy, shipping, contact].map((response) => response.text()));
  assert.match(pages[0], /Términos de uso/);
  assert.match(pages[0], /no se cobran cantidades/i);
  assert.match(pages[0], /Solicitudes personalizadas/i);
  assert.match(pages[1], /Aviso de privacidad/);
  assert.match(pages[1], /almacenamiento local del navegador/);
  assert.match(pages[1], /archivos enviados/i);
  assert.match(pages[2], /Envíos, cambios y devoluciones/);
  assert.match(pages[2], /Envío conjunto/i);
  assert.match(pages[3], /instagram\.com\/fierro\.shop/);
  assert.match(pages[3], /name="message"/);
  assert.match(pages[3], /Enviar mensaje/);
  assert.doesNotMatch(pages.join("\n"), /WhatsApp \[placeholder\]|Facebook \[placeholder\]|href="#"/i);
});

test("exposes a working product search, breadcrumbs, and SEO routes", async () => {
  const [searchResponse, noResultsResponse, productResponse, sitemapResponse, robotsResponse] = await Promise.all([
    render("/tienda?q=brangus"),
    render("/tienda?q=xyzxyzxyz"),
    render("/producto/playera-brangus"),
    render("/sitemap.xml"),
    render("/robots.txt"),
  ]);
  const searchHtml = await searchResponse.text();
  assert.match(searchHtml, /Brangus/);
  const noResultsHtml = await noResultsResponse.text();
  assert.match(noResultsHtml, /No encontramos productos/);
  const productHtml = await productResponse.text();
  assert.match(productHtml, /aria-current="page"/);
  assert.match(productHtml, /breadcrumb-list/);
  assert.equal(sitemapResponse.status, 200);
  const sitemapXml = await sitemapResponse.text();
  assert.match(sitemapXml, /<loc>.*\/producto\/playera-brangus<\/loc>/);
  assert.doesNotMatch(sitemapXml, /\/checkout|\/admin|\/colecciones/);
  assert.equal(robotsResponse.status, 200);
  assert.match(await robotsResponse.text(), /Disallow: \//i);
});

test("keeps commerce provisional and hosting metadata minimal", async () => {
  const [cart, hosting] = await Promise.all([
    readFile(new URL("../app/cart.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(cart, /fierro-cart-v3/);
  assert.match(cart, /CartLine/);
  assert.doesNotMatch(cart, /shopify|payment|credit.?card/i);
  const config = JSON.parse(hosting);
  assert.deepEqual(Object.keys(config).sort(), ["d1", "project_id", "r2"]);
  assert.equal(config.d1, "DB");
  assert.equal(config.r2, "UPLOADS");
});

test("implements direct and legacy personalized requests with private assets and admin review", async () => {
  const [customApi, linkApi, statusApi, assetApi, adminApi, adminUpdate, schema, component, adminComponent, telemetryApi] = await Promise.all([
    readFile(new URL("../app/api/personalizados/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/personalizados/vincular/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/personalizados/solicitud/[token]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/personalizados/archivo/[assetId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/personalizados/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/personalizados/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FierroSite.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPersonalizations.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/personalizados/telemetry/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(customApi, /15 \* 1024 \* 1024/);
  assert.match(customApi, /getCustomPricing/);
  assert.match(customApi, /requiresDesignFile/);
  assert.match(customApi, /Tipo de simulación/);
  assert.match(customApi, /directSubmit/);
  assert.match(customApi, /customerName/);
  assert.match(customApi, /customerPhone/);
  assert.match(customApi, /Idempotency-Key/);
  assert.match(customApi, /backgroundChoiceSelected/);
  assert.match(customApi, /'submitted'/);
  assert.match(customApi, /statusUrl/);
  assert.doesNotMatch(customApi, /isAllowedQuantity/);
  assert.match(customApi, /bucket\.put/);
  assert.match(linkApi, /linked_order_reference/);
  assert.match(statusApi, /pay_demo/);
  assert.match(assetApi, /private, no-store/);
  assert.match(adminApi + adminUpdate, /requireCustomizationAdmin/);
  assert.match(schema, /customizationRequests/);
  assert.match(schema, /customizationAssets/);
  assert.match(adminComponent, /getCustomPricing/);
  assert.match(telemetryApi, /customization_funnel_events/);
  assert.match(adminComponent, /Nueva solicitud/);
  assert.match(adminComponent, /Number\(unitPrice\) \* selected\.quantity/);
  assert.match(adminComponent, /Simulación con logo de ejemplo/);
  assert.doesNotMatch(adminComponent, /discountPercent|Total con descuento/);
  assert.match(component, /Catálogo a pagar ahora/);
  assert.match(component, /Envío en espera/);
});

test("keeps admin access configurable and hides internal API errors", async () => {
  const [adminSource, adminPage, errorSource, ...apiSources] = await Promise.all([
    readFile(new URL("../app/personalizados/admin.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/personalizados/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api-errors.ts", import.meta.url), "utf8"),
    ...[
      "../app/api/contacto/route.ts",
      "../app/api/personalizados/route.ts",
      "../app/api/personalizados/vincular/route.ts",
      "../app/api/personalizados/solicitud/[token]/route.ts",
      "../app/api/admin/personalizados/route.ts",
      "../app/api/admin/personalizados/[id]/route.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  ]);
  assert.match(adminSource, /FIERRO_ADMIN_EMAILS/);
  assert.match(adminSource, /DEFAULT_ADMIN_EMAILS/);
  assert.match(adminPage, /await isCustomizationAdmin/);
  assert.match(errorSource, /Response\.json\(\{ error: message \}, \{ status: 500 \}\)/);
  for (const source of apiSources) {
    assert.match(source, /apiServerError/);
    assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
  }
});
