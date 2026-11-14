// Kontrprzykłady dla rdzenia E1 — niezależna falsyfikacja (Opus Code, 4 XI 2026).
//
// Te testy opisują zachowanie, które rdzeń POWINIEN mieć. K1–K4 dziś nie przechodzą.
// Są celowo zapisane jako wymagania, nie jako zapis obecnego zachowania: nieprzechodzący
// test jest dowodem, że próba E1 nie jest gotowa na dane autorskie o dowolnym kształcie.
//
// Źródło problemu: `flatten` skleja ścieżkę kropką, a `setPath` rozcina ją po kropce.
// Nazwa pola zawierająca kropkę jest więc nierozróżnialna od zagnieżdżenia.
//
// DLACZEGO `todo`, A NIE CZERWONE CI:
// K1–K4 są oznaczone jako `todo` z zapisanym warunkiem zdjęcia tego oznaczenia. CI nie
// kłamie w żadną stronę: nie twierdzi, że rdzeń jest zdrowy (powód każdego `todo` jest
// w wyjściu testów), i nie twierdzi, że repo jest zepsute. Zdjęcie `todo` należy do
// naprawy modelu ścieżek, czyli do decyzji o fundamencie — nie do tej gałęzi.
//
// PUŁAPKA, KTÓREJ TU UNIKAMY (lekcja z historii projektów właściciela): oznaczenie
// wyjątku w teście potrafi zacząć CHRONIĆ wadę, zamiast ją zgłaszać. Dlatego K0 poniżej
// pilnuje tego pliku: każde `todo` musi mieć zapisany warunek zdjęcia, a żaden
// kontrprzykład nie może po cichu zniknąć. Usunięcie dowodu zapala CI na czerwono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flatten, diff, versionId, Store } from './versions.mjs';

// Warunek zdjęcia `todo` z K1–K4: ścieżka pola przestaje być łańcuchem z kropką
// i staje się listą segmentów, w `flatten`, `diff`, `overlaps` i `setPath` razem.
const WARUNEK = 'zdjąć po zmianie modelu ścieżek na listę segmentów (flatten/diff/overlaps/setPath razem)';

const owner = { who: 'autor', role: 'owner' };
const agent = { who: 'agent', role: 'agent' };

test('K1: pole z kropką w nazwie nie jest tym samym co zagnieżdżenie', { todo: WARUNEK }, () => {
  const kropka = { 'a.b': 1 };
  const gniazdo = { a: { b: 1 } };
  // versionId rozróżnia je poprawnie (kanonizacja patrzy na strukturę)...
  assert.notEqual(versionId('t', kropka), versionId('t', gniazdo));
  // ...ale flatten/diff już nie. To rozjazd wewnątrz jednego rdzenia.
  assert.notDeepEqual([...flatten(kropka)], [...flatten(gniazdo)], 'flatten gubi różnicę struktur');
  assert.notEqual(diff(kropka, gniazdo).size, 0, 'diff pokazuje zmianę tam, gdzie treść jest inna');
});

test('K2: propozycja zmieniająca strukturę nie jest uznawana za brak zmiany', { todo: WARUNEK }, () => {
  const s = new Store();
  s.edit('rzecz', 'a.b', 1, owner);        // zapis przez ścieżkę -> powstaje {a:{b:1}}
  const v1 = s.save('rzecz', owner);
  // agent proponuje treść o tej samej "płaskiej" postaci, ale innej strukturze
  const pid = s.propose('rzecz', v1, { 'a.b': 1 }, agent, 'pole z kropką w nazwie');
  const ev = s.evaluate(pid);
  assert.notEqual(ev.status, 'no-op', 'inna treść nie może być raportowana jako brak zmiany');
});

test('K3: przyjęcie propozycji nie przebudowuje po cichu struktury autora', { todo: WARUNEK }, () => {
  const s = new Store();
  // autor ma pole, którego nazwa zawiera kropkę (np. nazwa pliku, wersja "1.0", klucz "a.b")
  const base = s.propose('rzecz', null, { 'plik.txt': 'stare' }, owner, 'podstawa');
  s.accept(base, owner);
  const przed = s.get(s.head('rzecz')).content;
  assert.deepEqual(przed, { 'plik.txt': 'stare' }, 'zapis zachowuje nazwę pola z kropką');
});

test('K4: treść nie będąca obiektem zachowuje się przy zapisie i wczytaniu', { todo: WARUNEK }, () => {
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

// K0 nie jest kontrprzykładem. Pilnuje, żeby dowody z tego pliku nie zniknęły po cichu
// i żeby każde oznaczenie `todo` nosiło zapisany warunek swojego zdjęcia.
test('K0: dowody nie znikają po cichu, a każde todo ma warunek zdjęcia', () => {
  const zrodlo = readFileSync(new URL(import.meta.url), 'utf8');
  for (const id of ['K1', 'K2', 'K3', 'K4', 'K5']) {
    assert.ok(zrodlo.includes("test('" + id + ":"), `kontrprzykład ${id} musi zostać w pliku`);
  }
  const todos = zrodlo.match(/todo:\s*[A-Za-z_$][\w$]*/g) ?? [];
  assert.ok(todos.length > 0, 'jeśli nie ma już żadnego todo, usuń też K0 i ten komentarz');
  for (const t of todos) {
    assert.equal(t.replace(/todo:\s*/, ''), 'WARUNEK', 'todo musi wskazywać zapisany warunek zdjęcia');
  }
  assert.ok(WARUNEK.length > 20, 'warunek zdjęcia todo nie może być pusty ani ogólnikowy');
});
