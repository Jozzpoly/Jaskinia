// Przeprowadzka stanu starego Domu na inny adres — wymagania dla rdzenia zapisów.
//
// Zadanie z propozycji terytoriów (Opus czat, 10 XI): "przeniesienie stanu starego Domu
// na inny adres bez strat". Powód jest pilny: punkt 2 planu stawia tę samą Jaskinię na
// adresie Cloudflare, a `localStorage` należy do originu. Na nowym adresie stan Jozza
// nie istnieje, więc jedyną drogą jest eksport na starym i import na nowym.
//
// CO USTALIŁEM W KODZIE DAWCY (Jozz-Cave-Workbench, src/jaskinia/15-store.js, 427 linii):
//
//   linia   9  sześć kluczy: jaskinia:v3, :v2, :v3:z-v2, :v1, :kopie, :ratunek
//   linia 336  snapshotAll() -> { spaces, cur, sel, notes, views, saved }
//   linia 418  exportText('all') -> { ...snapshotAll(), saved }
//   linia 340  fromSnapshot() -> ustawia trash: [] wprost
//   linia 210  sameParts() -> scalanie między kartami OBEJMUJE kosz
//
// Eksport nie zawiera więc: kopii automatycznych (`jaskinia:kopie`), kosza, kopii
// ratunkowej (`jaskinia:ratunek`) ani danych v1/v2. To są dokładnie te dwie zasady,
// które mapa dawcy wymieniła jako konieczne do zachowania: "kopie przed każdym
// ryzykownym krokiem" i "ratunek dla tego, czego nie da się odczytać". Kosz jest
// przy tym dość ważny, by scalać go między kartami, i pomijany przy zmianie adresu.
//
// To NIE jest zarzut wobec planu: podgląd na Cloudflare obok obecnego Domu nie wymaga
// przeprowadzki, a o przełączeniu decyduje Jozz. To jest cena przełączenia, policzona
// zanim ktokolwiek je zrobi.
//
// Poniższe testy stawiają te wymagania rdzeniowi R1 i sprawdzają, czy umie unieść stan
// starego Domu. Dobra wiadomość: co do zawartości umie. Zła: nie umie odpowiedzieć
// "daj mi kopię sprzed wczorajszego bałaganu", bo nigdzie nie ma czasu (F3
// w proweniencja.test.mjs). Dopiero tu widać, że brak czasu nie jest pedantyzmem.
//
// Opus Code, 10 XI 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Rdzen } from './rdzen.mjs';

// P4 pada na dzisiejszym rdzeniu i to jest jego treść. Jako zwykłe czerwone blokowałoby
// CI wszystkim w tym repo, a jako usunięte przestałoby być dowodem — więc nosi warunek
// zdjęcia i nadal się wykonuje. Ten sam warunek co TANIE w proweniencja.test.mjs: obie
// rzeczy naprawia jedno pole.
const CZAS = 'zdjąć, gdy zdarzenia dziennika mają czas (ten sam warunek co TANIE w proweniencja.test.mjs)';

const JOZZ = { who: 'jozz', role: 'owner' };

// Stan starego Domu w miniaturze: jedna przestrzeń, uwaga, zapisany układ,
// rzecz w koszu, kopia automatyczna i surowa kopia ratunkowa.
function staryDom() {
  return {
    uklad: { name: 'przeglad', preset: 'dwa-okna', L: { wins: { w1: { typ: 'sciana' } } } },
    uwaga: { tekst: 'sprawdzić hamulce na hopkach' },
    zapisany: { name: 'do pracy nocnej', L: { wins: { w1: { typ: 'puls' } } } },
    wKoszu: { kind: 'space', name: 'stara przeglądarka', data: { L: { wins: {} } } },
    kopia: { why: 'przed importem', n: 1, data: { spaces: ['przeglad'] } },
    ratunek: '{"to":"nieczytelne dane, których nie dało się sparsować',
  };
}

// Przeprowadzka: wszystko staje się zapisami pod własnymi głowami, potem eksport i import.
function przeprowadz(stan) {
  const r = new Rdzen();
  const glowy = {
    'uklady:przeglad': 'wlasciciel',
    'uwagi:skrzynka': 'wspolna',
    'uklady:zapisane': 'wlasciciel',
    'kosz': 'wlasciciel',
    'kopie:auto': 'wlasciciel',
    'ratunek': 'wlasciciel',
  };
  for (const [n, p] of Object.entries(glowy)) r.zalozGlowe(n, p, JOZZ);
  const wrzuc = (glowa, kind, tresc) => {
    const id = r.zapisz(kind, tresc, JOZZ);
    assert.equal(r.przesun(glowa, null, id, JOZZ, 'przeprowadzka').ok, true);
    return id;
  };
  wrzuc('uklady:przeglad', 'uklad', stan.uklad);
  wrzuc('uwagi:skrzynka', 'uwaga', stan.uwaga);
  wrzuc('uklady:zapisane', 'zapisany-uklad', stan.zapisany);
  wrzuc('kosz', 'w-koszu', stan.wKoszu);
  wrzuc('kopie:auto', 'kopia', stan.kopia);
  wrzuc('ratunek', 'ratunek', { surowe: stan.ratunek });
  return Rdzen.importuj(r.eksport());   // nowy adres: tylko plik przechodzi
}

test('P1: wszystkie sześć rodzajów stanu przeżywa zmianę adresu', () => {
  const stan = staryDom();
  const nowy = przeprowadz(stan);

  // To jest cała lista tego, co stary eksport gubi albo niesie.
  const co = {
    'uklady:przeglad': stan.uklad,      // niesie dzisiejszy eksport
    'uwagi:skrzynka': stan.uwaga,       // niesie
    'uklady:zapisane': stan.zapisany,   // niesie
    'kosz': stan.wKoszu,                // GUBI (fromSnapshot: trash: [])
    'kopie:auto': stan.kopia,           // GUBI (jaskinia:kopie poza snapshotAll)
    'ratunek': { surowe: stan.ratunek },// GUBI (jaskinia:ratunek poza snapshotAll)
  };
  for (const [glowa, tresc] of Object.entries(co)) {
    const id = nowy.glowa(glowa);
    assert.ok(id, `po przeprowadzce nie ma głowy ${glowa}`);
    assert.deepEqual(nowy.zapis(id).content, tresc, `treść ${glowa} nie przeżyła`);
  }
});

test('P2: surowa kopia ratunkowa przeżywa, choć nie jest poprawnym JSON-em', () => {
  // Zasada starego magazynu: to, czego nie dało się odczytać, zostaje w całości.
  // Rdzeń nie może wymagać, żeby ratunek dał się sparsować, bo wtedy nie jest ratunkiem.
  const stan = staryDom();
  const nowy = przeprowadz(stan);
  assert.equal(nowy.zapis(nowy.glowa('ratunek')).content.surowe, stan.ratunek);
});

test('P3: po przeprowadzce widać, kto przeniósł stan i skąd', () => {
  const nowy = przeprowadz(staryDom());
  const przesuniecia = nowy.dziennik().filter(e => e.typ === 'przesun');
  assert.equal(przesuniecia.length, 6);
  assert.ok(przesuniecia.every(e => e.dlaczego === 'przeprowadzka' && e.kto === 'jozz'),
    'dziennik musi mówić, że to była przeprowadzka i czyja');
});

test('P4: da się odzyskać kopię sprzed konkretnej chwili', { todo: CZAS }, () => {
  const r = new Rdzen();
  r.zalozGlowe('kopie:auto', 'wlasciciel', JOZZ);

  // Trzy kopie automatyczne, każda przed ryzykownym krokiem, jak w starym magazynie.
  let poprzednia = null;
  for (const why of ['przed importem', 'przed resetem', 'auto']) {
    const id = r.zapisz('kopia', { why, data: { spaces: [why] } }, JOZZ);
    assert.equal(r.przesun('kopie:auto', poprzednia, id, JOZZ, why).ok, true);
    poprzednia = id;
  }

  // Jozz pyta: "daj mi kopię sprzed wczorajszego bałaganu". To jest cały sens kopii.
  // Rdzeń ma licznik `n`, który porządkuje, ale nie datuje — więc na to pytanie
  // nie da się odpowiedzieć bez zewnętrznego zegara, którego w rdzeniu nie ma.
  const zdarzenia = r.dziennik().filter(e => e.typ === 'przesun');
  assert.ok(zdarzenia.every(e => Object.keys(e).some(k => /czas|kiedy|time|ts/i.test(k))),
    'kopia bez czasu nie odpowiada na pytanie "sprzed kiedy"; zdarzenie: ' + JSON.stringify(zdarzenia[0]));
});

test('P5: dwie karty na starym i nowym adresie nie nadpisują się po cichu', () => {
  // Stara Jaskinia wypracowała tę ochronę po realnej utracie zmian (v6.3).
  // Przy przeprowadzce ryzyko wraca: ta sama osoba ma otwarte dwa adresy naraz.
  const r = new Rdzen();
  r.zalozGlowe('uklady:przeglad', 'wlasciciel', JOZZ);
  const a = r.zapisz('uklad', { L: { wins: { w1: {} } } }, JOZZ);
  const b = r.zapisz('uklad', { L: { wins: { w1: {}, w2: {} } } }, JOZZ, [a]);
  assert.equal(r.przesun('uklady:przeglad', null, a, JOZZ).ok, true);
  assert.equal(r.przesun('uklady:przeglad', a, b, JOZZ).ok, true);
  // Karta ze starego adresu nadal myśli, że głowa stoi na `a`.
  assert.deepEqual(r.przesun('uklady:przeglad', a, a, JOZZ), { ok: false, teraz: b });
});

test('P0: dowody i numery linii dawcy nie znikają po cichu', () => {
  const zrodlo = readFileSync(new URL(import.meta.url), 'utf8');
  for (const id of ['P1', 'P2', 'P3', 'P4', 'P5'])
    assert.ok(zrodlo.includes("test('" + id + ":"), `wymaganie ${id} musi zostać w pliku`);
  for (const l of ['linia   9', 'linia 336', 'linia 418', 'linia 340', 'linia 210'])
    assert.ok(zrodlo.includes(l), `odwołanie do dawcy (${l}) musi zostać, bo z niego wynikają wymagania`);

  // Jedno todo, z warunkiem. Bez warunku zostałoby tu na zawsze.
  const todos = zrodlo.match(/todo:\s*[A-Za-z_$][\w$]*/g) ?? [];
  assert.equal(todos.length, 1, 'pada jedno wymaganie, więc jedno todo');
  assert.equal(todos[0].replace(/todo:\s*/, ''), 'CZAS');
  assert.ok(CZAS.startsWith('zdjąć, gdy') && CZAS.length > 40, 'warunek musi mówić, kiedy go zdjąć');
});
