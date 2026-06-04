'use client';

/**
 * Bild-Zuschnitt im Admin — react-easy-crop mit Standard-Format-Presets.
 * Rahmen ziehen/zoomen (touch-fähig), Zuschnitt passiert clientseitig im Canvas;
 * hochgeladen wird nur das fertige JPEG. Quelle muss eine same-origin- oder
 * Objekt-URL sein (kein Canvas-Tainting — Aufrufer fetcht fremde URLs als Blob).
 */
import { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';

const PRESETS: { label: string; aspect: number }[] = [
  { label: 'Karte (1,23:1)', aspect: 1.23 },
  { label: 'Quadrat (1:1)', aspect: 1 },
  { label: '4:3', aspect: 4 / 3 },
  { label: '16:9', aspect: 16 / 9 },
  { label: 'Hochformat (3:4)', aspect: 3 / 4 },
];

async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Zuschnitt fehlgeschlagen'))), 'image/jpeg', 0.92),
  );
}

export default function ImageCropDialog({
  open,
  imageUrl,
  onClose,
  onCropped,
}: {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1.23);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const onCropComplete = useCallback((_: Area, pixels: Area) => setAreaPixels(pixels), []);

  if (!open) return null;

  async function handleApply() {
    if (!areaPixels) return;
    setWorking(true);
    setError('');
    try {
      const blob = await cropToBlob(imageUrl, areaPixels);
      onCropped(blob);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zuschnitt fehlgeschlagen');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-warm-surface rounded-2xl shadow-xl w-full max-w-2xl border border-warm-border overflow-hidden">
        <div className="p-4 border-b border-warm-border flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-warm-text">Bild zuschneiden</h3>
          <button type="button" onClick={onClose} className="text-warm-muted hover:text-warm-text text-xl leading-none px-2" aria-label="Schließen">
            &times;
          </button>
        </div>

        {/* Format-Presets */}
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setAspect(p.aspect)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                Math.abs(aspect - p.aspect) < 0.001
                  ? 'bg-accent text-white'
                  : 'bg-warm-bg text-warm-muted hover:text-warm-text border border-warm-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Cropper */}
        <div className="relative h-[50vh] min-h-[280px] m-4 rounded-lg overflow-hidden bg-black/80">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom + Aktionen */}
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-warm-muted w-12">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--accent,#b8860b)]"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-warm-border text-warm-muted hover:text-warm-text text-sm transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={working || !areaPixels}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {working ? 'Schneidet zu…' : 'Zuschneiden übernehmen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
