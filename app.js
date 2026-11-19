/* Kompas Strażnika – prototyp PWA. Dane: data.json. Bez frameworków, działa offline. */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');
  let DB = null, INDEX = [];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('kompas:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('kompas:' + k, JSON.stringify(v)); } catch { /* brak pamięci – ignoruj */ } }
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- wyszukiwanie ---------- */
  const norm = s => String(s || '').toLowerCase()
    .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/¹/g, '1')
    .replace(/\b([a-z]{1,2})[\s-]+(\d{1,2}[a-z]?)\b/g, '$1$2')   // B-36, b 36 -> b36
    .replace(/[^a-z0-9§]+/g, ' ').trim();
  const tokens = s => norm(s).split(' ').filter(t => t && !STOP.has(t)).map(t => SYN[t] || t);
  const STOP = new Set(['art', 'w', 'z', 'na', 'i', 'o', 'do', 'za', 'czy', 'moge', 'ukarac', 'ust', 'pkt', 'zw', 'sie', 'jest', 'kw', 'k']);
  const SYN = { parkowanie: 'postoj', parkuje: 'postoj', zaparkowal: 'postoj', auto: 'pojazd', samochod: 'pojazd', smieci: 'zasmiecanie',
    halas: 'spokoj', glosno: 'spokoj', impreza: 'spokoj', piwo: 'alkohol', picie: 'alkohol', pies: 'zwierz', psa: 'zwierz',
    smycz: 'zwierz', kaganiec: 'zwierz', fajka: 'papieros', palenie: 'papieros', koperta: 'niepelnosprawn', inwalida: 'niepelnosprawn',
    pasy: 'przejscie', pasach: 'przejscie', pasow: 'przejscie', zebra: 'przejscie', hulajnoga: 'hulajnog', rowerzysta: 'rower', gaz: 'spb', paralizator: 'spb', kajdanki: 'spb' };

  function buildIndex() {
    INDEX = [];
    const add = (item, type, fields) => {
      const weighted = [];
      fields.forEach(([txt, w]) => tokens(txt).forEach(t => weighted.push([t, w])));
      INDEX.push({ item, type, weighted, title: norm(item.tytul), phrases: (item.potoczne || []).map(norm) });
    };
    DB.wpisy.forEach(w => add(w, 'wpis', [
      [w.tytul, 3], [(w.potoczne || []).join(' '), 3], [(w.znaki || []).join(' '), 5], [w.podstawa, 4], [w.opis, 1]
    ]));
    DB.kafle.forEach(k => add(k, 'kafel', [[k.tytul, 3], [(k.potoczne || []).join(' '), 3], [(k.punkty || []).join(' '), 1]]));
  }

  function search(q) {
    const qt = tokens(q), nq = norm(q);
    if (!qt.length) return [];
    const scored = INDEX.map(e => {
      let total = 0, hits = 0;
      for (const t of qt) {
        let best = 0;
        for (const [w, wt] of e.weighted) {
          if (w === t) best = Math.max(best, wt * 2);
          else if (w.startsWith(t) && t.length >= 2) best = Math.max(best, wt * 1.3);
          else if (t.length >= 4 && w.includes(t)) best = Math.max(best, wt);
        }
        if (best) { hits++; total += best; }
      }
      // całe zapytanie = potoczna nazwa lub początek tytułu -> wyżej
      if (nq.length >= 4 && e.title.startsWith(nq)) total += 14;
      else if (nq.length >= 4 && e.phrases.some(p => p === nq)) total += 12;
      else if (nq.length >= 4 && e.phrases.some(p => p.startsWith(nq))) total += 5;
      return { e, total, hits };
    }).filter(r => r.hits);
    const all = scored.filter(r => r.hits === qt.length);
    const res = (all.length ? all : scored).sort((a, b) => b.total - a.total);
    return res.map(r => r.e);
  }

  /* ---------- fragmenty UI ---------- */
  const kwotaTxt = k => {
    if (!k || k.typ === 'brak') return '<span class="amount none">brak stawki w taryfikatorze</span>';
    if (k.typ === 'widelki') return `<span class="amount">${k.min}–${k.max} zł</span>`;
    return `<span class="amount">${k.min} zł</span>`;
  };
  const pktTxt = p => !p ? '' : p.brak ? '0 pkt' : p.max ? `${p.liczba}–${p.max} pkt` : `${p.liczba} pkt`;
  const pktBadge = p => p ? `<span class="badge pkt${p.brak ? ' zero' : ''}" title="Punkty karne">${pktTxt(p)}</span>` : '';
  // 'nie' z wyjątkiem i 'czesc' = uprawnienie warunkowe -> żółte „Zależy”
  const smState = w => { const m = w.sm?.moze; return m === 'tak' ? 'tak' : (m === 'nie' && !w.sm.wyjatek) ? 'nie' : 'zalezy'; };
  const verdict = w => ({
    tak: '<span class="verdict tak">✓ SM może ukarać</span>',
    nie: '<span class="verdict nie">✕ Poza uprawnieniami SM</span>',
    zalezy: '<span class="verdict zalezy">± Zależy – zobacz warunki</span>'
  })[smState(w)];
  const signBadge = code => (DB.znakiGrafiki || []).includes(code)
    ? `<span class="signimg"><img src="icons/znaki/${esc(code)}.svg" alt="Znak ${esc(code)}" loading="lazy"><small>${esc(code)}</small></span>`
    : `<span class="sign${/^[PDT]/.test(code) ? ' p' : ''}">${esc(code)}</span>`;
  const openQ = x => (x.sprawdz || []).length;
  const statusBadge = x => openQ(x)
    ? `<span class="badge warn">Sprawdź i powiedz mi (${openQ(x)})</span>`
    : '<span class="badge ok">✓ sprawdzone z aktami</span>';
  const checksHtml = x => `
      ${openQ(x) ? `<h2>Sprawdź i powiedz mi</h2>${x.sprawdz.map(q => `<div class="note ask"><b>?</b> ${esc(q)}</div>`).join('')}` : ''}
      ${(x.sprawdzono || []).length ? `<h2>Sprawdzono w akcie</h2><ul class="checks">${x.sprawdzono.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}`;

  const cardWpis = w => `
    <button class="card" data-open="${esc(w.id)}">
      <div class="signrow">${w.znaki?.length && w.kat === 'znaki' ? signBadge(w.znaki[0]) : ''}
        <div><h3>${esc(w.tytul)}</h3><div class="law">${esc(w.podstawa)}</div></div></div>
      <div class="row">${verdict(w)}${smState(w) === 'nie' ? '' : kwotaTxt(w.kwota)}${pktBadge(w.pkt)}</div>
      ${openQ(w) ? `<div class="row"><span class="badge warn">Sprawdź i powiedz mi (${openQ(w)})</span></div>` : ''}
    </button>`;
  const cardKafel = k => `
    <button class="card" data-kafel="${esc(k.id)}">
      <h3>${esc(k.tytul)}</h3><div class="law">${k.sekcja === 'spb' ? 'Środki przymusu bezpośredniego' : 'Nowy strażnik'}</div>
    </button>`;
  const srcList = ids => `<ul class="src">${ids.map(id => DB.zrodla[id]).filter(Boolean)
    .map(z => z.url ? `<li><a href="${esc(z.url)}" target="_blank" rel="noopener">${esc(z.nazwa)}</a></li>` : `<li>${esc(z.nazwa)}</li>`).join('')}</ul>`;

  /* ---------- widoki ---------- */
  const KATS = { parkowanie: 'Zatrzymanie i postój', znaki: 'Znaki', porzadek: 'Porządek publiczny', piesi: 'Piesi', rowery: 'Rowery i hulajnogi',
    komunikacja: 'Komunikacja (inne)', bezpieczenstwo: 'Bezpieczeństwo osób i mienia', instytucje: 'Instytucje i legitymowanie', osoba: 'Osoba i zdrowie', lesne: 'Las i pole', szczegolne: 'Ustawy szczególne', miejscowe: 'Wrocław – prawo miejscowe' };
  let lastQuery = '';

  const views = {
    szukaj() {
      view.innerHTML = `
        <div class="search"><input id="q" type="search" inputmode="search" autocomplete="off" enterkeyhint="search"
          placeholder="art. 145, B-36, pies bez smyczy…" value="${esc(lastQuery)}" aria-label="Szukaj"></div>
        <div id="res"></div>`;
      const q = $('#q'), res = $('#res');
      const render = () => {
        lastQuery = q.value;
        const r = search(q.value);
        if (!q.value.trim()) {
          res.innerHTML = `<p class="muted small">Wpisz numer artykułu, kod znaku, potoczną nazwę albo całe zdanie.</p>
            <div class="chips">${['parkowanie na chodniku', 'B-36', 'art. 145', 'piwo w parku', 'pies bez smyczy', 'koperta', 'hulajnoga na chodniku', 'B-2']
              .map(s => `<button class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
            <p class="disclaimer">Nieoficjalne narzędzie szkoleniowe. Wynik jest pomocniczy, decyzja należy do Ciebie. Zawsze sprawdź aktualny tekst aktu.</p>`;
          return;
        }
        res.innerHTML = r.length
          ? `<p class="muted small">${r.length} ${r.length === 1 ? 'wynik' : r.length < 5 ? 'wyniki' : 'wyników'}</p><div class="list">${r.map(e => e.type === 'wpis' ? cardWpis(e.item) : cardKafel(e.item)).join('')}</div>`
          : `<div class="empty">Brak wyników dla „${esc(q.value)}”.<br><span class="small">Tego może jeszcze nie być w bazie prototypu.</span></div>`;
      };
      q.addEventListener('input', render);
      res.addEventListener('click', e => { const c = e.target.closest('[data-q]'); if (c) { q.value = c.dataset.q; render(); } });
      render();
      if (!lastQuery && matchMedia('(min-width:700px)').matches) q.focus();
    },

    mandaty() {
      const sel = store.get('kat', 'wszystkie');
      const kats = ['wszystkie', ...Object.keys(KATS)];
      const items = DB.wpisy.filter(w => sel === 'wszystkie' || w.kat === sel);
      view.innerHTML = `<h1>Mandaty</h1>
        <div class="chips">${kats.map(k => `<button class="chip" data-kat="${k}" aria-pressed="${k === sel}">${k === 'wszystkie' ? 'Wszystkie' : KATS[k]}</button>`).join('')}</div>
        <div class="list">${items.map(cardWpis).join('')}</div>
        <p class="disclaimer">Kwoty podajemy tylko wtedy, gdy wynikają z taryfikatora. Gdy brak sztywnej stawki, aplikacja pisze to wprost.</p>`;
    },

    znaki() {
      const items = DB.wpisy.filter(w => w.znaki?.length).sort((a, b) => a.znaki[0].localeCompare(b.znaki[0], 'pl', { numeric: true }));
      view.innerHTML = `<h1>Znaki drogowe</h1>
        <p class="muted small">Znak → wykroczenie → uprawnienie (art. 129b PoRD) → mandat.</p>
        <div class="list">${items.map(w => `
          <button class="card" data-open="${esc(w.id)}"><div class="signrow">${signBadge(w.znaki[0])}
            <div><h3>${esc(w.tytul)}</h3><div class="law">${esc(w.podstawa)}</div></div></div>
            <div class="row">${verdict(w)}${smState(w) === 'nie' ? '' : kwotaTxt(w.kwota)}</div>
            ${openQ(w) ? `<div class="row"><span class="badge warn">Sprawdź i powiedz mi (${openQ(w)})</span></div>` : ''}</button>`).join('')}</div>`;
    },

    nowy() {
      const k = DB.kafle.filter(x => x.sekcja === 'nowy');
      view.innerHTML = `<h1>Nowy strażnik</h1><div class="tiles">${k.map(x => `
        <button class="tile" data-kafel="${esc(x.id)}"><b>${esc(x.tytul)}</b><span>${x.punkty.length} punktów</span></button>`).join('')}
        <button class="tile" data-kafel="spb-katalog"><b>Środki przymusu bezpośredniego</b><span>katalog dla SM</span></button></div>`;
    },

    wiecej() {
      const city = store.get('miasto', 'wroclaw');
      view.innerHTML = `<h1>Więcej</h1>
        <div class="tiles">
          <button class="tile" data-kafel="spb-katalog"><b>Środki przymusu bezpośredniego</b><span>katalog, zasady</span></button>
          <a class="tile" href="#miejscowe" style="text-decoration:none"><b>Prawo miejscowe</b><span>Wrocław</span></a>
          <a class="tile" href="#zmiany" style="text-decoration:none"><b>Zmiany w prawie</b><span>${DB.zmiany.length} pozycje</span></a>
          <a class="tile" href="#zrodla" style="text-decoration:none"><b>Źródła</b><span>tylko oficjalne</span></a>
          <a class="tile" href="#pytania" style="text-decoration:none"><b>Sprawdź i powiedz mi</b><span>${[...DB.wpisy, ...DB.kafle].reduce((n, x) => n + openQ(x), 0)} otwartych pytań</span></a>
        </div>
        <h2>Moje miasto</h2>
        <select id="city"><option value="wroclaw"${city === 'wroclaw' ? ' selected' : ''}>Wrocław</option><option value="brak"${city === 'brak' ? ' selected' : ''}>Tylko przepisy krajowe</option></select>
        <h2>O aplikacji</h2>
        <button class="btn" id="show-start" style="width:100%;background:var(--card);color:var(--ink);border:1px solid var(--line);margin-bottom:8px">Pokaż ekran startowy</button>
        <p class="small">Nieoficjalne narzędzie informacyjne i szkoleniowe grupy aplikantów. Nie jest powiązane ze Strażą Miejską, Strażą Gminną ani organem administracji. Nie jest wiążącą wykładnią prawa. Bez konta, bez reklam, bez śledzenia, bez AI w działaniu. Wyniki pochodzą z zapisanej bazy.</p>
        <p class="small muted">Baza: ${esc(DB.wersja)} z dnia ${esc(DB.dataBazy)} · ${DB.wpisy.length} wpisów, ${DB.kafle.length} kafli</p>`;
      $('#city').addEventListener('change', e => store.set('miasto', e.target.value));
      $('#show-start').onclick = () => { $('#start').hidden = false; };
    },

    miejscowe() {
      const akty = (DB.miejscowe || []).map(m => `
        <div class="answer"><div class="law">${esc(m.akt)}</div><h3 style="margin:4px 0">${esc(m.nazwa)}</h3>
        <p class="small" style="margin:4px 0">${esc(m.stan)}</p>
        <p class="small" style="margin:4px 0"><b>Sankcja i uprawnienie:</b> ${esc(m.sankcja)}</p>
        ${m.sprawdz ? `<div class="note ask"><b>Sprawdź i powiedz mi:</b> ${esc(m.sprawdz.replace(/^Sprawdź i powiedz mi:\s*/, ''))}</div>` : ''}
        ${srcList(m.zrodla)}</div>`).join('');
      const wpisy = DB.wpisy.filter(w => w.kat === 'miejscowe');
      view.innerHTML = `<h1>Prawo miejscowe – Wrocław</h1>
        <p class="small">Mandat za naruszenie przepisów porządkowych z aktów prawa miejscowego: § 2 ust. 1 pkt 21 rozp. MSWiA; za regulamin czystości – pkt 5 (u.c.p.g.); za uchwałę antysmogową – pkt 7 (POŚ).</p>
        <h2>Obowiązki i zakazy</h2><div class="list">${wpisy.map(cardWpis).join('')}</div>
        <h2>Akty</h2><div class="list">${akty}</div>
        <p class="small"><a href="https://edzienniki.duw.pl/" target="_blank" rel="noopener">Dziennik Urzędowy Województwa Dolnośląskiego</a></p>`;
    },

    zmiany() {
      view.innerHTML = `<h1>Zmiany w prawie</h1><div class="list">${DB.zmiany.map(z => `
        <div class="answer"><div class="law">${esc(z.data)}</div><h3 style="margin:4px 0">${esc(z.tytul)}</h3>
        <p class="small" style="margin:4px 0 6px">${esc(z.opis)}</p>${srcList(z.zrodla)}</div>`).join('')}</div>`;
    },

    pytania() {
      const items = [...DB.wpisy, ...DB.kafle].filter(openQ);
      view.innerHTML = `<h1>Sprawdź i powiedz mi</h1>
        <p class="small muted">Tych rzeczy nie dało się jednoznacznie potwierdzić w tekście aktu. Odpowiedz, a poprawię bazę.</p>
        <div class="list">${items.map(x => `<button class="card" ${x.sekcja ? `data-kafel="${esc(x.id)}"` : `data-open="${esc(x.id)}"`}>
          <h3>${esc(x.tytul)}</h3>${x.sprawdz.map(q => `<p class="small" style="margin:6px 0 0">? ${esc(q)}</p>`).join('')}</button>`).join('')}</div>`;
    },

    zrodla() {
      view.innerHTML = `<h1>Źródła</h1><p class="small muted">${esc(DB.zasada)}</p>${srcList(Object.keys(DB.zrodla))}`;
    }
  };

  /* ---------- szczegóły ---------- */
  const sheet = $('#sheet'), sheetC = $('#sheet-content');
  function openSheet(html) { sheetC.innerHTML = html; sheet.hidden = false; sheet.querySelector('.sheet-body').scrollTop = 0; }
  function closeSheet() { sheet.hidden = true; }
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  function showWpis(id) {
    const w = DB.wpisy.find(x => x.id === id); if (!w) return;
    const k = w.kwota || {};
    const st = smState(w), big = st === 'nie' ? 'Nie' : st === 'zalezy' ? 'Zależy' : k.typ === 'brak' ? 'Brak stawki' : k.typ === 'widelki' ? `${k.min}–${k.max} zł` : `${k.min} zł`;
    openSheet(`
      ${w.znaki?.length ? `<div class="signrow" style="margin-bottom:8px">${w.znaki.map(signBadge).join('')}</div>` : ''}
      <h2 id="sheet-title" style="margin-top:0">${esc(w.tytul)}</h2>
      <div class="answer">
        <div class="law">Czy mogę ukarać?</div>
        <div class="big">${esc(big)}</div>
        ${verdict(w)}
        ${w.sm.wyjatek ? `<p class="small" style="margin:8px 0 0"><b>Kiedy tak:</b> ${esc(w.sm.wyjatek)}</p>` : ''}
      </div>
      <dl class="kv">
        <dt>Podstawa</dt><dd>${esc(w.podstawa)}</dd>
        <dt>Uprawnienie SM</dt><dd>${esc(w.sm.podstawa)}</dd>
        <dt>Kwota</dt><dd>${kwotaTxt(k)}${k.lp ? ` <span class="law">(${esc(k.lp)})</span>` : ''}</dd>
        ${w.pkt ? `<dt>Punkty karne</dt><dd><b>${pktTxt(w.pkt)}</b>${w.pkt.kod ? ` <span class="law">(kod ${esc(w.pkt.kod)})</span>` : ''}</dd>` : ''}
      </dl>
      ${w.pkt?.brak ? `<div class="note"><b>Punkty:</b> ${esc(w.pkt.brak)}</div>` : ''}
      ${w.pkt?.uwaga ? `<div class="note"><b>Punkty:</b> ${esc(w.pkt.uwaga)}</div>` : ''}
      ${w.pkt && !w.pkt.brak ? `<p class="small muted" style="margin:6px 0 0">Punkty tylko dla kierującego pojazdem silnikowym, motorowerem lub tramwajem (rozp. MSWiA 2026 poz. 724).</p>` : ''}
      ${k.recydywa ? `<p class="small" style="margin:8px 0 0"><b>Recydywa:</b> ${k.recydywa} zł (art. 38 § 2 k.w., wg taryfikatora)</p>` : ''}
      ${k.uwaga ? `<div class="note"><b>Uwaga:</b> ${esc(k.uwaga)}</div>` : ''}
      ${w.praktyka ? `<div class="note prak"><b>Praktyka:</b> ${esc(w.praktyka)}</div>` : ''}
      <h2>Na czym polega</h2><p style="margin:0">${esc(w.opis)}</p>
      ${w.warunki?.length ? `<h2>Warunki i wskazówki</h2><ul class="points">${w.warunki.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${checksHtml(w)}
      <h2>Źródła</h2>${srcList(w.zrodla)}
      <div class="meta">${statusBadge(w)} · sprawdzono: ${esc(DB.dataBazy)} · Zawsze sprawdź aktualny tekst aktu. Decyzja należy do Ciebie.</div>`);
  }
  function showKafel(id) {
    const k = DB.kafle.find(x => x.id === id); if (!k) return;
    openSheet(`<h2 id="sheet-title" style="margin-top:0">${esc(k.tytul)}</h2>
      <div class="answer"><ul class="points">${k.punkty.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
      ${k.uwaga ? `<div class="note"><b>Uwaga:</b> ${esc(k.uwaga)}</div>` : ''}
      ${checksHtml(k)}
      <h2>Źródła</h2>${srcList(k.zrodla)}
      <div class="meta">${statusBadge(k)} · sprawdzono: ${esc(DB.dataBazy)}</div>`);
  }
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (o) return showWpis(o.dataset.open);
    const t = e.target.closest('[data-kafel]'); if (t) return showKafel(t.dataset.kafel);
    const k = e.target.closest('[data-kat]'); if (k) { store.set('kat', k.dataset.kat); views.mandaty(); }
  });

  /* ---------- routing ---------- */
  const TAB_OF = { miejscowe: 'wiecej', zmiany: 'wiecej', zrodla: 'wiecej', pytania: 'wiecej' };
  function route() {
    const name = (location.hash || '#szukaj').slice(1);
    const fn = views[name] || views.szukaj;
    closeSheet();
    fn();
    const tab = TAB_OF[name] || (views[name] ? name : 'szukaj');
    document.querySelectorAll('.tabs a').forEach(a => a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    window.scrollTo(0, 0);
  }

  /* ---------- start ---------- */
  async function init() {
    try {
      const r = await fetch('data.json', { cache: 'no-cache' });
      DB = await r.json();
    } catch (err) {
      view.innerHTML = '<div class="empty">Nie udało się wczytać bazy. Otwórz aplikację raz z dostępem do sieci.</div>';
      return;
    }
    $('#baza-info').textContent = `baza ${DB.dataBazy} · ${DB.wpisy.length} wpisów`;
    buildIndex();
    addEventListener('hashchange', route);
    route();
    $('#start-ok').onclick = () => { $('#start').hidden = true; store.set('start', true); $('#q')?.focus?.(); };
    if (!store.get('start', false)) $('#start').hidden = false;
    try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch { /* sandbox */ }
  }
  init();
})();
