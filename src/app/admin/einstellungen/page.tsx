'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { SiteSettings } from '@/lib/types';
import { resizeImage } from '@/lib/image-utils';

const emptySettings: SiteSettings = {
  phone: '',
  whatsapp: '',
  email: '',
  instagram: '',
};

export default function EinstellungenPage() {
  const [settings, setSettings] = useState<SiteSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || emptySettings);
      }
    } catch {
      setError('Einstellungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSuccess('Einstellungen gespeichert');
        setTimeout(() => setSuccess(''), 3000);
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

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setUploadingHero(true);
    setError('');
    try {
      const resized = await resizeImage(file, 1200);
      const formData = new FormData();
      formData.append('image', resized);
      const res = await fetch('/api/admin/settings/hero-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.heroImage) {
        setSettings(prev => ({ ...prev, heroImage: data.heroImage }));
        setSuccess('Titelbild aktualisiert');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Fehler beim Hochladen');
      }
    } catch {
      setError('Verbindungsfehler beim Hochladen');
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = '';
    }
  }

  if (loading) {
    return <p className="text-warm-muted">Laden...</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-warm-text">Einstellungen</h1>
        <p className="text-warm-muted text-sm mt-0.5">Titelbild, Kontaktdaten und Social Media</p>
      </div>

      {/* Hero Image */}
      <div className="bg-warm-surface rounded-2xl border border-warm-border p-6 max-w-lg mb-6">
        <h2 className="font-display text-base font-semibold text-warm-text mb-3">Titelbild</h2>
        <p className="text-warm-muted text-xs mb-3">Das grosse Bild rechts auf der Startseite.</p>

        <div className="flex items-start gap-4">
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-warm-border flex-shrink-0">
            {settings.heroImage ? (
              <Image
                src={settings.heroImage}
                alt="Aktuelles Titelbild"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-warm-bg flex items-center justify-center">
                <Image
                  src="/images/titelbild/20260323_223753.webp"
                  alt="Standard-Titelbild"
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={heroInputRef}
              type="file"
              accept="image/*"
              onChange={handleHeroUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => heroInputRef.current?.click()}
              disabled={uploadingHero}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {uploadingHero ? 'Hochladen...' : 'Neues Bild waehlen'}
            </button>
            <p className="text-[11px] text-warm-muted">Empfohlen: quadratisch, min. 500x500px</p>
          </div>
        </div>
      </div>

      {/* Contact settings */}
      <div className="bg-warm-surface rounded-2xl border border-warm-border p-6 max-w-lg">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-warm-text mb-1">
              Telefon
            </label>
            <input
              id="phone"
              type="tel"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              placeholder="+49 123 456789"
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-warm-text mb-1">
              WhatsApp-Nummer
            </label>
            <input
              id="whatsapp"
              type="tel"
              value={settings.whatsapp}
              onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              placeholder="+49 123 456789"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-warm-text mb-1">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              placeholder="info@unikat-m.de"
            />
          </div>

          {/* Instagram */}
          <div>
            <label htmlFor="instagram" className="block text-sm font-medium text-warm-text mb-1">
              Instagram-Link
            </label>
            <input
              id="instagram"
              type="url"
              value={settings.instagram}
              onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              placeholder="https://instagram.com/unikat.m"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {success}
            </div>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
