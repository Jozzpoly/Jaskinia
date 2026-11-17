// Sprawdziany ruchu z okna (17 XI 2026): gość pisze pod własnym imieniem, a ten, kto otworzył okno, zostaje przy
// akcie jako kontekst. Prawo jest słabszym z dwóch: gościa (dziś takie jak agenta w obszarze) i otwierającego.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen, skrot } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { wczytajKlucze, PRZEDROSTEK_GOSCIA } from './klucze.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';
import { coTuJest, umowaOkna, czasowniki } from './opis.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 15, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  // Od 17 XI prawa bierze się z rzeczy uczestnika, nie z samego imienia: świat sprawdzianu zasiewa agenta jako rzecz,
  // tak jak Miejsce zasiewa imiona z kluczy.
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const goscie = s.spis({ rodzaj: 'gosc/1', limit: 20 });
  const slowa = goscie.find((g) => g.cechy.nazwa === 'Słowa'), lista = goscie.find((g) => g.cechy.nazwa === 'Lista rzeczy');
  const projekt = await s.ruch('jozz', { op: 'gosc-test-projekt', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Próbny projekt' } });
  assert.equal(projekt.ok, true, JSON.stringify(projekt));
  return { r, s, slowa, lista, projekt: projekt.rzecz, nowe: r.meta('obszar_nowe'), aktor: PRZEDROSTEK_GOSCIA + slowa.id };
}
const slowo = (projekt, tresc = 'Słowo z narzędzia') => ({ co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc, dotyczy: [projekt] } });

test('G1. zasiane są dwa pokolenia umowy okna obok siebie: gość, który czyta (okno/2), i gość, który pisze (okno/3)', async () => {
  const { s, slowa, lista } = await swiat();
  assert.equal(lista.cechy.umowa, 'okno/2');
  assert.equal(slowa.cechy.umowa, 'okno/3');
  assert.match(coTuJest(s, { origin: 'https://proba.example' }), /Umowy okna w użyciu: okno\/2: 1, okno\/3: 1/);
  assert.match(umowaOkna(), /RUCH Z OKNA \(okno\/3\)/);
  assert.ok(czasowniki(s).some((c) => c.nazwa === 'ruch-z-okna'), 'ruch z okna stoi w spisie czasowników');
});

test('G2. ruch z okna zapisuje się pod imieniem gościa; ten, kto otworzył okno, stoi przy akcie jako kontekst', async () => {
  const { s, slowa, projekt, nowe, aktor } = await swiat();
  const w = await s.ruch('jozz', { op: 'gosc-test-g2-a', ...slowo(projekt) }, { gosc: slowa.id, slad: 'okno goscia' });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.skutek, 'polozone', 'nowa rzecz gościa bez obszaru ląduje w Nowe, gdzie agentom i gościom wolno prowadzić');
  const rz = s.rzecz(w.rzecz);
  assert.equal(rz.obszar, nowe);
  assert.equal(rz.utworzyl, aktor, 'autorem jest narzędzie, nie właściciel, w którego oknie pisało');
  const h = s.historia(w.rzecz);
  assert.equal(h[0].kto, aktor);
  assert.equal(h[0].cialo, 'okno:jozz okno goscia', 'przy akcie stoi, w czyim oknie i czym pisano');
  // ślad, którego jądro nie przyjmuje (znaki spoza ASCII), nie gubi tego, w czyim oknie pisał gość
  const drugi = await s.ruch('jozz', { op: 'gosc-test-g2-b', ...slowo(projekt, 'drugie') }, { gosc: slowa.id, slad: 'okno gościa' });
  assert.equal(s.historia(drugi.rzecz)[0].cialo, 'okno:jozz');
  assert.equal(s.rola(aktor), 'gosc');
  // tekst pod adresem mówi, które to narzędzie, zamiast samego identyfikatora
  assert.match(coTuJest(s, { origin: 'https://proba.example' }), /gosc-[a-z0-9]{26} \(narzędzie "Słowa"\) dołożył: Słowo z narzędzia/);
});

test('G3. tam, gdzie wolno tylko proponować, ruch z okna jest propozycją, także w oknie właściciela; właściciel przyjmuje ją własną ręką', async () => {
  const { s, slowa, projekt, aktor } = await swiat();
  const w = await s.ruch('jozz', { op: 'gosc-test-g3-a', ...slowo(projekt), obszar: null }, { gosc: slowa.id });
  assert.equal(w.skutek, 'propozycja', JSON.stringify(w));
  const pr = s.rzecz(w.propozycja);
  assert.deepEqual([pr.cechy.od, pr.cechy.przez, pr.cechy.stan], [aktor, 'jozz', 'czeka']);
  assert.equal(s.ile({ rodzaj: 'slowo/1' }), 0, 'nic się jeszcze nie zapisało');
  // z okna propozycji się nie rozstrzyga
  const zOkna = await s.ruch('jozz', { op: 'gosc-test-g3-b', co: 'przyjmij', propozycja: w.propozycja }, { gosc: slowa.id });
  assert.equal(zOkna.status, 403);
  const reka = await s.ruch('jozz', { op: 'gosc-test-g3-c', co: 'przyjmij', propozycja: w.propozycja });
  assert.equal(reka.ok, true, JSON.stringify(reka));
  assert.equal(s.rzecz(reka.rzecz).obszar, null);
});

test('G4. okno nie ma więcej prawa niż ten, kto je otworzył: bez klucza nie pisze, a w obszarze zamkniętym dla agentów dostaje odmowę', async () => {
  const { s, slowa, projekt, nowe } = await swiat();
  const bez = await s.ruch(null, { op: 'gosc-test-g4-a', ...slowo(projekt) }, { gosc: slowa.id });
  assert.equal(bez.status, 401);
  // agent otwiera narzędzie: w Nowe pisze ze skutkiem, w głównym proponuje
  const wNowe = await s.ruch('agent-a', { op: 'gosc-test-g4-b', ...slowo(projekt) }, { gosc: slowa.id });
  assert.equal(wNowe.skutek, 'polozone', JSON.stringify(wNowe));
  const wGlownym = await s.ruch('agent-a', { op: 'gosc-test-g4-c', ...slowo(projekt), obszar: null }, { gosc: slowa.id });
  assert.equal(wGlownym.skutek, 'propozycja');
  assert.equal(s.rzecz(wGlownym.propozycja).cechy.przez, 'agent-a');
  // właściciel zamyka Nowe dla agentów: narzędzie w oknie właściciela też tam nie pisze (gość ma tyle prawa co agent)
  const obszar = s.rzecz(nowe);
  const zamkniecie = await s.ruch('jozz', { op: 'gosc-test-g4-d', co: 'poloz', rodzaj: 'obszar/1', rzecz: nowe, wersja: 'dowolna', cechy: { ...obszar.cechy, ile_wolno: 'nic' } });
  assert.equal(zamkniecie.ok, true, JSON.stringify(zamkniecie));
  const odmowa = await s.ruch('jozz', { op: 'gosc-test-g4-e', ...slowo(projekt, 'drugie') }, { gosc: slowa.id });
  assert.equal(odmowa.status, 403, JSON.stringify(odmowa));
});

test('G5. pisze tylko gość, który jest, nie jest odłożony i zgłosił umowę okno/3', async () => {
  const { s, slowa, lista, projekt } = await swiat();
  const nieMa = await s.ruch('jozz', { op: 'gosc-test-g5-a', ...slowo(projekt) }, { gosc: 'a'.repeat(26) });
  assert.equal(nieMa.status, 404);
  const nieGosc = await s.ruch('jozz', { op: 'gosc-test-g5-b', ...slowo(projekt) }, { gosc: projekt });
  assert.equal(nieGosc.status, 404, 'rzecz, która nie jest gościem, nie jest aktorem');
  const zly = await s.ruch('jozz', { op: 'gosc-test-g5-c', ...slowo(projekt) }, { gosc: 'nie-id' });
  assert.equal(zly.status, 400);
  const stara = await s.ruch('jozz', { op: 'gosc-test-g5-d', ...slowo(projekt) }, { gosc: lista.id });
  assert.equal(stara.status, 409, 'gość pokolenia 2 czyta, nie pisze');
  assert.match(stara.blad, /okno\/3/);
  await s.ruch('jozz', { op: 'gosc-test-g5-e', co: 'odloz', rzecz: slowa.id, wersja: 'dowolna', powod: 'próba' });
  const odlozony = await s.ruch('jozz', { op: 'gosc-test-g5-f', ...slowo(projekt) }, { gosc: slowa.id });
  assert.equal(odlozony.status, 409);
});

test('G6. ruch zastrzeżony dla właściciela jest z okna propozycją do niego, także gdy okno otworzył on sam', async () => {
  const { s, slowa, nowe } = await swiat();
  const obszar = s.rzecz(nowe);
  const w = await s.ruch('jozz', { op: 'gosc-test-g6-a', co: 'poloz', rodzaj: 'obszar/1', rzecz: nowe, wersja: 'dowolna', cechy: { ...obszar.cechy, ile_wolno: 'nic' } }, { gosc: slowa.id });
  assert.equal(w.skutek, 'propozycja', JSON.stringify(w));
  assert.equal(w.kto_przyjmuje, 'wlasciciel');
  assert.equal(s.rzecz(nowe).cechy.ile_wolno, obszar.cechy.ile_wolno, 'ustawienie obszaru się nie zmieniło');
});

test('G7. propozycje z okien liczą się też temu, kto je otworzył: drugie narzędzie nie obchodzi granicy', async () => {
  const { s, slowa, projekt } = await swiat();
  for (let i = 0; i < 20; i++) {
    const w = await s.ruch('agent-a', { op: 'gosc-test-g7-' + i, ...slowo(projekt, 'słowo ' + i), obszar: null }, { gosc: slowa.id });
    assert.equal(w.skutek, 'propozycja', i + ': ' + JSON.stringify(w));
  }
  const ponad = await s.ruch('agent-a', { op: 'gosc-test-g7-ponad', ...slowo(projekt, 'za dużo'), obszar: null }, { gosc: slowa.id });
  assert.equal(ponad.status, 429);
  // drugie narzędzie (ten sam kod, osobna rzecz) w tych samych rękach
  const drugie = await s.ruch('jozz', { op: 'gosc-test-g7-drugi-gosc', co: 'poloz', rodzaj: 'gosc/1', cechy: { nazwa: 'Słowa bis', opis: 'Drugi gość do próby.', kod: slowa.cechy.kod, umowa: 'okno/3' } });
  assert.equal(drugie.ok, true, JSON.stringify(drugie));
  const obejscie = await s.ruch('agent-a', { op: 'gosc-test-g7-obejscie', ...slowo(projekt, 'bokiem'), obszar: null }, { gosc: drugie.rzecz });
  assert.equal(obejscie.status, 429, JSON.stringify(obejscie));
  assert.match(obejscie.blad, /z ruchów uczestnika agent-a i z okien, które otworzył/);
  // otwierający może wycofać propozycję swojego okna, ale nie przyjąć
  const jedna = s.spis({ rodzaj: 'propozycja/1', gdzie: { przez: 'agent-a', stan: 'czeka' }, limit: 1 })[0];
  const przyjecie = await s.ruch('agent-a', { op: 'gosc-test-g7-przyjmij', co: 'przyjmij', propozycja: jedna.id });
  assert.equal(przyjecie.status, 403);
  const wycofanie = await s.ruch('agent-a', { op: 'gosc-test-g7-wycofaj', co: 'odrzuc', propozycja: jedna.id });
  assert.equal(wycofanie.skutek, 'wycofana', JSON.stringify(wycofanie));
});

test('G8. imienia gościa nie nosi żaden klucz i nie da się pod nim działać bez okna', async () => {
  const { s, slowa, projekt, aktor } = await swiat();
  const k = wczytajKlucze({ KLUCZE: JSON.stringify({ jozz: await skrot('klucz-wlasciciela-dlugi'), [aktor]: await skrot('klucz-podszywacza-dlugi'), 'gosc-cokolwiek': await skrot('inny-klucz-podszywacza') }) });
  assert.deepEqual(k.wpisy.map(([imie]) => imie), ['jozz'], 'wpisy o imieniu gosc-… wypadają przy wczytaniu');
  const wprost = await s.ruch(aktor, { op: 'gosc-test-g8-a', ...slowo(projekt) });
  assert.equal(wprost.status, 403);
  // a zagnieżdżenie: gość nie otwiera okna gościowi
  const wOknieGoscia = await s.ruch(aktor, { op: 'gosc-test-g8-b', ...slowo(projekt) }, { gosc: slowa.id });
  assert.equal(wOknieGoscia.status, 403);
});

test('G9. ponowienie tego samego ruchu z okna niczego nie robi dwa razy', async () => {
  const { s, slowa, projekt } = await swiat();
  const a = await s.ruch('jozz', { op: 'gosc-test-g9-ten-sam', ...slowo(projekt) }, { gosc: slowa.id });
  const b = await s.ruch('jozz', { op: 'gosc-test-g9-ten-sam', ...slowo(projekt) }, { gosc: slowa.id });
  assert.equal(b.powtorzone, true, JSON.stringify(b));
  assert.equal(b.rzecz, a.rzecz);
  assert.equal(s.ile({ rodzaj: 'slowo/1' }), 1);
  // ten sam op w zwykłych rękach właściciela to inna czynność innego uczestnika: nie zderzają się
  const reka = await s.ruch('jozz', { op: 'gosc-test-g9-ten-sam', ...slowo(projekt, 'ręką') });
  assert.equal(reka.ok, true, JSON.stringify(reka));
  assert.notEqual(reka.rzecz, a.rzecz);
});

test('G10. drzwi: nagłówek X-Gosc zamienia ruch uczestnika w ruch z okna; bez klucza okno nie pisze', async () => {
  const { s, slowa, projekt, aktor } = await swiat();
  const zadanie = (naglowki, cialo) => new Request('https://proba.example/api/srodowisko/ruch', { method: 'POST', headers: { 'content-type': 'application/json', ...naglowki }, body: JSON.stringify(cialo) });
  const o = await obsluzSrodowisko(s, zadanie({ 'x-kto': 'jozz', 'x-gosc': slowa.id, 'x-cialo': 'okno goscia' }, { op: 'gosc-test-g10-a', ...slowo(projekt) }));
  assert.equal(o.status, 200);
  const d = await o.json();
  assert.equal(d.skutek, 'polozone', JSON.stringify(d));
  assert.equal(s.rzecz(d.rzecz).utworzyl, aktor);
  const bez = await obsluzSrodowisko(s, zadanie({ 'x-gosc': slowa.id }, { op: 'gosc-test-g10-b', ...slowo(projekt) }));
  assert.equal(bez.status, 401);
  const pusty = await obsluzSrodowisko(s, zadanie({ 'x-kto': 'jozz', 'x-gosc': '' }, { op: 'gosc-test-g10-c', ...slowo(projekt) }));
  assert.equal(pusty.status, 400, 'pusty nagłówek nie znaczy "bez gościa": okno, które nie umie się przedstawić, nie pisze jako uczestnik');
});

test('G11. okno otwarte przez uczestnika z odebranym wstępem nie pisze; po przywróceniu pisze znowu', async () => {
  const { s, slowa, projekt } = await swiat();
  const ucz = s.spis({ rodzaj: 'uczestnik/1', gdzie: { imie: 'agent-a' }, limit: 1 })[0];
  assert.ok(ucz, 'uczestnik agent-a jest rzeczą');
  const odebranie = await s.ruch('jozz', { op: 'gosc-test-g11-odloz', co: 'odloz', rzecz: ucz.id, wersja: ucz.wersja, powod: 'odebranie wstępu' });
  assert.equal(odebranie.ok, true, JSON.stringify(odebranie));
  // gość dalej jest rzeczą i dalej ma swoje prawo, ale prawo okna jest słabszym z dwóch, a otwierający nie ma już żadnego
  const bez = await s.ruch('agent-a', { op: 'gosc-test-g11-a', ...slowo(projekt) }, { gosc: slowa.id });
  assert.equal(bez.ok, false, JSON.stringify(bez));
  assert.equal(bez.status, 401, 'imię z kluczem, ale bez rzeczy uczestnika, nie daje oknu żadnego prawa');
  assert.equal(s.ile({ rodzaj: 'slowo/1' }), 0);
  assert.equal(s.ile({ rodzaj: 'propozycja/1' }), 0, 'nie powstaje też propozycja');
  const oddanie = await s.ruch('jozz', { op: 'gosc-test-g11-przywroc', co: 'przywroc', rzecz: ucz.id, wersja: 'dowolna' });
  assert.equal(oddanie.ok, true, JSON.stringify(oddanie));
  const po = await s.ruch('agent-a', { op: 'gosc-test-g11-b', ...slowo(projekt) }, { gosc: slowa.id });
  assert.equal(po.skutek, 'polozone', JSON.stringify(po));
});

test('G12. limit propozycji jest jeden na uczestnika: okno nie daje drugiego limitu i jeden uczestnik nie zajmuje limitu narzędzia innym', async () => {
  const { s, slowa, projekt } = await swiat();
  // dwadzieścia propozycji agenta przez narzędzie: narzędzie zostaje wolne dla właściciela
  for (let i = 0; i < 20; i++) {
    const w = await s.ruch('agent-a', { op: 'gosc-test-g12-okno-' + i, ...slowo(projekt, 'z okna ' + i), obszar: null }, { gosc: slowa.id });
    assert.equal(w.skutek, 'propozycja', i + ': ' + JSON.stringify(w));
  }
  const wlasciciel = await s.ruch('jozz', { op: 'gosc-test-g12-wlasciciel', ...slowo(projekt, 'okno właściciela'), obszar: null }, { gosc: slowa.id });
  assert.equal(wlasciciel.skutek, 'propozycja', 'to samo narzędzie w oknie właściciela dalej pisze: ' + JSON.stringify(wlasciciel));
  // a agent, który wyczerpał limit oknem, nie dołoży już propozycji wprost
  const wprost = await s.ruch('agent-a', { op: 'gosc-test-g12-wprost', ...slowo(projekt, 'wprost'), obszar: null });
  assert.equal(wprost.status, 429, JSON.stringify(wprost));
  assert.match(wprost.blad, /razem z tymi z okien/);
});
