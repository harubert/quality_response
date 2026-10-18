/* Quality Response – live-fähige Fassungen der Quality-Point-Bausteine.
   bauen.py markiert in der Präsentation die Bausteine ia-schaetz, ia-quiz, ia-umfrage, ia-sort, ia-wolke, ia-ampel mit
   „ia-fertig qr-live“: Quality Point überspringt sie, diese Datei baut sie – am Vortragsrechner mit den Antworten aller,
   in der Teilnehmerfassung (body.tn) als Eingabe. Lösungen (data-wert, data-loesung, data-richtig, data-ziel, data-text)
   stehen nur in der Referentenfassung; Teilnehmer*innen bekommen sie mit der Freigabe. Markup: Quality Point, engine/FOLIEN.md. */
(function(){
  const $=(t,c,h)=>{ const e=document.createElement(t); if(c) e.className=c; if(h!=null) e.innerHTML=h; return e; };
  const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // Klicks und Rad bleiben im Baustein (kein Folienwechsel); Tasten nur in Eingabefeldern – ein angeklickter Knopf gibt den Fokus
  // sofort wieder ab, damit Presenter und Pfeiltasten weiter die Folien steuern.
  const stop=el=>{ ['click','pointerdown','wheel'].forEach(ev=>el.addEventListener(ev,e=>e.stopPropagation()));
    el.addEventListener('keydown',e=>{ if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) e.stopPropagation(); });
    el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) b.blur(); }); };
  const fmt=v=>Number(v).toLocaleString(document.documentElement.lang||'de',{maximumFractionDigits:1});
  const TN=document.body.classList.contains('tn');              // Teilnehmer-Fassung (teilnehmer.html)
  const L=()=>window.qrLive||null;                               // Live-Modul, nur im Server-Modus vorhanden
  const live=()=>!!L();
  const senden=(el,wert,mehrfach)=>{ const l=L(); if(l) l.antwort(el.dataset.id,wert,!!mehrfach); };
  const freigeben=(el,loesung)=>{ const l=L(); if(l&&!TN) l.freigeben(el.dataset.id,true,loesung); };
  const pct=(n,m)=>m?Math.round(n/m*100):0;
  /* Balkendiagramm: zeilen [{label,n,ok}] */
  function balken(box,zeilen,gesamt){
    const m=Math.max(1,...zeilen.map(z=>z.n));
    box.innerHTML='<div class="ia-balken">'+zeilen.map(z=>'<div class="ia-bz'+(z.ok===true?' ok':z.ok===false?' nein':'')+'"><span class="ia-bl">'+esc(z.label)+'</span><span class="ia-bt"><i style="width:'+pct(z.n,m)+'%"></i></span><span class="ia-bn">'+z.n+(gesamt?' · '+pct(z.n,gesamt)+' %':'')+'</span></div>').join('')+'</div>'
      +(gesamt!=null?'<div class="ia-n">'+gesamt+' '+(gesamt===1?'Antwort':'Antworten')+'</div>':'');
  }
  const median=a=>{ if(!a.length) return null; const s=a.slice().sort((x,y)=>x-y), h=s.length>>1; return s.length%2?s[h]:(s[h-1]+s[h])/2; };

  /* 1 Schätzregler */
  function schaetz(el){
    const min=+(el.dataset.min||0), max=+(el.dataset.max||100), wahr=el.dataset.wert!=null?+el.dataset.wert:null, ein=el.dataset.einheit||'';
    el.innerHTML='<div class="ia-frage">'+esc(el.dataset.frage||'Schätzen Sie!')+'</div>'
      +'<div class="ia-skala"><input type="range" min="'+min+'" max="'+max+'" step="'+(el.dataset.schritt||1)+'" value="'+((min+max)/2)+'"><i class="ia-wahr"></i><div class="ia-hist"></div></div>'
      +'<div class="ia-zeile"><span class="ia-tipp">Schätzung: <b>'+fmt((min+max)/2)+'</b> '+esc(ein)+'</span>'+(TN?'<button class="ia-send">Abschicken</button>':'<button class="ia-los">Auflösen</button>')+'<span class="ia-erg"></span></div><div class="ia-live"></div>';
    const r=el.querySelector('input'), w=el.querySelector('.ia-wahr'), tip=el.querySelector('.ia-tipp b'), erg=el.querySelector('.ia-erg'), lv=el.querySelector('.ia-live'), hist=el.querySelector('.ia-hist');
    r.addEventListener('input',()=>{ tip.textContent=fmt(r.value); });
    const zeigeWahr=v=>{ w.style.left=((v-min)/(max-min)*100)+'%'; el.classList.add('aufgeloest'); const d=Math.abs(v-r.value);
      erg.innerHTML='Wirklich: <b>'+fmt(v)+' '+esc(ein)+'</b> · '+(d===0?'genau getroffen!':'daneben um '+fmt(d)+' '+esc(ein)); };
    if(TN){ el.querySelector('.ia-send').addEventListener('click',e=>{ senden(el,+r.value); e.target.textContent='Gesendet ✓'; setTimeout(()=>e.target.textContent='Erneut schicken',2500); }); }
    else el.querySelector('.ia-los').addEventListener('click',()=>{ if(wahr==null) return; zeigeWahr(wahr); freigeben(el,{wert:wahr}); });
    el._loesung=()=>({wert:wahr});
    el._live=(antworten,frei)=>{                                   // antworten: Zahlen aller Teilnehmer*innen
      const a=(antworten||[]).map(Number).filter(x=>!isNaN(x));
      if(frei&&frei.loesung&&frei.loesung.wert!=null&&!el.classList.contains('aufgeloest')) zeigeWahr(+frei.loesung.wert);
      if(!a.length){ lv.textContent=''; hist.innerHTML=''; return; }
      const k=12, z=new Array(k).fill(0); a.forEach(v=>{ z[Math.min(k-1,Math.max(0,Math.floor((v-min)/(max-min)*k)))]++; });
      const mx=Math.max(...z); hist.innerHTML=z.map(n=>'<i style="height:'+Math.round(n/mx*100)+'%"></i>').join('');
      lv.innerHTML='<b>'+a.length+'</b> '+(a.length===1?'Schätzung':'Schätzungen')+' · Median <b>'+fmt(median(a))+' '+esc(ein)+'</b> · von '+fmt(Math.min(...a))+' bis '+fmt(Math.max(...a));
    };
    stop(el);
  }
  /* 4 Echt oder Fake? */
  function quiz(el){
    const inhalt=el.innerHTML, loes=el.dataset.loesung||null;
    el.innerHTML='<div class="ia-q-bild">'+inhalt+'</div><div class="ia-zeile"><button data-s="echt">Echt <i>0</i></button><button data-s="fake">Fake <i>0</i></button>'+(TN?'':'<button class="ia-los">Auflösen</button>')+'</div><div class="ia-erg"></div>';
    const z={echt:0,fake:0}, erg=el.querySelector('.ia-erg');
    const zeige=()=>el.querySelectorAll('button[data-s]').forEach(b=>b.querySelector('i').textContent=z[b.dataset.s]);
    el.querySelectorAll('button[data-s]').forEach(b=>b.addEventListener('click',()=>{
      if(TN){ senden(el,b.dataset.s); el.querySelectorAll('button[data-s]').forEach(x=>x.classList.toggle('gewaehlt',x===b)); erg.textContent='Deine Antwort: '+b.textContent.replace(/\d+$/,'').trim(); return; }
      if(live()) return; z[b.dataset.s]++; zeige(); }));
    const aufloesen=(l,text)=>{ const n=z.echt+z.fake; el.classList.add('aufgeloest');
      erg.innerHTML='<b>'+(l==='fake'?'Fake':'Echt')+'</b>'+(n?' · '+pct(z[l],n)+' % lagen richtig':'')+(text?' – '+esc(text):''); };
    if(!TN) el.querySelector('.ia-los').addEventListener('click',()=>{ if(!loes) return; aufloesen(loes,el.dataset.text); freigeben(el,{loesung:loes,text:el.dataset.text||''}); });
    el._loesung=()=>({loesung:loes,text:el.dataset.text||''});
    el._live=(antworten,frei)=>{
      if(antworten){ z.echt=antworten.filter(v=>v==='echt').length; z.fake=antworten.filter(v=>v==='fake').length; if(!TN||frei) zeige(); }
      if(frei&&frei.loesung&&!el.classList.contains('aufgeloest')) aufloesen(frei.loesung.loesung,frei.loesung.text);
    };
    stop(el);
  }
  /* 4b Umfrage / Quiz mit Balken */
  function umfrage(el){
    const opt=(el.dataset.optionen||'Ja|Nein').split('|').map(s=>s.trim()).filter(Boolean), mehr=el.dataset.mehrfach==='1', richtig=el.dataset.richtig?el.dataset.richtig.split('|').map(s=>s.trim()):null;
    el.innerHTML='<div class="ia-frage">'+esc(el.dataset.frage||'Ihre Meinung?')+'</div><div class="ia-opt">'+opt.map((o,i)=>'<button data-i="'+i+'">'+esc(o)+(TN?'':' <i>0</i>')+'</button>').join('')+'</div>'
      +'<div class="ia-zeile">'+(TN?(mehr?'<button class="ia-send">Abschicken</button>':''):(richtig?'<button class="ia-los">Auflösen</button>':'')+'<button class="ia-reset" title="zurücksetzen">↺</button>')+'<span class="ia-erg"></span></div><div class="ia-live"></div>';
    const z=opt.map(()=>0), lv=el.querySelector('.ia-live'), erg=el.querySelector('.ia-erg'), gew=new Set();
    const zeige=(gesamt)=>{ el.querySelectorAll('.ia-opt button i').forEach((i,k)=>i.textContent=z[k]); if(live()||TN) balken(lv,opt.map((o,k)=>({label:o,n:z[k],ok:el.classList.contains('aufgeloest')&&richtig?richtig.includes(o):null})),gesamt); };
    el.querySelectorAll('.ia-opt button').forEach(b=>b.addEventListener('click',()=>{ const k=+b.dataset.i;
      if(TN){ if(mehr){ b.classList.toggle('gewaehlt'); gew.has(k)?gew.delete(k):gew.add(k); } else { senden(el,opt[k]); el.querySelectorAll('.ia-opt button').forEach(x=>x.classList.toggle('gewaehlt',x===b)); erg.textContent='Gesendet ✓'; } return; }
      if(live()) return; z[k]++; zeige(z.reduce((a,b)=>a+b,0)); }));
    if(TN&&mehr) el.querySelector('.ia-send').addEventListener('click',e=>{ senden(el,[...gew].map(k=>opt[k])); e.target.textContent='Gesendet ✓'; });
    if(!TN){ el.querySelector('.ia-reset').addEventListener('click',()=>{ z.fill(0); el.classList.remove('aufgeloest'); zeige(0); });
      const los=el.querySelector('.ia-los'); if(los) los.addEventListener('click',()=>{ el.classList.add('aufgeloest'); zeige(z.reduce((a,b)=>a+b,0)); freigeben(el,{richtig}); }); }
    el._loesung=()=>({richtig});
    el._live=(antworten,frei)=>{
      if(antworten){ z.fill(0); antworten.forEach(v=>(Array.isArray(v)?v:[v]).forEach(o=>{ const k=opt.indexOf(o); if(k>=0) z[k]++; })); }
      if(frei&&frei.loesung&&frei.loesung.richtig){ el.classList.add('aufgeloest'); el.querySelectorAll('.ia-opt button').forEach((b,k)=>b.classList.toggle('ok',frei.loesung.richtig.includes(opt[k]))); }
      if(antworten&&(!TN||frei)) zeige(antworten.length); else if(TN) lv.innerHTML='';
    };
    zeige(0); stop(el);
  }
  /* 5 Zuordnen per Ziehen */
  function sort(el){
    const felder=(el.dataset.felder||'').split('|'), items=[...el.querySelectorAll('[data-ziel],[data-item]')];
    const vorrat=$('div','ia-vorrat'), reihe=$('div','ia-felder');
    felder.forEach(f=>{ const d=$('div','ia-feld','<b>'+esc(f)+'</b>'); d.dataset.feld=f; reihe.appendChild(d); });
    items.sort(()=>Math.random()-.5).forEach(it=>{ it.classList.add('ia-item'); it.draggable=true; vorrat.appendChild(it); });
    const knopf=$('button','ia-pruefen',TN?'Abschicken':'Prüfen'), lv=$('div','ia-live'); el.innerHTML=''; el.append(vorrat,reihe,knopf,lv);
    let gezogen=null;
    el.addEventListener('dragstart',e=>{ gezogen=e.target.closest('.ia-item'); });
    [vorrat,...reihe.children].forEach(z=>{ z.addEventListener('dragover',e=>e.preventDefault()); z.addEventListener('drop',e=>{ e.preventDefault(); if(gezogen){ z.appendChild(gezogen); gezogen.classList.remove('ok','falsch'); } }); });
    // Antippen statt Ziehen (Touch): Karte wählen, dann Feld antippen
    let gewaehlt=null;
    el.addEventListener('click',e=>{ const it=e.target.closest('.ia-item'), fd=e.target.closest('.ia-feld,.ia-vorrat');
      if(it){ if(gewaehlt) gewaehlt.classList.remove('gewaehlt'); gewaehlt=it; it.classList.add('gewaehlt'); return; }
      if(fd&&gewaehlt){ fd.appendChild(gewaehlt); gewaehlt.classList.remove('gewaehlt','ok','falsch'); gewaehlt=null; } });
    const zuordnung=()=>{ const m={}; el.querySelectorAll('.ia-feld .ia-item').forEach(it=>{ m[it.textContent.trim()]=it.parentElement.dataset.feld; }); return m; };
    const loesung=()=>{ const m={}; items.forEach(it=>{ if(it.dataset.ziel) m[it.textContent.trim()]=it.dataset.ziel; }); return m; };
    const markiere=(l)=>el.querySelectorAll('.ia-feld .ia-item').forEach(it=>{ const ok=l[it.textContent.trim()]===it.parentElement.dataset.feld; it.classList.toggle('ok',ok); it.classList.toggle('falsch',!ok); });
    knopf.addEventListener('click',e=>{ e.stopPropagation();
      if(TN){ senden(el,zuordnung()); knopf.textContent='Gesendet ✓'; setTimeout(()=>knopf.textContent='Erneut schicken',2500); return; }
      markiere(loesung()); freigeben(el,{zuordnung:loesung()}); });
    el._loesung=()=>({zuordnung:loesung()});
    el._live=(antworten,frei)=>{
      if(frei&&frei.loesung&&frei.loesung.zuordnung&&TN) markiere(frei.loesung.zuordnung);
      if(!antworten||!antworten.length||(TN&&!frei)){ lv.innerHTML=''; return; }
      const l=TN?(frei&&frei.loesung&&frei.loesung.zuordnung)||{}:loesung(), namen=Object.keys(l); let richtig=0, gesamt=0;
      antworten.forEach(a=>{ if(a&&typeof a==='object') namen.forEach(n=>{ if(a[n]!=null){ gesamt++; if(a[n]===l[n]) richtig++; } }); });
      lv.innerHTML='<b>'+antworten.length+'</b> '+(antworten.length===1?'Einsendung':'Einsendungen')+(gesamt?' · <b>'+pct(richtig,gesamt)+' %</b> der Zuordnungen richtig':'');
    };
    stop(el);
  }
  /* 8 Wortwolke (ohne Server: nur auf diesem Rechner; mit Server: Begriffe aller Teilnehmer*innen) */
  function wolke(el){
    el.innerHTML='<div class="ia-frage">'+esc(el.dataset.frage||'Ihre Begriffe')+'</div><div class="ia-zeile"><input type="text" maxlength="40" placeholder="Begriff eintippen, Enter"><button class="ia-send">Senden</button>'+(TN?'':'<button class="ia-leer">leeren</button>')+'</div><div class="ia-woerter"></div><div class="ia-live"></div>';
    const inp=el.querySelector('input'), box=el.querySelector('.ia-woerter'), lv=el.querySelector('.ia-live'), z={}, eigene=[];
    const zeig=()=>{ const m=Math.max(1,...Object.values(z)); box.innerHTML=Object.entries(z).sort(()=>Math.random()-.5).map(([w,n])=>'<span style="font-size:'+(22+n/m*46)+'px">'+esc(w)+'</span>').join(''); };
    const schick=()=>{ const w=inp.value.trim(); if(!w) return; inp.value='';
      if(TN){ eigene.push(w); lv.innerHTML='Deine Begriffe: '+eigene.map(esc).join(', '); senden(el,w,true); return; }
      if(live()){ senden(el,w,true); return; } z[w]=(z[w]||0)+1; zeig(); };
    inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') schick(); });
    el.querySelector('.ia-send').addEventListener('click',schick);
    if(!TN) el.querySelector('.ia-leer').addEventListener('click',()=>{ for(const k in z) delete z[k]; zeig(); const l=L(); if(l) l.zuruecksetzen('antworten',el.dataset.id); });
    el._live=(antworten,frei)=>{ if(!antworten||(TN&&!frei)) return; for(const k in z) delete z[k]; antworten.forEach(w=>{ const t=String(w).trim().toLowerCase(); if(t) z[t]=(z[t]||0)+1; }); zeig(); };
    stop(el);
  }
  /* 11 Ampel-Abstimmung (ohne Server: Handzeichen zählen) */
  function ampel(el){
    const F=['rot','gelb','gruen'], N={rot:'Nein',gelb:'Unentschieden',gruen:'Ja'};
    el.innerHTML='<div class="ia-frage">'+esc(el.dataset.frage||'Wie sehen Sie das?')+'</div><div class="ia-lichter">'+F.map(f=>'<div class="ia-l ia-'+f+'"><button title="'+(TN?N[f]:'eine Stimme dazu')+'">'+(TN?N[f]:'+')+'</button><i></i><b>0</b></div>').join('')+'</div>'+(TN?'':'<button class="ia-reset">↺</button>')+'<div class="ia-erg"></div>';
    const z={rot:0,gelb:0,gruen:0};
    const zeig=()=>{ const m=Math.max(1,z.rot+z.gelb+z.gruen); F.forEach(f=>{ const l=el.querySelector('.ia-'+f); l.querySelector('b').textContent=z[f]; l.querySelector('i').style.height=Math.round(z[f]/m*200)+'px'; }); };
    F.forEach(f=>el.querySelector('.ia-'+f+' button').addEventListener('click',e=>{
      if(TN){ senden(el,f); F.forEach(g=>el.querySelector('.ia-'+g+' button').classList.toggle('gewaehlt',g===f)); el.querySelector('.ia-erg').textContent='Gesendet ✓'; return; }
      if(live()) return; z[f]++; zeig(); }));
    if(!TN) el.querySelector('.ia-reset').addEventListener('click',()=>{ z.rot=z.gelb=z.gruen=0; zeig(); const l=L(); if(l) l.zuruecksetzen('antworten',el.dataset.id); });
    el._live=(antworten,frei)=>{ if(!antworten||(TN&&!frei)) return; el.classList.add('frei'); z.rot=z.gelb=z.gruen=0; antworten.forEach(v=>{ if(z[v]!=null) z[v]++; }); zeig(); };
    zeig(); stop(el);
  }
  const BAU={'ia-schaetz':schaetz,'ia-quiz':quiz,'ia-umfrage':umfrage,'ia-sort':sort,'ia-wolke':wolke,'ia-ampel':ampel};
  function init(root){ Object.entries(BAU).forEach(([k,f])=>root.querySelectorAll('#stage .'+k+'.qr-live:not(.qr-fertig)').forEach(el=>{ try{ f(el); el.classList.add('qr-fertig'); }catch(e){ console.warn(k,e); } })); }
  init(document);
  window.qrBausteine={init,typen:Object.keys(BAU)};

})();
