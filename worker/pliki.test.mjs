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
import { NAJWIEKSZY_PLIK, NAJWIECEJ_BAJTOW_NA_DOBE, naBase64, zBase64, rozmiarZBase64 } from './pliki.mjs';
import { pasuje } from '../public/pokretla.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 18, 1, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
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
