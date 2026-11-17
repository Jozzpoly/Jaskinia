// Sprawdziany sprawdzianu spójności (17 XI 2026, druga linia). Każdy zaczyna się od stanu, który da się wytworzyć
// zwykłymi ruchami — nie od ręcznie zepsutej bazy, bo wtedy sprawdzałbym własną wyobraźnię, a nie środowisko.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { sprawdzSpojnosc } from './spojnosc.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 9, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  const widok = s.spis({ rodzaj: 'widok/1', limit: 5 }).find((w) => w.cechy.nazwa === 'Start');
  const projekt = await s.ruch('jozz', { op: 'spojnosc-projekt-1', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Próbny projekt' } });
  return { r, s, widok, projekt: projekt.rzecz, nowe: r.meta('obszar_nowe') };
}

test('SP1. świeżo zasiane Miejsce jest spójne, a wynik mówi, przy którym akcie liczył', async () => {
  const { s } = await swiat();
  const w = sprawdzSpojnosc(s);
  assert.equal(w.ile_niezgodnych, 0, JSON.stringify(w.niezgodne));
  assert.equal(w.urwane, false);
  assert.equal(w.akt, s.ostatniNr());
  assert.match(w.mowi, /żadna nie kłóci się ze swoim kształtem/);
});

test('SP2. przeniesienie rzeczy, od której bierze się obszar, zostawia sierotę — i sprawdzian ją nazywa', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  // widok wędruje do obszaru Nowe, a miejsce zostaje w głównym: dokładnie to, co zmierzyłem na podglądzie
  const m = await s.ruch('jozz', { op: 'spojnosc-miejsce-1', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.id, rzecz: projekt, x: 1, y: 2 } });
  assert.equal(m.ok, true, JSON.stringify(m));
  assert.equal(s.rzecz(m.rzecz).obszar, null);
  const p = await s.ruch('jozz', { op: 'spojnosc-widok-1', co: 'poloz', rodzaj: 'widok/1', rzecz: widok.id, obszar: nowe, wersja: 'dowolna', cechy: widok.cechy });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(s.rzecz(m.rzecz).obszar, null, 'miejsce nie poszło za widokiem: to jest ta cicha niespójność');

  const w = sprawdzSpojnosc(s);
  assert.equal(w.rodziny.lezy_z, 1, JSON.stringify(w.niezgodne));
  const z = w.niezgodne.find((x) => x.rzecz === m.rzecz);
  assert.ok(z, 'sierota jest wymieniona z identyfikatorem');
  assert.match(z.mowi, /mają leżeć razem/);
  assert.match(w.mowi, /1 kłóci się ze swoim kształtem/);
});

test('SP3. cofnij wkłada rzecz z powrotem w zły obszar, a sprawdzian widzi to tak samo', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  const p1 = await s.ruch('jozz', { op: 'spojnosc-widok-n1', co: 'poloz', rodzaj: 'widok/1', rzecz: widok.id, obszar: nowe, wersja: 'dowolna', cechy: widok.cechy });
  assert.equal(p1.ok, true, JSON.stringify(p1));
  const m = await s.ruch('jozz', { op: 'spojnosc-miejsce-n1', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.id, rzecz: projekt, x: 1, y: 2 } });
  assert.equal(s.rzecz(m.rzecz).obszar, nowe);
  // widok wraca do głównego, a potem właściciel poprawia miejsce zwykłym zapisem: lezy_z przelicza obszar
  await s.ruch('jozz', { op: 'spojnosc-widok-n2', co: 'poloz', rodzaj: 'widok/1', rzecz: widok.id, obszar: null, wersja: 'dowolna', cechy: widok.cechy });
  await s.ruch('jozz', { op: 'spojnosc-miejsce-n2', co: 'poloz', rodzaj: 'miejsce/1', rzecz: m.rzecz, wersja: 'dowolna', cechy: { widok: widok.id, rzecz: projekt, x: 3, y: 4 } });
  assert.equal(s.rzecz(m.rzecz).obszar, null, 'zwykły zapis naprawia obszar');
  assert.equal(sprawdzSpojnosc(s).ile_niezgodnych, 0, 'po naprawie jest czysto');

  const h = s.historia(m.rzecz);
  const c = await s.ruch('jozz', { op: 'spojnosc-cofniecie-1', co: 'cofnij', rzecz: m.rzecz, wersja: 'dowolna', do: h[0].akt });
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(s.rzecz(m.rzecz).obszar, nowe, 'cofnij omija lezy_z i wraca do starego obszaru');
  const w = sprawdzSpojnosc(s);
  assert.equal(w.rodziny.lezy_z, 1, JSON.stringify(w.niezgodne));
});

test('SP4. rzecz bez kształtu nie jest niezgodna, tylko policzona osobno', async () => {
  const { s } = await swiat();
  const r = await s.ruch('jozz', { op: 'spojnosc-bez-ksztaltu-1', co: 'poloz', rodzaj: 'notatka-bez-ksztaltu/1', cechy: { cokolwiek: 'tu jest' } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const w = sprawdzSpojnosc(s);
  assert.equal(w.ile_niezgodnych, 0);
  assert.equal(w.bez_ksztaltu, 1);
  assert.match(w.mowi, /poza jakimkolwiek kształtem/);
});

test('SP5. kształt dołożony po rzeczach może zastać je niezgodne — i to jest dokładnie to, czego nikt dziś nie widzi', async () => {
  const { s } = await swiat();
  await s.ruch('jozz', { op: 'spojnosc-potem-1', co: 'poloz', rodzaj: 'zapisek/1', cechy: { tresc: 'bez kształtu wolno wszystko' } });
  const k = await s.ruch('jozz', { op: 'spojnosc-potem-2', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'zapisek/1', opis: 'Zapisek z wymaganą datą.', cechy: { tresc: { typ: 'tekst', wymagana: true }, kiedy: { typ: 'czas', wymagana: true } } } });
  assert.equal(k.ok, true, 'kształt dla rodzaju, który jeszcze go nie miał, wchodzi bez sprawdzenia zgodności z leżącymi rzeczami');
  const w = sprawdzSpojnosc(s);
  assert.equal(w.rodziny.ksztalt, 1, JSON.stringify(w.niezgodne));
  assert.match(w.niezgodne[0].mowi, /kiedy/);
});

test('SP6. nieznane to nie zero: przebieg urwany na budżecie mówi to wprost i podaje, gdzie wrócić', async () => {
  const { s } = await swiat();
  const w = sprawdzSpojnosc(s, { ile: 3 });
  assert.equal(w.sprawdzone, 3);
  assert.equal(w.urwane, true);
  assert.equal(w.nastepne, 3);
  assert.match(w.mowi, /NIE jest całość/);
  const dalej = sprawdzSpojnosc(s, { pomin: w.nastepne, ile: 3 });
  assert.equal(dalej.sprawdzone, 3);
});

test('SP7. sprawdzian jest w spisie czasowników: kawałek bez wpisu w spisie nie jest skończony', async () => {
  const { s } = await swiat();
  const { czasowniki } = await import('./opis.mjs');
  const c = czasowniki(s).find((x) => x.nazwa === 'spojnosc');
  assert.ok(c, 'czasownik spojnosc stoi w spisie, więc agent znajdzie drzwi bez pytania nikogo');
  assert.match(c.ktoredy, /\/api\/srodowisko\/spojnosc/);
});
