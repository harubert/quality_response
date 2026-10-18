# Quality Response

**Mitmachen vom eigenen Gerät aus – für Präsentationen, die mit [Quality Point](https://github.com/harubert/quality_point) gebaut sind.** Teilnehmer*innen scannen einen QR-Code; die Folien laufen am Handy mit, dazu Stimmungsbarometer, Fragen und Hinweise an die Vortragenden, „Fertig“-Knopf und Umfragen mit Live-Ergebnis. Ein Skill für Claude Code – oder ein einzelner Befehl.

Quality Point bleibt reines HTML und läuft überall. Quality Response ist der Teil, der einen Server braucht: eine PHP-Datei, JSON-Dateien, keine Datenbank.

## So geht es

```
python bauen.py <paket-ordner> --passwort meinpasswort
```

`<paket-ordner>` ist der Veröffentlichungsordner von Quality Point (`deploy.py`, meist `deployment/`). Danach liegen dort zusätzlich `teilnehmer.html`, `live/api.php` und `live/daten/`; `praesentation.html` und `index.html` sind um den Live-Teil ergänzt. Ganzen Ordner auf einen Webspace mit **PHP 8** laden – fertig.

Mit Claude Code: Repo klonen, dann „Mach meine Quality-Point-Präsentation live“ – der Skill `quality-response` fragt nach Paket, Funktionen und Passwort und baut.

## Was Teilnehmer*innen bekommen

- Die aktuelle Folie, die dem Vortrag folgt (oder frei blätterbar – Einstellung)
- **Stimmung melden:** Tempo, Verständlichkeit, Relevanz, Stimmung, Lautstärke, Pause (einzeln schaltbar), per Regler, anonym
- **Hinweise schicken:** Frage, Hinweis, Fehler, Ergänzung zur aktuellen Folie
- **Fertig** melden auf Aufgabenfolien
- **Antworten:** Umfrage, Schätzen, Echt oder Fake, Wortwolke, Ampel, Zuordnen – am eigenen Gerät

## Was Vortragende bekommen

- Anmeldung mit Passwort über die Startseite; Badge mit Teilnehmerzahl und neuen Hinweisen; Hinweise poppen auf und lassen sich groß auf die Folie legen
- **Live-Panel** (Taste `A`): Übersicht mit Barometer-Verteilungen, Hinweise, Ergebnisse je Baustein mit Freigabe, Verlauf über die Zeit mit Export (JSON/CSV), Einstellungen
- Ergebnisse direkt im Baustein auf der Folie; „Auflösen“ gibt die Lösung frei

## Voraussetzungen und Grenzen

PHP 8, Schreibrecht auf `live/daten/`, `.htaccess` (oder nginx-Regel) für den Datenordner, HTTPS. Abgleich alle 3 – 4 Sekunden ohne WebSocket, ausgelegt für Seminar- bis Hörsaalgröße. Teilnehmer*innen bleiben anonym; die Texte der Hinweise werden gespeichert. Alles Weitere: [docs/BETRIEB.md](docs/BETRIEB.md).

## Aufbau

```
bauen.py                 Einbau in ein Quality-Point-Paket (wiederholbar, --entfernen)
server/api.php           Server-Teil
client/live.js, live.css Anmeldung, Badge, Live-Panel, Mitmach-Leiste
client/bausteine_live.js live-fähige Fassungen der Quality-Point-Bausteine
client/vendor/qrcode.js  QR-Code (MIT, Kazuhiko Arase)
test/live_test.py        Ende-zu-Ende-Test mit Playwright gegen php -S
docs/BETRIEB.md          Voraussetzungen, Ablauf im Hörsaal, Datenschutz, Grenzen
.claude/skills/          Skill quality-response
```

Lizenz: MIT. Autor: Thomas Schroffenegger, gebaut mit Claude Code.

---

**English:** Audience response for presentations built with [Quality Point](https://github.com/harubert/quality_point). Participants scan a QR code; the slides follow the talk on their own device, with a mood barometer, hints and questions to the presenter, a “done” button and polls with live results. One command (`python bauen.py <package>`) adds it to a finished Quality Point package; needs PHP 8 on the server, no database. Details in [docs/BETRIEB.md](docs/BETRIEB.md) (German).
