// Gest: wiele zmian jako jedna czynność ręki (17 XI 2026). Sprawdziany pytają o to, na czym stoi "cofnij" pod ręką:
// czy gest da się wskazać, cofnąć w całości jednym krokiem i ponowić; czy cofnięcie nie nadpisuje cudzej zmiany;
// czy da się odczytać widok w wybranej chwili i wrócić do zapisanego układu tak, żeby i ten powrót dało się cofnąć.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 22, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a', 'agent-b'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  // widok w obszarze, w którym agenci prowadzą, z trzema projektami położonymi jednym gestem
  const pole = ok(await s.ruch('jozz', { op: 'gest-pole-obszar', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Pole do układania', ile_wolno: 'prowadzic' } })).rzecz;
  const widok = ok(await s.ruch('jozz', { op: 'gest-widok-0001', co: 'poloz', rodzaj: 'widok/1', obszar: pole, cechy: { nazwa: 'Układanka' } })).rzecz;
  const projekty = [];
  for (const n of ['A', 'B', 'C']) projekty.push(ok(await s.ruch('jozz', { op: 'gest-projekt-' + n + '001', co: 'poloz', rodzaj: 'projekt/1', obszar: pole, cechy: { nazwa: 'Projekt ' + n } })).rzecz);
  const poloz = (kto, gest, i, x, y, dodatkowe = {}) => s.ruch(kto, { op: `poloz-${gest}-${i}`, gest, co: 'poloz', rodzaj: 'miejsce/1', wersja: 'dowolna', cechy: { widok, rzecz: projekty[i], x, y }, ...dodatkowe });
  const miejsca = [];
  for (let i = 0; i < 3; i++) miejsca.push(ok(await poloz('jozz', 'gest-pierwszy', i, 100 * i, 0)).rzecz);
  const gdzie = () => miejsca.map((id) => { const m = s.rzecz(id); return m.odlozone ? 'odlozone' : `${m.cechy.x},${m.cechy.y}`; }).join(' | ');
  return { r, s, ok, pole, widok, projekty, miejsca, poloz, gdzie };
}

test('GE1. gest ma znak: ruchy z tym samym znakiem tworzą jedną czynność, którą da się wskazać; ruch bez znaku do żadnej nie należy', async () => {
  const { s, ok, miejsca, poloz, projekty } = await swiat();
  assert.deepEqual(s.gestDla('jozz', 'gest-pierwszy').map((x) => x.rzecz).sort(), [...miejsca].sort());
  assert.ok(s.gestDla('jozz', 'gest-pierwszy').every((x) => x.przed === null), 'rzeczy powstały w tym geście');
  assert.deepEqual(s.gestDla('agent-a', 'gest-pierwszy'), [], 'znak gestu należy do tego, kto go zrobił');
  ok(await s.ruch('jozz', { op: 'bez-gestu-0001', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Bez gestu' } }));
  assert.equal(s.gestyDla('jozz').length, 1);
  assert.equal(s.gestyDla('jozz')[0].gest, 'gest-pierwszy');
  assert.equal(s.gestyDla('jozz')[0].rzeczy, 3);
  const powtorka = await poloz('jozz', 'gest-pierwszy', 0, 0, 0);
  assert.equal(powtorka.powtorzone, true, 'ponowienie ruchu z gestu niczego nie robi dwa razy: ' + JSON.stringify(powtorka));
  for (const zly of ['krótki', 'ze spacją w środku', 'x'.repeat(30), 7]) assert.equal((await s.ruch('jozz', { op: 'zly-gest-00001', gest: zly, co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'x' } })).status, 400, String(zly));
  assert.equal(projekty.length, 3);
});

test('GE2. cały gest cofa się jednym krokiem, a cofnięcie jest gestem, więc da się je ponowić', async () => {
  const { s, ok, poloz, gdzie } = await swiat();
  assert.equal(gdzie(), '0,0 | 100,0 | 200,0');
  for (let i = 0; i < 3; i++) ok(await poloz('jozz', 'gest-przesun', i, 100 * i, 500));
  assert.equal(gdzie(), '0,500 | 100,500 | 200,500');
  const cofniecie = ok(await s.ruch('jozz', { op: 'cofam-przesun-01', gest: 'gest-cofniecie', co: 'cofnij-gest', cofany: 'gest-przesun' }));
  assert.equal(cofniecie.skutek, 'cofniety-gest');
  assert.equal(cofniecie.rzeczy, 3);
  assert.equal(gdzie(), '0,0 | 100,0 | 200,0', 'wszystkie trzy położenia wróciły jednym krokiem');
  const ponowienie = ok(await s.ruch('jozz', { op: 'ponawiam-przesun', gest: 'gest-ponowienie', co: 'cofnij-gest', cofany: 'gest-cofniecie' }));
  assert.equal(ponowienie.rzeczy, 3);
  assert.equal(gdzie(), '0,500 | 100,500 | 200,500', 'cofnięcie cofnięcia to ponowienie');
  const powtorka = await s.ruch('jozz', { op: 'cofam-przesun-01', gest: 'gest-cofniecie', co: 'cofnij-gest', cofany: 'gest-przesun' });
  assert.equal(powtorka.powtorzone, true, JSON.stringify(powtorka));
  assert.equal(gdzie(), '0,500 | 100,500 | 200,500', 'ponowione żądanie cofnięcia nie cofa drugi raz');
});

test('GE3. cofnięcie gestu, w którym rzeczy powstały, odkłada je; ponowienie je przywraca', async () => {
  const { s, ok, gdzie } = await swiat();
  ok(await s.ruch('jozz', { op: 'cofam-pierwszy-1', gest: 'gest-cofam-1', co: 'cofnij-gest', cofany: 'gest-pierwszy' }));
  assert.equal(gdzie(), 'odlozone | odlozone | odlozone');
  ok(await s.ruch('jozz', { op: 'ponawiam-pierw-1', gest: 'gest-ponawiam', co: 'cofnij-gest', cofany: 'gest-cofam-1' }));
  assert.equal(gdzie(), '0,0 | 100,0 | 200,0');
});

test('GE4. cofnięcie nie nadpisuje cudzej zmiany: gdy coś z gestu ruszono później, gest nie cofa się wcale i mówi, co stoi na drodze', async () => {
  const { s, ok, miejsca, poloz, gdzie } = await swiat();
  for (let i = 0; i < 3; i++) ok(await poloz('jozz', 'gest-przesun', i, 100 * i, 500));
  const m = s.rzecz(miejsca[1]);
  ok(await s.ruch('agent-a', { op: 'agent-rusza-0001', co: 'poloz', rzecz: m.id, wersja: m.wersja, rodzaj: 'miejsce/1', cechy: { ...m.cechy, x: 999 } }));
  const w = await s.ruch('jozz', { op: 'cofam-po-cudzej', co: 'cofnij-gest', cofany: 'gest-przesun' });
  assert.equal(w.status, 409, JSON.stringify(w));
  assert.deepEqual(w.zmienione, [miejsca[1]]);
  assert.equal(gdzie(), '0,500 | 999,500 | 200,500', 'nic nie zostało cofnięte: wszystko albo nic');
});

test('GE5. cofa ten, kto zrobił gest, i tylko tam, gdzie dalej ma prawo do skutku; cudzy gest cofa właściciel', async () => {
  const { s, ok, pole, poloz, gdzie } = await swiat();
  for (let i = 0; i < 3; i++) ok(await poloz('agent-a', 'gest-agenta', i, 100 * i, 700));
  const obcy = await s.ruch('agent-b', { op: 'cudzy-gest-0001', co: 'cofnij-gest', cofany: 'gest-agenta' });
  assert.equal(obcy.status, 404, 'cudzego gestu nie ma wśród moich czynności: ' + JSON.stringify(obcy));
  assert.equal((await s.ruch('agent-b', { op: 'cudzy-gest-0002', co: 'cofnij-gest', cofany: 'gest-agenta', czyj: 'agent-a' })).status, 403);
  // właściciel zamyka pole dla agentów: agent nie cofnie już własnego gestu, bo cofnięcie jest zapisem
  const o = s.rzecz(pole);
  ok(await s.ruch('jozz', { op: 'zamykam-pole-01', co: 'poloz', rzecz: pole, wersja: o.wersja, rodzaj: 'obszar/1', cechy: { ...o.cechy, ile_wolno: 'proponowac' } }));
  const bezPrawa = await s.ruch('agent-a', { op: 'cofam-bez-prawa', co: 'cofnij-gest', cofany: 'gest-agenta' });
  assert.equal(bezPrawa.ok, false, JSON.stringify(bezPrawa));
  assert.equal(bezPrawa.status, 403);
  assert.equal(gdzie(), '0,700 | 100,700 | 200,700');
  const wlasciciel = ok(await s.ruch('jozz', { op: 'cofam-za-agenta', co: 'cofnij-gest', cofany: 'gest-agenta', czyj: 'agent-a' }));
  assert.equal(wlasciciel.rzeczy, 3);
  assert.equal(gdzie(), '0,0 | 100,0 | 200,0');
});

test('GE6. widok w wybranej chwili: położenia takie, jakie były przy danym akcie; to, co doszło później, jeszcze nie istnieje', async () => {
  const { s, ok, widok, miejsca, poloz, projekty } = await swiat();
  const wtedy = s.ostatniNr();
  for (let i = 0; i < 3; i++) ok(await poloz('jozz', 'gest-przesun', i, 100 * i, 500));
  const czwarty = ok(await s.ruch('jozz', { op: 'czwarty-projekt', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Projekt D' } }));
  ok(await s.ruch('jozz', { op: 'czwarte-miejsce', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok, rzecz: czwarty.rzecz, x: 5, y: 5 } }));
  const dawniej = s.widokNa(widok, wtedy);
  assert.deepEqual(dawniej.map((p) => `${p.cechy.x},${p.cechy.y}`).sort(), ['0,0', '100,0', '200,0']);
  assert.deepEqual(dawniej.map((p) => p.rzecz).sort(), [...miejsca].sort());
  assert.equal(s.widokNa(widok, s.ostatniNr()).length, 4);
  assert.equal(s.widokNa(widok, 0).length, 0);
  // przez okulary: agent nie przeczyta chwili, w której widok leżał w obszarze, którego nie widzi
  const T = ok(await s.ruch('jozz', { op: 'gest-tajny-obszar', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel' } })).rzecz;
  const w = s.rzecz(widok);
  ok(await s.ruch('jozz', { op: 'chowam-widok-001', co: 'poloz', rzecz: widok, wersja: w.wersja, rodzaj: 'widok/1', obszar: T, cechy: w.cechy }));
  assert.equal(s.dla('agent-a').widokNa(widok, wtedy).length, 0);
  assert.equal(s.dla('jozz').widokNa(widok, wtedy).length, 3);
  assert.equal(projekty.length, 3);
});

test('GE7. zapisany układ: powrót do nazwanej chwili zapisuje tylko różnicę, jednym gestem, i sam daje się cofnąć', async () => {
  const { s, ok, widok, miejsca, poloz, gdzie } = await swiat();
  const uklad = ok(await s.ruch('jozz', { op: 'zapisuje-uklad-1', co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'Rano', widok, akt: s.ostatniNr() } }));
  assert.equal(s.rzecz(uklad.rzecz).obszar, s.rzecz(widok).obszar, 'zapisany układ leży tam, gdzie jego widok');
  // bałagan: dwa przesunięcia, jedno odłożenie, jedno nowe położenie; trzecie zostaje bez zmian
  ok(await poloz('jozz', 'gest-balagan', 0, 777, 777));
  ok(await s.ruch('jozz', { op: 'odkladam-miejsce', gest: 'gest-balagan', co: 'odloz', rzecz: miejsca[1], wersja: 'dowolna' }));
  const nowy = ok(await s.ruch('jozz', { op: 'nowy-projekt-001', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Projekt E' } }));
  const noweMiejsce = ok(await s.ruch('jozz', { op: 'nowe-miejsce-001', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok, rzecz: nowy.rzecz, x: 1, y: 1 } }));
  assert.equal(gdzie(), '777,777 | odlozone | 200,0');
  const powrot = ok(await s.ruch('jozz', { op: 'wracam-do-rana-1', gest: 'gest-powrot', co: 'przywroc-uklad', chwila: uklad.rzecz }));
  assert.equal(powrot.skutek, 'przywrocony-uklad');
  assert.equal(powrot.rzeczy, 3, 'zapisane są tylko trzy różnice: przesunięte, odłożone i to, czego wtedy nie było');
  assert.equal(gdzie(), '0,0 | 100,0 | 200,0');
  assert.equal(s.rzecz(noweMiejsce.rzecz).odlozone, true, 'położenie, którego w zapisanym układzie nie było, jest odłożone');
  ok(await s.ruch('jozz', { op: 'cofam-powrot-001', co: 'cofnij-gest', cofany: 'gest-powrot' }));
  assert.equal(gdzie(), '777,777 | odlozone | 200,0', 'powrót do układu dał się cofnąć');
  assert.ok(!s.rzecz(noweMiejsce.rzecz).odlozone);
  const bezRoznic = ok(await s.ruch('jozz', { op: 'wracam-do-rana-2', co: 'przywroc-uklad', chwila: uklad.rzecz }));
  assert.equal(bezRoznic.rzeczy, 3);
  assert.equal(ok(await s.ruch('jozz', { op: 'wracam-do-rana-3', co: 'przywroc-uklad', chwila: uklad.rzecz })).rzeczy, 0, 'drugi powrot nie ma czego zapisywać');
  assert.equal((await s.ruch('jozz', { op: 'wracam-do-niczego', co: 'przywroc-uklad', chwila: 'zzzzzzzzzzzzzzzzzzzzzzzzzz' })).status, 404);
});

test('GE8. przez drzwi: moje ostatnie gesty, widok w chwili, a gest zrobiony w oknie należy do narzędzia', async () => {
  const { s, ok, widok, miejsca } = await swiat();
  const pytanie = (sciezka, kto) => obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { headers: kto ? { 'x-kto': kto } : {} }));
  const gesty = await (await pytanie('/api/srodowisko/gesty', 'jozz')).json();
  assert.equal(gesty.gesty[0].gest, 'gest-pierwszy');
  assert.equal(gesty.gesty[0].rzeczy, 3);
  assert.equal((await pytanie('/api/srodowisko/gesty', null)).status, 401);
  const chwila = await (await pytanie(`/api/srodowisko/widok-w-chwili?widok=${widok}&akt=${s.ostatniNr()}`, 'agent-a')).json();
  assert.deepEqual(chwila.polozenia.map((p) => p.rzecz).sort(), [...miejsca].sort());
  assert.equal((await pytanie('/api/srodowisko/widok-w-chwili?widok=zly&akt=1', 'agent-a')).status, 400);
  const gosc = s.spis({ rodzaj: 'gosc/1', limit: 20 }).find((g) => g.cechy.umowa === 'okno/3');
  const m = s.rzecz(miejsca[0]);
  const zOkna = ok(await s.ruch('jozz', { op: 'z-okna-gest-001', gest: 'gest-z-okna-1', co: 'poloz', rzecz: m.id, wersja: m.wersja, rodzaj: 'miejsce/1', cechy: { ...m.cechy, y: 42 } }, { gosc: gosc.id }));
  assert.equal(zOkna.skutek, 'polozone', JSON.stringify(zOkna));
  assert.equal(s.gestDla('gosc-' + gosc.id, 'gest-z-okna-1').length, 1);
  assert.equal(s.gestDla('jozz', 'gest-z-okna-1').length, 0, 'gest z okna nie jest gestem tego, kto okno otworzył');
});
