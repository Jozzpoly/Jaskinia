// Falsyfikator proweniencji dla szkicu rdzenia zapisów (docs/rdzen-zapisow-szkic.md).
//
// Pytanie postawił Menadżer 10 XI: szkic mówi, że zapis ma "autora i czas", a tożsamość
// bierze ze "skrótu rodzaju i treści". Jeśli dwóch agentów niezależnie zapisze identyczną
// treść, ten sam identyfikator nie może sam oznaczać obu aktów autorstwa. Menadżer nie
// twierdził, że to błąd — proweniencja mogłaby żyć osobno w dzienniku (punkt 3 szkicu) —
// i poprosił o jawny test. To jest ten test.
//
// Odpowiedź brzmi: NIE. Drugi identyczny zapis nie zostawia śladu nigdzie, także
// w dzienniku. Poniższe przypadki to pokazują, a na końcu są kalibracyjne przypadki
// PASS, żeby było widać, że test nie jest po prostu zepsuty.
//
// NIE PROPONUJĘ TU IMPLEMENTACJI. Każdy z przypadków F1-F6 jest spełnialny na kilka
// sposobów (dziennik zapisujący każdy akt; tożsamość obejmująca autora; podpisy).
// Wybór jest decyzją o fundamencie, a nie poprawką, więc należy do Jozza i do linii razem.
//
// Opus Code, 10 XI 2026, gałąź opus-code/r1-falsyfikator-proweniencji.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Rdzen } from './rdzen.mjs';

const JOZZ = { who: 'jozz', role: 'owner' };
const OPUS = { who: 'opus', role: 'agent' };
const CODE = { who: 'opus-code', role: 'agent' };
const ASTRA = { who: 'astra', role: 'agent' };

const aktyZapisu = (r, kind) => r.dziennik().filter(e => e.typ === 'zapis' && (!kind || e.kind === kind));

// ---------------------------------------------------------------- F1: pytanie Menadżera

test('F1: dwa identyczne zapisy, dwóch autorów — oba akty dają się odzyskać', () => {
  const r = new Rdzen();
  const trescA = { tekst: 'hamulce trzymają' };
  const idJozza = r.zapisz('uwaga', trescA, JOZZ);
  const idOpusa = r.zapisz('uwaga', { tekst: 'hamulce trzymają' }, OPUS);

  // Tożsamość z treści: ten sam identyfikator. To samo w sobie jest w porządku.
  assert.equal(idJozza, idOpusa, 'tożsamość bierze się z treści, więc id są równe (to nie jest wada)');

  // Wymóg: z rdzenia da się odczytać, że akty zapisu były DWA i czyje.
  // Spełnialne przez dziennik albo przez tożsamość obejmującą autora — nie przesądzam.
  const akty = aktyZapisu(r, 'uwaga');
  assert.equal(akty.length, 2, 'dwa akty zapisu muszą być odzyskiwalne, a nie zwinięte do jednego');
  assert.deepEqual(akty.map(e => e.kto).sort(), ['jozz', 'opus']);
});

// ------------------------------------------------- F2: autorstwo przypada pierwszemu

test('F2: treść zapisana później przez właściciela nie jest przypisywana agentowi', () => {
  const r = new Rdzen();
  r.zapisz('werdykt', { ocena: 'zdatne' }, OPUS);        // agent pierwszy
  const id = r.zapisz('werdykt', { ocena: 'zdatne' }, JOZZ); // właściciel to samo, później

  // Rekord jest zamrożony z `kto` pierwszego piszącego, na zawsze.
  assert.notEqual(r.zapis(id).kto, 'opus',
    'rekord nie może twierdzić, że to agent jest autorem werdyktu właściciela');
});

// --------------------------------------------------------------------- F3: brak czasu

test('F3: akt zapisu ma czas, bo szkic wymaga go w dwóch punktach', () => {
  const r = new Rdzen();
  r.zapisz('uwaga', { tekst: 'kiedy to było' }, JOZZ);
  const e = aktyZapisu(r)[0];

  // Szkic, punkt 1: zapis "ma treść, rodzaj, autora i czas".
  // Szkic, punkt 3: dziennik notuje "kto, kiedy, dlaczego".
  // W kodzie jest tylko licznik `n`, który porządkuje, ale nie datuje.
  assert.ok(Object.keys(e).some(k => /czas|kiedy|time|ts/i.test(k)),
    'ani rekord, ani zdarzenie dziennika nie przechowuje czasu — zdarzenie: ' + JSON.stringify(e));
});

// ----------------------------- F4: własny sprawdzian szkicu nr 3 ("ponowne spotkanie")

test('F4: ponowne spotkanie — 20 aktów agenta pod nieobecność właściciela widać w dzienniku', () => {
  const r = new Rdzen();
  // Właściciel zapisał trzy rzeczy, zanim wyszedł.
  for (const t of ['a', 'b', 'c']) r.zapisz('uwaga', { tekst: t }, JOZZ);
  const odkad = r.dziennik().at(-1).n;

  // Agent wykonuje 20 aktów. Trzy z nich to niezależne dojście do tej samej treści,
  // co właściciel — zwyczajna sytuacja, nie złośliwy przypadek.
  for (let i = 0; i < 17; i++) r.zapisz('uwaga', { tekst: 'nowe ' + i }, CODE);
  for (const t of ['a', 'b', 'c']) r.zapisz('uwaga', { tekst: t }, CODE);

  const zmiany = r.dziennik(odkad).filter(e => e.typ === 'zapis');
  assert.equal(zmiany.length, 20,
    'szkic obiecuje, że jedno zapytanie do dziennika mówi, co się zmieniło; trzy akty wyparowały');
});

// ------------------------------------------- F5: konsekwencja, która dotyczy projektu

test('F5: dwóch niezależnych recenzentów zgodnych ze sobą da się policzyć', () => {
  const r = new Rdzen();
  const wersja = r.zapisz('ustawienia', { suspensionHertz: 2.4 }, JOZZ);

  // Astra i Opus oceniają NIEZALEŻNIE i dochodzą do tego samego wniosku.
  // Werdykt to, zgodnie ze szkicem, "zapis, który wskazuje wersję".
  r.zapisz('werdykt', { ocena: 'zdatne', o: wersja }, ASTRA, [wersja]);
  r.zapisz('werdykt', { ocena: 'zdatne', o: wersja }, OPUS, [wersja]);

  const recenzenci = new Set(aktyZapisu(r, 'werdykt').map(e => e.kto));

  // To jest najdroższe pytanie tego projektu: ilu niezależnych głosów naprawdę mamy.
  // Rdzeń, który zwija dwóch zgodnych recenzentów w jednego, kasuje właśnie tę liczbę.
  assert.equal(recenzenci.size, 2,
    'dwóch zgodnych recenzentów jest nieodróżnialnych od jednego; zniknęła liczba niezależnych głosów');
});

// --------------------------------- F6: dziennik jest jedynym domem proweniencji i nikt go nie sprawdza

test('F6: po imporcie da się sprawdzić, że dziennik mówi prawdę o autorach', () => {
  const r = new Rdzen();
  const id = r.zapisz('uwaga', { tekst: 'to napisał agent' }, OPUS);
  const dane = JSON.parse(r.eksport());

  // Podmieniam autora w dzienniku. Rekordy zostają nietknięte, więc ich skróty się zgadzają.
  dane.dziennik = dane.dziennik.map(e => (e.typ === 'zapis' ? { ...e, kto: 'jozz' } : e));

  const wrocony = Rdzen.importuj(JSON.stringify(dane));
  const zDziennika = wrocony.dziennik().find(e => e.typ === 'zapis').kto;
  const zRekordu = wrocony.zapis(id).kto;

  // `importuj` weryfikuje tożsamość każdego rekordu, ale dziennik przyjmuje w całości,
  // bez sprawdzenia. Szkic umieszcza całą proweniencję właśnie w dzienniku.
  assert.equal(zDziennika, zRekordu,
    'zmyślony dziennik wszedł bez zastrzeżeń: proweniencja jest nie tylko niepełna, ale i niesprawdzalna');
});

// ------------------------------------------------------- kalibracja: co rdzeń robi dobrze

test('kalibracja: porównaj-i-zamień naprawdę chroni przed starą kartą', () => {
  const r = new Rdzen();
  r.zalozGlowe('uwagi:skrzynka', 'wspolna', JOZZ);
  const a = r.zapisz('uwaga', { tekst: 'pierwsza' }, JOZZ);
  const b = r.zapisz('uwaga', { tekst: 'druga' }, JOZZ, [a]);
  assert.equal(r.przesun('uwagi:skrzynka', null, a, JOZZ).ok, true);
  assert.equal(r.przesun('uwagi:skrzynka', a, b, JOZZ).ok, true);
  // Stara karta nadal myśli, że głowa stoi na `a`.
  assert.deepEqual(r.przesun('uwagi:skrzynka', a, a, JOZZ), { ok: false, teraz: b });
});

test('kalibracja: prawa głów i zamrożenie treści w głąb trzymają', () => {
  const r = new Rdzen();
  r.zalozGlowe('ustawienia:m6', 'wlasciciel', JOZZ);
  const v = r.zapisz('ustawienia', { os: { hertz: 2.4 } }, JOZZ);
  assert.throws(() => r.przesun('ustawienia:m6', null, v, OPUS), /nie może/);
  assert.throws(() => { r.zapis(v).content.os.hertz = 9; }, TypeError);
});

test('kalibracja: import odrzuca rekord o podmienionej treści', () => {
  const r = new Rdzen();
  r.zapisz('uwaga', { tekst: 'oryginał' }, JOZZ);
  const d = JSON.parse(r.eksport());
  d.zapisy[0].content = { tekst: 'podmienione' };
  assert.throws(() => Rdzen.importuj(JSON.stringify(d)), /Zła tożsamość/);
});

// ------------------------------------------------------------------------ straż dowodów

test('F0: dowody nie znikają po cichu', () => {
  const zrodlo = readFileSync(new URL(import.meta.url), 'utf8');
  for (const id of ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'])
    assert.ok(zrodlo.includes("test('" + id + ":"), `falsyfikator ${id} musi zostać w pliku`);
  assert.ok(/kalibracja:/.test(zrodlo), 'przypadki kalibracyjne muszą zostać, bo pokazują, że test działa');
  assert.ok(/NIE PROPONUJ[EĘ] TU IMPLEMENTACJI/.test(zrodlo),
    'jeśli ktoś wybrał już implementację, usuń tę uwagę razem z decyzją zapisaną w repo');
});
