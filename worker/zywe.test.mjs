// Sprawdziany kanału na żywo i czytania zmian (17 XI 2026). Gniazda są udawane: zwykłe obiekty z send, close
// i załącznikiem. To podłoga budowniczego; prawdziwe połączenie sprawdza się pod adresem podglądu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen, skrot } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { Miejsce } from './miejsce-do.mjs';
import worker from './index.mjs';
import { obecni, rozglos, rozglosObecnych, przyjmijGniazdo, przyjmijWiadomosc, poZamknieciu, zrobMiejsce, stanGniazda,
  ADRES_ZYWEGO, NAJWIECEJ_NA_MINUTE, NAJWIECEJ_ZLYCH_KLUCZY, KOD_ZLY_KLUCZ, KOD_ZA_DUZO, KOD_USTAP } from './zywe.mjs';

const KLUCZ_WLASCICIELA = 'klucz-wlasciciela-do-sprawdzianu';
const KLUCZ_AGENTA = 'klucz-agenta-do-sprawdzianu-01';
const env = async (dodatkowe = {}) => ({ KLUCZE: JSON.stringify({ jozz: await skrot(KLUCZ_WLASCICIELA), 'agent-probny': await skrot(KLUCZ_AGENTA) }), WLASCICIEL: 'jozz', ...dodatkowe });
const RZECZ = 'a'.repeat(26);

function gniazdo(stan = null) {
  const g = {
    wyslane: [], zamkniete: null, zal: stan,
    send(t) { if (g.zamkniete) throw new Error('gniazdo zamknięte'); g.wyslane.push(JSON.parse(t)); },
    close(kod, powod) { g.zamkniete = { kod, powod }; },
    serializeAttachment(s) { g.zal = structuredClone(s); },
    deserializeAttachment() { return g.zal ? structuredClone(g.zal) : null; },
  };
  return g;
}
const ostatnia = (g, t) => [...g.wyslane].reverse().find((w) => w.t === t) || null;

test('Z1. obecni: jedno imię raz, z rzeczą, przy której jest; cichy uczestnik nie jest liczony; bez klucza to sama liczba', () => {
  const lista = [gniazdo({ kto: 'jozz' }), gniazdo({ kto: 'jozz', przy: RZECZ }), gniazdo({ kto: 'agent-probny', cicho: true }), gniazdo({ kto: 'beta' }), gniazdo({}), gniazdo(null)];
  assert.deepEqual(obecni(lista), { lista: [{ kto: 'beta' }, { kto: 'jozz', przy: RZECZ }], bez_klucza: 2 });
});

test('Z2. rozgłoszenie zmiany: na podglądzie słyszy każdy, poza podglądem tylko połączenie z kluczem', () => {
  const zKluczem = gniazdo({ kto: 'jozz' }), bez = gniazdo({});
  assert.equal(rozglos([zKluczem, bez], { t: 'akt', akt: 7 }, { podglad: true }), 2);
  assert.equal(rozglos([zKluczem, bez], { t: 'akt', akt: 8 }, { podglad: false }), 1);
  assert.deepEqual(bez.wyslane, [{ t: 'akt', akt: 7 }]);
  assert.deepEqual(zKluczem.wyslane.map((w) => w.akt), [7, 8]);
  // gniazdo, które już nie przyjmuje, nie zatrzymuje pozostałych
  const martwe = gniazdo({ kto: 'beta' }); martwe.zamkniete = { kod: 1006 };
  assert.equal(rozglos([martwe, zKluczem], { t: 'akt', akt: 9 }, { podglad: true }), 1);
});

test('Z3. nowe połączenie: z kluczem w nagłówku od razu wie, kim jest; bez klucza na podglądzie dostaje numer aktu i liczbę obecnych; poza podglądem nic', () => {
  const stary = gniazdo({ kto: 'agent-probny' });
  const zKluczem = gniazdo();
  przyjmijGniazdo(zKluczem, { kto: 'jozz', podglad: false, akt: 12, gniazda: [stary, zKluczem], teraz: 1000 });
  assert.deepEqual(zKluczem.wyslane[0], { t: 'witaj', kto: 'jozz', akt: 12 });
  assert.deepEqual(ostatnia(stary, 'obecni').lista.map((x) => x.kto), ['agent-probny', 'jozz'], 'obecny wcześniej dowiaduje się, że ktoś doszedł');
  assert.equal(stanGniazda(zKluczem).od, 1000);

  const zwiedzajacy = gniazdo();
  przyjmijGniazdo(zwiedzajacy, { podglad: true, akt: 12, gniazda: [stary, zKluczem, zwiedzajacy] });
  assert.deepEqual(zwiedzajacy.wyslane, [{ t: 'akt', akt: 12 }, { t: 'obecni', ilu: 2, bez_klucza: 1 }], 'bez klucza: liczba, nie imiona');

  const obcy = gniazdo();
  przyjmijGniazdo(obcy, { podglad: false, akt: 12, gniazda: [stary, obcy] });
  assert.deepEqual(obcy.wyslane, [], 'poza podglądem połączenie bez klucza nie słyszy niczego');
});

test('Z4. przedstawienie się kluczem: dobry klucz daje imię i numer aktu; zły zostawia zwiedzającego, a po kilku próbach zamyka', async () => {
  const e = await env();
  const inne = gniazdo({ kto: 'agent-probny' });
  const g = gniazdo();
  const wszystkie = [inne, g];
  const opcje = { env: e, gniazda: () => wszystkie, podglad: true, akt: () => 33 };
  przyjmijGniazdo(g, { podglad: true, akt: 30, gniazda: wszystkie });
  await przyjmijWiadomosc(g, JSON.stringify({ t: 'jestem', klucz: KLUCZ_WLASCICIELA }), opcje);
  assert.deepEqual(ostatnia(g, 'witaj'), { t: 'witaj', kto: 'jozz', akt: 33 });
  assert.equal(stanGniazda(g).kto, 'jozz');
  assert.deepEqual(ostatnia(inne, 'obecni').lista.map((x) => x.kto), ['agent-probny', 'jozz']);

  const zly = gniazdo();
  przyjmijGniazdo(zly, { podglad: true, akt: 30, gniazda: [zly] });
  for (let i = 1; i <= NAJWIECEJ_ZLYCH_KLUCZY; i++) {
    await przyjmijWiadomosc(zly, JSON.stringify({ t: 'jestem', klucz: 'nieznany-klucz-numer-' + i }), { ...opcje, gniazda: () => [zly] });
    assert.equal(ostatnia(zly, 'blad').blad, 'nieznany klucz');
    assert.equal(Boolean(zly.zamkniete), i === NAJWIECEJ_ZLYCH_KLUCZY, 'zamknięcie dopiero po ostatniej dozwolonej próbie');
  }
  assert.equal(zly.zamkniete.kod, KOD_ZLY_KLUCZ);
  assert.equal(stanGniazda(zly).kto, null);

  // poza podglądem połączenie bez klucza i tak nic nie słyszy, więc zły klucz zamyka je od razu
  const poza = gniazdo();
  przyjmijGniazdo(poza, { podglad: false, akt: 30, gniazda: [poza] });
  await przyjmijWiadomosc(poza, JSON.stringify({ t: 'jestem', klucz: 'nieznany-klucz-numer-0' }), { ...opcje, podglad: false, gniazda: () => [poza] });
  assert.equal(poza.zamkniete.kod, KOD_ZLY_KLUCZ);
  // za krótki klucz, klucz nie-napis i śmieci zamiast wiadomości nie dają imienia ani wyjątku
  const smieci = gniazdo();
  przyjmijGniazdo(smieci, { podglad: true, akt: 30, gniazda: [smieci] });
  for (const w of [JSON.stringify({ t: 'jestem', klucz: 'krotki' }), JSON.stringify({ t: 'jestem', klucz: 7 }), 'to nie jest json', JSON.stringify(null), JSON.stringify({ t: 5 }), 'x'.repeat(3000), 12]) {
    await przyjmijWiadomosc(smieci, w, { ...opcje, gniazda: () => [smieci] });
  }
  assert.equal(stanGniazda(smieci).kto, null);
  assert.equal(smieci.zamkniete, null);
});

test('Z5. przy rzeczy, wyłącznik obecności i wyjście: zmiany widzą inni uczestnicy, a cichy uczestnik znika z listy', async () => {
  const e = await env();
  const ja = gniazdo({ kto: 'jozz' }), agent = gniazdo({ kto: 'agent-probny' }), zwiedzajacy = gniazdo({});
  const wszystkie = [ja, agent, zwiedzajacy];
  const opcje = { env: e, gniazda: () => wszystkie, podglad: true, akt: () => 1 };
  await przyjmijWiadomosc(ja, JSON.stringify({ t: 'przy', rzecz: RZECZ }), opcje);
  assert.deepEqual(ostatnia(agent, 'obecni').lista, [{ kto: 'agent-probny' }, { kto: 'jozz', przy: RZECZ }]);
  assert.deepEqual(ostatnia(zwiedzajacy, 'obecni'), { t: 'obecni', ilu: 2, bez_klucza: 1 }, 'zwiedzający nie widzi imion ani rzeczy');
  const ile = agent.wyslane.length;
  await przyjmijWiadomosc(ja, JSON.stringify({ t: 'przy', rzecz: RZECZ }), opcje);
  assert.equal(agent.wyslane.length, ile, 'to samo jeszcze raz niczego nie rozgłasza');
  await przyjmijWiadomosc(ja, JSON.stringify({ t: 'przy', rzecz: 'nie-identyfikator' }), opcje);
  assert.deepEqual(ostatnia(agent, 'obecni').lista, [{ kto: 'agent-probny' }, { kto: 'jozz' }], 'zły identyfikator znaczy: przy żadnej');

  await przyjmijWiadomosc(ja, JSON.stringify({ t: 'cicho' }), opcje);
  assert.deepEqual(ostatnia(agent, 'obecni').lista, [{ kto: 'agent-probny' }]);
  await przyjmijWiadomosc(ja, JSON.stringify({ t: 'przy', rzecz: RZECZ }), opcje);
  assert.equal(stanGniazda(ja).przy ?? null, null, 'cichy uczestnik nie zostawia też śladu, przy czym jest');
  assert.equal(rozglos(wszystkie, { t: 'akt', akt: 2 }, { podglad: false }), 2, 'cichy dalej słyszy zmiany');
  await przyjmijWiadomosc(ja, JSON.stringify({ t: 'cicho', cicho: false }), opcje);
  assert.deepEqual(ostatnia(agent, 'obecni').lista.map((x) => x.kto), ['agent-probny', 'jozz']);

  await przyjmijWiadomosc(ja, JSON.stringify({ t: 'wychodze' }), opcje);
  assert.equal(stanGniazda(ja).kto, null);
  assert.deepEqual(ostatnia(agent, 'obecni').lista, [{ kto: 'agent-probny' }]);
  // zwiedzający nie może ustawić niczego o sobie
  const przed = agent.wyslane.length;
  await przyjmijWiadomosc(zwiedzajacy, JSON.stringify({ t: 'przy', rzecz: RZECZ }), opcje);
  await przyjmijWiadomosc(zwiedzajacy, JSON.stringify({ t: 'cicho' }), opcje);
  assert.equal(agent.wyslane.length, przed);

  // zamknięcie połączenia: lista wraca do pozostałych tylko wtedy, gdy zamykającego było widać
  const drugi = gniazdo({ kto: 'beta' });
  poZamknieciu(drugi, [agent, drugi], { podglad: true });
  assert.deepEqual(ostatnia(agent, 'obecni').lista, [{ kto: 'agent-probny' }]);
  const ileTeraz = agent.wyslane.length;
  poZamknieciu(gniazdo({}), [agent], { podglad: true });
  poZamknieciu(gniazdo({ kto: 'beta', cicho: true }), [agent], { podglad: true });
  assert.equal(agent.wyslane.length, ileTeraz);
});

test('Z6. gniazdo, które zalewa wiadomościami, traci połączenie; po minucie licznik zaczyna od nowa', async () => {
  const g = gniazdo({ kto: 'jozz', okno: 0, n: 0 });
  const opcje = { env: {}, gniazda: () => [g], podglad: true, akt: () => 1 };
  for (let i = 0; i < NAJWIECEJ_NA_MINUTE; i++) await przyjmijWiadomosc(g, JSON.stringify({ t: 'przy', rzecz: null }), { ...opcje, teraz: 1000 + i });
  assert.equal(g.zamkniete, null);
  await przyjmijWiadomosc(g, JSON.stringify({ t: 'przy', rzecz: null }), { ...opcje, teraz: 2000 });
  assert.equal(g.zamkniete.kod, KOD_ZA_DUZO);

  const spokojne = gniazdo({ kto: 'jozz', okno: 0, n: NAJWIECEJ_NA_MINUTE });
  await przyjmijWiadomosc(spokojne, JSON.stringify({ t: 'przy', rzecz: null }), { ...opcje, gniazda: () => [spokojne], teraz: 61 * 1000 });
  assert.equal(spokojne.zamkniete, null);
  assert.equal(stanGniazda(spokojne).n, 1);
});

test('Z6b. napis "ping" nie liczy się do granicy: pod adresem odpowiada na niego samo połączenie, więc i tutaj nie zamyka', async () => {
  // Atak drugiej linii (17 XI, proby/z3-kanal-na-zywo/atak-zalew.mjs): pod adresem 90 razy "ping" zostawia połączenie,
  // a 90 razy cokolwiek innego kończy się kodem 4429. Ten sprawdzian pilnuje, żeby Node mówił to samo co adres.
  const g = gniazdo({ kto: 'jozz', okno: 0, n: 0 });
  g.send = (t) => { g.wyslane.push(t); };
  const opcje = { env: {}, gniazda: () => [g], podglad: true, akt: () => 1 };
  for (let i = 0; i < NAJWIECEJ_NA_MINUTE + 30; i++) await przyjmijWiadomosc(g, 'ping', { ...opcje, teraz: 1000 + i });
  assert.equal(g.zamkniete, null);
  assert.equal(stanGniazda(g).n || 0, 0, 'ping nie rusza licznika');
  assert.equal(g.wyslane.filter((x) => x === 'pong').length, NAJWIECEJ_NA_MINUTE + 30);
  for (let i = 0; i <= NAJWIECEJ_NA_MINUTE; i++) await przyjmijWiadomosc(g, 'pong', { ...opcje, teraz: 5000 + i });
  assert.equal(g.zamkniete.kod, KOD_ZA_DUZO, 'każdy inny napis liczy się jak zwykła wiadomość');
});

test('Z7. miejsce na nowe połączenie: gdy jest pełno, ustępuje najstarsze bez klucza; gdy wszystkie mają klucze, nowe czeka', () => {
  const a = gniazdo({ od: 5 }), b = gniazdo({ od: 2 }), c = gniazdo({ kto: 'jozz', od: 1 });
  assert.equal(zrobMiejsce([a, b, c], 4), true);
  assert.equal(b.zamkniete, null);
  assert.equal(zrobMiejsce([a, b, c], 3), true);
  assert.equal(b.zamkniete.kod, KOD_USTAP, 'ustąpiło najstarsze połączenie bez klucza');
  assert.equal(a.zamkniete, null);
  assert.equal(c.zamkniete, null);
  assert.equal(zrobMiejsce([c, gniazdo({ kto: 'beta' })], 2), false);
});

// Obiekt Miejsca z udawanym środowiskiem połączeń: para gniazd i lista przyjętych.
function obiektZGniazdami(env) {
  const przyjete = [];
  const ctx = { storage: { sql: sqlZNode() }, acceptWebSocket: (ws) => przyjete.push(ws), getWebSockets: () => przyjete.filter((g) => !g.zamkniete) };
  return { obiekt: new Miejsce(ctx, env), przyjete };
}
const zadanie = (sciezka, opcje = {}) => new Request('https://przyklad.test' + sciezka, { ...opcje, headers: { 'x-origin': 'https://przyklad.test', 'content-type': 'application/json', ...(opcje.headers || {}) } });

test('Z8. obiekt Miejsca: połączenie zostaje przyjęte, a każdy ruch dociera do połączeń jako numer aktu; czytanie niczego nie rozgłasza', async (t) => {
  const stara = globalThis.WebSocketPair;
  globalThis.WebSocketPair = function Para() { return [gniazdo(), gniazdo()]; };
  t.after(() => { if (stara === undefined) delete globalThis.WebSocketPair; else globalThis.WebSocketPair = stara; });

  const { obiekt, przyjete } = obiektZGniazdami({ WLASCICIEL: 'jozz', PODGLAD: 'tak' });
  const bez = await obiekt._otworzZywe(zadanie(ADRES_ZYWEGO));
  assert.equal(bez.status, 426, 'bez nagłówka Upgrade to nie jest połączenie');
  const w = await obiekt._otworzZywe(zadanie(ADRES_ZYWEGO, { headers: { upgrade: 'websocket' } }));
  assert.ok(w.klient, 'łączący dostaje swoją stronę pary');
  assert.equal(przyjete.length, 1);
  const serwer = przyjete[0];
  const aktNaWejsciu = serwer.wyslane[0];
  assert.equal(aktNaWejsciu.t, 'akt');
  assert.equal(aktNaWejsciu.akt, obiekt.srod.ostatniNr(), 'na wejściu połączenie wie, na którym akcie stoi Miejsce');

  const przed = serwer.wyslane.length;
  await obiekt.fetch(zadanie('/api/srodowisko/puls'));
  await obiekt.fetch(zadanie('/api/srodowisko/opis'));
  assert.equal(serwer.wyslane.length, przed, 'czytanie niczego nie rozgłasza');
  const ruch = await obiekt.fetch(zadanie('/api/srodowisko/ruch', { method: 'POST', headers: { 'x-kto': 'jozz' }, body: JSON.stringify({ op: 'zywe-test-z8-1', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'na zywo', dotyczy: [] } }) }));
  assert.equal(ruch.status, 200, await ruch.clone().text());
  assert.deepEqual(serwer.wyslane.at(-1), { t: 'akt', akt: obiekt.srod.ostatniNr() });
  assert.ok(serwer.wyslane.at(-1).akt > aktNaWejsciu.akt);
  // odmowa (ruch bez klucza) nie zmienia aktu, więc niczego nie rozgłasza
  const ile = serwer.wyslane.length;
  const odmowa = await obiekt.fetch(zadanie('/api/srodowisko/ruch', { method: 'POST', body: JSON.stringify({ op: 'zywe-test-z8-2', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'x', dotyczy: [] } }) }));
  assert.ok(odmowa.status >= 400);
  assert.equal(serwer.wyslane.length, ile);

  // wiadomość od połączenia i jego zamknięcie przechodzą przez obiekt bez wyjątku
  await obiekt.webSocketMessage(serwer, JSON.stringify({ t: 'przy', rzecz: RZECZ }));
  await obiekt.webSocketClose(serwer, 1000, '', true);
  assert.equal(serwer.zamkniete.kod, 1000);
  await obiekt.webSocketError(serwer, new Error('zerwane'));
});

test('Z9. obiekt Miejsca poza podglądem: połączenie bez klucza nie słyszy zmian, połączenie z kluczem z nagłówka słyszy', async (t) => {
  const stara = globalThis.WebSocketPair;
  globalThis.WebSocketPair = function Para() { return [gniazdo(), gniazdo()]; };
  t.after(() => { if (stara === undefined) delete globalThis.WebSocketPair; else globalThis.WebSocketPair = stara; });
  const { obiekt, przyjete } = obiektZGniazdami(await env());
  await obiekt._otworzZywe(zadanie(ADRES_ZYWEGO, { headers: { upgrade: 'websocket' } }));
  await obiekt._otworzZywe(zadanie(ADRES_ZYWEGO, { headers: { upgrade: 'websocket', 'x-kto': 'agent-probny' } }));
  const [bez, agent] = przyjete;
  assert.deepEqual(bez.wyslane, []);
  assert.equal(agent.wyslane[0].t, 'witaj');
  await obiekt.fetch(zadanie('/api/srodowisko/ruch', { method: 'POST', headers: { 'x-kto': 'jozz' }, body: JSON.stringify({ op: 'zywe-test-z9-1', co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'tylko dla swoich', dotyczy: [] } }) }));
  assert.deepEqual(bez.wyslane, [], 'numer aktu poza podglądem jest tylko dla uczestników');
  assert.equal(agent.wyslane.at(-1).t, 'akt');
  // przeglądarka przedstawia się pierwszą wiadomością i od tej chwili słyszy
  await obiekt.webSocketMessage(bez, JSON.stringify({ t: 'jestem', klucz: KLUCZ_WLASCICIELA }));
  assert.deepEqual(bez.wyslane[0], { t: 'witaj', kto: 'jozz', akt: obiekt.srod.ostatniNr() });
});

test('Z10. drzwi kanału w Workerze: bez Upgrade 426, z obcej strony 403, a dalej idą tylko nagłówki zbudowane od zera', async () => {
  const e = await env({ PODGLAD: 'tak' });
  let doObiektu = null;
  e.MIEJSCE = { idFromName: (n) => n, get: () => ({ fetch: async (zad) => { doObiektu = zad; return new Response('przyjęte'); } }) };
  const adres = 'https://przyklad.test' + ADRES_ZYWEGO;
  assert.equal((await worker.fetch(new Request(adres), e)).status, 426);
  assert.equal((await worker.fetch(new Request(adres, { headers: { upgrade: 'websocket', origin: 'https://obca.test' } }), e)).status, 403);
  assert.equal(doObiektu, null, 'odmowa nie dochodzi do obiektu');

  await worker.fetch(new Request(adres, { headers: { upgrade: 'websocket', origin: 'https://przyklad.test', 'x-kto': 'jozz', cookie: 'cokolwiek=1' } }), e);
  assert.equal(doObiektu.headers.get('upgrade'), 'websocket');
  assert.equal(doObiektu.headers.get('x-kto'), '', 'imię podane przez łączącego nie przechodzi');
  assert.equal(doObiektu.headers.get('cookie'), null);

  doObiektu = null;
  await worker.fetch(new Request(adres, { headers: { upgrade: 'websocket', authorization: 'Bearer ' + KLUCZ_AGENTA } }), e);
  assert.equal(doObiektu.headers.get('x-kto'), 'agent-probny', 'agent bez przeglądarki przedstawia się kluczem w nagłówku');

  // poza podglądem drzwi kanału przepuszczają połączenie bez klucza (przeglądarka nie umie go dołączyć), inne czytanie nie
  const zamkniete = await env();
  zamkniete.MIEJSCE = e.MIEJSCE;
  doObiektu = null;
  assert.equal((await worker.fetch(new Request('https://przyklad.test/api/srodowisko/puls'), zamkniete)).status, 401);
  await worker.fetch(new Request(adres, { headers: { upgrade: 'websocket' } }), zamkniete);
  assert.ok(doObiektu, 'połączenie bez klucza dochodzi do obiektu i tam niczego nie słyszy');
});

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 9, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  return { r, s };
}
const slowo = (s, op, tresc) => s.ruch('jozz', { op, co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc, dotyczy: [] } });

test('Z11. czytanie zmian po akcie: tylko to, co zmieniło się później, także rzeczy odłożone; bez zmian pusta lista', async () => {
  const { s } = await swiat();
  const a = await slowo(s, 'zywe-test-z11-a', 'pierwsze');
  const znacznik = s.ostatniNr();
  assert.deepEqual(s.spis({ po: znacznik, odlozone: 'razem' }), []);
  assert.equal(s.ile({ po: znacznik, odlozone: 'razem' }), 0);
  const b = await slowo(s, 'zywe-test-z11-b', 'drugie');
  const odl = await s.ruch('jozz', { op: 'zywe-test-z11-o', co: 'odloz', rzecz: a.rzecz, wersja: s.rzecz(a.rzecz).wersja });
  assert.equal(odl.ok, true, JSON.stringify(odl));
  const zmiany = s.spis({ po: znacznik, odlozone: 'razem' });
  assert.deepEqual(zmiany.map((x) => x.id).sort(), [a.rzecz, b.rzecz].sort());
  assert.equal(zmiany.find((x) => x.id === a.rzecz).odlozone, true, 'odłożona rzecz przychodzi ze znakiem, żeby strona mogła ją zdjąć');
  assert.deepEqual(s.spis({ po: znacznik }).map((x) => x.id), [b.rzecz], 'bez odłożonych: tylko żywe');
  assert.equal(s.ile({ po: znacznik, odlozone: 'razem' }), 2);
  assert.deepEqual(s.spis({ po: s.ostatniNr(), odlozone: 'razem' }), []);
});

test('Z12. pamięć numeru aktu i liczb: po każdym ruchu, odłożeniu, wwozie i przebudowie mówi to samo co baza', async () => {
  const { r, s } = await swiat();
  const zBazy = () => r.q(`SELECT COALESCE(MAX(nr), 0) AS nr FROM akty`)[0].nr;
  const ileZBazy = () => r.q(`SELECT COUNT(*) AS n FROM rzeczy WHERE odlozone = 0`)[0].n;
  assert.equal(s.ostatniNr(), zBazy());
  assert.equal(s.ile({}), ileZBazy());
  const przed = s.ile({ rodzaj: 'slowo/1' });
  const a = await slowo(s, 'zywe-test-z12-a', 'jedno');
  assert.equal(s.ostatniNr(), zBazy(), 'po ruchu numer aktu jest świeży');
  assert.equal(s.ile({ rodzaj: 'slowo/1' }), przed + 1, 'liczby nie zostają sprzed ruchu');
  assert.equal(s.ile({}), ileZBazy());
  await s.ruch('jozz', { op: 'zywe-test-z12-o', co: 'odloz', rzecz: a.rzecz, wersja: s.rzecz(a.rzecz).wersja });
  assert.equal(s.ile({ rodzaj: 'slowo/1' }), przed);
  assert.equal(s.ile({ rodzaj: 'slowo/1', odlozone: 'tak' }), 1, 'pytanie o odłożone idzie do bazy, nie do pamiętanych liczb');
  assert.equal(s.ile({ rodzaj: 'slowo' }), przed, 'sama nazwa rodzaju bez pokolenia też idzie do bazy');
  assert.throws(() => s.liczby().push({ rodzaj: 'x/1', ile: 1 }), 'pamiętanych liczb nie da się zmienić w miejscu');
  // liczby z pamiętanego przekroju zgadzają się z tym, co daje czytanie spisu, dla każdego prostego pytania,
  // także po przeniesieniu rzeczy do innego obszaru i po przywróceniu odłożonej (przekrój idzie za każdym zapisem)
  const obszarNowe = r.meta('obszar_nowe');
  const b = await slowo(s, 'zywe-test-z12-b', 'drugie');
  const przen = await s.ruch('jozz', { op: 'zywe-test-z12-przenies', co: 'poloz', rzecz: b.rzecz, wersja: s.rzecz(b.rzecz).wersja, rodzaj: 'slowo/1', obszar: obszarNowe, cechy: s.rzecz(b.rzecz).cechy });
  assert.equal(przen.ok, true, JSON.stringify(przen));
  const przywr = await s.ruch('jozz', { op: 'zywe-test-z12-przywroc', co: 'przywroc', rzecz: a.rzecz, wersja: s.rzecz(a.rzecz).wersja });
  assert.equal(przywr.ok, true, JSON.stringify(przywr));
  for (const f of [{}, { odlozone: 'tak' }, { odlozone: 'razem' }, { obszar: null }, { obszar: obszarNowe }, { obszar: obszarNowe, odlozone: 'razem' }, { rodzaj: 'zdolnosc/1' }, { rodzaj: 'slowo/1', odlozone: 'razem' }, { rodzaj: 'slowo/1', obszar: null, odlozone: 'tak' }, { rodzaj: 'nie-ma/1' }]) {
    assert.equal(s.ile(f), s.wszystkie(f).length, 'pytanie ' + JSON.stringify(f));
  }
  assert.deepEqual(s.liczby(), r.q(`SELECT rodzaj, COUNT(*) AS ile FROM rzeczy WHERE odlozone = 0 GROUP BY rodzaj ORDER BY rodzaj`).map((w) => ({ rodzaj: w.rodzaj, ile: w.ile })));
  // obiekt zasnął i wstał: nowa warstwa nad tą samą bazą bierze przekrój z tabeli, bez liczenia spisu od nowa
  const zBazy2 = (zapytanie) => r.q(zapytanie)[0].n;
  assert.equal(zBazy2(`SELECT SUM(ile) AS n FROM przekroj WHERE odlozone = 0`), ileZBazy(), 'tabela przekroju zgadza się ze spisem');
  let przegladow = 0;
  const surowy = r.sql.exec;
  r.sql.exec = (z, ...p) => { if (/FROM rzeczy\b[^]*GROUP BY/i.test(z)) przegladow++; return surowy(z, ...p); };
  const obudzona = new Srodowisko(r);
  assert.equal(obudzona.ile({}), ileZBazy());
  assert.equal(obudzona.ile({ odlozone: 'tak' }), s.ile({ odlozone: 'tak' }));
  assert.equal(obudzona.ile({ obszar: obszarNowe }), s.wszystkie({ obszar: obszarNowe }).length);
  assert.equal(przegladow, 0, 'po obudzeniu nikt nie liczy całego spisu');
  r.sql.exec = surowy;
  // zapis starymi drzwiami jądra też kasuje pamięć numeru aktu
  const stare = await r.wykonaj('jozz', { op: 'zywe-test-z12-stare', co: 'zapisz', rodzaj: 'notatka/1', tresc: '{"a":1}' });
  assert.equal(stare.ok, true, JSON.stringify(stare));
  assert.equal(s.ostatniNr(), zBazy());
  // wwóz całości do nowego jądra: pamięć nie zostaje z pustej bazy
  const wywoz = r.eksport();
  const r2 = new Rdzen(sqlZNode(), { wlasciciel: 'jozz' });
  assert.equal(r2.ostatniNr(), 0);
  const ww = await r2.importuj(wywoz);
  assert.equal(ww.ok, true, JSON.stringify(ww).slice(0, 300));
  assert.equal(r2.ostatniNr(), zBazy());
  const s2 = new Srodowisko(r2);
  s2.przebuduj();
  assert.equal(s2.ile({}), ileZBazy());
});
