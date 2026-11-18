// Zapis pyta o istnienie oczami piszącego (17 XI 2026, po dwóch atakach drugiej linii na widoczność z danych).
// Czytanie przechodzi przez okulary czytającego (srodowisko.dla). Zapis szedł obok: drzwi ruchu mówiły piszącemu,
// czy rzecz o zgadniętym kluczu albo identyfikatorze istnieje w obszarze, którego nie widzi (odmowa z jej
// identyfikatorem i wersją, odniesienie, które przechodziło, odmowa nazywająca zamknięty obszar).
// Zasada sprawdzana niżej z dwóch stron: rzecz, której piszący nie widzi, brzmi dla zapisu DOKŁADNIE tak samo
// jak rzecz, której nie ma; a to, co widzi, działa jak dotąd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';

const NIE_MA = 'zzzzzzzzzzzzzzzzzzzzzzzzzz'; // poprawny zapis identyfikatora, pod którym nic nie leży
const rodzina = (znak) => ({ znak, nazwa: 'Rodzina ' + znak, pytanie: 'o co pyta', stan_na: '2026-11-17T15:00:00Z' });
// Dwie odpowiedzi są nie do odróżnienia, gdy po zamianie użytego identyfikatora na ten sam znak są co do znaku równe.
const jakBy = (odp, id) => JSON.stringify(odp).split(id).join('<ID>');

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 20, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a', 'agent-b'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  // obszar zamknięty, w którym agentom wolno by było prowadzić, gdyby go widzieli: najostrzejszy przypadek, bo samo
  // prawo do ruchu niczego tu nie zatrzyma
  const T = ok(await s.ruch('jozz', { op: 'zo-obszar-tajny', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  const tajna = ok(await s.ruch('jozz', { op: 'zo-tajny-projekt', co: 'poloz', rodzaj: 'projekt/1', obszar: T, cechy: { nazwa: 'Tajny projekt' } }));
  const tajnaRodzina = ok(await s.ruch('jozz', { op: 'zo-tajna-rodzina', co: 'poloz', rodzaj: 'rodzina/1', obszar: T, cechy: rodzina('tajna') }));
  const jawna = ok(await s.ruch('jozz', { op: 'zo-jawny-projekt', co: 'poloz', rodzaj: 'projekt/1', obszar: r.meta('obszar_nowe'), cechy: { nazwa: 'Jawny projekt' } }));
  return { r, s, ok, T, tajna: tajna.rzecz, tajnaRodzina: tajnaRodzina.rzecz, jawna: jawna.rzecz, nowe: r.meta('obszar_nowe') };
}

test('ZO1. klucz rzeczy z zamkniętego obszaru: odmowa bez identyfikatora i bez wersji, a tajnej rzeczy nie da się nadpisać na ślepo', async () => {
  const { s, tajnaRodzina } = await swiat();
  const przed = s.rzecz(tajnaRodzina);
  for (const [op, dodatkowe] of [['zo1-bez-wersji', {}], ['zo1-dowolna', { wersja: 'dowolna' }], ['zo1-zgadnieta', { wersja: przed.wersja }]]) {
    const w = await s.ruch('agent-a', { op, co: 'poloz', rodzaj: 'rodzina/1', cechy: { ...rodzina('tajna'), nazwa: 'Podmieniona' }, ...dodatkowe });
    assert.equal(w.ok, false, JSON.stringify(w));
    assert.equal(w.status, 409);
    assert.ok(!('rzecz' in w) && !('wersja' in w) && !('propozycja' in w), 'odmowa nie niesie uchwytu: ' + JSON.stringify(w));
    assert.ok(!JSON.stringify(w).includes(tajnaRodzina), 'identyfikator tajnej rzeczy nie wychodzi');
    assert.ok(!JSON.stringify(w).includes(String(przed.wersja)), 'wersja tajnej rzeczy nie wychodzi');
  }
  const po = s.rzecz(tajnaRodzina);
  assert.equal(po.wersja, przed.wersja, 'tajna rzecz nie została ruszona');
  assert.equal(po.cechy.nazwa, 'Rodzina tajna');
  assert.equal(s.ile({ rodzaj: 'propozycja/1' }), 0, 'nie powstała też propozycja wskazująca tajną rzecz');
});

test('ZO2. klucz rzeczy, którą piszący widzi, działa jak dotąd: odmowa mówi, która to rzecz i jaką ma wersję', async () => {
  const { s, ok } = await swiat();
  const jawna = ok(await s.ruch('jozz', { op: 'zo2-jawna-rodzina', co: 'poloz', rodzaj: 'rodzina/1', cechy: rodzina('jawna') }));
  const w = await s.ruch('agent-a', { op: 'zo2-ten-sam-klucz', co: 'poloz', rodzaj: 'rodzina/1', cechy: rodzina('jawna') });
  assert.equal(w.status, 409);
  assert.equal(w.rzecz, jawna.rzecz);
  assert.equal(w.wersja, jawna.wersja);
});

test('ZO3. odniesienie do rzeczy, której piszący nie widzi, odbija się tak samo jak odniesienie do rzeczy, której nie ma', async () => {
  const { s, tajna, jawna } = await swiat();
  const doTajnej = await s.ruch('agent-a', { op: 'zo3-do-tajnej', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'przypinam się', dotyczy: [tajna] } });
  const doNiczego = await s.ruch('agent-a', { op: 'zo3-do-tajnej', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'przypinam się', dotyczy: [NIE_MA] } });
  assert.equal(doTajnej.ok, false, JSON.stringify(doTajnej));
  assert.equal(doTajnej.status, 422);
  assert.equal(jakBy(doTajnej, tajna), jakBy(doNiczego, NIE_MA));
  assert.equal(s.wskazujaNa(tajna).length, 0, 'nic nie zostało przypięte do tajnej rzeczy');
  const doJawnej = await s.ruch('agent-a', { op: 'zo3-do-jawnej', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'to widzę', dotyczy: [jawna] } });
  assert.equal(doJawnej.skutek, 'polozone', JSON.stringify(doJawnej));
});

test('ZO4. odniesienie, które stało w rzeczy wcześniej, zostaje: agent może zmienić rzecz, którą właściciel przypiął do czegoś zamkniętego', async () => {
  const { s, ok, tajna, tajnaRodzina, nowe } = await swiat();
  const slowo = ok(await s.ruch('jozz', { op: 'zo4-slowo-wlasciciela', co: 'poloz', rodzaj: 'slowo/1', obszar: nowe, cechy: { tresc: 'pierwsza wersja', dotyczy: [tajna] } }));
  const zmiana = await s.ruch('agent-a', { op: 'zo4-zmiana-tresci', co: 'poloz', rzecz: slowo.rzecz, wersja: slowo.wersja, rodzaj: 'slowo/1', cechy: { tresc: 'druga wersja', dotyczy: [tajna] } });
  assert.equal(zmiana.skutek, 'polozone', JSON.stringify(zmiana));
  // ale nowego odniesienia do czegoś zamkniętego agent nie dołoży, także przy okazji zmiany
  const dolozenie = await s.ruch('agent-a', { op: 'zo4-nowe-odniesienie', co: 'poloz', rzecz: slowo.rzecz, wersja: zmiana.wersja, rodzaj: 'slowo/1', cechy: { tresc: 'trzecia', dotyczy: [tajna, tajnaRodzina] } });
  assert.equal(dolozenie.status, 422, JSON.stringify(dolozenie));
  assert.ok(dolozenie.blad.includes(tajnaRodzina) && !dolozenie.blad.includes(tajna), 'odbija się tylko nowe odniesienie: ' + dolozenie.blad);
});

test('ZO5. ruch na rzeczy z zamkniętego obszaru po identyfikatorze: każda droga mówi to samo co dla rzeczy, której nie ma', async () => {
  const { s, ok, T, tajna } = await swiat();
  const odlozona = ok(await s.ruch('jozz', { op: 'zo5-tajna-odlozona', co: 'poloz', rodzaj: 'projekt/1', obszar: T, cechy: { nazwa: 'Tajna odłożona' } }));
  ok(await s.ruch('jozz', { op: 'zo5-odkladam', co: 'odloz', rzecz: odlozona.rzecz, wersja: 'dowolna' }));
  const proby = [
    ['poloz', (id) => ({ co: 'poloz', rzecz: id, wersja: 'dowolna', rodzaj: 'projekt/1', cechy: { nazwa: 'Moja' } }), tajna],
    ['odloz', (id) => ({ co: 'odloz', rzecz: id, wersja: 'dowolna' }), tajna],
    ['cofnij', (id) => ({ co: 'cofnij', rzecz: id, wersja: 'dowolna' }), tajna],
    ['przywroc', (id) => ({ co: 'przywroc', rzecz: id, wersja: 'dowolna' }), odlozona.rzecz],
    ['przywroc nieodłożonej', (id) => ({ co: 'przywroc', rzecz: id, wersja: 'dowolna' }), tajna],
  ];
  for (const [nazwa, cialo, id] of proby) {
    const naTajnej = await s.ruch('agent-a', { op: 'zo5-' + nazwa.replace(/[^a-z]/g, '') + '-t', ...cialo(id) });
    const naNiczym = await s.ruch('agent-a', { op: 'zo5-' + nazwa.replace(/[^a-z]/g, '') + '-n', ...cialo(NIE_MA) });
    assert.equal(naTajnej.status, 404, `${nazwa}: ${JSON.stringify(naTajnej)}`);
    assert.equal(jakBy(naTajnej, id), jakBy(naNiczym, NIE_MA), nazwa);
    assert.ok(!JSON.stringify(naTajnej).includes(T), `${nazwa}: odmowa nie nazywa zamkniętego obszaru`);
  }
  assert.equal(s.rzecz(tajna).numer, 1, 'tajna rzecz nie została ruszona');
});

test('ZO6. cofnięcie jawnej rzeczy do wersji, która leżała w zamkniętym obszarze: taka wersja dla piszącego nie istnieje', async () => {
  const { s, ok, T, nowe } = await swiat();
  const w1 = ok(await s.ruch('jozz', { op: 'zo6-wedrowna-1', co: 'poloz', rodzaj: 'projekt/1', obszar: T, cechy: { nazwa: 'Wędrowna', opis: 'tajny opis' } }));
  const w2 = ok(await s.ruch('jozz', { op: 'zo6-wedrowna-2', co: 'poloz', rzecz: w1.rzecz, wersja: w1.wersja, rodzaj: 'projekt/1', obszar: nowe, cechy: { nazwa: 'Wędrowna', opis: 'jawny opis' } }));
  const doTajnej = await s.ruch('agent-a', { op: 'zo6-cofam-do-tajnej', co: 'cofnij', rzecz: w1.rzecz, wersja: 'dowolna', do: w1.wersja });
  const doNiczego = await s.ruch('agent-a', { op: 'zo6-cofam-do-niczego', co: 'cofnij', rzecz: w1.rzecz, wersja: 'dowolna', do: 999999 });
  assert.equal(doTajnej.status, 404, JSON.stringify(doTajnej));
  assert.equal(JSON.stringify(doTajnej).split(String(w1.wersja)).join('<N>'), JSON.stringify(doNiczego).split('999999').join('<N>'));
  assert.ok(!JSON.stringify(doTajnej).includes(T));
  // "cofnij do poprzedniej", gdy poprzednia leżała w zamkniętym obszarze: nie ma do czego, i odmowa nie nazywa obszaru
  const poprzednia = await s.ruch('agent-a', { op: 'zo6-cofam-poprzednia', co: 'cofnij', rzecz: w1.rzecz, wersja: 'dowolna' });
  assert.equal(poprzednia.status, 409, JSON.stringify(poprzednia));
  assert.ok(!JSON.stringify(poprzednia).includes(T));
  assert.equal(s.rzecz(w1.rzecz).wersja, w2.wersja, 'rzecz została przy jawnej wersji');
  // właściciel cofa bez przeszkód
  const jego = await s.ruch('jozz', { op: 'zo6-wlasciciel-cofa', co: 'cofnij', rzecz: w1.rzecz, wersja: 'dowolna', do: w1.wersja });
  assert.equal(jego.skutek, 'cofniete', JSON.stringify(jego));
});

test('ZO7. zamknięty obszar jako cel: położenie w nim i przeniesienie do niego brzmią jak obszar, którego nie ma', async () => {
  const { s, T, jawna } = await swiat();
  const nowaWTajnym = await s.ruch('agent-a', { op: 'zo7-nowa-w-tajnym', co: 'poloz', rodzaj: 'projekt/1', obszar: T, cechy: { nazwa: 'Wkładam' } });
  const nowaWNiczym = await s.ruch('agent-a', { op: 'zo7-nowa-w-tajnym', co: 'poloz', rodzaj: 'projekt/1', obszar: NIE_MA, cechy: { nazwa: 'Wkładam' } });
  assert.equal(nowaWTajnym.ok, false, JSON.stringify(nowaWTajnym));
  assert.equal(jakBy(nowaWTajnym, T), jakBy(nowaWNiczym, NIE_MA));
  const rz = s.rzecz(jawna);
  const przeniesienie = await s.ruch('agent-a', { op: 'zo7-przenosze', co: 'poloz', rzecz: jawna, wersja: rz.wersja, rodzaj: 'projekt/1', obszar: T, cechy: rz.cechy });
  const przeniesienieDoNiczego = await s.ruch('agent-a', { op: 'zo7-przenosze', co: 'poloz', rzecz: jawna, wersja: rz.wersja, rodzaj: 'projekt/1', obszar: NIE_MA, cechy: rz.cechy });
  assert.equal(przeniesienie.ok, false, JSON.stringify(przeniesienie));
  assert.equal(jakBy(przeniesienie, T), jakBy(przeniesienieDoNiczego, NIE_MA));
  assert.equal(s.ile({ obszar: T }), 2, 'w zamkniętym obszarze leży tylko to, co położył właściciel');
});

test('ZO8. rzecz, która z natury leży z inną (położenie w widoku): widok z zamkniętego obszaru brzmi jak widok, którego nie ma, także gdy położenie już jest', async () => {
  const { s, ok, T, jawna } = await swiat();
  const widok = ok(await s.ruch('jozz', { op: 'zo8-tajny-widok', co: 'poloz', rodzaj: 'widok/1', obszar: T, cechy: { nazwa: 'Tajny widok' } }));
  const wTajnym = await s.ruch('agent-a', { op: 'zo8-miejsce-w-tajnym', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.rzecz, rzecz: jawna, x: 10, y: 20 } });
  const wNiczym = await s.ruch('agent-a', { op: 'zo8-miejsce-w-tajnym', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: NIE_MA, rzecz: jawna, x: 10, y: 20 } });
  assert.equal(wTajnym.ok, false, JSON.stringify(wTajnym));
  assert.equal(jakBy(wTajnym, widok.rzecz), jakBy(wNiczym, NIE_MA));
  // właściciel kładzie to samo położenie: teraz klucz (widok i rzecz) jest zajęty, a agent dalej słyszy to samo
  ok(await s.ruch('jozz', { op: 'zo8-miejsce-wlasciciela', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.rzecz, rzecz: jawna, x: 1, y: 2 } }));
  const poZajeciu = await s.ruch('agent-a', { op: 'zo8-miejsce-po-zajeciu', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok: widok.rzecz, rzecz: jawna, x: 10, y: 20 } });
  assert.equal(jakBy(poZajeciu, widok.rzecz), jakBy(wNiczym, NIE_MA));
});

test('ZO9. propozycja w obszarze, który zamknięto po jej zgłoszeniu: obcy uczestnik słyszy "nie ma", autor może ją wycofać', async () => {
  const { s, ok } = await swiat();
  const P = ok(await s.ruch('jozz', { op: 'zo9-obszar', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Później zamknięty', widzi: 'uczestnicy', ile_wolno: 'proponowac' } })).rzecz;
  const prop = await s.ruch('agent-a', { op: 'zo9-propozycja', co: 'poloz', rodzaj: 'projekt/1', obszar: P, cechy: { nazwa: 'Proponowany' } });
  assert.equal(prop.skutek, 'propozycja', JSON.stringify(prop));
  const o = s.rzecz(P);
  ok(await s.ruch('jozz', { op: 'zo9-zamykam', co: 'poloz', rzecz: P, wersja: o.wersja, rodzaj: 'obszar/1', cechy: { ...o.cechy, widzi: 'wlasciciel' } }));
  for (const co of ['przyjmij', 'odrzuc']) {
    const naTajnej = await s.ruch('agent-b', { op: 'zo9-' + co + '-tajna', co, propozycja: prop.propozycja });
    const naNiczym = await s.ruch('agent-b', { op: 'zo9-' + co + '-nic', co, propozycja: NIE_MA });
    assert.equal(naTajnej.status, 404, `${co}: ${JSON.stringify(naTajnej)}`);
    assert.equal(jakBy(naTajnej, prop.propozycja), jakBy(naNiczym, NIE_MA), co);
  }
  const wycofanie = await s.ruch('agent-a', { op: 'zo9-wycofuje', co: 'odrzuc', propozycja: prop.propozycja });
  assert.equal(wycofanie.skutek, 'wycofana', 'autor zna swoją propozycję i może ją wycofać: ' + JSON.stringify(wycofanie));
});

test('ZO10. właściciel widzi wszystko, więc jego zapis działa jak dotąd; automat środowiska też pyta o istnienie wprost', async () => {
  const { s, T, tajna, tajnaRodzina } = await swiat();
  const klucz = await s.ruch('jozz', { op: 'zo10-klucz-wlasciciela', co: 'poloz', rodzaj: 'rodzina/1', cechy: rodzina('tajna') });
  assert.equal(klucz.status, 409);
  assert.equal(klucz.rzecz, tajnaRodzina, 'właścicielowi odmowa mówi, która to rzecz');
  const slowo = await s.ruch('jozz', { op: 'zo10-slowo-wlasciciela', co: 'poloz', rodzaj: 'slowo/1', obszar: T, cechy: { tresc: 'przy tajnej', dotyczy: [tajna] } });
  assert.equal(slowo.skutek, 'polozone', JSON.stringify(slowo));
  // obserwator faktów (rola automat) chodzi zwykłym ruchem i musi móc odświeżyć fakt także wtedy, gdy właściciel
  // schował rzecz: jego odpowiedzi nie wychodzą do obcych, a bez tego fakty o schowanych rzeczach stanęłyby po cichu
  const automat = await s.ruch('obserwator', { op: 'zo10-klucz-automatu', co: 'poloz', rodzaj: 'rodzina/1', cechy: rodzina('tajna') });
  assert.equal(automat.status, 409);
  assert.equal(automat.rzecz, tajnaRodzina, JSON.stringify(automat));
});

test('ZO11. narzędzie w oknie właściciela pisze oczami narzędzia, nie właściciela: tajnej rzeczy nie dotknie i się o niej nie dowie', async () => {
  const { s, tajna, tajnaRodzina, T } = await swiat();
  const gosc = s.spis({ rodzaj: 'gosc/1', limit: 20 }).find((g) => g.cechy.umowa === 'okno/3');
  assert.ok(gosc, 'jest zasiany gość, który pisze');
  const odniesienie = await s.ruch('jozz', { op: 'zo11-odniesienie', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'z okna', dotyczy: [tajna] } }, { gosc: gosc.id });
  const doNiczego = await s.ruch('jozz', { op: 'zo11-odniesienie', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'z okna', dotyczy: [NIE_MA] } }, { gosc: gosc.id });
  assert.equal(odniesienie.status, 422, JSON.stringify(odniesienie));
  assert.equal(jakBy(odniesienie, tajna), jakBy(doNiczego, NIE_MA));
  const zmiana = await s.ruch('jozz', { op: 'zo11-zmiana', co: 'poloz', rzecz: tajna, wersja: 'dowolna', rodzaj: 'projekt/1', cechy: { nazwa: 'Z okna' } }, { gosc: gosc.id });
  assert.equal(zmiana.status, 404, JSON.stringify(zmiana));
  const klucz = await s.ruch('jozz', { op: 'zo11-klucz', co: 'poloz', rodzaj: 'rodzina/1', cechy: rodzina('tajna') }, { gosc: gosc.id });
  assert.equal(klucz.status, 409);
  assert.ok(!JSON.stringify(klucz).includes(tajnaRodzina) && !JSON.stringify(klucz).includes(T), JSON.stringify(klucz));
});

test('ZO12. okno z gościem, którego otwierający nie widzi, nie pisze i brzmi jak gość, którego nie ma', async () => {
  const { s, ok, T, jawna } = await swiat();
  const wzor = s.spis({ rodzaj: 'gosc/1', limit: 20 }).find((g) => g.cechy.umowa === 'okno/3');
  const tajnyGosc = ok(await s.ruch('jozz', { op: 'zo12-tajny-gosc', co: 'poloz', rodzaj: 'gosc/1', obszar: T, cechy: { ...wzor.cechy, nazwa: 'Tajne narzędzie' } }));
  const cialo = { op: 'zo12-ruch', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'przez tajne narzędzie', dotyczy: [jawna] } };
  const przezTajnego = await s.ruch('agent-a', cialo, { gosc: tajnyGosc.rzecz });
  const przezNikogo = await s.ruch('agent-a', cialo, { gosc: NIE_MA });
  assert.equal(przezTajnego.status, 404, JSON.stringify(przezTajnego));
  assert.equal(jakBy(przezTajnego, tajnyGosc.rzecz), jakBy(przezNikogo, NIE_MA));
});

test('ZO13. przez drzwi: dwie próby z ataku drugiej linii (klucz i odniesienie) nie mówią już nic o zamkniętym obszarze', async () => {
  const { s, T, tajna, tajnaRodzina } = await swiat();
  const zadanie = (kto, cialo) => new Request('https://proba.example/api/srodowisko/ruch', { method: 'POST', headers: { 'content-type': 'application/json', 'x-kto': kto }, body: JSON.stringify(cialo) });
  const klucz = await obsluzSrodowisko(s, zadanie('agent-a', { op: 'zo13-klucz', co: 'poloz', rodzaj: 'rodzina/1', cechy: rodzina('tajna') }));
  const tekstKlucza = await klucz.text();
  assert.equal(klucz.status, 409);
  assert.ok(!tekstKlucza.includes(tajnaRodzina) && !tekstKlucza.includes(T) && !/"wersja"/.test(tekstKlucza), tekstKlucza);
  const doTajnej = await obsluzSrodowisko(s, zadanie('agent-a', { op: 'zo13-odniesienie', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'x', dotyczy: [tajna] } }));
  const doNiczego = await obsluzSrodowisko(s, zadanie('agent-a', { op: 'zo13-odniesienie', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'x', dotyczy: [NIE_MA] } }));
  assert.equal(doTajnej.status, 422);
  assert.equal((await doTajnej.text()).split(tajna).join('<ID>'), (await doNiczego.text()).split(NIE_MA).join('<ID>'));
});

test('ZO14. ponowienie czynności nie jest drogą obok: uczestnik z odebranym wstępem słyszy brak prawa, a cudze ponowienie przez to samo okno nie dostaje uchwytu schowanej rzeczy', async () => {
  const { s, ok, T, jawna } = await swiat();
  // uczestnik robi ruch, traci wstęp i ponawia ten sam ruch
  const cialo = { op: 'zo14-dawny-ruch', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'dawne słowo', dotyczy: [jawna] } };
  ok(await s.ruch('agent-a', cialo));
  const ucz = s.spis({ rodzaj: 'uczestnik/1', gdzie: { imie: 'agent-a' }, limit: 1 })[0];
  ok(await s.ruch('jozz', { op: 'zo14-odbieram', co: 'odloz', rzecz: ucz.id, wersja: 'dowolna' }));
  const ponowienie = await s.ruch('agent-a', cialo);
  assert.equal(ponowienie.status, 401, JSON.stringify(ponowienie));
  ok(await s.ruch('jozz', { op: 'zo14-oddaje', co: 'przywroc', rzecz: ucz.id, wersja: 'dowolna' }));
  assert.equal((await s.ruch('agent-a', cialo)).powtorzone, true, 'z przywróconym wstępem ponowienie znowu jest ponowieniem');
  // właściciel robi ruch z okna, chowa rzecz, a agent ponawia ten sam op przez to samo okno
  const gosc = s.spis({ rodzaj: 'gosc/1', limit: 20 }).find((g) => g.cechy.umowa === 'okno/3');
  const zOkna = { op: 'zo14-op-z-okna', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'z okna właściciela', dotyczy: [jawna] } };
  const pierwszy = ok(await s.ruch('jozz', zOkna, { gosc: gosc.id }));
  const rz = s.rzecz(pierwszy.rzecz);
  ok(await s.ruch('jozz', { op: 'zo14-chowam', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: rz.rodzaj, obszar: T, cechy: rz.cechy }));
  for (const [nazwa, c] of [['to samo ciało', zOkna], ['inne ciało', { ...zOkna, cechy: { tresc: 'co innego', dotyczy: [jawna] } }]]) {
    const cudze = await s.ruch('agent-a', c, { gosc: gosc.id });
    assert.ok(!JSON.stringify(cudze).includes(rz.id), `${nazwa}: identyfikator schowanej rzeczy nie wychodzi: ${JSON.stringify(cudze)}`);
    assert.ok(!('rzecz' in cudze), nazwa);
  }
  const wlasciciela = await s.ruch('jozz', zOkna, { gosc: gosc.id });
  assert.equal(wlasciciela.status, 409, 'narzędzie w oknie właściciela też nie widzi schowanej rzeczy, więc uchwytu nie dostaje');
});
