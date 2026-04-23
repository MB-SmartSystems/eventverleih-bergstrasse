'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { resizeImage } from '@/lib/image-utils';

interface ImageUploadProps {
  currentImage?: string;
  onFileSelected: (file: File) => void;
}

export default function ImageUpload({ currentImage, onFileSelected }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;
      setProcessing(true);
      try {
        const resized = await resizeImage(file);
        setPreview(URL.createObjectURL(resized));
        onFileSelected(resized);
      } finally {
        setProcessing(false);
      }
    },
    [onFileSelected]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const displayImage = preview || currentImage;

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative w-full aspect-[4/3] rounded-lg border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
        dragging
          ? 'border-accent bg-accent-50'
          : 'border-warm-border hover:border-accent/50 bg-warm-bg'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {processing ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-warm-muted text-sm">Bild wird verarbeitet...</p>
        </div>
      ) : displayImage ? (
        <>
          <Image
            src={displayImage}
            alt="Vorschau"
            fill
            className="object-cover"
            unoptimized={preview !== null}
          />
          {/* Desktop: hover overlay */}
          <div className="hidden sm:flex absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors items-center justify-center opacity-0 hover:opacity-100">
            <span className="bg-warm-surface/90 text-warm-text text-xs px-3 py-1.5 rounded-full">
              Bild aendern
            </span>
          </div>
          {/* Mobile: always-visible change indicator */}
          <div className="sm:hidden absolute bottom-2 right-2">
            <span className="bg-warm-surface/90 text-warm-text text-xs px-2.5 py-1 rounded-full shadow-sm border border-warm-border">
              Aendern
            </span>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-warm-muted">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm">Bild hierher ziehen oder klicken</p>
        </div>
      )}
    </div>
  );
}
