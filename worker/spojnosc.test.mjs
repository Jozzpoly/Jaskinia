// Sprawdziany sprawdzianu spójności (17 XI 2026, druga linia). Każdy zaczyna się od stanu, który da się wytworzyć
// zwykłymi ruchami — nie od ręcznie zepsutej bazy, bo wtedy sprawdzałbym własną wyobraźnię, a nie środowisko.
// Dopisane tego samego dnia przez budowniczego (Fable): trzy drogi, które te sprawdziany znalazły (przeniesienie
// rzeczy wskazanej, cofnij, pierwszy kształt po rzeczach), są zamknięte u źródła, więc SP2, SP3 i SP5 pilnują teraz,
// żeby tak zostało. Jedyny wyjątek od reguły wyżej to SP8: skoro zwykłym ruchem nie da się już skrzywić spisu,
// krzywi go ręką, żeby było wiadomo, że oko nadal widzi.
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

test('SP2. przeniesienie rzeczy, od której bierze się obszar, nie zostawia sieroty: zależne idą za nią', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  const m = await s.ruch('jozz', { op: 'spojnosc-miejsce-1', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.id, rzecz: projekt, x: 1, y: 2 } });
  assert.equal(m.ok, true, JSON.stringify(m));
  assert.equal(s.rzecz(m.rzecz).obszar, null);
  // widok wędruje do obszaru Nowe: dokładnie ta droga, która 17 XI zostawiała miejsce w głównym
  const p = await s.ruch('jozz', { op: 'spojnosc-widok-1', co: 'poloz', rodzaj: 'widok/1', rzecz: widok.id, obszar: nowe, wersja: 'dowolna', cechy: widok.cechy });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(s.rzecz(m.rzecz).obszar, nowe, 'miejsce poszło za widokiem');
  const w = sprawdzSpojnosc(s);
  assert.equal(w.ile_niezgodnych, 0, JSON.stringify(w.niezgodne));
});

test('SP3. cofnij nie wkłada rzeczy w dawny obszar: liczy się to, gdzie rzecz wskazana leży dziś', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  const p1 = await s.ruch('jozz', { op: 'spojnosc-widok-n1', co: 'poloz', rodzaj: 'widok/1', rzecz: widok.id, obszar: nowe, wersja: 'dowolna', cechy: widok.cechy });
  assert.equal(p1.ok, true, JSON.stringify(p1));
  const m = await s.ruch('jozz', { op: 'spojnosc-miejsce-n1', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.id, rzecz: projekt, x: 1, y: 2 } });
  assert.equal(s.rzecz(m.rzecz).obszar, nowe);
  await s.ruch('jozz', { op: 'spojnosc-widok-n2', co: 'poloz', rodzaj: 'widok/1', rzecz: widok.id, obszar: null, wersja: 'dowolna', cechy: widok.cechy });
  assert.equal(s.rzecz(m.rzecz).obszar, null, 'miejsce wróciło z widokiem do głównego bez osobnego ruchu');
  await s.ruch('jozz', { op: 'spojnosc-miejsce-n2', co: 'poloz', rodzaj: 'miejsce/1', rzecz: m.rzecz, wersja: 'dowolna', cechy: { widok: widok.id, rzecz: projekt, x: 3, y: 4 } });
  const h = s.historia(m.rzecz);
  const c = await s.ruch('jozz', { op: 'spojnosc-cofniecie-1', co: 'cofnij', rzecz: m.rzecz, wersja: 'dowolna', do: h[0].akt });
  assert.equal(c.ok, true, JSON.stringify(c));
  const po = s.rzecz(m.rzecz);
  assert.deepEqual([po.cechy.x, po.cechy.y], [1, 2], 'wróciła treść dawnej wersji');
  assert.equal(po.obszar, null, 'ale obszar jest dzisiejszym obszarem widoku, nie tym z dnia tamtej wersji');
  assert.equal(sprawdzSpojnosc(s).ile_niezgodnych, 0);
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

test('SP5. pierwszy kształt rodzaju, pod którym leżą już rzeczy, ma je opisywać: inaczej jest odbijany ze zdaniem', async () => {
  const { s } = await swiat();
  const z = await s.ruch('jozz', { op: 'spojnosc-potem-1', co: 'poloz', rodzaj: 'zapisek/1', cechy: { tresc: 'bez kształtu wolno wszystko' } });
  const ostry = { dla: 'zapisek/1', opis: 'Zapisek z wymaganą datą.', cechy: { tresc: { typ: 'tekst', wymagana: true }, kiedy: { typ: 'czas', wymagana: true } } };
  const k = await s.ruch('jozz', { op: 'spojnosc-potem-2', co: 'poloz', rodzaj: 'ksztalt/1', cechy: ostry });
  assert.equal(k.ok, false, 'kształt, którego nie przechodzi leżąca rzecz, nie wchodzi');
  assert.equal(k.status, 409);
  assert.match(k.blad, /leży już 1 rzeczy, a 1 z nich nie przechodzi tego kształtu/);
  assert.match(k.blad, /zapisek\/2/);
  assert.deepEqual(k.rzeczy, [z.rzecz]);
  // kształt, który opisuje to, co leży, wchodzi; a ostrzejszy idzie jako następne pokolenie
  const lagodny = { ...ostry, cechy: { tresc: { typ: 'tekst', wymagana: true }, kiedy: { typ: 'czas' } } };
  const k1 = await s.ruch('jozz', { op: 'spojnosc-potem-3', co: 'poloz', rodzaj: 'ksztalt/1', cechy: lagodny });
  assert.equal(k1.ok, true, JSON.stringify(k1));
  const k2 = await s.ruch('jozz', { op: 'spojnosc-potem-4', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { ...ostry, dla: 'zapisek/2' } });
  assert.equal(k2.ok, true, JSON.stringify(k2));
  const w = sprawdzSpojnosc(s);
  assert.equal(w.ile_niezgodnych, 0, JSON.stringify(w.niezgodne));
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

test('SP8. oko nadal widzi: spis skrzywiony ręką (poza drogami zapisu) jest nazwany, a wyrównanie go prostuje', async () => {
  const { r, s, widok, projekt, nowe } = await swiat();
  const m = await s.ruch('jozz', { op: 'spojnosc-reka-1', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.id, rzecz: projekt, x: 1, y: 2 } });
  // jedyny sprawdzian, który psuje spis ręką: zwykłym ruchem tego stanu nie da się już wytworzyć
  r.sql.exec(`UPDATE rzeczy SET obszar = ? WHERE id = ?`, nowe, m.rzecz);
  const w = sprawdzSpojnosc(s);
  assert.equal(w.rodziny.lezy_z, 1, JSON.stringify(w.niezgodne));
  assert.match(w.niezgodne.find((x) => x.rzecz === m.rzecz).mowi, /mają leżeć razem/);
  assert.equal(s.wyrownajZNatury(), 1, 'wyrównanie przenosi w spisie jedną rzecz');
  assert.equal(s.rzecz(m.rzecz).obszar, null);
  assert.equal(sprawdzSpojnosc(s).ile_niezgodnych, 0);
});
