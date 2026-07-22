#!/usr/bin/env node
/**
 * Umlaut-Gate — bricht den Build ab, wenn kundensichtbarer deutscher Text
 * ASCII-Transliteration statt echter Umlaute enthält ("fuer" statt "für", "grosse"
 * statt "große").
 *
 * Warum als Gate und nicht als Notiz: Die Regel "immer echte Umlaute" existiert seit
 * 2026-07-15. Am 2026-07-21 ging trotzdem ein Blogartikel mit "gefaehrlichste" im Titel
 * live. Eine Regel, die nur gelesen werden muss, verhindert das nicht — ein roter Build
 * verhindert es.
 *
 * Bewusst NICHT geprüft werden URL-Slugs, href-Ziele und Dateinamen: dort ist ASCII
 * vorgeschrieben (Umlaute in Slugs erzeugen live 404).
 *
 * Aufruf: node scripts/check-umlaute.mjs [verzeichnis ...]
 * Ohne Argumente werden die üblichen Content-Verzeichnisse gescannt.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

// Wörter, die im Deutschen einen Umlaut tragen MÜSSEN. Bewusst eine Positivliste statt
// einer ae/oe/ue-Heuristik — sonst schlägt das Gate bei "Neuerung", "Dauer", "Steuer",
// englischen Begriffen und Eigennamen an.
const VERDAECHTIG = [
  'fuer', 'ueber', 'ueberhaupt', 'koennen', 'koennte', 'muessen',
  'waehrend', 'naechste[nrs]?', 'gefaehrlich\\w*', 'zurueck\\w*',
  'haeufig\\w*', 'moeglich\\w*', 'aendern', 'aenderung\\w*', 'erklaeren',
  'waehlen', 'dafuer', 'hierfuer', 'wofuer', 'natuerlich', 'urspruenglich', 'zusaetzlich',
  'geschaeft\\w*', 'qualitaet', 'realitaet', 'verfuegbar', 'beruecksichtig\\w*',
  'praezise', 'loesung\\w*', 'unterstuetz\\w*', 'einfuehrung', 'ueblich\\w*', 'spaeter',
  'taeglich', 'jaehrlich', 'erhoeh\\w*', 'pruefen', 'pruefung\\w*', 'auswaehl\\w*',
  'beitraege', 'auftraege', 'vertraege', 'anhaeng\\w*',
  'prioritaet', 'kapazitaet', 'aktivitaet', 'funktionalitaet', 'stueck\\w*', 'kuenftig',
  'moechte[nst]?', 'wuensch\\w*', 'benoetig\\w*', 'ermoeglich\\w*',
  'guenstig\\w*', 'ueblicherweise', 'schuetz\\w*', 'gehoer\\w*', 'stoer\\w*',

  // ss statt ß — von Manuel ausdrücklich als eigener Fehlerfall benannt (2026-07-22).
  // Vorsicht: nur Wörter, die IMMER ein ß tragen. "dass", "muss", "Fluss", "Kuss",
  // "Schluss", "wissen", "Kongress" sind korrektes ss und dürfen hier NICHT stehen.
  'gross(?:e[nmrs]?|artig\\w*)?', 'groesse\\w*', 'groesser', 'groesste[nrs]?',
  'heisst', 'heissen', 'weiss(?!ag)', 'weisse[nrs]?', 'strasse\\w*', 'fussball\\w*',
  'massnahme\\w*', 'massstab\\w*', 'gemaess', 'schliesslich', 'ausschliesslich',
  'regelmaessig\\w*', 'zuverlaessig\\w*', 'grundsaetzlich', 'spass', 'fuss\\w*',
  'geniess\\w*', 'schliess\\w*', 'beschliess\\w*', 'entschliess\\w*', 'stossen',
  'anstoss\\w*', 'verstoss\\w*', 'groesstenteils', 'aeusserst', 'aeusser\\w*',
]

// Verzeichnisse mit kundensichtbarem Text. Nicht vorhandene werden übersprungen.
const STANDARD_ORTE = ['content', 'data', 'app', 'components', 'posts', 'src']
const ENDUNGEN = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx'])
const UEBERSPRINGEN = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'public'])

// Zeilen, die ASCII enthalten DÜRFEN (Slugs, Links, Importe, Dateipfade).
const AUSNAHME = new RegExp([
  'slug:', 'href=', 'src=', 'src:', 'url:', 'canonical', 'https?://', 'import ', "from '",
  'require\\(', '/blog/', '/ratgeber/',
  '\\.(?:png|jpe?g|webp|svg|gif|pdf|mp4)',   // Dateinamen sind ASCII, das ist korrekt
].join('|'))

// Code-Kommentare sind nicht kundensichtbar — sonst schlaegt das Gate bei jedem
// deutschen Entwicklerkommentar an und wird dadurch ignoriert.
const KOMMENTAR = /^\s*(\/\/|\*|\/\*|\{\/\*|#)/

const regex = new RegExp(`\\b(${VERDAECHTIG.join('|')})\\b`, 'gi')

function dateien(ort) {
  const ergebnis = []
  if (!existsSync(ort)) return ergebnis
  const stack = [ort]
  while (stack.length) {
    const p = stack.pop()
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) {
      for (const e of readdirSync(p)) {
        if (!UEBERSPRINGEN.has(e)) stack.push(join(p, e))
      }
    } else if (ENDUNGEN.has(extname(p))) {
      ergebnis.push(p)
    }
  }
  return ergebnis
}

const orte = process.argv.slice(2).length ? process.argv.slice(2) : STANDARD_ORTE
let funde = 0
for (const ort of orte) {
  for (const datei of dateien(ort)) {
    let inhalt
    try { inhalt = readFileSync(datei, 'utf8') } catch { continue }
    inhalt.split('\n').forEach((zeile, i) => {
      if (AUSNAHME.test(zeile) || KOMMENTAR.test(zeile)) return
      // Nur Fliesstext werten, keine Bezeichner. "verfuegbar: true" und "p.verfuegbar"
      // sind Code und aendern nichts an dem, was ein Besucher liest; "Waehlen Sie einen
      // Zeitraum" schon. Kriterium: links oder rechts steht ein weiteres Wort mit
      // Leerzeichen dazwischen, und direkt am Wort haengt kein Code-Zeichen (. : ( ).
      const treffer = []
      for (const m of zeile.matchAll(regex)) {
        const davor = zeile.slice(Math.max(0, m.index - 2), m.index)
        const danach = zeile.slice(m.index + m[0].length, m.index + m[0].length + 2)
        const istBezeichner = /[._]$/.test(davor) || /^\s*[:(._=]/.test(danach)
        const imSatz = /[a-zA-ZäöüÄÖÜß],?\s$/.test(davor) || /^\s[a-zA-ZäöüÄÖÜß]/.test(danach)
        if (!istBezeichner && imSatz) treffer.push(m[0])
      }
      if (treffer.length) {
        funde += treffer.length
        console.error(`  ${datei}:${i + 1}  ${[...new Set(treffer)].join(', ')}`)
        console.error(`      ${zeile.trim().slice(0, 120)}`)
      }
    })
  }
}

if (funde > 0) {
  console.error(`\n✖ Umlaut-Gate: ${funde} Stelle(n) mit ASCII-Transliteration in kundensichtbarem Text.`)
  console.error('  Echte Umlaute verwenden (ä ö ü ß). Nur URL-Slugs bleiben ASCII.')
  process.exit(1)
}
console.log('✔ Umlaut-Gate: keine ASCII-Transliteration in kundensichtbarem Text.')
