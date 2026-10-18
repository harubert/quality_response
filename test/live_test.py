"""Ende-zu-Ende-Test Quality Point Live: Referent + Teilnehmer gegen php -S."""
import sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
SHOT = sys.argv[2]
fehler = []
ok = lambda name, cond: print(('OK   ' if cond else 'FEHL ') + name) or (None if cond else fehler.append(name))

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    ref = b.new_context(viewport={"width": 1500, "height": 900}).new_page()
    tn = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True).new_page()
    for pg in (ref, tn):
        pg.on("pageerror", lambda e: fehler.append("JS: " + str(e)))
        pg.on("console", lambda m: print("  konsole:", m.text) if m.type in ("error", "warning") else None)

    # --- Referent: Anmeldung ---
    ref.goto(BASE + "/praesentation.html?referent"); ref.wait_for_timeout(800)
    ok("Login-Dialog erscheint", ref.locator("#liveLogin").is_visible())
    ref.fill("#liveLogin input", "falsch"); ref.keyboard.press("Enter"); ref.wait_for_timeout(600)
    ok("falsches Passwort abgelehnt", "stimmt nicht" in ref.locator("#liveLogin .lg-m").inner_text())
    ref.fill("#liveLogin input", "geheim-1234"); ref.keyboard.press("Enter"); ref.wait_for_timeout(1200)
    ok("angemeldet, Dialog weg", ref.locator("#liveLogin").count() == 0)
    ref.mouse.click(700, 450); ref.wait_for_timeout(2800)

    # --- Peek: Tastatur zeigt kurz nur die Weiter-Schaltfläche ---
    ref.keyboard.press("ArrowRight"); ref.wait_for_timeout(200)
    peek = ref.evaluate("()=>({nav:getComputedStyle(document.getElementById('nav')).opacity, bx:getComputedStyle(document.getElementById('bX')).opacity, bo:getComputedStyle(document.getElementById('bO')).opacity, cls:document.body.className})")
    ok("Peek: Leiste sichtbar, nur Weiter-Knopf (" + str(peek) + ")", float(peek['nav']) > .5 and float(peek['bx']) > .5 and float(peek['bo']) < .5)
    ref.wait_for_timeout(1800)
    ok("Peek wieder weg", float(ref.evaluate("getComputedStyle(document.getElementById('nav')).opacity")) < .1)

    # --- Teilnehmer: Start, folgt ---
    tn.goto(BASE + "/teilnehmer.html"); tn.wait_for_timeout(600)
    ok("Teilnehmer: Startschirm", tn.locator("#mmStart").is_visible())
    tn.click("#mmStart button"); tn.wait_for_timeout(5500)
    ok("Teilnehmer: Leiste gebaut", tn.locator("#mitmachen .mm-kopf").count() == 1)
    ok("Teilnehmer: keine Notizen im DOM", tn.locator("aside.notes").count() == 0 and tn.locator("[data-nur=referent]").count() == 0)
    ref.evaluate("deck.go(5,0)"); ref.wait_for_timeout(5000)
    ok("Teilnehmer folgt auf Folie 6 (" + str(tn.evaluate("deck.cur()+1")) + ")", tn.evaluate("deck.cur()+1") == 6)
    ok("Teilnehmer: Navigation gesperrt", tn.evaluate("(()=>{const c=deck.cur(); deck.next(); return deck.cur()===c;})()"))

    # --- Umfrage-Folie: Antworten ---
    ref.evaluate("(()=>{const k=deck.slides.findIndex(s=>s.dataset.title==='Umfrage live'); deck.go(k,0);})()"); ref.wait_for_timeout(5000)
    ok("Teilnehmer auf Umfrage-Folie", tn.evaluate("deck.slides[deck.cur()].dataset.title") == "Umfrage live")
    ok("Teilnehmer: Baustein in der Leiste", tn.locator("#mitmachen .mm-widgets .ia-umfrage").count() == 1)
    ok("Teilnehmer: Aufgabe-Tab aktiv", tn.locator(".mm-tab.on").inner_text().startswith("Aufgabe"))
    tn.click("#mitmachen .ia-umfrage .ia-opt button:nth-child(3)"); tn.wait_for_timeout(800)
    ok("Teilnehmer: Ergebnis vor Freigabe verborgen", tn.locator("#mitmachen .ia-umfrage .ia-balken").count() == 0)
    ref.wait_for_timeout(3500)
    bal = ref.locator("section.slide.cur .ia-umfrage .ia-balken .ia-bn").all_inner_texts()
    ok("Referent sieht Balken (" + " | ".join(bal) + ")", any(t.startswith("1") for t in bal))
    # Schätzregler
    tn.locator("#mitmachen .ia-schaetz input").evaluate("r=>{r.value=20;r.dispatchEvent(new Event('input'))}")
    tn.click("#mitmachen .ia-schaetz .ia-send"); ref.wait_for_timeout(3500)
    ok("Referent: Schätzung angekommen", "Median" in ref.locator("section.slide.cur .ia-schaetz .ia-live").inner_text())
    # Freigabe durch Auflösen beim Referenten
    ref.click("section.slide.cur .ia-umfrage .ia-los"); ref.click("section.slide.cur .ia-schaetz .ia-los"); tn.wait_for_timeout(5000)
    ok("Teilnehmer: Ergebnis nach Freigabe sichtbar", tn.locator("#mitmachen .ia-umfrage .ia-balken").count() == 1 and tn.locator("#mitmachen .ia-umfrage .ia-opt button.ok").count() == 1)
    ok("Teilnehmer: Schätzung aufgelöst", "Wirklich" in tn.locator("#mitmachen .ia-schaetz .ia-erg").inner_text())

    # --- Barometer + Hinweis + Fertig ---
    tn.click(".mm-tab[data-tab=stimmung]"); tn.locator(".mm-baro[data-kat=tempo] input").evaluate("r=>{r.value=5;r.dispatchEvent(new Event('input'))}"); tn.wait_for_timeout(1200)
    tn.click(".mm-tab[data-tab=hinweis]"); tn.fill("#mitmachen textarea", "Auf der Folie fehlt eine Quelle."); tn.click(".mm-senden"); tn.wait_for_timeout(500)
    ok("Teilnehmer: eigener Hinweis gelistet", "fehlt eine Quelle" in tn.locator(".mm-eigene").inner_text())
    ref.wait_for_timeout(3500)
    ok("Referent: Badge zeigt neuen Hinweis", "1 neu" in ref.locator("#liveBadge").inner_text() and "● 1" in ref.locator("#liveBadge").inner_text())
    ok("Referent: Toast erschienen", ref.locator(".liveToast").count() >= 1)
    ref.keyboard.press("a"); ref.wait_for_timeout(300)
    ok("Panel offen (Übersicht)", ref.locator("#livePanel.on").count() == 1 and "online" in ref.locator("#livePanel .lp-k").first.inner_text())
    ok("Barometer Tempo = 5,0", "5.0" in ref.locator("#livePanel .lp-body").inner_text())
    ref.click("#livePanel [data-tab=hinweise]"); ref.wait_for_timeout(300)
    ok("Hinweis im Panel", "fehlt eine Quelle" in ref.locator("#livePanel .lp-n").first.inner_text())
    ref.click("#livePanel [data-act=zeigen]"); ref.wait_for_timeout(400)
    ok("Hinweis groß auf der Folie", ref.locator("#liveNotiz.on").count() == 1)
    ref.screenshot(path=SHOT + "_ref_notiz.png"); ref.keyboard.press("Escape"); ref.wait_for_timeout(300)
    # Werkstatt: fertig
    ref.evaluate("(()=>{const k=deck.slides.findIndex(s=>s.dataset.title==='Werkstatt Zuordnen'); deck.go(k,0);})()"); tn.wait_for_timeout(5000)
    ok("Teilnehmer: Fertig-Knopf da", tn.locator(".mm-fertig").is_visible())
    tn.click(".mm-ok"); ref.wait_for_timeout(3500)
    ref.keyboard.press("a"); ref.wait_for_timeout(300); ref.click("#livePanel [data-tab=uebersicht]"); ref.wait_for_timeout(300)
    ok("Referent: 1 fertig", "1" in ref.locator("#livePanel .lp-k").nth(1).inner_text())
    ref.screenshot(path=SHOT + "_ref_panel.png")
    ref.click("#livePanel [data-tab=verlauf]"); ref.wait_for_timeout(800)
    ok("Verlauf mit Kurve", ref.locator("#livePanel .lp-vk svg").count() >= 1)
    ref.screenshot(path=SHOT + "_ref_verlauf.png")
    ref.click("#livePanel [data-tab=einstellungen]"); ref.wait_for_timeout(300)
    ref.click("#livePanel [data-set=folgen]"); ref.wait_for_timeout(300)
    tn.wait_for_timeout(5000)
    ok("Teilnehmer: nach Umschalten frei", tn.evaluate("(()=>{const c=deck.cur(); deck.prev(); return deck.cur()!==c;})()"))
    tn.screenshot(path=SHOT + "_tn.png", full_page=False)
    ref.keyboard.press("Escape")
    # Abmeldung / Rechte
    r = ref.evaluate("fetch('live/api.php?a=ref').then(r=>r.status)")
    ok("API ref mit Sitzung 200", r == 200)
    r2 = tn.evaluate("fetch('live/api.php?a=ref').then(r=>r.status)")
    ok("API ref ohne Sitzung 401", r2 == 401)
    r3 = tn.evaluate("fetch('live/daten/notizen.jsonl').then(r=>r.status)")
    print("daten/ direkt (php -S kennt kein .htaccess, am Apache 403):", r3)
    b.close()
print("\nFehler:", fehler or "keine")
