'use client';

import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { GalleryProduct } from '@/lib/types';

interface Props {
  product: GalleryProduct;
  bulkMode: boolean;
  selected: boolean;
  dragEnabled: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (p: GalleryProduct) => void;
  onDelete: (p: GalleryProduct) => void;
  onToggleVisible: (id: string, current: boolean) => void;
  onTogglePinned: (id: string, current: boolean) => void;
  categoryIcon: string;
  categoryName: string;
}

export default function SortableProductCard({
  product,
  bulkMode,
  selected,
  dragEnabled,
  onToggleSelect,
  onEdit,
  onDelete,
  onToggleVisible,
  onTogglePinned,
  categoryIcon,
  categoryName,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id, disabled: !dragEnabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-warm-surface rounded-xl border border-warm-border overflow-hidden hover:shadow-md transition-all relative ${
        !product.visible ? 'opacity-50' : ''
      } ${bulkMode && selected ? 'ring-2 ring-accent' : ''} ${isDragging ? 'shadow-xl ring-2 ring-accent' : ''}`}
      onClick={bulkMode ? () => onToggleSelect(product.id) : undefined}
    >
      {/* Bulk checkbox */}
      {bulkMode && (
        <div className="absolute top-2 left-2 z-20">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(product.id)}
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

      {/* Drag handle (nur wenn Umsortieren aktiv) */}
      {dragEnabled && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-warm-surface/90 text-warm-muted hover:text-warm-text hover:bg-warm-surface transition-colors cursor-grab active:cursor-grabbing touch-none shadow-sm"
          title="Ziehen zum Umsortieren (innerhalb der Kategorie)"
          aria-label="Umsortieren"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM13 4a1 1 0 100 2 1 1 0 000-2zM13 9a1 1 0 100 2 1 1 0 000-2zM13 14a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
        </button>
      )}

      {/* Hidden badge */}
      {!product.visible && !dragEnabled && (
        <div className="absolute top-2 right-2 z-10 bg-warm-muted/80 text-white rounded-full p-1" title="Versteckt">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
          </svg>
        </div>
      )}

      {/* Condition badges — beide koennen gleichzeitig sichtbar sein */}
      {(product.quantityBroken ?? 0) > 0 && (
        <div
          className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/90 text-white"
          title={`${product.quantityBroken} defekt`}
        >
          {product.quantityBroken} Defekt
        </div>
      )}
      {(product.quantityRepair ?? 0) > 0 && (
        <div
          className={`absolute z-10 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/90 text-white ${
            (product.quantityBroken ?? 0) > 0 ? 'bottom-9 right-2' : 'bottom-2 right-2'
          }`}
          title={`${product.quantityRepair} reparaturbeduerftig`}
        >
          {product.quantityRepair} Repair
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
              onClick={() => onEdit(product)}
              className="p-2 bg-warm-surface/90 rounded-lg hover:bg-warm-surface transition-colors"
              title="Bearbeiten"
            >
              <svg className="w-4 h-4 text-warm-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(product)}
              className="p-2 bg-warm-surface/90 rounded-lg hover:bg-red-50 transition-colors"
              title="Löschen"
            >
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={() => onToggleVisible(product.id, product.visible)}
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
              onClick={() => onTogglePinned(product.id, product.pinned)}
              className={`p-2 bg-warm-surface/90 rounded-lg hover:bg-warm-surface transition-colors ${product.pinned ? 'text-accent' : 'text-warm-text'}`}
              title={product.pinned ? 'Lösen' : 'Anpinnen'}
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
          Bestand: {(product.quantityOk ?? 0) + (product.quantityRepair ?? 0) + (product.quantityBroken ?? 0)} · vermietbar {product.quantityOk ?? 0}
        </p>
        <p className="text-xs text-warm-muted mt-0.5">
          {categoryIcon} {categoryName}
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
              onClick={() => onEdit(product)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-accent-50 text-accent-dark text-xs font-medium hover:bg-accent-light transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Bearbeiten
            </button>
            <button
              onClick={() => onToggleVisible(product.id, product.visible)}
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
              onClick={() => onTogglePinned(product.id, product.pinned)}
              className={`p-1.5 rounded-lg transition-colors ${product.pinned ? 'bg-accent text-white' : 'bg-accent-50 text-accent-dark hover:bg-accent-light'}`}
              title={product.pinned ? 'Lösen' : 'Anpinnen'}
            >
              <svg className="w-3.5 h-3.5" fill={product.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(product)}
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
  );
}
