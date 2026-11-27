// Sprawdziany części warstwy okien, która nie potrzebuje przeglądarki (public/okna-swiatow.mjs): granice ekranu,
// przyklejanie, pełny ekran i pamięć układu. Zachowanie w oknie przeglądarki (ciągnięcie, róg, przyklejanie ręką,
// na wierzch, dwuklik, przeładowanie, telefon) sprawdza przyrząd okna-swobodne-proba.mjs (Edge przez DevTools)
// i sprawdzian podłogi pulpitu Opusa czatu. Opus Code, 27 XI 2026 (tor 1).
import test from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../public/okna-swiatow.mjs');
// ekran 1440 px szerokości, pasek u góry kończy się na 60 px, dok zaczyna się na 860 px
const E = { szer: 1440, gora: 60, dol: 860 };

test('OS1. granice z paskiem (tak od 21 XI): okno wysunięte za krawędź zostawia 80 px paska, nie wchodzi na pasek ani pod dok i nie jest mniejsze niż 280 na 160', () => {
  assert.deepEqual(M.wGranicach({ x: -1000, y: 0, w: 600, h: 400 }, E), { x: 80 - 600, y: 60, w: 600, h: 400 });
  assert.deepEqual(M.wGranicach({ x: 5000, y: 5000, w: 600, h: 400 }, E), { x: 1440 - 80, y: 860 - 40, w: 600, h: 400 });
  assert.deepEqual(M.wGranicach({ x: 10, y: 100, w: 100, h: 50 }, E), { x: 10, y: 100, w: 280, h: 160 });
  assert.deepEqual(M.wGranicach({ x: 10, y: 100, w: 3000, h: 3000 }, E), { x: 10, y: 100, w: 1440, h: 800 });
  // domyślne granice to pasek: wywołanie bez trzeciego argumentu daje to samo
  assert.deepEqual(M.wGranicach({ x: -1000, y: 0, w: 600, h: 400 }, E, 'pasek'), M.wGranicach({ x: -1000, y: 0, w: 600, h: 400 }, E));
});

test('OS2. granice „całe okno na ekranie” (czerwcowy pulpit): okno nie wychodzi za żadną krawędź, także dół zostaje nad dokiem', () => {
  assert.deepEqual(M.wGranicach({ x: -1000, y: 0, w: 600, h: 400 }, E, 'calosc'), { x: 0, y: 60, w: 600, h: 400 });
  assert.deepEqual(M.wGranicach({ x: 5000, y: 5000, w: 600, h: 400 }, E, 'calosc'), { x: 840, y: 460, w: 600, h: 400 });
  // okno szersze niż ekran dostaje szerokość ekranu i stoi przy lewej krawędzi
  assert.deepEqual(M.wGranicach({ x: 300, y: 100, w: 3000, h: 3000 }, E, 'calosc'), { x: 0, y: 60, w: 1440, h: 800 });
});

test('OS3. przyklejenie: połowy leżą obok siebie bez nakładania i bez szczeliny (także przy nieparzystej szerokości), całość to cały obszar między paskiem a dokiem', () => {
  assert.deepEqual(M.prostokatPrzyklejenia('lewo', E), { x: 0, y: 60, w: 720, h: 800 });
  assert.deepEqual(M.prostokatPrzyklejenia('prawo', E), { x: 720, y: 60, w: 720, h: 800 });
  assert.deepEqual(M.prostokatPrzyklejenia('calosc', E), { x: 0, y: 60, w: 1440, h: 800 });
  assert.equal(M.prostokatPrzyklejenia('gora', E), null);
  const N = { ...E, szer: 1441 };
  const l = M.prostokatPrzyklejenia('lewo', N), p = M.prostokatPrzyklejenia('prawo', N);
  assert.equal(l.x + l.w, p.x);
  assert.equal(p.x + p.w, 1441);
});

test('OS4. strefa przyklejania pod wskaźnikiem: górna krawędź daje cały ekran, lewa i prawa połowę, środek nic', () => {
  assert.deepEqual(M.strefaPrzyklejania(500, 60 + 12, E, 12), M.prostokatPrzyklejenia('calosc', E));
  assert.deepEqual(M.strefaPrzyklejania(12, 400, E, 12), M.prostokatPrzyklejenia('lewo', E));
  assert.deepEqual(M.strefaPrzyklejania(1440 - 12, 400, E, 12), M.prostokatPrzyklejenia('prawo', E));
  assert.equal(M.strefaPrzyklejania(500, 400, E, 12), null);
  assert.equal(M.strefaPrzyklejania(13, 400, E, 12), null);
});

test('OS5. pełny ekran rozpoznany z tolerancją zaokrągleń 2 px, a o 3 px obok już nie', () => {
  assert.equal(M.jestCaly({ x: 0, y: 60, w: 1440, h: 800 }, E), true);
  assert.equal(M.jestCaly({ x: 2, y: 58, w: 1438, h: 802 }, E), true);
  assert.equal(M.jestCaly({ x: 3, y: 60, w: 1440, h: 800 }, E), false);
});

// pamięć w stylu localStorage: getItem i setItem na zwykłej mapie
const magazyn = (start = {}) => { const m = new Map(Object.entries(start)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('OS6. pamięć przeglądarki czyta układ zapisany przed wydzieleniem modułu (ten sam wpis i format co okna-swobodne.js) i dopisuje do niego', () => {
  const stary = { 'B /gosc/abc': { x: 1, y: 2, w: 300, h: 200 }, '/gosc/abc': { x: 5, y: 6, w: 400, h: 300, przed: { x: 0, y: 0, w: 10, h: 10 } } };
  const mg = magazyn({ 'jaskinia:okna:uklad:v1': JSON.stringify(stary) });
  assert.equal(M.KLUCZ_PRZEGLADARKI, 'jaskinia:okna:uklad:v1');
  const p = M.pamiecPrzegladarki(undefined, mg);
  assert.deepEqual(p.czytaj('B /gosc/abc'), stary['B /gosc/abc']);
  assert.deepEqual(p.czytaj('/gosc/abc'), stary['/gosc/abc']);
  assert.equal(p.czytaj('nie ma'), null);
  // nazwa z prototypu obiektu nie jest zapamiętanym oknem
  assert.equal(p.czytaj('__proto__'), null);
  assert.equal(p.czytaj('toString'), null);
  p.zapisz('/gosc/nowy', { x: 9, y: 9, w: 300, h: 200 });
  assert.deepEqual(JSON.parse(mg.getItem('jaskinia:okna:uklad:v1')), { ...stary, '/gosc/nowy': { x: 9, y: 9, w: 300, h: 200 } });
});

test('OS7. zablokowana pamięć przeglądarki nie zatrzymuje warstwy: wyjątek przy samym dostępie do localStorage i przy zapisie, układ żyje do przeładowania', () => {
  const opis = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('dane strony zablokowane'); } });
  try {
    const p = M.pamiecPrzegladarki();
    assert.equal(p.czytaj('/gosc/abc'), null);
    p.zapisz('/gosc/abc', { x: 1, y: 2, w: 300, h: 200 });
    assert.deepEqual(p.czytaj('/gosc/abc'), { x: 1, y: 2, w: 300, h: 200 });
  } finally {
    if (opis) Object.defineProperty(globalThis, 'localStorage', opis); else delete globalThis.localStorage;
  }
  // zepsuty wpis (nie JSON) też nie zatrzymuje: warstwa zaczyna od pustego układu
  const zly = M.pamiecPrzegladarki(undefined, magazyn({ 'jaskinia:okna:uklad:v1': '{niejson' }));
  assert.equal(zly.czytaj('/gosc/abc'), null);
});
