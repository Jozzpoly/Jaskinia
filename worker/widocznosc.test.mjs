// Widoczność z danych (17 XI 2026, front B, Opus Code): ustawienie `widzi` obszaru przestaje być nazwą,
// a zaczyna być mechanizmem. Każdy sprawdzian pyta o to samo z DWÓCH stron: że widzący widzi i że niewidzący
// NIE widzi — bo mechanizm, który wszystko przepuszcza, zalicza połowę tych sprawdzianów.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 16, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  // trzy obszary o trzech ustawieniach widoczności, każdy z jedną rzeczą
  const obszar = async (nazwa, widzi, op) => {
    const o = await s.ruch('jozz', { op, co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa, ile_wolno: 'proponowac', widzi } });
    assert.equal(o.ok, true, JSON.stringify(o));
    const rz = await s.ruch('jozz', { op: op + '-rzecz', co: 'poloz', rodzaj: 'projekt/1', obszar: o.rzecz, cechy: { nazwa: 'Projekt ' + nazwa } });
    assert.equal(rz.ok, true, JSON.stringify(rz));
    return { obszar: o.rzecz, rzecz: rz.rzecz };
  };
  const jawny = await obszar('Jawny', 'wszyscy', 'widocznosc-jawny-1');
  const zamkniety = await obszar('Dla uczestnikow', 'uczestnicy', 'widocznosc-uczestnicy-1');
  const prywatny = await obszar('Tylko wlasciciel', 'wlasciciel', 'widocznosc-wlasciciel-1');
  return { s, jawny, zamkniety, prywatny };
}
const nazwy = (lista) => lista.map((x) => x.cechy && x.cechy.nazwa).sort();

test('W1. trzy role widzą trzy różne listy tego samego spisu', async () => {
  const { s } = await swiat();
  const f = { rodzaj: 'projekt/1' };
  assert.deepEqual(nazwy(s.dla('jozz').spis(f)), ['Projekt Dla uczestnikow', 'Projekt Jawny', 'Projekt Tylko wlasciciel']);
  assert.deepEqual(nazwy(s.dla('agent-probny').spis(f)), ['Projekt Dla uczestnikow', 'Projekt Jawny']);
  assert.deepEqual(nazwy(s.dla(null).spis(f)), ['Projekt Jawny']);
  // samo środowisko w środku dalej widzi siebie całe - inaczej przestałoby znać własne kształty i uczestników
  assert.equal(s.spis(f).length, 3);
});

test('W2. liczba też jest treścią: ile() nie zdradza rzeczy, których ten ktoś nie widzi', async () => {
  const { s } = await swiat();
  assert.equal(s.dla('jozz').ile({ rodzaj: 'projekt/1' }), 3);
  assert.equal(s.dla('agent-probny').ile({ rodzaj: 'projekt/1' }), 2);
  assert.equal(s.dla(null).ile({ rodzaj: 'projekt/1' }), 1);
});

test('W3. "nie ma" i "nie dla ciebie" brzmią tak samo, także pod adresem jednej rzeczy', async () => {
  const { s, prywatny } = await swiat();
  assert.ok(s.dla('jozz').rzecz(prywatny.rzecz), 'właściciel ją widzi');
  assert.equal(s.dla('agent-probny').rzecz(prywatny.rzecz), null, 'uczestnik dostaje to samo co przy nieistniejącej');
  assert.equal(s.dla(null).rzecz(prywatny.rzecz), null);
  assert.equal(s.dla('agent-probny').wersja(prywatny.rzecz, 2), null, 'dawna wersja też nie');
});

test('W4. obszar w obszarze bierze widoczność z rodzica, dopóki nie powie inaczej', async () => {
  const { s, prywatny } = await swiat();
  const w = await s.ruch('jozz', { op: 'widocznosc-wew-1', co: 'poloz', rodzaj: 'obszar/1', obszar: prywatny.obszar, cechy: { nazwa: 'W srodku prywatnego' } });
  const rz = await s.ruch('jozz', { op: 'widocznosc-wew-2', co: 'poloz', rodzaj: 'projekt/1', obszar: w.rzecz, cechy: { nazwa: 'Projekt wewnetrzny' } });
  assert.equal(s.dla('agent-probny').rzecz(rz.rzecz), null, 'dziedziczy zamknięcie po rodzicu');
  const o = await s.ruch('jozz', { op: 'widocznosc-wew-3', co: 'poloz', rodzaj: 'obszar/1', rzecz: w.rzecz, wersja: 'dowolna', cechy: { nazwa: 'W srodku prywatnego', widzi: 'wszyscy' } });
  assert.equal(o.ok, true, JSON.stringify(o));
  assert.ok(s.dla(null).rzecz(rz.rzecz), 'własne ustawienie bije dziedziczone');
});

test('W5. to, co na rzecz wskazuje, też jest treścią', async () => {
  const { s, jawny, prywatny } = await swiat();
  const k = await s.ruch('jozz', { op: 'widocznosc-ksztalt-1', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'notka/1', opis: 'Notka o rzeczy.', cechy: { o_czym: { typ: 'rzecz', wymagana: true }, tresc: { typ: 'tekst' } } } });
  assert.equal(k.ok, true, JSON.stringify(k));
  const n = await s.ruch('jozz', { op: 'widocznosc-notka-1', co: 'poloz', rodzaj: 'notka/1', obszar: prywatny.obszar, cechy: { o_czym: jawny.rzecz, tresc: 'prywatna uwaga' } });
  assert.equal(n.ok, true, JSON.stringify(n));
  assert.equal(s.dla('jozz').wskazujaNa(jawny.rzecz).length, 1);
  assert.equal(s.dla('agent-probny').wskazujaNa(jawny.rzecz).length, 0, 'odniesienie z zamkniętego obszaru zdradzałoby, że ono istnieje');
});

test('W6. drzwi: poza podglądem czytanie jest domyślnie zamknięte, a na podglądzie jawnie otwarte', async () => {
  const { s, prywatny, zamkniety } = await swiat();
  const zap = (sciezka, { kto = '', podglad = false } = {}) =>
    obsluzSrodowisko(s, new Request('https://przyklad.test' + sciezka, { headers: { 'x-kto': kto } }), { podglad });
  const spis = async (o) => (await (await zap('/api/srodowisko/spis?rodzaj=projekt/1', o)).json()).rzeczy.length;

  assert.equal(await spis({}), 1, 'poza podglądem bez klucza widać tylko obszar jawny');
  assert.equal(await spis({ kto: 'agent-probny' }), 2);
  assert.equal(await spis({ kto: 'jozz' }), 3);
  assert.equal(await spis({ podglad: true }), 2, 'na podglądzie czytający bez klucza jest uczestnikiem, bo klucz i tak stoi jawnie na stronie');

  const jednaRzecz = await zap('/api/srodowisko/rzecz?id=' + prywatny.rzecz);
  assert.equal((await jednaRzecz.json()).blad, 'nie ma takiej rzeczy', 'ta sama odpowiedź co przy nieistniejącej');
  assert.equal((await zap('/rzecz/' + zamkniety.rzecz)).status, 404, 'tekstowa strona rzeczy też');
  assert.equal((await zap('/rzecz/' + zamkniety.rzecz, { kto: 'agent-probny' })).status, 200);
});

test('W7. nowa trasa czytająca nie ominie okularów po cichu', async () => {
  // Ten sprawdzian nie pyta o zachowanie, tylko o kształt kodu - i robi to świadomie. Mechanizm widoczności stoi
  // na jednym założeniu: że KAŻDA trasa czytająca pracuje na widoku `w`, a nie na surowym `s`. Takie założenie
  // samo się nie pilnuje; za pół roku ktoś dopisze trasę z `s.` i nic nie zapali się na czerwono, bo wszystkie
  // dotychczasowe sprawdziany dalej przechodzą. Dlatego pilnuje go tekst.
  const { readFile } = await import('node:fs/promises');
  const zrodlo = await readFile(new URL('./srodowisko-http.mjs', import.meta.url), 'utf8');
  const od = zrodlo.indexOf("if (request.method === 'GET') {");
  const do_ = zrodlo.indexOf("if (request.method === 'POST') {");
  assert.ok(od > 0 && do_ > od, 'bloki GET i POST stoją tam, gdzie je ten sprawdzian szuka');
  const blok = zrodlo.slice(od, do_);
  const bezKomentarzy = blok.replace(/\/\/[^\n]*/g, '');
  const golo = [...bezKomentarzy.matchAll(/(?<![A-Za-z0-9_.])s\.[a-zA-Z_]+/g)].map((m) => m[0]);
  assert.deepEqual(golo, [], `trasa czytająca sięga po surowe środowisko zamiast po widok czytającego: ${golo.join(', ')}. Użyj w.<...> albo napisz tutaj, dlaczego ta jedna ma widzieć wszystko.`);
});
