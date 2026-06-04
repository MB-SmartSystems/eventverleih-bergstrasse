/**
 * Mietvertragstext — operative Klauseln, getrennt von der öffentlichen AGB.
 *
 * Wird auf /vertrag/[token] eingebunden. AGB bleibt schlank und allgemein,
 * dieser Vertragstext enthält die Vorgangs-Details — die nicht öffentlich gelistet werden
 * müssen, sondern nur den Kunden im konkreten Buchungsfall erreichen.
 *
 * Klausel-Quellen: Audit `agb-vertrag-2026-05-13.md` + 306partyrentals.com Patterns.
 */
export default function MietvertragText() {
  return (
    <article className="prose prose-sm prose-gray max-w-none text-gray-800 space-y-4 [&_h2]:text-gray-900 [&_h3]:text-gray-900 [&_p]:text-gray-800 [&_strong]:text-gray-900 [&_table]:text-gray-800 [&_th]:text-gray-700 [&_a]:text-gray-900 [&_a]:underline">
      <h2 className="text-xl font-bold text-gray-900">Mietvertrag — Bedingungen</h2>
      <p className="text-xs text-gray-500">Stand: 04.06.2026 · Version 1.1</p>

      <h3>§ 1 Vertragsgegenstand</h3>
      <p>
        Vermieter überlässt dem Mieter die in dieser Buchung aufgelisteten Gegenstände auf Zeit gegen Entgelt. Eigentum
        verbleibt zu jeder Zeit beim Vermieter (Eigentumsvorbehalt).
      </p>

      <h3>§ 2 Übergabe und Mängelmeldepflicht</h3>
      <p>
        Der Mieter prüft die Gegenstände bei Übergabe und vor Inbetriebnahme (z.B. beim Aufbau) selbst
        auf Vollständigkeit und Mängel. Festgestellte Mängel sind <strong>per Foto an WhatsApp
        +49 156 79521124</strong> zu melden. Spätere Reklamationen über Mängel, die bei Übergabe
        oder Aufbau erkennbar gewesen wären, sind ausgeschlossen.
      </p>
      <p>
        <strong>Foto-Dokumentation durch den Vermieter:</strong> Bei der Rückgabe dokumentiert der
        Vermieter eventuelle Schäden per Foto und meldet diese dem Mieter zusammen mit der
        Kautions-Abrechnung. Es wird keine separate Übergabe-Foto-Pflicht durch den Vermieter
        durchgeführt — die Übergabe-Dokumentation übernimmt der Mieter selbst (siehe oben).
      </p>

      <p>
        <strong>Standard ist Abholung:</strong> Sofern im Angebot nicht ausdrücklich Lieferung
        vereinbart, holt der Mieter die Gegenstände am vereinbarten Übergabepunkt
        (Grillhütte Sandwiese / Freizeitanlage, Alsbach-Hähnlein) ab und bringt sie nach dem Event
        ebenfalls dort zurück. Der Übergabe-Termin wird telefonisch abgestimmt.
        Eine Lieferung mit oder ohne Aufbau ist gegen Aufpreis im Voraus zu vereinbaren.
      </p>

      <h3>§ 3 Abholung durch Dritte</h3>
      <p>
        Holt eine andere Person als der Besteller die Gegenstände ab, ist der Vermieter berechtigt, einen Lichtbildausweis
        einzusehen oder eine Ausweis-Kopie per WhatsApp/SMS unter <strong>+49 156 79521124</strong> vom Besteller anzufordern.
        Der Besteller bleibt vertraglich verantwortlich.
      </p>

      <h3>§ 4 Lieferung und Aufbau</h3>
      <p>
        <strong>Standard-Lieferung:</strong> Anlieferung erfolgt grundsätzlich bis zur Einfahrt oder Bordsteinkante des
        Lieferorts („Curbside-Lieferung"). Transport an andere Stellen (in Wohnung, in höhere Stockwerke, durch enge
        Zugänge) muss vorab vereinbart werden und ist ggf. mit Aufpreis verbunden.
      </p>
      <p>
        <strong>Aufbau-Service:</strong> Wird gesondert berechnet und nur auf Privatgrund des Mieters durchgeführt.
      </p>
      <p>
        <strong>Helferpflicht bei Aufbau-Service:</strong> Wir setzen den Aufbau in der Regel mit zwei Personen um. Falls
        unsererseits am Aufbautag nur eine Person verfügbar ist, stellt der Mieter für die Dauer des Auf- bzw. Abbaus
        (ca. 30–60 Min) mindestens eine Hilfsperson zur Verfügung. Wir sprechen das spätestens 2 Tage vor dem Termin mit
        Ihnen ab — Sie werden also rechtzeitig informiert, falls eine Helfer-Bereitstellung nötig wird.
      </p>

      <h3>§ 5 Aufbau und Standsicherheit von Zelten</h3>
      <p>
        Zelte dürfen nur auf ebenem, festem und waagerechtem Untergrund aufgebaut werden. Jedes Zelt ist verpflichtend
        mit Gewichten oder Bodenankern und Spanngurten zu sichern; ohne sichere Befestigung erfolgt keine Übergabe. Der
        Aufbau bei starkem Wind oder Unwetter ist untersagt (3×3 m: mind. 2 Personen, 3×6 m: mind. 4 Personen). Schäden
        durch Aufbau auf ungeeignetem Untergrund oder fehlende Sicherung gehen zu Lasten des Mieters (§ 7).
      </p>

      <h3>§ 6 Wetter-Vorbehalt und Aufbau-Verweigerungsrecht</h3>
      <p>
        Bei amtlicher Sturm- oder Unwetterwarnung des Deutschen Wetterdienstes (ab DWD-Stufe 2, prognostizierter Wind
        über 50 km/h) am Tag des Aufbaus oder der Veranstaltung behält sich der Vermieter aus Sicherheitsgründen das
        Recht vor, den Aufbau zu verweigern oder zu verschieben. Bereits gezahlte Beträge werden in diesem Fall ohne
        Storno-Abzug erstattet oder als Gutschrift verrechnet. Dies gilt nicht als Stornierung durch den Mieter.
      </p>
      <p>
        Die allgemeine Wetter-Risikotragung während der Mietzeit (Schutz vor Regen, Wind, Schmutz) liegt beim Mieter.
        Empfindliche Artikel sind vor Witterung zu schützen.
      </p>

      <h3>§ 7 Mieterhaftung während der Mietzeit</h3>
      <p>
        Der Mieter haftet ab dem Zeitpunkt der Übergabe bis zur Rückgabe für sämtliche Schäden, Verlust oder Diebstahl der
        gemieteten Gegenstände — unabhängig vom Verschulden Dritter. Bei Schaden oder Verlust eines Gegenstandes ist der
        jeweils gültige Wiederbeschaffungspreis zu erstatten.
      </p>

      <h3>§ 8 Rückgabe</h3>
      <p>
        Die Rückgabe erfolgt vollständig und in dem bei Übergabe dokumentierten Zustand. Sämtliche Bestandteile,
        Spannriemen, Heringe, Zubehör müssen mitgegeben werden. Fehlende Teile werden nach Ablauf von 48 Stunden mit dem
        Wiederbeschaffungspreis berechnet.
      </p>
      <p>
        <strong>Verspätete Rückgabe:</strong> Wird ein Mietgegenstand nicht zum vereinbarten Rückgabetermin
        zurückgegeben, fallen für jeden angefangenen weiteren Tag <strong>25 % der Tages-Mietsumme</strong> zusätzlich
        an. Erfolgt 48 Stunden nach dem vereinbarten Rückgabetermin keine Rückgabe und keine Mitteilung, geht der
        Vermieter von Diebstahl aus und behält sich rechtliche Schritte vor.
      </p>

      <h3>§ 9 Reinigung</h3>
      <p>
        Gegenstände sind in dem bei Übergabe übernommenen Zustand zurückzugeben — insbesondere frei von Speiseresten,
        Schmutz und groben Verschmutzungen. Wird ein Gegenstand verschmutzt zurückgegeben, fallen die folgenden
        Reinigungspauschalen an:
      </p>
      <table className="w-full text-sm border-collapse my-3">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-2">Artikel-Kategorie</th>
            <th className="text-right py-2 w-32">Pauschale</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-300">
            <td className="py-2">Zelte, Planen</td>
            <td className="py-2 text-right font-mono">40,00 €</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-2">Tische, Stühle, Kleinteile</td>
            <td className="py-2 text-right font-mono">5,00 € / Stück</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-2">Sonstige Artikel</td>
            <td className="py-2 text-right font-mono">max. 10 % des Wiederbeschaffungspreises</td>
          </tr>
        </tbody>
      </table>

      <h3>§ 10 Schadens-Abwicklung</h3>
      <p>
        Bei Beschädigung über die normale Gebrauchsabnutzung hinaus wird der Schaden bei der Rückgabe gemeinsam
        dokumentiert (Foto-Pflicht). Der Vermieter informiert den Mieter binnen 14 Tagen nach Rückgabe über die finalen
        Reparatur- oder Wiederbeschaffungskosten. Die Kaution wird zur Verrechnung herangezogen. Übersteigt der Schaden
        den Kautionsbetrag, ist der Mieter zur Zahlung der Differenz innerhalb von 14 Tagen nach Rechnungsstellung
        verpflichtet.
      </p>

      <h3>§ 11 Heizstrahler und Gasflaschen</h3>
      <p>
        Heizstrahler und Gasflaschen werden gemäß DGUV-Information 110-010 vermietet. Der Mieter wird bei der Übergabe
        eingewiesen und bestätigt die Einweisung. Der Betrieb erfolgt ausschließlich im Freien, mit Abstand zu brennbaren
        Materialien (min. 2 m), auf ebenem Untergrund und nur in Anwesenheit eines volljährigen Verantwortlichen.
      </p>

      <h3>§ 12 Nutzung im Bestimmungsrahmen</h3>
      <p>
        Eine Untervermietung oder Weitergabe an Dritte ist ohne Zustimmung des Vermieters nicht zulässig. Grillen und
        offene Flammen unter Zelten sind aus Sicherheitsgründen untersagt.
      </p>

      <h3>§ 13 Geltung der AGB</h3>
      <p>
        Ergänzend zu diesen Vertragsbedingungen gelten die{" "}
        <a href="/agbs" target="_blank" rel="noreferrer" className="underline">
          Allgemeinen Geschäftsbedingungen
        </a>{" "}
        (Zahlungs- und Stornierungsbedingungen, Widerruf, Haftungs-Begrenzung, Gerichtsstand, Datenschutz). Bei
        Widersprüchen zwischen Mietvertrag und AGB gelten vorrangig die Regelungen dieses Mietvertrags.
      </p>
    </article>
  );
}
