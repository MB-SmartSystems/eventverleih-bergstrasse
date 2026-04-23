'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { GalleryProduct, ProductCategory } from '@/lib/types';
import ProductDialog from '@/components/admin/ProductDialog';

export default function ProduktePage() {
  const [products, setProducts] = useState<GalleryProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<GalleryProduct | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<GalleryProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMainId, setMergeMainId] = useState<string>('');

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
      }
    } catch {
      // silently fail, layout handles auth
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function openCreate() {
    setEditProduct(undefined);
    setDialogOpen(true);
  }

  function openEdit(product: GalleryProduct) {
    setEditProduct(product);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${deleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchProducts();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  async function toggleVisible(id: string, current: boolean) {
    const formData = new FormData();
    formData.append('visible', String(!current));
    await fetch(`/api/admin/products/${id}`, { method: 'PUT', body: formData });
    fetchProducts();
  }

  async function togglePinned(id: string, current: boolean) {
    const formData = new FormData();
    formData.append('pinned', String(!current));
    await fetch(`/api/admin/products/${id}`, { method: 'PUT', body: formData });
    fetchProducts();
  }

  // Bulk actions
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkCategory('');
  }

  async function bulkAction(action: 'hide' | 'show' | 'delete' | 'category') {
    if (selectedIds.size === 0) return;
    if (action === 'delete' && !confirm(`${selectedIds.size} Produkt(e) wirklich loeschen?`)) return;

    setBulkLoading(true);
    try {
      const body: Record<string, unknown> = {
        action,
        productIds: Array.from(selectedIds),
      };
      if (action === 'category' && bulkCategory) {
        body.category = bulkCategory;
      }
      await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSelectedIds(new Set());
      setBulkCategory('');
      fetchProducts();
    } catch {
      // ignore
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleMerge() {
    if (!mergeMainId || selectedIds.size < 2) return;
    const mergeIds = Array.from(selectedIds).filter(id => id !== mergeMainId);

    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/products/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainProductId: mergeMainId, mergeProductIds: mergeIds }),
      });
      if (res.ok) {
        setMergeOpen(false);
        setMergeMainId('');
        setSelectedIds(new Set());
        fetchProducts();
      }
    } catch {
      // ignore
    } finally {
      setBulkLoading(false);
    }
  }

  function getCategoryName(slug: string): string {
    return categories.find((c) => c.slug === slug)?.name ?? slug;
  }

  function getCategoryIcon(slug: string): string {
    return categories.find((c) => c.slug === slug)?.icon ?? '';
  }

  // Filter and search
  const filtered = products.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterVisibility === 'visible' && !p.visible) return false;
    if (filterVisibility === 'hidden' && p.visible) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        getCategoryName(p.category).toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return <p className="text-warm-muted">Laden...</p>;
  }

  return (
    <div className={bulkMode && selectedIds.size > 0 ? 'pb-24' : ''}>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-warm-text">Produkte</h1>
          <p className="text-warm-muted text-sm mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'Produkt' : 'Produkte'}
            {filterCategory || search || filterVisibility !== 'all' ? ` (von ${products.length} gesamt)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              bulkMode
                ? 'bg-accent-light text-accent-dark'
                : 'bg-warm-bg text-warm-muted hover:text-warm-text hover:bg-accent-50 border border-warm-border'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {bulkMode ? 'Fertig' : 'Auswahl'}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Produkt
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        >
          <option value="">Alle Kategorien</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>

        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </div>
      </div>

      {/* Visibility filter pills */}
      <div className="flex items-center gap-2 mb-6">
        {bulkMode && (
          <label className="flex items-center gap-1.5 text-sm text-warm-muted mr-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selectedIds.size === filtered.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-warm-border text-accent focus:ring-accent/40"
            />
            Alle
          </label>
        )}
        {(['all', 'visible', 'hidden'] as const).map((v) => {
          const labels = { all: 'Alle', visible: 'Sichtbar', hidden: 'Versteckt' };
          return (
            <button
              key={v}
              onClick={() => setFilterVisibility(v)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterVisibility === v
                  ? 'bg-accent text-white'
                  : 'bg-warm-bg text-warm-muted hover:bg-accent-50 hover:text-accent-dark border border-warm-border'
              }`}
            >
              {labels[v]}
            </button>
          );
        })}
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-warm-border mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-warm-muted">
            {products.length === 0 ? 'Noch keine Produkte vorhanden.' : 'Keine Produkte gefunden.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <div
              key={product.id}
              className={`group bg-warm-surface rounded-xl border border-warm-border overflow-hidden hover:shadow-md transition-all relative ${
                !product.visible ? 'opacity-50' : ''
              } ${bulkMode && selectedIds.has(product.id) ? 'ring-2 ring-accent' : ''}`}
              onClick={bulkMode ? () => toggleSelect(product.id) : undefined}
            >
              {/* Bulk checkbox */}
              {bulkMode && (
                <div className="absolute top-2 left-2 z-20">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-warm-border text-accent focus:ring-accent/40 cursor-pointer"
                  />
                </div>
              )}

              {/* Pinned badge */}
              {product.pinned && !bulkMode && (
                <div className="absolute top-2 left-2 z-10 bg-accent text-white rounded-full p-1" title="Angepinnt">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616L17.5 12.5a1 1 0 01-.894.553H12v5a1 1 0 11-2 0v-5H3.394a1 1 0 01-.894-.553L3.786 7.51l-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" />
                  </svg>
                </div>
              )}

              {/* Hidden badge */}
              {!product.visible && (
                <div className="absolute top-2 right-2 z-10 bg-warm-muted/80 text-white rounded-full p-1" title="Versteckt">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                </div>
              )}

              {/* Condition badge */}
              {product.condition && product.condition !== 'ok' && (
                <div
                  className={`absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    product.condition === 'broken' ? 'bg-red-500/90 text-white' : 'bg-yellow-500/90 text-white'
                  }`}
                  title={product.condition === 'broken' ? 'Defekt' : 'Reparaturbeduerftig'}
                >
                  {product.condition === 'broken' ? 'Defekt' : 'Repair'}
                </div>
              )}

              {/* Image */}
              <div className="relative aspect-square">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
                {/* Multi-image badge */}
                {product.images && product.images.length > 1 && (
                  <div className="absolute bottom-2 left-2 z-10 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">
                    {product.images.length} Bilder
                  </div>
                )}
                {/* Desktop: hover overlay */}
                {!bulkMode && (
                  <div className="hidden sm:flex absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(product)}
                      className="p-2 bg-warm-surface/90 rounded-lg hover:bg-warm-surface transition-colors"
                      title="Bearbeiten"
                    >
                      <svg className="w-4 h-4 text-warm-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(product)}
                      className="p-2 bg-warm-surface/90 rounded-lg hover:bg-red-50 transition-colors"
                      title="Loeschen"
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleVisible(product.id, product.visible)}
                      className="p-2 bg-warm-surface/90 rounded-lg hover:bg-warm-surface transition-colors"
                      title={product.visible ? 'Ausblenden' : 'Einblenden'}
                    >
                      <svg className="w-4 h-4 text-warm-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {product.visible ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => togglePinned(product.id, product.pinned)}
                      className={`p-2 bg-warm-surface/90 rounded-lg hover:bg-warm-surface transition-colors ${product.pinned ? 'text-accent' : 'text-warm-text'}`}
                      title={product.pinned ? 'Loesung' : 'Anpinnen'}
                    >
                      <svg className="w-4 h-4" fill={product.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-medium text-warm-text truncate">{product.name}</p>
                <p className="text-xs text-warm-muted mt-0.5">
                  Bestand: {product.quantity ?? 1}
                </p>
                <p className="text-xs text-warm-muted mt-0.5">
                  {getCategoryIcon(product.category)} {getCategoryName(product.category)}
                </p>
                {product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {product.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-block text-[10px] px-1.5 py-0.5 bg-accent-50 text-accent-dark rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {product.tags.length > 3 && (
                      <span className="text-[10px] text-warm-muted">+{product.tags.length - 3}</span>
                    )}
                  </div>
                )}
                {/* Mobile: always-visible action buttons */}
                {!bulkMode && (
                  <div className="flex items-center gap-1.5 mt-2 sm:hidden">
                    <button
                      onClick={() => openEdit(product)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-accent-50 text-accent-dark text-xs font-medium hover:bg-accent-light transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => toggleVisible(product.id, product.visible)}
                      className="p-1.5 rounded-lg bg-accent-50 text-accent-dark hover:bg-accent-light transition-colors"
                      title={product.visible ? 'Ausblenden' : 'Einblenden'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {product.visible ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => togglePinned(product.id, product.pinned)}
                      className={`p-1.5 rounded-lg transition-colors ${product.pinned ? 'bg-accent text-white' : 'bg-accent-50 text-accent-dark hover:bg-accent-light'}`}
                      title={product.pinned ? 'Loesung' : 'Anpinnen'}
                    >
                      <svg className="w-3.5 h-3.5" fill={product.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(product)}
                      className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-warm-surface border-t border-warm-border shadow-lg lg:pl-56">
          <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto">
            <span className="text-sm font-medium text-warm-text whitespace-nowrap">
              {selectedIds.size} ausgewaehlt
            </span>
            <div className="h-5 w-px bg-warm-border" />
            <div className="flex items-center gap-2">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="">Kategorie aendern...</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
              {bulkCategory && (
                <button
                  onClick={() => bulkAction('category')}
                  disabled={bulkLoading}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  Zuweisen
                </button>
              )}
            </div>
            <button
              onClick={() => bulkAction('show')}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg bg-accent-50 text-accent-dark text-xs font-medium hover:bg-accent-light transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Einblenden
            </button>
            <button
              onClick={() => bulkAction('hide')}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg bg-accent-50 text-accent-dark text-xs font-medium hover:bg-accent-light transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Ausblenden
            </button>
            <button
              onClick={() => {
                setMergeMainId(Array.from(selectedIds)[0]);
                setMergeOpen(true);
              }}
              disabled={selectedIds.size < 2 || bulkLoading}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Gruppieren ({selectedIds.size})
            </button>
            <button
              onClick={() => bulkAction('delete')}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Loeschen
            </button>
          </div>
        </div>
      )}

      {/* Product dialog */}
      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchProducts}
        product={editProduct}
        categories={categories}
      />

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-sm p-6 border border-warm-border">
            <h3 className="font-display text-lg font-semibold text-warm-text mb-2">
              Produkt loeschen?
            </h3>
            <p className="text-warm-muted text-sm mb-6">
              &quot;{deleteConfirm.name}&quot; wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.
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

      {/* Merge dialog */}
      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMergeOpen(false)} />
          <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-lg p-6 border border-warm-border max-h-[80vh] overflow-y-auto">
            <h3 className="font-display text-lg font-semibold text-warm-text mb-2">
              Produkte gruppieren
            </h3>
            <p className="text-warm-muted text-sm mb-4">
              Waehle das Produkt, das den Namen und die Tags behaelt. Alle Bilder werden dort zusammengefuegt.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {products
                .filter(p => selectedIds.has(p.id))
                .map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMergeMainId(p.id)}
                    className={`relative rounded-lg overflow-hidden border-2 text-left transition-colors ${
                      mergeMainId === p.id ? 'border-accent ring-2 ring-accent' : 'border-warm-border hover:border-accent/50'
                    }`}
                  >
                    <div className="relative aspect-square">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                      {mergeMainId === p.id && (
                        <div className="absolute top-2 left-2 bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                          Hauptprodukt
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-warm-text truncate">{p.name}</p>
                    </div>
                  </button>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setMergeOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-warm-muted hover:text-warm-text hover:bg-warm-bg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleMerge}
                disabled={!mergeMainId || bulkLoading}
                className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent-dark transition-colors font-medium disabled:opacity-50"
              >
                {bulkLoading ? 'Gruppieren...' : 'Gruppieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
