# Quality Response – Betrieb, Voraussetzungen, Datenschutz

Quality Response macht ein fertiges **Quality-Point-Paket** live: Teilnehmer*innen machen vom eigenen Gerät aus mit. Quality Point selbst bleibt reines HTML und läuft überall; Quality Response braucht einen Webspace mit PHP.

| | Quality Point allein | mit Quality Response |
|---|---|---|
| Läuft auf | jedem Gerät, auch offline | Webspace mit PHP 8 |
| Teilnehmer*innen | sehen den Beamer | haben die Folien am eigenen Gerät, folgen dem Vortrag |
| Interaktionsbausteine | am Vortragsrechner (Handzeichen zählen, eintippen) | Antworten von allen Geräten, Ergebnisse live |
| Hinweise aus dem Publikum | mündlich | anonym als Text, poppen bei der Referentin / dem Referenten auf |
| Stimmungsbarometer | – | Tempo, Verständlichkeit, Relevanz, Stimmung, Lautstärke, Pause – live und als Verlauf |
| Gespeichert wird | nichts | anonyme Kennung je Gerät, Antworten, Hinweise, Barometerwerte (auf dem eigenen Server) |

## Was `bauen.py` in das Paket einbaut

- `praesentation.html` – Referentenfassung wie von Quality Point gebaut, ergänzt um Anmeldung, Badge und **Live-Panel** (Taste `A`). Live-fähige Bausteine bekommen die Klasse `qr-live`.
- `teilnehmer.html` – Teilnehmerfassung: ohne Notizen und Pointen, ohne Folien mit `data-nur="referent"`, ohne Lösungen der Bausteine (auch ein Notizschutz-Block von Quality Point wird entfernt). Darunter die **Mitmach-Leiste** mit Stimmung, Hinweis, Aufgabe.
- `index.html` – Startseite mit „▶ Präsentation starten (Referent*in)“, „Mitmachen (Teilnehmer*innen)“ und **QR-Code** zur Teilnehmerfassung.
- `live/api.php` – der ganze Server-Teil, eine Datei. `live/daten/` – Datenordner (JSON/JSONL), per `.htaccess` gesperrt.

Der Einbau ist wiederholbar (Marker `<!--qr-->`) und mit `--entfernen` rückgängig zu machen. Wird das Paket mit Quality Point neu gebaut, `bauen.py` danach erneut ausführen.

## Voraussetzungen

- **PHP 8.0 oder neuer** (mbstring empfohlen, nicht nötig). Keine Datenbank, keine Zusatzpakete.
- **Schreibrecht** des Webservers auf `live/daten/`.
- **Apache mit `.htaccess`** (`Require all denied` im Datenordner liegt bei). Bei nginx den Ordner selbst sperren, z. B. `location ~ /live/daten/ { deny all; }`. Prüfen: `…/live/daten/einstellungen.json` muss im Browser **403** liefern.
- **HTTPS**, damit Hinweise und Passwort nicht im Klartext reisen; das Sitzungscookie wird dann als `secure` gesetzt.
- Alles unter **einer Adresse** (gleicher Host, gleicher Ordner) – die Seiten rufen `live/api.php` relativ auf.
- Beim **Hochladen eines neuen Stands** den Ordner `live/daten/` am Server **nicht löschen**, sonst sind Passwort, Antworten und Hinweise der laufenden Sitzung weg.
- Läuft das Paket hinter einem eigenen Zugangsschutz (z. B. Code-Abfrage), gilt der für Teilnehmer*innen genauso – den Code also mit dem QR-Code bekannt geben.
- Quality Point ab 18. 10. 2026 (Folien mit `data-nr`, Bausteine mit `data-id`).

## Passwort der Vortragenden

`bauen.py` schreibt den Passwort-Hash nach `live/daten/zugang.json`: aus `--passwort`, sonst aus der Umgebungsvariable `QR_PASSWORT`, sonst erzeugt es ein Startpasswort wie `tafel-4821` und zeigt es **einmal** an. Ändern: Live-Panel → Einstellungen → Passwort ändern. Nach fünf Fehlversuchen wartet die Anmeldung eine Minute. Die Anmeldung gilt für den Browser-Tab (Sitzungscookie, `HttpOnly`, `SameSite=Lax`).

## Ablauf im Hörsaal

1. Startseite öffnen → „Präsentation starten (Referent*in)“ → Passwort. Von da an ist der Vortragsrechner die Quelle: Jede Folie und jeder Teilschritt wird gemeldet.
2. QR-Code zeigen (Startseite oder Live-Panel → Übersicht). Teilnehmer*innen öffnen `teilnehmer.html`, tippen „Los geht’s“ und sehen die aktuelle Folie; ihre Navigation ist gesperrt, solange „Folien folgen dem Vortrag“ eingeschaltet ist.
3. Rechts unten zeigt ein Badge die Zahl der Teilnehmer*innen und neue Hinweise; ein Hinweis poppt kurz auf. `A` öffnet das Panel:
   - **Übersicht** – online, fertig auf dieser Folie, offene Hinweise, Barometer (letzte 15 Minuten, je Person der jüngste Wert), QR-Code.
   - **Hinweise** – chronologisch mit Art (Frage, Hinweis, Fehler, Ergänzung) und Folie; „Auf der Folie zeigen“ legt den Text groß über die Folie, „Zur Folie“, „Erledigt“.
   - **Ergebnisse** – Bausteine der aktuellen Folie: Zahl der Antworten, Ergebnis für Teilnehmer*innen freigeben/verbergen, Antworten löschen. Die Ergebnisse selbst stehen im Baustein auf der Folie.
   - **Verlauf** – Barometer über die Zeit je Kategorie, Export als JSON/CSV (anonym).
   - **Einstellungen** – folgen/frei, Hinweise an/aus, Fertig-Knopf, Barometer-Kategorien, Standard für Ergebnisse (sofort / erst nach Freigabe / nie), Sitzung zurücksetzen, Passwort.
4. „Auflösen“ bzw. „Prüfen“ in einem Baustein gibt zugleich die Lösung für Teilnehmer*innen frei.

## Bausteine und Markup (in der Quality-Point-Präsentation)

Live-fähig: `ia-umfrage`, `ia-schaetz`, `ia-quiz`, `ia-wolke`, `ia-ampel`, `ia-sort` (Markup: Quality Point, `engine/FOLIEN.md`). Zusätzliche Attribute, die Quality Response auswertet:

- `data-ergebnis="sofort|freigabe|nie"` am Baustein – wann Teilnehmer*innen Ergebnisse sehen (Standard aus den Einstellungen).
- `data-fertig` an einer Folie – zeigt Teilnehmer*innen den „Fertig“-Knopf (Werkstattfolien `.s-auftrag` automatisch).
- `data-nur="referent"` an einer Folie – kommt nicht in die Teilnehmerfassung; Klasse `nur-referent` an einem Element blendet es dort aus.
- Beim Gestalten: Die Weiter-Schaltfläche von Quality Point zeigt die Zahl der Teilschritte – sie darf keine Lösung verraten.

## Datenschutz

- Teilnehmer*innen bleiben **anonym**: Das Gerät erzeugt eine Zufallskennung (im Browser gespeichert), damit eine Person je Frage nur einmal zählt. Keine Namen, keine Anmeldung, keine IP-Adressen in den Daten (nur die Sperre nach Fehlversuchen beim Passwort merkt sich kurz die IP).
- Gespeichert werden Barometerwerte, Antworten, Fertig-Meldungen und die **Texte der Hinweise** – darauf vor Beginn hinweisen („Bitte keine Namen in Hinweise schreiben“). Im Export sind die Kennungen gekürzte Prüfsummen.
- Eigene Hinweise sieht eine Person nur auf dem eigenen Gerät wieder (Browser-Speicher).
- **Sitzung zurücksetzen** (Panel → Einstellungen) löscht alle gesammelten Daten; vor der nächsten Veranstaltung empfohlen.

## Grenzen

- Abgleich per Abfrage alle 3 – 4 Sekunden (kein WebSocket) – robust auf jedem Webspace, wenige Sekunden Verzögerung sind normal.
- Ausgelegt für Seminar- bis Hörsaalgröße (einige hundert Geräte); Dateien statt Datenbank.
- Wer die Kennung im Browser löscht, kann erneut abstimmen. Für Prüfungen ist das Werkzeug nicht gedacht.
