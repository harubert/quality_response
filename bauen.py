"""Quality Response – macht ein fertiges Quality-Point-Paket live (Mitmachen vom eigenen Gerät aus).

Aufruf:  python bauen.py <paket-ordner> [--passwort …] [--barometer tempo,verstaendnis,relevanz,stimmung]
                                        [--ergebnisse sofort|freigabe|nie] [--ohne-folgen] [--ohne-notizen] [--ohne-fertig]
                                        [--praesentation praesentation.html] [--teilnehmer teilnehmer.html] [--entfernen]

<paket-ordner> ist der Veröffentlichungsordner, den Quality Point mit deploy.py erzeugt hat (index.html, praesentation.html, …).
Es entsteht darin:
  praesentation.html   Referentenfassung + Live-Teil (Anmeldung, Badge, Live-Panel Taste A)        – wird an Ort und Stelle ergänzt
  teilnehmer.html      Teilnehmerfassung: ohne Notizen, Pointen, Lösungen, Folien mit data-nur="referent"; mit Mitmach-Leiste
  index.html           Startseite + Knöpfe „Präsentation starten (Referent*in)“ / „Mitmachen“ + QR-Code      – wird ergänzt
  live/api.php         Server-Teil (PHP 8, JSON-Dateien); live/daten/ mit Passwort-Hash und Einstellungen (bleibt bei Neubau erhalten)
Passwort: --passwort, sonst Umgebungsvariable QR_PASSWORT, sonst wird eines erzeugt und angezeigt. Ändern später im Live-Panel.
Wiederholbar: ein zweiter Lauf ersetzt den Live-Teil (Marker <!--qr-->). --entfernen baut ihn wieder aus (Daten bleiben).
Voraussetzungen, Datenschutz, Grenzen: docs/BETRIEB.md
"""
import argparse, hashlib, html, json, os, re, secrets, shutil, sys, time
from pathlib import Path

HIER = Path(__file__).resolve().parent
KATEGORIEN = ['tempo', 'verstaendnis', 'relevanz', 'stimmung', 'lautstaerke', 'pause']
LIVE_TYPEN = ['ia-schaetz', 'ia-quiz', 'ia-umfrage', 'ia-sort', 'ia-wolke', 'ia-ampel']
M_A, M_E = '<!--qr-->', '<!--/qr-->'

TEXTE = {
    'de': dict(ref='▶ Präsentation starten (Referent*in)', tn='Mitmachen (Teilnehmer*innen)', kick='Live dabei', h='Am eigenen Gerät <em>mitmachen</em>',
               t='QR-Code scannen oder die Adresse öffnen: Die Folien laufen mit, dazu Stimmungsbarometer, Fragen und Hinweise an die Vortragenden und Antworten bei Aufgaben. Anonym, ohne Anmeldung.',
               r='Vortragende melden sich beim Start mit dem Passwort an; das Live-Panel öffnet die Taste A.', titel=' · Mitmachen'),
    'en': dict(ref='▶ Start presentation (presenter)', tn='Join (participants)', kick='Join live', h='Take part on your <em>own device</em>',
               t='Scan the QR code or open the address: the slides follow the talk, with a mood barometer, questions and hints to the presenter and answers to tasks. Anonymous, no sign-up.',
               r='Presenters log in with the password at the start; key A opens the live panel.', titel=' · Join'),
}
CSS_START = ('.live-box{display:grid;grid-template-columns:auto minmax(0,1fr);gap:1.5rem;align-items:center;background:var(--card);padding:1.2rem 1.4rem;border-radius:var(--radius);box-shadow:0 20px 40px -28px var(--schatten)}'
             '#liveQr{width:min(190px,40vw);background:#fff;padding:6px;border-radius:8px}#liveQr svg{display:block;width:100%;height:auto}'
             '.live-url a{font:600 1.05rem/1.3 var(--ui);word-break:break-all;color:var(--teal)}.live-box .lead{margin:0 0 .6rem}@media(max-width:640px){.live-box{grid-template-columns:1fr}}')


def lies(p): return Path(p).read_text(encoding='utf-8')
def schreib(p, t): Path(p).write_text(t, encoding='utf-8')
def ohne_marker(t): return re.sub(re.escape(M_A) + r'.*?' + re.escape(M_E) + r'\n?', '', t, flags=re.S)
def pbkdf2(pw):
    salz, runden = secrets.token_hex(16), 200000
    return 'pbkdf2$sha256$%d$%s$%s' % (runden, salz, hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), bytes.fromhex(salz), runden, 32).hex())


def main():
    for s in (sys.stdout, sys.stderr):                      # Windows-Konsole: UTF-8 für Pfeile und Umlaute
        try: s.reconfigure(encoding='utf-8')
        except Exception: pass
    ap = argparse.ArgumentParser(description='Quality Response: Live-Teil in ein Quality-Point-Paket einbauen')
    ap.add_argument('paket'); ap.add_argument('--passwort', default=os.environ.get('QR_PASSWORT', ''))
    ap.add_argument('--barometer', default='tempo,verstaendnis,relevanz,stimmung'); ap.add_argument('--ergebnisse', default='freigabe', choices=['sofort', 'freigabe', 'nie'])
    ap.add_argument('--ohne-folgen', action='store_true'); ap.add_argument('--ohne-notizen', action='store_true'); ap.add_argument('--ohne-fertig', action='store_true')
    ap.add_argument('--praesentation', default='praesentation.html'); ap.add_argument('--teilnehmer', default='teilnehmer.html'); ap.add_argument('--entfernen', action='store_true')
    a = ap.parse_args()
    paket = Path(a.paket).resolve()
    pr = paket / a.praesentation
    if not pr.exists(): sys.exit(f'{pr} fehlt – ist das der Veröffentlichungsordner von Quality Point (deploy.py)?')
    roh = ohne_marker(lies(pr))
    if 'id="stage"' not in roh or 'window.deck=' not in roh: sys.exit('Keine Quality-Point-Präsentation (id="stage", window.deck fehlen)')
    if 'data-nr=' not in roh: sys.exit('Präsentation ohne data-nr – bitte mit Quality Point ab 2026-10-18 neu bauen')
    sprache = 'en' if re.search(r'<html[^>]*lang="en', roh) else 'de'; T = TEXTE[sprache]
    index = paket / 'index.html'

    if a.entfernen:
        schreib(pr, re.sub(r'(<div class="(?:[^"]* )?ia-[^"]*)(?= ia-fertig qr-live")', r'\1', ohne_marker(lies(pr))).replace(' ia-fertig qr-live"', '"'))
        (paket / a.teilnehmer).unlink(missing_ok=True)
        if index.exists(): schreib(index, ohne_marker(lies(index)))
        if (paket / 'live' / 'api.php').exists(): (paket / 'live' / 'api.php').unlink()
        print('Live-Teil entfernt (live/daten/ bleibt).'); return

    # ---- Einbettung: CSS + Konfiguration + Skripte (vor dem letzten </body>) ----
    konf = {'api': 'live/api.php', 'teilnehmer': a.teilnehmer, 'typen': LIVE_TYPEN}
    inj = (M_A + '<style>' + lies(HIER / 'client' / 'live.css') + '</style>\n<script>window.QR_KONFIG=' + json.dumps(konf, ensure_ascii=False) + ';\n'
           + lies(HIER / 'client' / 'bausteine_live.js') + '\n' + lies(HIER / 'client' / 'live.js') + '</script>' + M_E)
    # Live-fähige Bausteine: Quality Point überspringt Elemente mit ia-fertig, Quality Response baut sie selbst (qr-live)
    def markiere(m):
        t = m.group(0)
        return t if 'qr-live' in t else re.sub(r'class="([^"]*)"', lambda c: 'class="' + c.group(1) + ' ia-fertig qr-live"', t, count=1)
    typen = '|'.join(t[3:] for t in LIVE_TYPEN)
    roh = re.sub(r'<div class="(?:[^"]* )?ia-(?:' + typen + r')(?: [^"]*)?"[^>]*>', markiere, roh)
    def einfuegen(t):
        k = t.rfind('</body>'); return t[:k] + inj + '\n' + t[k:] if k >= 0 else t + inj
    schreib(pr, einfuegen(roh))

    # ---- Teilnehmerfassung ----
    tn = re.sub(r'<section class="slide[^"]*"[^>]*data-nur="referent"[^>]*>.*?</section>\s*', '', roh, flags=re.S)
    tn = re.sub(r'\s*<aside class="notes">.*?</aside>', '', tn, flags=re.S)
    tn = re.sub(r'\s(?:data-zweck|data-pointe)="[^"]*"', '', tn)
    tn = re.sub(r'<script>\s*/\* Notizschutz.*?</script>\s*', '', tn, flags=re.S)                 # verschlüsselte Notizen (Quality Point) ebenfalls weg
    def loesungen_weg(m):
        t = re.sub(r'\s(?:data-wert|data-loesung|data-richtig)="[^"]*"', '', m.group(0))
        if 'ia-quiz' in t: t = re.sub(r'\sdata-text="[^"]*"', '', t)
        return t
    tn = re.sub(r'<div class="(?:[^"]* )?ia-[^"]*"[^>]*>', loesungen_weg, tn)
    tn = re.sub(r'(<[a-z0-9]+\b[^>]*?)\sdata-ziel="[^"]*"', r'\1 data-item=""', tn)
    tn = re.sub(r'<title>(.*?)</title>', lambda m: '<title>' + m.group(1) + html.escape(T['titel']) + '</title>', tn, count=1)
    tn = tn.replace('<body>', '<body class="tn">', 1)
    folien = re.search(r'<div id="stage">(.*?)</div></div>\s*<div id="notes">', tn, flags=re.S)
    rest = re.findall(r'data-wert=|data-loesung=|data-richtig=|data-ziel=|class="notes"|data-pointe=|data-zweck=', folien.group(1) if folien else tn)
    if rest: sys.exit('Teilnehmerfassung enthält noch Lösungen oder Notizen – Abbruch: ' + ', '.join(sorted(set(rest))))
    schreib(paket / a.teilnehmer, einfuegen(tn))

    # ---- Startseite ----
    if index.exists():
        ix = ohne_marker(lies(index))
        ix = re.sub(r'<a class="btn p" href="' + re.escape(a.praesentation) + r'(?:\?referent)?">[^<]*</a>',
                    M_A + f'<a class="btn p" href="{a.praesentation}?referent">{html.escape(T["ref"])}</a><a class="btn" href="{a.teilnehmer}">{html.escape(T["tn"])}</a>' + M_E, ix, count=1)
        abschnitt = (M_A + f'<section class="wrap" id="live"><div class="kick">{html.escape(T["kick"])}</div><h2>{T["h"]}</h2><div class="live-box"><div id="liveQr"></div><div><p class="lead">{html.escape(T["t"])}</p>'
                     f'<p class="live-url"><a href="{a.teilnehmer}" id="liveUrl">{a.teilnehmer}</a></p><p class="small">{html.escape(T["r"])}</p></div></div></section>'
                     f'<style>{CSS_START}</style><script>{lies(HIER / "client" / "vendor" / "qrcode.js")}</script>'
                     '<script>(function(){var u=location.href.replace(/[#?].*$/,"").replace(/[^/]*$/,"")+"' + a.teilnehmer + '";var e=document.getElementById("liveUrl");e.textContent=u.replace(/^https?:\\/\\//,"");'
                     'if(typeof qrcode==="function"){var q=qrcode(0,"M");q.addData(u);q.make();document.getElementById("liveQr").innerHTML=q.createSvgTag({cellSize:4,margin:1,scalable:true});}})();</script>' + M_E)
        ix = ix.replace('<main>', '<main>\n' + abschnitt, 1) if '<main>' in ix else ix.replace('</body>', abschnitt + '</body>', 1)
        schreib(index, ix)

    # ---- Server-Teil ----
    lz = paket / 'live'; dz = lz / 'daten'; dz.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HIER / 'server' / 'api.php', lz / 'api.php')
    schreib(dz / '.htaccess', 'Require all denied\n'); schreib(dz / 'index.html', '')
    zugang = dz / 'zugang.json'; pw = a.passwort; neu = False
    if pw or not zugang.exists():
        if not pw: pw = secrets.choice(['ampel', 'tafel', 'kreide', 'folie', 'pult', 'beamer', 'pause', 'wolke']) + '-' + str(secrets.randbelow(9000) + 1000); neu = True
        schreib(zugang, json.dumps({'hash': pbkdf2(pw), 'erstellt': int(time.time())}))
    einst = dz / 'einstellungen.json'
    if not einst.exists():
        schreib(einst, json.dumps({'folgen': not a.ohne_folgen, 'notizen': not a.ohne_notizen, 'fertig': not a.ohne_fertig,
                                   'barometer': [k for k in a.barometer.split(',') if k in KATEGORIEN], 'ergebnisse': a.ergebnisse, 'freigaben': {}, 'version': 1, 'start': int(time.time())}, ensure_ascii=False))
    n_live = len(re.findall(r'<div class="[^"]*\bqr-live"', lies(pr)))
    print(f'Quality Response eingebaut in {paket}: {a.praesentation} (Referent*in, {n_live} Live-Bausteine), {a.teilnehmer} (Teilnehmer*innen), index.html (QR-Code), live/api.php + live/daten/')
    if pw: print('Passwort der Vortragenden: ' + pw + (' (neu erzeugt – bitte notieren)' if neu else ' (wie angegeben)') + ' – ändern im Live-Panel (Taste A → Einstellungen)')
    else: print('Passwort unverändert (live/daten/zugang.json); neues mit --passwort oder QR_PASSWORT')
    print('Hochladen: ganzer Ordner; live/daten/ am Server nicht löschen (laufende Sitzung). Prüfen: …/live/daten/einstellungen.json muss 403 liefern. Details: docs/BETRIEB.md')


if __name__ == '__main__':
    main()
