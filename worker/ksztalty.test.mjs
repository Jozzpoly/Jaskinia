// Ksztalty: tu tylko funkcje o op (docs/krok-1-umowa.md, 5.1 i zasada 3) oraz przypadek KS13.
// Reszta ksztalty.mjs ma swoj osobny plik sprawdzianow w innej paczce.
// Po co: kropka i dwukropek sa zastrzezone dla czynnosci zlozonych serwera, wiec op klienta ich nie moze miec,
// a rozpoznanie cofniecia idzie pelnym wzorem, zeby op klienta z zewnatrz nie podszyl sie pod cofniecie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opKlienta, opPary, opCofniecia, opPonowienia, rozbierzOp } from './ksztalty.mjs';

test('KS13: opKlienta odrzuca kropke i dwukropek', () => {
  assert.equal(opKlienta('g-aaaa0001.p'), false);
  assert.equal(opKlienta('g-aaaa.0001'), false);
  assert.equal(opKlienta('cofnij.akt:2'), false);
  assert.equal(opKlienta('ponow.akt:2'), false);
  assert.equal(opKlienta('abcdefgh:1'), false);
  assert.equal(opKlienta('abcdefgh.'), false);
});

test('KS13b: rozbierzOp("cofnij.akt:2.p") mowi zwykly', () => {
  assert.equal(rozbierzOp('cofnij.akt:2.p').rodzaj, 'zwykly');
});

test('KS13c: opKlienta przyjmuje dobre op i trzyma granice dlugosci 8 i 100', () => {
  assert.equal(opKlienta('g-aaaa0001'), true);
  assert.equal(opKlienta('ABCdef_-09'), true);
  assert.equal(opKlienta('a'.repeat(8)), true);
  assert.equal(opKlienta('a'.repeat(7)), false);
  assert.equal(opKlienta('a'.repeat(100)), true);
  assert.equal(opKlienta('a'.repeat(101)), false);
});

test('KS13d: opKlienta odrzuca inne znaki i nie-teksty, zamiast rzucac wyjatek', () => {
  for (const zle of ['abcdefg h', 'abcdefgh\n', 'abcdefgh/1', 'zażółć-gęślą', '', null, undefined, 12345678, {}, ['abcdefgh']]) {
    assert.equal(opKlienta(zle), false, JSON.stringify(zle));
  }
});

test('KS13e: opPary daje op zapisu z koncowka .z i op przesuniecia z koncowka .p, oba zwykle dla rozbierzOp, oba zastrzezone przed klientem', () => {
  const p = opPary('g-aaaa0001');
  assert.deepEqual(p, { z: 'g-aaaa0001.z', p: 'g-aaaa0001.p' });
  assert.equal(rozbierzOp(p.z).rodzaj, 'zwykly');
  assert.equal(rozbierzOp(p.p).rodzaj, 'zwykly');
  assert.equal(opKlienta(p.z), false);
  assert.equal(opKlienta(p.p), false);
});

test('KS13f: opCofniecia i opPonowienia budowane z numeru aktu, rozbierzOp odczytuje je z powrotem', () => {
  assert.equal(opCofniecia(7), 'cofnij.akt:7');
  assert.equal(opPonowienia(12), 'ponow.akt:12');
  const c = rozbierzOp(opCofniecia(7));
  const w = rozbierzOp(opPonowienia(12));
  assert.equal(c.rodzaj, 'cofnij');
  assert.equal(c.akt, 7);
  assert.equal(w.rodzaj, 'ponow');
  assert.equal(w.akt, 12);
  assert.equal(opKlienta(opCofniecia(7)), false, 'cofniecia nie da sie podszyc op klienta');
  assert.equal(opKlienta(opPonowienia(12)), false);
});

test('KS13g: rozbierzOp rozpoznaje pelnym wzorem: warianty z doczepka albo bez numeru to zwykle op', () => {
  for (const op of [
    'cofnij.akt:2x', 'cofnij.akt:2.p', 'cofnij.akt:2.z', 'cofnij.akt:', 'cofnij.akt:-2', 'cofnij.akt:2\n',
    'xcofnij.akt:2', ' cofnij.akt:2', 'cofnij.akt2', 'cofnij:2',
    'ponow.akt:2x', 'ponow.akt:2.p', 'ponow.akt:', 'xponow.akt:2',
    'g-aaaa0001.p', 'zwykle-op-1',
  ]) {
    assert.equal(rozbierzOp(op).rodzaj, 'zwykly', JSON.stringify(op));
  }
});

test('KS13h: cofniecie i ponowienie nie mylą sie ze soba', () => {
  assert.equal(rozbierzOp('cofnij.akt:5').rodzaj, 'cofnij');
  assert.equal(rozbierzOp('ponow.akt:5').rodzaj, 'ponow');
  assert.equal(rozbierzOp('cofnij.akt:123456').akt, 123456);
});

test('KS14: rozbierzOp dla wejscia, ktore nie jest tekstem, daje zwykly z akt: null i nie rzuca wyjatku', () => {
  for (const wejscie of [undefined, null, 7, {}]) {
    assert.deepEqual(rozbierzOp(wejscie), { rodzaj: 'zwykly', akt: null });
  }
});

test('KS14b: opCofniecia i opPonowienia dla wartosci, ktora nie jest dodatnia liczba calkowita, zwracaja null', () => {
  for (const zle of [0, -1, 1.5, '7', NaN, null]) {
    assert.equal(opCofniecia(zle), null, String(zle));
    assert.equal(opPonowienia(zle), null, String(zle));
  }
});

test('KS14c: opPary tylko dokleja koncowki i niczego nie sprawdza', () => {
  assert.deepEqual(opPary('a.b:c'), { z: 'a.b:c.z', p: 'a.b:c.p' });
});

test('KS15: numery z zerami wiodacymi, zero i 16 cyfr w op to zwykle op', () => {
  for (const op of ['cofnij.akt:007', 'cofnij.akt:0', 'ponow.akt:01', 'ponow.akt:0', 'cofnij.akt:1234567890123456', 'ponow.akt:1234567890123456']) {
    assert.deepEqual(rozbierzOp(op), { rodzaj: 'zwykly', akt: null }, op);
  }
});

test('KS15b: symetria budowania i rozpoznania na granicy 15 cyfr', () => {
  assert.equal(opCofniecia(1234567890123456), null);
  assert.equal(opPonowienia(1234567890123456), null);
  const op = opCofniecia(999999999999999);
  assert.equal(typeof op, 'string');
  assert.deepEqual(rozbierzOp(op), { rodzaj: 'cofnij', akt: 999999999999999 });
  assert.deepEqual(rozbierzOp(opPonowienia(999999999999999)), { rodzaj: 'ponow', akt: 999999999999999 });
});

test('KS15c: akt jest liczba, nie tekstem, a dla zwyklego op dokladnie null', () => {
  assert.equal(typeof rozbierzOp('cofnij.akt:7').akt, 'number');
  assert.equal(typeof rozbierzOp('ponow.akt:7').akt, 'number');
  assert.deepEqual(rozbierzOp('g-aaaa0001.p'), { rodzaj: 'zwykly', akt: null });
});
