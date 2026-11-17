// Drzwi właściciela PRZEZ DRZWI: cała droga pod adresem, nie w samej funkcji (17 XI 2026).
// Po co osobny plik: 17 XI jedna mechaniczna zmiana nazwy w trasie wywracała `/api/srodowisko/wersja` na KAŻDYM
// żądaniu, a `node --check` i 339 sprawdzianów były zielone, bo żaden nie szedł przez te drzwi. Odtąd każdy
// mechanizm, który ma adres, ma sprawdzian idący tym adresem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miejsce } from './miejsce-do.mjs';
import worker from './index.mjs';
import { sqlZNode } from './sql-node.mjs';
import { skrot } from './miejsce.mjs';
import { b64uZ, b64uDo, CIASTKO, zrobSesje, nazwaStronyZAdresu } from './drzwi.mjs';
import { WYZWAN_NA_MINUTE } from './drzwi-http.mjs';

const SEKRET = 'sekret-sesji-do-sprawdzianu-32-znaki';
const KLUCZ_WLASCICIELA = 'klucz-wlasciciela-do-sprawdzianu';
const ADRES = 'https://jaskinia.przyklad.test';
const NAZWA = nazwaStronyZAdresu(ADRES);
const T = new TextEncoder();
const skrot256 = async (u8) => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));

// --- udawany telefon (ten sam co w drzwi.test.mjs, tu potrzebny po raz drugi) ----------------------------------
const surowyNaDer = (sur) => {
  const ci = (v) => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; const z = v.slice(i); return z[0] & 0x80 ? new Uint8Array([0, ...z]) : z; };
  const r = ci(sur.slice(0, 32)), s = ci(sur.slice(32));
  const t = new Uint8Array([0x02, r.length, ...r, 0x02, s.length, ...s]);
  return new Uint8Array([0x30, t.length, ...t]);
};
async function telefon(nazwaStrony = NAZWA) {
  const para = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const sur = new Uint8Array(await crypto.subtle.exportKey('raw', para.publicKey));
  const bs = (v) => new Uint8Array([0x58, v.length, ...v]);
  const cose = new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, ...bs(sur.slice(1, 33)), 0x22, ...bs(sur.slice(33, 65))]);
  const idP = crypto.getRandomValues(new Uint8Array(16));
  const skrotNazwy = await skrot256(T.encode(nazwaStrony));
  const cd = (typ, w, origin = ADRES) => T.encode(JSON.stringify({ type: typ, challenge: w, origin, crossOrigin: false }));
  const ad = ({ licznik = 0, zPoswiadczeniem = false } = {}) => {
    const dl = zPoswiadczeniem ? 16 + 2 + idP.length + cose.length : 0;
    const u = new Uint8Array(37 + dl);
    u.set(skrotNazwy, 0); u[32] = zPoswiadczeniem ? 0x45 : 0x05;
    new DataView(u.buffer).setUint32(33, licznik);
    if (zPoswiadczeniem) { new DataView(u.buffer).setUint16(53, idP.length); u.set(idP, 55); u.set(cose, 55 + idP.length); }
    return u;
  };
  return {
    id: b64uZ(idP),
    zaloz: (w) => ({ clientDataJSON: b64uZ(cd('webauthn.create', w)), authenticatorData: b64uZ(ad({ zPoswiadczeniem: true })) }),
    async wejdz(w, { licznik = 0, origin = ADRES } = {}) {
      const clientDataJSON = cd('webauthn.get', w, origin);
      const a = ad({ licznik });
      const doP = new Uint8Array(a.length + 32); doP.set(a); doP.set(await skrot256(clientDataJSON), a.length);
      const p = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, para.privateKey, doP));
      return { clientDataJSON: b64uZ(clientDataJSON), authenticatorData: b64uZ(a), podpis: b64uZ(surowyNaDer(p)) };
    },
  };
}

// --- Miejsce z pamięcią klucz-wartość (wyzwania) ---------------------------------------------------------------
function miejsce(dodatkowe = {}) {
  const kv = new Map();
  const ctx = {
    storage: {
      sql: sqlZNode(),
      put: async (k, v) => { kv.set(k, v); },
      get: async (k) => kv.get(k),
      delete: async (k) => { kv.delete(k); },
    },
  };
  return { obiekt: new Miejsce(ctx, { WLASCICIEL: 'jozz', SEKRET_SESJI: SEKRET, ...dodatkowe }), kv };
}
const zad = (sciezka, { kto = '', cialo, metoda = 'POST', naglowki = {} } = {}) =>
  new Request(ADRES + sciezka, { method: metoda, headers: { 'x-kto': kto, 'x-origin': ADRES, 'x-imiona': 'agent-probny', 'content-type': 'application/json', ...naglowki }, body: cialo === undefined ? undefined : JSON.stringify(cialo) });
const dane = async (o) => o.json();

test('DT1. cała droga pod adresem: właściciel zakłada poświadczenie kluczem, potem wchodzi nim bez klucza', async () => {
  const { obiekt } = miejsce();
  const t = await telefon();

  const z1 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  assert.equal(z1.ok, true, JSON.stringify(z1));
  assert.equal(z1.nazwa_strony, NAZWA, 'nazwa strony to dokładny host, nie domena nadrzędna');
  assert.deepEqual(z1.juz_znane, []);

  const zap = await dane(await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, nazwa: 'telefon', ...t.zaloz(z1.wyzwanie) } })));
  assert.equal(zap.ok, true, JSON.stringify(zap));
  assert.equal(zap.poswiadczenie, t.id);

  // poświadczenie jest rzeczą w Miejscu, w obszarze Drzwi, i widzi je tylko właściciel
  const rz = obiekt.srod.rzecz(zap.rzecz);
  assert.equal(rz.rodzaj, 'poswiadczenie/1');
  assert.equal(rz.cechy.nazwa, 'telefon');
  assert.equal(rz.obszar, obiekt.rdzen.meta('obszar_drzwi'));
  assert.equal(obiekt.srod.dla('agent-probny').rzecz(zap.rzecz), null, 'uczestnik nie widzi, czym właściciel wchodzi');
  assert.ok(!JSON.stringify(rz.cechy).includes('PRIVATE'), 'leży tu tylko klucz publiczny');
  assert.equal(b64uDo(rz.cechy.klucz_publiczny)[0], 4, 'klucz publiczny jako surowy punkt');

  // wejście: BEZ klucza w nagłówku, tylko podpisem telefonu
  const z2 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  assert.deepEqual(z2.poswiadczenia, [t.id], 'drzwi mówią, czym można wejść');
  const odp = await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: { wyzwanie: z2.wyzwanie, poswiadczenie: t.id, ...(await t.wejdz(z2.wyzwanie, { licznik: 1 })) } }));
  const we = await dane(odp);
  assert.equal(we.ok, true, JSON.stringify(we));
  assert.equal(we.imie, 'jozz');
  const ciastko = odp.headers.get('set-cookie');
  assert.match(ciastko, new RegExp(`^${CIASTKO}=`));
  for (const musi of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(ciastko.includes(musi), `brak ${musi}`);
  assert.equal(obiekt.srod.rzecz(zap.rzecz).cechy.licznik, 1, 'ślad wejścia: licznik urósł w danych');
});

test('DT2. wyzwanie zużywa się raz, a cudzy krok nim nie wejdzie', async () => {
  const { obiekt, kv } = miejsce();
  const t = await telefon();
  const z1 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, ...t.zaloz(z1.wyzwanie) } }));

  const z2 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  const cialo = { wyzwanie: z2.wyzwanie, poswiadczenie: t.id, ...(await t.wejdz(z2.wyzwanie, { licznik: 1 })) };
  assert.equal((await dane(await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo })))).ok, true);
  const drugi = await dane(await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo })));
  assert.equal(drugi.ok, false, 'ten sam podpis drugi raz nie wchodzi, choć licznik authenticatora się nie zmienił');
  assert.match(drugi.blad, /już go użyto|przeterminowa/);
  assert.equal([...kv.keys()].length, 0, 'po użyciu nie zostaje w pamięci żadne wyzwanie');

  // wyzwanie wydane do zakładania nie otwiera wejścia
  const z3 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  const nie = await dane(await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: { wyzwanie: z3.wyzwanie, poswiadczenie: t.id, ...(await t.wejdz(z3.wyzwanie, { licznik: 2 })) } })));
  assert.equal(nie.ok, false);
  assert.match(nie.blad, /wydane do kroku zaloz/);
});

test('DT3. nowego poświadczenia nie założy nikt oprócz wpuszczonego właściciela', async () => {
  const { obiekt } = miejsce();
  const t = await telefon();
  for (const kto of ['', 'agent-probny']) {
    const o = await obiekt.fetch(zad('/api/drzwi/zacznij', { kto, cialo: { cel: 'zaloz' } }));
    assert.equal(o.status, 403, `${kto || 'bez klucza'} nie dostaje nawet wyzwania do zakładania`);
    assert.equal((await dane(o)).ok, false);
  }
  // tam, gdzie nie ma czym wejść, drzwi nie wydają nawet wyzwania: to powierzchnia do zalewania, a nie usługa
  const puste = await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } }));
  assert.equal(puste.status, 404);
  // ale gdy poświadczenie jest, wyzwanie do wejścia dostaje każdy, bo drzwi mają wpuszczać
  const z0 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z0.wyzwanie, ...t.zaloz(z0.wyzwanie) } }));
  const we = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  assert.equal(we.ok, true);
  // i samo zapisanie też jest zamknięte, nawet z poprawnym wyzwaniem wziętym przez właściciela
  const zw = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  const proba = await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'agent-probny', cialo: { wyzwanie: zw.wyzwanie, ...t.zaloz(zw.wyzwanie) } }));
  assert.equal(proba.status, 403);
  assert.equal((await dane(proba)).ok, false);
});

test('DT4. bez ustawienia SEKRET_SESJI drzwi mówią wprost, czego brakuje, i nic nie udaje', async () => {
  const { obiekt } = miejsce({ SEKRET_SESJI: undefined });
  const o = await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } }));
  const d = await dane(o);
  assert.equal(o.status, 503);
  assert.match(d.blad, /SEKRET_SESJI/);
  assert.equal(d.sekret_sesji_ustawiony, false, 'kod mówi tylko, CZY sekret jest ustawiony (zasada 12)');
  const stan = await dane(await obiekt.fetch(zad('/api/drzwi/stan', { metoda: 'GET' })));
  assert.equal(stan.sekret_sesji_ustawiony, false);
  assert.equal(stan.poswiadczen, 0);
  assert.ok(!JSON.stringify(stan).includes(SEKRET), 'i nigdzie nie podaje jego wartości');
});

test('DT5. nieznane poświadczenie brzmi tak samo jak odłożone: drzwi nie mówią, czym właściciel wchodził', async () => {
  const { obiekt } = miejsce();
  const t = await telefon(), inny = await telefon(), zostaje = await telefon();
  const zaloz = async (tel) => {
    const z = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
    return dane(await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z.wyzwanie, ...tel.zaloz(z.wyzwanie) } })));
  };
  const zap = await zaloz(t);
  // drugie urządzenie zostaje w Miejscu, żeby drzwi dalej miały czym wpuszczać: inaczej obie próby odbiłyby się
  // już na wyzwaniu i nie powiedziałyby nic o tym, co nas tu interesuje
  await zaloz(zostaje);
  const rz = obiekt.srod.rzecz(zap.rzecz);
  await obiekt.srod.ruch('jozz', { op: 'drzwi-test-odloz-1', co: 'odloz', rzecz: rz.id, wersja: rz.wersja, powod: 'telefon zgubiony' });

  const sprobuj = async (id, tel) => {
    const z = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
    const o = await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: { wyzwanie: z.wyzwanie, poswiadczenie: id, ...(await tel.wejdz(z.wyzwanie, { licznik: 3 })) } }));
    return [o.status, (await dane(o)).blad];
  };
  const odlozone = await sprobuj(t.id, t);
  const nieznane = await sprobuj(inny.id, inny);
  assert.deepEqual(odlozone, nieznane, 'odłożone i nieznane brzmią co do znaku tak samo');
  assert.equal(odlozone[0], 401);
  const z = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  assert.ok(!z.poswiadczenia.includes(t.id), 'a lista, czym można wejść, nie wymienia odłożonego');
  assert.equal(z.poswiadczenia.length, 1, 'zostaje to drugie');
});

test('DT6. front Workera: do drzwi wolno przyjść bez niczego, a ciastko sesji jest tożsamością właściciela', async () => {
  let doObiektu = null;
  const env = {
    PODGLAD: 'nie', WLASCICIEL: 'jozz', SEKRET_SESJI: SEKRET,
    KLUCZE: JSON.stringify({ jozz: await skrot(KLUCZ_WLASCICIELA) }),
    MIEJSCE: { idFromName: (n) => n, get: () => ({ fetch: async (z) => { doObiektu = z; return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }); } }) },
  };
  const we = (sciezka, naglowki = {}, metoda = 'POST') => worker.fetch(new Request(ADRES + sciezka, { method: metoda, headers: naglowki, body: metoda === 'GET' ? undefined : '{}' }), env);

  // bez niczego: zwykły ruch odmawia, a drzwi przepuszczają
  assert.equal((await we('/api/srodowisko/ruch')).status, 401);
  const d = await we('/api/drzwi/zacznij');
  assert.equal(d.status, 200, 'drzwi dostają szansę się odezwać');
  assert.equal(doObiektu.headers.get('x-kto'), '', 'i Miejsce wie, że nikt się jeszcze nie przedstawił');
  assert.equal(doObiektu.headers.get('x-origin'), ADRES, 'oraz pod jakim adresem stoi, bo od tego zależy nazwa strony');

  // z ciastkiem sesji: właściciel bez nagłówka Authorization
  const zeton = await zrobSesje(SEKRET, 'jozz');
  const zCiastkiem = await we('/api/srodowisko/ruch', { cookie: `cos=1; ${CIASTKO}=${zeton}` });
  assert.equal(zCiastkiem.status, 200, 'ruch bez klucza, a z sesją, przechodzi');
  assert.equal(doObiektu.headers.get('x-kto'), 'jozz');
  assert.equal(doObiektu.headers.get('cookie'), null, 'nagłówki do Miejsca budujemy od zera: ciastko nie leci dalej');

  // podrobione i cudze ciastko nie jest tożsamością, a czytanie leci dalej jak bez klucza
  for (const z of [`${CIASTKO}=${zeton}x`, `${CIASTKO}=` + (await zrobSesje(SEKRET, 'agent-probny'))]) {
    const o = await we('/api/srodowisko/spis', { cookie: z }, 'GET');
    assert.equal(o.status, 401, 'poza podglądem czytanie bez tożsamości dalej jest zamknięte');
  }
  const zly = await we('/api/drzwi/wejdz', { cookie: `${CIASTKO}=nie.jest.zetonem` });
  assert.equal(zly.status, 200, 'stare ciastko w przeglądarce nie zamyka drogi do drzwi');
  assert.equal(doObiektu.headers.get('x-kto'), '');
});

test('DT7. wyjście zabiera ciastko', async () => {
  const { obiekt } = miejsce();
  const o = await obiekt.fetch(zad('/api/drzwi/wyjdz', { kto: 'jozz', cialo: {} }));
  assert.equal((await dane(o)).skutek, 'wyszedl');
  assert.match(o.headers.get('set-cookie'), /Max-Age=0/);
});

test('DT8. jawny sekret podglądu nie staje się sekretem prawdziwego Miejsca przez skopiowanie linii', async () => {
  // Na podglądzie sekret sesji stoi jawnie w wrangler.jsonc, jak wszystkie klucze podglądu. Gdyby ta sama
  // wartość zadziałała w prawdziwym Miejscu, kto ją przeczytał w repo, podpisałby sobie sesję właściciela.
  const jawny = 'podglad-sekret-sesji-jawny-nie-dla-wlasciciela';
  const naPodgladzie = miejsce({ SEKRET_SESJI: jawny, PODGLAD: 'tak' }).obiekt;
  assert.equal((await dane(await naPodgladzie.fetch(zad('/api/drzwi/stan', { metoda: 'GET' })))).sekret_sesji_ustawiony, true);

  const prawdziwe = miejsce({ SEKRET_SESJI: jawny, PODGLAD: 'nie' }).obiekt;
  const s = await dane(await prawdziwe.fetch(zad('/api/drzwi/stan', { metoda: 'GET' })));
  assert.equal(s.sekret_sesji_ustawiony, false, 'poza podglądem wartość z przedrostkiem podglad- nie jest sekretem');
  const o = await prawdziwe.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } }));
  assert.equal(o.status, 503);
  assert.match((await dane(o)).blad, /SEKRET_SESJI/);

  // i sesja podpisana jawnym sekretem nie jest tożsamością w prawdziwym Miejscu
  const { ktoTo } = await import('./klucze.mjs');
  const env = { KLUCZE: JSON.stringify({ jozz: await skrot(KLUCZ_WLASCICIELA) }), WLASCICIEL: 'jozz', SEKRET_SESJI: jawny };
  const zCiastkiem = new Request(ADRES, { headers: { cookie: `${CIASTKO}=${await zrobSesje(jawny, 'jozz')}` } });
  assert.equal((await ktoTo(zCiastkiem, { ...env, PODGLAD: 'tak' })).kto, 'jozz', 'na podglądzie wchodzi');
  assert.equal((await ktoTo(zCiastkiem, { ...env, PODGLAD: 'nie' })).ok, false, 'a w prawdziwym Miejscu nie');
});

test('DT9. bezpiecznik budżetu zatrzymuje ZAPIS poświadczenia, ale nigdy nie zamyka właścicielowi drzwi', async () => {
  // Świadoma asymetria: dobowy limit zapisów ma zatrzymywać zmiany, a nie zamykać go poza własnym Miejscem.
  // Wejście samo w sobie nie potrzebuje zapisu (sesja jest podpisana, nie zapamiętana); zapisem jest tylko ślad.
  const { obiekt } = miejsce();
  const t = await telefon();
  const z1 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  const zap = await dane(await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, ...t.zaloz(z1.wyzwanie) } })));

  obiekt.budzet.przekroczony = () => true;
  const drugi = await telefon();
  const z2 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  const nie = await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z2.wyzwanie, ...drugi.zaloz(z2.wyzwanie) } }));
  assert.ok(nie.status === 429 || nie.status === 503, `zapis poświadczenia podlega bezpiecznikowi (było ${nie.status})`);

  const z3 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  const we = await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: { wyzwanie: z3.wyzwanie, poswiadczenie: t.id, ...(await t.wejdz(z3.wyzwanie, { licznik: 7 })) } }));
  assert.equal(we.status, 200, 'a wejście działa dalej');
  assert.match(we.headers.get('set-cookie'), /jaskinia_wejscie=/);
  assert.equal(obiekt.srod.rzecz(zap.rzecz).cechy.licznik, 0, 'tylko ślad wejścia odpada, bo to jest zapis');
});

test('DT10. zalewanie drzwi prośbami o wyzwanie kończy się odmową BEZ zapisu', async () => {
  const { obiekt, kv } = miejsce();
  const t = await telefon();
  const z1 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, ...t.zaloz(z1.wyzwanie) } }));
  const przed = kv.size;
  let odmowy = 0, ostatni = 0;
  for (let i = 0; i < WYZWAN_NA_MINUTE + 10; i++) {
    const o = await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } }));
    ostatni = o.status;
    if (o.status === 429) odmowy++;
  }
  assert.ok(odmowy >= 10, `po progu drzwi odmawiają (odmów: ${odmowy}, ostatni status: ${ostatni})`);
  assert.ok(kv.size - przed <= WYZWAN_NA_MINUTE, `odmowa nic nie zapisuje (przybyło ${kv.size - przed} wyzwań)`);
});
