// Sprawdziany budowniczego dla warstwy środowiska (17 XI 2026). To podłoga, nie miara: miarę piszą i sądzą inni
// (dowody D0, D1, D2 z planu budowy), przez żywy adres, bez tego kodu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { coTuJest, stronaRzeczy, stronaRodzaju, listaRzeczy, umowaOkna, opisDane } from './opis.mjs';
import { obsluzSrodowisko, CSP_GOSCIA } from './srodowisko-http.mjs';

let n = 0;
const op = () => 'sprawdzian-' + String(++n).padStart(6, '0');
async function swiat() {
  let t = Date.UTC(2026, 10, 17, 2, 0, 0);
  const r = new Rdzen(sqlZNode(), { teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-probny', 'agent-a', 'agent-b', 'agent-0', 'agent-1', 'agent-2', 'podglad'] }));
  return { r, s, nowe: r.meta('obszar_nowe'), glowny: r.meta('obszar_glowny') };
}
const postac = { dla: 'postac/1', opis: 'Postać ze świata gry.', tytul: 'imie', cechy: { imie: { typ: 'tekst', wymagana: true }, sila: { typ: 'liczba' }, z_projektu: { typ: 'rzecz', rodzaj: 'projekt/1' } } };

test('zasiew: środowisko opisuje samo siebie i nie sieje dwa razy', async () => {
  const { s } = await swiat();
  const przed = s.spis().length;
  assert.ok(s.ksztaltDla('ksztalt/1'), 'kształt kształtu jest rzeczą');
  assert.ok(s.ksztaltDla('obszar/1') && s.ksztaltDla('gosc/1') && s.ksztaltDla('projekt/1'));
  assert.deepEqual(await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-probny', 'agent-a', 'agent-b', 'agent-0', 'agent-1', 'agent-2', 'podglad'] })), []);
  assert.equal(s.spis().length, przed);
  assert.equal(s.rola('jozz'), 'wlasciciel');
  assert.equal(s.rola('agent-probny'), 'agent', 'uczestnik jest uczestnikiem, bo jest rzeczą uczestnika');
  // Do 17 XI 2026 to zdanie mówiło 'agent': rolę agenta dostawało KAŻDE imię, bo samo bycie imieniem wystarczało.
  // Teraz prawa są z danych i brak rzeczy uczestnika znaczy brak praw - w tę stronę ma padać błąd.
  assert.equal(s.rola('ktos-z-kluczem'), 'zwiedzajacy', 'imię bez rzeczy uczestnika nie jest uczestnikiem');
  assert.equal(s.rola(null), 'zwiedzajacy');
  assert.match(s.powodBrakuPrawa('ktos-z-kluczem'), /klucz jest poprawny/, 'i słyszy prawdę, a nie "podaj klucz"');
  assert.match(s.powodBrakuPrawa(null), /potrzebny jest klucz/);
});

test('D0 w małym: agent dokłada nowy rodzaj jako daną i rzecz tego rodzaju, bez zmiany kodu', async () => {
  const { s, nowe } = await swiat();
  const proj = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'JV Web' } });
  assert.equal(proj.skutek, 'polozone');
  const k = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: postac });
  assert.equal(k.ok, true, JSON.stringify(k));
  assert.equal(k.skutek, 'polozone');
  const zle = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'postac/1', cechy: { sila: 'duża' } });
  assert.equal(zle.status, 422);
  assert.match(zle.blad, /imie: cecha wymagana/);
  assert.match(zle.blad, /sila: ma być liczbą/);
  const zleOdn = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'postac/1', cechy: { imie: 'Ania', z_projektu: k.rzecz } });
  assert.equal(zleOdn.status, 422, 'odniesienie do rzeczy złego rodzaju odbija się od drzwi');
  const a = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'postac/1', cechy: { imie: 'Ania', sila: 7, z_projektu: proj.rzecz, ulubiony_kolor: 'zielony' } });
  assert.equal(a.skutek, 'polozone');
  assert.deepEqual(a.nieznane_cechy, ['ulubiony_kolor'], 'nieznana cecha zostaje i jest nazwana');
  const rz = s.rzecz(a.rzecz);
  assert.equal(rz.obszar, nowe, 'rzecz agenta bez obszaru ląduje w "Nowe"');
  assert.equal(rz.cechy.ulubiony_kolor, 'zielony');
  assert.equal(s.tytul(rz), 'Ania');
  assert.ok(s.spis({ rodzaj: 'postac/1' }).some((x) => x.id === a.rzecz), 'widać ją w spisie');
  assert.ok(s.spis({ rodzaj: 'postac' }).length === 1, 'spis po samej nazwie rodzaju, bez pokolenia');
  assert.deepEqual(s.wskazujaNa(proj.rzecz).map((w) => w.od), [a.rzecz], 'odniesienie jest w spisie odniesień');
});

test('rodzaj bez kształtu: rzecz zostaje zapisana i widoczna, z uwagą', async () => {
  const { s } = await swiat();
  const w = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'cos-nowego/1', cechy: { a: 1 } });
  assert.equal(w.skutek, 'polozone');
  assert.match(w.uwaga, /nie ma kształtu/);
  assert.ok(opisDane(s, {}).bez_ksztaltu.includes('cos-nowego/1'));
});

test('kształt: zły opis odbija się od drzwi ze zdaniem; drugi kształt tego samego rodzaju też', async () => {
  const { s } = await swiat();
  const zly = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'Postac', cechy: { Imie: { typ: 'napis' } } } });
  assert.equal(zly.status, 422);
  assert.match(zly.blad, /dla: nazwa rodzaju z pokoleniem/);
  assert.match(zly.blad, /opis: jedno zdanie/);
  const zlyTyp = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'postac/1', opis: 'x', cechy: { imie: { typ: 'napis' } } } });
  assert.match(zlyTyp.blad, /nieznany typ "napis"; znane typy: tekst/);
  assert.equal((await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: postac })).ok, true);
  const drugi = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: postac });
  assert.equal(drugi.status, 409);
  assert.match(drugi.blad, /następne pokolenie, np\. postac\/2/);
  const rdzen = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'obszar/2', opis: 'x', cechy: {} } });
  assert.equal(rdzen.ok, true, 'następne pokolenie rodzaju rdzenia wolno zaproponować jako daną');
});

test('prawo z danych: ten sam ruch tego samego agenta daje skutek, propozycję albo odmowę zależnie od obszaru', async () => {
  const { s, nowe } = await swiat();
  const ruch = () => ({ op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Lab' } });
  const wNowe = await s.ruch('agent-probny', { ...ruch(), obszar: nowe });
  assert.equal(wNowe.skutek, 'polozone');
  const wGlownym = await s.ruch('agent-probny', { ...ruch(), obszar: null });
  assert.equal(wGlownym.skutek, 'propozycja');
  assert.match(wGlownym.powod, /mogą tylko proponować/);
  assert.equal(s.spis({ rodzaj: 'projekt/1' }).length, 1, 'propozycja nie jest jeszcze rzeczą');
  assert.equal(s.czeka().propozycje.length, 1);
  // właściciel przestawia obszar w locie
  const o = s.rzecz(nowe);
  const zm = await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: nowe, wersja: o.wersja, rodzaj: 'obszar/1', cechy: { ...o.cechy, ile_wolno: 'nic' } });
  assert.equal(zm.skutek, 'polozone');
  const teraz = await s.ruch('agent-probny', { ...ruch(), obszar: nowe });
  assert.equal(teraz.status, 403);
  assert.match(teraz.blad, /nie wolno nic/);
  // agent nie przestawi ustawienia sam: ruch zastrzeżony dla właściciela staje się propozycją do niego
  const o2 = s.rzecz(nowe);
  const proba = await s.ruch('agent-probny', { op: op(), co: 'poloz', rzecz: nowe, wersja: o2.wersja, rodzaj: 'obszar/1', cechy: { ...o2.cechy, ile_wolno: 'prowadzic' } });
  assert.equal(proba.skutek, 'propozycja');
  assert.match(proba.powod, /zmienia tylko właściciel/);
  assert.equal(proba.kto_przyjmuje, 'wlasciciel');
  assert.equal(s.rzecz(nowe).cechy.ile_wolno, 'nic', 'ustawienie stoi, dopóki właściciel nie przyjmie');
  // w obszarze, w którym agentom nie wolno nic, nie ma też propozycji
  assert.equal((await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'uczestnik/1', cechy: { imie: 'agent-probny', rola: 'wlasciciel' } })).status, 403);
  // a tam, gdzie wolno proponować, dopisanie uczestnika jest propozycją tylko dla właściciela
  const ucz = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'uczestnik/1', obszar: null, cechy: { imie: 'ktos-nowy', rola: 'agent' } });
  assert.equal(ucz.skutek, 'propozycja');
  assert.equal(s.rzecz(ucz.propozycja).cechy.wymaga, 'wlasciciel');
  assert.equal(s.ile({ rodzaj: 'uczestnik/1', gdzie: { imie: 'ktos-nowy' } }), 0);
  assert.equal(s.rola('agent-probny'), 'agent', 'rzecz nie nadaje roli właściciela');
  assert.equal((await s.ruch(null, ruch())).status, 401, 'bez klucza nie ma ruchu');
});

test('propozycja: przyjęcie robi z niej rzecz, odrzucenie zostawia ślad; jedno i drugie tylko raz', async () => {
  const { s } = await swiat();
  const p1 = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Do przyjęcia' }, obszar: null });
  const p2 = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Do odrzucenia' }, obszar: null });
  assert.equal((await s.ruch('agent-probny', { op: op(), co: 'przyjmij', propozycja: p1.propozycja })).status, 403, 'autor nie przyjmuje własnej propozycji');
  const oppr = op();
  const tak = await s.ruch('jozz', { op: oppr, co: 'przyjmij', propozycja: p1.propozycja });
  assert.equal(tak.skutek, 'przyjeta');
  assert.equal(s.rzecz(tak.rzecz).cechy.nazwa, 'Do przyjęcia');
  assert.equal(s.rzecz(p1.propozycja).cechy.stan, 'przyjeta');
  assert.equal(s.rzecz(p1.propozycja).cechy.wynik, tak.rzecz);
  const znow = await s.ruch('jozz', { op: oppr, co: 'przyjmij', propozycja: p1.propozycja });
  assert.equal(znow.powtorzone, true, 'ponowienie tej samej czynności oddaje to, co stało się za pierwszym razem');
  assert.equal(znow.rzecz, tak.rzecz);
  const drugi = await s.ruch('jozz', { op: op(), co: 'przyjmij', propozycja: p1.propozycja });
  assert.equal(drugi.status, 409, 'rozstrzygnięta propozycja nie przyjmie się drugi raz');
  const nie = await s.ruch('jozz', { op: op(), co: 'odrzuc', propozycja: p2.propozycja, powod: 'to już jest' });
  assert.equal(nie.skutek, 'odrzucona');
  assert.equal(s.rzecz(p2.propozycja).cechy.powod, 'to już jest');
  assert.equal(s.czeka().propozycje.length, 0);
  assert.equal(s.spis({ rodzaj: 'projekt/1' }).length, 1);
});

test('zmiana rzeczy: wersja chroni przed nadpisaniem, a ten sam op nie robi niczego dwa razy', async () => {
  const { s } = await swiat();
  const o1 = op();
  const a = await s.ruch('jozz', { op: o1, co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'A' } });
  const a2 = await s.ruch('jozz', { op: o1, co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'A' } });
  assert.equal(a2.powtorzone, true);
  assert.equal(a2.rzecz, a.rzecz, 'ponowienie trafia w tę samą rzecz');
  assert.equal(s.spis({ rodzaj: 'projekt/1' }).length, 1);
  const inna = await s.ruch('jozz', { op: o1, co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'B' } });
  assert.equal(inna.status, 409, 'ten sam op dla innej czynności to konflikt, nie cichy sukces');
  const bezWersji = await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: a.rzecz, rodzaj: 'projekt/1', cechy: { nazwa: 'A2' } });
  assert.equal(bezWersji.status, 400);
  const b = await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: a.rzecz, wersja: a.wersja, rodzaj: 'projekt/1', cechy: { nazwa: 'A2' } });
  assert.equal(b.skutek, 'polozone');
  const stary = await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: a.rzecz, wersja: a.wersja, rodzaj: 'projekt/1', cechy: { nazwa: 'A3' } });
  assert.equal(stary.status, 409);
  assert.equal(s.rzecz(a.rzecz).cechy.nazwa, 'A2');
  assert.equal(s.historia(a.rzecz).length, 2);
  assert.equal(s.rzecz(a.rzecz).utworzyl, 'jozz');
});

test('ślad ciała zostaje przy ruchu', async () => {
  const { s } = await swiat();
  const a = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'A' } }, { slad: 'curl/sprawdzian' });
  assert.equal(s.historia(a.rzecz)[0].cialo, 'curl/sprawdzian');
});

test('gość: kod jest zapisem, wychodzi w piaskownicy, a rzecz gościa go wskazuje', async () => {
  const { s } = await swiat();
  const k = await s.kod('agent-probny', '<!doctype html><title>x</title><p>gość</p>', { op: op() });
  assert.equal(k.ok, true);
  assert.match(k.zapis, /^[0-9a-f]{64}$/);
  assert.equal(s.kodGoscia(k.zapis), null, 'sam zapis kodu nie jest jeszcze stroną: nikt go nie zgłosił jako gościa');
  const g = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'gosc/1', cechy: { nazwa: 'Mój', opis: 'próba', kod: k.zapis, umowa: 'okno/2' } });
  assert.equal(g.skutek, 'polozone');
  assert.equal(s.kodGoscia(k.zapis), '<!doctype html><title>x</title><p>gość</p>');
  const niekod = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'gosc/1', cechy: { nazwa: 'Nie kod', opis: 'x', kod: s.rzecz(g.rzecz).zapis } });
  assert.equal(niekod.status, 422, 'cecha kod musi wskazywać zapis rodzaju kod/1, nie dowolny zapis');
  assert.equal((await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'kod/1', cechy: { a: 1 } })).status, 400, 'rodzaj kod jest zastrzeżony');
  const zly = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'gosc/1', cechy: { nazwa: 'Zły', opis: 'x', kod: 'f'.repeat(64) } });
  assert.equal(zly.status, 422);
  assert.equal((await s.kod(null, '<p>x</p>', { op: op() })).status, 401);
  const przyklad = s.spis({ rodzaj: 'gosc/1' }).find((x) => x.cechy.nazwa === 'Lista rzeczy');
  assert.ok(przyklad && s.kodGoscia(przyklad.cechy.kod).includes('jaskinia: 1'), 'zasiany gość przykładowy ma kod');
  assert.equal(s.kodGoscia(przyklad.zapis), null, 'zapis, który nie jest kodem, nie wyjdzie tą drogą');
});

test('samowyjaśnianie powstaje z danych: zmienia się po ruchu i po zmianie ustawienia', async () => {
  const { s, nowe } = await swiat();
  const o = { origin: 'https://przyklad.test', podglad: true, kluczProbny: 'klucz-probny-jawny' };
  const t1 = coTuJest(s, o);
  for (const naglowek of ['1. CO TO ZA MIEJSCE', '2. CO TU JEST', '3. CO SIĘ ZMIENIŁO', '4. CO CI WOLNO I GDZIE', '5. JAK COŚ DOŁOŻYĆ', '6. CO CZEKA NA WŁAŚCICIELA', '7. SPIS CZASOWNIKÓW', '8. STAN BUDOWY', '9. GRANICE']) assert.ok(t1.includes(naglowek), naglowek);
  assert.match(t1, /Jesteś tu pierwszy raz albo Miejsce nie wie, kim jesteś/);
  assert.match(t1, /Teraz nic nie czeka\./);
  assert.match(t1, /klucz próbny agenta: klucz-probny-jawny/);
  assert.match(t1, /Nowe \(id [0-9a-z]{26}\): prowadzic = agenci dokładają i zmieniają sami/);
  assert.ok(t1.includes('POST https://przyklad.test/api/srodowisko/ruch'));
  const akt = s.ostatniNr();
  await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Świeży lab' } });
  const on = s.rzecz(nowe);
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: nowe, wersja: on.wersja, rodzaj: 'obszar/1', cechy: { ...on.cechy, ile_wolno: 'proponowac' } });
  await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Czekający lab' } });
  const t2 = coTuJest(s, { ...o, od: akt });
  assert.match(t2, new RegExp(`Od aktu ${akt} \\(z adresu\\)`));
  assert.match(t2, /agent-probny dołożył: Świeży lab \[projekt\/1\]/);
  assert.match(t2, /jozz zmienił: Nowe \[obszar\/1\]/);
  assert.match(t2, /Nowe \(id [0-9a-z]{26}\): proponowac = każdy ruch agenta staje się propozycją/);
  assert.match(t2, /propozycja od agent-probny: nowa rzecz rodzaju projekt\/1/);
  assert.doesNotMatch(t2, /Teraz nic nie czeka\./);
  assert.match(coTuJest(s, { ...o, kto: 'jozz' }), /Jesteś właścicielem/);
  assert.match(coTuJest(s, { ...o, jako: 'agent-probny' }), /Jesteś agentem/);
  assert.doesNotMatch(coTuJest(s, { ...o, podglad: false }), /klucz-probny-jawny/, 'poza podglądem klucz próbny nie wychodzi');
});

test('strony tekstem: rzecz, rodzaj, lista, umowa okna', async () => {
  const { s } = await swiat();
  const a = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'JV Web', cos_spoza: 1 } });
  const t = stronaRzeczy(s, a.rzecz, { kto: 'agent-probny' });
  assert.match(t, /RZECZ: JV Web/);
  assert.match(t, /cos_spoza \[cecha spoza kształtu\]: 1/);
  assert.match(t, /Twój ruch na tej rzeczy stanie się propozycją/);
  assert.equal(stronaRzeczy(s, 'x'.repeat(26)), null);
  assert.match(stronaRodzaju(s, 'projekt/1'), /nazwa: tekst \(wymagana\)/);
  assert.match(stronaRodzaju(s, 'nie-ma/1'), /Nie ma takiego rodzaju/);
  assert.match(listaRzeczy(s, { rodzaj: 'projekt/1' }), /JV Web \[projekt\/1\]/);
  const cala = listaRzeczy(s, {});
  assert.match(cala, /ZAKRES: pokazuję \d+ z \d+, pozycje od 1 do \d+/);
  assert.match(cala, /To jest koniec listy: nic więcej nie ma\./);
  const kawalek = listaRzeczy(s, { ile: 5 });
  assert.match(kawalek, /pokazuję 5 z \d+, pozycje od 1 do 5.*To NIE jest cała lista\. Dalszy ciąg: \/rzeczy\?pomin=5&ile=5/);
  assert.match(listaRzeczy(s, { ile: 5, pomin: 5 }), /pozycje od 6 do 10/);
  assert.equal(s.ile({ rodzaj: 'projekt' }), 1);
  assert.match(umowaOkna(), /NAJMNIEJSZY DZIAŁAJĄCY GOŚĆ/);
});

test('umowa okna opisuje program wejścia: play i record od gospodarza, played i recorded od gościa, umie w hello (A/B, 21 XI 2026)', () => {
  const u = umowaOkna();
  // gość, który to umie (JV Web), mówi to w hello; gospodarz bez tego pola o nic nie prosi
  const ma = (tekst) => assert.ok(u.includes(tekst), 'umowa okna mówi: ' + tekst);
  ma('umie: ["play", "record"] mówi, co zrobisz na prośbę gospodarza');
  assert.match(u, /\n {2}play {5}\{id, program\} +przejedź ten program wejścia od startu/);
  assert.match(u, /\n {2}record {3}\{id\} +oddaj jako program/);
  assert.match(u, /\n {2}played {3}\{id, ok: true, przebieg\} albo \{id, ok: false, error\}/);
  assert.match(u, /\n {2}recorded \{id, ok: true, program, obciete\}/);
  ma('PROGRAM WEJŚCIA (play, record)');
  // obietnice, na których stoi porównanie: ten sam start, stały krok, żywe wejście wyłączone, limit po stronie gospodarza
  ma('stawia się od nowa na starcie');
  ma('żywe wejście (klawisze, palec) w tym czasie nie działa');
  ma('czeka na played z własnym limitem');
  ma('{schemat: "wejscie/1"');
  ma('format przebieg/1');
  ma('równe skróty z dwóch okien znaczą przejazd bit w bit taki sam');
  // druga linia Opusa czatu na 89: przechył, z którego gospodarz mówi o przewrotce, granice programu, nagranie bez pokręteł
  ma('przechyl_max_st, t_przechyl_max');
  ma('0 stoi, 90 na boku, 180 na dachu');
  ma('Granice: najwyżej 5 minut (18 000 kroków), 20 000 odcinków, nazwa do 80 znaków');
  ma('nie pokrętła: puszczone przez play jedzie dokładnie tak samo przy tych samych pokrętłach');
  // świat mówi sam za siebie (25 XI; list Gemini Neona i głos Fable po przerwie): schematy w hello, serie nazwane przez świat
  ma('programy: ["wejscie/1"] mówi, jakie schematy programu grasz; gospodarz wysyła play tylko z takim');
  ma('serie: [{klucz, nazwa, jednostka}], po jednej na kolumnę');
  ma('Gospodarz porównuje i rysuje tylko serie, które oba okna nazwały tym samym kluczem i tą samą jednostką, nazwą z okna A');
  // uwagi Opusa czatu do 1166a32 (25 XI): jednostka w „tak samo”, czas jako seria t, cisza o przechyle zamiast języka auta, warunki
  ma('ten sam klucz w innej jednostce pokazuje bez porównania');
  ma('Seria o kluczu t to czas od startu programu w sekundach (jednostka s)');
  ma('świat, który ich nie poda, nic o nich nie usłyszy');
  assert.ok(!u.includes('świat nie podaje przechyłu'), 'gospodarz nie mówi do świata językiem auta');
  ma('warunki: co świat miał ustawione w chwili startu programu');
  ma('nie przebiera się za auto');
  ma('nowy poprawny play przerywa');
  // przykład z umowy to cała wiadomość, z polem jaskinia (bez niego świat milczy), i program, który da się przeczytać
  const linia = u.split('\n').find((l) => l.startsWith('Przykład') && l.includes('type: "play"'));
  const przyklad = JSON.parse(linia.slice(linia.indexOf('{')).replace(/([{,]\s*)([a-z_]+):/g, '$1"$2":'));
  assert.equal(przyklad.jaskinia, 1, 'przykład skopiowany dosłownie dostaje odpowiedź');
  assert.equal(przyklad.program.schemat, 'wejscie/1');
  assert.ok(przyklad.program.odcinki.length >= 2);
});

test('spis da się odbudować z samych głów i dziennika', async () => {
  const { s } = await swiat();
  const p = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'P' } });
  await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'relacja/1', cechy: { skad: p.rzecz, dokad: p.rzecz, jaka: 'robi-to-samo-co' } });
  const obraz = () => JSON.stringify([s.spis({ limit: 2000 }).map((x) => [x.id, x.rodzaj, x.obszar, x.wersja, x.utworzyl, x.zmienil, x.cechy]).sort(), s.q(`SELECT od, cecha, cel FROM odniesienia ORDER BY od, cecha, cel`)]);
  const przed = obraz();
  s.przebuduj();
  assert.equal(obraz(), przed);
});

test('drzwi HTTP: tekst, dane, ruch i kod gościa z nagłówkiem piaskownicy', async () => {
  const { s } = await swiat();
  const zap = (sciezka, { kto = '', metoda = 'GET', cialo, naglowki = {} } = {}) => obsluzSrodowisko(s, new Request('https://przyklad.test' + sciezka, { method: metoda, headers: { 'x-kto': kto, ...naglowki }, body: cialo }), { podglad: true, kluczProbny: 'k' });
  const t = await zap('/co-tu-jest');
  assert.equal(t.status, 200);
  assert.match(t.headers.get('content-type'), /text\/plain/);
  assert.match(await t.text(), /JASKINIA: ŚRODOWISKO/);
  const r = await zap('/api/srodowisko/ruch', { kto: 'agent-probny', metoda: 'POST', cialo: JSON.stringify({ op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Przez drzwi' } }), naglowki: { 'content-type': 'application/json', 'x-cialo': 'sprawdzian' } });
  const rj = await r.json();
  assert.equal(rj.skutek, 'polozone');
  const spis = await (await zap('/api/srodowisko/spis?rodzaj=projekt/1')).json();
  assert.equal(spis.rzeczy[0].tytul, 'Przez drzwi');
  assert.equal((await (await zap('/api/srodowisko/rzecz?id=' + rj.rzecz)).json()).historia[0].cialo, 'sprawdzian');
  assert.equal((await zap('/rzecz/' + rj.rzecz)).status, 200);
  assert.equal((await zap('/rzecz/' + '0'.repeat(26))).status, 404);
  assert.equal((await zap('/api/srodowisko/ruch', { metoda: 'POST', cialo: 'nie json' })).status, 400);
  const zleKodowanie = await zap('/api/srodowisko/ruch', { kto: 'agent-probny', metoda: 'POST', cialo: new Uint8Array([0x7b, 0x22, 0x6f, 0x70, 0x22, 0x3a, 0x22, 0xb3, 0x22, 0x7d]) });
  assert.equal(zleKodowanie.status, 400);
  assert.match((await zleKodowanie.json()).blad, /nie jest w UTF-8/);
  const g = s.spis({ rodzaj: 'gosc/1' })[0];
  const kod = await zap('/gosc/' + g.cechy.kod);
  assert.equal(kod.status, 200);
  assert.equal(kod.headers.get('content-security-policy'), CSP_GOSCIA);
  assert.match(CSP_GOSCIA, /^sandbox allow-scripts/);
  assert.doesNotMatch(CSP_GOSCIA, /allow-same-origin/);
  assert.equal((await zap('/gosc/' + 'a'.repeat(64))).status, 404);
  const puls = await (await zap('/api/srodowisko/puls')).json();
  assert.equal(puls.akt, s.ostatniNr());
});

// --- Druga noc (17 XI 2026): poprawki po niezależnym ataku i po psuciu (plan budowy, par. 0b) -----------------------

test('op jest osobny dla każdego uczestnika: ten sam napis u dwóch agentów to dwie czynności', async () => {
  const { s } = await swiat();
  const wspolny = 'moja-czynnosc-0001';
  const a = await s.ruch('agent-a', { op: wspolny, co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Od A' } });
  const b = await s.ruch('agent-b', { op: wspolny, co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Od B' } });
  assert.equal(a.skutek, 'polozone');
  assert.equal(b.skutek, 'polozone', JSON.stringify(b));
  assert.notEqual(a.rzecz, b.rzecz);
  assert.equal((await s.ruch('agent-a', { op: wspolny, co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Co innego' } })).status, 409, 'ten sam op dla innej własnej czynności to konflikt');
  assert.equal((await s.ruch('srodowisko', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'x' } })).status, 403, 'imię automatu jest zastrzeżone');
});

test('propozycja leży przy rzeczy, a przyjmuje ją tylko ten, kto sam mógłby zrobić ten ruch ze skutkiem', async () => {
  const { s, nowe } = await swiat();
  const t = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Dzieło właściciela' } });
  // agent A chce podmienić treść i przy okazji wynieść rzecz do obszaru, w którym agenci prowadzą
  const p = await s.ruch('agent-a', { op: op(), co: 'poloz', rzecz: t.rzecz, wersja: t.wersja, rodzaj: 'projekt/1', cechy: { nazwa: 'Podmienione' }, obszar: nowe });
  assert.equal(p.skutek, 'propozycja');
  assert.equal(s.rzecz(p.propozycja).obszar, null, 'propozycja leży tam, gdzie rzecz, której dotyczy');
  const b = await s.ruch('agent-b', { op: op(), co: 'przyjmij', propozycja: p.propozycja });
  assert.equal(b.status, 403, 'agent B sam nie mógłby zrobić tego ruchu ze skutkiem, więc go nie przyjmie');
  assert.equal(s.rzecz(t.rzecz).cechy.nazwa, 'Dzieło właściciela');
  assert.equal((await s.ruch('agent-b', { op: op(), co: 'odrzuc', propozycja: p.propozycja })).status, 403);
  const wyc = await s.ruch('agent-a', { op: op(), co: 'odrzuc', propozycja: p.propozycja, powod: 'jednak nie' });
  assert.equal(wyc.skutek, 'wycofana', 'autor może swoją propozycję wycofać');
  // z obszaru, w którym agentom nie wolno nic, nie da się niczego wynieść nawet propozycją
  const zamkniety = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Zamknięty', ile_wolno: 'nic' } });
  const wSrodku = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: zamkniety.rzecz, cechy: { nazwa: 'Schowane' } });
  assert.equal((await s.ruch('agent-a', { op: op(), co: 'poloz', rzecz: wSrodku.rzecz, wersja: wSrodku.wersja, rodzaj: 'projekt/1', cechy: { nazwa: 'Schowane' }, obszar: null })).status, 403);
});

test('zmiana rodzaju rzeczy nie omija ochrony rdzenia', async () => {
  const { s, nowe } = await swiat();
  const k = s.ksztalty().get('obszar/1');
  const p = await s.ruch('agent-a', { op: op(), co: 'poloz', rzecz: k.id, wersja: k.wersja, rodzaj: 'projekt/1', cechy: { nazwa: 'to już nie kształt' }, obszar: nowe });
  assert.notEqual(p.skutek, 'polozone');
  if (p.skutek === 'propozycja') assert.equal((await s.ruch('agent-b', { op: op(), co: 'przyjmij', propozycja: p.propozycja })).status, 403);
  assert.ok(s.ksztaltDla('obszar/1'), 'kształt rdzenia stoi');
  // agent nie oznaczy sam własnego rodzaju jako układu
  const u = await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'fuszerka/1', opis: 'x', cechy: {}, uklad: true } });
  assert.equal(u.skutek, 'propozycja');
  assert.equal(s.rzecz(u.propozycja).cechy.wymaga, 'wlasciciel');
  // obszaru z rzeczami nie da się zamienić w coś innego ani odłożyć, także właścicielowi
  const o = s.rzecz(nowe);
  await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'W Nowe' } });
  assert.equal((await s.ruch('jozz', { op: op(), co: 'odloz', rzecz: nowe, wersja: o.wersja })).status, 409);
});

test('kształt: gdy pod nim leżą rzeczy, wolno tylko dokładać; reszta to następne pokolenie', async () => {
  const { s } = await swiat();
  const k = await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: postac });
  // bez rzeczy autor jeszcze stroi kształt dowolnie
  const k2 = await s.ruch('agent-a', { op: op(), co: 'poloz', rzecz: k.rzecz, wersja: k.wersja, rodzaj: 'ksztalt/1', cechy: { ...postac, cechy: { ...postac.cechy, sila: { typ: 'tekst' } } } });
  assert.equal(k2.skutek, 'polozone');
  const k3 = await s.ruch('agent-a', { op: op(), co: 'poloz', rzecz: k.rzecz, wersja: k2.wersja, rodzaj: 'ksztalt/1', cechy: postac });
  await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'postac/1', cechy: { imie: 'Ania', sila: 7 } });
  const zla = await s.ruch('agent-b', { op: op(), co: 'poloz', rzecz: k.rzecz, wersja: k3.wersja, rodzaj: 'ksztalt/1', cechy: { ...postac, cechy: { ...postac.cechy, imie: { typ: 'liczba', wymagana: true } } } });
  assert.equal(zla.status, 409);
  assert.match(zla.blad, /następne pokolenie: postac\/2/);
  const wymagana = await s.ruch('agent-b', { op: op(), co: 'poloz', rzecz: k.rzecz, wersja: k3.wersja, rodzaj: 'ksztalt/1', cechy: { ...postac, cechy: { ...postac.cechy, wiek: { typ: 'liczba', wymagana: true } } } });
  assert.equal(wymagana.status, 409);
  const dobra = await s.ruch('agent-b', { op: op(), co: 'poloz', rzecz: k.rzecz, wersja: k3.wersja, rodzaj: 'ksztalt/1', cechy: { ...postac, cechy: { ...postac.cechy, wiek: { typ: 'liczba' } } } });
  assert.equal(dobra.skutek, 'polozone', JSON.stringify(dobra));
  assert.equal((await s.ruch('agent-b', { op: op(), co: 'odloz', rzecz: k.rzecz, wersja: dobra.wersja })).status, 409, 'kształtu z rzeczami nie da się odłożyć');
});

test('odkładanie, przywracanie i cofanie: każde jest nową wersją, nic nie znika', async () => {
  const { s } = await swiat();
  const a = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Pierwsza' } });
  assert.equal(a.numer, 1);
  const b = await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: a.rzecz, wersja: a.wersja, rodzaj: 'projekt/1', cechy: { nazwa: 'Druga' } });
  assert.equal(b.numer, 2);
  const c = await s.ruch('jozz', { op: op(), co: 'cofnij', rzecz: a.rzecz, wersja: b.wersja });
  assert.equal(c.skutek, 'cofniete');
  assert.equal(c.numer, 3);
  assert.equal(c.z_wersji, a.wersja);
  assert.equal(s.rzecz(a.rzecz).cechy.nazwa, 'Pierwsza');
  const d = await s.ruch('jozz', { op: op(), co: 'cofnij', rzecz: a.rzecz, wersja: c.wersja, do: b.wersja });
  assert.equal(s.rzecz(a.rzecz).cechy.nazwa, 'Druga', 'cofnięcie da się cofnąć: wskazana wersja wraca');
  assert.deepEqual(s.historia(a.rzecz).map((h) => h.numer), [1, 2, 3, 4]);
  assert.equal(s.wersja(a.rzecz, a.wersja).cechy.nazwa, 'Pierwsza');
  const o = await s.ruch('jozz', { op: op(), co: 'odloz', rzecz: a.rzecz, wersja: d.wersja, powod: 'na później' });
  assert.equal(o.skutek, 'odlozone');
  assert.equal(s.spis({ rodzaj: 'projekt/1' }).length, 0, 'odłożona rzecz znika z list');
  assert.equal(s.spis({ rodzaj: 'projekt/1', odlozone: 'tak' }).length, 1);
  assert.equal(s.rzecz(a.rzecz).odlozone, true, 'ale zostaje pod swoim adresem');
  assert.equal(s.rzecz(a.rzecz).powod, 'na później');
  assert.match(stronaRzeczy(s, a.rzecz), /ODŁOŻONA/);
  assert.equal((await s.ruch('jozz', { op: op(), co: 'odloz', rzecz: a.rzecz, wersja: o.wersja })).status, 409);
  const p = await s.ruch('jozz', { op: op(), co: 'przywroc', rzecz: a.rzecz, wersja: o.wersja });
  assert.equal(p.skutek, 'przywrocone');
  assert.equal(s.spis({ rodzaj: 'projekt/1' }).length, 1);
  // agent w obszarze, gdzie tylko proponuje: odłożenie jest propozycją, a przyjęcie ją wykonuje
  const pr = await s.ruch('agent-a', { op: op(), co: 'odloz', rzecz: a.rzecz, wersja: p.wersja });
  assert.equal(pr.skutek, 'propozycja');
  assert.equal((await s.ruch('jozz', { op: op(), co: 'przyjmij', propozycja: pr.propozycja })).skutek, 'przyjeta');
  assert.equal(s.rzecz(a.rzecz).odlozone, true);
});

test('klucz: tożsamość rzeczy liczy się z cech, więc to samo z zewnątrz trafia zawsze w tę samą rzecz', async () => {
  const { s } = await swiat();
  const zly = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'skrzynka/1', opis: 'Repozytorium.', tytul: 'nazwa', klucz: ['numer'], cechy: { numer: { typ: 'liczba' }, nazwa: { typ: 'tekst' } } } });
  assert.equal(zly.status, 422, 'cecha klucza musi być wymagana');
  const k = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'skrzynka/1', opis: 'Repozytorium.', tytul: 'nazwa', klucz: ['numer'], cechy: { numer: { typ: 'liczba', wymagana: true }, nazwa: { typ: 'tekst' } } } });
  assert.equal(k.ok, true, JSON.stringify(k));
  const a = await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'skrzynka/1', cechy: { numer: 7, nazwa: 'jv-web' } });
  const drugi = await s.ruch('agent-b', { op: op(), co: 'poloz', rodzaj: 'skrzynka/1', cechy: { numer: 7, nazwa: 'jv-web-2' } });
  assert.equal(drugi.status, 409, 'rzecz o tym kluczu już jest: ruch prosi o wersję');
  assert.equal(drugi.rzecz, a.rzecz);
  const zm = await s.ruch('agent-b', { op: op(), co: 'poloz', rodzaj: 'skrzynka/1', wersja: 'dowolna', cechy: { numer: 7, nazwa: 'jv-web-2' } });
  assert.equal(zm.skutek, 'polozone');
  assert.equal(zm.rzecz, a.rzecz);
  assert.equal(s.ile({ rodzaj: 'skrzynka/1' }), 1);
  assert.equal(s.rzecz(a.rzecz).cechy.nazwa, 'jv-web-2');
  assert.equal((await s.ruch('agent-a', { op: op(), co: 'poloz', rzecz: a.rzecz, wersja: zm.wersja, rodzaj: 'skrzynka/1', cechy: { numer: 8, nazwa: 'x' } })).status, 422, 'inna wartość klucza to inna rzecz');
});

test('pytanie po cechach i szukanie; lista nie myli podkreślnika z dżokerem', async () => {
  const { s } = await swiat();
  await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'prosba/1', cechy: { tresc: 'Zerknij na Żółwia', stan: 'czeka' } });
  await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'prosba/1', cechy: { tresc: 'Stara sprawa', stan: 'zalatwiona' } });
  assert.equal(s.spis({ rodzaj: 'prosba/1', gdzie: { stan: 'czeka' } }).length, 1);
  assert.equal(s.ile({ rodzaj: 'prosba/1', gdzie: { stan: 'zalatwiona' } }), 1);
  assert.equal(s.czeka().prosby.length, 1);
  assert.equal(s.spis({ szukaj: 'żółwia' }).length, 1, 'szukanie nie patrzy na wielkość liter, także polskich');
  assert.equal(s.spis({ szukaj: '100%_pewne' }).length, 0);
  await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'a_b/1', cechy: { x: 1 } });
  await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'axb/1', cechy: { x: 1 } });
  assert.equal(s.ile({ rodzaj: 'a_b' }), 1);
  assert.equal(s.ile({ rodzaj: '%' }), 0, 'zły zapis rodzaju nie pasuje do niczego');
  assert.match(listaRzeczy(s, { rodzaj: 'prosba/1', gdzie: { stan: 'czeka' } }), /RZECZY rodzaju prosba\/1 \(gdzie stan = czeka\): 1/);
  assert.equal(s.spis({ pomin: 4294967296 }).length, 0, 'duże pomin nie zawija się do zera');
});

test('wywóz i wwóz: po powrocie do pustego Miejsca stoi to samo środowisko', async () => {
  const { r, s, glowny } = await swiat();
  const og = s.rzecz(glowny);
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: glowny, wersja: og.wersja, rodzaj: 'obszar/1', cechy: { ...og.cechy, ile_wolno: 'nic' } });
  const p = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Przeniesiony' } });
  await s.ruch('jozz', { op: op(), co: 'odloz', rzecz: p.rzecz, wersja: p.wersja });
  const obraz = (x) => JSON.stringify([x.q(`SELECT id, rodzaj, obszar, zapis, akt, numer, odlozone, szukane, utworzyl, utworzono, zmienil, zmieniono FROM rzeczy ORDER BY id`), x.q(`SELECT od, cecha, cel FROM odniesienia ORDER BY od, cecha, cel`)]);
  const e = JSON.parse(JSON.stringify(r.eksport()));
  assert.equal(e.wersja, 'miejsce-3');
  const r2 = new Rdzen(sqlZNode());
  assert.equal((await r2.importuj(e)).ok, true);
  const s2 = new Srodowisko(r2);
  s2.przebuduj();
  assert.equal(obraz(s2), obraz(s), 'spis po wwozie jest co do znaku ten sam');
  assert.deepEqual(await s2.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-probny', 'agent-a', 'agent-b', 'agent-0', 'agent-1', 'agent-2', 'podglad'] })), [], 'zasiew niczego nie sieje drugi raz');
  assert.equal(s2.ustawienie(null, 'ile_wolno').wartosc, 'nic', 'ustawienie obszaru głównego przeszło');
  assert.equal(r2.meta('obszar_nowe'), r.meta('obszar_nowe'));
  assert.equal(s2.rzecz(p.rzecz).odlozone, true);
  const bezStanu = (t) => t.split('\n').filter((w) => !w.startsWith('Adres:')).join('\n');
  assert.equal(bezStanu(coTuJest(s2, {})), bezStanu(coTuJest(s, {})), 'opis pod adresem jest ten sam');
  // i odbudowa spisu w miejscu niczego nie zmienia
  const przed = obraz(s);
  s.przebuduj();
  assert.equal(obraz(s), przed);
});

test('ziarna: zmienione w kodzie odświeżają się same, dopóki nikt poza automatem ich nie ruszył', async () => {
  const { r, s } = await swiat();
  const lista = ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-probny', 'agent-a', 'agent-b', 'agent-0', 'agent-1', 'agent-2', 'podglad'] });
  const nazwa = 'zdolnosc-start';
  const id = r.meta('ziarno:' + nazwa);
  const zmien = (opis) => lista.map((z) => (z.nazwa === nazwa ? { ...z, cechy: { ...z.cechy, opis } } : z));
  assert.deepEqual(await s.zasiej(zmien('Nowy opis z kodu.')), [nazwa + ' (odświeżone)']);
  assert.equal(s.rzecz(id).cechy.opis, 'Nowy opis z kodu.');
  assert.equal(s.rzecz(id).numer, 2);
  assert.deepEqual(await s.zasiej(zmien('Nowy opis z kodu.')), [], 'to samo ziarno drugi raz nic nie robi');
  const rz = s.rzecz(id);
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: id, wersja: rz.wersja, rodzaj: rz.rodzaj, cechy: { ...rz.cechy, stan: 'cienko', dowod: 'ręką właściciela' } });
  // 18 XI 2026: czyjaś zmiana dalej wygrywa z zasiewem, ale nowa wersja z kodu nie milknie, tylko kładzie się obok
  // jako propozycja (rejestr poz. 199; zasiew-nie-milknie.test.mjs)
  assert.deepEqual(await s.zasiej(zmien('Jeszcze inny opis z kodu.')), [nazwa + ' (propozycja: domyślny zmienił się po zmianie ręką)'], 'czyjaś zmiana wygrywa z zasiewem, a nowy kod czeka obok');
  assert.equal(s.rzecz(id).cechy.dowod, 'ręką właściciela');
});

test('ponowienie po zmianie świata oddaje pierwszy wynik; kolejka nie gubi równoległych ruchów', async () => {
  const { s, nowe } = await swiat();
  const o1 = op();
  const ruch = { op: o1, co: 'poloz', rodzaj: 'projekt/1', obszar: null, cechy: { nazwa: 'Propozycja agenta' } };
  const p = await s.ruch('agent-a', ruch);
  assert.equal(p.skutek, 'propozycja');
  const og = s.rzecz(s.r.meta('obszar_glowny'));
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: og.id, wersja: og.wersja, rodzaj: 'obszar/1', cechy: { ...og.cechy, ile_wolno: 'prowadzic' } });
  const znow = await s.ruch('agent-a', ruch);
  assert.equal(znow.powtorzone, true);
  assert.equal(znow.skutek, 'propozycja', 'ponowienie nie ocenia ruchu drugi raz w zmienionym świecie');
  assert.equal(znow.propozycja, p.propozycja);
  const wyniki = await Promise.all(Array.from({ length: 24 }, (_, i) => s.ruch('agent-' + (i % 3), { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: nowe, cechy: { nazwa: 'Równoległy ' + i } })));
  assert.equal(wyniki.filter((w) => w.skutek === 'polozone').length, 24, JSON.stringify(wyniki.find((w) => w.skutek !== 'polozone')));
});

test('granice: zagnieżdżenie obszarów, surowe wartości, czas i adres', async () => {
  const { s } = await swiat();
  let rodzic = null;
  for (let i = 0; i < 31; i++) {
    const w = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'obszar/1', obszar: rodzic, cechy: { nazwa: 'Poziom ' + i, ...(i === 0 ? { ile_wolno: 'nic' } : {}) } });
    assert.equal(w.skutek, 'polozone', `poziom ${i}: ${JSON.stringify(w)}`);
    rodzic = w.rzecz;
  }
  assert.equal(s.ustawienie(rodzic, 'ile_wolno').wartosc, 'nic', 'ustawienie z korzenia dochodzi na samo dno');
  let za = rodzic, ostatni;
  for (let i = 0; i < 3; i++) { ostatni = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'obszar/1', obszar: za, cechy: { nazwa: 'Głębiej ' + i } }); if (ostatni.ok) za = ostatni.rzecz; }
  assert.equal(ostatni.status, 422);
  assert.match(ostatni.blad, /najwyżej na 32 poziomy/);
  const gleboka = JSON.parse('{"a":'.repeat(60) + '1' + '}'.repeat(60));
  assert.equal((await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'cos/1', cechy: gleboka })).status, 400);
  assert.equal((await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'cos/1', cechy: { x: Infinity } })).status, 400);
  const czas = (w) => s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'x', zycie: w } });
  assert.equal((await czas('2026-02-30')).status, 422);
  assert.equal((await czas('2026-02-28T10:00:00Z')).skutek, 'polozone');
  const adres = (w) => s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'x', zrodlo: w } });
  assert.equal((await adres('https://przyklad.pl/\u0007')).status, 422);
  assert.equal((await adres('HTTPS://EXAMPLE.COM/')).skutek, 'polozone');
  assert.equal((await adres('javascript:alert(1)')).status, 422);
});

test('propozycje nie zalewają listy: jedna czekająca na rzecz i najwyżej dwadzieścia naraz od jednego uczestnika', async () => {
  const { s, nowe } = await swiat();
  const t = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Rzecz' } });
  const zmiana = (kto, nazwa) => s.ruch(kto, { op: op(), co: 'poloz', rzecz: t.rzecz, wersja: t.wersja, rodzaj: 'projekt/1', cechy: { nazwa } });
  const p1 = await zmiana('agent-a', 'Raz');
  assert.equal(p1.skutek, 'propozycja');
  const p2 = await zmiana('agent-a', 'Dwa');
  assert.equal(p2.status, 409, 'druga czekająca propozycja tej samej rzeczy od tego samego uczestnika');
  assert.equal(p2.propozycja, p1.propozycja);
  assert.equal((await zmiana('agent-b', 'Od B')).skutek, 'propozycja', 'inny uczestnik ma własną');
  await s.ruch('agent-a', { op: op(), co: 'odrzuc', propozycja: p1.propozycja });
  assert.equal((await zmiana('agent-a', 'Dwa')).skutek, 'propozycja', 'po wycofaniu wolno zaproponować od nowa');
  for (let i = 0; i < 19; i++) assert.equal((await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: null, cechy: { nazwa: 'Nowa ' + i } })).skutek, 'propozycja');
  const za = await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: null, cechy: { nazwa: 'O jedną za dużo' } });
  assert.equal(za.status, 429);
  assert.match(za.blad, /20 czekających propozycji/);
  // propozycja, która zmienia prawa, jest na liście odróżniona od zwykłej, a tekst mówi, że uczestnik to nie klucz
  const o = s.rzecz(nowe);
  await s.ruch('agent-b', { op: op(), co: 'poloz', rzecz: nowe, wersja: o.wersja, rodzaj: 'obszar/1', cechy: { ...o.cechy, ile_wolno: 'nic' } });
  const tekst = coTuJest(s, {});
  assert.match(tekst, /propozycja od agent-b \[ZMIENIA PRAWA ALBO UCZESTNIKÓW: przyjmuje tylko właściciel\]/);
  assert.match(tekst, /nie daje nikomu klucza/);
});

test('klucz próbny właściciela wychodzi do strony tylko na podglądzie', async () => {
  const { s } = await swiat();
  assert.equal(opisDane(s, { podglad: true, kluczProbnyWlasciciela: 'jawny-klucz-wlasciciela' }).klucz_probny_wlasciciela, 'jawny-klucz-wlasciciela');
  assert.equal(opisDane(s, { podglad: false, kluczProbnyWlasciciela: 'jawny-klucz-wlasciciela' }).klucz_probny_wlasciciela, null);
  assert.doesNotMatch(coTuJest(s, { podglad: true, kluczProbny: 'k-agenta', kluczProbnyWlasciciela: 'jawny-klucz-wlasciciela' }), /jawny-klucz-wlasciciela/, 'tekst dla agentów podaje tylko klucz agenta');
});

test('U1. uczestnik odłożony traci prawa, przywrócony je odzyskuje - i to jest jedyna droga do odebrania wstępu', async () => {
  // Nowy mechanizm, nie poprawka: skoro prawa są z danych, właściciel może odebrać je ruchem, który sam jest
  // odwracalny. Usunięcia Miejsce nie ma w ogóle, więc "odłożony" jest tu tym, czym odebranie wstępu.
  const { s, nowe } = await swiat();
  const przed = await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: nowe, cechy: { nazwa: 'Przed odłożeniem' } });
  assert.equal(przed.skutek, 'polozone', JSON.stringify(przed));
  const u = s.spis({ rodzaj: 'uczestnik/1', gdzie: { imie: 'agent-a' }, limit: 1 })[0];
  assert.ok(u, 'uczestnik jest rzeczą, którą właściciel widzi');

  const o = await s.ruch('jozz', { op: op(), co: 'odloz', rzecz: u.id, wersja: u.wersja, powod: 'na razie nie rusza' });
  assert.equal(o.skutek, 'odlozone', JSON.stringify(o));
  assert.equal(s.rola('agent-a'), 'zwiedzajacy', 'odłożony uczestnik nie jest uczestnikiem');
  const po = await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: nowe, cechy: { nazwa: 'Po odłożeniu' } });
  assert.equal(po.ok, false);
  assert.equal(po.status, 401);
  assert.match(po.blad, /klucz jest poprawny, ale/, 'i słyszy, dlaczego, zamiast "podaj klucz"');
  // drugi agent nie traci nic: odłożenie dotyczy jednego imienia
  const b = await s.ruch('agent-b', { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: nowe, cechy: { nazwa: 'Inny agent' } });
  assert.equal(b.skutek, 'polozone');

  const wroc = await s.ruch('jozz', { op: op(), co: 'przywroc', rzecz: u.id, wersja: s.rzecz(u.id, { odlozone: 'razem' }).wersja });
  assert.equal(wroc.skutek, 'przywrocone', JSON.stringify(wroc));
  assert.equal(s.rola('agent-a'), 'agent');
  const znow = await s.ruch('agent-a', { op: op(), co: 'poloz', rodzaj: 'projekt/1', obszar: nowe, cechy: { nazwa: 'Po powrocie' } });
  assert.equal(znow.skutek, 'polozone', JSON.stringify(znow));
});

test('U2. rola bierze się z rzeczy uczestnika, ale roli właściciela nadać nie może', async () => {
  const { s } = await swiat();
  const u = s.spis({ rodzaj: 'uczestnik/1', gdzie: { imie: 'agent-b' }, limit: 1 })[0];
  const nacel = async (rola) => {
    const teraz = s.rzecz(u.id);
    const w = await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: u.id, wersja: teraz.wersja, rodzaj: 'uczestnik/1', cechy: { ...teraz.cechy, rola } });
    assert.equal(w.ok, true, JSON.stringify(w));
  };
  await nacel('automat');
  assert.equal(s.rola('agent-b'), 'automat', 'automat jest daną, nie wyjątkiem w kodzie');
  await nacel('wlasciciel');
  assert.equal(s.rola('agent-b'), 'agent', 'właścicielem jest jedno imię z ustawienia Workera i rzecz tego nie zmienia');
  assert.equal(s.rola('jozz'), 'wlasciciel');
  // uczestnika dopisuje i zmienia tylko właściciel: ruch agenta na tej rzeczy nie ma skutku
  const teraz = s.rzecz(u.id);
  const proba = await s.ruch('agent-a', { op: op(), co: 'poloz', rzecz: u.id, wersja: teraz.wersja, rodzaj: 'uczestnik/1', cechy: { ...teraz.cechy, rola: 'agent' } });
  assert.notEqual(proba.skutek, 'polozone', JSON.stringify(proba));
});

test('ZS1. obudzone Miejsce nie pyta bazy o każde ziarno z osobna: ten sam zasiew drugi raz to jedno pytanie, a zmiana ziaren uruchamia pełne przejście', async () => {
  const { Rdzen } = await import('./miejsce.mjs');
  const { sqlZNode } = await import('./sql-node.mjs');
  const { Srodowisko } = await import('./srodowisko.mjs');
  const { ziarna } = await import('./ziarna.mjs');
  const prawdziwy = sqlZNode();
  let pytan = 0;
  const liczacy = new Proxy(prawdziwy, { get(cel, n) { const w = Reflect.get(cel, n, cel); return n === 'exec' ? (...a) => { pytan++; return cel.exec(...a); } : (typeof w === 'function' ? w.bind(cel) : w); } });
  let t = Date.UTC(2026, 10, 18, 14, 0, 0);
  const r = new Rdzen(liczacy, { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  const zestaw = ziarna({ wlasciciel: 'jozz' });
  const pierwszy = await s.zasiej(zestaw);
  assert.ok(pierwszy.length > 50, 'pierwszy zasiew kładzie ziarna');
  const rzeczy = s.ile({ odlozone: 'razem' });
  pytan = 0;
  assert.deepEqual(await s.zasiej(ziarna({ wlasciciel: 'jozz' })), [], 'drugi raz nic nie sieje');
  // jedno pytanie o odcisk i po jednym, dwóch na każde ziarno liczone funkcją (dziś dwa przykładowe narzędzia)
  assert.ok(pytan <= 8, `ten sam zasiew drugi raz pyta bazę ${pytan} razy (ma najwyżej 8; przed 18 XI: 243)`);
  // zmiana ziarna w kodzie: pełne przejście odświeża to jedno ziarno i zapamiętuje nowy odcisk
  const zmienione = ziarna({ wlasciciel: 'jozz' }).map((z) => (z.nazwa === 'obszar-nowe' ? { ...z, cechy: { ...z.cechy, opis: z.cechy.opis + ' (zmienione w kodzie)' } } : z));
  assert.deepEqual(await s.zasiej(zmienione), ['obszar-nowe (odświeżone)']);
  pytan = 0;
  assert.deepEqual(await s.zasiej(zmienione), []);
  assert.ok(pytan <= 8, `po odświeżeniu znowu ${pytan} pytań (ma najwyżej 8)`);
  // nowe ziarno: też pełne przejście, a rzeczy przybywa dokładnie jedna
  const dolozone = [...zmienione, { nazwa: 'proba-zs1', rodzaj: 'projekt/1', cechy: { nazwa: 'Projekt z ziarna' } }];
  assert.deepEqual(await s.zasiej(dolozone), ['proba-zs1']);
  assert.equal(s.ile({ odlozone: 'razem' }), rzeczy + 1);
  // dosianie uczestnika nie rusza odcisku zasiewu podstawowego
  await s.zasiej([{ nazwa: 'uczestnik-agent-zs1', rodzaj: 'uczestnik/1', cechy: { imie: 'agent-zs1', rola: 'agent' } }]);
  assert.equal(s.rola('agent-zs1'), 'agent');
  pytan = 0;
  assert.deepEqual(await s.zasiej(dolozone), []);
  assert.ok(pytan <= 8);
  // ręka wygrywa jak dotąd: ziarno zmienione przez właściciela zostaje po jego zmianie także po zmianie kodu
  const nowe = s.rzecz(r.meta('obszar_nowe'));
  const reka = await s.ruch('jozz', { op: 'zs1-reka-0001', co: 'poloz', rzecz: nowe.id, wersja: nowe.wersja, rodzaj: 'obszar/1', cechy: { ...nowe.cechy, opis: 'Opis z ręki właściciela.' } });
  assert.equal(reka.ok, true, JSON.stringify(reka));
  const jeszczeInaczej = dolozone.map((z) => (z.nazwa === 'obszar-nowe' ? { ...z, cechy: { ...z.cechy, opis: 'Trzecia wersja z kodu.' } } : z));
  assert.deepEqual(await s.zasiej(jeszczeInaczej), ['obszar-nowe (propozycja: domyślny zmienił się po zmianie ręką)'], 'ręka wygrywa, a nowy kod czeka obok jako propozycja (18 XI)');
  assert.equal(s.rzecz(nowe.id).cechy.opis, 'Opis z ręki właściciela.');
  assert.deepEqual(await s.zasiej(jeszczeInaczej), [], 'ta sama zmiana kodu drugi raz nie kładzie drugiej propozycji');
  // ziarno liczone funkcją odświeża się, gdy zmieni się to, z czego liczy, choć tekst funkcji zostaje ten sam
  // (tak przykładowe narzędzia biorą swój kod ze stałej): pierwsza wersja odcisku tego nie widziała
  let zrodlo = 'pierwsza wersja';
  const zFunkcja = () => [...jeszczeInaczej, { nazwa: 'proba-zs1-funkcja', rodzaj: 'projekt/1', cechy: async () => ({ nazwa: 'Projekt liczony funkcją', opis: zrodlo }) }];
  assert.deepEqual(await s.zasiej(zFunkcja()), ['proba-zs1-funkcja']);
  assert.deepEqual(await s.zasiej(zFunkcja()), []);
  zrodlo = 'druga wersja';
  assert.deepEqual(await s.zasiej(zFunkcja()), ['proba-zs1-funkcja (odświeżone)'], 'zmiana źródła poza tekstem funkcji uruchamia odświeżenie');
  assert.equal(s.spis({ rodzaj: 'projekt/1', gdzie: { nazwa: 'Projekt liczony funkcją' }, limit: 1 })[0].cechy.opis, 'druga wersja');
  assert.deepEqual(await s.zasiej(zFunkcja()), []);
});

test('AR1. indeks złożony rzeczy_rodzaj (rodzaj, odlozone, zmieniono DESC, id): przegląd rodzaju nie sortuje w pamięci (brak TEMP B-TREE) i migruje stary jednokolumnowy indeks', async () => {
  const sql = sqlZNode();
  const r = new Rdzen(sql, { wlasciciel: 'jozz' });
  // Symulujemy bazę ze starym jednokolumnowym indeksem rzeczy_rodzaj
  sql.exec(`CREATE TABLE IF NOT EXISTS rzeczy (id TEXT PRIMARY KEY, rodzaj TEXT NOT NULL, obszar TEXT, zapis TEXT NOT NULL, akt INTEGER NOT NULL, numer INTEGER NOT NULL DEFAULT 1, odlozone INTEGER NOT NULL DEFAULT 0, szukane TEXT NOT NULL DEFAULT '', utworzyl TEXT NOT NULL, utworzono INTEGER NOT NULL, zmienil TEXT NOT NULL, zmieniono INTEGER NOT NULL)`);
  sql.exec(`CREATE INDEX rzeczy_rodzaj ON rzeczy (rodzaj)`);
  const s = new Srodowisko(r);
  void s;
  const def = sql.exec(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'rzeczy_rodzaj'`).toArray()[0];
  assert.match(String(def && def.sql), /zmieniono\s+DESC/i, 'stary indeks został zastąpiony indeksem złożonym ze zmieniono DESC');
  const plan = sql.exec(`EXPLAIN QUERY PLAN SELECT r.*, z.tresc FROM rzeczy r JOIN zapisy z ON z.id = r.zapis WHERE r.odlozone = 0 AND r.rodzaj = ? ORDER BY r.zmieniono DESC, r.id LIMIT 50`, 'projekt/1').toArray();
  const opisPlanu = plan.map((w) => w.detail).join(' | ');
  assert.match(opisPlanu, /USING INDEX rzeczy_rodzaj/);
  assert.doesNotMatch(opisPlanu, /USE TEMP B-TREE/i, 'kolejność idzie prosto z indeksu rzeczy_rodzaj bez sortowania w pamięci');
});

test('AR2. historia rzeczy z limitem: trasa /api/srodowisko/rzecz zwraca domyślnie 50 najnowszych wersji z zachowaniem ich numerów i znacznikiem historia_wiecej', async () => {
  const { s } = await swiat();
  const zap = (sciezka, { kto = 'jozz' } = {}) => obsluzSrodowisko(s, new Request('https://przyklad.test' + sciezka, { headers: { 'x-kto': kto } }), { podglad: true });
  const p0 = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'P-0' } });
  assert.equal(p0.ok, true);
  const id = p0.rzecz;
  let aktWersji = p0.wersja;
  for (let i = 1; i < 65; i++) {
    const w = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', rzecz: id, wersja: aktWersji, cechy: { nazwa: 'P-' + i } });
    assert.equal(w.ok, true, JSON.stringify(w));
    aktWersji = w.wersja;
  }
  // Pełna historia bez limitu nadal ma wszystkie 65 wersji (1..65)
  const pelna = s.historia(id);
  assert.equal(pelna.length, 65);
  assert.equal(pelna[0].numer, 1);
  assert.equal(pelna[64].numer, 65);
  // Domyślny odczyt przez drzwi HTTP oddaje 50 najnowszych wersji (numery 16..65) i historia_wiecej: true
  const odp50 = await (await zap('/api/srodowisko/rzecz?id=' + id)).json();
  assert.equal(odp50.ok, true);
  assert.equal(odp50.historia.length, 50);
  assert.equal(odp50.historia[0].numer, 16);
  assert.equal(odp50.historia[49].numer, 65);
  assert.equal(odp50.historia_wiecej, true);
  // Jawne ?historia=100 oddaje wszystkie 65 wersji bez historia_wiecej
  const odp100 = await (await zap('/api/srodowisko/rzecz?id=' + id + '&historia=100')).json();
  assert.equal(odp100.historia.length, 65);
  assert.equal(odp100.historia[0].numer, 1);
  assert.equal(odp100.historia_wiecej, undefined);
});

// Druga linia łatki Toru 3 (Opus Code, 27 XI 2026): łatka zmieniła to, co oddają drzwi, a ich opis został stary
// (uwaga Fable). Ten sprawdzian pilnuje, żeby opis trasy i umowa okna mówiły o limicie historii, a kształt kształtów
// o lezy_z, którego dopisku żaden wcześniejszy sprawdzian nie łapał (mutacja zdejmująca go przechodziła wszystkie).
test('AR3. drzwi mówią to, co robią po Torze 3: trasa rzecz i umowa okna znają limit historii i historia_wiecej, a kształt kształtów opisuje lezy_z', async () => {
  const { czasowniki } = await import('./opis.mjs');
  const { s } = await swiat();
  const trasa = czasowniki(s).find((c) => c.nazwa === 'rzecz');
  assert.ok(trasa, 'trasa rzecz stoi w spisie czasowników');
  assert.match(trasa.ktoredy, /historia=/);
  assert.match(trasa.wynik, /historia_wiecej\?/);
  assert.match(trasa.opis, /domyślnie 50, najwyżej 1000/);
  assert.match(umowaOkna(), /read rzecz .*historia_wiecej\?/);
  assert.match(umowaOkna(), /historia\?: <ile wersji>/);
  assert.match(umowaOkna(), /read +\{id, what: "rzecz", rzecz: "<id>", historia\?\}/, 'wiersz żądania też zna historia');
  const k = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'wezel/1', opis: 'Węzeł: leży tam, gdzie jego dom.', lezy_z: 'dom', cechy: { nazwa: { typ: 'tekst', wymagana: true }, dom: { typ: 'rzecz', wymagana: true } } } });
  assert.equal(k.ok, true, JSON.stringify(k));
  const strona = stronaRzeczy(s, k.rzecz, { kto: 'jozz' });
  assert.match(strona, /lezy_z: dom/);
  assert.doesNotMatch(strona, /lezy_z \[cecha spoza kształtu\]/, 'kształt kształtów zna cechę lezy_z');
});
