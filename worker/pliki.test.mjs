// Duża treść jako rzecz (18 XI 2026): bajty w niezmiennym zapisie, rzecz plik/1 ze wskazaniem (odcisk, typ, rozmiar),
// drzwi do wgrania i do pobrania oczami czytającego, wersja przypięta odciskiem, krój z pliku.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';
import { policzUstawienia } from './ustawienia.mjs';
import { NAJWIEKSZY_PLIK, NAJWIECEJ_BAJTOW_NA_DOBE, NAJWIECEJ_BAJTOW_INNYCH_NA_DOBE, NAJWIECEJ_BAJTOW_UCZESTNIKA_NA_DOBE, naBase64, zBase64, rozmiarZBase64 } from './pliki.mjs';
import { pasuje } from '../public/pokretla.mjs';

async function swiat(uczestnicy = ['agent-a']) {
  let t = Date.UTC(2026, 10, 18, 1, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  const bajty = (ile, ziarno = 7) => { const u = new Uint8Array(ile); for (let i = 0; i < ile; i++) u[i] = (i * 31 + ziarno) & 255; return u; };
  const plik = async (kto, op, u8, cechy = {}, dodatkowe = {}) => {
    const z = ok(await s.bajty(kto, u8, { op: op + '-bajty' }));
    return s.ruch(kto, { op, co: 'poloz', rodzaj: 'plik/1', cechy: { nazwa: 'Krój próbny', typ: 'font/woff2', rozmiar: u8.length, tresc: z.zapis, ...cechy }, ...dodatkowe });
  };
  const pytanie = (sciezka, kto = 'agent-a', init = {}) => obsluzSrodowisko(s, new Request('https://proba.example' + sciezka, { ...init, headers: { 'x-kto': kto, ...(init.headers || {}) } }));
  return { r, s, ok, bajty, plik, pytanie };
}

test('PL1. bajty wchodzą jako niezmienny zapis: ten sam plik to ten sam odcisk; granice mówią zdaniem', async () => {
  const { r, s, ok, bajty } = await swiat();
  const u = bajty(1000);
  assert.deepEqual(zBase64(naBase64(u)), u);
  assert.equal(rozmiarZBase64(naBase64(u)), 1000);
  const a = ok(await s.bajty('agent-a', u, { op: 'pl1-pierwszy' }));
  assert.match(a.zapis, /^[0-9a-f]{64}$/);
  assert.equal(a.rozmiar, 1000);
  assert.equal(ok(await s.bajty('agent-a', u, { op: 'pl1-pierwszy' })).powtorzone, true, 'powtórzona czynność niczego nie dokłada');
  assert.equal(ok(await s.bajty('jozz', u, { op: 'pl1-ten-sam-plik' })).zapis, a.zapis, 'te same bajty od kogoś innego to ten sam zapis');
  assert.equal((await s.bajty('ktos-obcy', u, { op: 'pl1-obcy-uczestnik' })).status, 401);
  assert.equal((await s.bajty('agent-a', new Uint8Array(0), { op: 'pl1-pusty-plik' })).status, 400);
  const zaDuzy = await s.bajty('agent-a', new Uint8Array(NAJWIEKSZY_PLIK + 1), { op: 'pl1-za-duzy-plik' });
  assert.equal(zaDuzy.status, 413);
  assert.match(zaDuzy.blad, /najwyżej 1500000/);
  // dobowa granica bajtów chroni magazyn i mówi, kiedy wraca
  r.ustawMeta('bajty:' + new Date(r.teraz()).toISOString().slice(0, 10), String(NAJWIECEJ_BAJTOW_NA_DOBE - 10));
  const ponad = await s.bajty('agent-a', bajty(100, 9), { op: 'pl1-ponad-dobowa' });
  assert.equal(ponad.status, 429, JSON.stringify(ponad));
  assert.match(ponad.blad, /dobowa granica/);
});

test('PL2. plik jest rzeczą ze wskazaniem: odcisk, typ z zamkniętej listy i rozmiar muszą się zgadzać z zapisem', async () => {
  const { s, ok, bajty, plik } = await swiat();
  const u = bajty(4096);
  const p = ok(await plik('agent-a', 'pl2-plik', u));
  assert.equal(p.skutek, 'polozone');
  const rz = s.rzecz(p.rzecz);
  assert.notEqual(rz.obszar, null, 'plik od agenta leży tam, gdzie agent prowadzi');
  assert.deepEqual([rz.cechy.typ, rz.cechy.rozmiar], ['font/woff2', 4096]);
  const zlyRozmiar = await plik('agent-a', 'pl2-zly-rozmiar', bajty(100, 3), { rozmiar: 99 });
  assert.equal(zlyRozmiar.status, 422, JSON.stringify(zlyRozmiar));
  assert.match(zlyRozmiar.blad, /zapis ma 100 bajtów/);
  const strona = await plik('agent-a', 'pl2-strona', bajty(100, 4), { typ: 'text/html' });
  assert.equal(strona.status, 422, 'strona nie jest plikiem: ' + JSON.stringify(strona).slice(0, 160));
  const obrazZeSkryptem = await plik('agent-a', 'pl2-obraz-svg', bajty(100, 5), { typ: 'image/svg+xml' });
  assert.equal(obrazZeSkryptem.status, 422);
  const kod = ok(await s.kod('agent-a', '<!doctype html><title>x</title>', { op: 'pl2-kod-goscia' }));
  const nieBajty = await s.ruch('agent-a', { op: 'pl2-nie-bajty', co: 'poloz', rodzaj: 'plik/1', cechy: { nazwa: 'Podstawiony', typ: 'font/woff2', rozmiar: 10, tresc: kod.zapis } });
  assert.equal(nieBajty.status, 422, 'zapis innego rodzaju nie jest treścią pliku: ' + JSON.stringify(nieBajty).slice(0, 160));
});

test('PL3. droga bajtów do strony: te same bajty, typ z rzeczy, nigdy jako strona; plik z zamkniętego obszaru brzmi jak plik, którego nie ma', async () => {
  const { s, ok, bajty, plik, pytanie } = await swiat();
  const u = bajty(70000);
  const p = ok(await plik('agent-a', 'pl3-plik', u));
  const o = await pytanie('/api/srodowisko/bajty?rzecz=' + p.rzecz);
  assert.equal(o.status, 200);
  assert.deepEqual(new Uint8Array(await o.arrayBuffer()), u, 'bajty wracają co do jednego');
  assert.equal(o.headers.get('content-type'), 'font/woff2');
  assert.equal(o.headers.get('x-content-type-options'), 'nosniff');
  assert.match(o.headers.get('content-security-policy'), /sandbox/);
  assert.equal(o.headers.get('cache-control'), 'private, no-cache', 'dzisiejsza wersja może się zmienić');
  // przez drzwi da się też wgrać
  const wgrane = await (await pytanie('/api/srodowisko/bajty?op=pl3-wgrane-drzwiami', 'agent-a', { method: 'POST', body: bajty(300, 11), headers: { 'content-type': 'font/woff2' } })).json();
  assert.equal(wgrane.ok, true, JSON.stringify(wgrane));
  assert.equal(wgrane.rozmiar, 300);
  const zaDuze = await pytanie('/api/srodowisko/bajty?op=pl3-za-duze-drzwiami', 'agent-a', { method: 'POST', body: new Uint8Array(NAJWIEKSZY_PLIK + 5) });
  assert.equal(zaDuze.status, 413);
  // zamknięty obszar
  const T = ok(await s.ruch('jozz', { op: 'pl3-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  const tajny = ok(await plik('jozz', 'pl3-tajny-plik', bajty(500, 13), { nazwa: 'Tajny krój' }, { obszar: T }));
  const ukryty = await pytanie('/api/srodowisko/bajty?rzecz=' + tajny.rzecz);
  const brak = await pytanie('/api/srodowisko/bajty?rzecz=zzzzzzzzzzzzzzzzzzzzzzzzzz');
  assert.equal(ukryty.status, 404);
  assert.equal((await ukryty.text()).split(tajny.rzecz).join('X'), (await brak.text()).split('zzzzzzzzzzzzzzzzzzzzzzzzzz').join('X'), 'ukryty plik brzmi jak plik, którego nie ma');
  assert.equal((await pytanie('/api/srodowisko/bajty?rzecz=' + tajny.rzecz, 'jozz')).status, 200);
  assert.equal((await pytanie('/api/srodowisko/bajty?rzecz=cos')).status, 400);
  // rzecz innego rodzaju nie jest plikiem
  const widok = s.spis({ rodzaj: 'widok/1', limit: 1 })[0];
  if (widok) assert.equal((await pytanie('/api/srodowisko/bajty?rzecz=' + widok.id)).status, 404);
});

test('PL4. treść pliku jest niezmienna: nowe bajty to nowy plik; plik wskazany z odciskiem oddaje bajty także po odłożeniu, a obcy odcisk niczego nie otwiera', async () => {
  const { s, ok, bajty, plik, pytanie } = await swiat();
  const stare = bajty(2000, 1), nowe = bajty(2500, 2);
  const p = ok(await plik('agent-a', 'pl4-plik', stare));
  const odcisk = s.rzecz(p.rzecz).cechy.tresc;
  const z = ok(await s.bajty('agent-a', nowe, { op: 'pl4-nowe-bajty' }));
  let rz = s.rzecz(p.rzecz);
  const podmiana = await s.ruch('agent-a', { op: 'pl4-podmiana', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'plik/1', cechy: { ...rz.cechy, rozmiar: nowe.length, tresc: z.zapis } });
  assert.equal(podmiana.status, 422, JSON.stringify(podmiana));
  assert.match(podmiana.blad, /treść pliku jest niezmienna/);
  assert.equal((await s.ruch('jozz', { op: 'pl4-podmiana-wlasciciela', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'plik/1', cechy: { ...rz.cechy, typ: 'font/woff' } })).status, 422, 'także właścicielowi');
  // nazwę i opis da się zmienić; mają historię jak każda treść
  ok(await s.ruch('agent-a', { op: 'pl4-nazwa', co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'plik/1', cechy: { ...rz.cechy, nazwa: 'Krój próbny, poprawiona nazwa', opis: 'OFL' } }));
  assert.equal(s.historia(p.rzecz).length, 2);
  const przypiety = await pytanie('/api/srodowisko/bajty?rzecz=' + p.rzecz + '&odcisk=' + odcisk);
  assert.equal(przypiety.status, 200);
  assert.deepEqual(new Uint8Array(await przypiety.arrayBuffer()), stare);
  assert.equal(przypiety.headers.get('cache-control'), 'private, max-age=31536000, immutable');
  // odcisk innego zapisu (nawet istniejącego) niczego nie otwiera
  assert.equal((await pytanie('/api/srodowisko/bajty?rzecz=' + p.rzecz + '&odcisk=' + z.zapis)).status, 404);
  assert.equal((await pytanie('/api/srodowisko/bajty?rzecz=' + p.rzecz + '&odcisk=' + 'a'.repeat(64))).status, 404);
  // odłożony plik znika z list i nie oddaje bajtów "po prostu", ale temu, kto wskazał go z odciskiem, dalej je daje:
  // ten, kto prowadzi tam, gdzie plik leży, nie zabierze kroju, który ktoś przyjął
  rz = s.rzecz(p.rzecz);
  ok(await s.ruch('agent-a', { op: 'pl4-odloz', co: 'odloz', rzecz: rz.id, wersja: rz.wersja }));
  assert.equal((await pytanie('/api/srodowisko/bajty?rzecz=' + p.rzecz)).status, 404);
  const poOdlozeniu = await pytanie('/api/srodowisko/bajty?rzecz=' + p.rzecz + '&odcisk=' + odcisk);
  assert.equal(poOdlozeniu.status, 200);
  assert.deepEqual(new Uint8Array(await poOdlozeniu.arrayBuffer()), stare);
});

test('PL7. sam odcisk niczego nie otwiera: zapis z bajtami wskazuje ten, kto go wgrał, albo ten, kto widzi plik, który go niesie', async () => {
  const { r, s, ok, bajty, plik, pytanie } = await swiat(['agent-a', 'agent-b']);
  const T = ok(await s.ruch('jozz', { op: 'pl7-tajne', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  const tajne = bajty(3000, 41);
  const tp = ok(await plik('jozz', 'pl7-tajny-plik', tajne, { nazwa: 'Tajny krój' }, { obszar: T }));
  const odcisk = s.rzecz(tp.rzecz).cechy.tresc;
  const kradnij = (op, cechy = {}, opcje = {}) => s.ruch(opcje.kto || 'agent-a', { op, co: 'poloz', rodzaj: 'plik/1', cechy: { nazwa: 'Mój plik', typ: 'font/woff2', rozmiar: tajne.length, tresc: odcisk, ...cechy } }, opcje.gosc ? { gosc: opcje.gosc } : {});
  // cudzy odcisk brzmi dokładnie tak, jak odcisk, którego nie ma: bez rozmiaru i bez znaku, że takie bajty są
  const cudzy = await kradnij('pl7-cudzy-odcisk');
  const nieMa = await kradnij('pl7-nie-ma-zapisu', { tresc: '0'.repeat(64) });
  assert.equal(cudzy.status, 422, JSON.stringify(cudzy));
  assert.deepEqual(cudzy, nieMa, 'odmowa nie odróżnia cudzego zapisu od nieistniejącego');
  assert.match(cudzy.blad, /istniejącego zapisu/);
  const zlyRozmiar = await kradnij('pl7-zly-rozmiar', { rozmiar: 1 });
  assert.deepEqual(zlyRozmiar, cudzy, 'zły rozmiar nie wyciąga prawdziwego rozmiaru cudzego zapisu');
  assert.doesNotMatch(JSON.stringify(zlyRozmiar), /3000/);
  assert.equal(s.spis({ rodzaj: 'plik/1', odlozone: 'razem' }).filter((x) => x.cechy.tresc === odcisk).length, 1, 'nie powstał drugi plik z tajnymi bajtami');
  // narzędzie w oknie właściciela nie dziedziczy jego prawa do zapisu: wskaże tylko to, co widzą obie pary oczu
  const gosc = s.spis({ rodzaj: 'gosc/1' }).find((g) => g.cechy.umowa === 'okno/3');
  assert.ok(gosc, 'zasiany gość, który pisze');
  const zOkna = await kradnij('pl7-z-okna-wlasciciela', {}, { kto: 'jozz', gosc: gosc.id });
  assert.equal(zOkna.status, 422, JSON.stringify(zOkna));
  assert.equal(zOkna.blad, cudzy.blad);
  // jądro: akt bajtów jest prywatny, więc dziennik i treść po odcisku nie oddają ich nikomu poza właścicielem i wgrywającym
  assert.equal(r.dziennik(0, 500, 'agent-a').akty.some((a) => a.rodzaj === 'bajty/1'), false, 'agent nie widzi w dzienniku cudzych bajtów');
  assert.equal(r.zapisTresc(odcisk, 'agent-a').status, 404);
  assert.equal(r.zapisTresc(odcisk, 'jozz').ok, true);
  // kto sam wgrał te same bajty, ma je i tak: może położyć własny plik
  ok(await s.bajty('agent-a', tajne, { op: 'pl7-wlasne-wgranie' }));
  assert.equal(ok(await kradnij('pl7-po-wlasnym-wgraniu')).skutek, 'polozone');
  assert.equal((await kradnij('pl7-drugi-agent', {}, { kto: 'agent-b' })).skutek, 'polozone', 'agent-b widzi teraz plik agenta-a z tymi bajtami, więc może je wskazać');
  // jawny plik właściciela: bajty może pobrać każdy uczestnik, więc może je też wskazać we własnym pliku
  const jawne = bajty(1200, 43);
  const jp = ok(await plik('jozz', 'pl7-jawny-plik', jawne, { nazwa: 'Jawny krój' }));
  const jawnyOdcisk = s.rzecz(jp.rzecz).cechy.tresc;
  assert.equal(ok(await kradnij('pl7-kopia-jawnego', { tresc: jawnyOdcisk, rozmiar: jawne.length }, { kto: 'agent-b' })).ok, true);
  assert.equal(ok(await kradnij('pl7-kopia-z-okna', { tresc: jawnyOdcisk, rozmiar: jawne.length }, { kto: 'jozz', gosc: gosc.id })).ok, true, 'okno wskaże bajty pliku, który widzą obie pary oczu');
  // propozycja: agent proponuje plik z własnymi bajtami tam, gdzie tylko proponuje, a właściciel ją przyjmuje
  const wlasne = bajty(900, 47);
  const z = ok(await s.bajty('agent-a', wlasne, { op: 'pl7-do-propozycji' }));
  const prop = ok(await s.ruch('agent-a', { op: 'pl7-propozycja', co: 'poloz', rodzaj: 'plik/1', obszar: null, cechy: { nazwa: 'Proponowany', typ: 'font/woff2', rozmiar: wlasne.length, tresc: z.zapis } }));
  assert.equal(prop.skutek, 'propozycja');
  const przyjeta = ok(await s.ruch('jozz', { op: 'pl7-przyjecie', co: 'przyjmij', propozycja: prop.propozycja }));
  assert.equal(przyjeta.skutek, 'przyjeta');
  const pobrane = await pytanie('/api/srodowisko/bajty?rzecz=' + przyjeta.rzecz, 'agent-b');
  assert.deepEqual(new Uint8Array(await pobrane.arrayBuffer()), wlasne);
  // tajny plik dalej jest dla agenta plikiem, którego nie ma
  assert.equal((await pytanie('/api/srodowisko/bajty?rzecz=' + tp.rzecz + '&odcisk=' + odcisk, 'agent-b')).status, 404);
});

test('PL8. plik zostaje plikiem: treści nie da się podmienić przez rodzaj pośredni, a inna rzecz nie staje się plikiem', async () => {
  const { s, ok, bajty, plik, pytanie } = await swiat();
  const a = bajty(2000, 51), b = bajty(2100, 52);
  const p = ok(await plik('agent-a', 'pl8-plik', a));
  const odcisk = s.rzecz(p.rzecz).cechy.tresc;
  const zb = ok(await s.bajty('agent-a', b, { op: 'pl8-inne-bajty' }));
  let rz = s.rzecz(p.rzecz);
  // plik -> rodzaj bez kształtu, plik -> rodzaj z kształtem: obie drogi zamknięte, także dla właściciela
  for (const [kto, rodzaj, cechy] of [['agent-a', 'cos-bez-ksztaltu/1', { tresc: 'x' }], ['agent-a', 'projekt/1', { nazwa: 'Już nie plik' }], ['jozz', 'projekt/1', { nazwa: 'Już nie plik' }]]) {
    const w = await s.ruch(kto, { op: 'pl8-zmiana-' + kto + '-' + rodzaj.replace(/[^a-z]/g, ''), co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj, cechy });
    assert.equal(w.status, 422, JSON.stringify(w));
    assert.match(w.blad, /zostaje plikiem/);
  }
  // inna rzecz -> plik: też nie
  const proj = ok(await s.ruch('agent-a', { op: 'pl8-projekt', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Zwykła rzecz' } }));
  const pr = s.rzecz(proj.rzecz);
  const naPlik = await s.ruch('agent-a', { op: 'pl8-na-plik', co: 'poloz', rzecz: pr.id, wersja: pr.wersja, rodzaj: 'plik/1', cechy: { nazwa: 'Podmieniony', typ: 'font/woff2', rozmiar: b.length, tresc: zb.zapis } });
  assert.equal(naPlik.status, 422, JSON.stringify(naPlik));
  assert.match(naPlik.blad, /nie staje się plikiem/);
  // kto przypiął plik odciskiem, dostaje dalej te same bajty
  rz = s.rzecz(p.rzecz);
  assert.deepEqual([rz.rodzaj, rz.cechy.tresc], ['plik/1', odcisk]);
  const przypiety = await pytanie('/api/srodowisko/bajty?rzecz=' + p.rzecz + '&odcisk=' + odcisk);
  assert.equal(przypiety.status, 200);
  assert.deepEqual(new Uint8Array(await przypiety.arrayBuffer()), a);
});

test('PL9. dobowe granice liczą tylko nowe bajty i są trzy: Miejsce, wszyscy poza właścicielem razem, każdy z osobna', async () => {
  const { r, s, ok, bajty } = await swiat(['agent-a', 'agent-b']);
  const dzien = 'bajty:' + new Date(r.teraz()).toISOString().slice(0, 10);
  const u = bajty(50000, 61);
  for (let i = 0; i < 40; i++) ok(await s.bajty('agent-a', u, { op: 'pl9-ten-sam-' + i }));
  assert.deepEqual([r.meta(dzien), r.meta(dzien + ':inni'), r.meta(dzien + ':agent-a')], ['50000', '50000', '50000'], 'ten sam plik pod czterdziestoma op liczy się raz');
  ok(await s.bajty('jozz', bajty(700, 62), { op: 'pl9-wlasciciel-1' }));
  assert.deepEqual([r.meta(dzien), r.meta(dzien + ':inni'), r.meta(dzien + ':jozz')], ['50700', '50000', null], 'właściciel nie zużywa części pozostałych i nie ma własnej granicy poza granicą Miejsca');
  // jeden agent przy swojej granicy: on staje, drugi agent i właściciel nie
  r.ustawMeta(dzien + ':agent-a', String(NAJWIECEJ_BAJTOW_UCZESTNIKA_NA_DOBE - 10));
  const swoja = await s.bajty('agent-a', bajty(100, 63), { op: 'pl9-ponad-swoja' });
  assert.equal(swoja.status, 429, JSON.stringify(swoja));
  assert.match(swoja.blad, /wgrałeś dziś/);
  assert.equal(ok(await s.bajty('agent-a', u, { op: 'pl9-znane-bajty' })).zapis.length, 64, 'bajty, które już są, przechodzą także przy granicy');
  ok(await s.bajty('agent-b', bajty(100, 64), { op: 'pl9-drugi-agent' }));
  ok(await s.bajty('jozz', bajty(100, 65), { op: 'pl9-wlasciciel-2' }));
  // wszyscy poza właścicielem przy wspólnej granicy: agenci stają, właściciel nie
  r.ustawMeta(dzien + ':inni', String(NAJWIECEJ_BAJTOW_INNYCH_NA_DOBE - 10));
  const wspolna = await s.bajty('agent-b', bajty(100, 66), { op: 'pl9-ponad-wspolna' });
  assert.equal(wspolna.status, 429, JSON.stringify(wspolna));
  assert.match(wspolna.blad, /poza właścicielem/);
  ok(await s.bajty('jozz', bajty(100, 67), { op: 'pl9-wlasciciel-3' }));
  // granica całego Miejsca zatrzymuje także właściciela
  r.ustawMeta(dzien, String(NAJWIECEJ_BAJTOW_NA_DOBE - 10));
  const cale = await s.bajty('jozz', bajty(100, 68), { op: 'pl9-ponad-miejsce' });
  assert.equal(cale.status, 429, JSON.stringify(cale));
  assert.match(cale.blad, /to Miejsce przyjęło dziś/);
});

test('PL10. rodzina kroju to nazwy rodzin, nie dowolny napis', async () => {
  const { s, ok } = await swiat();
  const ustaw = (op, rodzina) => s.ruch('jozz', { op, co: 'poloz', rodzaj: 'wartosc/1', wersja: 'dowolna', cechy: { pokretlo: 'wyglad.kroj.imiona', wartosc: { rodzina } } });
  for (const [i, dobra] of ['Anybody, sans-serif', '"Segoe UI", system-ui, -apple-system', "'Zażółć Gęślą', serif", 'Recursive_Mono-1.085'].entries()) {
    ok(await ustaw('pl10-dobra-' + i, dobra));
    assert.equal(pasuje({ typ: 'kroj' }, { rodzina: dobra }), true, dobra);
  }
  for (const [i, zla] of ['x"; } body { background: url(https://zly.example/a) } .y { font-family: "z', 'a; color: red', 'url(https://zly.example/f.woff2)', 'a\nb', '<b>'].entries()) {
    const w = await ustaw('pl10-zla-rodzina-' + i, zla);
    assert.equal(w.status, 422, JSON.stringify(w));
    assert.equal(pasuje({ typ: 'kroj' }, { rodzina: zla }), false, zla);
  }
});

test('PL5. krój z pliku: wartość kroju wskazuje plik razem z odciskiem; plik musi być krojem, a odcisk jego odciskiem', async () => {
  const { s, ok, bajty, plik } = await swiat();
  const p = ok(await plik('jozz', 'pl5-kroj', bajty(3000, 21), { nazwa: 'Anybody' }));
  const odcisk = s.rzecz(p.rzecz).cechy.tresc;
  const obraz = ok(await plik('jozz', 'pl5-obraz', bajty(900, 22), { nazwa: 'Obrazek', typ: 'image/png' }));
  const ustaw = (op, w) => s.ruch('jozz', { op, co: 'poloz', rodzaj: 'wartosc/1', wersja: 'dowolna', cechy: { pokretlo: 'wyglad.kroj.imiona', wartosc: w } });
  const dobra = { rodzina: 'Anybody, sans-serif', grubosc: 700, osie: { wdth: 118 }, plik: { rzecz: p.rzecz, odcisk } };
  ok(await ustaw('pl5-dobra', dobra));
  assert.deepEqual(policzUstawienia(s.dla('agent-a')).wartosci['wyglad.kroj.imiona'].wartosc, dobra, 'twarz dostaje wskazanie razem z odciskiem');
  for (const [op, w, wzor] of [
    ['pl5-obraz-jako-kroj', { rodzina: 'X', plik: { rzecz: obraz.rzecz, odcisk: s.rzecz(obraz.rzecz).cechy.tresc } }, /ma być krojem/],
    ['pl5-zly-odcisk', { rodzina: 'X', plik: { rzecz: p.rzecz, odcisk: 'a'.repeat(64) } }, /nie jest odciskiem tego pliku/],
    ['pl5-nie-ma-pliku', { rodzina: 'X', plik: { rzecz: 'zzzzzzzzzzzzzzzzzzzzzzzzzz', odcisk } }, /nie ma pliku/],
    ['pl5-zly-ksztalt', { rodzina: 'X', plik: 'Anybody.woff2' }, /plik kroju to/],
  ]) {
    const o = await ustaw(op, w);
    assert.equal(o.status, 422, JSON.stringify(o));
    assert.match(o.blad, wzor);
  }
  assert.ok(pasuje({ typ: 'kroj' }, dobra), 'twarz przyjmuje krój z plikiem');
  assert.ok(!pasuje({ typ: 'kroj' }, { rodzina: 'X', plik: { rzecz: 'krotkie', odcisk } }));
  // nowe bajty to nowy plik: wartość dalej wskazuje ten, który ktoś przyjął
  const nowy = ok(await plik('jozz', 'pl5-kroj-drugi', bajty(3100, 23), { nazwa: 'Anybody 2' }));
  assert.notEqual(nowy.rzecz, p.rzecz);
  assert.deepEqual(policzUstawienia(s.dla('agent-a')).wartosci['wyglad.kroj.imiona'].wartosc.plik, { rzecz: p.rzecz, odcisk });
});

test('PL6. wejście po wycinku: spis oddaje kilka rodzajów naraz, po samej nazwie albo z pokoleniem, a liczba zgadza się z tym, co widać', async () => {
  const { s, ok, pytanie } = await swiat();
  const T = ok(await s.ruch('jozz', { op: 'pl6-tajne-001', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
  ok(await s.ruch('jozz', { op: 'pl6-projekt-1', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Jawny projekt' } }));
  ok(await s.ruch('jozz', { op: 'pl6-projekt-2', co: 'poloz', rodzaj: 'projekt/1', obszar: T, cechy: { nazwa: 'Tajny projekt' } }));
  const wszystko = await (await pytanie('/api/srodowisko/spis')).json();
  const wycinek = await (await pytanie('/api/srodowisko/spis?rodzaje=projekt,widok/1,pokretlo')).json();
  assert.ok(wycinek.rzeczy.length > 0 && wycinek.razem < wszystko.razem, `wycinek ${wycinek.razem} wobec ${wszystko.razem}`);
  assert.equal(wycinek.razem, wycinek.rzeczy.length);
  assert.deepEqual([...new Set(wycinek.rzeczy.map((r) => r.rodzaj))].sort(), ['pokretlo/1', 'projekt/1', 'widok/1'].filter((r) => wycinek.rzeczy.some((x) => x.rodzaj === r)).sort());
  assert.ok(wycinek.rzeczy.some((r) => r.cechy.nazwa === 'Jawny projekt') && !wycinek.rzeczy.some((r) => r.cechy.nazwa === 'Tajny projekt'), 'wycinek idzie oczami czytającego');
  assert.equal(wycinek.rzeczy.filter((r) => r.rodzaj === 'projekt/1').length, s.spis({ rodzaj: 'projekt', dla: 'agent-a' }).length, 'wybór po samej nazwie dalej znaczy wszystkie pokolenia');
  assert.equal(s.spis({ rodzaj: 'projekt' }).length, 2);
  assert.equal(s.spis({ rodzaj: 'proj' }).length, 0, 'początek nazwy to nie nazwa');
  assert.equal(s.ile({ rodzaje: ['projekt'] }), 2);
  assert.equal((await (await pytanie('/api/srodowisko/spis?rodzaje=ZLE%20RODZAJE')).json()).razem, 0);
  // zmiany po akcie też po wycinku
  const akt = s.ostatniNr();
  ok(await s.ruch('jozz', { op: 'pl6-projekt-3', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Późniejszy' } }));
  ok(await s.ruch('jozz', { op: 'pl6-widok-0001', co: 'poloz', rodzaj: 'widok/1', cechy: { nazwa: 'Późniejszy widok' } }));
  const roznica = await (await pytanie('/api/srodowisko/spis?odlozone=razem&po=' + akt + '&rodzaje=projekt')).json();
  assert.deepEqual(roznica.rzeczy.map((r) => r.cechy.nazwa), ['Późniejszy']);
});

test('PL11. kod gościa liczy się do tych samych dobowych granic co pliki: tylko nowy kod, trzy granice, liczniki wspólne z plikami', async () => {
  const { r, s, ok, bajty } = await swiat(['agent-a', 'agent-b']);
  const dzien = 'bajty:' + new Date(r.teraz()).toISOString().slice(0, 10);
  const strona = (n, znak = 'a') => '<!doctype html><title>k</title><p>' + znak.repeat(n) + '</p>';
  const k1 = strona(40000);
  const rozmiar = new TextEncoder().encode(k1).length;
  for (let i = 0; i < 5; i++) ok(await s.kod('agent-a', k1, { op: 'pl11-ten-sam-' + i }));
  assert.deepEqual([r.meta(dzien), r.meta(dzien + ':inni'), r.meta(dzien + ':agent-a')], [String(rozmiar), String(rozmiar), String(rozmiar)], 'ten sam kod pod pięcioma op liczy się raz');
  ok(await s.bajty('agent-a', bajty(1000, 71), { op: 'pl11-plik' }));
  assert.equal(r.meta(dzien + ':agent-a'), String(rozmiar + 1000), 'kod i pliki liczą się do tych samych liczników');
  // jeden agent przy swojej granicy: jego nowy kod staje, znany kod przechodzi, drugi agent i właściciel nie stają
  r.ustawMeta(dzien + ':agent-a', String(NAJWIECEJ_BAJTOW_UCZESTNIKA_NA_DOBE - 10));
  const swoja = await s.kod('agent-a', strona(100, 'b'), { op: 'pl11-ponad-swoja' });
  assert.equal(swoja.status, 429, JSON.stringify(swoja));
  assert.match(swoja.blad, /wgrałeś dziś/);
  assert.match(swoja.blad, /kodu gości/);
  assert.equal(ok(await s.kod('agent-a', k1, { op: 'pl11-znany-kod' })).zapis.length, 64, 'kod, który już jest, przechodzi także przy granicy');
  ok(await s.kod('agent-b', strona(100, 'c'), { op: 'pl11-drugi-agent' }));
  ok(await s.kod('jozz', strona(100, 'd'), { op: 'pl11-wlasciciel-1' }));
  // wszyscy poza właścicielem przy wspólnej granicy: agenci stają, właściciel nie
  r.ustawMeta(dzien + ':inni', String(NAJWIECEJ_BAJTOW_INNYCH_NA_DOBE - 10));
  const wspolna = await s.kod('agent-b', strona(100, 'e'), { op: 'pl11-ponad-wspolna' });
  assert.equal(wspolna.status, 429, JSON.stringify(wspolna));
  assert.match(wspolna.blad, /poza właścicielem/);
  ok(await s.kod('jozz', strona(100, 'f'), { op: 'pl11-wlasciciel-2' }));
  // granica całego Miejsca zatrzymuje także właściciela, i kod, i plik
  r.ustawMeta(dzien, String(NAJWIECEJ_BAJTOW_NA_DOBE - 10));
  const cale = await s.kod('jozz', strona(100, 'g'), { op: 'pl11-ponad-miejsce' });
  assert.equal(cale.status, 429, JSON.stringify(cale));
  assert.match(cale.blad, /to Miejsce przyjęło dziś/);
  assert.equal((await s.bajty('jozz', bajty(100, 72), { op: 'pl11-plik-ponad' })).status, 429, 'plik przy tej samej granicy też staje');
});

test('PL12. pęknięcie z raportu Neona (24 XI): uczestnik nie zapełni bazy kodem gości; szósty nowy kod po 1,9 MB tego samego dnia dostaje 429, a czytelne zdanie mówi dlaczego', async () => {
  const { r, s, ok } = await swiat(['agent-a']);
  const dzien = 'bajty:' + new Date(r.teraz()).toISOString().slice(0, 10);
  const duzy = (i) => '<!doctype html><title>' + i + '</title><p>' + String(i).repeat(1900000) + '</p>';
  for (let i = 1; i <= 5; i++) ok(await s.kod('agent-a', duzy(i), { op: 'pl12-duzy-kod-' + i }));
  const szosty = await s.kod('agent-a', duzy(6), { op: 'pl12-duzy-kod-6' });
  assert.equal(szosty.status, 429, JSON.stringify({ status: szosty.status, blad: szosty.blad }));
  assert.match(szosty.blad, /wgrałeś dziś .* bajtów nowych plików i kodu gości; dobowa granica to 10485760/);
  assert.ok(Number(r.meta(dzien + ':agent-a')) <= NAJWIECEJ_BAJTOW_UCZESTNIKA_NA_DOBE, 'licznik nie przekracza granicy');
  // przez drzwi HTTP to ta sama odmowa z tym samym kodem odpowiedzi
  const h = await obsluzSrodowisko(s, new Request('https://proba.example/api/srodowisko/kod?op=pl12-przez-drzwi', { method: 'POST', headers: { 'x-kto': 'agent-a', 'content-type': 'text/html' }, body: duzy(7) }));
  assert.equal(h.status, 429);
});
