'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { GalleryProduct, ProductCategory } from '@/lib/types';
import { resizeImage } from '@/lib/image-utils';

interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: GalleryProduct;
  categories: ProductCategory[];
}

export default function ProductDialog({ open, onClose, onSaved, product, categories }: ProductDialogProps) {
  const [alt, setAlt] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Multi-image state
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removeImages, setRemoveImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!product;

  useEffect(() => {
    if (open) {
      setAlt(product?.alt ?? '');
      setCategory(product?.category ?? (categories[0]?.slug ?? ''));
      setTags(product?.tags?.join(', ') ?? '');
      setExistingImages(product?.images ?? (product?.image ? [product.image] : []));
      setRemoveImages([]);
      setNewFiles([]);
      setNewPreviews([]);
      setError('');
      setProcessing(false);
    }
  }, [open, product, categories]);

  // Cleanup preview URLs on unmount / change
  useEffect(() => {
    return () => {
      newPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [newPreviews]);

  const handleAddFiles = useCallback(async (files: FileList | File[]) => {
    setProcessing(true);
    try {
      const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
      const resized: File[] = [];
      const previews: string[] = [];
      for (const file of fileArr) {
        const r = await resizeImage(file);
        resized.push(r);
        previews.push(URL.createObjectURL(r));
      }
      setNewFiles(prev => [...prev, ...resized]);
      setNewPreviews(prev => [...prev, ...previews]);
    } finally {
      setProcessing(false);
    }
  }, []);

  function handleRemoveExisting(url: string) {
    setExistingImages(prev => prev.filter(u => u !== url));
    setRemoveImages(prev => [...prev, url]);
  }

  function handleRemoveNew(index: number) {
    URL.revokeObjectURL(newPreviews[index]);
    setNewFiles(prev => prev.filter((_, i) => i !== index));
    setNewPreviews(prev => prev.filter((_, i) => i !== index));
  }

  // All images for display: existing (not removed) + new previews
  const allImages = [
    ...existingImages.map((url, i) => ({ type: 'existing' as const, url, index: i })),
    ...newPreviews.map((url, i) => ({ type: 'new' as const, url, index: i })),
  ];

  function moveImage(globalIdx: number, direction: 'left' | 'right') {
    const targetIdx = direction === 'left' ? globalIdx - 1 : globalIdx + 1;
    if (targetIdx < 0 || targetIdx >= allImages.length) return;

    const src = allImages[globalIdx];
    const dst = allImages[targetIdx];

    // Build new arrays by swapping
    const newExisting = [...existingImages];
    const newNewFiles = [...newFiles];
    const newNewPreviews = [...newPreviews];

    function removeAt(item: typeof src) {
      if (item.type === 'existing') return newExisting.splice(item.index, 1)[0];
      newNewFiles.splice(item.index, 1);
      return newNewPreviews.splice(item.index, 1)[0];
    }

    function insertAt(item: typeof src, value: string, file?: File) {
      if (item.type === 'existing') { newExisting.splice(item.index, 0, value); return; }
      newNewPreviews.splice(item.index, 0, value);
      if (file) newNewFiles.splice(item.index, 0, file);
    }

    // Swap: remove both, re-insert in swapped positions
    // Simpler approach: rebuild the combined list, then split back
    const combined = allImages.map(img => ({
      type: img.type,
      url: img.url,
      file: img.type === 'new' ? newFiles[img.index] : undefined,
    }));
    [combined[globalIdx], combined[targetIdx]] = [combined[targetIdx], combined[globalIdx]];

    const rebuiltExisting: string[] = [];
    const rebuiltFiles: File[] = [];
    const rebuiltPreviews: string[] = [];
    for (const item of combined) {
      if (item.type === 'existing') {
        rebuiltExisting.push(item.url);
      } else {
        rebuiltPreviews.push(item.url);
        if (item.file) rebuiltFiles.push(item.file);
      }
    }
    setExistingImages(rebuiltExisting);
    setNewFiles(rebuiltFiles);
    setNewPreviews(rebuiltPreviews);
  }

  function makeCover(globalIdx: number) {
    if (globalIdx === 0) return;
    // Move to front by repeatedly swapping left
    const combined = allImages.map(img => ({
      type: img.type,
      url: img.url,
      file: img.type === 'new' ? newFiles[img.index] : undefined,
    }));
    const item = combined.splice(globalIdx, 1)[0];
    combined.unshift(item);

    const rebuiltExisting: string[] = [];
    const rebuiltFiles: File[] = [];
    const rebuiltPreviews: string[] = [];
    for (const c of combined) {
      if (c.type === 'existing') {
        rebuiltExisting.push(c.url);
      } else {
        rebuiltPreviews.push(c.url);
        if (c.file) rebuiltFiles.push(c.file);
      }
    }
    setExistingImages(rebuiltExisting);
    setNewFiles(rebuiltFiles);
    setNewPreviews(rebuiltPreviews);
  }

  async function analyzeImage() {
    // Get the first image to analyze
    let imageToAnalyze: File | null = null;

    if (newFiles.length > 0) {
      imageToAnalyze = newFiles[0];
    } else if (existingImages.length > 0) {
      // Fetch the existing image as a file
      try {
        const res = await fetch(existingImages[0]);
        const blob = await res.blob();
        imageToAnalyze = new File([blob], 'analyze.webp', { type: blob.type });
      } catch {
        setError('Bild konnte nicht geladen werden');
        return;
      }
    }

    if (!imageToAnalyze) {
      setError('Kein Bild zum Analysieren vorhanden');
      return;
    }

    setAnalyzing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', imageToAnalyze);
      const res = await fetch('/api/admin/analyze-image', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'KI-Analyse fehlgeschlagen');
        return;
      }

      // Fill in the form fields
      if (data.title) setAlt(data.title);
      if (data.tags && Array.isArray(data.tags)) setTags(data.tags.join(', '));
      if (data.category) setCategory(data.category);
    } catch {
      setError('Verbindungsfehler bei KI-Analyse');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!alt.trim()) {
      setError('Name ist erforderlich');
      return;
    }
    if (!category) {
      setError('Kategorie ist erforderlich');
      return;
    }
    if (!isEdit && newFiles.length === 0) {
      setError('Mindestens ein Bild ist erforderlich');
      return;
    }
    if (isEdit && existingImages.length === 0 && newFiles.length === 0) {
      setError('Mindestens ein Bild ist erforderlich');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('alt', alt.trim());
      formData.append('category', category);
      formData.append('tags', tags.trim());

      if (isEdit) {
        // Edit mode: send existing/remove/new lists
        formData.append('existingImages', JSON.stringify(existingImages));
        formData.append('removeImages', JSON.stringify(removeImages));
        for (const file of newFiles) {
          formData.append('newImages', file);
        }
      } else {
        // Create mode: send all files under 'images'
        for (const file of newFiles) {
          formData.append('images', file);
        }
      }

      const url = isEdit ? `/api/admin/products/${product.id}` : '/api/admin/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-warm-border">
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-5">
            <h2 className="font-display text-xl font-semibold text-warm-text">
              {isEdit ? 'Produkt bearbeiten' : 'Neues Produkt'}
            </h2>

            {/* Multi-image manager */}
            <div>
              <label className="block text-sm font-medium text-warm-text mb-1.5">
                Bilder {allImages.length > 0 && <span className="text-warm-muted font-normal">({allImages.length})</span>}
              </label>

              {/* Image thumbnails with reorder */}
              {allImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {allImages.map((img, idx) => (
                    <div key={`${img.type}-${img.index}`} className="relative group">
                      <div className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 ${idx === 0 ? 'border-accent' : 'border-warm-border'}`}>
                        <Image
                          src={img.url}
                          alt={`Bild ${idx + 1}`}
                          fill
                          className="object-cover"
                          unoptimized={img.type === 'new'}
                        />
                        {/* Cover badge */}
                        {idx === 0 && (
                          <span className="absolute top-0.5 left-0.5 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none font-medium">
                            Cover
                          </span>
                        )}
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => img.type === 'existing' ? handleRemoveExisting(img.url) : handleRemoveNew(img.index)}
                          className="absolute top-0.5 right-0.5 bg-red-600/90 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          title="Bild entfernen"
                        >
                          &times;
                        </button>
                      </div>
                      {/* Action buttons below thumbnail */}
                      <div className="flex items-center justify-center gap-0.5 mt-1">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => moveImage(idx, 'left')}
                            className="p-0.5 rounded hover:bg-warm-bg text-warm-muted hover:text-warm-text transition-colors"
                            title="Nach links"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                        )}
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => makeCover(idx)}
                            className="px-1 py-0.5 rounded text-[10px] bg-accent-50 text-accent-dark hover:bg-accent-light transition-colors font-medium"
                            title="Als Hauptbild setzen"
                          >
                            Cover
                          </button>
                        )}
                        {idx < allImages.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveImage(idx, 'right')}
                            className="p-0.5 rounded hover:bg-warm-bg text-warm-muted hover:text-warm-text transition-colors"
                            title="Nach rechts"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add image button / drop zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => { if (e.target.files?.length) handleAddFiles(e.target.files); e.target.value = ''; }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="w-full py-3 rounded-lg border-2 border-dashed border-warm-border hover:border-accent/50 bg-warm-bg text-warm-muted text-sm transition-colors disabled:opacity-50"
              >
                {processing ? 'Bilder werden verarbeitet...' : 'Bild hinzufuegen'}
              </button>
            </div>

            {/* AI Analyze button */}
            {(existingImages.length > 0 || newFiles.length > 0) && (
              <button
                type="button"
                onClick={analyzeImage}
                disabled={analyzing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-50 text-accent-dark text-sm hover:bg-accent-light transition-colors disabled:opacity-50 font-medium"
              >
                {analyzing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    KI analysiert...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    KI analysieren
                  </>
                )}
              </button>
            )}

            {/* Name */}
            <div>
              <label htmlFor="prod-alt" className="block text-sm font-medium text-warm-text mb-1">
                Name
              </label>
              <input
                id="prod-alt"
                type="text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                placeholder="z.B. Namensschild Eiche"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="prod-category" className="block text-sm font-medium text-warm-text mb-1">
                Kategorie
              </label>
              <select
                id="prod-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="prod-tags" className="block text-sm font-medium text-warm-text mb-1">
                Tags <span className="text-warm-muted font-normal">(kommagetrennt, optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="prod-tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  placeholder="z.B. geburt, geschenk, holz"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!alt.trim()) return;
                    const words = alt
                      .toLowerCase()
                      .replace(/[^a-zäöüß\s-]/g, '')
                      .split(/\s+/)
                      .filter(w => w.length > 2 && !['mit', 'und', 'für', 'aus', 'auf', 'von', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'auch', 'bei', 'zum', 'zur', 'ins'].includes(w));
                    const catName = categories.find(c => c.slug === category)?.name?.toLowerCase() || '';
                    const allTags = Array.from(new Set([...words, ...(catName ? [catName] : [])]));
                    setTags(allTags.join(', '));
                  }}
                  className="px-3 py-2 rounded-lg border border-warm-border bg-accent-50 text-accent-dark text-sm hover:bg-accent-light transition-colors whitespace-nowrap"
                  title="Tags automatisch aus dem Namen generieren"
                >
                  Auto
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-warm-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-warm-muted hover:text-warm-text hover:bg-warm-bg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
