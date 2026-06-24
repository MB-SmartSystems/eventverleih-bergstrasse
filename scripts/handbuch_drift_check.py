#!/usr/bin/env python3
"""
Handbuch-Drift-Check (Eventverleih).

Vergleicht die Mail-Template-Keys, die der CODE tatsächlich erzeugt, gegen das,
was das Betriebshandbuch (docs/Eventverleih Bergstraße Betriebshandbuch.md, Teil B
„Mail-Inventar") dokumentiert. Findet:
  - STALE:        Key steht im Handbuch, aber kein Code erzeugt ihn mehr (z.B. entfernte Mail).
  - UNDOKUMENTIERT: Code erzeugt einen Key, der im Handbuch fehlt.
  - DYNAMISCH:    Template_Key wird im Code dynamisch gebaut (Ternär/Template-Literal/Variable)
                  → kann nicht statisch gematcht werden, manuell gegen Handbuch prüfen.

Exit 0 = synchron (oder nur erklärte Dynamik), Exit 1 = Drift gefunden.
Aufruf: python3 scripts/handbuch_drift_check.py
"""
import re, sys, subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HANDBUCH = REPO / "docs" / "Eventverleih Bergstraße Betriebshandbuch.md"
SRC = REPO / "src"

# Dynamisch erzeugte Keys (Ternär/Template-Literal/.tpl) — bekannt + im Handbuch geführt.
# Bewusst manuell gepflegt; bei neuen dynamischen Keys hier ergänzen.
DYNAMISCH_BEKANNT = {
    "angebot_freigegeben", "angebot_freigegeben_anmerkung", "rueckruf_vorschlag", "anfrage_abgelehnt",
    "termin_uebergabe_bestaetigung", "termin_rueckgabe_bestaetigung",
    "termin_1h_uebergabe", "termin_1h_rueckgabe",
    "anzahlung_pre14", "anzahlung_pre7", "anzahlung_pre3", "anzahlung_post3", "restzahlung_pre3",
}

KEY_RE = re.compile(r"^[a-z][a-z0-9_]+$")

def code_keys():
    """Statische literale Template_Key-Werte aus dem Code + Liste dynamischer Stellen."""
    # 1) Literale: Template_Key: "key"
    lit = subprocess.run(["grep", "-rhoE", r'Template_Key: *"[a-z0-9_]+"', str(SRC)],
                         capture_output=True, text=True).stdout
    static = set(re.findall(r'"([a-z0-9_]+)"', lit))
    # 2) Dynamische Stellen: Template_Key-Zeilen, die KEIN reines Literal + keine Typ-Deklaration sind
    allrefs = subprocess.run(["grep", "-rnE", r'Template_Key:', str(SRC)],
                            capture_output=True, text=True).stdout
    dynamic_lines = []
    for line in allrefs.splitlines():
        rhs = line.split("Template_Key:", 1)[1].strip() if "Template_Key:" in line else ""
        if rhs.startswith("string") or "string | null" in rhs:
            continue  # Typ-Deklaration
        if re.match(r'^"[a-z0-9_]+"', rhs):
            continue  # sauberes Literal → schon in static
        path = line.split(":", 1)[0].replace(str(SRC) + "/", "")
        dynamic_lines.append(f"{path} → {rhs[:45]}")
    return static, dynamic_lines

def handbuch_keys():
    """Template_Key-Spalte (letzte Zelle) der Tabellen im Abschnitt 'Mail-Inventar'."""
    txt = HANDBUCH.read_text(encoding="utf-8")
    # Abschnitt Mail-Inventar bis zur nächsten ###-Überschrift
    m = re.search(r"### Mail-Inventar(.+?)\n### ", txt, re.DOTALL)
    block = m.group(1) if m else ""
    keys = set()
    for line in block.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip().strip("`") for c in line.strip().strip("|").split("|")]
        if not cells:
            continue
        last = cells[-1]
        if KEY_RE.match(last) and "_" in last and last != "template_key":
            keys.add(last)
    return keys

def main():
    static, dynamic_lines = code_keys()
    code_all = static | DYNAMISCH_BEKANNT
    hb = handbuch_keys()

    stale = sorted(hb - code_all)
    undok = sorted(static - hb)

    print(f"Code (statisch): {len(static)} · dynamisch-bekannt: {len(DYNAMISCH_BEKANNT)} · Handbuch: {len(hb)}\n")
    drift = False
    if stale:
        drift = True
        print("🔴 STALE (im Handbuch, aber kein Code erzeugt sie mehr):")
        for k in stale: print(f"   - {k}")
    if undok:
        drift = True
        print("🟡 UNDOKUMENTIERT (Code erzeugt sie, fehlt im Handbuch):")
        for k in undok: print(f"   - {k}")
    if dynamic_lines:
        print("ℹ️  DYNAMISCH (manuell gegen Handbuch prüfen):")
        for d in dynamic_lines: print(f"   - {d}")
    if not drift:
        print("✅ Handbuch-Mail-Inventar synchron mit dem Code.")
    sys.exit(1 if drift else 0)

if __name__ == "__main__":
    main()
