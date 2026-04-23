'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GalleryProduct, ProductCategory } from '@/lib/types';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function KategorienPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<GalleryProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // New category form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Reorder state
  const [reordering, setReordering] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setProducts(data.products || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function getProductCount(slug: string): number {
    return products.filter((p) => p.category === slug).length;
  }

  // Auto-generate slug from name
  function handleNewNameChange(name: string) {
    setNewName(name);
    setNewSlug(generateSlug(name));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');

    if (!newName.trim() || !newSlug.trim()) {
      setAddError('Name ist erforderlich');
      return;
    }

    if (categories.some((c) => c.slug === newSlug)) {
      setAddError('Slug existiert bereits');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim(),
          icon: newIcon.trim() || '',
          description: newDescription.trim() || '',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Erstellen');
      }

      setNewName('');
      setNewSlug('');
      setNewIcon('');
      setNewDescription('');
      fetchData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setAdding(false);
    }
  }

  function startEdit(cat: ProductCategory) {
    setEditSlug(cat.slug);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditDescription(cat.description);
    setEditError('');
  }

  function cancelEdit() {
    setEditSlug(null);
    setEditError('');
  }

  async function saveEdit() {
    if (!editSlug) return;
    setEditError('');

    if (!editName.trim()) {
      setEditError('Name ist erforderlich');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${editSlug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          icon: editIcon.trim(),
          description: editDescription.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      setEditSlug(null);
      fetchData();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slug: string) {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin/categories/${slug}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Kategorie kann nicht geloescht werden');
      }
      setDeleteConfirm(null);
      fetchData();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Fehler beim Loeschen');
    } finally {
      setDeleting(false);
    }
  }

  async function moveCategory(slug: string, direction: 'up' | 'down') {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.slug === slug);
    if (index < 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const newOrder = sorted.map((c) => c.slug);
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

    setReordering(true);
    try {
      const res = await fetch('/api/admin/categories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: newOrder }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setReordering(false);
    }
  }

  if (loading) {
    return <p className="text-warm-muted">Laden...</p>;
  }

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-warm-text">Kategorien</h1>
        <p className="text-warm-muted text-sm mt-0.5">
          {categories.length} {categories.length === 1 ? 'Kategorie' : 'Kategorien'}
        </p>
      </div>

      {/* Category list */}
      <div className="bg-warm-surface rounded-xl border border-warm-border overflow-hidden mb-8">
        {sortedCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-warm-muted">Noch keine Kategorien vorhanden.</p>
          </div>
        ) : (
          <div className="divide-y divide-warm-border">
            {sortedCategories.map((cat, index) => {
              const count = getProductCount(cat.slug);
              const isEditing = editSlug === cat.slug;

              if (isEditing) {
                return (
                  <div key={cat.slug} className="p-4 bg-accent-50">
                    <div className="space-y-3">
                      <div className="grid grid-cols-[4rem_1fr] sm:grid-cols-[3rem_1fr_1fr] gap-3">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-warm-muted mb-1">Icon</label>
                          <input
                            type="text"
                            value={editIcon}
                            onChange={(e) => setEditIcon(e.target.value)}
                            className="w-full px-2 py-1.5 rounded border border-warm-border bg-warm-surface text-warm-text text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="Emoji"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-warm-muted mb-1">Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1.5 rounded border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="Name"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[10px] uppercase tracking-wider text-warm-muted mb-1">Beschreibung</label>
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-2 py-1.5 rounded border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="Beschreibung"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-sm text-warm-muted hover:text-warm-text transition-colors"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent-dark transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Speichern...' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                    {editError && <p className="text-red-600 text-sm mt-2">{editError}</p>}
                  </div>
                );
              }

              return (
                <div
                  key={cat.slug}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 hover:bg-accent-50/50 transition-colors"
                >
                  {/* Icon */}
                  <span className="text-xl w-8 text-center flex-shrink-0 hidden sm:block">{cat.icon}</span>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="sm:hidden text-lg">{cat.icon}</span>
                      <p className="text-sm font-medium text-warm-text">{cat.name}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-accent-light text-accent-dark font-medium">
                        {count} {count === 1 ? 'Produkt' : 'Produkte'}
                      </span>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-warm-muted mt-0.5 truncate">{cat.description}</p>
                    )}
                    <p className="text-[10px] text-warm-muted/60 mt-0.5">/{cat.slug}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Move up */}
                    <button
                      onClick={() => moveCategory(cat.slug, 'up')}
                      disabled={index === 0 || reordering}
                      className="p-1.5 rounded hover:bg-warm-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Nach oben"
                    >
                      <svg className="w-4 h-4 text-warm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>

                    {/* Move down */}
                    <button
                      onClick={() => moveCategory(cat.slug, 'down')}
                      disabled={index === sortedCategories.length - 1 || reordering}
                      className="p-1.5 rounded hover:bg-warm-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Nach unten"
                    >
                      <svg className="w-4 h-4 text-warm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => startEdit(cat)}
                      className="p-1.5 rounded hover:bg-warm-bg transition-colors"
                      title="Bearbeiten"
                    >
                      <svg className="w-4 h-4 text-warm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        setDeleteError('');
                        setDeleteConfirm(cat.slug);
                      }}
                      disabled={count > 0}
                      className={`p-1.5 rounded transition-colors ${
                        count > 0
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:bg-red-50'
                      }`}
                      title={count > 0 ? `Nicht loeschbar: ${count} Produkte zugeordnet` : 'Loeschen'}
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add new category */}
      <div className="bg-warm-surface rounded-xl border border-warm-border p-6">
        <h2 className="font-display text-lg font-semibold text-warm-text mb-4">Neue Kategorie</h2>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cat-name" className="block text-sm font-medium text-warm-text mb-1">
                Name
              </label>
              <input
                id="cat-name"
                type="text"
                value={newName}
                onChange={(e) => handleNewNameChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="z.B. Namensschilder"
                required
              />
            </div>
            <div>
              <label htmlFor="cat-slug" className="block text-sm font-medium text-warm-text mb-1">
                Slug <span className="text-warm-muted font-normal">(automatisch)</span>
              </label>
              <input
                id="cat-slug"
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-bg text-warm-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="namensschilder"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[5rem_1fr] gap-4">
            <div>
              <label htmlFor="cat-icon" className="block text-sm font-medium text-warm-text mb-1">
                Icon
              </label>
              <input
                id="cat-icon"
                type="text"
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="Emoji"
              />
            </div>
            <div>
              <label htmlFor="cat-desc" className="block text-sm font-medium text-warm-text mb-1">
                Beschreibung <span className="text-warm-muted font-normal">(optional)</span>
              </label>
              <input
                id="cat-desc"
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                placeholder="Kurze Beschreibung"
              />
            </div>
          </div>

          {addError && <p className="text-red-600 text-sm">{addError}</p>}

          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {adding ? 'Wird erstellt...' : 'Hinzufuegen'}
          </button>
        </form>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-sm p-6 border border-warm-border">
            <h3 className="font-display text-lg font-semibold text-warm-text mb-2">
              Kategorie loeschen?
            </h3>
            <p className="text-warm-muted text-sm mb-6">
              Kategorie &quot;{categories.find((c) => c.slug === deleteConfirm)?.name}&quot; wirklich loeschen?
            </p>
            {deleteError && <p className="text-red-600 text-sm mb-4">{deleteError}</p>}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-warm-muted hover:text-warm-text hover:bg-warm-bg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
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
