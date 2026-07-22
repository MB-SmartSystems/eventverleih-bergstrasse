#!/usr/bin/env node
/**
 * Korrektur-Helfer zum Umlaut-Gate: ersetzt in den vom Gate gemeldeten Wörtern die
 * ASCII-Transliteration durch echte Umlaute. Arbeitet NUR auf Wörtern, die das Gate
 * als Fließtext-Treffer meldet — Bezeichner, Slugs und Datenbankwerte fasst es nicht an.
 *
 * Aufruf: node scripts/fix-umlaute.mjs [verzeichnis ...]
 * Danach IMMER das Gate erneut laufen lassen und den Diff durchsehen.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const zielverzeichnisse = process.argv.slice(2)
let ausgabe = ''
try {
  execSync(`node scripts/check-umlaute.mjs ${zielverzeichnisse.join(' ')}`, { stdio: 'pipe' })
  console.log('Nichts zu tun — Gate ist bereits grün.')
  process.exit(0)
} catch (e) {
  ausgabe = (e.stderr?.toString() || '') + (e.stdout?.toString() || '')
}

// Zeilen der Form "  pfad:zeile  wort1, wort2" — die Zeilennummer ist entscheidend:
// dateiweit zu ersetzen trifft Bezeichner, die dasselbe Wort enthalten. Am 2026-07-22
// wurden so "UebergabeDialogProps" und "RuecknahmeDialogProps" umbenannt und der Build
// brach. Deshalb wird AUSSCHLIESSLICH die gemeldete Zeile angefasst.
const treffer = new Map() // datei -> Map(zeilennr -> Set(wörter))
for (const zeile of ausgabe.split('\n')) {
  const m = zeile.match(/^ {2}(\S+):(\d+) {2}(.+)$/)
  if (!m) continue
  const [, datei, nr, woerter] = m
  if (!treffer.has(datei)) treffer.set(datei, new Map())
  const proDatei = treffer.get(datei)
  const n = Number(nr)
  if (!proDatei.has(n)) proDatei.set(n, new Set())
  for (const w of woerter.split(',')) proDatei.get(n).add(w.trim())
}

// Wörter, bei denen ss zu ß wird. Alle anderen bekommen nur ae/oe/ue → ä/ö/ü.
const SZ = /^(gross|groess|heiss|weiss|strass|fussball|massnahm|massstab|gemaess|schliess|beschliess|entschliess|geniess|ausschliess|regelmaess|zuverlaess|grundsaetz|spass|fuss|stoss|anstoss|verstoss|aeusser|fliess)/i

function umlauten(wort) {
  let neu = wort
    .replace(/ae/g, 'ä').replace(/Ae/g, 'Ä')
    .replace(/oe/g, 'ö').replace(/Oe/g, 'Ö')
    .replace(/ue/g, 'ü').replace(/Ue/g, 'Ü')
  if (SZ.test(wort)) neu = neu.replace(/ss/g, 'ß').replace(/SS/g, 'ß')
  return neu
}

let geaendert = 0
for (const [datei, proZeile] of treffer) {
  let inhalt
  try { inhalt = readFileSync(datei, 'utf8') } catch { continue }
  const zeilen = inhalt.split('\n')
  let dateiGeaendert = false
  for (const [nr, woerter] of proZeile) {
    const idx = nr - 1
    if (idx < 0 || idx >= zeilen.length) continue
    const vorher = zeilen[idx]
    let neuZeile = vorher
    for (const wort of woerter) {
      const ersetzt = umlauten(wort)
      if (ersetzt === wort) continue
      neuZeile = neuZeile.replace(new RegExp(`\\b${wort}\\b`, 'g'), ersetzt)
    }
    if (neuZeile !== vorher) {
      zeilen[idx] = neuZeile
      dateiGeaendert = true
      console.log(`  ${datei}:${nr}  ${[...woerter].join(', ')}`)
    }
  }
  if (dateiGeaendert) {
    writeFileSync(datei, zeilen.join('\n'), 'utf8')
    geaendert++
  }
}
console.log(`\n${geaendert} Datei(en) geändert. Gate erneut laufen lassen und Diff prüfen.`)
