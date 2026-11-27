// Warstwa okien światów (Opus Code). Powstała 21 XI 2026 jako okna-swobodne.js, a 27 XI wydzielona do modułu bez zmiany
// zachowania (tor 1 z fali 3 Argona): tę samą warstwę ma zamontować i strona gospodarza, i płótno Startu.
// Okno świata da się przesunąć za pasek, zmienić mu rozmiar z rogu albo krawędzi, położyć obok drugiego i przykleić do
// krawędzi ekranu (połowa, całość); kliknięte idzie na wierzch, dwuklik na pasku daje cały ekran i powrót, a układ wraca
// po przeładowaniu. Jozz, 21 XI 17:28, o nowej Jaskini: „nie moge ani przesuwać ani nic, w poruwnaniu do starej jaskini
// ta jest tragiczna w tej kwesti”.
// Moduł nie zna ani strony gospodarza, ani Startu, ani drzwi. Dostaje kontener, do którego strona kładzie sekcje .okno
// (z paskiem .pasek i ramką iframe), i adapter pamięci układu (zasada 8: jawny adapter). Okna tworzy na razie strona;
// tworzenie okien (otworz, zamknij, schowaj, pokaz) przyjdzie do modułu w następnym kroku toru 1.
// Telefon (do 40 rem) zostaje bez zmian: tam okno zajmuje cały ekran.
// TYMCZASOWE (wpis w TYMCZASOWE.md): strona gospodarza pamięta układ w tej przeglądarce; docelowo układ jako rzecz
// w Miejscu (okno/1), żywo między urządzeniami i z cofaniem gestu. Odległość przyklejania i rozmiar uchwytów idą ze
// zmiennych CSS (okna-swobodne.css), nie z tego pliku.

export const KLUCZ_PRZEGLADARKI = 'jaskinia:okna:uklad:v1';
export const MIN_W = 280;
export const MIN_H = 160;
// tyle paska zostaje na ekranie, gdy okno wysunięto za krawędź: zawsze da się je chwycić
export const PASEK_NA_EKRANIE = 80;

// --- geometria bez przeglądarki (sprawdziany w Node: worker/okna-swiatow.test.mjs) -------------------------------------

// Prostokąt okna w granicach ekranu. `e` to { szer, gora, dol }: szerokość bez paska przewijania, dolna krawędź paska
// u góry strony i górna krawędź doku. Okno nie wchodzi na pasek ani na dok i nie jest mniejsze niż MIN_W na MIN_H.
// granice 'pasek' (tak było od 21 XI): okno wolno wysunąć za lewą i prawą krawędź, byle zostało PASEK_NA_EKRANIE pikseli
// paska; granice 'calosc' (czerwcowy pulpit z 2 VI): okno zostaje całe na ekranie. Którą zasadę wybrać, rozstrzyga jego
// ręka (Argon, fala 3, pułapka 3), więc moduł umie obie.
export function wGranicach(g, e, granice = 'pasek') {
  const w = Math.max(MIN_W, Math.min(g.w, e.szer));
  const h = Math.max(MIN_H, Math.min(g.h, e.dol - e.gora));
  const x = granice === 'calosc'
    ? Math.min(Math.max(g.x, 0), Math.max(0, e.szer - w))
    : Math.min(Math.max(g.x, PASEK_NA_EKRANIE - w), e.szer - PASEK_NA_EKRANIE);
  const y = granice === 'calosc'
    ? Math.min(Math.max(g.y, e.gora), Math.max(e.gora, e.dol - h))
    : Math.min(Math.max(g.y, e.gora), e.dol - 40);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

// Prostokąt przyklejenia: 'lewo' i 'prawo' to połowy ekranu między paskiem a dokiem, 'calosc' to cały ten obszar.
export function prostokatPrzyklejenia(strona, e) {
  const pol = Math.round(e.szer / 2), h = e.dol - e.gora;
  if (strona === 'lewo') return { x: 0, y: e.gora, w: pol, h };
  if (strona === 'prawo') return { x: pol, y: e.gora, w: e.szer - pol, h };
  if (strona === 'calosc') return { x: 0, y: e.gora, w: e.szer, h };
  return null;
}

// Gdzie przykleić okno, które ręka niesie wskaźnikiem w (x, y): przy górnej krawędzi na cały ekran, przy lewej albo
// prawej na połowę; `prog` to odległość od krawędzi (zmienna CSS --okna-przyklejanie).
export function strefaPrzyklejania(x, y, e, prog) {
  if (y <= e.gora + prog) return prostokatPrzyklejenia('calosc', e);
  if (x <= prog) return prostokatPrzyklejenia('lewo', e);
  if (x >= e.szer - prog) return prostokatPrzyklejenia('prawo', e);
  return null;
}

// Czy prostokąt zajmuje cały obszar okien (z tolerancją zaokrągleń).
// Ile okien leży już na stole przed nowym oknem bez pamięci: o tyle kroków kaskady staje ono niżej i w lewo, żeby nie
// przykryło ich w całości. Liczą się tylko okna widoczne i już przyjęte przez warstwę. Po przeładowaniu strona kładzie kilka
// okien naraz, a jeden przebieg przyjmowania liczył każde z pozostałymi z tej samej partii: wszystkie stawały w tym samym
// miejscu, jedno dokładnie na drugim (na pniu od 21 XI; druga linia Fable na zgłoszeniu 100, 27 XI 2026).
export const ileOkienPrzedNim = (okna, s) => okna.filter((x) => x !== s && !x.hidden && !!(x.dataset && x.dataset.swobodne)).length;

export const jestCaly = (r, e) => {
  const c = prostokatPrzyklejenia('calosc', e);
  return ['x', 'y', 'w', 'h'].every((k) => Math.abs(r[k] - c[k]) <= 2);
};

// Pamięć układu w tej przeglądarce: jeden wpis z mapą „klucz okna -> prostokąt”. Ten sam wpis i ten sam format co
// okna-swobodne.js od 21 XI, więc układy zapisane przed wydzieleniem modułu wracają. Bez pamięci przeglądarki (tryb
// prywatny, zablokowane dane) układ żyje do przeładowania.
export function pamiecPrzegladarki(klucz = KLUCZ_PRZEGLADARKI, magazyn = null) {
  // sam dostęp do localStorage potrafi rzucić wyjątek (zablokowane dane strony), więc dopiero wewnątrz try
  const m = () => magazyn || globalThis.localStorage;
  let uklad = {};
  try { uklad = JSON.parse(m().getItem(klucz) || '{}') || {}; } catch { uklad = {}; }
  return {
    czytaj: (k) => (Object.prototype.hasOwnProperty.call(uklad, k) ? uklad[k] : null),
    zapisz: (k, wpis) => {
      uklad[k] = wpis;
      try { m().setItem(klucz, JSON.stringify(uklad)); } catch { /* bez pamięci przeglądarki układ żyje do przeładowania */ }
    },
  };
}

// --- warstwa w przeglądarce ------------------------------------------------------------------------------------------

// Montuje warstwę nad kontenerem. Opcje (wszystkie mają wartości strony gospodarza):
//   pamiec  - adapter { czytaj(klucz), zapisz(klucz, wpis) }; domyślnie pamięć tej przeglądarki;
//   gora    - funkcja: dolna krawędź paska u góry strony (okno na niego nie wchodzi);
//   dol     - funkcja: górna krawędź doku u dołu strony;
//   szeroki - MediaQueryList, przy którym okna są swobodne (węższy ekran: okno na cały ekran);
//   granice - 'pasek' albo 'calosc' (wGranicach wyżej).
// Zwraca stół: uklad(), ustawUklad(lista), naWierzch(okno), pelny(okno), przyklej(okno, strona), naZmiane(fn),
// odmontuj(). Okno to sekcja .okno albo jej klucz (kluczOkna).
export function zamontujOkna(kontener, opcje = {}) {
  const pamiec = opcje.pamiec || pamiecPrzegladarki();
  const SZEROKI = opcje.szeroki || matchMedia('(min-width: 40.01rem)');
  const granice = opcje.granice === 'calosc' ? 'calosc' : 'pasek';
  const zmienna = (nazwa, domyslna) => {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(nazwa));
    return Number.isFinite(v) ? v : domyslna;
  };
  const okna = () => [...kontener.children].filter((x) => x.classList.contains('okno'));
  // sekcja okna tej warstwy, w której leży element (ramka, guzik); null dla wszystkiego poza warstwą
  const oknoZ = (el) => { const s = el && el.closest ? el.closest('.okno') : null; return s && s.parentElement === kontener ? s : null; };
  // szerokość bez paska przewijania strony: okno przyklejone do prawej nie chowa pod nim swojego „×” (widać to było na zrzucie)
  const szer = () => document.documentElement.clientWidth || window.innerWidth;
  // pasek u góry strony i dok u dołu zostają widoczne: okno nie wchodzi na nie
  const gora = opcje.gora || (() => { const g = document.querySelector('.gora'); return g ? Math.max(0, g.getBoundingClientRect().bottom) : 0; });
  const dol = opcje.dol || (() => { const d = document.getElementById('dok'); return d && d.offsetHeight ? d.getBoundingClientRect().top : innerHeight; });
  const ekran = () => ({ szer: szer(), gora: gora(), dol: dol() });
  const prostokat = (s) => { const r = s.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  // okno zawsze da się chwycić: pasek zostaje na ekranie, choćby częściowo
  const wGranicachEkranu = (g) => wGranicach(g, ekran(), granice);
  const ustaw = (s, g) => {
    Object.assign(s.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px', right: 'auto', bottom: 'auto' });
    s.classList.add('okno-swobodne');
  };
  const zwolnij = (s) => {
    for (const p of ['left', 'top', 'width', 'height', 'right', 'bottom', 'z-index']) s.style.removeProperty(p);
    s.classList.remove('okno-swobodne');
  };
  // klucz okna: jego adres (i rola w parze A/B), więc to samo okno otwarte jutro wraca w to samo miejsce
  const adresOkna = (s) => { const f = s.querySelector('iframe'); return f ? f.getAttribute('src') : s.getAttribute('aria-label') || 'okno'; };
  const kluczOkna = (s) => {
    const rola = (s.querySelector('.pasek .rola') || {}).textContent || '';
    return (rola ? rola + ' ' : '') + adresOkna(s);
  };
  const okno = (x) => (typeof x === 'string' ? okna().find((s) => kluczOkna(s) === x) || null : x);

  // kto słucha zmian układu (po upuszczeniu, nie w trakcie ciągnięcia): strona, która zapisuje układ gdzie indziej
  const sluchacze = new Set();
  const powiedz = (s, co) => {
    if (!sluchacze.size) return;
    const zmiana = { okno: s, klucz: kluczOkna(s), co, prostokat: prostokat(s) };
    for (const fn of sluchacze) { try { fn(zmiana); } catch { /* słuchacz nie zatrzymuje warstwy */ } }
  };

  // para A/B: oba okna układa strona (obok siebie, pas porównania pod nimi), więc warstwa ich nie rusza i nie daje ich
  // przesuwać. Okno przesunięte ręką przed „A/B” wchodzi w parę bez swojego położenia, a po rozstaniu pary wraca tam,
  // gdzie je zostawiono (druga linia Opusa Code na 92, 25 XI: okno A przesunięte przed „A/B” nachodziło na B i na pas).
  const wParze = (s) => s.classList.contains('ab-a') || s.classList.contains('ab-b');
  const para = (s) => {
    if (wParze(s)) { s.dataset.wParze = '1'; if (s.classList.contains('okno-swobodne')) zwolnij(s); return; }
    if (!s.dataset.wParze) return;
    delete s.dataset.wParze;
    const zapamietane = pamiec.czytaj(kluczOkna(s)) || pamiec.czytaj(adresOkna(s));
    if (zapamietane && SZEROKI.matches) ustaw(s, wGranicachEkranu(zapamietane));
  };
  const zapamietaj = (s, co) => {
    pamiec.zapisz(kluczOkna(s), { ...prostokat(s), ...(s.dataset.przedPelnym ? { przed: JSON.parse(s.dataset.przedPelnym) } : {}) });
    powiedz(s, co);
  };

  // na wierzch: ostatnio ruszane ma najwyższe miejsce, ale wszystkie zostają pod dokiem (z-index 30)
  let kolejnosc = [];
  const naWierzch = (s) => {
    kolejnosc = kolejnosc.filter((x) => x !== s && x.isConnected);
    kolejnosc.push(s);
    kolejnosc.forEach((x, i) => { x.style.zIndex = String(Math.max(21, 29 - (kolejnosc.length - 1 - i))); });
  };

  // przyklejanie: wskaźnik przy lewej albo prawej krawędzi kładzie okno na połowę, przy górnej na cały ekran
  const strefa = (x, y) => strefaPrzyklejania(x, y, ekran(), zmienna('--okna-przyklejanie', 12));
  let zarys = null;
  const pokazZarys = (g) => {
    if (!g) { if (zarys) zarys.hidden = true; return; }
    if (!zarys) { zarys = document.createElement('div'); zarys.className = 'okna-zarys'; document.body.append(zarys); }
    Object.assign(zarys.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' });
    zarys.hidden = false;
  };

  // jeden gest: przesunięcie (tryb „ruch”) albo zmiana rozmiaru od krawędzi (e, s, w, se, sw)
  function gest(s, e, tryb) {
    if (!SZEROKI.matches || e.button !== 0 || wParze(s)) return;
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
      ustaw(s, wGranicachEkranu(g));
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
      zapamietaj(s, tryb !== 'ruch' ? 'rozmiar' : przyklej ? 'przyklej' : 'przesun');
    };
    addEventListener('pointermove', ruch);
    addEventListener('pointerup', koniec);
    addEventListener('pointercancel', koniec);
  }

  // dwuklik na pasku: okno, które nie zajmuje całego ekranu, rozciąga się na cały; drugi dwuklik wraca dokładnie tam,
  // gdzie okno było tuż przed nim (także na przyklejoną połowę)
  function pelny(s) {
    if (!SZEROKI.matches || wParze(s)) return;
    const r = prostokat(s), e = ekran();
    if (jestCaly(r, e) && s.dataset.przedPelnym) { ustaw(s, wGranicachEkranu(JSON.parse(s.dataset.przedPelnym))); delete s.dataset.przedPelnym; }
    else { s.dataset.przedPelnym = JSON.stringify(r); ustaw(s, prostokatPrzyklejenia('calosc', e)); }
    naWierzch(s);
    zapamietaj(s, 'pelny');
  }

  // przyklejenie bez ciągnięcia (guzik, klawisz, przyrząd): to samo, co upuszczenie przy krawędzi ekranu
  function przyklej(s, strona) {
    const g = prostokatPrzyklejenia(strona, ekran());
    if (!g || !SZEROKI.matches || wParze(s)) return;
    delete s.dataset.przedPelnym;
    ustaw(s, g);
    naWierzch(s);
    zapamietaj(s, 'przyklej');
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
    s.addEventListener('pointerdown', () => { const a = document.activeElement; if (a && a.tagName === 'IFRAME' && oknoZ(a) !== s) a.blur(); naWierzch(s); }, true);
    const zapamietane = pamiec.czytaj(kluczOkna(s));
    if (wParze(s)) {
      para(s);
    } else if (zapamietane && SZEROKI.matches) {
      ustaw(s, wGranicachEkranu(zapamietane));
      if (zapamietane.przed) s.dataset.przedPelnym = JSON.stringify(zapamietane.przed);
    } else if (SZEROKI.matches && !s.querySelector('.pasek .rola')) {
      // nowe okno bez pamięci staje kaskadą, przesunięte względem widocznych, żeby nie przykryło ich w całości;
      // parę A/B układa strona (pas porównania pod nią), więc jej nie ruszamy
      const inne = ileOkienPrzedNim(okna(), s);
      // wysokość przycięta do miejsca nad dokiem, inaczej róg do zmiany rozmiaru chowa się pod nim
      if (inne) { const r = prostokat(s); const y = r.y + 36 * inne; ustaw(s, wGranicachEkranu({ ...r, x: r.x - 36 * inne, y, h: Math.min(r.h, dol() - y) })); }
    }
    naWierzch(s);
  }

  // klik w świecie nie dochodzi do strony (ramka zabiera zdarzenie): okno z fokusem idzie na wierzch
  const ramkaNaWierzch = () => {
    const a = document.activeElement;
    const s = a && a.tagName === 'IFRAME' ? oknoZ(a) : null;
    if (s && kolejnosc[kolejnosc.length - 1] !== s) naWierzch(s);
  };
  const poBlur = () => setTimeout(ramkaNaWierzch, 0);
  addEventListener('blur', poBlur);
  const zegar = setInterval(() => { if (okna().length > 1) ramkaNaWierzch(); }, 500);

  okna().forEach(przyjmij);
  const noweOkna = new MutationObserver(() => okna().forEach(przyjmij));
  noweOkna.observe(kontener, { childList: true });
  // wejście w parę i wyjście z niej strona zaznacza klasą okna (ab-a, ab-b)
  const pary = new MutationObserver((zmiany) => { for (const z of zmiany) if (z.target.parentElement === kontener && z.target.classList.contains('okno')) para(z.target); });
  pary.observe(kontener, { attributes: true, attributeFilter: ['class'], subtree: true });
  // telefon: bez położeń (okno na cały ekran, jak dotąd); powrót do szerokiego ekranu oddaje zapamiętany układ.
  // Przejście liczy jedna funkcja z obu zdarzeń (change zapytania o ekran i resize), porównując stan z poprzednim:
  // Chromium potrafi nie wysłać change, gdy ktoś przeczytał matches w obsłudze resize, zanim przeliczył zapytania
  // (przyrząd okna-swobodne-proba.mjs, próba O7: na pniu z okna-swobodne.js padała raz na trzy przebiegi, po wydzieleniu
  // modułu za każdym razem; 27 XI 2026).
  let byloSzeroko = SZEROKI.matches;
  const sprawdzEkran = () => {
    const szeroko = SZEROKI.matches;
    if (szeroko !== byloSzeroko) {
      byloSzeroko = szeroko;
      for (const s of okna()) {
        const zapamietane = pamiec.czytaj(kluczOkna(s));
        if (!szeroko) zwolnij(s); else if (zapamietane && !wParze(s)) ustaw(s, wGranicachEkranu(zapamietane));
      }
      return;
    }
    if (szeroko) for (const s of okna()) if (s.classList.contains('okno-swobodne')) ustaw(s, wGranicachEkranu(prostokat(s)));
  };
  SZEROKI.addEventListener('change', sprawdzEkran);
  addEventListener('resize', sprawdzEkran);

  return {
    // układ widocznych okien tej warstwy: klucz, prostokąt i to, czy okno jest swobodne (na telefonie nie jest)
    uklad: () => okna().filter((s) => !s.hidden).map((s) => ({ klucz: kluczOkna(s), ...prostokat(s), swobodne: s.classList.contains('okno-swobodne') })),
    // położenia z innego źródła (zapisany układ, drugie urządzenie): okna, których klucz zna lista, stają tam i to się
    // zapamiętuje; reszta zostaje, gdzie była
    ustawUklad: (lista) => {
      if (!SZEROKI.matches || !Array.isArray(lista)) return;
      for (const g of lista) {
        const s = g && okno(g.klucz);
        if (!s || wParze(s) || ![g.x, g.y, g.w, g.h].every(Number.isFinite)) continue;
        ustaw(s, wGranicachEkranu(g));
        pamiec.zapisz(kluczOkna(s), prostokat(s));
      }
    },
    naWierzch: (x) => { const s = okno(x); if (s) naWierzch(s); },
    pelny: (x) => { const s = okno(x); if (s) pelny(s); },
    przyklej: (x, strona) => { const s = okno(x); if (s) przyklej(s, strona); },
    naZmiane: (fn) => { sluchacze.add(fn); return () => sluchacze.delete(fn); },
    odmontuj: () => {
      noweOkna.disconnect();
      pary.disconnect();
      clearInterval(zegar);
      removeEventListener('blur', poBlur);
      removeEventListener('resize', sprawdzEkran);
      SZEROKI.removeEventListener('change', sprawdzEkran);
      sluchacze.clear();
    },
  };
}
