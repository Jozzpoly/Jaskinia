// Sprawdziany położeń na Starcie po stronie Miejsca (17 XI 2026): rzecz rodzaju miejsce leży zawsze w obszarze
// swojego widoku, więc o tym, czy agent układa sam, czy proponuje, mówi ustawienie tego obszaru.
// Powód: na podglądzie agent próbny przesunął kartę ze skutkiem, bo jego położenie trafiło do obszaru Nowe
// (tam agenci prowadzą sami), a widok właściciela i tak je brał.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko, sprawdzKsztalt } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 9, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  const widok = s.spis({ rodzaj: 'widok/1', limit: 5 }).find((w) => w.cechy.nazwa === 'Start');
  const projekt = await s.ruch('jozz', { op: 'miejsce-test-projekt', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Próbny projekt' } });
  assert.equal(projekt.ok, true, JSON.stringify(projekt));
  return { r, s, widok, projekt: projekt.rzecz, nowe: r.meta('obszar_nowe') };
}
const poloz = (s, kto, op, cechy, dodatkowe = {}) => s.ruch(kto, { op, co: 'poloz', rodzaj: 'miejsce/1', cechy, ...dodatkowe });

test('M1. widok Start jest zasiany w obszarze głównym, a kształt miejsca mówi, że to układanie i że leży tam, gdzie widok', async () => {
  const { s, widok } = await swiat();
  assert.ok(widok, 'jest widok o nazwie Start');
  assert.equal(widok.obszar, null);
  const k = s.ksztaltDla('miejsce/1');
  assert.deepEqual([k.klucz, k.uklad, k.lezy_z], [['widok', 'rzecz'], true, 'widok']);
});

test('M2. właściciel kładzie rzecz ze skutkiem; drugie położenie tej samej rzeczy to nowa wersja tego samego miejsca', async () => {
  const { s, widok, projekt } = await swiat();
  const a = await poloz(s, 'jozz', 'miejsce-test-a1', { widok: widok.id, rzecz: projekt, x: 100, y: 200 });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.skutek, 'polozone');
  assert.equal(s.rzecz(a.rzecz).obszar, null, 'miejsce leży w obszarze widoku');
  const b = await poloz(s, 'jozz', 'miejsce-test-a2', { widok: widok.id, rzecz: projekt, x: 300, y: 50, skala: 1.5 }, { wersja: 'dowolna' });
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(b.rzecz, a.rzecz, 'klucz (widok, rzecz) trafia w to samo miejsce');
  const m = s.rzecz(a.rzecz);
  assert.deepEqual([m.cechy.x, m.cechy.y, m.cechy.skala, m.numer, m.zmienil], [300, 50, 1.5, 2, 'jozz']);
  assert.equal(s.historia(a.rzecz).length, 2, 'historia mówi, kto i kiedy kładł');
});

test('M3. agent w obszarze, gdzie wolno mu tylko proponować: jego położenie czeka jako propozycja i nie trafia do obszaru Nowe', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  const w = await poloz(s, 'agent-probny', 'miejsce-test-agent-1', { widok: widok.id, rzecz: projekt, x: 9, y: 9 });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.skutek, 'propozycja', 'obszar główny pozwala agentom tylko proponować');
  assert.equal(s.spis({ rodzaj: 'miejsce/1', odlozone: 'razem' }).length, 0, 'położenie nie powstało');
  // próba położenia wprost w obszarze, w którym agent prowadzi sam, odbija się od drzwi
  const obok = await poloz(s, 'agent-probny', 'miejsce-test-agent-2', { widok: widok.id, rzecz: projekt, x: 9, y: 9 }, { obszar: nowe });
  assert.equal(obok.ok, false);
  assert.equal(obok.status, 400);
  assert.match(obok.blad, /leży zawsze w obszarze rzeczy z cechy widok/);
  // miejsce bez istniejącego widoku nie ma skąd wziąć obszaru
  const bez = await poloz(s, 'agent-probny', 'miejsce-test-agent-3', { widok: 'z'.repeat(26), rzecz: projekt, x: 1, y: 1 });
  assert.equal(bez.ok, false);
  assert.equal(bez.status, 400);
});

test('M4. gdy właściciel pozwoli agentom porządkować w obszarze widoku, agent układa sam, bo miejsce to układanie, nie treść', async () => {
  const { s, widok, projekt } = await swiat();
  const glowny = s.rzecz(s.r.meta('obszar_glowny'));
  const ust = await s.ruch('jozz', { op: 'miejsce-test-ustawienie', co: 'poloz', rzecz: glowny.id, wersja: glowny.wersja, rodzaj: glowny.rodzaj, cechy: { ...glowny.cechy, ile_wolno: 'porzadkowac' } });
  assert.equal(ust.ok, true, JSON.stringify(ust));
  const w = await poloz(s, 'agent-probny', 'miejsce-test-agent-4', { widok: widok.id, rzecz: projekt, x: 40, y: 60 });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.skutek, 'polozone');
  const m = s.rzecz(w.rzecz);
  assert.deepEqual([m.obszar, m.zmienil, m.cechy.x], [null, 'agent-probny', 40]);
  // ale treść (projekt) w tym samym obszarze agent dalej tylko proponuje
  const p = s.rzecz(projekt);
  const tresc = await s.ruch('agent-probny', { op: 'miejsce-test-agent-5', co: 'poloz', rzecz: p.id, wersja: p.wersja, rodzaj: p.rodzaj, cechy: { ...p.cechy, nazwa: 'Zmieniona nazwa' } });
  assert.equal(tresc.skutek, 'propozycja');
});

test('M5. lezy_z w kształcie: tylko wymagana cecha typu rzecz; zmiana tego ustawienia to zmiana praw, więc należy do właściciela', async () => {
  const dobry = { dla: 'x/1', opis: 'Rzecz, która leży tam, gdzie jej dom.', cechy: { dom: { typ: 'rzecz', wymagana: true }, n: { typ: 'tekst' } }, lezy_z: 'dom' };
  assert.deepEqual(sprawdzKsztalt(dobry), []);
  assert.ok(sprawdzKsztalt({ ...dobry, lezy_z: 'n' }).some((b) => /lezy_z/.test(b)), 'cecha tekstowa nie może być domem');
  assert.ok(sprawdzKsztalt({ ...dobry, lezy_z: 'nie-ma' }).some((b) => /lezy_z/.test(b)));
  assert.ok(sprawdzKsztalt({ ...dobry, cechy: { dom: { typ: 'rzecz' } } }).some((b) => /lezy_z/.test(b)), 'cecha musi być wymagana');
  const { s } = await swiat();
  const nowy = await s.ruch('agent-probny', { op: 'miejsce-test-ksztalt-1', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'notka-agenta/1', opis: 'próba', cechy: { dom: { typ: 'rzecz', wymagana: true } }, lezy_z: 'dom' } });
  assert.equal(nowy.ok, true, JSON.stringify(nowy));
  assert.equal(nowy.skutek, 'propozycja', 'agent nie ustala sam, pod jakim prawem leżą rzeczy rodzaju');
  const propozycja = s.spis({ rodzaj: 'propozycja/1', limit: 5 }).find((p) => p.cechy.rodzaj === 'ksztalt/1');
  assert.equal(propozycja.cechy.wymaga, 'wlasciciel', 'taką propozycję przyjmuje tylko właściciel');
  // ten sam kształt bez lezy_z agent dokłada sam (w obszarze Nowe agenci prowadzą): to lezy_z jest zmianą praw
  const zwykly = await s.ruch('agent-probny', { op: 'miejsce-test-ksztalt-2', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'notka-zwykla/1', opis: 'próba', cechy: { dom: { typ: 'rzecz', wymagana: true } } } });
  assert.equal(zwykly.skutek, 'polozone', JSON.stringify(zwykly));
});
