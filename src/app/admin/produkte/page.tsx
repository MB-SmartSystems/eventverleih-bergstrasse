'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { GalleryProduct, ProductCategory } from '@/lib/types';
import { compareProducts } from '@/lib/product-sort';
import ProductDialog from '@/components/admin/ProductDialog';
import SortableProductCard from '@/components/admin/SortableProductCard';

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
    const deletedId = deleteConfirm.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${deletedId}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== deletedId));
        setDeleteConfirm(null);
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  async function toggleVisible(id: string, current: boolean) {
    // Optimistic update: flip im State sofort, Server-Response merged danach
    const nextValue = !current;
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, visible: nextValue } : p)));
    const formData = new FormData();
    formData.append('visible', String(nextValue));
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'PUT', body: formData });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      if (data.product) {
        setProducts((prev) => prev.map((p) => (p.id === id ? data.product : p)));
      }
    } catch {
      // Rollback
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, visible: current } : p)));
    }
  }

  async function togglePinned(id: string, current: boolean) {
    const nextValue = !current;
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: nextValue } : p)));
    const formData = new FormData();
    formData.append('pinned', String(nextValue));
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'PUT', body: formData });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      if (data.product) {
        setProducts((prev) => prev.map((p) => (p.id === id ? data.product : p)));
      }
    } catch {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: current } : p)));
    }
  }

  // Reihenfolge innerhalb einer Kategorie: alle Produkte der Kategorie in
  // Website-Reihenfolge (dieselbe Sortierung wie die Storefront). Arbeitet immer
  // auf ALLEN Produkten der Kategorie (nicht der gefilterten Ansicht), damit
  // Such-/Sichtbarkeits-Filter die Nachbarschaft nicht verfaelschen.
  function categorySiblings(categorySlug: string): GalleryProduct[] {
    return products.filter((p) => p.category === categorySlug).sort(compareProducts);
  }

  async function patchSortOrder(id: string, sortOrder: number) {
    const formData = new FormData();
    formData.append('sortOrder', String(sortOrder));
    const res = await fetch(`/api/admin/products/${id}`, { method: 'PUT', body: formData });
    if (!res.ok) throw new Error('Save failed');
  }

  // Drag & Drop innerhalb EINER Kategorie: nach dem Drop wird die betroffene
  // Kategorie sauber neu durchnummeriert (10, 20, 30, ...) und nur die tatsaechlich
  // geaenderten Zeilen werden per PATCH nach Baserow geschrieben.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeProduct = products.find((p) => p.id === active.id);
    const overProduct = products.find((p) => p.id === over.id);
    if (!activeProduct || !overProduct) return;
    // Nur innerhalb derselben Kategorie umsortieren.
    if (activeProduct.category !== overProduct.category) return;

    const siblings = categorySiblings(activeProduct.category);
    const oldIndex = siblings.findIndex((p) => p.id === active.id);
    const newIndex = siblings.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(siblings, oldIndex, newIndex);

    // Neue sortOrder-Werte 10,20,30,... — nur geaenderte Zeilen sammeln.
    const updates: { id: string; sortOrder: number }[] = [];
    reordered.forEach((p, i) => {
      const nextOrder = (i + 1) * 10;
      if ((p.sortOrder ?? 0) !== nextOrder) updates.push({ id: p.id, sortOrder: nextOrder });
    });
    if (updates.length === 0) return;

    const snapshot = products;
    const orderMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
    setProducts((prev) =>
      prev.map((p) => (orderMap.has(p.id) ? { ...p, sortOrder: orderMap.get(p.id)! } : p))
    );
    try {
      await Promise.all(updates.map((u) => patchSortOrder(u.id, u.sortOrder)));
    } catch {
      setProducts(snapshot); // Rollback bei Fehler
    }
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
    if (action === 'delete' && !confirm(`${selectedIds.size} Produkt(e) wirklich löschen?`)) return;

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
      // Bulk mutiert mehrere Produkte auf einmal — Response gibt kein detail zurück.
      // Optimistic: lokal anwenden.
      const ids = Array.from(selectedIds);
      setProducts((prev) => {
        if (action === 'delete') return prev.filter((p) => !ids.includes(p.id));
        return prev.map((p) => {
          if (!ids.includes(p.id)) return p;
          if (action === 'hide') return { ...p, visible: false };
          if (action === 'show') return { ...p, visible: true };
          if (action === 'category' && bulkCategory) return { ...p, category: bulkCategory };
          return p;
        });
      });
      setSelectedIds(new Set());
      setBulkCategory('');
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
        // Merge löscht mergeIds, mainProduct bleibt (evtl. mit aktualisierten images)
        const mergeIdSet = new Set(mergeIds);
        setProducts((prev) => prev.filter((p) => !mergeIdSet.has(p.id)));
        setMergeOpen(false);
        setMergeMainId('');
        setSelectedIds(new Set());
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

  // Grouped-Ansicht: Produkte IMMER nach Kategorie in Website-Reihenfolge gruppiert,
  // je Kategorie in derselben Reihenfolge wie die Storefront.
  const orderedCategories = [...categories].sort((a, b) => a.order - b.order);

  // Such-/Sichtbarkeitsfilter fuer die Anzeige INNERHALB einer Gruppe. Der
  // Kategorie-Filter grenzt nur ganze Gruppen ein (unten), aendert nichts an
  // Gruppierung/Reihenfolge.
  function passesGroupFilters(p: GalleryProduct): boolean {
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
  }

  // Drag & Drop nur ohne aktive Such-/Sichtbarkeitsfilter und ausserhalb des
  // Bulk-Modus — sonst wuerde eine Teilliste falsch neu durchnummeriert.
  const narrowingActive = search.trim() !== '' || filterVisibility !== 'all';
  const dragEnabled = !bulkMode && !narrowingActive;

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
          className="px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent [&>option]:bg-warm-surface [&>option]:text-warm-text"
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

      {/* Produkt-Liste — immer nach Kategorie in Website-Reihenfolge gruppiert */}
      {narrowingActive && (
        <p className="text-xs text-warm-muted mb-4">
          Umsortieren per Drag &amp; Drop ist nur ohne aktiven Such-/Sichtbarkeitsfilter möglich.
        </p>
      )}
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-10">
            {orderedCategories
              .filter((cat) => !filterCategory || cat.slug === filterCategory)
              .map((cat) => {
                const groupItems = categorySiblings(cat.slug).filter(passesGroupFilters);
                if (groupItems.length === 0) return null;
                return (
                  <div key={cat.slug}>
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="font-display text-lg font-semibold text-warm-text">
                        {cat.icon} {cat.name}
                      </h2>
                      <span className="text-xs text-warm-muted">{groupItems.length}</span>
                      <div className="flex-1 h-px bg-warm-border" />
                    </div>
                    <SortableContext items={groupItems.map((p) => p.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {groupItems.map((product) => (
                          <SortableProductCard
                            key={product.id}
                            product={product}
                            bulkMode={bulkMode}
                            selected={selectedIds.has(product.id)}
                            dragEnabled={dragEnabled}
                            onToggleSelect={toggleSelect}
                            onEdit={openEdit}
                            onDelete={setDeleteConfirm}
                            onToggleVisible={toggleVisible}
                            onTogglePinned={togglePinned}
                            categoryIcon={getCategoryIcon(product.category)}
                            categoryName={getCategoryName(product.category)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
          </div>
        </DndContext>
      )}

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-warm-surface border-t border-warm-border shadow-lg lg:pl-56">
          <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto">
            <span className="text-sm font-medium text-warm-text whitespace-nowrap">
              {selectedIds.size} ausgewählt
            </span>
            <div className="h-5 w-px bg-warm-border" />
            <div className="flex items-center gap-2">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 [&>option]:bg-warm-surface [&>option]:text-warm-text"
              >
                <option value="">Kategorie ändern...</option>
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
              Löschen
            </button>
          </div>
        </div>
      )}

      {/* Product dialog */}
      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(updated) => {
          setProducts((prev) => {
            const exists = prev.some((p) => p.id === updated.id);
            return exists
              ? prev.map((p) => (p.id === updated.id ? updated : p))
              : [updated, ...prev];
          });
        }}
        product={editProduct}
        categories={categories}
      />

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-sm p-6 border border-warm-border">
            <h3 className="font-display text-lg font-semibold text-warm-text mb-2">
              Produkt löschen?
            </h3>
            <p className="text-warm-muted text-sm mb-6">
              &quot;{deleteConfirm.name}&quot; wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
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
                {deleting ? 'Löschen...' : 'Löschen'}
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
              Wähle das Produkt, das den Namen und die Tags behält. Alle Bilder werden dort zusammengefügt.
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
