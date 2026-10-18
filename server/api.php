<?php
/* Quality Point Live – Server-Teil (eine Datei, keine Datenbank).
   Speichert in live/daten/ als JSON bzw. JSONL mit Dateisperren. Voraussetzungen und Grenzen: docs/LIVE.md.

   Teilnehmer*innen (anonym, Kennung „tn“ aus dem Browser):
     GET  ?a=tn&tn=…&v=…&f=…        Abgleich alle paar Sekunden: Referentenfolie, Einstellungen, freigegebene Ergebnisse
     POST a=stimmung {tn,kat,wert}  Barometer (1–5)
     POST a=notiz {tn,folie,art,text}   Hinweis an die Referentin / den Referenten
     POST a=fertig {tn,folie}       „Ich bin fertig“
     POST a=antwort {tn,baustein,wert[,mehrfach]}   Antwort auf einen Interaktionsbaustein
   Vortragende (Anmeldung mit Passwort, Sitzungscookie):
     POST a=login {passwort} · a=logout · GET a=ref&seit=…&folie=… · POST a=zustand {folie,schritt}
     POST a=einstellungen {…} · a=freigabe {baustein,an,loesung} · a=notiz_status {id,status}
     GET  a=verlauf · POST a=reset {was} · a=passwort {neu}
   Alle POST-Aufrufe tragen den Kopf „X-QP: 1“ (Schutz gegen fremde Formulare). */

declare(strict_types=1);
const DATEN = __DIR__ . '/daten';
const PRAESENZ_SEK = 45;          // so lange gilt jemand nach dem letzten Abgleich als „online“
const BAROMETER_FENSTER = 900;    // Sekunden: so alt darf ein Barometerwert für die Live-Anzeige sein
const KATEGORIEN = ['tempo', 'verstaendnis', 'relevanz', 'stimmung', 'lautstaerke', 'pause'];
const NOTIZ_ARTEN = ['frage', 'hinweis', 'fehler', 'ergaenzung'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// ---------- Hilfsfunktionen ----------
function antwort(array $d, int $status = 200): void { http_response_code($status); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fehler(string $m, int $status = 400): void { antwort(['fehler' => $m], $status); }
function pfad(string $name): string { return DATEN . '/' . $name; }
function lies_json(string $name, $standard) {
    $p = pfad($name); if (!is_file($p)) return $standard;
    $f = fopen($p, 'r'); if (!$f) return $standard;
    flock($f, LOCK_SH); $t = stream_get_contents($f); flock($f, LOCK_UN); fclose($f);
    $d = json_decode($t ?: '', true); return $d === null ? $standard : $d;
}
function schreib_json(string $name, $daten): void {
    $f = fopen(pfad($name), 'c+'); if (!$f) fehler('Datenordner nicht beschreibbar', 500);
    flock($f, LOCK_EX); ftruncate($f, 0); fwrite($f, json_encode($daten, JSON_UNESCAPED_UNICODE)); fflush($f); flock($f, LOCK_UN); fclose($f);
}
function aendere_json(string $name, $standard, callable $fn) {                 // lesen, ändern, schreiben unter einer Sperre
    $f = fopen(pfad($name), 'c+'); if (!$f) fehler('Datenordner nicht beschreibbar', 500);
    flock($f, LOCK_EX); $t = stream_get_contents($f); $d = json_decode($t ?: '', true); if ($d === null) $d = $standard;
    $d = $fn($d); rewind($f); ftruncate($f, 0); fwrite($f, json_encode($d, JSON_UNESCAPED_UNICODE)); fflush($f); flock($f, LOCK_UN); fclose($f);
    return $d;
}
function haenge_an(string $name, array $zeile): void {
    $f = fopen(pfad($name), 'a'); if (!$f) fehler('Datenordner nicht beschreibbar', 500);
    flock($f, LOCK_EX); fwrite($f, json_encode($zeile, JSON_UNESCAPED_UNICODE) . "\n"); fflush($f); flock($f, LOCK_UN); fclose($f);
}
function lies_zeilen(string $name): array {
    $p = pfad($name); if (!is_file($p)) return [];
    $f = fopen($p, 'r'); flock($f, LOCK_SH); $t = stream_get_contents($f); flock($f, LOCK_UN); fclose($f);
    $aus = []; foreach (explode("\n", $t) as $z) { if ($z === '') continue; $d = json_decode($z, true); if (is_array($d)) $aus[] = $d; }
    return $aus;
}
function kennung(?string $s): string { $s = (string)$s; return preg_match('/^[A-Za-z0-9_-]{6,40}$/', $s) ? $s : ''; }
function baustein_id(?string $s): string { $s = (string)$s; return preg_match('/^[A-Za-z0-9_-]{1,60}$/', $s) ? $s : ''; }
function text(?string $s, int $max): string {                                  // UTF-8-sicher kürzen, auch ohne mbstring
    $s = trim(str_replace(["\r"], '', (string)$s));
    return function_exists('mb_substr') ? mb_substr($s, 0, $max) : (string)preg_replace('/^(.{0,' . $max . '}).*$/su', '$1', $s);
}
function laenge(string $s): int { return function_exists('mb_strlen') ? mb_strlen($s) : (int)preg_match_all('/./su', $s); }
function pbkdf2_hash(string $pw): string { $salz = bin2hex(random_bytes(16)); $it = 200000; return 'pbkdf2$sha256$' . $it . '$' . $salz . '$' . hash_pbkdf2('sha256', $pw, hex2bin($salz), $it, 64); }
function pbkdf2_ok(string $pw, string $hash): bool {
    $t = explode('$', $hash); if (count($t) !== 5 || $t[0] !== 'pbkdf2') return false;
    return hash_equals($t[4], hash_pbkdf2($t[1], $pw, hex2bin($t[3]), (int)$t[2], strlen($t[4])));
}
function standard_einstellungen(): array {
    return ['folgen' => true, 'notizen' => true, 'fertig' => true, 'barometer' => ['tempo', 'verstaendnis', 'relevanz', 'stimmung'],
            'ergebnisse' => 'freigabe', 'freigaben' => new stdClass(), 'version' => 1, 'start' => time()];
}
function einstellungen(): array { $e = lies_json('einstellungen.json', []); return array_merge(standard_einstellungen(), $e); }
function oeffentlich(array $e): array { return ['folgen' => (bool)$e['folgen'], 'notizen' => (bool)$e['notizen'], 'fertig' => (bool)$e['fertig'], 'barometer' => array_values($e['barometer']), 'ergebnisse' => $e['ergebnisse'], 'version' => (int)$e['version']]; }

// Datenordner absichern (falls deploy.py ihn nicht angelegt hat)
if (!is_dir(DATEN)) @mkdir(DATEN, 0750, true);
if (!is_file(pfad('.htaccess'))) @file_put_contents(pfad('.htaccess'), "Require all denied\n");
if (!is_file(pfad('index.html'))) @file_put_contents(pfad('index.html'), '');

session_name('qp_live');
session_set_cookie_params(['lifetime' => 0, 'path' => dirname($_SERVER['SCRIPT_NAME'] ?? '/'), 'httponly' => true, 'samesite' => 'Lax',
                           'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
session_start();
$ist_ref = !empty($_SESSION['ref']);

$a = $_GET['a'] ?? '';
$post = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (($_SERVER['HTTP_X_QP'] ?? '') !== '1') fehler('Kopf X-QP fehlt', 403);
    $post = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($post)) fehler('Kein JSON');
    $a = $post['a'] ?? $a;
}
function ref_noetig(bool $ist_ref): void { if (!$ist_ref) fehler('Anmeldung nötig', 401); }

switch ($a) {

// ---------- Teilnehmer*innen ----------
case 'tn': {
    $tn = kennung($_GET['tn'] ?? ''); if (!$tn) fehler('Kennung fehlt');
    $jetzt = time();
    aendere_json('praesenz.json', [], function ($p) use ($tn, $jetzt) {
        $p[$tn] = $jetzt; foreach ($p as $k => $t) if ($jetzt - $t > PRAESENZ_SEK * 3) unset($p[$k]); return $p; });
    $e = einstellungen();
    $z = lies_json('zustand.json', ['folie' => 1, 'schritt' => 0, 't' => 0]);
    $folie = max(0, (int)($_GET['f'] ?? 0));
    $frei = [];                                                             // freigegebene Ergebnisse (für alle sichtbar)
    foreach ((array)$e['freigaben'] as $id => $fg) {
        if (!empty($fg['an'])) $frei[$id] = ['loesung' => $fg['loesung'] ?? null, 'antworten' => antworten_zu($id)];
    }
    if ($e['ergebnisse'] === 'sofort' && $folie) {                          // sofort: alle Bausteine dieser Folie
        foreach (lies_json('bausteine.json', []) as $id => $f) if ((int)$f === $folie && !isset($frei[$id])) $frei[$id] = ['loesung' => null, 'antworten' => antworten_zu($id)];
    }
    antwort(['t' => $jetzt, 'folie' => (int)$z['folie'], 'schritt' => (int)$z['schritt'], 'einstellungen' => oeffentlich($e), 'frei' => (object)$frei,
             'fertig' => $folie ? count(array_filter(lies_zeilen('fertig.jsonl'), fn($x) => (int)$x['folie'] === $folie)) : 0]);
}
case 'stimmung': {
    $tn = kennung($post['tn'] ?? ''); $kat = (string)($post['kat'] ?? ''); $wert = (int)($post['wert'] ?? 0);
    if (!$tn || !in_array($kat, KATEGORIEN, true) || $wert < 1 || $wert > 5) fehler('Ungültig');
    haenge_an('stimmung.jsonl', ['t' => time(), 'tn' => $tn, 'kat' => $kat, 'wert' => $wert, 'folie' => (int)($post['folie'] ?? 0)]);
    antwort(['ok' => true]);
}
case 'notiz': {
    $e = einstellungen(); if (!$e['notizen']) fehler('Hinweise sind abgeschaltet', 403);
    $tn = kennung($post['tn'] ?? ''); $txt = text($post['text'] ?? '', 1000); $art = (string)($post['art'] ?? 'hinweis');
    if (!$tn || $txt === '') fehler('Text fehlt');
    if (!in_array($art, NOTIZ_ARTEN, true)) $art = 'hinweis';
    $eigene = count(array_filter(lies_zeilen('notizen.jsonl'), fn($n) => $n['tn'] === $tn));
    if ($eigene >= 40) fehler('Zu viele Hinweise', 429);
    $id = bin2hex(random_bytes(6));
    haenge_an('notizen.jsonl', ['id' => $id, 't' => time(), 'tn' => $tn, 'folie' => (int)($post['folie'] ?? 0), 'art' => $art, 'text' => $txt, 'status' => 'neu']);
    antwort(['ok' => true, 'id' => $id]);
}
case 'fertig': {
    $tn = kennung($post['tn'] ?? ''); $folie = (int)($post['folie'] ?? 0); if (!$tn || !$folie) fehler('Ungültig');
    $schon = array_filter(lies_zeilen('fertig.jsonl'), fn($x) => $x['tn'] === $tn && (int)$x['folie'] === $folie);
    if (!$schon) haenge_an('fertig.jsonl', ['t' => time(), 'tn' => $tn, 'folie' => $folie]);
    antwort(['ok' => true, 'n' => count(array_filter(lies_zeilen('fertig.jsonl'), fn($x) => (int)$x['folie'] === $folie))]);
}
case 'antwort': {
    $tn = kennung($post['tn'] ?? ''); $id = baustein_id($post['baustein'] ?? ''); if (!$tn || !$id) fehler('Ungültig');
    $wert = $post['wert'] ?? null;
    if (is_string($wert)) $wert = text($wert, 200);
    elseif (is_array($wert)) { $wert = array_slice($wert, 0, 40); foreach ($wert as $k => $v) $wert[$k] = is_string($v) ? text($v, 200) : (is_numeric($v) ? $v + 0 : null); }
    elseif (!is_numeric($wert)) fehler('Wert ungültig');
    $mehrfach = !empty($post['mehrfach']);
    aendere_json('antworten.json', [], function ($alle) use ($id, $tn, $wert, $mehrfach, $post) {
        $liste = $alle[$id] ?? [];
        if ($mehrfach) { if (count(array_filter($liste, fn($x) => $x['tn'] === $tn)) >= 10) return $alle; $liste[] = ['tn' => $tn, 'wert' => $wert, 't' => time()]; }
        else { $liste = array_values(array_filter($liste, fn($x) => $x['tn'] !== $tn)); $liste[] = ['tn' => $tn, 'wert' => $wert, 't' => time()]; }
        $alle[$id] = $liste; return $alle; });
    if (!empty($post['folie'])) aendere_json('bausteine.json', [], function ($b) use ($id, $post) { $b[$id] = (int)$post['folie']; return $b; });
    antwort(['ok' => true]);
}

// ---------- Anmeldung ----------
case 'login': {
    $pw = (string)($post['passwort'] ?? '');
    $sperre = lies_json('login_sperre.json', []); $ip = $_SERVER['REMOTE_ADDR'] ?? '?'; $s = $sperre[$ip] ?? ['n' => 0, 't' => 0];
    if ($s['n'] >= 5 && time() - $s['t'] < 60) fehler('Zu viele Fehlversuche – bitte eine Minute warten', 429);
    $z = lies_json('zugang.json', []);
    if (!isset($z['hash']) || !pbkdf2_ok($pw, $z['hash'])) {
        aendere_json('login_sperre.json', [], function ($l) use ($ip) { $l[$ip] = ['n' => (($l[$ip]['n'] ?? 0) + 1), 't' => time()]; return $l; });
        fehler('Passwort stimmt nicht', 401);
    }
    aendere_json('login_sperre.json', [], function ($l) use ($ip) { unset($l[$ip]); return $l; });
    session_regenerate_id(true); $_SESSION['ref'] = true;
    antwort(['ok' => true]);
}
case 'logout': { $_SESSION = []; session_destroy(); antwort(['ok' => true]); }
case 'status': { antwort(['ref' => $ist_ref, 'einstellungen' => oeffentlich(einstellungen())]); }

// ---------- Vortragende ----------
case 'ref': {
    ref_noetig($ist_ref);
    $jetzt = time(); $e = einstellungen();
    $praesenz = lies_json('praesenz.json', []); $online = count(array_filter($praesenz, fn($t) => $jetzt - $t <= PRAESENZ_SEK));
    $seit = (string)($_GET['seit'] ?? ''); $folie = (int)($_GET['folie'] ?? 0);
    $notizen = lies_zeilen('notizen.jsonl'); $status = lies_json('notiz_status.json', []);
    foreach ($notizen as &$n) { $n['status'] = $status[$n['id']] ?? $n['status']; unset($n['tn']); } unset($n);
    $neu = []; $gefunden = $seit === '';
    foreach ($notizen as $n) { if ($gefunden) $neu[] = $n; elseif ($n['id'] === $seit) $gefunden = true; }
    if (!$gefunden) $neu = $notizen;                                        // unbekannte Marke: alles schicken
    $stimmung = [];
    foreach (KATEGORIEN as $k) $stimmung[$k] = ['n' => 0, 'mittel' => null, 'verteilung' => [0, 0, 0, 0, 0]];
    $letzte = [];                                                             // je tn und Kategorie der jüngste Wert
    foreach (lies_zeilen('stimmung.jsonl') as $s) { if ($jetzt - $s['t'] <= BAROMETER_FENSTER) $letzte[$s['kat'] . '|' . $s['tn']] = $s; }
    foreach ($letzte as $s) { $st = &$stimmung[$s['kat']]; $st['n']++; $st['verteilung'][$s['wert'] - 1]++; $st['mittel'] = ($st['mittel'] ?? 0) + $s['wert']; unset($st); }
    foreach ($stimmung as &$st) if ($st['n']) $st['mittel'] = round($st['mittel'] / $st['n'], 2); unset($st);
    $fertig = []; foreach (lies_zeilen('fertig.jsonl') as $x) $fertig[$x['folie']] = ($fertig[$x['folie']] ?? 0) + 1;
    $alle = lies_json('antworten.json', []); $erg = [];
    foreach ($alle as $id => $liste) $erg[$id] = ['n' => count($liste), 'antworten' => array_map(fn($x) => $x['wert'], $liste)];
    antwort(['t' => $jetzt, 'online' => $online, 'notizen' => $neu, 'notizen_gesamt' => count($notizen),
             'offen' => count(array_filter($notizen, fn($n) => $n['status'] === 'neu')), 'stimmung' => $stimmung, 'fertig' => (object)$fertig,
             'ergebnisse' => (object)$erg, 'einstellungen' => $e, 'letzte_notiz' => $notizen ? end($notizen)['id'] : '']);
}
case 'zustand': {
    ref_noetig($ist_ref);
    schreib_json('zustand.json', ['folie' => max(1, (int)($post['folie'] ?? 1)), 'schritt' => max(0, (int)($post['schritt'] ?? 0)), 't' => time()]);
    antwort(['ok' => true]);
}
case 'einstellungen': {
    ref_noetig($ist_ref);
    $e = aendere_json('einstellungen.json', standard_einstellungen(), function ($e) use ($post) {
        $e = array_merge(standard_einstellungen(), $e);
        foreach (['folgen', 'notizen', 'fertig'] as $k) if (isset($post[$k])) $e[$k] = (bool)$post[$k];
        if (isset($post['barometer']) && is_array($post['barometer'])) $e['barometer'] = array_values(array_intersect(KATEGORIEN, array_map('strval', $post['barometer'])));
        if (isset($post['ergebnisse']) && in_array($post['ergebnisse'], ['sofort', 'freigabe', 'nie'], true)) $e['ergebnisse'] = $post['ergebnisse'];
        $e['version'] = (int)$e['version'] + 1; return $e; });
    antwort(['ok' => true, 'einstellungen' => $e]);
}
case 'freigabe': {
    ref_noetig($ist_ref); $id = baustein_id($post['baustein'] ?? ''); if (!$id) fehler('Baustein fehlt');
    $e = aendere_json('einstellungen.json', standard_einstellungen(), function ($e) use ($id, $post) {
        $e = array_merge(standard_einstellungen(), $e); $fg = (array)$e['freigaben'];
        if (!empty($post['an'])) $fg[$id] = ['an' => true, 'loesung' => $post['loesung'] ?? null, 't' => time()]; else unset($fg[$id]);
        $e['freigaben'] = (object)$fg; $e['version'] = (int)$e['version'] + 1; return $e; });
    antwort(['ok' => true, 'freigaben' => $e['freigaben']]);
}
case 'notiz_status': {
    ref_noetig($ist_ref); $id = baustein_id($post['id'] ?? ''); $st = (string)($post['status'] ?? 'gelesen');
    if (!$id || !in_array($st, ['neu', 'gelesen', 'gezeigt', 'erledigt'], true)) fehler('Ungültig');
    aendere_json('notiz_status.json', [], function ($s) use ($id, $st) { $s[$id] = $st; return $s; });
    antwort(['ok' => true]);
}
case 'verlauf': {
    ref_noetig($ist_ref); $e = einstellungen();
    $status = lies_json('notiz_status.json', []); $notizen = lies_zeilen('notizen.jsonl');
    foreach ($notizen as &$n) { $n['status'] = $status[$n['id']] ?? $n['status']; unset($n['tn']); } unset($n);
    $stimmung = array_map(fn($s) => ['t' => $s['t'], 'tn' => substr(md5($s['tn']), 0, 6), 'kat' => $s['kat'], 'wert' => $s['wert'], 'folie' => $s['folie']], lies_zeilen('stimmung.jsonl'));
    antwort(['start' => (int)$e['start'], 'stimmung' => $stimmung, 'notizen' => $notizen, 'fertig' => lies_zeilen('fertig.jsonl'),
             'antworten' => lies_json('antworten.json', []), 'bausteine' => lies_json('bausteine.json', []), 'kategorien' => KATEGORIEN]);
}
case 'reset': {
    ref_noetig($ist_ref); $was = (string)($post['was'] ?? '');
    $gruppen = ['stimmung' => ['stimmung.jsonl'], 'notizen' => ['notizen.jsonl', 'notiz_status.json'], 'fertig' => ['fertig.jsonl'],
                'antworten' => ['antworten.json', 'bausteine.json']];
    $dateien = $was === 'alles' ? array_merge(...array_values($gruppen)) : ($gruppen[$was] ?? null);
    if ($dateien === null) fehler('Unbekannt');
    foreach ($dateien as $d) if (is_file(pfad($d))) unlink(pfad($d));
    aendere_json('einstellungen.json', standard_einstellungen(), function ($e) use ($was) {
        $e = array_merge(standard_einstellungen(), $e);
        if (in_array($was, ['alles', 'antworten'], true)) $e['freigaben'] = new stdClass();
        if ($was === 'alles') $e['start'] = time();
        $e['version'] = (int)$e['version'] + 1; return $e; });
    antwort(['ok' => true]);
}
case 'passwort': {
    ref_noetig($ist_ref); $neu = (string)($post['neu'] ?? ''); if (laenge($neu) < 6) fehler('Mindestens 6 Zeichen');
    schreib_json('zugang.json', ['hash' => pbkdf2_hash($neu), 'geaendert' => time()]);
    antwort(['ok' => true]);
}
default: fehler('Unbekannte Aktion', 404);
}

function antworten_zu(string $id): array { $alle = lies_json('antworten.json', []); return array_map(fn($x) => $x['wert'], $alle[$id] ?? []); }
