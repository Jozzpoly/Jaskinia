// Testy E1: scenariusz części, propozycji i przypiętego świata oraz znane bóle zapisu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, versionId } from './versions.mjs';

const OWNER = { who: 'autor', role: 'owner' };
const AGENT = { who: 'agent', role: 'agent' };
const PART = 'część:zawieszenie-przód';

function startPart(s) {
  s.edit(PART, 'skok', 0.25, OWNER);
  s.edit(PART, 'sztywność', 40, OWNER);
  s.edit(PART, 'tłumienie.dobicie', 3, OWNER);
  return s.save(PART, OWNER, 'pierwsza wersja');
}

test('scenariusz: poprawka autora, propozycja agenta na starszej podstawie, świat na przypiętej wersji', () => {
  const s = new Store();
  const v1 = startPart(s);
  s.pin('świat:poligon', PART, v1, OWNER);

  // agent pracuje na v1 i zmienia tłumienie
  const p = s.propose(PART, v1, { skok: 0.25, sztywność: 40, tłumienie: { dobicie: 5 } }, AGENT, 'mniej dobijania');

  // w tym czasie autor poprawia sztywność i zapisuje v2
  s.edit(PART, 'sztywność', 55, OWNER);
  const v2 = s.save(PART, OWNER, 'twardziej');

  const ev = s.evaluate(p);
  assert.equal(ev.status, 'mergeable');
  assert.deepEqual(ev.changes, ['tłumienie.dobicie']);
  assert.deepEqual(ev.preview, { skok: 0.25, sztywność: 55, tłumienie: { dobicie: 5 } });

  // świat dalej jedzie na v1
  assert.equal(s.pinned('świat:poligon', PART), v1);

  const v3 = s.accept(p, OWNER);
  assert.notEqual(v3, v2);
  assert.equal(s.head(PART), v3);
  assert.equal(s.pinned('świat:poligon', PART), v1, 'przyjęcie propozycji nie przepina świata');

  s.pin('świat:poligon', PART, v3, OWNER);
  assert.equal(s.pinned('świat:poligon', PART), v3);
});

test('konflikt: obie strony zmieniły to samo pole; nic nie zostaje nadpisane po cichu', () => {
  const s = new Store();
  const v1 = startPart(s);
  const p = s.propose(PART, v1, { skok: 0.25, sztywność: 30, tłumienie: { dobicie: 3 } }, AGENT, 'miękcej');
  s.edit(PART, 'sztywność', 55, OWNER);
  const v2 = s.save(PART, OWNER);

  const ev = s.evaluate(p);
  assert.equal(ev.status, 'conflict');
  assert.deepEqual(ev.conflicts, [{ path: 'sztywność', base: '40', owner: '55', agent: '30' }]);
  assert.throws(() => s.accept(p, OWNER), /bez rozstrzygnięcia/);
  assert.equal(s.head(PART), v2, 'po nieudanym przyjęciu wersja autora bez zmian');

  const v3 = s.accept(p, OWNER, { 'sztywność': 48 });
  assert.equal(s.get(v3).content.sztywność, 48);
});

test('tożsamość z treści: cofnięcie i inna zmiana nie dają tej samej tożsamości co wcześniej', () => {
  const s = new Store();
  const v1 = startPart(s);
  s.edit(PART, 'skok', 0.3, OWNER);
  const v2 = s.save(PART, OWNER);
  s.load(PART, v1, OWNER);                 // cofnięcie do v1
  const back = s.save(PART, OWNER);
  assert.equal(back, v1, 'ta sama treść ma tę samą tożsamość');
  s.edit(PART, 'sztywność', 41, OWNER);    // inna zmiana niż w v2
  const v3 = s.save(PART, OWNER);
  assert.notEqual(v3, v2, 'licznik rewizji dałby tu ten sam numer co v2; treść daje inną tożsamość');
  // dziennik zachował kolejność wydarzeń, choć tożsamość wersji jest z treści
  assert.deepEqual(s.events.filter(e => e.type === 'save').map(e => e.to), [v1, v2, v1, v3]);
});

test('brak cichego zapisu: edycje zmieniają tylko szkic', () => {
  const s = new Store();
  const v1 = startPart(s);
  for (let i = 0; i < 50; i++) s.edit(PART, 'sztywność', 40 + i, OWNER);
  assert.equal(s.head(PART), v1);
  assert.equal(s.versions.size, 1);
  assert.equal(s.draft(PART).sztywność, 89);
});

test('wczytanie przywraca całą wersję, nie łata szkicu częściowo (ból częściowo wczytywanych presetów)', () => {
  const s = new Store();
  const v1 = startPart(s);
  s.edit(PART, 'sztywność', 99, OWNER);
  s.edit(PART, 'eksperyment.tarcie', 1.7, OWNER);   // pole, którego v1 nie ma
  s.load(PART, v1, OWNER);
  assert.deepEqual(s.draft(PART), s.get(v1).content);
});

test('werdykt dotyczy dokładnie jednej wersji; werdykty przodków są kontekstem', () => {
  const s = new Store();
  const v1 = startPart(s);
  s.edit(PART, 'skok', 0.4, OWNER);
  const v2 = s.save(PART, OWNER);
  s.verdict(v2, OWNER, 'FAIL', 'za miękko na kamieniach');
  s.edit(PART, 'sztywność', 60, OWNER);
  const v3 = s.save(PART, OWNER);
  const vf = s.verdictsFor(v3);
  assert.equal(vf.exact.length, 0);
  assert.equal(vf.ancestors.length, 1);
  assert.equal(vf.ancestors[0].kind, 'FAIL');
  assert.ok(s.ancestors(v3).has(v1));
});

test('granice ról: agent nie zapisuje, nie przyjmuje, nie przypina i nie daje PASS/FAIL', () => {
  const s = new Store();
  const v1 = startPart(s);
  s.edit(PART, 'skok', 1, AGENT);
  assert.throws(() => s.save(PART, AGENT), /Tylko właściciel/);
  const p = s.propose(PART, v1, { skok: 1 }, AGENT);
  assert.throws(() => s.accept(p, AGENT), /Tylko właściciel/);
  assert.throws(() => s.pin('świat', PART, v1, AGENT), /Tylko właściciel/);
  assert.throws(() => s.verdict(v1, AGENT, 'PASS'), /tylko właściciel/);
  s.verdict(v1, AGENT, 'notatka', 'sprawdziłem stabilność w 3 prędkościach');
});

test('przeniesienie między urządzeniami zachowuje tożsamości i przypięcia', () => {
  const s = new Store();
  const v1 = startPart(s);
  s.pin('świat:poligon', PART, v1, OWNER);
  const copy = Store.import(JSON.parse(JSON.stringify(s.export())));
  assert.equal(copy.head(PART), v1);
  assert.equal(copy.pinned('świat:poligon', PART), v1);
  assert.equal(versionId(PART, copy.get(v1).content), v1);
  const bad = s.export();
  bad.versions[0][1].content.skok = 9;
  assert.throws(() => Store.import(bad), /Uszkodzona/);
});

test('propozycja na aktualnej wersji przechodzi wprost', () => {
  const s = new Store();
  const v1 = startPart(s);
  const p = s.propose(PART, v1, { skok: 0.25, sztywność: 45, tłumienie: { dobicie: 3 } }, AGENT);
  assert.equal(s.evaluate(p).status, 'fast-forward');
  const v2 = s.accept(p, OWNER);
  assert.equal(s.get(v2).content.sztywność, 45);
});

test('zmiana struktury: autor zmienił gałąź, agent jej liść — to konflikt, nie cicha mieszanka', () => {
  const s = new Store();
  const v1 = startPart(s);
  const p = s.propose(PART, v1, { skok: 0.25, sztywność: 40, tłumienie: { dobicie: 4 } }, AGENT);
  s.edit(PART, 'tłumienie', 'liniowe', OWNER);
  s.save(PART, OWNER);
  const ev = s.evaluate(p);
  assert.equal(ev.status, 'conflict');
  assert.equal(ev.conflicts[0].path, 'tłumienie.dobicie');
});
