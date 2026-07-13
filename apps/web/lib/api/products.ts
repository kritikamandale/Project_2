/**
 * Typed API client for the product catalogue endpoint.
 * Routes through Next.js /api/proxy which attaches the Bearer token.
 *
 * Mirrors app/schemas/product.py — GET /products powers the results-page
 * intelligence layer: personalised Match Score + reason, safety flags, honest
 * multi-store links, and the full filter bar.
 */

const BASE = "/api/proxy/products";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.detail?.message ?? body?.detail ?? `Request failed (${res.status})`
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types — mirror backend schemas (app/schemas/product.py)
// ---------------------------------------------------------------------------

export type ProductCategory =
  | "cleanser"
  | "toner"
  | "serum"
  | "moisturiser"
  | "sunscreen"
  | "treatment"
  | "mask";

export type ProductFlagCode =
  | "comedogenic"
  | "contains_allergen"
  | "pregnancy_unsafe"
  | "fragrance";

export interface StoreLink {
  store: string;
  url: string;
}

export interface ProductFlag {
  code: ProductFlagCode;
  message: string;
}

export interface Product {
  id: string;
  brand: "nykaa" | "minimalist" | "dermaco" | "others";
  brand_display: string | null;
  product_name: string;
  product_url: string | null;
  image_url: string | null;
  price_inr: number | null;
  mrp_inr: number | null;
  pack_size: number;
  category: ProductCategory;
  key_ingredients: string[] | null;
  key_actives: string[] | null;
  targets_conditions: string[] | null;
  skin_types_suitable: string[] | null;
  fitzpatrick_suitable: string[] | null;
  climate_zones_suitable: string[] | null;
  store_links: StoreLink[];
  pregnancy_safe: boolean | null;
  is_new: boolean;
  is_dermatologist_approved: boolean;
  rating_avg: number;
  review_count: number;
  is_active: boolean;
  created_at: string;

  // Derived, computed per-request against the user's context.
  discount_pct: number | null;
  match_score: number | null;
  match_reason: string | null;
  flags: ProductFlag[];
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export type ProductSort =
  | "match_score"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "discount"
  | "newest";

/**
 * Every field maps 1:1 to a GET /products query param. `undefined`/`null`
 * values are omitted so the backend applies its defaults.
 */
export interface ListProductsParams {
  // personalisation (drives the non-random Match Score)
  skin_type?: string | null;
  condition?: string | null;
  climate_zone?: string | null;
  fitzpatrick?: string | null;
  scan_id?: string | null;
  questionnaire_id?: string | null;
  pregnant?: boolean;
  // filter bar
  max_price?: number | null;
  brand?: string[] | null;
  min_rating?: number | null;
  pack_size?: number | null;
  is_combo?: boolean;
  is_new?: boolean;
  min_discount_pct?: number | null;
  on_sale?: boolean;
  category?: ProductCategory | null;
  sort?: ProductSort;
  page?: number;
  page_size?: number;
}

function buildQuery(params: ListProductsParams): string {
  const q = new URLSearchParams();
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    q.append(key, String(value));
  };

  add("skin_type", params.skin_type);
  add("condition", params.condition);
  add("climate_zone", params.climate_zone);
  add("fitzpatrick", params.fitzpatrick);
  add("scan_id", params.scan_id);
  add("questionnaire_id", params.questionnaire_id);
  add("pregnant", params.pregnant);
  add("max_price", params.max_price);
  // brand is repeatable — one entry per selected brand.
  for (const b of params.brand ?? []) if (b) q.append("brand", b);
  add("min_rating", params.min_rating);
  add("pack_size", params.pack_size);
  add("is_combo", params.is_combo);
  add("is_new", params.is_new);
  add("min_discount_pct", params.min_discount_pct);
  add("on_sale", params.on_sale);
  add("category", params.category);
  add("sort", params.sort);
  add("page", params.page);
  add("page_size", params.page_size);

  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listProducts(
  params: ListProductsParams = {}
): Promise<PaginatedProducts> {
  return apiFetch<PaginatedProducts>(buildQuery(params));
}
