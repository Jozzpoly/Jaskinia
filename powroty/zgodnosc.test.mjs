// Czy powrót wyprawy jest powrotem, czy pocztówką.
//
// Strona `powroty/2026-09-29-wolny-czas/index.html` nie opowiada o wynikach agenta z 29 IX
// 2026 — ona je liczy od nowa, w przeglądarce, przy pokrętłach, które można ruszać.
// To daje jej całą wartość i całe ryzyko: wystarczy jedna literówka we wzorze i strona
// pokazuje cudze odkrycie w wersji, której nikt nigdy nie policzył. Byłoby to gorsze od
// braku powrotu, bo wyglądałoby na powrót.
//
// Dlatego ten test WYJMUJE MATEMATYKĘ WPROST Z TEGO PLIKU (blok między znacznikami
// #LICZBY-START i #LICZBY-KONIEC, bez ani jednej linii dotykającej DOM-u) i stawia ją obok
// liczb zapisanych 29 IX. Nie odtwarzam wzorów tutaj: gdybym je przepisał, test sprawdzałby
// zgodność mojej kopii z moją kopią.
//
// SKĄD BIORĄ SIĘ LICZBY ODNIESIENIA. Z plików, które agent zapisał 29 IX 2026
// (`three-worlds-results.json`, `dice-results.json`, `changing-minds-results.json`).
// Tych plików NIE MA w tym repozytorium: leżą na dysku Jozza, a wniesienie ich tutaj
// byłoby publikacją cudzej pracy — to jego decyzja (zasada 4). Przepisałem więc wartości
// jako stałe, z podaniem pochodzenia, a pełne porównanie z oryginałami uruchamia się,
// gdy ustawi się `POWROT_ZRODLO` na katalog z nimi. Brak tej zmiennej jest RAPORTOWANY,
// nie przemilczany — tak samo jak brak prywatnych wzorców w strażniku.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STRONA = new URL('./2026-09-29-wolny-czas/index.html', import.meta.url);

/* ------------------------------------------------- wyjęcie matematyki ze strony */

function wyjmijLiczby() {
  const zrodlo = readFileSync(STRONA, 'utf8');
  const od = zrodlo.indexOf('#LICZBY-START');
  const do_ = zrodlo.indexOf('#LICZBY-KONIEC');
  assert.ok(od > 0 && do_ > od,
    'nie ma znaczników #LICZBY-START / #LICZBY-KONIEC — albo ktoś je usunął, albo przeniósł '
    + 'matematykę gdzie indziej. Tak czy owak ten test przestał cokolwiek sprawdzać.');
  // Od końca komentarza otwierającego do początku komentarza zamykającego — liczone
  // po samych komentarzach, a nie po stałym odstępie, żeby przesunięcie o jeden znak
  // nie wcinało się w kod i nie dawało błędu składni zamiast uczciwej odpowiedzi.
  const blok = zrodlo.slice(zrodlo.indexOf('*/', od) + 2, zrodlo.lastIndexOf('/*', do_));

  assert.ok(!/document|window|\$\(/.test(blok),
    'blok liczb dotyka DOM-u, więc nie jest już czystą matematyką i nie da się go sprawdzić osobno');

  // eslint-disable-next-line no-new-func
  return new Function(blok + '\nreturn { SWIATY, rozklad, bije, przeszukaj, pewnosc, kopie };')();
}

/* ------------------------------------- liczby zapisane 29 IX 2026 przez agenta Codexa */

// three-worlds-results.json: klucze forward/reverse/common to światy A/B/C.
const TRZY_SWIATY_29IX = {
  A: {
    observe: { '0,0': 0.4, '0,1': 0.1, '1,0': 0.1, '1,1': 0.4 },
    doX: { '0,0': 0.0, '0,1': 0.0, '1,0': 0.2, '1,1': 0.8 },
    doY: { '0,0': 0.0, '0,1': 0.5, '1,0': 0.0, '1,1': 0.5 },
  },
  B: {
    observe: { '0,0': 0.4, '0,1': 0.1, '1,0': 0.1, '1,1': 0.4 },
    doX: { '0,0': 0.0, '0,1': 0.0, '1,0': 0.5, '1,1': 0.5 },
    doY: { '0,0': 0.0, '0,1': 0.2, '1,0': 0.0, '1,1': 0.8 },
  },
  C: {
    observe: { '0,0': 0.4, '0,1': 0.1, '1,0': 0.1, '1,1': 0.4 },
    doX: { '0,0': 0.0, '0,1': 0.0, '1,0': 0.5, '1,1': 0.5 },
    doY: { '0,0': 0.0, '0,1': 0.5, '1,0': 0.0, '1,1': 0.5 },
  },
};
// dice-results.json
const KOSCI_29IX = { Checked: 1680, DirectedCycles: 15, BestWeakestWinsOutOf9: 5 };
// changing-minds-results.json → repetition.curve, dla q = 0.65 i r = 0.01
const DETEKTYW_29IX = [
  { n: 1, p_red: 0.65, p_echo: 0.01 },
  { n: 6, p_red: 0.9384875005415976, p_echo: 0.11562754259771967 },
  { n: 12, p_red: 0.775921765036839, p_echo: 0.639612163713199 },
  { n: 24, p_red: 0.6511174669690603, p_echo: 0.9968072340115861 },
];
const Q = 0.65, R = 0.01, PU = 0.5, PV = 0.2;
const blisko = (a, b, e = 1e-12) => Math.abs(a - b) <= e;

/* ------------------------------------------------------------------------ testy */

test('trzy światy: obserwacje i obie interwencje zgadzają się z 29 IX', () => {
  const L = wyjmijLiczby();
  for (const [nazwa, oczekiwane] of Object.entries(TRZY_SWIATY_29IX)) {
    const s = L.SWIATY[nazwa];
    assert.ok(s, 'brak świata ' + nazwa);
    for (const [tryb, klucz] of [['obs', 'observe'], ['doX', 'doX'], ['doY', 'doY']]) {
      const dano = L.rozklad(s[tryb], PU, PV);
      for (const stan of ['0,0', '0,1', '1,0', '1,1'])
        assert.ok(blisko(dano[stan], oczekiwane[klucz][stan]),
          `${nazwa}/${tryb}/${stan}: strona liczy ${dano[stan]}, 29 IX dało ${oczekiwane[klucz][stan]}`);
    }
  }
});

test('trzy światy: rzecz, o którą w nich chodzi — patrzenie nie rozróżnia, interwencja tak', () => {
  // To jest teza wyprawy, nie tylko jej liczby. Gdyby strona liczyła poprawnie, a teza
  // przestała zachodzić, wynik byłby zielony i bezużyteczny.
  const L = wyjmijLiczby();
  const odcisk = (s, tryb) => JSON.stringify(L.rozklad(s[tryb], PU, PV));
  const obs = Object.values(L.SWIATY).map(s => odcisk(s, 'obs'));
  assert.equal(new Set(obs).size, 1, 'trzy światy mają mieć identyczne obserwacje');
  const poX = Object.values(L.SWIATY).map(s => odcisk(s, 'doX'));
  assert.ok(new Set(poX).size > 1, 'wymuszenie X ma je rozdzielić');
  // A od B i C odróżnia pierwsza interwencja; B od C dopiero druga.
  assert.notEqual(odcisk(L.SWIATY.B, 'doX'), odcisk(L.SWIATY.A, 'doX'));
  assert.equal(odcisk(L.SWIATY.B, 'doX'), odcisk(L.SWIATY.C, 'doX'),
    'B i C są nieodróżnialne po wymuszeniu X — na to trzeba wymuszenia Y');
  assert.notEqual(odcisk(L.SWIATY.B, 'doY'), odcisk(L.SWIATY.C, 'doY'));
});

test('kości: przeszukanie w przeglądarce daje te same 1680 / 15 / 5 co PowerShell z 29 IX', () => {
  const L = wyjmijLiczby();
  const w = L.przeszukaj();
  assert.equal(w.sprawdzone, KOSCI_29IX.Checked);
  assert.equal(w.cykle, KOSCI_29IX.DirectedCycles);
  assert.equal(w.najlepszy, KOSCI_29IX.BestWeakestWinsOutOf9);
});

test('kości: oryginalna trójka nadal zamyka cykl po 5 na 9 w każdym ogniwie', () => {
  const L = wyjmijLiczby();
  const A = [1, 5, 9], B = [3, 4, 8], C = [2, 6, 7];
  assert.deepEqual([L.bije(A, B), L.bije(B, C), L.bije(C, A)], [5, 5, 5]);
  assert.deepEqual([A, B, C].map(k => k.reduce((s, x) => s + x, 0) / 3), [5, 5, 5],
    'wszystkie trzy mają tę samą średnią — bez tego cykl byłby nudny');
});

test('detektyw: cztery punkty krzywej zgadzają się z dokładnymi ułamkami z 29 IX', () => {
  const L = wyjmijLiczby();
  for (const { n, p_red, p_echo } of DETEKTYW_29IX) {
    assert.ok(blisko(L.pewnosc(Q, R, n), p_red, 1e-12),
      `pewność przy n=${n}: strona ${L.pewnosc(Q, R, n)}, 29 IX ${p_red}`);
    assert.ok(blisko(L.kopie(Q, R, n), p_echo, 1e-12),
      `podejrzenie kopii przy n=${n}: strona ${L.kopie(Q, R, n)}, 29 IX ${p_echo}`);
  }
});

test('detektyw: zwrot istnieje i jest w szóstym kroku, a granicą jest trafność jednej wskazówki', () => {
  // Znowu teza, nie liczby. Gdyby wzór zgadzał się w czterech punktach, a zwrot zniknął,
  // strona kłamałaby o tym, co wyprawa odkryła.
  const L = wyjmijLiczby();
  let szczyt = 1;
  for (let n = 2; n <= 40; n++) if (L.pewnosc(Q, R, n) > L.pewnosc(Q, R, szczyt)) szczyt = n;
  assert.equal(szczyt, 6, 'pewność ma być najwyższa po sześciu zgodnych wskazówkach');
  assert.ok(L.pewnosc(Q, R, 24) < L.pewnosc(Q, R, 6), 'i ma potem SPADAĆ, bo w tym rzecz');
  assert.ok(blisko(L.pewnosc(Q, R, 400), Q, 1e-6),
    'przy dowolnym r>0 granicą jest q — trafność pojedynczej wskazówki');
  assert.ok(L.pewnosc(Q, 0, 24) > 0.99999,
    'a przy r=0, czyli pewnej niezależności, te same 24 wskazówki dają prawie pewność — '
    + 'cały spadek bierze się z dopuszczenia, że źródło może być jedno');
});

test('strona nie udaje, że przywiozła wszystko', () => {
  // Pięć wypraw, trzy artefakty. Milczenie o dwóch brakujących byłoby tym samym rodzajem
  // fałszu co zielony test na martwym mechanizmie.
  const zrodlo = readFileSync(STRONA, 'utf8');
  assert.match(zrodlo, /Czego nie przywiozłem/, 'brakujące wyprawy mają być nazwane na stronie');
  assert.match(zrodlo, /hub/i, 'wyprawa o hubach ma być wymieniona jako brakująca');
  assert.match(zrodlo, /zegar/i, 'wyprawa o zegarach ma być wymieniona jako brakująca');
  assert.ok(!/Documents\\Codex|C:\\Users/i.test(zrodlo),
    'lokalne ścieżki nie wchodzą do publicznego repo (zasada 2)');
});

test('pełne porównanie z oryginałami z 29 IX — gdy są pod ręką', (t) => {
  // Stałe wyżej mogłyby się rozjechać z plikami agenta i nikt by nie zauważył. Ta próba
  // zamyka tę dziurę, ale wymaga plików, których w repo nie ma i nie będzie bez decyzji
  // Jozza. Brak zmiennej jest POWIEDZIANY, nie przemilczany.
  const kat = process.env.POWROT_ZRODLO;
  if (!kat) {
    t.diagnostic('POWROT_ZRODLO nieustawione — porównuję tylko ze stałymi w tym pliku, '
      + 'nie z plikami z 29 IX. Żeby sprawdzić naprawdę: POWROT_ZRODLO=<katalog outputs>');
    return;
  }
  const czytaj = (n) => {
    const p = join(kat, n);
    assert.ok(existsSync(p), 'nie ma pliku ' + n + ' w POWROT_ZRODLO');
    return JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  };
  const kosci = czytaj('dice-results.json');
  assert.equal(kosci.Checked, KOSCI_29IX.Checked);
  assert.equal(kosci.DirectedCycles, KOSCI_29IX.DirectedCycles);
  assert.equal(kosci.BestWeakestWinsOutOf9, KOSCI_29IX.BestWeakestWinsOutOf9);

  const swiaty = czytaj('three-worlds-results.json');
  for (const [nasz, ich] of [['A', 'forward'], ['B', 'reverse'], ['C', 'common']])
    for (const [tryb, klucz] of [['observe', 'observe'], ['doX', 'X=1'], ['doY', 'Y=1']])
      for (const stan of ['0,0', '0,1', '1,0', '1,1'])
        assert.ok(blisko(TRZY_SWIATY_29IX[nasz][tryb][stan], swiaty[ich][klucz][stan]),
          `stała ${nasz}/${tryb}/${stan} rozeszła się z plikiem z 29 IX`);

  const detektyw = czytaj('changing-minds-results.json').repetition.curve;
  for (const { n, p_red, p_echo } of DETEKTYW_29IX) {
    const w = detektyw.find(x => x.n === n);
    assert.ok(w, 'brak punktu n=' + n + ' w krzywej z 29 IX');
    assert.ok(blisko(w.p_red_if_all_red, p_red), 'stała p_red przy n=' + n + ' rozeszła się z plikiem');
    assert.ok(blisko(w.p_echo_if_all_red, p_echo), 'stała p_echo przy n=' + n + ' rozeszła się z plikiem');
  }
});
