/* Quality Response – Browser-Teil (Server: live/api.php; Einbau in ein Quality-Point-Paket: bauen.py).
   Referentenfassung (praesentation.html): Anmeldung, Abgleich alle 3 s, Live-Panel (Taste A), Hinweis-Badge, Freigaben.
   Teilnehmerfassung (teilnehmer.html, body.tn): Abgleich alle 4 s, Folie folgt der Referentin / dem Referenten,
   Mitmach-Leiste (Barometer, Hinweise, Fertig, Aufgaben), nur freigegebene Ergebnisse.
   Konfiguration kommt als QR_KONFIG (bauen.py). */
(function(){
  const C=window.QR_KONFIG||{}, TN=document.body.classList.contains('tn'), API=C.api||'live/api.php';
  const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const $=(t,c,h)=>{ const e=document.createElement(t); if(c) e.className=c; if(h!=null) e.innerHTML=h; return e; };
  const KAT={tempo:['Tempo','zu langsam','zu schnell'],verstaendnis:['Verständlichkeit','verstehe wenig','alles klar'],relevanz:['Relevanz','für mich unwichtig','sehr relevant'],
    stimmung:['Stimmung','müde','wach und dabei'],lautstaerke:['Lautstärke','zu leise','zu laut'],pause:['Pause','brauche eine Pause','weiter so']};
  const ART={frage:'Frage',hinweis:'Hinweis',fehler:'Fehler',ergaenzung:'Ergänzung'};
  const deck=()=>window.deck;
  let tn=null; try{ tn=localStorage.getItem('qp-tn'); if(!tn){ tn=Array.from(crypto.getRandomValues(new Uint8Array(9)),b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join(''); localStorage.setItem('qp-tn',tn); } }catch(e){ tn='x'+Math.random().toString(36).slice(2,12); }
  async function post(a,d){ const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-QP':'1'},credentials:'same-origin',body:JSON.stringify(Object.assign({a},d||{}))});
    const j=await r.json().catch(()=>({})); if(!r.ok) throw Object.assign(new Error(j.fehler||r.status),{status:r.status,daten:j}); return j; }
  async function get(a,p){ const q=new URLSearchParams(Object.assign({a},p||{})); const r=await fetch(API+'?'+q,{credentials:'same-origin',cache:'no-store'});
    const j=await r.json().catch(()=>({})); if(!r.ok) throw Object.assign(new Error(j.fehler||r.status),{status:r.status,daten:j}); return j; }
  const nrVon=s=>+(s.dataset.nr||deck().slides.indexOf(s)+1);
  const aktuelleNr=()=>nrVon(deck().slides[deck().cur()]);
  const teilnehmerUrl=()=>location.href.replace(/[^/]*$/,'')+(C.teilnehmer||'teilnehmer.html');
  let ergebnisse={}, freigaben={}, einst=null;
  function bausteineAuf(sec){ return [...sec.querySelectorAll('.ia-fertig[data-id]'),...document.querySelectorAll('#mitmachen .ia-fertig[data-id]')].filter(el=>el._live); }   // Teilnehmer: Bausteine liegen in der Leiste
  function bausteineZeigen(){ const s=deck().slides[deck().cur()];
    bausteineAuf(s).forEach(el=>{ const id=el.dataset.id, f=freigaben[id];
      if(TN){ el._live(f?f.antworten:null, f?{loesung:f.loesung}:null); }
      else { const e=ergebnisse[id]; el._live(e?e.antworten:[], f&&f.an?{loesung:f.loesung}:null); } }); }
  window.qrLive={tn,teilnehmerUrl,
    antwort:(id,wert,mehrfach)=>post('antwort',{tn,baustein:id,wert,mehrfach:!!mehrfach,folie:aktuelleNr()}).catch(melde),
    freigeben:(id,an,loesung)=>post('freigabe',{baustein:id,an:!!an,loesung:loesung||null}).then(r=>{ freigaben=r.freigaben||{}; bausteineZeigen(); }).catch(melde),
    _debug:()=>({ergebnisse,freigaben,einst}),
    zuruecksetzen:(was,id)=>post('reset',{was}).then(()=>{ ergebnisse={}; bausteineZeigen(); }).catch(melde)};
  function hinweis(t,ms){ let h=document.getElementById('hinweis'); if(!h){ h=$('div'); h.id='hinweis'; document.body.appendChild(h); } h.innerHTML=t; h.classList.add('on'); clearTimeout(h._t); h._t=setTimeout(()=>h.classList.remove('on'),ms||5000); }
  function melde(e){ if(e&&e.status===401&&!TN){ anmeldung(); return; } console.warn('Live:',e); if(e&&e.status!==401) hinweis('<b>Live:</b> '+esc(e.message||e),4000); }

  /* ================= Teilnehmerfassung ================= */
  if(TN){
    let version=-1, letzteFolie=0, gesperrt=false, aktiveTabs='stimmung';
    const leiste=$('div'); leiste.id='mitmachen'; document.body.appendChild(leiste);
    const gesendet={}; try{ Object.assign(gesendet,JSON.parse(localStorage.getItem('qp-hinweise')||'{}')); }catch(e){}
    function baue(){
      const b=einst?einst.barometer:[];
      leiste.innerHTML='<div class="mm-kopf"><button class="mm-tab'+(aktiveTabs==='stimmung'?' on':'')+'" data-tab="stimmung">Stimmung</button>'
        +(einst&&einst.notizen?'<button class="mm-tab'+(aktiveTabs==='hinweis'?' on':'')+'" data-tab="hinweis">Hinweis</button>':'')
        +'<button class="mm-tab'+(aktiveTabs==='aufgabe'?' on':'')+'" data-tab="aufgabe">Aufgabe <i class="mm-punkt" hidden></i></button><span class="mm-stand"></span><button class="mm-zu" title="ein-/ausklappen">▾</button></div>'
        +'<div class="mm-inhalt">'
        +'<div class="mm-seite" data-seite="stimmung">'+(b.length?b.map(k=>'<div class="mm-baro" data-kat="'+k+'"><div class="mm-bt">'+esc(KAT[k][0])+'</div><div class="mm-skala"><span>'+esc(KAT[k][1])+'</span><input type="range" min="1" max="5" value="3"><span>'+esc(KAT[k][2])+'</span></div></div>').join(''):'<p class="mm-leer">Das Stimmungsbarometer ist gerade ausgeschaltet.</p>')+'<p class="mm-klein">Anonym. Dein Regler zählt, sobald du ihn bewegst; schieb ihn jederzeit nach.</p></div>'
        +'<div class="mm-seite" data-seite="hinweis" hidden><div class="mm-arten">'+Object.entries(ART).map(([k,v],i)=>'<label><input type="radio" name="mm-art" value="'+k+'"'+(i===1?' checked':'')+'> '+v+'</label>').join('')+'</div>'
        +'<textarea maxlength="1000" placeholder="Zur aktuellen Folie: Frage, Hinweis, Fehler oder Ergänzung …"></textarea><div class="mm-zeile"><button class="mm-senden">Absenden</button><span class="mm-info">Geht an die Referentin / den Referenten, bezogen auf die aktuelle Folie.</span></div><div class="mm-eigene"></div></div>'
        +'<div class="mm-seite" data-seite="aufgabe" hidden><div class="mm-fertig" hidden><button class="mm-ok">Fertig – ich bin so weit</button><span class="mm-fn"></span></div><div class="mm-widgets"></div><p class="mm-leer mm-keine">Auf dieser Folie gibt es gerade nichts zu beantworten.</p></div>'
        +'</div>';
      leiste.querySelectorAll('.mm-tab').forEach(t=>t.addEventListener('click',()=>{ aktiveTabs=t.dataset.tab; leiste.classList.remove('zu'); zeigeTab(); }));
      leiste.querySelector('.mm-zu').addEventListener('click',()=>leiste.classList.toggle('zu'));
      leiste.querySelectorAll('.mm-baro input').forEach(r=>{ let t=null; r.addEventListener('input',()=>{ r.closest('.mm-baro').classList.add('bewegt'); clearTimeout(t); t=setTimeout(()=>post('stimmung',{tn,kat:r.closest('.mm-baro').dataset.kat,wert:+r.value,folie:aktuelleNr()}).catch(melde),500); }); });
      const ta=leiste.querySelector('textarea'); ['keydown','keyup','keypress'].forEach(ev=>ta.addEventListener(ev,e=>e.stopPropagation()));
      leiste.querySelector('.mm-senden').addEventListener('click',async()=>{ const text=ta.value.trim(); if(!text) return; const art=leiste.querySelector('input[name=mm-art]:checked').value, folie=aktuelleNr();
        try{ const r=await post('notiz',{tn,folie,art,text}); gesendet[r.id]={t:Date.now(),folie,art,text}; try{ localStorage.setItem('qp-hinweise',JSON.stringify(gesendet)); }catch(e){} ta.value=''; eigeneZeigen(); hinweis('Hinweis gesendet – danke!',2500); }catch(e){ melde(e); } });
      leiste.querySelector('.mm-ok').addEventListener('click',async e=>{ try{ const r=await post('fertig',{tn,folie:aktuelleNr()}); e.target.textContent='Fertig gemeldet ✓'; e.target.disabled=true; leiste.querySelector('.mm-fn').textContent=r.n+' fertig'; }catch(x){ melde(x); } });
      ['click','pointerdown','wheel','touchstart','touchend'].forEach(ev=>leiste.addEventListener(ev,e=>e.stopPropagation(),{passive:true}));
      eigeneZeigen(); zeigeTab(); folieWechsel(true);
    }
    function eigeneZeigen(){ const box=leiste.querySelector('.mm-eigene'); if(!box) return; const l=Object.values(gesendet).sort((a,b)=>b.t-a.t).slice(0,20);
      box.innerHTML=l.length?'<div class="mm-bt">Deine Hinweise (nur auf diesem Gerät gespeichert)</div>'+l.map(n=>'<div class="mm-eig"><span class="mm-chip">'+esc(ART[n.art]||n.art)+'</span> Folie '+n.folie+': '+esc(n.text)+'</div>').join(''):''; }
    function zeigeTab(){ leiste.querySelectorAll('.mm-tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===aktiveTabs)); leiste.querySelectorAll('.mm-seite').forEach(s=>s.hidden=s.dataset.seite!==aktiveTabs); }
    let geparkt=[];                                                   // Bausteine der aktuellen Folie in die Leiste holen (auf dem Handy lesbar)
    function folieWechsel(){
      geparkt.forEach(({el,eltern,next})=>{ eltern.insertBefore(el,next&&next.parentNode===eltern?next:null); }); geparkt=[];
      const s=deck().slides[deck().cur()], box=leiste.querySelector('.mm-widgets'); if(!box) return;
      const ws=[...s.querySelectorAll('.ia-fertig[data-id]')].filter(el=>(C.typen||[]).some(k=>el.classList.contains(k)));
      ws.forEach(el=>{ geparkt.push({el,eltern:el.parentNode,next:el.nextSibling}); box.appendChild(el); });
      const fertig=einst&&einst.fertig&&(s.hasAttribute('data-fertig')||s.classList.contains('s-auftrag'));
      leiste.querySelector('.mm-fertig').hidden=!fertig; const ok=leiste.querySelector('.mm-ok'); ok.disabled=false; ok.textContent='Fertig – ich bin so weit'; leiste.querySelector('.mm-fn').textContent='';
      leiste.querySelector('.mm-keine').hidden=!!(ws.length||fertig); leiste.querySelector('.mm-punkt').hidden=!(ws.length||fertig);
      if((ws.length||fertig)&&letzteFolie!==aktuelleNr()){ aktiveTabs='aufgabe'; leiste.classList.remove('zu'); zeigeTab(); }
      letzteFolie=aktuelleNr(); bausteineZeigen();
    }
    document.addEventListener('qp-folie',()=>{ if(leiste.querySelector('.mm-widgets')) folieWechsel(); });
    async function abgleich(){
      try{ const r=await get('tn',{tn,v:version,f:aktuelleNr()});
        if(!einst||r.einstellungen.version!==version){ einst=r.einstellungen; version=einst.version; if(!leiste.querySelector('.mm-kopf')) baue(); else { const alt=aktiveTabs; baue(); aktiveTabs=alt; zeigeTab(); } }
        freigaben={}; Object.entries(r.frei||{}).forEach(([id,f])=>freigaben[id]=f);
        if(einst.folgen){ if(!gesperrt){ gesperrt=true; deck().setLock(true); } if(r.folie!==aktuelleNr()||r.schritt!==deck().step()) deck().goNr(r.folie,r.schritt); }
        else if(gesperrt){ gesperrt=false; deck().setLock(false); }
        const st=leiste.querySelector('.mm-stand'); if(st) st.textContent=(einst.folgen?'folgt dem Vortrag · ':'frei blättern · ')+'Folie '+aktuelleNr();
        const fn=leiste.querySelector('.mm-fn'); if(fn&&r.fertig) fn.textContent=r.fertig+' fertig';
        bausteineZeigen(); leiste.classList.remove('offline');
      }catch(e){ leiste.classList.add('offline'); }
      setTimeout(abgleich,4000);
    }
    const start=$('div'); start.id='mmStart'; start.innerHTML='<div class="mms"><div class="kick">Mitmachen</div><h2>'+esc(document.title)+'</h2><p>Du siehst die Folien mit und kannst anonym mitmachen: Stimmung melden, Fragen und Hinweise schicken, bei Aufgaben antworten. Auf dem Handy am besten quer halten.</p><button>Los geht’s</button></div>';
    document.body.appendChild(start); start.querySelector('button').addEventListener('click',()=>{ start.remove(); abgleich(); }); start.addEventListener('click',e=>e.stopPropagation());
    return;
  }

  /* ================= Referentenfassung ================= */
  let seit='', angemeldet=false, geladen=false, panel=null, tab='uebersicht', offen=0, online=0, stimmung={}, fertig={}, notizen=[], verlauf=null, zustandT=null;
  const badge=$('button','','<span class="lb-on">● 0</span><span class="lb-n" hidden></span>'); badge.id='liveBadge'; badge.title='Live-Panel (A)'; document.body.appendChild(badge);
  badge.addEventListener('click',e=>{ e.stopPropagation(); panelAuf(offen?'hinweise':'uebersicht'); });
  function anmeldung(){ if(document.getElementById('liveLogin')) return;
    const d=$('div'); d.id='liveLogin'; d.innerHTML='<form class="lg"><div class="kick">Quality Point Live</div><h3>Als Referent*in anmelden</h3><p>Damit laufen Hinweise, Barometer und Antworten der Teilnehmer*innen hier zusammen.</p><input type="password" autocomplete="current-password" placeholder="Passwort"><div class="lg-m"></div><div class="lg-z"><button type="button" class="lg-x">Ohne Live weiter</button><button type="submit">Anmelden</button></div></form>';
    document.body.appendChild(d); const inp=d.querySelector('input'); inp.focus(); ['keydown','keyup'].forEach(ev=>inp.addEventListener(ev,e=>e.stopPropagation())); d.addEventListener('click',e=>e.stopPropagation());
    d.querySelector('.lg-x').addEventListener('click',()=>d.remove());
    d.querySelector('form').addEventListener('submit',async e=>{ e.preventDefault(); const m=d.querySelector('.lg-m'); m.textContent='Prüfe …';
      try{ await post('login',{passwort:inp.value}); d.remove(); angemeldet=true; hinweis('Live angemeldet. <kbd>A</kbd> öffnet das Panel.',4000); refAbgleich(); zustandSenden(); }catch(x){ m.textContent=x.message||'Fehler'; inp.select(); } }); }
  function zustandSenden(){ if(!angemeldet) return; clearTimeout(zustandT); zustandT=setTimeout(()=>post('zustand',{folie:aktuelleNr(),schritt:deck().step()}).catch(()=>{}),150); }
  document.addEventListener('qp-folie',()=>{ zustandSenden(); if(angemeldet) bausteineZeigen(); if(panel&&panel.classList.contains('on')&&tab==='ergebnisse') panelZeichnen(); });
  async function refAbgleich(){
    if(!angemeldet) return;
    try{ const r=await get('ref',{seit,folie:aktuelleNr()});
      online=r.online; stimmung=r.stimmung; fertig=r.fertig||{}; ergebnisse=r.ergebnisse||{}; einst=r.einstellungen; freigaben=einst.freigaben||{};
      if(r.notizen&&r.notizen.length){ r.notizen.forEach(n=>{ if(!notizen.find(x=>x.id===n.id)){ notizen.push(n); if(geladen&&n.status==='neu') toast(n); } }); }   // beim ersten Abgleich nichts aufpoppen
      seit=r.letzte_notiz||seit; offen=r.offen; geladen=true;
      badge.querySelector('.lb-on').textContent='● '+online; const bn=badge.querySelector('.lb-n'); bn.hidden=!offen; bn.textContent=offen+' neu'; badge.classList.toggle('neu',!!offen);
      bausteineZeigen(); if(panel&&panel.classList.contains('on')&&tab!=='verlauf') panelZeichnen();
    }catch(e){ if(e.status===401){ angemeldet=false; anmeldung(); return; } }
    setTimeout(refAbgleich,3000);
  }
  function toast(n){ const t=$('div','liveToast','<b>'+esc(ART[n.art]||'Hinweis')+' · Folie '+n.folie+'</b><span>'+esc(n.text.slice(0,160))+(n.text.length>160?' …':'')+'</span>'); document.body.appendChild(t);
    t.addEventListener('click',e=>{ e.stopPropagation(); t.remove(); panelAuf('hinweise'); }); setTimeout(()=>t.classList.add('on'),20); setTimeout(()=>{ t.classList.remove('on'); setTimeout(()=>t.remove(),400); },7000); }
  function panelAuf(t){ if(t) tab=t; if(!panel){ panel=$('div'); panel.id='livePanel'; document.body.appendChild(panel); ['click','pointerdown','wheel','keydown','keyup'].forEach(ev=>panel.addEventListener(ev,e=>e.stopPropagation())); }
    panel.classList.add('on'); if(tab==='verlauf') ladeVerlauf(); else panelZeichnen(); }
  function panelZu(){ if(panel) panel.classList.remove('on'); }
  const baro=(k,s)=>{ const d=(s&&s.verteilung)||[0,0,0,0,0], m=Math.max(1,...d); return '<div class="lp-baro"><div class="lp-bk">'+esc(KAT[k][0])+'<span>'+(s&&s.n?s.mittel.toFixed(1)+' · '+s.n:'–')+'</span></div><div class="lp-bs"><span class="l">'+esc(KAT[k][1])+'</span><div class="lp-bv">'+d.map(n=>'<i style="height:'+Math.round(n/m*100)+'%"></i>').join('')+(s&&s.n?'<b style="left:'+((s.mittel-1)/4*100)+'%"></b>':'')+'</div><span class="r">'+esc(KAT[k][2])+'</span></div></div>'; };
  function panelZeichnen(){
    const e=einst||{barometer:[],folgen:true,notizen:true,fertig:true,ergebnisse:'freigabe'}, nr=aktuelleNr(), s=deck().slides[deck().cur()];
    let body='';
    if(tab==='uebersicht'){
      body='<div class="lp-kacheln"><div class="lp-k"><b>'+online+'</b>online</div><div class="lp-k"><b>'+(fertig[nr]||0)+'</b>fertig auf Folie '+nr+'</div><div class="lp-k"><b>'+offen+'</b>offene Hinweise</div></div>'
        +(e.barometer.length?'<div class="lp-h">Barometer <small>(letzte 15 Minuten, je Person der jüngste Wert)</small></div>'+e.barometer.map(k=>baro(k,stimmung[k])).join(''):'<p class="lp-leer">Barometer ausgeschaltet (Einstellungen).</p>')
        +'<div class="lp-h">Teilnehmer*innen einladen</div><div class="lp-qr"><div class="lp-qrbild"></div><div><div class="lp-url">'+esc(teilnehmerUrl())+'</div><p>QR-Code auf der Startseite; diese Adresse gilt auch direkt. Teilnehmer*innen bleiben anonym.</p></div></div>';
    } else if(tab==='hinweise'){
      const l=notizen.slice().reverse();
      body='<div class="lp-zeile"><span>'+l.length+' Hinweise</span>'+(l.some(n=>n.status==='neu')?'<button data-act="alle-gelesen">Alle als gelesen markieren</button>':'')+'</div>'
        +(l.length?l.map(n=>'<div class="lp-n '+n.status+'" data-id="'+n.id+'"><div class="lp-nk"><span class="mm-chip '+n.art+'">'+esc(ART[n.art]||n.art)+'</span><span>Folie '+n.folie+' · '+new Date(n.t*1000).toLocaleTimeString(document.documentElement.lang||'de',{hour:'2-digit',minute:'2-digit'})+'</span><span class="lp-ns">'+({neu:'neu',gelesen:'gelesen',gezeigt:'gezeigt',erledigt:'erledigt'})[n.status]+'</span></div><div class="lp-nt">'+esc(n.text)+'</div><div class="lp-nb"><button data-act="zeigen" data-id="'+n.id+'">Auf der Folie zeigen</button><button data-act="springen" data-id="'+n.id+'" data-folie="'+n.folie+'">Zur Folie '+n.folie+'</button><button data-act="erledigt" data-id="'+n.id+'">Erledigt</button></div></div>').join(''):'<p class="lp-leer">Noch keine Hinweise.</p>');
    } else if(tab==='ergebnisse'){
      const ws=bausteineAuf(s);
      body='<div class="lp-h">Folie '+nr+' · '+esc(deck().title(s))+'</div>'+(ws.length?ws.map(el=>{ const id=el.dataset.id, f=freigaben[id], n=(ergebnisse[id]||{}).n||0, typ=[...el.classList].find(c=>c.startsWith('ia-')&&c!=='ia-fertig');
        return '<div class="lp-w"><div class="lp-wk"><b>'+esc(typ)+'</b> <code>'+esc(id)+'</code><span>'+n+' Antworten</span></div><div class="lp-wb"><button data-act="frei" data-id="'+id+'" data-an="'+(f&&f.an?'0':'1')+'">'+(f&&f.an?'Ergebnis für Teilnehmer*innen verbergen':'Ergebnis für Teilnehmer*innen freigeben')+'</button><button data-act="reset-b" data-id="'+id+'">Antworten löschen</button></div></div>'; }).join(''):'<p class="lp-leer">Auf dieser Folie gibt es keinen Live-Baustein.</p>')
        +'<p class="lp-klein">Ergebnisse erscheinen direkt im Baustein auf der Folie. Standard für Teilnehmer*innen: <b>'+({sofort:'sofort sichtbar',freigabe:'erst nach Freigabe',nie:'nie'})[e.ergebnisse]+'</b> (Einstellungen).</p>';
    } else if(tab==='einstellungen'){
      const chk=(k,v,l)=>'<label class="lp-chk"><input type="checkbox" data-set="'+k+'"'+(v?' checked':'')+'> '+l+'</label>';
      body='<div class="lp-h">Was Teilnehmer*innen sehen und dürfen</div>'+chk('folgen',e.folgen,'Folien folgen dem Vortrag (sonst frei blättern)')+chk('notizen',e.notizen,'Hinweise und Fragen schicken')+chk('fertig',e.fertig,'„Fertig“-Knopf auf Werkstatt-/Aufgabenfolien')
        +'<div class="lp-h">Ergebnisse von Umfragen und Aufgaben für Teilnehmer*innen</div><div class="lp-radio">'+['sofort','freigabe','nie'].map(v=>'<label><input type="radio" name="lp-erg" value="'+v+'"'+(e.ergebnisse===v?' checked':'')+'> '+({sofort:'sofort sichtbar',freigabe:'erst nach Freigabe (Knopf im Baustein oder unter „Ergebnisse“)',nie:'nie – nur hier am Vortragsrechner'})[v]+'</label>').join('')+'</div>'
        +'<div class="lp-h">Barometer-Kategorien</div>'+Object.keys(KAT).map(k=>chk('baro-'+k,e.barometer.includes(k),KAT[k][0]+' <small>('+KAT[k][1]+' … '+KAT[k][2]+')</small>')).join('')
        +'<div class="lp-h">Sitzung</div><div class="lp-zeile wrap"><button data-act="reset" data-was="stimmung">Barometer leeren</button><button data-act="reset" data-was="antworten">Antworten leeren</button><button data-act="reset" data-was="notizen">Hinweise leeren</button><button data-act="reset" data-was="fertig">Fertig-Meldungen leeren</button><button data-act="reset" data-was="alles" class="warn">Alles zurücksetzen (neue Sitzung)</button></div>'
        +'<div class="lp-h">Passwort ändern</div><div class="lp-zeile"><input type="password" id="lp-pw" placeholder="neues Passwort (mind. 6 Zeichen)"><button data-act="pw">Speichern</button><button data-act="logout">Abmelden</button></div>';
    } else if(tab==='verlauf'){ body=verlauf?verlaufHTML():'<p class="lp-leer">Lade …</p>'; }
    panel.innerHTML='<div class="lp-kopf"><div class="lp-tabs">'+[['uebersicht','Übersicht'],['hinweise','Hinweise'+(offen?' <i>'+offen+'</i>':'')],['ergebnisse','Ergebnisse'],['verlauf','Verlauf'],['einstellungen','Einstellungen']].map(([k,l])=>'<button class="'+(tab===k?'on':'')+'" data-tab="'+k+'">'+l+'</button>').join('')+'</div><button class="lp-x" title="schließen (Esc, A)">✕</button></div><div class="lp-body">'+body+'</div>';
    panel.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ tab=b.dataset.tab; if(tab==='verlauf') ladeVerlauf(); else panelZeichnen(); }));
    panel.querySelector('.lp-x').addEventListener('click',panelZu);
    const q=panel.querySelector('.lp-qrbild'); if(q&&typeof qrcode==='function'){ const c=qrcode(0,'M'); c.addData(teilnehmerUrl()); c.make(); q.innerHTML=c.createSvgTag({cellSize:4,margin:1,scalable:true}); }
    panel.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',async()=>{ const act=b.dataset.act, id=b.dataset.id;
      try{
        if(act==='zeigen'){ const n=notizen.find(x=>x.id===id); zeigeNotiz(n); await post('notiz_status',{id,status:'gezeigt'}); n.status='gezeigt'; }
        else if(act==='springen'){ deck().goNr(+b.dataset.folie,0); const n=notizen.find(x=>x.id===id); if(n.status==='neu'){ await post('notiz_status',{id,status:'gelesen'}); n.status='gelesen'; } }
        else if(act==='erledigt'){ await post('notiz_status',{id,status:'erledigt'}); notizen.find(x=>x.id===id).status='erledigt'; }
        else if(act==='alle-gelesen'){ for(const n of notizen) if(n.status==='neu'){ await post('notiz_status',{id:n.id,status:'gelesen'}); n.status='gelesen'; } }
        else if(act==='frei'){ const el=bausteineAuf(s).find(x=>x.dataset.id===id); const r=await post('freigabe',{baustein:id,an:b.dataset.an==='1',loesung:(el&&el._loesung)?el._loesung():null}); freigaben=r.freigaben||{}; }
        else if(act==='reset-b'||act==='reset'){ const was=act==='reset'?b.dataset.was:'antworten'; if(!confirmBox('Wirklich löschen: '+was+'?')) return; await post('reset',{was}); if(was==='alles'||was==='notizen'){ notizen=[]; seit=''; } ergebnisse={}; }
        else if(act==='pw'){ const v=panel.querySelector('#lp-pw').value; await post('passwort',{neu:v}); hinweis('Passwort geändert.',3000); }
        else if(act==='logout'){ await post('logout'); angemeldet=false; panelZu(); hinweis('Abgemeldet.',3000); return; }
        offen=notizen.filter(n=>n.status==='neu').length; await refAbgleichEinmal(); panelZeichnen();
      }catch(x){ melde(x); } }));
    panel.querySelectorAll('[data-set]').forEach(c=>c.addEventListener('change',async()=>{ const d={}; const k=c.dataset.set;
      if(k.startsWith('baro-')){ d.barometer=[...panel.querySelectorAll('[data-set^="baro-"]:checked')].map(x=>x.dataset.set.slice(5)); } else d[k]=c.checked;
      try{ const r=await post('einstellungen',d); einst=r.einstellungen; }catch(x){ melde(x); } }));
    panel.querySelectorAll('input[name=lp-erg]').forEach(r=>r.addEventListener('change',async()=>{ try{ const x=await post('einstellungen',{ergebnisse:r.value}); einst=x.einstellungen; }catch(e){ melde(e); } }));
    const pw=panel.querySelector('#lp-pw'); if(pw) ['keydown','keyup'].forEach(ev=>pw.addEventListener(ev,e=>e.stopPropagation()));
  }
  function confirmBox(t){ return window.confirm?window.confirm(t):true; }
  async function refAbgleichEinmal(){ try{ const r=await get('ref',{seit:'',folie:aktuelleNr()}); online=r.online; stimmung=r.stimmung; fertig=r.fertig||{}; ergebnisse=r.ergebnisse||{}; einst=r.einstellungen; freigaben=einst.freigaben||{}; notizen=r.notizen||[]; seit=r.letzte_notiz||''; offen=r.offen; bausteineZeigen(); }catch(e){} }
  function zeigeNotiz(n){ let o=document.getElementById('liveNotiz'); if(!o){ o=$('div'); o.id='liveNotiz'; document.body.appendChild(o); o.addEventListener('click',e=>{ e.stopPropagation(); o.classList.remove('on'); }); }
    o.innerHTML='<div class="ln"><div class="kick">'+esc(ART[n.art]||'Hinweis')+' aus dem Publikum · Folie '+n.folie+'</div><p>'+esc(n.text)+'</p><small>Klick oder Esc schließt</small></div>'; o.classList.add('on'); panelZu(); }
  async function ladeVerlauf(){ try{ verlauf=await get('verlauf'); }catch(e){ melde(e); verlauf=null; } panelZeichnen(); }
  function verlaufHTML(){
    const v=verlauf, t0=v.start||Math.min(...v.stimmung.map(s=>s.t),Date.now()/1000), kats=(einst&&einst.barometer&&einst.barometer.length?einst.barometer:Object.keys(KAT)).filter(k=>v.stimmung.some(s=>s.kat===k));
    const W=900,H=220,P=40, bis=Math.max(...v.stimmung.map(s=>s.t),t0+60), span=Math.max(60,bis-t0);
    const x=t=>P+(t-t0)/span*(W-2*P), y=w=>H-P-(w-1)/4*(H-2*P);
    const folien=[...new Set(v.stimmung.map(s=>s.folie).filter(Boolean))];
    const svgKat=k=>{ const pts=v.stimmung.filter(s=>s.kat===k).sort((a,b)=>a.t-b.t); const minuten={}; pts.forEach(s=>{ const m=Math.floor((s.t-t0)/60); (minuten[m]=minuten[m]||[]).push(s.wert); });
      const linie=Object.entries(minuten).map(([m,a])=>[x(t0+m*60+30),y(a.reduce((p,q)=>p+q,0)/a.length)]);
      return '<div class="lp-vk"><b>'+esc(KAT[k][0])+'</b> <small>'+esc(KAT[k][1])+' (1) … '+esc(KAT[k][2])+' (5) · '+pts.length+' Werte</small><svg viewBox="0 0 '+W+' '+H+'">'
        +[1,2,3,4,5].map(w=>'<line x1="'+P+'" x2="'+(W-P)+'" y1="'+y(w)+'" y2="'+y(w)+'" class="g'+(w===3?' m':'')+'"/><text x="'+(P-8)+'" y="'+(y(w)+4)+'" class="t" text-anchor="end">'+w+'</text>').join('')
        +pts.map(s=>'<circle cx="'+x(s.t)+'" cy="'+y(s.wert)+'" r="3" class="p"/>').join('')+(linie.length>1?'<polyline points="'+linie.map(p=>p.join(',')).join(' ')+'" class="l"/>':'')
        +'<text x="'+P+'" y="'+(H-8)+'" class="t">Start</text><text x="'+(W-P)+'" y="'+(H-8)+'" class="t" text-anchor="end">'+Math.round(span/60)+' min</text></svg></div>'; };
    const notizenN=v.notizen.length, fertigN=v.fertig.length;
    return '<div class="lp-h">Verlauf dieser Sitzung <small>(Start '+new Date(t0*1000).toLocaleTimeString(document.documentElement.lang||'de',{hour:'2-digit',minute:'2-digit'})+' · '+v.stimmung.length+' Barometerwerte · '+notizenN+' Hinweise · '+fertigN+' Fertig-Meldungen · Folien mit Werten: '+folien.join(', ')+')</small></div>'
      +(kats.length?kats.map(svgKat).join(''):'<p class="lp-leer">Noch keine Barometerwerte.</p>')
      +'<div class="lp-zeile"><button data-exp="json">Export JSON</button><button data-exp="csv">Export CSV (Barometer)</button><span class="lp-klein">Anonym: Teilnehmer-Kennungen sind gekürzte Prüfsummen.</span></div>';
  }
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-exp]'); if(!b||!verlauf) return; e.stopPropagation();
    const art=b.dataset.exp; let inhalt, typ, name;
    if(art==='json'){ inhalt=JSON.stringify(verlauf,null,1); typ='application/json'; name='quality-point-live.json'; }
    else { inhalt='zeit;kategorie;wert;folie;tn\n'+verlauf.stimmung.map(s=>new Date(s.t*1000).toISOString()+';'+s.kat+';'+s.wert+';'+s.folie+';'+s.tn).join('\n'); typ='text/csv'; name='quality-point-barometer.csv'; }
    const a=$('a'); a.href=URL.createObjectURL(new Blob([inhalt],{type:typ})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); });
  document.addEventListener('keydown',e=>{ if(e.target&&['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if(e.key==='a'||e.key==='A'){ if(!angemeldet){ anmeldung(); return; } if(panel&&panel.classList.contains('on')) panelZu(); else panelAuf(); }
    if(e.key==='Escape'){ panelZu(); const o=document.getElementById('liveNotiz'); if(o) o.classList.remove('on'); } });
  get('status').then(r=>{ if(r.ref){ angemeldet=true; refAbgleich(); zustandSenden(); } else if(location.search.includes('referent')||location.hash==='#live') anmeldung(); else badge.title='Live: anmelden (A)'; }).catch(()=>{});
})();
