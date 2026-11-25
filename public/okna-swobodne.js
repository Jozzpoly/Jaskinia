// Okna swobodne (Opus Code, 21 XI 2026): okno świata da się przesunąć za pasek, zmienić mu rozmiar z rogu albo
// krawędzi, położyć obok drugiego i przykleić do krawędzi ekranu (połowa, całość); kliknięte idzie na wierzch, dwuklik
// na pasku daje cały ekran i powrót, a układ wraca po przeładowaniu. Jozz, 21 XI 17:28, o nowej Jaskini: „nie moge ani
// przesuwać ani nic, w poruwnaniu do starej jaskini ta jest tragiczna w tej kwesti”.
// Warstwa stoi obok strony gospodarza i nie zna jej wnętrza: patrzy tylko na sekcje .okno w #okna, które strona tworzy,
// i nadaje im położenie. Telefon (do 40 rem) zostaje bez zmian: tam okno zajmuje cały ekran.
// TYMCZASOWE (wpis w TYMCZASOWE.md): układ pamięta ta przeglądarka; docelowo układ jako rzecz w Miejscu, żywo między
// urządzeniami i z cofaniem gestu. Odległość przyklejania i rozmiar uchwytów idą ze zmiennych CSS, nie z tego pliku.
(() => {
  const KLUCZ = 'jaskinia:okna:uklad:v1';
  const SZEROKI = matchMedia('(min-width: 40.01rem)');
  const MIN_W = 280;
  const MIN_H = 160;
  const zmienna = (nazwa, domyslna) => {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(nazwa));
    return Number.isFinite(v) ? v : domyslna;
  };
  let uklad = {};
  try { uklad = JSON.parse(localStorage.getItem(KLUCZ) || '{}') || {}; } catch { uklad = {}; }
  const zapisz = () => { try { localStorage.setItem(KLUCZ, JSON.stringify(uklad)); } catch { /* bez pamięci przeglądarki układ żyje do przeładowania */ } };

  const okna = () => [...document.querySelectorAll('#okna > .okno')];
  // szerokość bez paska przewijania strony: okno przyklejone do prawej nie chowa pod nim swojego „×” (widać to było na zrzucie)
  const szer = () => document.documentElement.clientWidth || window.innerWidth;
  // pasek u góry strony i dok u dołu zostają widoczne: okno nie wchodzi na nie
  const gora = () => { const g = document.querySelector('.gora'); return g ? Math.max(0, g.getBoundingClientRect().bottom) : 0; };
  const dol = () => { const d = document.getElementById('dok'); return d && d.offsetHeight ? d.getBoundingClientRect().top : innerHeight; };
  const prostokat = (s) => { const r = s.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  // okno zawsze da się chwycić: pasek zostaje na ekranie, choćby częściowo
  const wGranicach = (g) => {
    const g0 = gora(), d0 = dol();
    const w = Math.max(MIN_W, Math.min(g.w, szer()));
    const h = Math.max(MIN_H, Math.min(g.h, d0 - g0));
    return { x: Math.round(Math.min(Math.max(g.x, 80 - w), szer() - 80)), y: Math.round(Math.min(Math.max(g.y, g0), d0 - 40)), w: Math.round(w), h: Math.round(h) };
  };
  const ustaw = (s, g) => {
    Object.assign(s.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px', right: 'auto', bottom: 'auto' });
    s.classList.add('okno-swobodne');
  };
  const zwolnij = (s) => {
    for (const p of ['left', 'top', 'width', 'height', 'right', 'bottom', 'z-index']) s.style.removeProperty(p);
    s.classList.remove('okno-swobodne');
  };
  // klucz okna: jego adres (i rola w parze A/B), więc to samo okno otwarte jutro wraca w to samo miejsce
  const kluczOkna = (s) => {
    const f = s.querySelector('iframe');
    const rola = (s.querySelector('.pasek .rola') || {}).textContent || '';
    return (rola ? rola + ' ' : '') + (f ? f.getAttribute('src') : s.getAttribute('aria-label') || 'okno');
  };
  const zapamietaj = (s) => {
    uklad[kluczOkna(s)] = { ...prostokat(s), ...(s.dataset.przedPelnym ? { przed: JSON.parse(s.dataset.przedPelnym) } : {}) };
    zapisz();
  };

  // na wierzch: ostatnio ruszane ma najwyższe miejsce, ale wszystkie zostają pod dokiem (z-index 30)
  let kolejnosc = [];
  const naWierzch = (s) => {
    kolejnosc = kolejnosc.filter((x) => x !== s && x.isConnected);
    kolejnosc.push(s);
    kolejnosc.forEach((x, i) => { x.style.zIndex = String(Math.max(21, 29 - (kolejnosc.length - 1 - i))); });
  };

  // przyklejanie: wskaźnik przy lewej albo prawej krawędzi kładzie okno na połowę, przy górnej na cały ekran
  const strefa = (x, y) => {
    const p = zmienna('--okna-przyklejanie', 12), g0 = gora(), d0 = dol(), W = szer(), pol = Math.round(W / 2);
    if (y <= g0 + p) return { x: 0, y: g0, w: W, h: d0 - g0 };
    if (x <= p) return { x: 0, y: g0, w: pol, h: d0 - g0 };
    if (x >= W - p) return { x: pol, y: g0, w: W - pol, h: d0 - g0 };
    return null;
  };
  let zarys = null;
  const pokazZarys = (g) => {
    if (!g) { if (zarys) zarys.hidden = true; return; }
    if (!zarys) { zarys = document.createElement('div'); zarys.className = 'okna-zarys'; document.body.append(zarys); }
    Object.assign(zarys.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' });
    zarys.hidden = false;
  };

  // jeden gest: przesunięcie (tryb „ruch”) albo zmiana rozmiaru od krawędzi (e, s, w, se, sw)
  function gest(s, e, tryb) {
    if (!SZEROKI.matches || e.button !== 0) return;
    e.preventDefault();
    const start = prostokat(s), x0 = e.clientX, y0 = e.clientY;
    let przyklej = null;
    let ruszyl = false; // zwykły klik i pierwszy klik dwukliku nie są gestem: nic nie zapisują i nie kasują „przed pełnym”
    naWierzch(s);
    document.body.classList.add('okna-ruch'); // ramki światów nie łapią wskaźnika w trakcie gestu
    const ruch = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!ruszyl) {
        if (Math.hypot(dx, dy) < 3) return;
        ruszyl = true;
        delete s.dataset.przedPelnym;
      }
      const g = { ...start };
      if (tryb === 'ruch') { g.x += dx; g.y += dy; } else {
        if (tryb.includes('e')) g.w = start.w + dx;
        if (tryb.includes('s')) g.h = start.h + dy;
        if (tryb.includes('w')) { g.w = Math.max(MIN_W, start.w - dx); g.x = start.x + start.w - g.w; }
      }
      ustaw(s, wGranicach(g));
      if (tryb === 'ruch') { przyklej = strefa(ev.clientX, ev.clientY); pokazZarys(przyklej); }
    };
    const koniec = () => {
      removeEventListener('pointermove', ruch);
      removeEventListener('pointerup', koniec);
      removeEventListener('pointercancel', koniec);
      document.body.classList.remove('okna-ruch');
      pokazZarys(null);
      if (!ruszyl) return;
      if (przyklej) ustaw(s, przyklej);
      zapamietaj(s);
    };
    addEventListener('pointermove', ruch);
    addEventListener('pointerup', koniec);
    addEventListener('pointercancel', koniec);
  }

  // dwuklik na pasku: okno, które nie zajmuje całego ekranu, rozciąga się na cały; drugi dwuklik wraca dokładnie tam,
  // gdzie okno było tuż przed nim (także na przyklejoną połowę)
  function pelny(s) {
    if (!SZEROKI.matches) return;
    const r = prostokat(s), g0 = gora(), caly = { x: 0, y: g0, w: szer(), h: dol() - g0 };
    const jestPelne = ['x', 'y', 'w', 'h'].every((k) => Math.abs(r[k] - caly[k]) <= 2);
    if (jestPelne && s.dataset.przedPelnym) { ustaw(s, wGranicach(JSON.parse(s.dataset.przedPelnym))); delete s.dataset.przedPelnym; }
    else { s.dataset.przedPelnym = JSON.stringify(r); ustaw(s, caly); }
    naWierzch(s);
    zapamietaj(s);
  }

  const naPasku = (e) => !e.target.closest('button, a, input, select, textarea, label');
  function przyjmij(s) {
    if (s.dataset.swobodne) return;
    s.dataset.swobodne = '1';
    const pasek = s.querySelector('.pasek');
    if (pasek) {
      pasek.addEventListener('pointerdown', (e) => { if (naPasku(e)) gest(s, e, 'ruch'); });
      pasek.addEventListener('dblclick', (e) => { if (naPasku(e)) pelny(s); });
    }
    for (const k of ['e', 's', 'w', 'se', 'sw']) {
      const u = document.createElement('div');
      u.className = 'okno-uchwyt';
      u.dataset.k = k;
      u.setAttribute('aria-hidden', 'true');
      u.addEventListener('pointerdown', (e) => gest(s, e, k));
      s.append(u);
    }
    // chwyt albo klik w okno zabiera fokus ramce INNEGO okna (inaczej co pół sekundy wracałoby ono na wierzch, bo to ono
    // ma fokus), a własna ramka fokus zachowuje, żeby gra nie traciła klawiatury przy przesuwaniu swojego okna
    // (druga linia Fable na 94, 25 XI; poprawka jego, sprawdzona przez niego na scaleniu z pniem)
    s.addEventListener('pointerdown', () => { const a = document.activeElement; if (a && a.tagName === 'IFRAME' && a.closest('#okna > .okno') !== s) a.blur(); naWierzch(s); }, true);
    const pamiec = uklad[kluczOkna(s)];
    if (pamiec && SZEROKI.matches) {
      ustaw(s, wGranicach(pamiec));
      if (pamiec.przed) s.dataset.przedPelnym = JSON.stringify(pamiec.przed);
    } else if (SZEROKI.matches && !s.querySelector('.pasek .rola')) {
      // nowe okno bez pamięci staje kaskadą, przesunięte względem widocznych, żeby nie przykryło ich w całości;
      // parę A/B układa strona (pas porównania pod nią), więc jej nie ruszamy
      const inne = okna().filter((x) => x !== s && !x.hidden).length;
      // wysokość przycięta do miejsca nad dokiem, inaczej róg do zmiany rozmiaru chowa się pod nim
      if (inne) { const r = prostokat(s); const y = r.y + 36 * inne; ustaw(s, wGranicach({ ...r, x: r.x - 36 * inne, y, h: Math.min(r.h, dol() - y) })); }
    }
    naWierzch(s);
  }

  // klik w świecie nie dochodzi do strony (ramka zabiera zdarzenie): okno z fokusem idzie na wierzch
  const ramkaNaWierzch = () => {
    const a = document.activeElement;
    const s = a && a.tagName === 'IFRAME' ? a.closest('#okna > .okno') : null;
    if (s && kolejnosc[kolejnosc.length - 1] !== s) naWierzch(s);
  };
  addEventListener('blur', () => setTimeout(ramkaNaWierzch, 0));
  setInterval(() => { if (okna().length > 1) ramkaNaWierzch(); }, 500);

  const start = () => {
    const kontener = document.getElementById('okna');
    if (!kontener) return;
    okna().forEach(przyjmij);
    new MutationObserver(() => okna().forEach(przyjmij)).observe(kontener, { childList: true });
  };
  // telefon: bez położeń (okno na cały ekran, jak dotąd); powrót do szerokiego ekranu oddaje zapamiętany układ
  SZEROKI.addEventListener('change', () => {
    for (const s of okna()) {
      const pamiec = uklad[kluczOkna(s)];
      if (!SZEROKI.matches) zwolnij(s); else if (pamiec) ustaw(s, wGranicach(pamiec));
    }
  });
  addEventListener('resize', () => { if (SZEROKI.matches) for (const s of okna()) if (s.classList.contains('okno-swobodne')) ustaw(s, wGranicach(prostokat(s))); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
