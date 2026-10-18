---
name: quality-response
description: "Quality Response: macht ein fertiges Quality-Point-Paket live – Teilnehmer*innen machen vom eigenen Gerät aus mit (Folien folgen dem Vortrag, Stimmungsbarometer, Hinweise und Fragen an die Vortragenden, Fertig-Knopf, Umfragen und Aufgaben mit Live-Ergebnis). Verwenden, wenn jemand Audience Response, Mitmachen per QR-Code, Live-Umfragen, Stimmungsbarometer oder Publikumsfragen für eine mit Quality Point gebaute Präsentation will. Braucht PHP 8 am Server. Nicht verwenden, um die Präsentation selbst zu bauen oder zu ändern – das macht Quality Point."
---

# Quality Response

Quality Response setzt **nachträglich** auf dem Veröffentlichungsordner auf, den Quality Point mit `deploy.py` erzeugt hat. Die Präsentation bleibt unverändert; dazu kommen Teilnehmerfassung, Startseite mit QR-Code, Live-Panel und der Server-Teil (`live/api.php`, PHP 8, keine Datenbank). Rahmenbedingungen: `docs/BETRIEB.md`.

## 0 · Vorbereitung
1. Quality-Response-Ordner finden (dieses Repo, `bauen.py` im Wurzelverzeichnis); fehlt er: `git clone https://github.com/harubert/quality_response`. Alle Aufrufe: `python <quality_response>/bauen.py <paket-ordner> …` (Windows auch `py -3.12`).
2. Das Paket muss von **Quality Point ab 18. 10. 2026** stammen (Folien tragen `data-nr`). Sonst zuerst dort neu bauen.

## A · Aufnahme (AskUserQuestion, höchstens 4 Fragen je Aufruf, Empfehlung zuerst)
1. **Paket:** Welcher Ordner ist das Quality-Point-Paket (`index.html`, `praesentation.html`)? Standard: `deployment/` neben dem Projekt.
2. **Server:** Gibt es einen Webspace mit PHP 8 und Schreibrecht? Wer lädt hoch (die Person, eine Server-Session)? Du lädst nie selbst hoch. Hinweis: Hinter einer Code-Abfrage gilt der Code auch für Teilnehmer*innen.
3. **Mitmach-Funktionen:** Barometer-Kategorien (Standard tempo, verstaendnis, relevanz, stimmung; dazu lautstaerke, pause) · Hinweise an/aus · Fertig-Knopf · Ergebnisse für Teilnehmer*innen: sofort / erst nach Freigabe (Standard) / nie · Folien folgen dem Vortrag (Standard) oder frei.
4. **Passwort:** per Umgebungsvariable `QR_PASSWORT` oder `--passwort`; sonst erzeugt `bauen.py` ein Startpasswort und zeigt es an. Das Startpasswort der Person **einmal mitteilen**; nie in Folien, Notizen oder Begleitseiten schreiben, nie ins Repo.
5. **Datenschutz** kurz ansprechen (anonyme Gerätekennung, Hinweistexte werden gespeichert, Reset im Panel) und den Satz für die Teilnehmer*innen vorschlagen: „Mitmachen ist anonym – bitte keine Namen in Hinweise schreiben.“

## B · Ablauf
1. Prüfen, ob die Präsentation Live-Bausteine enthält (`ia-umfrage`, `ia-schaetz`, `ia-quiz`, `ia-wolke`, `ia-ampel`, `ia-sort`). Fehlen sie, der Person vorschlagen, sie mit Quality Point einzubauen – Markup dort (`engine/FOLIEN.md`), Live-Attribute hier (`docs/BETRIEB.md`: `data-ergebnis`, `data-fertig`, `data-nur="referent"`). Beim Gestalten: Die Weiter-Schaltfläche zeigt die Zahl der Teilschritte – sie darf keine Lösung verraten.
2. `python bauen.py <paket> [--barometer …] [--ergebnisse …] [--ohne-notizen] [--ohne-fertig] [--ohne-folgen]` ausführen; Ausgabe lesen (Zahl der Live-Bausteine, Passwort-Hinweis). `bauen.py` bricht ab, wenn die Teilnehmerfassung noch Lösungen oder Notizen enthielte.
3. **Lokal testen**, wenn PHP vorhanden ist: `php -S 127.0.0.1:8765 -t <paket>`, dann `test/live_test.py http://127.0.0.1:8765 <bildordner>` (Playwright; Passwort im Skript anpassen) – Referent und Teilnehmer gegeneinander. Ergebnis berichten.
4. Übergabe: ganzen Ordner hochladen lassen; `live/daten/` am Server nie löschen; nach dem Hochladen prüfen lassen, dass `…/live/daten/einstellungen.json` **403** liefert.
5. Rückmeldung (kurz): was eingebaut ist, Passwort-Hinweis, Adresse für Teilnehmer*innen, offene Punkte (z. B. nginx-Regel, HTTPS).

## C · Regeln
- Nichts in Quality Point ändern – nur das Paket wird ergänzt. Neu gebautes Paket → `bauen.py` erneut.
- Keine Fremddienste, keine CDNs; alles liegt im Paket.
- Server-Daten sind personenbezogen, sobald jemand Namen in Hinweise schreibt: Export und Reset nur auf Wunsch der Person; nichts davon in den Chat kopieren.
