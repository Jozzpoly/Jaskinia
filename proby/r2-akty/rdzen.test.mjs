// Testy R2. Sprawdzają trzy rzeczy naraz:
//  (a) że R2 jest prawdziwym rodzeństwem R1: ci sami trzej konsumenci na tym samym rdzeniu;
//  (b) że falsyfikatory z PR #5 i #6 oraz obserwacje Astry z 10 XI przechodzą;
//  (c) co NADAL nie jest rozwiązane — jawnie, jako test, nie jako przemilczenie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen, recordId } from './rdzen.mjs';

const JOZZ = { who: 'jozz', role: 'owner' };
const OPUS = { who: 'opus', role: 'agent' };
const CODE = { who: 'opus-code', role: 'agent' };
const ASTRA = { who: 'astra', role: 'agent' };

// Zegar wstrzykiwany: akty mają rosnąć, a test ma być deterministyczny.
const zegarek = (start = 1_762_800_000_000, krok = 1000) => { let t = start - krok; return () => (t += krok); };
const nowy = () => new Rdzen({ zegar: zegarek() });

/* =============================================== (a) trzej konsumenci, jak w R1 */

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
  const r = nowy();
  r.zalozGlowe('ustawienia:m6', 'wlasciciel', JOZZ);
  const v1 = r.zapisz('ustawienia', { suspensionHertz: 2.4, brakeTorque: 900 }, JOZZ);
  assert.equal(r.przesun('ustawienia:m6', null, v1, JOZZ, 'pierwsza wersja').ok, true);
  const prop = r.zapisz('propozycja', { suspensionHertz: 3.1, brakeTorque: 900 }, OPUS, [v1]);
  assert.throws(() => r.przesun('ustawienia:m6', v1, prop, OPUS), /nie może/);

  r.zalozGlowe('uwagi:skrzynka', 'wspolna', JOZZ);
  dodajUwage(r, 'za miękko na hopkach', JOZZ, [v1]);

  r.zalozGlowe('agent:opus-code/proba-7', 'agent:opus-code', CODE);
  const p1 = r.zapisz('proba', { stan: 'start' }, CODE);
  const p2 = r.zapisz('proba', { stan: 'wynik: 4 czerwone testy' }, CODE, [p1]);
  assert.equal(r.przesun('agent:opus-code/proba-7', null, p1, CODE).ok, true);
  assert.equal(r.przesun('agent:opus-code/proba-7', p1, p2, CODE).ok, true);
  assert.throws(() => r.przesun('agent:opus-code/proba-7', p2, p1, OPUS), /nie może/);
  assert.deepEqual(uwagi(r), ['za miękko na hopkach']);
});

/* ============================== (b) falsyfikatory z #5, które teraz przechodzą */

test('F1: dwa identyczne zapisy, dwóch autorów — oba akty dają się odzyskać', () => {
  const r = nowy();
  const a = r.zapisz('uwaga', { tekst: 'hamulce trzymają' }, JOZZ);
  const b = r.zapisz('uwaga', { tekst: 'hamulce trzymają' }, OPUS);
  assert.equal(a, b, 'tożsamość treści nadal jest z treści — to było w porządku');
  assert.equal(r.akty(a).length, 2, 'dwa akty, nie jeden');
  assert.deepEqual(r.autorzy(a).sort(), ['jozz', 'opus']);
});

test('F2: autor nie jest własnością treści, więc nikomu nie jest przypisywany', () => {
  const r = nowy();
  r.zapisz('werdykt', { ocena: 'zdatne' }, OPUS);            // agent pierwszy
  const id = r.zapisz('werdykt', { ocena: 'zdatne' }, JOZZ); // właściciel to samo, później

  // Odpowiedź na F2 USUWA pole, a nie dodaje: rekord adresowany treścią nie ma autora.
  assert.equal(r.zapis(id).kto, undefined, '`kto` nie należy do rekordu');
  assert.ok(Object.isFrozen(r.zapis(id)));
  // Autor jest w akcie, osobno dla każdego.
  assert.deepEqual(r.akty(id).map(e => e.kto), ['opus', 'jozz']);
});

test('F3: każdy akt ma czas', () => {
  const r = nowy();
  const id = r.zapisz('uwaga', { tekst: 'kiedy to było' }, JOZZ);
  const [akt] = r.akty(id);
  assert.equal(typeof akt.czas, 'number');
  assert.ok(akt.czas > 1_700_000_000_000, 'czas ścienny, nie licznik');
  // Ale kolejność zatwierdzenia nadal daje `n`, nie czas (uwaga Astry).
  assert.equal(typeof akt.n, 'number');
});

test('F4: ponowne spotkanie — 20 aktów agenta widać w dzienniku', () => {
  const r = nowy();
  for (const t of ['a', 'b', 'c']) r.zapisz('uwaga', { tekst: t }, JOZZ);
  const odkad = r.dziennik().at(-1).n;
  for (let i = 0; i < 17; i++) r.zapisz('uwaga', { tekst: 'nowe ' + i }, CODE);
  for (const t of ['a', 'b', 'c']) r.zapisz('uwaga', { tekst: t }, CODE);
  const zmiany = r.dziennik(odkad).filter(e => e.typ === 'zapis');
  assert.equal(zmiany.length, 20);
  assert.ok(zmiany.every(e => e.kto === 'opus-code' && typeof e.czas === 'number'));
});

test('F5: dwóch niezależnych recenzentów zgodnych ze sobą da się policzyć', () => {
  const r = nowy();
  const wersja = r.zapisz('ustawienia', { suspensionHertz: 2.4 }, JOZZ);
  const w = r.zapisz('werdykt', { ocena: 'zdatne', o: wersja }, ASTRA, [wersja]);
  r.zapisz('werdykt', { ocena: 'zdatne', o: wersja }, OPUS, [wersja]);
  assert.equal(r.autorzy(w).length, 2, 'liczba niezależnych głosów zostaje');
  assert.deepEqual(r.autorzy(w).sort(), ['astra', 'opus']);
});

/* ================================= (b) wymaganie Astry: retry to nie druga decyzja */

test('Astra/retry: dwa dostarczenia tej samej operacji dają jeden akt', () => {
  const r = nowy();
  const id1 = r.zapisz('uwaga', { tekst: 'wyślij raz' }, JOZZ, [], { op: 'klient-7/akt-1' });
  const id2 = r.zapisz('uwaga', { tekst: 'wyślij raz' }, JOZZ, [], { op: 'klient-7/akt-1' });
  assert.equal(id1, id2);
  assert.equal(r.akty(id1).length, 1, 'retry po utraconej odpowiedzi to nadal jedna decyzja');
});

test('Astra/obs.1: dwa WYWOŁANIA tego samego autora bez op to dwa akty', () => {
  // Jej obserwacja 1 na R1: jeden akt. Tu dwa — bo to dwie czynności, a nie retry.
  // Rozróżnia je tożsamość operacji, nie autor w skrócie treści (co sama wykluczyła).
  const r = nowy();
  const id = r.zapisz('note', { text: 'same' }, OPUS);
  r.zapisz('note', { text: 'same' }, OPUS);
  assert.equal(r.akty(id).length, 2);
  assert.notEqual(r.akty(id)[0].czas, r.akty(id)[1].czas, 'dwie chwile, nie jedna');
});

test('Astra/retry: ta sama operacja z inną treścią jest błędem, nie cichą zmianą', () => {
  const r = nowy();
  r.zapisz('uwaga', { tekst: 'pierwsza' }, JOZZ, [], { op: 'klient-7/akt-1' });
  assert.throws(() => r.zapisz('uwaga', { tekst: 'inna' }, JOZZ, [], { op: 'klient-7/akt-1' }),
    /już zapisała inną treść/);
});

test('Astra/retry: powtórzone przesunięcie głowy nie przegrywa z samym sobą', () => {
  const r = nowy();
  r.zalozGlowe('uklad', 'wlasciciel', JOZZ);
  const a = r.zapisz('uklad', { w: 1 }, JOZZ);
  assert.equal(r.przesun('uklad', null, a, JOZZ, '', { op: 'k7/p1' }).ok, true);
  // Klient nie dostał odpowiedzi i powtarza. Bez tożsamości operacji dostałby
  // { ok:false }, bo głowa już nie wskazuje null — i słusznie by się przestraszył.
  assert.deepEqual(r.przesun('uklad', null, a, JOZZ, '', { op: 'k7/p1' }), { ok: true, powtorzone: true });
});

/* ===================================== (b) wymagania z #6: przeprowadzka i kopie */

test('P1+P4: sześć rodzajów stanu przeżywa zmianę adresu, a kopię można znaleźć po czasie', () => {
  const r = nowy();
  const glowy = ['uklady:przeglad', 'uwagi:skrzynka', 'uklady:zapisane', 'kosz', 'kopie:auto', 'ratunek'];
  for (const n of glowy) r.zalozGlowe(n, 'wlasciciel', JOZZ);
  const tresci = {
    'uklady:przeglad': { name: 'przeglad', L: { wins: { w1: {} } } },
    'uwagi:skrzynka': { tekst: 'sprawdzić hamulce' },
    'uklady:zapisane': { name: 'do pracy nocnej' },
    'kosz': { kind: 'space', name: 'stara przeglądarka' },
    'kopie:auto': { why: 'przed importem' },
    'ratunek': { surowe: '{"to":"nieczytelne' },
  };
  for (const [g, t] of Object.entries(tresci)) {
    const id = r.zapisz('stan', t, JOZZ);
    assert.equal(r.przesun(g, null, id, JOZZ, 'przeprowadzka').ok, true);
  }
  const po = Rdzen.importuj(r.eksport());
  for (const [g, t] of Object.entries(tresci)) assert.deepEqual(po.zapis(po.glowa(g)).content, t, g);

  // P4: "daj mi kopię sprzed konkretnej chwili" — teraz da się odpowiedzieć.
  const akt = po.akty(po.glowa('kopie:auto'))[0];
  assert.equal(typeof akt.czas, 'number');
  const przed = po.dziennik().filter(e => e.czas <= akt.czas);
  assert.ok(przed.length > 0, 'da się odciąć dziennik po czasie');
});

test('P2: surowy ratunek przeżywa, choć nie jest poprawnym JSON-em', () => {
  const r = nowy();
  const surowe = '{"to":"nieczytelne dane, których nie dało się sparsować';
  const id = r.zapisz('ratunek', { surowe }, JOZZ);
  assert.equal(Rdzen.importuj(r.eksport()).zapis(id).content.surowe, surowe);
});

test('P5: stara karta nie nadpisuje nowszego stanu', () => {
  const r = nowy();
  r.zalozGlowe('uklady:przeglad', 'wlasciciel', JOZZ);
  const a = r.zapisz('uklad', { w: 1 }, JOZZ);
  const b = r.zapisz('uklad', { w: 2 }, JOZZ, [a]);
  assert.equal(r.przesun('uklady:przeglad', null, a, JOZZ).ok, true);
  assert.equal(r.przesun('uklady:przeglad', a, b, JOZZ).ok, true);
  const odmowa = r.przesun('uklady:przeglad', a, a, JOZZ);
  assert.equal(odmowa.ok, false);
  assert.equal(odmowa.teraz, b, 'odmowa mówi, gdzie głowa stoi teraz');
  assert.equal(odmowa.pokolenie, 2, 'i w którym pokoleniu, żeby klient mógł się dostroić');
});

test('Astra/5 XI: głowa A → B → A nie przepuszcza klienta, który pamięta pierwsze A', () => {
  // Druga granica R1 z jego własnego README, wskazana przez Astrę. Porównanie samej
  // treści nie odróżnia pierwszego A od drugiego, bo to ten sam zapis.
  const r = nowy();
  r.zalozGlowe('uklad', 'wlasciciel', JOZZ);
  const A = r.zapisz('uklad', { w: 1 }, JOZZ);
  const B = r.zapisz('uklad', { w: 2 }, JOZZ, [A]);

  assert.equal(r.przesun('uklad', null, A, JOZZ).ok, true);
  const stary = r.stanGlowy('uklad');                 // klient zapamiętuje A i pokolenie 1
  assert.deepEqual({ na: stary.na, pokolenie: stary.pokolenie }, { na: A, pokolenie: 1 });

  assert.equal(r.przesun('uklad', A, B, JOZZ).ok, true);   // ktoś inny: A → B
  assert.equal(r.przesun('uklad', B, A, JOZZ).ok, true);   // i wraca: B → A

  assert.equal(r.glowa('uklad'), A, 'głowa znów wskazuje A, więc samo `z` go nie odróżni');

  // Bez pokolenia klient wygrywa, choć pracuje na obrazie sprzed dwóch zmian. To ta dziura.
  const naiwny = r.przesun('uklad', A, B, JOZZ, 'klient z nieaktualnym obrazem');
  assert.equal(naiwny.ok, true, 'to jest zachowanie R1 i nadal domyślne tutaj');

  // Z pokoleniem: klient podaje to, co pamiętał, i przegrywa.
  r.przesun('uklad', B, A, JOZZ);                      // wracamy do A, by powtórzyć układ
  const wynik = r.przesun('uklad', A, B, JOZZ, '', { pokolenie: stary.pokolenie });
  assert.equal(wynik.ok, false);
  assert.equal(wynik.nieswieze, true);
  assert.ok(wynik.pokolenie > stary.pokolenie, 'pokolenie rośnie i nigdy nie wraca');
});

test('pokolenie przeżywa eksport, a z R1 jest odtwarzane z dziennika, nie zmyślane', () => {
  const r = nowy();
  r.zalozGlowe('uklad', 'wlasciciel', JOZZ);
  const A = r.zapisz('uklad', { w: 1 }, JOZZ);
  const B = r.zapisz('uklad', { w: 2 }, JOZZ, [A]);
  r.przesun('uklad', null, A, JOZZ);
  r.przesun('uklad', A, B, JOZZ);
  assert.equal(Rdzen.importuj(r.eksport()).stanGlowy('uklad').pokolenie, 2);

  // Format R1 nie miał pokolenia, ale miał przesunięcia w dzienniku.
  const content = { w: 1 }, links = [];
  const id = recordId('uklad', { content, links });
  const r1 = JSON.stringify({
    format: 'rdzen-r1', wersja: 1,
    zapisy: [{ id, kind: 'uklad', content, links, kto: 'jozz' }],
    glowy: { uklad: { na: id, prawa: 'wlasciciel' } },
    dziennik: [
      { n: 1, typ: 'glowa', nazwa: 'uklad', prawa: 'wlasciciel', kto: 'jozz' },
      { n: 2, typ: 'przesun', nazwa: 'uklad', z: null, na: id, kto: 'jozz' },
    ],
  });
  assert.equal(Rdzen.importuj(r1).stanGlowy('uklad').pokolenie, 1, 'odtworzone z historii');
});

/* ================================================= droga migracji z R1 (zasada 8) */

test('migracja z R1: autor nie przepada, a czasu nie wymyślam', () => {
  // Magazyn w formacie R1, zbudowany ręcznie z jego kształtu (rekordy noszą `kto`).
  const content = { tekst: 'z czasów R1' }, links = [];
  const id = recordId('uwaga', { content, links });
  const r1 = JSON.stringify({
    format: 'rdzen-r1', wersja: 1,
    zapisy: [{ id, kind: 'uwaga', content, links, kto: 'opus' }],
    glowy: { 'uwagi:skrzynka': { na: id, prawa: 'wspolna' } },
    dziennik: [{ n: 1, typ: 'zapis', id, kind: 'uwaga', kto: 'opus' }],
  });

  const r = Rdzen.importuj(r1, { zegar: zegarek() });
  assert.equal(r.glowa('uwagi:skrzynka'), id, 'głowa przeżywa migrację');
  assert.deepEqual(r.zapis(id).content, content);
  assert.equal(r.zapis(id).kto, undefined, '`kto` schodzi z rekordu');
  assert.equal(r.akty(id)[0].kto, 'opus', 'autor zostaje, bo w dzienniku R1 już był');

  // Czasu w R1 nie było. Zmyślona data byłaby gorsza od przyznanej luki.
  assert.equal(r.akty(id)[0].czas, null);
  assert.equal(r.akty(id)[0].czasNieznany, true);
  assert.equal(r.akty(id)[0].zR1, true);
});

test('import odrzuca rekord o podmienionej treści, w obu formatach', () => {
  const r = nowy();
  r.zapisz('uwaga', { tekst: 'oryginał' }, JOZZ);
  const d = JSON.parse(r.eksport());
  d.zapisy[0].content = { tekst: 'podmienione' };
  assert.throws(() => Rdzen.importuj(JSON.stringify(d)), /Zła tożsamość/);
});

/* ============================================ (c) czego to NADAL nie rozwiązuje */

test('NIEROZWIĄZANE — Astra/obs.2: spójna podmiana autora przechodzi import', () => {
  // Jej obserwacja 2 dotyczyła R1 i dotyczy R2 tak samo. Nie udaję, że naprawiłem:
  // zgodność pól nie jest dowodem pochodzenia, a zewnętrznej, uwierzytelnionej
  // podstawy (podpisów) ten rdzeń nie ma. F6 z #5 zostaje otwarte.
  const r = nowy();
  const id = r.zapisz('uwaga', { tekst: 'to napisał agent' }, OPUS);
  const d = JSON.parse(r.eksport());
  for (const e of d.dziennik) if (e.typ === 'zapis') e.kto = 'jozz';

  const wrocony = Rdzen.importuj(JSON.stringify(d));
  assert.equal(wrocony.akty(id)[0].kto, 'jozz',
    'zmyślony dziennik nadal wchodzi: to jest granica tej próby, nie jej zaleta');
});

test('NIEROZWIĄZANE — Astra/obs.3: dwie kopie magazynu przyjmują własne zmiany', () => {
  // Oczekiwane zachowanie lokalnych kopii, nie błąd CAS. Rdzeń nie ma wspólnej
  // trwałości ani rozstrzygania między originami i nie udaje, że ma.
  const r = nowy();
  r.zalozGlowe('praca', 'wlasciciel', JOZZ);
  const baza = r.zapisz('uwaga', 'baza', JOZZ);
  r.przesun('praca', null, baza, JOZZ);
  const a = Rdzen.importuj(r.eksport(), { zegar: zegarek() });
  const b = Rdzen.importuj(r.eksport(), { zegar: zegarek() });
  const nA = a.zapisz('uwaga', 'A', JOZZ), nB = b.zapisz('uwaga', 'B', JOZZ);
  assert.equal(a.przesun('praca', baza, nA, JOZZ).ok, true);
  assert.equal(b.przesun('praca', baza, nB, JOZZ).ok, true);
  assert.notEqual(a.glowa('praca'), b.glowa('praca'));
});

/* ------------------------------------------------------------------ straż dowodów */

test('R0: granice zostają opisane, a nie przemilczane', async () => {
  const { readFileSync } = await import('node:fs');
  const zrodlo = readFileSync(new URL(import.meta.url), 'utf8');
  const otwarte = (zrodlo.match(/test\('NIEROZWIĄZANE/g) ?? []).length;
  assert.equal(otwarte, 2, 'dwie granice Astry zostają jako testy, nie jako brak wzmianki');
  const rdzen = readFileSync(new URL('./rdzen.mjs', import.meta.url), 'utf8');
  assert.ok(/CZEGO TO NIE ROZWIĄZUJE/.test(rdzen), 'rdzeń musi sam wymieniać swoje granice');
  assert.ok(/Status: próba/.test(rdzen), 'R2 jest próbą i nie staje się fundamentem przez to, że działa');
});
