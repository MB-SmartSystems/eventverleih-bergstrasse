'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { GalleryProduct, ProductCategory } from '@/lib/types';
import { resizeImage } from '@/lib/image-utils';

interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (product: GalleryProduct) => void;
  product?: GalleryProduct;
  categories: ProductCategory[];
}

export default function ProductDialog({ open, onClose, onSaved, product, categories }: ProductDialogProps) {
  const [alt, setAlt] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('pro Miete (bis zu 5 Tage)');
  const [description, setDescription] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [quantityOk, setQuantityOk] = useState(1);
  const [quantityRepair, setQuantityRepair] = useState(0);
  const [quantityBroken, setQuantityBroken] = useState(0);
  const [location, setLocation] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderImages, setFolderImages] = useState<{ filename: string; url: string }[]>([]);
  const [loadingFolder, setLoadingFolder] = useState(false);

  // Multi-image state
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removeImages, setRemoveImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!product;

  useEffect(() => {
    if (open) {
      setAlt(product?.name ?? '');
      setCategory(product?.category ?? (categories[0]?.slug ?? ''));
      setTags(product?.tags?.join(', ') ?? '');
      setPrice(product?.price ?? '');
      setPriceUnit(product?.priceUnit ?? 'pro Miete (bis zu 5 Tage)');
      setDescription(product?.description ?? '');
      setYoutubeLink(product?.youtubeLink ?? '');
      setQuantityOk(product?.quantityOk ?? 1);
      setQuantityRepair(product?.quantityRepair ?? 0);
      setQuantityBroken(product?.quantityBroken ?? 0);
      setLocation(product?.location ?? '');
      setInternalNotes(product?.internalNotes ?? '');
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
      formData.append('name', alt.trim());
      formData.append('category', category);
      formData.append('tags', tags.trim());
      formData.append('price', price.trim());
      formData.append('priceUnit', priceUnit.trim());
      formData.append('description', description.trim());
      formData.append('youtubeLink', youtubeLink.trim());
      formData.append('quantityOk', String(quantityOk));
      formData.append('quantityRepair', String(quantityRepair));
      formData.append('quantityBroken', String(quantityBroken));
      formData.append('location', location.trim());
      formData.append('internalNotes', internalNotes.trim());

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

      const data = await res.json();
      if (data.product) onSaved(data.product);
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  className="py-3 rounded-lg border-2 border-dashed border-warm-border hover:border-accent/50 bg-warm-bg text-warm-muted text-sm transition-colors disabled:opacity-50"
                >
                  {processing ? 'Wird verarbeitet...' : '+ Neues Bild hochladen'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setPickerOpen(true);
                    setLoadingFolder(true);
                    try {
                      const res = await fetch('/api/admin/folder-images');
                      const data = await res.json();
                      setFolderImages(data.images || []);
                    } finally {
                      setLoadingFolder(false);
                    }
                  }}
                  className="py-3 rounded-lg border-2 border-dashed border-warm-border hover:border-accent/50 bg-warm-bg text-warm-muted text-sm transition-colors"
                >
                  Aus Produkte-Ordner waehlen
                </button>
              </div>
            </div>

            {/* Folder Image Picker */}
            {pickerOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={() => setPickerOpen(false)}>
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-warm-border" onClick={(e) => e.stopPropagation()}>
                  <div className="p-5 border-b border-warm-border flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold text-warm-text">Aus Produkte-Ordner waehlen</h3>
                    <button type="button" onClick={() => setPickerOpen(false)} className="text-warm-muted hover:text-warm-text">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-5">
                    {loadingFolder && <p className="text-warm-muted text-sm">Lade Bilder...</p>}
                    {!loadingFolder && folderImages.length === 0 && (
                      <p className="text-warm-muted text-sm">Keine Bilder im Ordner gefunden.</p>
                    )}
                    {!loadingFolder && folderImages.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {folderImages.map((img) => {
                          const alreadyAdded = existingImages.includes(img.url);
                          return (
                            <button
                              key={img.filename}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => {
                                setExistingImages((prev) => (prev.includes(img.url) ? prev : [...prev, img.url]));
                                setRemoveImages((prev) => prev.filter((u) => u !== img.url));
                              }}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${alreadyAdded ? 'border-accent opacity-50 cursor-not-allowed' : 'border-warm-border hover:border-accent'}`}
                              title={img.filename}
                            >
                              <Image src={img.url} alt={img.filename} fill className="object-cover" />
                              {alreadyAdded && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium">
                                  Zugeordnet
                                </span>
                              )}
                              <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-1.5 py-0.5 truncate">
                                {img.filename}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-warm-border flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(false)}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors"
                    >
                      Fertig
                    </button>
                  </div>
                </div>
              </div>
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

            {/* Description */}
            <div>
              <label htmlFor="prod-description" className="block text-sm font-medium text-warm-text mb-1">
                Beschreibung <span className="text-warm-muted font-normal">(optional)</span>
              </label>
              <input
                id="prod-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                placeholder="z.B. Platz für bis zu 12 Personen"
              />
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prod-price" className="block text-sm font-medium text-warm-text mb-1">
                  Preis
                </label>
                <input
                  id="prod-price"
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  placeholder="25 €"
                />
              </div>
              <div>
                <label htmlFor="prod-price-unit" className="block text-sm font-medium text-warm-text mb-1">
                  Preiseinheit
                </label>
                <input
                  id="prod-price-unit"
                  type="text"
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  placeholder="pro Miete (bis zu 5 Tage)"
                />
              </div>
            </div>

            {/* YouTube */}
            <div>
              <label htmlFor="prod-youtube" className="block text-sm font-medium text-warm-text mb-1">
                YouTube-Aufbauanleitung <span className="text-warm-muted font-normal">(optional)</span>
              </label>
              <input
                id="prod-youtube"
                type="url"
                value={youtubeLink}
                onChange={(e) => setYoutubeLink(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                placeholder="https://youtu.be/..."
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

            <div className="border-t border-warm-border pt-4 mt-2">
              <h3 className="text-sm font-semibold text-warm-text mb-3">Inventar (nur intern)</h3>

              <p className="text-xs text-warm-muted mb-3">Anzahl Einheiten pro Zustand. Gesamt: {quantityOk + quantityRepair + quantityBroken}, vermietbar: {quantityOk}.</p>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label htmlFor="prod-qty-ok" className="block text-xs font-medium text-green-600 mb-1">OK</label>
                  <input
                    id="prod-qty-ok"
                    type="number"
                    min={0}
                    value={quantityOk}
                    onChange={(e) => setQuantityOk(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prod-qty-repair" className="block text-xs font-medium text-yellow-600 mb-1">Reparatur</label>
                  <input
                    id="prod-qty-repair"
                    type="number"
                    min={0}
                    value={quantityRepair}
                    onChange={(e) => setQuantityRepair(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prod-qty-broken" className="block text-xs font-medium text-red-600 mb-1">Defekt</label>
                  <input
                    id="prod-qty-broken"
                    type="number"
                    min={0}
                    value={quantityBroken}
                    onChange={(e) => setQuantityBroken(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="prod-location" className="block text-sm font-medium text-warm-text mb-1">
                  Lagerort <span className="text-warm-muted font-normal">(optional)</span>
                </label>
                <input
                  id="prod-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  placeholder="z.B. Keller Regal 3"
                />
              </div>

              <div>
                <label htmlFor="prod-notes" className="block text-sm font-medium text-warm-text mb-1">
                  Interne Notiz <span className="text-warm-muted font-normal">(optional)</span>
                </label>
                <textarea
                  id="prod-notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors text-sm"
                  placeholder="z.B. 2 Stueck seit Maerz im Winterquartier"
                />
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
