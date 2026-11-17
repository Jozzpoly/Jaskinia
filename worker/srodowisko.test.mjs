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
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  return { r, s, nowe: r.meta('obszar_nowe'), glowny: r.meta('obszar_glowny') };
}
const postac = { dla: 'postac/1', opis: 'Postać ze świata gry.', tytul: 'imie', cechy: { imie: { typ: 'tekst', wymagana: true }, sila: { typ: 'liczba' }, z_projektu: { typ: 'rzecz', rodzaj: 'projekt/1' } } };

test('zasiew: środowisko opisuje samo siebie i nie sieje dwa razy', async () => {
  const { s } = await swiat();
  const przed = s.spis().length;
  assert.ok(s.ksztaltDla('ksztalt/1'), 'kształt kształtu jest rzeczą');
  assert.ok(s.ksztaltDla('obszar/1') && s.ksztaltDla('gosc/1') && s.ksztaltDla('projekt/1'));
  assert.deepEqual(await s.zasiej(ziarna({ wlasciciel: 'jozz' })), []);
  assert.equal(s.spis().length, przed);
  assert.equal(s.rola('jozz'), 'wlasciciel');
  assert.equal(s.rola('ktos-z-kluczem'), 'agent');
  assert.equal(s.rola(null), 'zwiedzajacy');
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
  // agent nie przestawi ustawienia sam
  const o2 = s.rzecz(nowe);
  const proba = await s.ruch('agent-probny', { op: op(), co: 'poloz', rzecz: nowe, wersja: o2.wersja, rodzaj: 'obszar/1', cechy: { ...o2.cechy, ile_wolno: 'prowadzic' } });
  assert.equal(proba.status, 403);
  assert.match(proba.blad, /zmienia tylko właściciel/);
  assert.equal((await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'uczestnik/1', cechy: { imie: 'agent-probny', rola: 'wlasciciel' } })).status, 403);
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
  assert.equal(znow.status, 409, 'rozstrzygnięta propozycja nie przyjmie się drugi raz');
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
  assert.equal(s.kodGoscia(k.zapis), '<!doctype html><title>x</title><p>gość</p>');
  const g = await s.ruch('agent-probny', { op: op(), co: 'poloz', rodzaj: 'gosc/1', cechy: { nazwa: 'Mój', opis: 'próba', kod: k.zapis, umowa: 'okno/2' } });
  assert.equal(g.skutek, 'polozone');
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
  assert.match(umowaOkna(), /NAJMNIEJSZY DZIAŁAJĄCY GOŚĆ/);
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
