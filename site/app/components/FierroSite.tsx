"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  activeProducts,
  brand,
  collections,
  confirmedCopy,
  faqs,
  getCatalogStatus,
  getProductVariants,
  navigation,
  products,
  statusLabels,
  type Product,
} from "../content";
import {
  CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  cartCount,
  cartReducer,
  cartSubtotal,
  createCartLine,
  initialCartState,
  isCustomLine,
  isPurchasable,
  parseStoredCart,
  type CartLine,
  type CartState,
} from "../cart";
import type { CustomCategory } from "../personalizados/pricing";

const CustomExperience = dynamic(() => import("./CustomExperience"));

type PageName =
  | "home"
  | "shop"
  | "product"
  | "about"
  | "contact"
  | "wholesale"
  | "faq"
  | "checkout"
  | "terms"
  | "privacy"
  | "shipping"
  | "custom-index"
  | "custom";

type CartContextValue = {
  cart: CartState;
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addLine: (line: CartLine) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart debe usarse dentro de CartProvider");
  return value;
}

function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCartState);
  const [isOpen, setIsOpen] = useState(false);
  const skipInitialPersist = useRef(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_CART_STORAGE_KEY);
    dispatch({ type: "hydrate", state: parseStoredCart(stored) });
    window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [isOpen]);

  const value = useMemo<CartContextValue>(() => ({
    cart,
    count: cartCount(cart),
    subtotal: cartSubtotal(cart),
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    addLine: (line) => dispatch({ type: "add", line }),
    updateQuantity: (key, quantity) => dispatch({ type: "quantity", key, quantity }),
    removeLine: (key) => dispatch({ type: "remove", key }),
    clearCart: () => dispatch({ type: "clear" }),
  }), [cart, isOpen]);

  return <CartContext.Provider value={value}>{children}<CartDrawer /></CartContext.Provider>;
}

function PhotoPlaceholder({
  label,
  tone = "sand",
  tall = false,
  missing = false,
}: {
  label: string;
  tone?: string;
  tall?: boolean;
  missing?: boolean;
}) {
  return (
    <div className={`photo-placeholder tone-${tone} ${tall ? "photo-tall" : ""} ${missing ? "photo-missing" : ""}`} role="img" aria-label={missing ? `Imagen no disponible: ${label}` : label}>
      <span className="landscape-lines" aria-hidden="true" />
      {missing && <span className="missing-icon" aria-hidden="true">×</span>}
      <span className="photo-label">{label}</span>
    </div>
  );
}

const collectionCardImages: Record<string, { src: string; alt: string }> = {
  "flora-del-desierto": {
    src: "/media/collections/flora-del-desierto.webp",
    alt: "Órgano del desierto sonorense frente a las montañas",
  },
  "ganado-sonorense": {
    src: "/media/collections/ganado-sonorense.webp",
    alt: "Ganado avanzando por un camino de rancho sonorense",
  },
  "rio-sonora": {
    src: "/media/collections/rio-sonora.webp",
    alt: "Camino de tierra junto al paisaje del Río Sonora",
  },
  "para-la-gente-de-trabajo": {
    src: "/media/collections/gente-de-trabajo.webp",
    alt: "Vaquero preparando la montura de su caballo",
  },
  "gorras-fierro": {
    src: "/media/collections/gorras-fierro.webp",
    alt: "Hombre usando una gorra FIERRO en el rancho",
  },
};

function CollectionCardPhoto({ collection }: { collection: (typeof collections)[number] }) {
  const image = collectionCardImages[collection.id];
  return (
    <figure className="collection-card-photo">
      <Image src={image.src} alt={image.alt} width="900" height="1125" sizes="(max-width: 540px) 78vw, (max-width: 1100px) 33vw, 20vw" unoptimized />
      <figcaption>{collection.photo}</figcaption>
    </figure>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { count, openCart } = useCart();
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  useEffect(() => {
    if (!searchOpen) return;
    searchInput.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSearchOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchOpen]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = searchTerm.trim();
    router.push(term ? `/tienda?q=${encodeURIComponent(term)}#catalogo` : "/tienda#catalogo");
    setSearchOpen(false);
  };
  return (
    <>
      <div className="announcement">{brand.announcement}</div>
      <header className="site-header">
        <button className="icon-button menu-button" type="button" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <Link className="brand-lockup" href="/" aria-label="FIERRO, inicio">
          <Image className="brand-logo header-logo" src="/brand/fierro-lockup-black.png" alt="FIERRO" width="2123" height="741" priority unoptimized />
        </Link>
        <nav className="desktop-nav" aria-label="Navegación principal">
          {navigation.map((item) => <Link key={item.label} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className="header-actions">
          <button className="icon-button" type="button" aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar productos"} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><span aria-hidden="true">⌕</span></button>
          <button className="icon-button cart-trigger" type="button" aria-label={`Carrito, ${count} artículo${count === 1 ? "" : "s"}`} onClick={openCart}><span aria-hidden="true">▢</span>{count > 0 && <span className="cart-count" aria-hidden="true">{count}</span>}</button>
        </div>
      </header>
      {searchOpen && (
        <div className="header-search-bar">
          <form className="header-search" role="search" onSubmit={submitSearch}>
            <input ref={searchInput} type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" />
            <button className="button primary" type="submit">Buscar</button>
          </form>
        </div>
      )}
      {open && <button className="mobile-nav-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
      <nav className={`mobile-nav ${open ? "is-open" : ""}`} aria-label="Navegación móvil" aria-hidden={!open}>
        <div className="mobile-nav-heading"><strong>Menú</strong><button className="icon-button" type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button></div>
        <Link href="/" onClick={() => setOpen(false)}>Inicio</Link>
        {navigation.map((item) => <Link key={item.label} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}
        <Link href="/contacto" onClick={() => setOpen(false)}>Contacto</Link>
      </nav>
    </>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="brand-lockup footer-brand"><Image className="brand-logo footer-logo" src="/brand/fierro-lockup-cream.png" alt="FIERRO" width="2135" height="736" unoptimized /></div>
          <p>{brand.statement}</p>
          <p className="small">Primera colección en camino. El carrito y el checkout aún no generan compras reales.</p>
        </div>
        <div className="footer-links"><strong>Explorar</strong><Link href="/tienda">Tienda</Link><Link href="/tienda?tipo=gorras">Gorras</Link><Link href="/tienda?tipo=playeras">Playeras</Link><Link href="/personalizados">Personalizados</Link><Link href="/nuestra-historia">Nuestra historia</Link></div>
        <div className="footer-links"><strong>Contacto</strong><Link href="/contacto">Contacto</Link><a href={brand.instagramUrl} target="_blank" rel="noreferrer">Instagram {brand.instagramLabel}</a><span className="footer-pending">WhatsApp · próximamente</span><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link></div>
        <div className="footer-links"><strong>Información</strong><Link href="/envios-cambios-y-devoluciones">Envíos, cambios y devoluciones</Link><Link href="/terminos">Términos de uso</Link><Link href="/privacidad">Aviso de privacidad</Link><Link href="/mayoreo">Mayoreo</Link></div>
      </div>
      <div className="footer-bottom"><span>© {year} FIERRO</span><span>Diseñado en Sonora.</span></div>
    </footer>
  );
}

function CartDrawer() {
  const { cart, count, subtotal, isOpen, closeCart, updateQuantity, removeLine } = useCart();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (isOpen) closeButton.current?.focus(); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="cart-layer">
      <button className="cart-backdrop" type="button" aria-label="Cerrar carrito" onClick={closeCart} />
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-header"><div><p className="eyebrow">Tu selección</p><h2 id="cart-title">Carrito <span className="small">({count})</span></h2></div><button ref={closeButton} className="icon-button" type="button" aria-label="Cerrar carrito" onClick={closeCart}>×</button></div>
        {cart.lines.length ? (
          <>
            <div className="cart-lines">
              {cart.lines.map((line) => (
                <article className={`cart-line ${isCustomLine(line) ? "is-custom" : ""}`} key={line.key}>
                  {line.image ? <Image src={line.image} alt={line.imageAlt} width="120" height="120" unoptimized /> : <div className="cart-line-placeholder" aria-hidden="true" />}
                  <div><Link href={isCustomLine(line) ? "/personalizados" : `/producto/${line.slug}`} onClick={closeCart}><strong>{line.name}</strong></Link><p className="small">{line.variantLabel}{!isCustomLine(line) && ` · ${line.size}`}</p><p className="small">{isCustomLine(line) ? `Solicitud ${line.customization.reference}` : `SKU ${line.sku}`}</p>{isCustomLine(line) ? <p className="cart-quantity-readonly">Cantidad solicitada: <strong>{line.quantity}</strong></p> : <label className="cart-quantity">Cantidad<select value={line.quantity} onChange={(event) => updateQuantity(line.key, Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}</select></label>}<button className="text-button small" type="button" onClick={() => removeLine(line.key)}>Eliminar</button></div>
                  <strong>{isCustomLine(line) ? "Por cotizar" : `$${(line.unitPrice * line.quantity).toLocaleString("es-MX")} MXN`}</strong>
                </article>
              ))}
            </div>
            <div className="cart-summary"><div><span>Catálogo a pagar ahora</span><strong>${subtotal.toLocaleString("es-MX")} MXN</strong></div><div><span>Personalizados</span><span>Por cotizar</span></div><div><span>Envío conjunto</span><span>Por calcular</span></div><p className="demo-note"><strong>Flujo de prueba:</strong> los artículos personalizados se ligan al mismo folio, pero se cobran después de aprobar la muestra.</p><Link className="button primary block" href="/checkout" onClick={closeCart}>Continuar al checkout</Link><button className="button secondary block" type="button" onClick={closeCart}>Seguir comprando</button></div>
          </>
        ) : (
          <div className="cart-empty"><span aria-hidden="true">▢</span><h3>Tu carrito está vacío</h3><p>Agrega productos de catálogo o prepara una pieza personalizada.</p><div className="button-row"><Link className="button primary" href="/tienda" onClick={closeCart}>Ver tienda</Link><Link className="button secondary" href="/personalizados" onClick={closeCart}>Personalizar</Link></div></div>
        )}
      </aside>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{text && <p>{text}</p>}</div>{action}</div>;
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isIn, setIsIn] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setIsIn(true); observer.disconnect(); } }, { threshold: 0.15, rootMargin: "0px 0px -80px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${isIn ? "is-in" : ""} ${className}`}>{children}</div>;
}

function Price({ product }: { product: Product }) {
  if (product.price === null) return <span>$— MXN<sup>*</sup></span>;
  return <span>${product.price.toLocaleString("es-MX")} MXN</span>;
}

function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const collection = collections.find((item) => item.id === product.collection);
  const primaryImage = getProductVariants(product)[0]?.image ?? product.images[0];
  const variants = getProductVariants(product);
  const isShirt = product.category === "playeras";
  const categoryLabel = product.category === "gorras" ? "Gorra" : product.category === "playeras" ? "Playera" : "Accesorio";
  return (
    <article className={`product-card ${isShirt ? "is-shirt" : ""}`}>
      <Link className="product-card-link" href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <span className="product-photo-wrap">
          {primaryImage?.src ? (
            <Image className="product-image" src={primaryImage.src} alt={primaryImage.alt} width={isShirt ? 1536 : 1254} height={isShirt ? 1024 : 1254} priority={priority} unoptimized sizes="(max-width: 540px) 100vw, (max-width: 900px) 50vw, 33vw" />
          ) : (
            <PhotoPlaceholder label={primaryImage?.alt ?? "Imagen pendiente"} tone={collection?.tone ?? "sand"} missing={!primaryImage} />
          )}
          <span className="badges">
            {product.newProduct && <span>Nuevo</span>}
            {product.bestseller && <span>Más vendido</span>}
            {["sold_out", "coming_soon", "made_to_order"].includes(product.inventoryStatus) && <span>{statusLabels[product.inventoryStatus]}</span>}
          </span>
        </span>
        <span className="product-card-body">
          <span className="product-card-meta">{categoryLabel} · {collection?.name ?? "FIERRO"}</span>
          <span className="product-title-row"><strong>{product.name}</strong><Price product={product} /></span>
          <span className="product-card-description">{product.shortDescription}</span>
          <span className="product-card-colors" aria-label={`${variants.length} variantes disponibles`}>
            {variants.slice(0, 3).map((variant) => <span key={variant.id}>{variant.color}</span>)}
            {variants.length > 3 && <span>+{variants.length - 3}</span>}
          </span>
          <span className="product-card-action">Ver producto →</span>
        </span>
      </Link>
    </article>
  );
}

const personalizadosTeaser = [
  { id: "cap", href: "/personalizados/gorras", kicker: "Bordado o parche", name: "Gorra personalizada", description: "Elige estilo, color, aplicación y ubicación.", options: "2 estilos · 3 colores · parche o bordado", image: "/media/personalizados/gorra-personalizada.webp", imageAlt: "Gorra arena y café con espacio frontal para personalizar" },
  { id: "cattle-tag", href: "/personalizados/aretes", kicker: "Rancho, número o logo", name: "Aretes ganaderos", description: "Identificadores visuales con número, nombre del rancho, logo o clave.", options: "6 diseños · numeración · código de barras", image: "/media/personalizados/arete-ganadero.webp", imageAlt: "Aretes ganaderos de identificación en amarillo, naranja y blanco" },
  { id: "pet-tag", href: "/personalizados/placas", kicker: "Nombre y teléfono", name: "Placa para mascota", description: "Placa de identificación con datos al frente y al reverso.", options: "3 formas · 3 acabados · grabado", image: "/media/personalizados/tags-mascotas.webp", imageAlt: "Placas redonda y en forma de hueso sobre collares de cuero" },
];

function HomePage() {
  const featured = activeProducts.filter((product) => product.featured).slice(0, 3);
  const lookbookPool = activeProducts.filter((product) => !featured.some((item) => item.id === product.id));
  const lookbook = [...lookbookPool.filter((product) => product.category === "playeras").slice(0, 4), ...lookbookPool.filter((product) => product.category === "gorras").slice(0, 2)];
  return (
    <>
      <section className="hero hero-ranch">
        <Image className="hero-image" src="/media/hero-rancho-sonora.png" alt="Remolque ganadero y camioneta en un camino de rancho sonorense al atardecer" width="1672" height="941" priority sizes="100vw" unoptimized />
        <span className="hero-shade" aria-hidden="true" />
        <Image className="hero-symbol hero-symbol-desktop" src="/brand/fierro-symbol-black.png" alt="" aria-hidden="true" width="1254" height="1254" unoptimized />
        <div className="hero-copy">
          <Image className="hero-symbol hero-symbol-mobile" src="/brand/fierro-symbol-black.png" alt="Símbolo FIERRO" width="1254" height="1254" unoptimized />
          <p className="eyebrow">FIERRO · SONORA</p>
          <h1>Hecho para la gente de trabajo.</h1>
          <p>Ropa inspirada en el rancho, el desierto y las raíces de Sonora.</p>
          <div className="button-row"><Link className="button primary" href="/tienda">Ver colección</Link><Link className="button light" href="/nuestra-historia">Conocer FIERRO</Link></div>
        </div>
      </section>

      <section className="trust-strip home-trust" aria-label="Por qué FIERRO">
        {[["01", "Diseño 100% original"], ["02", "Identidad sonorense"], ["03", "Atención directa por Instagram"], ["04", "Envíos próximamente a todo México"]].map(([number, text]) => <div key={number}><span>{number}</span><strong>{text}</strong></div>)}
      </section>

      <Reveal className="section home-collections">
        <SectionHeading eyebrow="Colecciones" title="Raíces que se llevan puestas" text="Cada familia visual parte de flora, animales, lugares y trabajo real del norte de México." />
        <div className="collection-grid five">
          {collections.map((collection) => (
            <article className="collection-card" key={collection.id}>
              <CollectionCardPhoto collection={collection} />
              <h3>{collection.name}</h3><p className="small">{collection.short}</p>
              <Link className="text-link" href={collection.id === "gorras-fierro" ? "/tienda?tipo=gorras" : "/tienda?tipo=playeras"}>Explorar →</Link>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal className="section section-sand home-featured">
        <SectionHeading eyebrow="Selección FIERRO" title="Productos destacados" action={<Link className="button secondary" href="/tienda">Ver toda la tienda</Link>} />
        <div className="product-grid three">{featured.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        <p className="small">Precios y disponibilidad mostrados únicamente para validar el recorrido de compra.</p>
      </Reveal>

      <Reveal className="section home-lookbook">
        <SectionHeading eyebrow="Galería" title="Diseños que cuentan una historia" text="Un vistazo más amplio a las gráficas que forman la primera colección FIERRO." />
        <div className="lookbook-grid">
          {lookbook.map((product) => {
            const image = getProductVariants(product)[0]?.image ?? product.images[0];
            return (
              <Link className="lookbook-tile" href={`/producto/${product.slug}`} key={product.id}>
                {image?.src && <Image src={image.src} alt={image.alt} width={900} height={900} sizes="(max-width: 540px) 50vw, (max-width: 1100px) 33vw, 20vw" unoptimized />}
                <span>{product.name}</span>
              </Link>
            );
          })}
        </div>
      </Reveal>

      <Reveal className="statement-section">
        <figure className="statement-photo">
          <Image
            src="/media/nuestra-raiz-ganado.webp"
            alt="Jinete guiando ganado por un rancho sonorense"
            width="1402"
            height="789"
            sizes="(max-width: 800px) 100vw, 50vw"
            unoptimized
          />
          <figcaption>Jornada en rancho sonorense</figcaption>
        </figure>
        <div><p className="eyebrow">Nuestra raíz</p><h2>Del trabajo, la tierra y las costumbres del norte.</h2><p>FIERRO nace inspirado en la vida real de rancho en Sonora. Diseñamos productos accesibles para quienes viven, trabajan o se identifican con esa cultura.</p><Link className="button light" href="/nuestra-historia">Leer nuestra historia</Link></div>
      </Reveal>

      <Reveal className="section values-grid">
        {[["Diseño honesto", "Información clara y sin promesas no comprobadas."], ["Identidad cercana", "Una marca pensada desde la vida cotidiana del norte."], ["Inspirado en Sonora", "Referencias locales tratadas con respeto y contexto."], ["Producto en desarrollo", "Materiales y especificaciones se publicarán antes de cada lanzamiento."]].map(([value, copy], index) => <article className="value-card" key={value}><span>0{index + 1}</span><h3>{value}</h3><p className="small">{copy}</p></article>)}
      </Reveal>

      <Reveal className="section editorial-grid"><figure className="editorial-photo"><Image src="/media/historia-caballo-organos.webp" alt="Cabalgata entre órganos del desierto sonorense" width="1536" height="1024" sizes="(max-width: 800px) 100vw, 58vw" unoptimized /><figcaption><strong>Próxima historia</strong> · El órgano del monte</figcaption></figure><div><p className="eyebrow">Historias detrás del diseño</p><h2>Una silueta que pertenece al paisaje.</h2><p>Estamos preparando historias sobre la flora, el trabajo y los paisajes que inspiran a FIERRO.</p><a className="button secondary" href={brand.instagramUrl} target="_blank" rel="noreferrer">Seguir el proceso en Instagram</a></div></Reveal>

      <Reveal className="section home-personalizados">
        <SectionHeading eyebrow="Hazlo tuyo" title="Personaliza tu pieza FIERRO" text="Gorras, aretes ganaderos y placas para mascota, cotizados a tu medida antes de producir." action={<Link className="button light" href="/personalizados">Empezar a personalizar</Link>} />
        <div className="home-personalizados-grid">
          {personalizadosTeaser.map((item) => (
            <Link className="home-personalizados-card" href={item.href} key={item.id}>
              <Image src={item.image} alt={item.imageAlt} width={1122} height={1402} sizes="(max-width: 800px) 100vw, 33vw" unoptimized />
              <span><strong>{item.name}</strong><small>{item.description}</small><b>Personalizar →</b></span>
            </Link>
          ))}
        </div>
      </Reveal>

      <section className="signup-section">
        <div className="signup-photo" aria-hidden="true"><Image src="/media/collections/rio-sonora.webp" alt="" width={1200} height={800} sizes="100vw" unoptimized /></div>
        <div><h2>Sigue el lanzamiento.</h2><p>Conoce nuevas gorras, el avance de las playeras y las historias detrás de FIERRO.</p></div>
        <a className="button light" href={brand.instagramUrl} target="_blank" rel="noreferrer">Instagram {brand.instagramLabel}</a>
      </section>
      <section className="final-cta"><p className="eyebrow">FIERRO</p><h2>Del monte, para todos.</h2><Link className="button primary" href="/tienda">Explorar FIERRO</Link></section>
    </>
  );
}

function ShopPage({ initialCategory = "all", initialQuery = "", initialCollection = "all" }: { initialCategory?: string; initialQuery?: string; initialCollection?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState(initialCategory === "gorras" || initialCategory === "playeras" ? initialCategory : "all");
  const [category, setCategory] = useState("all");
  const [collection, setCollection] = useState(initialCollection);
  const [color, setColor] = useState("all");
  const [size, setSize] = useState("all");
  const [stockOnly, setStockOnly] = useState(false);
  const [sort, setSort] = useState("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [filtersOpen]);
  const colors = useMemo(() => Array.from(new Set(activeProducts.flatMap((product) => getProductVariants(product).map((variant) => variant.color)))).sort(), []);
  const sizes = useMemo(() => Array.from(new Set(activeProducts.flatMap((product) => product.availableSizes))).sort(), []);
  const filtered = useMemo(() => activeProducts.filter((product) => {
    const matchesQuery = !query || product.name.toLowerCase().includes(query.toLowerCase()) || product.shortDescription.toLowerCase().includes(query.toLowerCase());
    const matchesTab = tab === "all" || (tab === "new" ? product.newProduct : tab === "bestseller" ? product.bestseller : product.category === tab);
    const matchesCategory = category === "all" || product.category === category;
    const matchesCollection = collection === "all" || product.collection === collection;
    const matchesColor = color === "all" || getProductVariants(product).some((variant) => variant.color === color);
    const matchesSize = size === "all" || product.availableSizes.includes(size);
    const matchesStock = !stockOnly || ["in_stock", "low_stock"].includes(product.inventoryStatus);
    return matchesQuery && matchesTab && matchesCategory && matchesCollection && matchesColor && matchesSize && matchesStock;
  }), [query, tab, category, collection, color, size, stockOnly]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === "price-asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (sort === "price-desc") return (b.price ?? -Infinity) - (a.price ?? -Infinity);
    if (sort === "name") return a.name.localeCompare(b.name, "es");
    if (sort === "newest") return Number(b.newProduct) - Number(a.newProduct);
    return Number(b.featured) - Number(a.featured);
  }), [filtered, sort]);
  const activeFilterCount = [query, category !== "all", collection !== "all", color !== "all", size !== "all", stockOnly].filter(Boolean).length;
  const reset = () => { setQuery(""); setTab("all"); setCategory("all"); setCollection("all"); setColor("all"); setSize("all"); setStockOnly(false); };
  const tabs = [["all", "Todos"], ["gorras", "Gorras"], ["playeras", "Playeras"], ["new", "Nuevos"], ["bestseller", "Más vendidos"]];
  return (
    <>
      <section className="shop-hero" aria-labelledby="shop-hero-title">
        <div className="shop-hero-copy"><p className="eyebrow">Colección FIERRO</p><h1 id="shop-hero-title">Hecho para el rancho.<br />Diseñado para todos los días.</h1><p>Gorras, playeras y accesorios inspirados en Sonora, el ganado y la vida de campo.</p><div className="button-row"><button className="button primary" type="button" onClick={() => { setTab("gorras"); document.getElementById("catalogo")?.scrollIntoView(); }}>Ver gorras</button><button className="button secondary" type="button" onClick={() => { setTab("playeras"); document.getElementById("catalogo")?.scrollIntoView(); }}>Ver playeras</button></div><span className="shop-hero-note">Diseños originales con raíz sonorense.</span></div>
        <div className="shop-hero-mark" aria-hidden="true"><Image src="/brand/fierro-symbol-black.png" alt="" width="1254" height="1254" unoptimized /><span>SONORA · MÉXICO</span></div>
      </section>

      <section className="section catalog-section" id="catalogo">
        <div className="catalog-heading"><div><p className="eyebrow">Primera colección</p><h2>Tienda</h2><p className="catalog-count" aria-live="polite">{sorted.length} producto{sorted.length === 1 ? "" : "s"}</p></div><div className="catalog-tabs" role="group" aria-label="Vista del catálogo">{tabs.map(([value, label]) => <button className={tab === value ? "active" : ""} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} key={value}>{label}</button>)}</div></div>
        <div className="catalog-toolbar">
          <button className="button secondary filters-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filtros{activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}</button>
          <label><span>Ordenar por</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Destacados</option><option value="newest">Más recientes</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="name">Nombre</option></select></label>
        </div>
        {filtersOpen && <button className="filters-backdrop" type="button" aria-label="Cerrar filtros" onClick={() => setFiltersOpen(false)} />}
        <aside className={`filters ${filtersOpen ? "is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="filters-title" aria-hidden={!filtersOpen}>
          <div className="filters-header"><div><p className="eyebrow">Refinar resultados</p><h2 id="filters-title">Filtros</h2></div><button className="icon-button" type="button" aria-label="Cerrar filtros" onClick={() => setFiltersOpen(false)}>×</button></div>
          <div className="filters-body">
            <label>Buscar<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre del producto" /></label>
            <label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas</option><option value="gorras">Gorras</option><option value="playeras">Playeras</option></select></label>
            <label>Colección<select value={collection} onChange={(event) => setCollection(event.target.value)}><option value="all">Todas</option>{collections.filter((item) => activeProducts.some((product) => product.collection === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Color<select value={color} onChange={(event) => setColor(event.target.value)}><option value="all">Todos</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Talla<select value={size} onChange={(event) => setSize(event.target.value)}><option value="all">Todas</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="checkbox"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} /> Mostrar únicamente disponibles</label>
          </div>
          <div className="filters-actions"><button className="button primary" type="button" onClick={() => setFiltersOpen(false)}>Aplicar filtros · {sorted.length}</button><button className="text-button" type="button" onClick={reset}>Limpiar filtros</button></div>
        </aside>
        <div className="catalog-results">{sorted.length ? <div className="product-grid three">{sorted.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 3} />)}</div> : <div className="empty-state"><span aria-hidden="true">⌕</span><h2>No encontramos productos</h2><p>Prueba otra categoría o limpia los filtros activos.</p><button className="button primary" type="button" onClick={reset}>Ver todo el catálogo</button></div>}</div>
      </section>

      <section className="section category-section"><SectionHeading eyebrow="Explora por categoría" title="Encuentra tu FIERRO" text="Tres caminos para conocer la primera colección y lo que estamos preparando." /><div className="category-access-grid">
        <Link className="category-access" href="/tienda?tipo=gorras"><Image src="/media/products/gorras/gorra-bronco.png" alt="Gorra FIERRO color arena y café" width="1254" height="1254" sizes="(max-width: 800px) 50vw, 33vw" unoptimized /><span><strong>Gorras</strong><small>Diseños limpios para todos los días.</small><b>Explorar →</b></span></Link>
        <Link className="category-access" href="/tienda?tipo=playeras"><Image src="/media/products/playeras/brangus/olivo.webp" alt="Playera Brangus color olivo" width="1536" height="1024" sizes="(max-width: 800px) 50vw, 33vw" unoptimized /><span><strong>Playeras</strong><small>Gráficas originales con raíz del norte.</small><b>Explorar →</b></span></Link>
        <Link className="category-access category-access-custom" href="/personalizados"><Image src="/brand/fierro-symbol-black.png" alt="Símbolo FIERRO" width="1254" height="1254" sizes="(max-width: 800px) 100vw, 33vw" unoptimized /><span><strong>Personalizados</strong><small>Una línea especial todavía en preparación.</small><b>Conocer →</b></span></Link>
      </div></section>

      <section className="trust-strip" aria-label="Beneficios de FIERRO">{[["01", "Diseños originales"], ["02", "Identidad sonorense"], ["03", "Atención directa"], ["04", "Próximamente envíos a todo México"]].map(([number, text]) => <div key={number}><span>{number}</span><strong>{text}</strong></div>)}</section>
      <section className="launch-section"><div><p className="eyebrow">Próximamente</p><h2>Primera colección en camino.</h2><p>Explora nuestros primeros diseños. Sigue el avance y entérate cuando las compras estén disponibles.</p></div><a className="button light" href={brand.instagramUrl} target="_blank" rel="noreferrer">Seguir el lanzamiento</a></section>
    </>
  );
}

function ProductNotFound() {
  return <section className="section checkout-empty"><p className="eyebrow">Catálogo actualizado</p><h1>Este producto ya no está disponible.</h1><p>Consulta las playeras y gorras que forman parte del catálogo actual de FIERRO.</p><Link className="button primary" href="/tienda">Ver catálogo</Link></section>;
}

function ProductPage({ slug }: { slug: string }) {
  const product = products.find((item) => item.slug === slug);
  if (!product || getCatalogStatus(product) !== "active") return <ProductNotFound />;
  return <ActiveProductPage product={product} />;
}

function ActiveProductPage({ product }: { product: Product }) {
  const collection = collections.find((item) => item.id === product.collection);
  const variants = getProductVariants(product);
  const isShirt = product.category === "playeras";
  const [variantId, setVariantId] = useState(variants[0].id);
  const [showFullMockup, setShowFullMockup] = useState(false);
  const [size, setSize] = useState(product.availableSizes.length === 1 ? product.availableSizes[0] : "");
  const [quantity, setQuantity] = useState(1);
  const [cartMessage, setCartMessage] = useState("Agregar al carrito");
  const { addLine, openCart } = useCart();
  const selectedVariant = variants.find((variant) => variant.id === variantId) ?? variants[0];
  const primaryImage = selectedVariant.image;
  const purchasable = isPurchasable(product);
  const related = activeProducts.filter((item) => product.relatedProducts.includes(item.id));
  return (
    <>
      <section className="section product-page">
        <nav className="breadcrumb" aria-label="Ruta de navegación">
          <ol className="breadcrumb-list">
            <li><Link href="/">Inicio</Link></li>
            <li><Link href="/tienda">Tienda</Link></li>
            <li>{collection ? <Link href={`/tienda?coleccion=${collection.id}#catalogo`}>{collection.name}</Link> : "Colección"}</li>
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>
        <div className={`product-detail ${product.mediaLayout === "wide" ? "is-wide" : ""}`}>
          <div className={`gallery ${isShirt ? "is-wide" : ""} ${isShirt && !showFullMockup ? "is-zoomed" : ""}`}>
            <div className="gallery-stage">{primaryImage?.src ? <Image className={`product-detail-image ${isShirt ? "is-wide" : ""}`} src={primaryImage.src} alt={primaryImage.alt} width={isShirt ? 1536 : 1254} height={isShirt ? 1024 : 1254} sizes="(max-width: 800px) 100vw, 60vw" priority unoptimized /> : <PhotoPlaceholder label={primaryImage?.alt ?? "Imagen pendiente"} tone="sand" tall missing={!primaryImage} />}</div>
            {isShirt && <div className="gallery-view-toggle" role="group" aria-label="Vista de la playera"><button className={!showFullMockup ? "active" : ""} type="button" aria-pressed={!showFullMockup} onClick={() => setShowFullMockup(false)}>Diseño de espalda</button><button className={showFullMockup ? "active" : ""} type="button" aria-pressed={showFullMockup} onClick={() => setShowFullMockup(true)}>Mockup completo</button></div>}
          </div>
          <div className="product-info"><div><p className="eyebrow">{collection?.name ?? "FIERRO"}</p><h1>{product.name}</h1><p><Price product={product} /></p></div><p>{confirmedCopy(product.fullDescription, product.shortDescription)}</p>
            <fieldset><legend>{product.category === "playeras" ? "Variante" : "Color"}: <strong>{selectedVariant.label}</strong></legend><div className="choice-row">{variants.map((variant) => <button className={variantId === variant.id ? "choice active" : "choice"} type="button" aria-pressed={variantId === variant.id} onClick={() => { setVariantId(variant.id); setCartMessage("Agregar al carrito"); }} key={variant.id}>{variant.label}</button>)}</div></fieldset>
            <fieldset><div className="legend-row"><legend>Talla: <strong>{size || "Selecciona"}</strong></legend>{product.category === "playeras" && <span className="small">Guía de tallas próximamente</span>}</div><div className="choice-row">{product.availableSizes.map((item) => <button className={size === item ? "choice active" : "choice"} type="button" aria-pressed={size === item} onClick={() => { setSize(item); setCartMessage("Agregar al carrito"); }} key={item}>{item}</button>)}</div></fieldset>
            <label>Cantidad<select className="quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}</select></label>
            <div className="notice"><strong>{statusLabels[product.inventoryStatus]}</strong><span>{confirmedCopy(product.productionTime, "El tiempo de preparación se confirmará antes del lanzamiento comercial.")}</span></div>
            <p className="demo-note"><strong>Modo de prueba:</strong> precio, variantes, tallas e inventario no representan una oferta ni una existencia real.</p>
            <button className="button primary block" type="button" disabled={!purchasable} onClick={() => { if (!size) { setCartMessage("Selecciona una talla"); return; } addLine(createCartLine(product, selectedVariant, size, quantity)); setCartMessage("Agregado al carrito"); openCart(); }}>{purchasable ? cartMessage : product.inventoryStatus === "sold_out" ? "Producto agotado" : "Disponible próximamente"}</button>
            <a className="button secondary block" href={brand.instagramUrl} target="_blank" rel="noreferrer">Preguntar por Instagram</a>
            <div className="accordions"><details><summary>Envío y preparación</summary><p>El sitio todavía no procesa pedidos. La cobertura, costos y plazos se publicarán antes de habilitar ventas.</p></details><details><summary>Materiales</summary><p>{confirmedCopy(product.materials, "La composición verificada se publicará antes del lanzamiento comercial.")}</p></details><details><summary>Cuidados</summary><p>{confirmedCopy(product.careInstructions, "Las instrucciones verificadas se publicarán antes del lanzamiento comercial.")}</p></details></div>
          </div>
        </div>
      </section>
      {related.length > 0 && <section className="section section-sand"><SectionHeading eyebrow="También puede gustarte" title="Productos relacionados" /><div className="product-grid three">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
    </>
  );
}

function AboutPage() {
  return <section className="section"><div className="story-layout"><aside className="story-nav"><a className="active" href="#historia">Nuestra historia</a><a href="#porque">Por qué FIERRO</a><a href="#inspiracion">Inspiración sonorense</a><a href="#produccion">Diseño y producción</a><a href="#valores">Valores</a></aside><div className="story-content"><div id="historia"><p className="eyebrow">Nuestra historia</p><h1>Una marca cercana a la tierra que la inspira.</h1><p>FIERRO nace desde la experiencia y observación de la vida de rancho en Sonora: el ganado, la agricultura, el paisaje y las personas que sostienen ese trabajo.</p></div><PhotoPlaceholder label="Paisaje de rancho" tone="leather" tall /><div className="two-column"><div id="porque"><h2>Por qué FIERRO</h2><p>Una palabra fuerte y cotidiana, reinterpretada desde el campo y la identidad sonorense; no desde la industria ni desde el lujo.</p></div><div id="inspiracion"><h2>Inspiración sonorense</h2><p>Las referencias se documentan con nombres, lugares y contexto local. La cultura no funciona como decoración.</p></div></div><PhotoPlaceholder label="Diseño y producción en desarrollo" tone="mesquite" tall /><div id="produccion"><h2>Diseño y producción</h2><p>Publicaremos procesos, proveedores y origen de materiales cuando estén confirmados. Preferimos esperar a contar con información verificable antes de hacer promesas sobre cada producto.</p></div></div></div></section>;
}

function ContactPage() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contacto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          message: String(form.get("message") ?? ""),
          company: String(form.get("company") ?? ""),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No fue posible enviar tu mensaje.");
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No fue posible enviar tu mensaje.");
    } finally {
      setSending(false);
    }
  };
  return <section className="section"><div className="contact-layout">
    <div className="contact-note"><p className="eyebrow">Contacto</p><h2>También en Instagram.</h2><p>Respondemos por correo a partir de tu mensaje. Para algo urgente, también puedes escribirnos por Instagram.</p><div className="quick-actions"><a className="button secondary" href={brand.instagramUrl} target="_blank" rel="noreferrer">Abrir Instagram {brand.instagramLabel}</a><Link className="button secondary" href="/mayoreo">Información de mayoreo</Link></div><Link className="text-link" href="/privacidad">Consultar aviso de privacidad →</Link></div>
    <div><p className="eyebrow">Escríbenos</p><h1>Cuéntanos qué necesitas.</h1><p>Completa el formulario y te respondemos lo antes posible.</p>
      {sent ? (
        <p className="form-message success">Recibimos tu mensaje. Te responderemos pronto por correo.</p>
      ) : (
        <form className="contact-form" onSubmit={submit}>
          <label>Nombre<input type="text" name="name" required maxLength={120} /></label>
          <label>Correo<input type="email" name="email" required maxLength={160} /></label>
          <label className="full">Teléfono (opcional)<input type="tel" name="phone" maxLength={40} /></label>
          <label className="full">Mensaje<textarea name="message" required maxLength={2000} rows={5} /></label>
          <label className="sr-only" aria-hidden="true">No llenar este campo<input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
          {error && <p className="form-message full">{error}</p>}
          <button className="button primary full" type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar mensaje"}</button>
        </form>
      )}
    </div>
  </div></section>;
}

function WholesalePage() {
  return <><section className="wholesale-hero"><div className="hero-copy"><p className="eyebrow">Producción personalizada · En prueba</p><h1>Cuéntanos cuántas piezas necesitas.</h1><p>Preparamos gorras, aretes ganaderos y placas por pieza o por lote. La cantidad orienta la producción; el precio se confirma después de revisar materiales, técnica y archivo.</p><div className="button-row"><Link className="button primary" href="/personalizados">Preparar mi solicitud</Link></div></div><div className="wholesale-product-photo"><Image src="/media/personalizados/gorra-personalizada.webp" alt="Gorra personalizada FIERRO en tonos arena y café" width="1122" height="1402" unoptimized /></div></section><section className="section"><div className="three-column"><div><h2>Gorras</h2><p>Solicita desde una pieza. Elige estilo, color, parche de cuero o bordado directo y la ubicación de tu diseño.</p></div><div><h2>Aretes ganaderos</h2><p>Define formato, color y distribución: sólo número, nombre del rancho, logo o código de barras, entre otras combinaciones.</p></div><div><h2>Placas para mascota</h2><p>Cada placa se configura con forma, acabado, tamaño, nombre y teléfono para grabado individual.</p></div></div><div className="notice"><strong>Puedes escribir cualquier cantidad entre 1 y 5,000 piezas.</strong><span>Los atajos del configurador sólo ayudan a elegir tamaños comunes de lote.</span><span>FIERRO confirmará precio y plazo después de validar la viabilidad del diseño.</span></div></section></>;
}

function CustomLandingPage() {
  return <div className="custom-landing">
    <section className="custom-landing-hero">
      <div className="custom-landing-intro">
        <p className="eyebrow">Personalizados FIERRO</p>
        <h1>Elige la pieza.<br />Hazla tuya.</h1>
        <p className="custom-landing-lead">Crea una pieza con el nombre de tu rancho, tu numeración o tu identidad. Te guiamos paso a paso y revisamos cada solicitud antes de producir.</p>
        <div className="button-row"><a className="button primary" href="#objetos">Elegir objeto</a><span className="custom-landing-help">Sin pago · Cotización después de revisar</span></div>
        <dl className="custom-landing-facts">
          <div><dt>03</dt><dd>Objetos disponibles</dd></div>
          <div><dt>03</dt><dd>Pasos para solicitar</dd></div>
          <div><dt>01</dt><dd>Revisión personal</dd></div>
        </dl>
      </div>
      <div className="custom-landing-collage" aria-label="Ejemplos de objetos personalizables">
        <figure className="is-primary"><Image src="/media/personalizados/arete-ganadero.webp" alt="Aretes ganaderos personalizables" width={1122} height={1402} priority sizes="(max-width: 800px) 72vw, 34vw" unoptimized /><figcaption>Identidad para el rancho</figcaption></figure>
        <figure><Image src="/media/personalizados/gorra-personalizada.webp" alt="Gorra personalizable" width={1122} height={1402} sizes="(max-width: 800px) 44vw, 18vw" unoptimized /><figcaption>Tu marca, bien puesta</figcaption></figure>
        <figure><Image src="/media/personalizados/tags-mascotas.webp" alt="Placas personalizables para mascota" width={1122} height={1402} sizes="(max-width: 800px) 44vw, 18vw" unoptimized /><figcaption>Datos que acompañan</figcaption></figure>
      </div>
    </section>

    <section className="section custom-landing-objects" id="objetos">
      <SectionHeading eyebrow="Elige tu objeto" title="¿Qué quieres personalizar?" text="Cada objeto abre un configurador simple con sólo las decisiones necesarias." />
      <div className="custom-landing-grid">
        {personalizadosTeaser.map((item, index) => <Link className="custom-landing-card" href={item.href} key={item.id}>
          <span className="custom-landing-card-image"><Image src={item.image} alt={item.imageAlt} width={1122} height={1402} sizes="(max-width: 760px) 100vw, 33vw" unoptimized /><i>0{index + 1}</i></span>
          <span className="custom-landing-card-copy"><small>{item.kicker}</small><strong>{item.name}</strong><span>{item.description}</span><em>{item.options}</em><b>Personalizar <i aria-hidden="true">→</i></b></span>
        </Link>)}
      </div>
    </section>

    <section className="custom-landing-process">
      <div><p className="eyebrow">Así de fácil</p><h2>De tu idea a una solicitud clara.</h2></div>
      <ol>
        <li><span>01</span><div><strong>Elige el objeto</strong><p>Abre el configurador de la pieza que necesitas.</p></div></li>
        <li><span>02</span><div><strong>Agrega características</strong><p>Define colores, datos, cantidades y archivos.</p></div></li>
        <li><span>03</span><div><strong>Envía tu solicitud</strong><p>Recibe un folio para consultar su revisión.</p></div></li>
      </ol>
    </section>

    <section className="section custom-landing-file-note">
      <Image src="/brand/fierro-symbol-black.png" alt="" aria-hidden="true" width={1254} height={1254} unoptimized />
      <div><p className="eyebrow">Tu logo está protegido</p><h2>El archivo original siempre viaja por separado.</h2><p>La vista previa usa logos ficticios y sirve únicamente para entender la distribución. Tu logo no se aplica automáticamente al producto: FIERRO lo revisa antes de preparar la cotización.</p></div>
      <Link className="button secondary" href="/personalizados/aretes">Probar con un arete</Link>
    </section>
  </div>;
}

function CustomPage({ category }: { category: CustomCategory }) {
  return <CustomExperience category={category} />;
}

function FaqPage() {
  return <section className="section faq-page"><div className="page-heading"><p className="eyebrow">Ayuda</p><h1>Preguntas frecuentes</h1><p>Información vigente para el sitio de prelanzamiento.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>;
}

function TermsPage() {
  return <article className="section legal-page"><header><p className="eyebrow">Información legal de prelanzamiento</p><h1>Términos de uso</h1><p className="small">Última actualización: 18 de julio de 2026</p><p>Estos términos regulan el uso del sitio privado FIERRO y de su recorrido de personalización en etapa de prueba.</p></header><section><h2>1. Responsable y alcance</h2><p>FIERRO es el nombre comercial provisional del proyecto. Su identidad fiscal, domicilio y medios formales de atención se publicarán antes de iniciar operaciones comerciales. El canal público confirmado durante esta etapa es <a href={brand.instagramUrl} target="_blank" rel="noreferrer">Instagram {brand.instagramLabel}</a>.</p></section><section><h2>2. Comercio en modo de prueba</h2><p>El catálogo, carrito, checkout y botones de pago sirven para evaluar el recorrido. No existe una pasarela conectada, no se cobran cantidades, no se reserva mercancía y no se celebra una compraventa real.</p></section><section><h2>3. Solicitudes personalizadas</h2><p>El configurador sí puede guardar de forma privada la configuración, el contacto y los archivos enviados para preparar una muestra de prueba. Enviar una solicitud no fija precio, materiales, viabilidad ni tiempo de producción. La cotización aparece únicamente después de la revisión de FIERRO.</p></section><section><h2>4. Flujo combinado y envío</h2><p>El sitio demuestra un primer pago para artículos de catálogo y un segundo pago para la personalización aprobada. Ambos se ligan a un mismo folio y el envío aparece retenido para salir junto. Mientras el sitio siga en prelanzamiento, esos pagos y el envío son simulados.</p></section><section><h2>5. Archivos y derechos del usuario</h2><p>Quien sube un diseño declara que cuenta con autorización para utilizarlo. No deben enviarse contenidos ilícitos, engañosos, discriminatorios ni que infrinjan derechos de terceros. FIERRO puede rechazar una solicitud que no sea viable o que presente riesgos de propiedad intelectual.</p></section><section><h2>6. Muestras y aprobación</h2><p>La aprobación indica conformidad con la muestra visible, no una compra durante esta etapa. Solicitar cambios devuelve la pieza a revisión. Una vez conectado el comercio real, se publicarán límites de revisiones, anticipos, cancelaciones y tolerancias de producción antes de cobrar.</p></section><section><h2>7. Propiedad intelectual de FIERRO</h2><p>La marca FIERRO, sus logotipos, fotografías, textos y diseños pertenecen a sus titulares. La carga de un archivo no concede derechos sobre materiales propios de FIERRO ni permite reutilizar muestras para otros fines.</p></section><section><h2>8. Cambios, legislación y contacto</h2><p>Estos términos pueden actualizarse conforme avance el proyecto y se interpretarán conforme a la legislación mexicana aplicable. Las dudas generales pueden dirigirse por <a href={brand.instagramUrl} target="_blank" rel="noreferrer">Instagram {brand.instagramLabel}</a>. No envíes contraseñas ni datos bancarios.</p></section></article>;
}

function PrivacyPage() {
  return <article className="section legal-page"><header><p className="eyebrow">Información legal de prelanzamiento</p><h1>Aviso de privacidad</h1><p className="small">Última actualización: 18 de julio de 2026</p><p>Este aviso explica los datos utilizados por el sitio privado FIERRO, incluido el nuevo recorrido de artículos personalizados.</p></header><section><h2>1. Responsable</h2><p>El proyecto identificado provisionalmente como FIERRO es responsable de las funciones de este sitio. La identidad legal, domicilio y correo formal para ejercer derechos se publicarán antes de abrir el servicio comercial al público.</p></section><section><h2>2. Datos que se reciben</h2><p>Cuando vinculas una personalización se guardan nombre, teléfono, correo, domicilio de entrega, configuración, cantidad, comentarios, archivos enviados, muestras, decisiones de aprobación y folios relacionados. No se solicitan ni almacenan números de tarjeta, contraseñas bancarias o documentos oficiales.</p></section><section><h2>3. Finalidades</h2><p>Los datos se utilizan para resguardar el diseño, preparar y cotizar una muestra, comunicar el seguimiento por WhatsApp, registrar cambios o aprobación y demostrar cómo se uniría la personalización al envío de catálogo. No se utilizan para publicidad ni perfiles comerciales durante esta etapa.</p></section><section><h2>4. Carrito y detección de fondo</h2><p>El carrito se conserva en el almacenamiento local del navegador. La revisión automática de un posible fondo blanco ocurre en el dispositivo y solo genera una advertencia; el sitio no modifica el archivo original.</p></section><section><h2>5. Resguardo y acceso</h2><p>Los registros estructurados se guardan en almacenamiento privado y los archivos en un depósito no público. Solo la cuenta administradora autorizada y quien posea el enlace largo de seguimiento pueden acceder a una solicitud. Los archivos SVG y PDF se descargan en lugar de ejecutarse dentro del sitio.</p></section><section><h2>6. Conservación y eliminación</h2><p>Las solicitudes abiertas se conservan mientras continúa la revisión. Las cerradas y sus archivos están previstas para eliminación después de 90 días. Durante la prueba privada puedes solicitar eliminación anticipada mediante <a href={brand.instagramUrl} target="_blank" rel="noreferrer">Instagram {brand.instagramLabel}</a>, indicando únicamente el folio.</p></section><section><h2>7. Proveedores y comunicación</h2><p>Sites proporciona alojamiento, acceso y almacenamiento. WhatsApp solo se abre cuando FIERRO decide enviar manualmente un mensaje; el sitio no envía mensajes automáticos ni comparte los archivos directamente con WhatsApp.</p></section><section><h2>8. Seguridad y actualizaciones</h2><p>Se aplican límites de tamaño, validación de formatos, controles de acceso y enlaces difíciles de adivinar. Ningún sistema es infalible; antes del lanzamiento público este aviso se actualizará con la identidad completa del responsable y el medio formal para ejercer acceso, rectificación, cancelación u oposición.</p></section></article>;
}

function ShippingPage() {
  return <article className="section legal-page"><header><p className="eyebrow">Política de prelanzamiento</p><h1>Envíos, cambios y devoluciones</h1><p className="small">Última actualización: 18 de julio de 2026</p><p>FIERRO todavía no acepta compras reales. Esta página explica cómo se validará el futuro envío combinado.</p></header><section><h2>Pedidos y pagos</h2><p>El checkout y los dos pagos son demostrativos: no cobran, no reservan inventario y no emiten comprobantes. Los folios permiten probar la relación entre catálogo y personalización.</p></section><section><h2>Envío conjunto</h2><p>Cuando un pedido contiene catálogo y una pieza personalizada, el catálogo aparece pagado primero y el envío queda retenido. Después de aprobar y pagar la personalización, ambos conceptos conservan el mismo folio. El paquete solo se libera cuando todas las piezas estén listas.</p></section><section><h2>Tiempo de preparación</h2><p>El plazo del envío completo será el de la pieza que tarde más en quedar lista. Ningún plazo mostrado durante la prueba constituye una promesa comercial.</p></section><section><h2>Cambios en personalizados</h2><p>Antes de producción, el cliente puede aprobar la muestra o solicitar correcciones. Los límites de revisiones, cancelación y tolerancias físicas se publicarán antes de activar pagos reales. Una pieza producida conforme a una muestra aprobada podrá tener reglas distintas a las del catálogo, respetando los derechos aplicables.</p></section><section><h2>Daños, errores y devoluciones</h2><p>El procedimiento de reporte, evidencias, reposición o reembolso todavía no está definido. Se publicará junto con costos, cobertura, paqueterías y plazos definitivos.</p></section><section><h2>Actualizaciones</h2><p>Esta política será reemplazada antes del lanzamiento comercial. Las novedades se comunicarán en <a href={brand.instagramUrl} target="_blank" rel="noreferrer">Instagram {brand.instagramLabel}</a>.</p></section></article>;
}

function CheckoutPage() {
  const { cart, subtotal, clearCart } = useCart();
  const [confirmation, setConfirmation] = useState<{ reference: string; statusLinks: { reference: string; url: string }[]; catalogTotal: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const customLines = cart.lines.filter(isCustomLine);
  const standardLines = cart.lines.filter((line) => !isCustomLine(line));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const orderReference = `FIE-DEMO-${Date.now().toString().slice(-6)}`;
    const form = new FormData(event.currentTarget);
    try {
      let statusLinks: { reference: string; url: string }[] = [];
      if (customLines.length) {
        const response = await fetch("/api/personalizados/vincular", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderReference,
            customer: {
              name: String(form.get("name") ?? ""),
              phone: String(form.get("phone") ?? ""),
              email: String(form.get("email") ?? ""),
              address: String(form.get("address") ?? ""),
              city: String(form.get("city") ?? ""),
              state: String(form.get("state") ?? ""),
              postalCode: String(form.get("postalCode") ?? ""),
              notes: String(form.get("notes") ?? ""),
            },
            requests: customLines.map((line) => ({ requestId: line.customization.requestId, accessToken: line.customization.accessToken })),
          }),
        });
        const payload = await response.json() as { error?: string; statusLinks?: { reference: string; url: string }[] };
        if (!response.ok) throw new Error(payload.error ?? "No fue posible vincular la personalización.");
        statusLinks = payload.statusLinks ?? [];
      }
      setConfirmation({ reference: orderReference, statusLinks, catalogTotal: subtotal });
      clearCart();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible completar el recorrido.");
    } finally {
      setSubmitting(false);
    }
  };
  if (confirmation) return <section className="section checkout-confirmation combined-confirmation"><span aria-hidden="true">✓</span><p className="eyebrow">Recorrido completado</p><h1>Todo quedó bajo un mismo folio.</h1><p>Referencia <strong>{confirmation.reference}</strong></p><div className="combined-status-grid"><div><small>Paso 1</small><strong>Catálogo</strong><p>{confirmation.catalogTotal > 0 ? `$${confirmation.catalogTotal.toLocaleString("es-MX")} MXN procesados en modo de prueba.` : "Sin artículos de catálogo."}</p></div><div><small>Paso 2</small><strong>Personalizados</strong><p>{confirmation.statusLinks.length ? "Pendientes de muestra, aprobación y segundo pago." : "No agregaste piezas personalizadas."}</p></div><div><small>Envío</small><strong>Un solo paquete</strong><p>{confirmation.statusLinks.length ? "El pedido queda retenido hasta completar las piezas personalizadas." : "Se calculará cuando existan reglas comerciales."}</p></div></div>{confirmation.statusLinks.length > 0 && <div className="status-link-list"><h2>Da seguimiento a tus piezas</h2>{confirmation.statusLinks.map((link) => <Link className="button secondary" href={link.url} key={link.reference}>Abrir {link.reference}</Link>)}</div>}<div className="demo-note"><strong>No se realizó ningún cobro ni se creó una compra real.</strong><br />El flujo demuestra cómo quedarán ligados ambos pagos cuando se conecte la plataforma comercial.</div><div className="button-row"><Link className="button primary" href="/tienda">Volver a la tienda</Link><Link className="button secondary" href="/personalizados">Crear otra pieza</Link></div></section>;
  if (!cart.lines.length) return <section className="section checkout-empty"><p className="eyebrow">Checkout de prueba</p><h1>Tu carrito está vacío.</h1><p>Agrega productos de catálogo o una pieza personalizada para continuar.</p><div className="button-row"><Link className="button primary" href="/tienda">Ver tienda</Link><Link className="button secondary" href="/personalizados">Personalizar</Link></div></section>;
  return (
    <section className="section checkout-page">
      <div className="page-heading"><p className="eyebrow">Checkout combinado · Prueba</p><h1>Paga el catálogo y conserva un solo envío.</h1><p>Las piezas personalizadas no se cobran todavía. Se ligan a este folio para cotizarlas, aprobarlas y pagarlas después sin separar el envío.</p><p className="demo-note"><strong>Modo de prueba:</strong> no se realizará ningún cobro real. Si agregaste una personalización, sus datos y archivos sí se guardarán de forma privada para probar el seguimiento.</p></div>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <h2>Contacto y envío</h2>
          <label>Nombre completo<input name="name" autoComplete="name" required /></label>
          <div className="two-column"><label>Teléfono<input name="phone" type="tel" autoComplete="tel" required /></label><label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label></div>
          <label>Domicilio<input name="address" autoComplete="street-address" required /></label>
          <div className="three-column"><label>Ciudad<input name="city" autoComplete="address-level2" required /></label><label>Estado<select name="state" autoComplete="address-level1" required defaultValue=""><option value="" disabled>Selecciona</option><option>Sonora</option><option>Chihuahua</option><option>Sinaloa</option><option>Baja California</option><option>Otro estado</option></select></label><label>Código postal<input name="postalCode" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" title="Ingresa un código postal de 5 dígitos" required /></label></div>
          <label>Notas para la entrega <span className="small">(opcional)</span><textarea name="notes" rows={4} /></label>
          {customLines.length > 0 && <label className="check-label"><input type="checkbox" required />Acepto que FIERRO utilice mis datos y archivos únicamente para revisar, cotizar y dar seguimiento a las piezas personalizadas de este folio.</label>}
          {error && <p className="form-message" role="alert">{error}</p>}
          <button className="button primary block" type="submit" disabled={submitting}>{submitting ? "Vinculando pedido…" : standardLines.length ? `Continuar con $${subtotal.toLocaleString("es-MX")} MXN de catálogo` : "Enviar personalización para cotizar"}</button>
          <p className="small">Consulta los <Link href="/terminos">términos de uso</Link> y el <Link href="/privacidad">aviso de privacidad</Link>.</p>
        </form>
        <aside className="checkout-summary" aria-label="Resumen del pedido"><h2>Tu pedido</h2>{cart.lines.map((line) => <div className={`checkout-line ${isCustomLine(line) ? "is-custom" : ""}`} key={line.key}>{line.image ? <Image src={line.image} alt="" width="72" height="72" unoptimized /> : <span /> }<div><strong>{line.name}</strong><p className="small">{line.variantLabel} · Cant. {line.quantity}</p>{isCustomLine(line) && <small>{line.customization.reference} · Muestra pendiente</small>}</div><strong>{isCustomLine(line) ? "Por cotizar" : `$${(line.unitPrice * line.quantity).toLocaleString("es-MX")}`}</strong></div>)}<div className="checkout-totals"><div><span>Catálogo</span><strong>${subtotal.toLocaleString("es-MX")} MXN</strong></div><div><span>Personalizados</span><span>Segundo pago</span></div><div><span>Envío conjunto</span><span>Por calcular</span></div><div><strong>Total de esta etapa</strong><strong>${subtotal.toLocaleString("es-MX")} MXN</strong></div></div>{customLines.length > 0 && <p className="checkout-hold-note"><strong>Envío en espera.</strong> Todo se libera junto cuando la personalización esté aprobada, pagada y producida.</p>}</aside>
      </div>
    </section>
  );
}

function MobileDock() {
  const { count, openCart } = useCart();
  return (
    <nav className="mobile-dock" aria-label="Accesos rápidos">
      <Link href="/"><span aria-hidden="true">⌂</span><small>Inicio</small></Link>
      <Link href="/tienda"><span aria-hidden="true">▦</span><small>Tienda</small></Link>
      <button type="button" aria-label={`Abrir carrito con ${count} artículo${count === 1 ? "" : "s"}`} onClick={openCart}><span aria-hidden="true">▢</span><small>Carrito{count > 0 ? ` (${count})` : ""}</small></button>
      <a href={brand.instagramUrl} target="_blank" rel="noreferrer" aria-label={`Abrir Instagram ${brand.instagramLabel}`}><span aria-hidden="true">◉</span><small>Instagram</small></a>
    </nav>
  );
}

export default function FierroSite({ page, productSlug = "playera-brangus", initialCategory = "all", initialQuery = "", initialCollection = "all", customCategory = "cattle-tag" }: { page: PageName; productSlug?: string; initialCategory?: string; initialQuery?: string; initialCollection?: string; customCategory?: CustomCategory }) {
  const focusedCustom = page === "custom";
  return <CartProvider><div className={`site-shell${focusedCustom ? " custom-app-shell" : ""}`}>{!focusedCustom && <Header />}<main>{page === "home" && <HomePage />}{page === "shop" && <ShopPage key={`${initialCategory}|${initialCollection}|${initialQuery}`} initialCategory={initialCategory} initialQuery={initialQuery} initialCollection={initialCollection} />}{page === "product" && <ProductPage key={productSlug} slug={productSlug} />}{page === "about" && <AboutPage />}{page === "contact" && <ContactPage />}{page === "wholesale" && <WholesalePage />}{page === "custom-index" && <CustomLandingPage />}{page === "custom" && <CustomPage category={customCategory} />}{page === "faq" && <FaqPage />}{page === "checkout" && <CheckoutPage />}{page === "terms" && <TermsPage />}{page === "privacy" && <PrivacyPage />}{page === "shipping" && <ShippingPage />}</main>{!focusedCustom && <Footer />}{!focusedCustom && <MobileDock />}</div></CartProvider>;
}
