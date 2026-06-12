"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
  Package,
  CheckCircle2,
} from "lucide-react";
import {
  adminApi,
  type AdminProductListItem,
  type AdminProductCreate,
} from "@/lib/api/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRANDS = ["nykaa", "minimalist", "dermaco", "others"] as const;
const CATEGORIES = ["cleanser", "toner", "serum", "moisturiser", "sunscreen", "treatment", "mask"] as const;
const SKIN_TYPES = ["oily", "dry", "combination", "normal", "sensitive"];
const CLIMATE_ZONES = ["tropical", "arid", "semi_arid", "temperate", "coastal"];
const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"];

type Brand = typeof BRANDS[number];
type Category = typeof CATEGORIES[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Badge({ label, variant = "default" }: { label: string; variant?: "default" | "success" | "warning" }) {
  const cls = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
  }[variant];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Multi-select chip group
// ---------------------------------------------------------------------------

function ChipGroup({
  options,
  selected,
  onChange,
  label,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
              selected.includes(opt)
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingredient tagger
// ---------------------------------------------------------------------------

function IngredientTagger({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInput("");
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">Key Ingredients</label>
      <div className="flex gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Type ingredient, press Enter"
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button type="button" onClick={add} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((ing) => (
          <span key={ing} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">
            {ing}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== ing))}>
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product form
// ---------------------------------------------------------------------------

const DEFAULT_FORM: AdminProductCreate = {
  brand: "nykaa",
  product_name: "",
  product_url: "",
  price_inr: undefined,
  category: "cleanser",
  key_ingredients: [],
  targets_conditions: [],
  skin_types_suitable: [],
  fitzpatrick_suitable: [],
  climate_zones_suitable: [],
  is_dermatologist_approved: false,
};

function ProductForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<AdminProductCreate>;
  onSave: (data: AdminProductCreate) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AdminProductCreate>({ ...DEFAULT_FORM, ...initial });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AdminProductCreate>(key: K, val: AdminProductCreate[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_name.trim()) { toast.error("Product name required"); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {initial?.product_name ? "Edit Product" : "Add New Product"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Product Name *</label>
            <input
              value={form.product_name}
              onChange={(e) => set("product_name", e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Brand</label>
              <select
                value={form.brand}
                onChange={(e) => set("brand", e.target.value as Brand)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value as Category)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Price (₹)</label>
              <input
                type="number"
                value={form.price_inr ?? ""}
                onChange={(e) => set("price_inr", e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Product URL</label>
              <input
                type="url"
                value={form.product_url ?? ""}
                onChange={(e) => set("product_url", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <IngredientTagger value={form.key_ingredients} onChange={(v) => set("key_ingredients", v)} />
          <ChipGroup label="Skin Types" options={SKIN_TYPES} selected={form.skin_types_suitable} onChange={(v) => set("skin_types_suitable", v)} />
          <ChipGroup label="Fitzpatrick Suitability" options={FITZPATRICK} selected={form.fitzpatrick_suitable} onChange={(v) => set("fitzpatrick_suitable", v)} />
          <ChipGroup label="Climate Zones" options={CLIMATE_ZONES} selected={form.climate_zones_suitable} onChange={(v) => set("climate_zones_suitable", v)} />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set("is_dermatologist_approved", !form.is_dermatologist_approved)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.is_dermatologist_approved ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                  form.is_dermatologist_approved ? "translate-x-[18px]" : "translate-x-[2px]"
                }`}
              />
            </button>
            <label className="text-sm text-slate-700">Dermatologist Approved</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? "Saving…" : initial?.product_name ? "Save Changes" : "Create Product"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminProductListItem | null>(null);
  const PAGE_SIZE = 20;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getProducts({ search: search || undefined, status: statusFilter || undefined, page, page_size: PAGE_SIZE })
      .then((data) => { setProducts(data.items); setTotal(data.total); setTotalPages(data.total_pages); })
      .catch(() => toast.error("Failed to load products"))
      .finally(() => setLoading(false));
  }, [search, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: AdminProductCreate) => {
    await adminApi.createProduct(data);
    toast.success("Product created");
    load();
  };

  const handleEdit = async (data: AdminProductCreate) => {
    if (!editTarget) return;
    await adminApi.updateProduct(editTarget.id, data);
    toast.success("Product updated");
    load();
    setEditTarget(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Soft-delete "${name}"? Existing recommendations are unaffected.`)) return;
    try { await adminApi.deleteProduct(id); toast.success("Product marked inactive"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleRegen = async (id: string) => {
    try { const r = await adminApi.regenerateEmbedding(id); toast.success(r.message); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
            <p className="text-slate-500 text-sm mt-1">{total.toLocaleString()} products</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-screen-2xl mx-auto">
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search product name…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none bg-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button onClick={load} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} className="text-slate-500" />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Product", "Brand", "Category", "Price", "Status", "Used in Recs", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <Package size={24} className="mx-auto mb-2" />No products found
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 max-w-48 truncate">{p.product_name}</p>
                        {p.is_dermatologist_approved && (
                          <span className="text-xs text-emerald-600 flex items-center gap-0.5 mt-0.5">
                            <CheckCircle2 size={10} /> Derm approved
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge label={p.brand} /></td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{p.category}</td>
                      <td className="px-4 py-3 text-slate-600">{p.price_inr ? `₹${p.price_inr.toFixed(0)}` : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge label={p.is_active ? "Active" : "Inactive"} variant={p.is_active ? "success" : "warning"} />
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-center">{p.recommendation_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditTarget(p); setShowForm(true); }} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            <Edit2 size={13} className="text-slate-500" />
                          </button>
                          <button onClick={() => handleRegen(p.id)} title="Regenerate embedding" className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                            <Zap size={13} className="text-amber-500" />
                          </button>
                          {p.is_active && (
                            <button onClick={() => handleDelete(p.id, p.product_name)} title="Soft delete" className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">Page {page} of {totalPages} · {total.toLocaleString()} products</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                  <ChevronLeft size={14} className="text-slate-600" />
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                  <ChevronRight size={14} className="text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <ProductForm
            initial={editTarget ?? undefined}
            onSave={editTarget ? handleEdit : handleCreate}
            onClose={() => { setShowForm(false); setEditTarget(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
