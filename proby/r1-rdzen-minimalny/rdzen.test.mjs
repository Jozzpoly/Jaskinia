// Testy R1: trzej różni konsumenci na tym samym rdzeniu, bez dopisywania do niego pojęć.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './rdzen.mjs';

const JOZZ = { who: 'jozz', role: 'owner' };
const OPUS = { who: 'opus', role: 'agent' };
const CODE = { who: 'opus-code', role: 'agent' };

// Moduł biurka: uwagi jako łańcuch; nowa uwaga wskazuje poprzednią głowę. Przy wyścigu dwóch kart: przebuduj i ponów.
function dodajUwage(r, tekst, kto, kontekst = []) {
  for (let proba = 0; proba < 5; proba++) {
    const poprzednia = r.glowa('uwagi:skrzynka');
    const id = r.zapisz('uwaga', { tekst }, kto, [...(poprzednia ? [poprzednia] : []), ...kontekst]);
    if (r.przesun('uwagi:skrzynka', poprzednia, id, kto).ok) return id;
  }
  throw new Error('nie udało się dodać uwagi');
}
const uwagi = r => { const out = []; let id = r.glowa('uwagi:skrzynka'); while (id) { const z = r.zapis(id); out.push(z.content.tekst); id = z.links.find(l => r.zapis(l)?.kind === 'uwaga'); } return out; };

test('trzej konsumenci: ustawienia, uwagi i próba agenta na jednym rdzeniu', () => {
  const r = new Rdzen();
  // ustawienia pojazdu: wersję zapisuje właściciel, agent tylko proponuje
  r.zalozGlowe('ustawienia:m6', 'wlasciciel', JOZZ);
  const v1 = r.zapisz('ustawienia', { suspensionHertz: 2.4, brakeTorque: 900 }, JOZZ);
  assert.equal(r.przesun('ustawienia:m6', null, v1, JOZZ, 'pierwsza wersja').ok, true);
  const prop = r.zapisz('propozycja', { suspensionHertz: 3.1, brakeTorque: 900 }, OPUS, [v1]);
  assert.throws(() => r.przesun('ustawienia:m6', v1, prop, OPUS), /nie może/);
  // uwaga właściciela przypięta do wersji ustawień
  r.zalozGlowe('uwagi:skrzynka', 'wspolna', JOZZ);
  dodajUwage(r, 'za miękko na hopkach', JOZZ, [v1]);
  // własna próba agenta: zmienia ją swobodnie, nikt inny nie może
  r.zalozGlowe('agent:opus-code/proba-7', 'agent:opus-code', CODE);
  const p1 = r.zapisz('proba', { stan: 'start' }, CODE);
  const p2 = r.zapisz('proba', { stan: 'wynik: 4 czerwone testy' }, CODE, [p1]);
  assert.equal(r.przesun('agent:opus-code/proba-7', null, p1, CODE).ok, true);
  assert.equal(r.przesun('agent:opus-code/proba-7', p1, p2, CODE).ok, true);
  assert.throws(() => r.przesun('agent:opus-code/proba-7', p2, p1, OPUS), /nie może/);
  assert.deepEqual(uwagi(r), ['za miękko na hopkach']);
});

test('dwie karty dodają uwagi naraz i żadna nie ginie ani nie wraca', () => {
  const r = new Rdzen();
  r.zalozGlowe('uwagi:skrzynka', 'wspolna', JOZZ);
  const stara = r.glowa('uwagi:skrzynka');                    // karta B pamięta stan sprzed zmian karty A
  dodajUwage(r, 'A: pierwsza', JOZZ);
  const idB = r.zapisz('uwaga', { tekst: 'B: zapis ze starego stanu' }, JOZZ, []);
  assert.equal(r.przesun('uwagi:skrzynka', stara, idB, JOZZ).ok, false, 'stara karta nie nadpisuje nowszego stanu');
  dodajUwage(r, 'B: po przebudowie', JOZZ);
  assert.deepEqual(uwagi(r), ['B: po przebudowie', 'A: pierwsza']);
});

test('ponowne spotkanie: dziennik mówi, co agent zrobił pod nieobecność właściciela', () => {
  const r = new Rdzen();
  r.zalozGlowe('agent:opus/noc', 'agent:opus', OPUS);
  const znacznik = r.dziennik().length;
  let prev = null;
  for (let i = 0; i < 20; i++) { const id = r.zapisz('proba', { krok: i }, OPUS, prev ? [prev] : []); r.przesun('agent:opus/noc', prev, id, OPUS, 'krok ' + i); prev = id; }
  const nowe = r.dziennik(znacznik);
  assert.equal(nowe.filter(e => e.typ === 'zapis').length, 20);
  assert.equal(nowe.filter(e => e.typ === 'przesun' && e.kto === 'opus').length, 20);
});

test('eksport i import zachowują tożsamości, a podrobiony zapis jest odrzucany', () => {
  const r = new Rdzen();
  r.zalozGlowe('ustawienia:m6', 'wlasciciel', JOZZ);
  const v1 = r.zapisz('ustawienia', { a: 1, 'b.c': 2 }, JOZZ);
  r.przesun('ustawienia:m6', null, v1, JOZZ);
  const r2 = Rdzen.importuj(r.eksport());
  assert.equal(r2.glowa('ustawienia:m6'), v1);
  assert.deepEqual(r2.zapis(v1).content, { a: 1, 'b.c': 2 });
  const zly = JSON.parse(r.eksport()); zly.zapisy[0].content.a = 999;
  assert.throws(() => Rdzen.importuj(JSON.stringify(zly)), /Zła tożsamość/);
});
