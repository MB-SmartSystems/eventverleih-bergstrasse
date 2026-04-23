'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { Promotion, GalleryProduct, ProductCategory } from '@/lib/types';

interface PromotionForm {
  title: string;
  description: string;
  expiresAt: string;
  bannerColor: string;
  active: boolean;
  productIds: string[];
}

const emptyForm: PromotionForm = {
  title: '',
  description: '',
  expiresAt: '',
  bannerColor: '#6e8c8c',
  active: true,
  productIds: [],
};

export default function AktionenPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<GalleryProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Filter products by search (name + tags)
  const pickerFiltered = pickerSearch
    ? products.filter(p => {
        const q = pickerSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
      })
    : products;

  // All tags for quick-select, sorted by frequency
  const popularTags = (() => {
    const tagCount: Record<string, number> = {};
    for (const p of products) {
      for (const t of p.tags) {
        tagCount[t] = (tagCount[t] || 0) + 1;
      }
    }
    return Object.entries(tagCount)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  })();

  const fetchData = useCallback(async () => {
    try {
      const [promoRes, prodRes] = await Promise.all([
        fetch('/api/admin/promotions'),
        fetch('/api/admin/products'),
      ]);
      if (promoRes.ok) {
        const data = await promoRes.json();
        setPromotions(data.promotions || data || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
      }
    } catch {
      setError('Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPickerSearch('');
    setFormOpen(true);
    setError('');
  }

  function openEdit(promo: Promotion) {
    setEditingId(promo.id);
    setForm({
      title: promo.title,
      description: promo.description,
      expiresAt: promo.expiresAt ? promo.expiresAt.split('T')[0] : '',
      bannerColor: promo.bannerColor || '#6e8c8c',
      active: promo.active,
      productIds: promo.productIds || [],
    });
    setFormOpen(true);
    setError('');
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  function toggleProductInForm(id: string) {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((pid) => pid !== id)
        : [...prev.productIds, id],
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setError('Titel ist erforderlich.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingId
        ? `/api/admin/promotions/${editingId}`
        : '/api/admin/promotions';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        closeForm();
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Fehler beim Speichern.');
      }
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(promo: Promotion) {
    // Optimistic update — UI changes instantly
    const newActive = !promo.active;
    setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, active: newActive } : p));

    try {
      const res = await fetch(`/api/admin/promotions/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...promo, active: newActive }),
      });
      if (!res.ok) {
        // Revert on error
        setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, active: !newActive } : p));
      }
    } catch {
      // Revert on error
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, active: !newActive } : p));
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/promotions/${deleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  function isExpired(expiresAt: string): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  // Sort: active first, then by creation (newest first = reverse order in array)
  const sorted = [...promotions].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return 0;
  });

  if (loading) {
    return <p className="text-warm-muted">Laden...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-warm-text">Aktionen</h1>
          <p className="text-warm-muted text-sm mt-0.5">
            {promotions.length} {promotions.length === 1 ? 'Aktion' : 'Aktionen'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark transition-colors text-sm font-medium self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Aktion
        </button>
      </div>

      {/* Error */}
      {error && !formOpen && (
        <p className="text-red-600 text-sm mb-4">{error}</p>
      )}

      {/* Create/Edit Form */}
      {formOpen && (
        <div className="bg-warm-surface rounded-2xl border border-warm-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-warm-text">
              {editingId ? 'Aktion bearbeiten' : 'Neue Aktion'}
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-warm-muted">{form.active ? 'Aktiv' : 'Inaktiv'}</span>
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-accent' : 'bg-warm-border'}`}
                onClick={() => setForm({ ...form, active: !form.active })}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-warm-text mb-1">Titel *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="z.B. Fruehlingsrabatt"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-warm-text mb-1">Beschreibung</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="Kurze Beschreibung der Aktion"
              />
            </div>

            {/* Date + Color row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-warm-text mb-1">Ablaufdatum</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-text mb-1">Bannerfarbe</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.bannerColor}
                    onChange={(e) => setForm({ ...form, bannerColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-warm-border cursor-pointer"
                  />
                  <span className="text-sm text-warm-muted">{form.bannerColor}</span>
                </div>
              </div>
            </div>


            {/* Product picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-warm-text">
                  Produkte waehlen ({form.productIds.length} ausgewaehlt)
                </label>
                {form.productIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, productIds: [] })}
                    className="text-xs text-warm-muted hover:text-red-600 transition-colors"
                  >
                    Alle abwaehlen
                  </button>
                )}
              </div>

              {/* Search + tag filter */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Suchen nach Name oder Tag..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                  />
                </div>
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      const matching = pickerFiltered.filter(p => !form.productIds.includes(p.id));
                      if (matching.length > 0) {
                        setForm(prev => ({ ...prev, productIds: [...prev.productIds, ...matching.map(p => p.id)] }));
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-accent-50 text-accent-dark text-sm hover:bg-accent-light transition-colors whitespace-nowrap font-medium"
                  >
                    Alle &quot;{pickerSearch}&quot; auswaehlen ({pickerFiltered.filter(p => !form.productIds.includes(p.id)).length})
                  </button>
                )}
              </div>

              {/* Category quick-select */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {categories.map(cat => {
                    const catProducts = products.filter(p => p.category === cat.slug);
                    const allSelected = catProducts.length > 0 && catProducts.every(p => form.productIds.includes(p.id));
                    return (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => {
                          if (allSelected) {
                            setForm(prev => ({ ...prev, productIds: prev.productIds.filter(id => !catProducts.some(p => p.id === id)) }));
                          } else {
                            const newIds = catProducts.filter(p => !form.productIds.includes(p.id)).map(p => p.id);
                            setForm(prev => ({ ...prev, productIds: [...prev.productIds, ...newIds] }));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors font-medium ${
                          allSelected
                            ? 'bg-accent text-white'
                            : 'bg-warm-surface text-warm-text hover:bg-accent-50 border border-warm-border'
                        }`}
                      >
                        {cat.icon} {cat.name} ({catProducts.length})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tags quick-select */}
              {popularTags.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-warm-muted mb-1.5">Tags ({popularTags.length})</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {popularTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setPickerSearch(tag)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                          pickerSearch === tag
                            ? 'bg-accent text-white'
                            : 'bg-warm-bg text-warm-muted hover:bg-accent-50 hover:text-accent-dark border border-warm-border'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {products.length === 0 ? (
                <p className="text-warm-muted text-sm">Keine Produkte vorhanden.</p>
              ) : (
                <>
                  {pickerSearch && (
                    <p className="text-xs text-warm-muted mb-2">{pickerFiltered.length} Treffer</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1">
                    {pickerFiltered.map((product) => {
                      const selected = form.productIds.includes(product.id);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => toggleProductInForm(product.id)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-colors text-left ${
                            selected
                              ? 'border-accent ring-2 ring-accent'
                              : 'border-warm-border hover:border-accent/50'
                          }`}
                          title={product.name}
                        >
                          <div className="relative aspect-square">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                              className="object-cover"
                            />
                            {selected && (
                              <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-accent drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="p-1.5">
                            <p className="text-[11px] text-warm-text truncate">{product.name}</p>
                            {product.tags.length > 0 && (
                              <p className="text-[10px] text-warm-muted truncate mt-0.5">{product.tags.slice(0, 3).join(', ')}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Error */}
            {error && formOpen && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded-lg text-sm text-warm-muted hover:text-warm-text hover:bg-warm-bg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promotions list — hidden when editing */}
      {formOpen ? null : sorted.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-warm-border mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-warm-muted">Noch keine Aktionen vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((promo) => {
            const expired = isExpired(promo.expiresAt);
            return (
              <div
                key={promo.id}
                className={`bg-warm-surface rounded-xl border border-warm-border p-4 sm:p-5 transition-opacity ${
                  !promo.active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Color indicator */}
                  <div
                    className="w-full sm:w-2 sm:min-h-[60px] h-2 sm:h-auto rounded-full flex-shrink-0"
                    style={{ backgroundColor: promo.bannerColor || '#6e8c8c' }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-display text-base font-semibold text-warm-text">
                        {promo.title}
                      </h3>
                      {/* Badges */}
                      {promo.active && !expired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          Aktiv
                        </span>
                      )}
                      {!promo.active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-warm-bg text-warm-muted">
                          Inaktiv
                        </span>
                      )}
                      {expired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                          Abgelaufen
                        </span>
                      )}
                    </div>
                    {promo.description && (
                      <p className="text-sm text-warm-muted mt-1">{promo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-warm-muted">
                      {promo.expiresAt && (
                        <span>Bis {new Date(promo.expiresAt).toLocaleDateString('de-DE')}</span>
                      )}
                      <span>{promo.productIds?.length || 0} Produkte</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggleActive(promo)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        promo.active ? 'bg-accent' : 'bg-warm-border'
                      }`}
                      title={promo.active ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          promo.active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEdit(promo)}
                      className="p-2 rounded-lg hover:bg-accent-50 text-warm-muted hover:text-accent-dark transition-colors"
                      title="Bearbeiten"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(promo)}
                      className="p-2 rounded-lg hover:bg-red-50 text-warm-muted hover:text-red-600 transition-colors"
                      title="Loeschen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-sm p-6 border border-warm-border">
            <h3 className="font-display text-lg font-semibold text-warm-text mb-2">
              Aktion loeschen?
            </h3>
            <p className="text-warm-muted text-sm mb-6">
              &quot;{deleteConfirm.title}&quot; wirklich loeschen?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-warm-muted hover:text-warm-text hover:bg-warm-bg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {deleting ? 'Loeschen...' : 'Loeschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
