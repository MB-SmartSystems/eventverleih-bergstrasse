'use client';

import { useState } from 'react';

/**
 * Read-only view. Nothing here writes, and nothing here reads Baserow — the page
 * hands over finished text. Switching example cases is the only interaction, and
 * it is the reason this part is a client component at all.
 */

export interface BefundAnsicht {
  regel: string;
  schwere: 'fehler' | 'hinweis';
  text: string;
  stelle: string;
}

export interface BeispielAnsicht {
  label: string;
  subject: string;
  body: string;
  befunde: BefundAnsicht[];
}

export interface VorlagenAnsicht {
  tpl: string;
  title: string;
  trigger: string;
  freigabe: string;
  freigabeText: string;
  source: string;
  beispiele: BeispielAnsicht[];
}

const FREIGABE_FARBE: Record<string, string> = {
  automatisch: 'bg-[#3a1f1f] text-[#fca5a5] border-[#5a2d2d]',
  'durch-admin-aktion': 'bg-[#2a2214] text-[#e8c872] border-[#4a3c1e]',
  'wartet-auf-freigabe': 'bg-[#152a22] text-[#7ee2b8] border-[#1e4436]',
};

function BefundZeile({ b }: { b: BefundAnsicht }) {
  const fehler = b.schwere === 'fehler';
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        fehler ? 'border-[#5a2d2d] bg-[#2a1616]' : 'border-[#4a3c1e] bg-[#221c10]'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className={fehler ? 'text-[#fca5a5] font-medium' : 'text-[#fcd34d] font-medium'}>
          {fehler ? 'Fehler' : 'Hinweis'}
        </span>
        <span className="text-warm-text">{b.text}</span>
      </div>
      <p className="mt-1 font-mono text-xs text-warm-muted break-words">{b.stelle}</p>
    </div>
  );
}

function Vorlage({ v }: { v: VorlagenAnsicht }) {
  const [aktiv, setAktiv] = useState(0);
  const b = v.beispiele[aktiv];
  const fehlerGesamt = v.beispiele.reduce(
    (n, ex) => n + ex.befunde.filter((x) => x.schwere === 'fehler').length,
    0,
  );

  return (
    <section className="rounded-2xl border border-warm-border bg-warm-surface overflow-hidden">
      <header className="px-5 py-4 border-b border-warm-border">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="font-display text-lg font-semibold text-warm-text">{v.title}</h2>
          <code className="font-mono text-xs text-warm-muted bg-[#0a0e17] border border-warm-border rounded px-1.5 py-0.5">
            {v.tpl}
          </code>
          <span
            className={`text-xs rounded-full border px-2 py-0.5 ${FREIGABE_FARBE[v.freigabe] ?? ''}`}
            title={v.freigabeText}
          >
            {v.freigabeText}
          </span>
          {fehlerGesamt > 0 && (
            <span className="text-xs rounded-full border border-[#5a2d2d] bg-[#2a1616] text-[#fca5a5] px-2 py-0.5">
              {fehlerGesamt === 1 ? '1 Fehler' : `${fehlerGesamt} Fehler`}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-warm-muted">
          <span className="text-warm-text">Auslöser:</span> {v.trigger}
        </p>
        <p className="mt-1 font-mono text-xs text-warm-muted break-all">{v.source}</p>
      </header>

      {v.beispiele.length > 1 && (
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {v.beispiele.map((ex, i) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setAktiv(i)}
              className={`text-sm rounded-lg px-3 py-1.5 border transition-colors ${
                i === aktiv
                  ? 'border-accent bg-accent-light text-[#e8c872] font-medium'
                  : 'border-warm-border text-warm-muted hover:text-warm-text hover:bg-accent-50'
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 py-4 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-warm-muted mb-1">Betreff</p>
          <p className="font-mono text-sm text-warm-text bg-[#0a0e17] border border-warm-border rounded-lg px-3 py-2 break-words">
            {b.subject}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-warm-muted mb-1">Text</p>
          <pre className="font-mono text-sm text-warm-text bg-[#0a0e17] border border-warm-border rounded-lg px-3 py-3 whitespace-pre-wrap break-words">
            {b.body}
          </pre>
        </div>
        {b.befunde.length > 0 && (
          <div className="space-y-2">
            {b.befunde.map((x, i) => (
              <BefundZeile key={`${x.regel}-${i}`} b={x} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function VorlagenListe({ vorlagen }: { vorlagen: VorlagenAnsicht[] }) {
  return (
    <div className="space-y-4">
      {vorlagen.map((v) => (
        <Vorlage key={v.tpl} v={v} />
      ))}
    </div>
  );
}
