// Kontrprzykłady dla rdzenia E1 — niezależna falsyfikacja (Opus Code, 4 XI 2026).
//
// Te testy opisują zachowanie, które rdzeń POWINIEN mieć. Dziś część z nich jest czerwona.
// Są celowo zapisane jako wymagania, nie jako zapis obecnego zachowania: czerwony test
// jest dowodem, że próba E1 nie jest jeszcze gotowa na dane autorskie o dowolnym kształcie.
//
// Źródło problemu: `flatten` skleja ścieżkę kropką, a `setPath` rozcina ją po kropce.
// Nazwa pola zawierająca kropkę jest więc nierozróżnialna od zagnieżdżenia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, diff, versionId, Store } from './versions.mjs';

const owner = { who: 'autor', role: 'owner' };
const agent = { who: 'agent', role: 'agent' };

test('K1: pole z kropką w nazwie nie jest tym samym co zagnieżdżenie', () => {
  const kropka = { 'a.b': 1 };
  const gniazdo = { a: { b: 1 } };
  // versionId rozróżnia je poprawnie (kanonizacja patrzy na strukturę)...
  assert.notEqual(versionId('t', kropka), versionId('t', gniazdo));
  // ...ale flatten/diff już nie. To rozjazd wewnątrz jednego rdzenia.
  assert.notDeepEqual([...flatten(kropka)], [...flatten(gniazdo)], 'flatten gubi różnicę struktur');
  assert.notEqual(diff(kropka, gniazdo).size, 0, 'diff pokazuje zmianę tam, gdzie treść jest inna');
});

test('K2: propozycja zmieniająca strukturę nie jest uznawana za brak zmiany', () => {
  const s = new Store();
  s.edit('rzecz', 'a.b', 1, owner);        // zapis przez ścieżkę -> powstaje {a:{b:1}}
  const v1 = s.save('rzecz', owner);
  // agent proponuje treść o tej samej "płaskiej" postaci, ale innej strukturze
  const pid = s.propose('rzecz', v1, { 'a.b': 1 }, agent, 'pole z kropką w nazwie');
  const ev = s.evaluate(pid);
  assert.notEqual(ev.status, 'no-op', 'inna treść nie może być raportowana jako brak zmiany');
});

test('K3: przyjęcie propozycji nie przebudowuje po cichu struktury autora', () => {
  const s = new Store();
  // autor ma pole, którego nazwa zawiera kropkę (np. nazwa pliku, wersja "1.0", klucz "a.b")
  const base = s.propose('rzecz', null, { 'plik.txt': 'stare' }, owner, 'podstawa');
  s.accept(base, owner);
  const przed = s.get(s.head('rzecz')).content;
  assert.deepEqual(przed, { 'plik.txt': 'stare' }, 'zapis zachowuje nazwę pola z kropką');
});

test('K4: treść nie będąca obiektem zachowuje się przy zapisie i wczytaniu', () => {
  const s = new Store();
  const pid = s.propose('skalar', null, 42, owner, 'liczba jako treść rzeczy');
  s.accept(pid, owner);
  assert.equal(s.get(s.head('skalar')).content, 42, 'skalar przeżywa obieg propozycji');
});

test('K5: dwie rozłączne zmiany w tablicy nie muszą być konfliktem', () => {
  const s = new Store();
  const b = s.propose('lista', null, { xs: [1, 2, 3] }, owner, 'podstawa');
  s.accept(b, owner);
  const head = s.head('lista');
  const p1 = s.propose('lista', head, { xs: [1, 2, 3, 4] }, agent, 'dopisz na końcu');
  s.accept(p1, owner);
  const p2 = s.propose('lista', head, { xs: [0, 1, 2, 3] }, agent, 'dopisz na początku');
  const ev = s.evaluate(p2);
  // Tablica jest liściem (świadome uproszczenie README). Ten test mierzy jego cenę:
  // każda druga zmiana w tej samej tablicy wymaga ręcznego rozstrzygnięcia właściciela.
  assert.equal(ev.status, 'conflict');
  assert.deepEqual(ev.conflicts.map(c => c.path), ['xs']);
});
