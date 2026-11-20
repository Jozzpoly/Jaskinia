// Granica jawności (20 XI 2026). Zasada 4: publikacja należy do właściciela. Stąd dwie rzeczy, których pilnują te sprawdziany:
// dawna wersja jest dla czytającego tylko wtedy, gdy mógł ją widzieć wtedy i może dziś (otwarcie obszaru nie odsłania jego
// wcześniejszej historii), a istniejąca rzecz wychodzi do szerszego grona tylko gestem właściciela. Każdy sprawdzian ma
// kontrolę drogi uczciwej: ta sama droga, która powinna przejść, przechodzi. Próby, z których to wyrosło: atak 6 na
// warianty (F1, F2, F5), we wspólnej pamięci agentów.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';

let n = 0;
const op = (p = 'j') => `ja-${p}-${String(++n).padStart(5, '0')}`;
const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };

async function swiat() {
  let t = Date.UTC(2026, 10, 20, 15, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const obszar = async (nazwa, widzi, ile_wolno = 'prowadzic', rodzic = undefined) => ok(await s.ruch('jozz', { op: op('obszar'), co: 'poloz', rodzaj: 'obszar/1', ...(rodzic ? { obszar: rodzic } : {}), cechy: { nazwa, ...(widzi ? { widzi } : {}), ile_wolno } })).rzecz;
  const zestaw = async (kto, ob, nazwa) => ok(await s.ruch(kto, { op: op('z'), co: 'poloz', rodzaj: 'zestaw/1', obszar: ob, cechy: { nazwa, wartosci: {} } })).rzecz;
  // zmiana w miejscu: ta sama rzecz, ten sam obszar, inne cechy
  const zmien = (kto, id, zm, dodatkowe = {}) => { const x = s.rzecz(id); return s.ruch(kto, { op: op('zm'), co: 'poloz', rzecz: id, wersja: x.wersja, rodzaj: x.rodzaj, obszar: x.obszar, cechy: { ...x.cechy, ...zm }, ...dodatkowe }); };
  const przenies = (kto, id, ob) => { const x = s.rzecz(id); return s.ruch(kto, { op: op('mv'), co: 'poloz', rzecz: id, wersja: x.wersja, rodzaj: x.rodzaj, obszar: ob, cechy: x.cechy }); };
  const pytaj = async (sciezka, kto) => (await obsluzSrodowisko(s, new Request('https://proba.example/api/srodowisko/' + sciezka, { headers: { 'x-kto': kto || '' } }))).json();
  return { r, s, obszar, zestaw, zmien, przenies, pytaj };
}

test('J1. otwarcie obszaru nie odsłania historii sprzed otwarcia; wersja bieżąca w chwili otwarcia zostaje widoczna także potem', async () => {
  const W = await swiat();
  const Z = await W.obszar('szkice', 'wlasciciel');
  const X = await W.zestaw('jozz', Z, 'SEKRET-ZE-SZKICU');
  const a1 = W.s.rzecz(X).wersja;
  ok(await W.zmien('jozz', X, { nazwa: 'do pokazania' }));
  const a2 = W.s.rzecz(X).wersja;
  assert.equal(W.s.dla(null).rzecz(X), null, 'kontrola: przed otwarciem zwiedzający nie widzi rzeczy');
  ok(await W.zmien('jozz', Z, { widzi: 'wszyscy' }));
  for (const kto of [null, 'agent-a']) {
    assert.equal(W.s.dla(kto).rzecz(X).cechy.nazwa, 'do pokazania', `kontrola: po otwarciu ${kto ?? 'zwiedzający'} widzi wersję bieżącą`);
    assert.equal(W.s.dla(kto).wersja(X, a1), null, `${kto ?? 'zwiedzający'} nie czyta wersji sprzed otwarcia`);
  }
  assert.equal(W.s.dla('jozz').wersja(X, a1).cechy.nazwa, 'SEKRET-ZE-SZKICU', 'właściciel czyta całą historię');
  const http = await W.pytaj(`wersja?id=${X}&akt=${a1}`, '');
  assert.deepEqual([http.ok, http.status], [false, 404], 'trasa pod adresem mówi to samo');
  // wersja, która była bieżąca w chwili otwarcia, została nim pokazana: po następnej zmianie dalej da się ją czytać
  ok(await W.zmien('jozz', X, { nazwa: 'trzecia' }));
  assert.equal(W.s.dla(null).wersja(X, a2).cechy.nazwa, 'do pokazania');
  assert.equal(W.s.dla(null).wersja(X, a1), null);
});

test('J2. to samo dla uczestnika i dla obszaru, który jawność dziedziczy po rodzicu albo dostaje ją z nowym rodzicem', async () => {
  const W = await swiat();
  const R = await W.obszar('rodzic', 'wlasciciel');
  const C = await W.obszar('dziecko', undefined, 'prowadzic', R);
  const X = await W.zestaw('jozz', C, 'SEKRET-W-DZIECKU');
  const a1 = W.s.rzecz(X).wersja;
  ok(await W.zmien('jozz', X, { nazwa: 'czysto' }));
  assert.equal(W.s.dla('agent-a').rzecz(X), null, 'kontrola: dziecko dziedziczy zamknięcie po rodzicu');
  ok(await W.zmien('jozz', R, { widzi: 'uczestnicy' }));
  assert.equal(W.s.dla('agent-a').rzecz(X).cechy.nazwa, 'czysto', 'kontrola: po otwarciu rodzica agent widzi rzecz w dziecku');
  assert.equal(W.s.dla('agent-a').wersja(X, a1), null, 'ale nie jej wersję sprzed otwarcia rodzica');
  assert.equal(W.s.dla(null).rzecz(X), null, 'zwiedzający dalej nie widzi nic');
  // obszar przepięty pod jawniejszego rodzica: to samo
  const T = await W.obszar('tylko moje', 'wlasciciel'), U = await W.obszar('wspolne', 'uczestnicy');
  const D = await W.obszar('wedrowny', undefined, 'prowadzic', T);
  const Y = await W.zestaw('jozz', D, 'SEKRET-PRZED-PRZEPIECIEM');
  const b1 = W.s.rzecz(Y).wersja;
  ok(await W.zmien('jozz', Y, { nazwa: 'po sprzątaniu' }));
  ok(await W.przenies('jozz', D, U));
  assert.equal(W.s.dla('agent-a').rzecz(Y).cechy.nazwa, 'po sprzątaniu');
  assert.equal(W.s.dla('agent-a').wersja(Y, b1), null);
});

test('J3. cofnięcie nie wynosi treści sprzed otwarcia: agent takiej wersji nie ma, właściciel potwierdza publikację', async () => {
  const W = await swiat();
  const Z = await W.obszar('szkice', 'wlasciciel');
  const X = await W.zestaw('jozz', Z, 'SEKRET');
  const a1 = W.s.rzecz(X).wersja;
  ok(await W.zmien('jozz', X, { nazwa: 'do pokazania' }));
  ok(await W.zmien('jozz', Z, { widzi: 'uczestnicy' }));
  const wprost = await W.s.ruch('agent-a', { op: op('cof'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja, do: a1 });
  assert.deepEqual([wprost.ok, wprost.status], [false, 404], 'wersja sprzed otwarcia nie istnieje dla agenta');
  const poprzednia = await W.s.ruch('agent-a', { op: op('cof'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja });
  assert.deepEqual([poprzednia.ok, poprzednia.status], [false, 409]);
  const bez = await W.s.ruch('jozz', { op: op('cof'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja, do: a1 });
  assert.deepEqual([bez.ok, bez.status, bez.potwierdz], [false, 409, 'publikuj'], 'właściciel dostaje pytanie, nie cichy skutek');
  assert.equal(W.s.dla('agent-a').rzecz(X).cechy.nazwa, 'do pokazania');
  ok(await W.s.ruch('jozz', { op: op('cof'), co: 'cofnij', rzecz: X, wersja: W.s.rzecz(X).wersja, do: a1, publikuj: true }));
  assert.equal(W.s.dla('agent-a').rzecz(X).cechy.nazwa, 'SEKRET', 'po jawnym potwierdzeniu treść wraca');
  // kontrola drogi uczciwej: w obszarze, którego jawność się nie zmieniała, cofnięcie nie pyta o nic
  const U = await W.obszar('wspolny', 'uczestnicy');
  const Y = await W.zestaw('agent-a', U, 'pierwsza');
  ok(await W.zmien('agent-a', Y, { nazwa: 'druga' }));
  assert.equal(ok(await W.s.ruch('agent-a', { op: op('cof'), co: 'cofnij', rzecz: Y, wersja: W.s.rzecz(Y).wersja })).skutek, 'cofniete');
  assert.equal(W.s.rzecz(Y).cechy.nazwa, 'pierwsza');
});

test('J4. cofnięcie gestu sprzed otwarcia obszaru pyta o publikację; gest w obszarze o stałej jawności cofa się bez pytania', async () => {
  const W = await swiat();
  const Z = await W.obszar('szkice', 'wlasciciel');
  const X = await W.zestaw('jozz', Z, 'SEKRET');
  ok(await W.zmien('jozz', X, { nazwa: 'do pokazania' }, { gest: 'gest-ukryty-01' }));
  ok(await W.zmien('jozz', Z, { widzi: 'wszyscy' }));
  const bez = await W.s.ruch('jozz', { op: op('cg'), co: 'cofnij-gest', cofany: 'gest-ukryty-01' });
  assert.deepEqual([bez.ok, bez.status, bez.potwierdz], [false, 409, 'publikuj']);
  assert.equal(W.s.dla(null).rzecz(X).cechy.nazwa, 'do pokazania');
  const U = await W.obszar('wspolny', 'uczestnicy');
  const Y = await W.zestaw('jozz', U, 'pierwsza');
  ok(await W.zmien('jozz', Y, { nazwa: 'druga' }, { gest: 'gest-jawny-001' }));
  assert.equal(ok(await W.s.ruch('jozz', { op: op('cg'), co: 'cofnij-gest', cofany: 'gest-jawny-001' })).skutek, 'cofniety-gest');
  assert.equal(W.s.rzecz(Y).cechy.nazwa, 'pierwsza');
});

test('J5. układ widoku z chwili, gdy jego obszar był zamknięty, nie jest do odczytania po otwarciu; układ z chwili po otwarciu jest', async () => {
  const W = await swiat();
  const Z = await W.obszar('pracownia', 'wlasciciel');
  const widok = ok(await W.s.ruch('jozz', { op: op('w'), co: 'poloz', rodzaj: 'widok/1', obszar: Z, cechy: { nazwa: 'Układanka' } })).rzecz;
  const X = await W.zestaw('jozz', Z, 'rzecz w układzie');
  ok(await W.s.ruch('jozz', { op: op('m'), co: 'poloz', rodzaj: 'miejsce/1', wersja: 'dowolna', cechy: { widok, rzecz: X, x: 10, y: 20 } }));
  const wtedy = W.s.ostatniNr();
  ok(await W.zmien('jozz', Z, { widzi: 'wszyscy' }));
  const potem = W.s.ostatniNr();
  assert.equal(W.s.widokNa(widok, wtedy).length, 1, 'kontrola: właściciel czyta układ z tamtej chwili');
  assert.equal(W.s.dla(null).widokNa(widok, wtedy).length, 0, 'zwiedzający nie czyta układu sprzed otwarcia');
  assert.equal(W.s.dla(null).widokNa(widok, potem).length, 1, 'kontrola: układ z chwili po otwarciu jest do odczytania');
});

test('J6. historia rzeczy nie podaje odcisków treści nikomu poza właścicielem', async () => {
  const W = await swiat();
  const T = await W.obszar('tylko moje', 'wlasciciel'), P = await W.obszar('jawne', 'wszyscy');
  const X = await W.zestaw('jozz', T, 'tajna nazwa');
  ok(await W.przenies('jozz', X, P));
  for (const kto of ['', 'agent-a']) {
    const d = await W.pytaj('rzecz?id=' + X, kto);
    assert.equal(d.ok, true);
    assert.equal(d.historia.length, 2, 'że akty były, widać');
    assert.ok(d.historia.every((h) => !('zapis' in h)), `historia bez odcisków (${kto || 'zwiedzający'})`);
    assert.ok(d.historia.every((h) => Number.isInteger(h.akt) && Number.isInteger(h.numer)));
  }
  const w = await W.pytaj('rzecz?id=' + X, 'jozz');
  assert.ok(w.historia.every((h) => typeof h.zapis === 'string'), 'kontrola: właściciel dostaje odciski');
});

test('J7. zwykłe położenie, które przenosi istniejącą rzecz do szerszego grona, uczestnikowi robi się propozycją, a jej przyjęcie pyta o publikuj; nowa rzecz i zmiana w miejscu idą jak dotąd', async () => {
  const W = await swiat();
  const U = await W.obszar('wspolne', 'uczestnicy'), P = await W.obszar('jawne', 'wszyscy');
  const X = await W.zestaw('jozz', U, 'TRESC-DLA-UCZESTNIKOW');
  const pr = ok(await W.przenies('agent-a', X, P));
  assert.equal(pr.skutek, 'propozycja');
  assert.equal(W.s.rzecz(pr.propozycja).cechy.wymaga, 'wlasciciel');
  assert.equal(W.s.dla(null).rzecz(X), null, 'rzecz nie wyszła');
  const bez = await W.s.ruch('jozz', { op: op('prz'), co: 'przyjmij', propozycja: pr.propozycja });
  assert.deepEqual([bez.ok, bez.status, bez.potwierdz], [false, 409, 'publikuj']);
  assert.equal(ok(await W.s.ruch('jozz', { op: op('prz'), co: 'przyjmij', propozycja: pr.propozycja, publikuj: true })).skutek, 'przyjeta');
  assert.ok(W.s.dla(null).rzecz(X), 'po jawnym przyjęciu rzecz jest jawna');
  // także własną rzecz agent wynosi tylko przez właściciela, tak samo jak przy kopii
  const Y = await W.zestaw('agent-a', U, 'rzecz agenta');
  assert.equal(ok(await W.przenies('agent-a', Y, P)).skutek, 'propozycja');
  // kontrole drogi uczciwej: nowa rzecz w obszarze jawnym, zmiana w miejscu, przeniesienie w dół i gest właściciela wprost
  const N = ok(await W.s.ruch('agent-a', { op: op('n'), co: 'poloz', rodzaj: 'zestaw/1', obszar: P, cechy: { nazwa: 'pisze agent', wartosci: {} } }));
  assert.equal(N.skutek, 'polozone');
  assert.equal(ok(await W.zmien('agent-a', N.rzecz, { nazwa: 'pisze agent dalej' })).skutek, 'polozone');
  assert.equal(ok(await W.przenies('agent-a', N.rzecz, U)).skutek, 'polozone', 'w dół bez pytania');
  const V = await W.zestaw('jozz', U, 'gest właściciela');
  assert.equal(ok(await W.przenies('jozz', V, P)).skutek, 'polozone', 'właściciel przenosi wprost: to jego gest');
});
