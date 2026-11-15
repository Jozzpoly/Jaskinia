// Stos cofania: czysta funkcja z samych aktow (docs/krok-1-umowa.md, 5.3 i przypadki ST1-ST14).
// Sprawdziany pisane przed kodem. Patrza na to, co zwraca stos(), nie na wnetrze modulu.
// Op-y cofniecia i ponowienia sa tu wpisane literalnie ('cofnij.akt:<nr>', 'ponow.akt:<nr>'), zeby ten plik
// nie zalezal od ksztalty.mjs (paczka P2 zalezy od P0 tylko przez rozpoznanie op, a to sprawdza KS13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stos } from './stos-cofania.mjs';

const OKNO = { obciete: false };
const OBCIETE = { obciete: true };

// Akt przesuniecia glowy: { nr, op, glowa, zapis, z }. Zwykly ruch ma dowolny op klienta z koncowka .p (op zlozony
// pary z gestu), i to nadal jest zwykly ruch.
const ruch = (nr, glowa, z, zapis) => ({ nr, op: `g-${String(nr).padStart(8, '0')}.p`, glowa, zapis, z });
const cofnij = (nr, akt, glowa, z, zapis) => ({ nr, op: `cofnij.akt:${akt}`, glowa, zapis, z });
const ponow = (nr, akt, glowa, z, zapis) => ({ nr, op: `ponow.akt:${akt}`, glowa, zapis, z });

const G1 = 'jozz:przestrzen/test/rzecz/a';
const G2 = 'jozz:przestrzen/test/rzecz/b';
const G3 = 'jozz:przestrzen/test/rzecz/c';

// Maly generator z ustalonym ziarnem (mulberry32); zadnego Math.random.
function mulberry32(ziarno) {
  let a = ziarno >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function zamroz(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) zamroz(o[k]);
  }
  return o;
}

test('ST1: pusta lista aktow: oba cele null, glebokosci zerowe, brak niespojnosci', () => {
  const s = stos([], OKNO);
  assert.equal(s.doCofniecia, null);
  assert.equal(s.doPonowienia, null);
  assert.deepEqual(s.glebokosc, { cofnij: 0, ponow: 0 });
  assert.deepEqual(s.niespojne, []);
});

test('ST1b: pusta lista przy obcietym oknie to tez null (okno bez aktow nie wymysla wpisow)', () => {
  const s = stos([], OBCIETE);
  assert.equal(s.doCofniecia, null);
  assert.equal(s.doPonowienia, null);
  assert.deepEqual(s.glebokosc, { cofnij: 0, ponow: 0 });
  assert.deepEqual(s.niespojne, []);
});

test('ST2: jeden ruch: cel cofniecia ma trzyma rowne numerowi ruchu i wroc_na rowne z', () => {
  const s = stos([ruch(5, G1, 'zapis-a', 'zapis-b')], OKNO);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 5, wroc_na: 'zapis-a' });
  assert.equal(s.doPonowienia, null);
  assert.deepEqual(s.glebokosc, { cofnij: 1, ponow: 0 });
  assert.deepEqual(s.niespojne, []);
});

test('ST2b: stos jest jeden na przestrzen, nie na glowe: wierzchem jest ostatnio ruszona karta', () => {
  const s = stos([ruch(1, G1, null, 'a1'), ruch(2, G2, null, 'b1'), ruch(3, G1, 'a1', 'a2')], OKNO);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 3, wroc_na: 'a1' });
  assert.equal(s.glebokosc.cofnij, 3);
});

test('ST2c: funkcja jest czysta: nie zmienia wejscia i daje ten sam wynik za drugim razem', () => {
  const akty = zamroz([ruch(1, G1, null, 'a'), ruch(2, G1, 'a', 'b'), cofnij(3, 2, G1, 'b', 'a')]);
  const jeden = stos(akty, OKNO);
  const dwa = stos(akty, OKNO);
  assert.deepEqual(jeden, dwa);
});

test('ST3: ruch, cofniecie: cel ponowienia ma trzyma rowne numerowi cofniecia, a wroc_na tam, skad cofniecie zabralo glowe', () => {
  const s = stos([ruch(1, G1, 'a', 'b'), cofnij(2, 1, G1, 'b', 'a')], OKNO);
  assert.deepEqual(s.doPonowienia, { glowa: G1, trzyma: 2, wroc_na: 'b' });
  assert.equal(s.doCofniecia, null);
  assert.deepEqual(s.glebokosc, { cofnij: 0, ponow: 1 });
  assert.deepEqual(s.niespojne, []);
});

test('ST4: ruch, cofniecie, ponowienie: cel cofniecia ma trzyma rowne numerowi ponowienia i wroc_na jak na poczatku', () => {
  const s = stos([ruch(1, G1, 'a', 'b'), cofnij(2, 1, G1, 'b', 'a'), ponow(3, 2, G1, 'a', 'b')], OKNO);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 3, wroc_na: 'a' });
  assert.equal(s.doPonowienia, null);
  assert.deepEqual(s.glebokosc, { cofnij: 1, ponow: 0 });
  assert.deepEqual(s.niespojne, []);
});

test('ST4b: ponowienie niczego nie czysci: dwa cofniecia, jedno ponowienie, drugie nadal czeka', () => {
  const s = stos([
    ruch(1, G1, null, 'a'),
    ruch(2, G1, 'a', 'b'),
    cofnij(3, 2, G1, 'b', 'a'),
    cofnij(4, 1, G1, 'a', 'auto'),
    ponow(5, 4, G1, 'auto', 'a'),
  ], OKNO);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 5, wroc_na: 'auto' });
  assert.deepEqual(s.doPonowienia, { glowa: G1, trzyma: 3, wroc_na: 'b' });
  assert.deepEqual(s.glebokosc, { cofnij: 1, ponow: 1 });
});

test('ST5: ruch A, ruch B, cofniecie B, nowy ruch C: nic do ponowienia; do cofniecia jest C, potem A', () => {
  const akty = [
    ruch(1, G1, null, 'a'),
    ruch(2, G1, 'a', 'b'),
    cofnij(3, 2, G1, 'b', 'a'),
    ruch(4, G1, 'a', 'c'),
  ];
  const s = stos(akty, OKNO);
  assert.equal(s.doPonowienia, null);
  assert.deepEqual(s.glebokosc, { cofnij: 2, ponow: 0 });
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 4, wroc_na: 'a' });
  // cofamy C: wierzchem staje sie A
  const po = stos([...akty, cofnij(5, 4, G1, 'c', 'a')], OKNO);
  assert.deepEqual(po.doCofniecia, { glowa: G1, trzyma: 1, wroc_na: null });
  assert.deepEqual(po.doPonowienia, { glowa: G1, trzyma: 5, wroc_na: 'c' });
  assert.deepEqual(po.niespojne, []);
});

test('ST6: cofniecie wpisu spoza wierzchu zdejmuje wlasnie ten wpis (odpornosc funkcji; drzwi na to nie pozwalaja)', () => {
  const s = stos([
    ruch(1, G1, null, 'a'),
    ruch(2, G1, 'a', 'b'),
    cofnij(3, 1, G1, 'b', 'auto'),
  ], OKNO);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 2, wroc_na: 'a' }, 'wierzch (ruch 2) zostal, zniknal wpis 1');
  assert.deepEqual(s.doPonowienia, { glowa: G1, trzyma: 3, wroc_na: 'b' });
  assert.deepEqual(s.glebokosc, { cofnij: 1, ponow: 1 });
  assert.deepEqual(s.niespojne, []);
});

test('ST7: cofniecie wskazujace numer, ktorego nie ma, przy nieobcietym oknie: niespojne, liczy sie jak zwykly ruch', () => {
  const s = stos([ruch(1, G1, null, 'a'), cofnij(2, 99, G1, 'a', 'b')], OKNO);
  assert.deepEqual(s.niespojne, [2]);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 2, wroc_na: 'a' });
  assert.equal(s.doPonowienia, null);
  assert.deepEqual(s.glebokosc, { cofnij: 2, ponow: 0 });
});

test('ST7b: niespojny akt liczy sie jak zwykly takze w tym, ze czysci kupke do ponowienia', () => {
  const s = stos([
    ruch(1, G1, null, 'a'),
    cofnij(2, 1, G1, 'a', 'auto'),
    cofnij(3, 99, G1, 'auto', 'x'),
  ], OKNO);
  assert.deepEqual(s.niespojne, [3]);
  assert.equal(s.doPonowienia, null, 'ponowienie z aktu 2 przepadlo, jak po zwyklym ruchu');
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 3, wroc_na: 'auto' });
});

test('ST7c: ponowienie wskazujace numer, ktorego nie ma, przy nieobcietym oknie: tez niespojne i zwykly ruch', () => {
  const s = stos([ruch(1, G1, null, 'a'), ponow(2, 99, G1, 'a', 'b')], OKNO);
  assert.deepEqual(s.niespojne, [2]);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 2, wroc_na: 'a' });
  assert.equal(s.doPonowienia, null);
});

test('ST8: pierwsze polozenie karty: wroc_na jest null', () => {
  const s = stos([ruch(1, G1, null, 'a')], OKNO);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 1, wroc_na: null });
});

// Jedna symulacja: k ruchow na kilku kartach, k cofniec budowanych wedlug kolejnych celow, k ponowien tak samo.
function symuluj(ziarno) {
  const los = mulberry32(ziarno);
  const glowy = [G1, G2, G3];
  const k = 1 + Math.floor(los() * 15);
  const glowaZapisu = {};
  const akty = [];
  const zRuchu = {};
  let nr = 0;
  let licznikZapisow = 0;
  for (let i = 0; i < k; i += 1) {
    const g = glowy[Math.floor(los() * glowy.length)];
    nr += 1;
    const z = glowaZapisu[g] ?? null;
    const zapis = `zapis-${++licznikZapisow}`;
    akty.push(ruch(nr, g, z, zapis));
    zRuchu[nr] = z;
    glowaZapisu[g] = zapis;
  }
  const poRuchach = { ...glowaZapisu };
  for (let i = 0; i < k; i += 1) {
    const cel = stos(akty, OKNO).doCofniecia;
    assert.ok(cel, `ziarno ${ziarno}: cofniecie ${i + 1} z ${k} ma cel`);
    assert.equal(cel.trzyma, k - i, `ziarno ${ziarno}: cofamy ruchy od ostatniego`);
    assert.equal(cel.wroc_na, zRuchu[cel.trzyma], `ziarno ${ziarno}: wroc_na to z cofanego ruchu`);
    nr += 1;
    akty.push(cofnij(nr, cel.trzyma, cel.glowa, glowaZapisu[cel.glowa], cel.wroc_na ?? `auto-${cel.glowa}`));
    glowaZapisu[cel.glowa] = cel.wroc_na ?? `auto-${cel.glowa}`;
  }
  return { akty, k, poRuchach, glowaZapisu, nr };
}

test('ST9: po k ruchach i k cofnieciach (wedlug kolejnych celow) cel cofniecia jest null, a glebokosc.ponow rowna k (ziarna 1-30)', () => {
  for (let ziarno = 1; ziarno <= 30; ziarno += 1) {
    const { akty, k } = symuluj(ziarno);
    const s = stos(akty, OKNO);
    assert.equal(s.doCofniecia, null, `ziarno ${ziarno}`);
    assert.equal(s.glebokosc.ponow, k, `ziarno ${ziarno}`);
    assert.equal(s.glebokosc.cofnij, 0, `ziarno ${ziarno}`);
    assert.deepEqual(s.niespojne, [], `ziarno ${ziarno}`);
  }
});

test('ST9b: k ponowien wedlug kolejnych celow odtwarza stan po ruchach i oddaje glebokosc cofnij rowna k (ziarna 1-30)', () => {
  for (let ziarno = 1; ziarno <= 30; ziarno += 1) {
    const { akty, k, poRuchach, glowaZapisu } = symuluj(ziarno);
    let nr = akty.at(-1).nr;
    for (let i = 0; i < k; i += 1) {
      const cel = stos(akty, OKNO).doPonowienia;
      assert.ok(cel, `ziarno ${ziarno}: ponowienie ${i + 1} ma cel`);
      assert.equal(cel.trzyma, 2 * k - i, `ziarno ${ziarno}: ponawiamy od ostatniego cofniecia`);
      nr += 1;
      akty.push(ponow(nr, cel.trzyma, cel.glowa, glowaZapisu[cel.glowa], cel.wroc_na));
      glowaZapisu[cel.glowa] = cel.wroc_na;
    }
    assert.deepEqual(glowaZapisu, poRuchach, `ziarno ${ziarno}: glowy wrocily tam, gdzie byly po ruchach`);
    const s = stos(akty, OKNO);
    assert.equal(s.doPonowienia, null);
    assert.equal(s.glebokosc.cofnij, k);
    assert.equal(s.glebokosc.ponow, 0);
    assert.deepEqual(s.niespojne, []);
  }
});

test('ST10: ta sama karta ruszona dwa razy, dwa cofniecia: drugi cel ma trzyma rowne numerowi pierwszego ruchu, choc glowe przesunal ostatnio akt cofniecia', () => {
  const akty = [ruch(1, G1, null, 'a'), ruch(2, G1, 'a', 'b'), cofnij(3, 2, G1, 'b', 'a')];
  const s = stos(akty, OKNO);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 1, wroc_na: null });
  assert.notEqual(s.doCofniecia.trzyma, 3, 'numer aktu cofniecia (aktualna wersja glowy) to inna liczba niz trzyma');
  // drugie cofniecie: op idzie po trzyma (1), a z aktu to aktualna wersja glowy, czyli zapis 'a'
  const po = stos([...akty, cofnij(4, 1, G1, 'a', 'auto')], OKNO);
  assert.equal(po.doCofniecia, null);
  assert.deepEqual(po.doPonowienia, { glowa: G1, trzyma: 4, wroc_na: 'a' });
  assert.equal(po.glebokosc.ponow, 2);
  assert.deepEqual(po.niespojne, []);
});

test('ST11: obciete okno, w ktorym jest cofniecie ruchu sprzed okna: wpis pojawia sie na cofnietych i nic nie znika ze zrobionych', () => {
  const s = stos([
    ruch(10, G1, 'a', 'b'),
    cofnij(11, 5, G2, 'x', 'w'), // ruch 5 jest starszy niz pierwszy akt okna (10)
  ], OBCIETE);
  assert.deepEqual(s.doPonowienia, { glowa: G2, trzyma: 11, wroc_na: 'x' });
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 10, wroc_na: 'a' });
  assert.deepEqual(s.glebokosc, { cofnij: 1, ponow: 1 });
  assert.deepEqual(s.niespojne, [], 'to nie jest niespojnosc, tylko brzeg okna');
});

test('ST11b: to samo cofniecie przy oknie NIEobcietym jest niespojne (brzeg okna tlumaczy tylko obciete)', () => {
  const s = stos([ruch(10, G1, 'a', 'b'), cofnij(11, 5, G2, 'x', 'w')], OKNO);
  assert.deepEqual(s.niespojne, [11]);
  assert.deepEqual(s.doCofniecia, { glowa: G2, trzyma: 11, wroc_na: 'x' });
  assert.equal(s.doPonowienia, null);
});

test('ST11c: obciete okno, ale wskazany numer jest wewnatrz okna i brak wpisu: niespojne', () => {
  const s = stos([ruch(10, G1, 'a', 'b'), cofnij(12, 11, G1, 'b', 'a')], OBCIETE);
  assert.deepEqual(s.niespojne, [12], 'numer 11 nie jest mniejszy od 10, wiec brzeg okna tego nie tlumaczy');
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 12, wroc_na: 'b' });
  assert.equal(s.doPonowienia, null);
});

test('ST11d: obciete okno, cofniecie sprzed okna nie czysci kupki do ponowienia', () => {
  const s = stos([
    ruch(10, G1, 'a', 'b'),
    cofnij(11, 10, G1, 'b', 'a'),
    cofnij(12, 5, G2, 'x', 'w'),
  ], OBCIETE);
  assert.deepEqual(s.doPonowienia, { glowa: G2, trzyma: 12, wroc_na: 'x' });
  assert.equal(s.glebokosc.ponow, 2, 'wpis z aktu 11 nadal czeka pod wpisem z aktu 12');
  assert.deepEqual(s.niespojne, []);
});

test('ST12: obciete okno z ponowieniem cofniecia sprzed okna: wpis pojawia sie na zrobionych, a cofniete zostaja', () => {
  const s = stos([
    ruch(10, G1, 'a', 'b'),
    cofnij(11, 10, G1, 'b', 'a'),
    ponow(12, 7, G2, 'x', 'y'), // cofniecie 7 jest starsze niz pierwszy akt okna (10)
  ], OBCIETE);
  assert.deepEqual(s.doCofniecia, { glowa: G2, trzyma: 12, wroc_na: 'x' });
  assert.deepEqual(s.doPonowienia, { glowa: G1, trzyma: 11, wroc_na: 'b' }, 'cofniete z aktu 11 zostaje');
  assert.deepEqual(s.glebokosc, { cofnij: 1, ponow: 1 });
  assert.deepEqual(s.niespojne, []);
});

test('ST12b: to samo ponowienie przy oknie NIEobcietym jest niespojne i liczy sie jak zwykly ruch (czysci cofniete)', () => {
  const s = stos([
    ruch(10, G1, 'a', 'b'),
    cofnij(11, 10, G1, 'b', 'a'),
    ponow(12, 7, G2, 'x', 'y'),
  ], OKNO);
  assert.deepEqual(s.niespojne, [12]);
  assert.equal(s.doPonowienia, null);
  assert.deepEqual(s.doCofniecia, { glowa: G2, trzyma: 12, wroc_na: 'x' });
});

test('ST13: cofnij.akt:X, gdzie X trzyma wpis innej glowy: niespojne, wpis tamtej glowy zostaje, akt liczy sie jak zwykly', () => {
  const s = stos([
    ruch(1, G1, null, 'a'),
    ruch(2, G2, null, 'b'),
    cofnij(3, 1, G2, 'b', 'auto'),
  ], OKNO);
  assert.deepEqual(s.niespojne, [3]);
  assert.deepEqual(s.doCofniecia, { glowa: G2, trzyma: 3, wroc_na: 'b' });
  assert.deepEqual(s.glebokosc, { cofnij: 3, ponow: 0 }, 'wpis ruchu 1 nie zostal zdjety');
  assert.equal(s.doPonowienia, null);
});

test('ST13b: ponow.akt:U, gdzie U trzyma wpis innej glowy: tez niespojne i zwykly ruch', () => {
  const s = stos([
    ruch(1, G1, null, 'a'),
    cofnij(2, 1, G1, 'a', 'auto'),
    ponow(3, 2, G2, 'x', 'y'),
  ], OKNO);
  assert.deepEqual(s.niespojne, [3]);
  assert.deepEqual(s.doCofniecia, { glowa: G2, trzyma: 3, wroc_na: 'x' });
  assert.equal(s.doPonowienia, null, 'zwykly akt czysci kupke cofnietych');
});

test('ST14: op cofnij.akt:2.p jest zwyklym ruchem, nie cofnieciem', () => {
  const s = stos([
    ruch(1, G1, null, 'a'),
    ruch(2, G1, 'a', 'b'),
    { nr: 3, op: 'cofnij.akt:2.p', glowa: G1, zapis: 'c', z: 'b' },
  ], OKNO);
  assert.deepEqual(s.niespojne, []);
  assert.deepEqual(s.doCofniecia, { glowa: G1, trzyma: 3, wroc_na: 'b' });
  assert.deepEqual(s.glebokosc, { cofnij: 3, ponow: 0 });
});

test('ST14b: ops cofnij.akt:2x, cofnij.akt: i ponow.akt:2.p tez sa zwyklymi ruchami (pelny wzor, nie przedrostek)', () => {
  for (const op of ['cofnij.akt:2x', 'cofnij.akt:', 'cofnij.akt:2.z', 'ponow.akt:2.p', 'ponow.akt:2x', 'xcofnij.akt:2']) {
    const s = stos([
      ruch(1, G1, null, 'a'),
      ruch(2, G1, 'a', 'b'),
      { nr: 3, op, glowa: G1, zapis: 'c', z: 'b' },
    ], OKNO);
    assert.deepEqual(s.niespojne, [], op);
    assert.deepEqual(s.glebokosc, { cofnij: 3, ponow: 0 }, op);
    assert.equal(s.doCofniecia.trzyma, 3, op);
  }
});

test('ST15: obciete okno, cel rowny numerowi pierwszego aktu okna, wpisu nie ma: niespojne z numerem aktu', () => {
  const s = stos([
    cofnij(10, 5, G1, 'b', 'a'), // pierwszy akt okna: cofniecie ruchu sprzed okna
    cofnij(11, 10, G2, 'x', 'y'), // cel 10 nie jest mniejszy od 10, a wpis 10 jest innej glowy
  ], OBCIETE);
  assert.deepEqual(s.niespojne, [11]);
  assert.deepEqual(s.doCofniecia, { glowa: G2, trzyma: 11, wroc_na: 'x' });
});

test('ST16: stos(akty) bez drugiego argumentu dziala jak z obciete: false (dane z ST11b)', () => {
  const akty = [ruch(10, G1, 'a', 'b'), cofnij(11, 5, G2, 'x', 'w')];
  const s = stos(akty);
  assert.deepEqual(s.niespojne, [11]);
  assert.deepEqual(s, stos(akty, OKNO));
  assert.deepEqual(stos([]).niespojne, []);
});
