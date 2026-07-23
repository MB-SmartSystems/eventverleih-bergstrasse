import { TEMPLATES, UNCOVERED } from '@/lib/eventverleih/mail-templates/registry';
import { pruefeText } from '@/lib/eventverleih/mail-templates/pruefungen';
import VorlagenListe, { type VorlagenAnsicht } from './VorlagenListe';

/**
 * Read-only overview of every mail the system can send.
 *
 * The texts are not stored anywhere — they are produced here by calling the very
 * same build functions the live mail paths call. That is the whole point: an
 * overview fed from a copy would drift, this one structurally cannot.
 */

export const metadata = { title: 'E-Mail-Vorlagen' };

const FREIGABE_TEXT: Record<string, string> = {
  automatisch: 'Geht automatisch raus',
  'durch-admin-aktion': 'Durch Admin-Aktion',
  'wartet-auf-freigabe': 'Wartet auf Freigabe',
};

export default function VorlagenPage() {
  const vorlagen: VorlagenAnsicht[] = TEMPLATES.map((t) => ({
    tpl: t.tpl,
    title: t.title,
    trigger: t.trigger,
    freigabe: t.freigabe,
    freigabeText: FREIGABE_TEXT[t.freigabe] ?? t.freigabe,
    source: t.source,
    beispiele: t.examples.map((ex) => {
      const mail = t.build(ex.ctx);
      return {
        label: ex.label,
        subject: mail.subject,
        body: mail.body,
        befunde: pruefeText(mail),
      };
    }),
  }));

  let fehler = 0;
  let hinweise = 0;
  let mitBefund = 0;
  vorlagen.forEach((v) => {
    let hat = false;
    v.beispiele.forEach((b) => {
      b.befunde.forEach((x) => {
        if (x.schwere === 'fehler') fehler++;
        else hinweise++;
        hat = true;
      });
    });
    if (hat) mitBefund++;
  });

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-warm-text">E-Mail-Vorlagen</h1>
        <p className="mt-2 text-sm text-warm-muted">
          Alle Texte, die dieses System an Kunden verschicken kann. Sie werden hier nicht gespeichert,
          sondern beim Aufruf aus dem Code erzeugt. Es ist derselbe Text, den der Kunde bekommt.
          Diese Seite zeigt nur an, sie ändert nichts.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg border border-warm-border bg-warm-surface px-3 py-1.5 text-warm-text">
          {vorlagen.length} Vorlagen
        </span>
        <span className="rounded-lg border border-warm-border bg-warm-surface px-3 py-1.5 text-warm-text">
          {mitBefund} mit Befunden
        </span>
        <span className="rounded-lg border border-[#5a2d2d] bg-[#2a1616] px-3 py-1.5 text-[#fca5a5]">
          {fehler} Fehler
        </span>
        <span className="rounded-lg border border-[#4a3c1e] bg-[#221c10] px-3 py-1.5 text-[#fcd34d]">
          {hinweise} Hinweise
        </span>
      </div>

      <VorlagenListe vorlagen={vorlagen} />

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-warm-text">Noch nicht erfasst</h2>
        <p className="mt-2 text-sm text-warm-muted">
          Diese Vorlagen verschickt das System ebenfalls, die Übersicht zeigt ihren Text aber noch nicht.
          Sie stehen hier, damit die Liste oben nicht vollständiger wirkt als sie ist.
        </p>
        <div className="mt-4 space-y-3">
          {UNCOVERED.map((u) => (
            <div key={u.tpl} className="rounded-xl border border-warm-border bg-warm-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-warm-text font-medium">{u.title}</span>
                <code className="font-mono text-xs text-warm-muted bg-[#0a0e17] border border-warm-border rounded px-1.5 py-0.5">
                  {u.tpl}
                </code>
              </div>
              <p className="mt-1.5 text-sm text-warm-muted">{u.reason}</p>
              <p className="mt-1 font-mono text-xs text-warm-muted break-all">{u.source}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
