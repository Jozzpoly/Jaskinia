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
import { b64uZ, b64uDo, CIASTKO, zrobSesje, nazwaStronyZAdresu, WYZWANIE_WAZNE_MS } from './drzwi.mjs';
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
  const cd = (typ, w, origin = ADRES, crossOrigin = false) => T.encode(JSON.stringify({ type: typ, challenge: w, origin, crossOrigin }));
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
    async wejdz(w, { licznik = 0, origin = ADRES, crossOrigin = false } = {}) {
      const clientDataJSON = cd('webauthn.get', w, origin, crossOrigin);
      const a = ad({ licznik });
      const doP = new Uint8Array(a.length + 32); doP.set(a); doP.set(await skrot256(clientDataJSON), a.length);
      const p = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, para.privateKey, doP));
      return { clientDataJSON: b64uZ(clientDataJSON), authenticatorData: b64uZ(a), podpis: b64uZ(surowyNaDer(p)) };
    },
  };
}

// --- Miejsce z pamięcią klucz-wartość ---------------------------------------------------------------------------
// `poprzednie` = to samo Miejsce po uśpieniu: nowa instancja (konstruktor od nowa, pamięć obiektu pusta) na TEJ SAMEJ
// trwałej pamięci. Tak wygląda obudzenie obiektu Cloudflare po ok. 10 s ciszy. Wartości są kopiowane przy zapisie
// i odczycie, jak w prawdziwej pamięci obiektu, żeby sprawdzian nie przeszedł dzięki wspólnej referencji.
function miejsce(dodatkowe = {}, poprzednie = null) {
  const kv = poprzednie ? poprzednie.kv : new Map();
  const ctx = poprzednie ? poprzednie.ctx : {
    storage: {
      sql: sqlZNode(),
      put: async (k, v) => { kv.set(k, structuredClone(v)); },
      get: async (k) => (kv.has(k) ? structuredClone(kv.get(k)) : undefined),
      delete: async (k) => { kv.delete(k); },
    },
  };
  return { obiekt: new Miejsce(ctx, { WLASCICIEL: 'jozz', SEKRET_SESJI: SEKRET, ...dodatkowe }), kv, ctx };
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
  // Drzwi NIE mówią pukającemu, czym można wejść: poświadczenia są odnajdywalne, a lista identyfikatorów
  // mowiła każdemu obcemu, ile urządzeń ma właściciel (atak Fable na te drzwi, 18 XI 2026).
  assert.equal(z2.poswiadczenia, undefined, 'lista poświadczeń nie wychodzi z drzwi');
  assert.equal(z2.juz_znane, undefined, 'przy wejściu nie wychodzi też pod inną nazwą');
  assert.ok(!JSON.stringify(z2).includes(t.id), 'ani nigdzie indziej w odpowiedzi');
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
  assert.equal(drugi.ok, false, 'ten sam podpis drugi raz nie wchodzi');
  // Tu odmawia już licznik (urósł do 1 przy pierwszym wejściu). Ścieżkę bez licznika, jak w passkey Apple,
  // gdzie broni WYŁĄCZNIE jednorazowość wyzwania, sprawdza DT11.
  assert.match(drugi.blad, /już go użyto|przeterminowa|licznik authenticatora nie urósł/);
  assert.deepEqual([...kv.keys()], ['drzwi:zuzyte-wyzwania'], 'w trwałej pamięci drzwi leży tylko lista użytych wyzwań');
  assert.equal(kv.get('drzwi:zuzyte-wyzwania').length, 2, 'dwa udane otwarcia (założenie i wejście) i nic więcej');

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
  // Lista poświadczeń nie wychodzi wcale, więc nie ma też czego z niej wykreślać; za to właściciel, który JUŻ
  // jest wpuszczony, dostaje przy zakładaniu listę tego, czego nie zakładać drugi raz — i odłożone w niej jest.
  const zz = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  assert.ok(Array.isArray(zz.juz_znane) && zz.juz_znane.includes(zostaje.id), 'drugie urządzenie jest wśród znanych');
  assert.ok(zz.juz_znane.includes(t.id), 'odłożone też, żeby przeglądarka nie zakładała go drugi raz');
  assert.ok(!zz.juz_znane.includes(inny.id), 'a nieznane nie');
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

  // z ciastkiem sesji: właściciel bez nagłówka Authorization, ale TYLKO ze strony tego Miejsca
  const zeton = await zrobSesje(SEKRET, 'jozz', { poswiadczenie: 'pos-telefon' });
  const zCiastkiem = await we('/api/srodowisko/ruch', { cookie: `cos=1; ${CIASTKO}=${zeton}`, origin: ADRES });
  assert.equal(zCiastkiem.status, 200, 'ruch bez klucza, a z sesją, przechodzi');
  assert.equal(doObiektu.headers.get('x-kto'), 'jozz');
  assert.equal(doObiektu.headers.get('cookie'), null, 'nagłówki do Miejsca budujemy od zera: ciastko nie leci dalej');
  assert.equal(doObiektu.headers.get('x-sesja-pos'), 'pos-telefon', 'Miejsce dostaje poświadczenie, żeby sprawdzić, czy jeszcze żyje');

  // SĄSIEDNI PODGLĄD TO DLA PRZEGLĄDARKI TEN SAM SITE (workers.dev jest na publicznej liście sufiksów), więc
  // SameSite=Strict go nie rozdziela i ciastko leci. Tożsamość z ciastka liczy się tylko z adresu tego Miejsca.
  const SASIAD = 'https://jakas-galaz-jaskinia.jozzpoly.workers.dev';
  const zSasiada = await we('/api/srodowisko/ruch', { cookie: `${CIASTKO}=${zeton}`, origin: SASIAD });
  assert.equal(zSasiada.status, 403, 'ruch z sąsiedniego adresu z ciastkiem właściciela nie przechodzi');
  const zSasiadaStare = await we('/api/miejsce/wywoz', { cookie: `${CIASTKO}=${zeton}`, origin: SASIAD }, 'GET');
  assert.equal(zSasiadaStare.status, 403, 'także starymi drzwiami /api/miejsce');

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
  const zeton = await zrobSesje(jawny, 'jozz', { poswiadczenie: 'pos-telefon' });
  const zCiastkiem = new Request(ADRES, { headers: { cookie: `${CIASTKO}=${zeton}`, origin: ADRES } });
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
  assert.equal(kv.size - przed, 0, `pukanie nie zapisuje niczego, także przed progiem (przybyło ${kv.size - przed} wpisów)`);
});

test('DT11. wyzwanie przeżywa uśpienie obiektu: wydane przed snem otwiera po przebudzeniu, ale tylko raz', async () => {
  // Jozz 18 XI 2026 na telefonie: pierwsza, wolna próba dodania urządzenia i pierwsza próba wejścia padły, druga,
  // szybka, przeszła. Przyczyna: obiekt Miejsca zasypia po ok. 10 s bez żądań (dokumentacja Cloudflare, „Durable
  // Object Lifecycle”: „when hibernated, the in-memory state is discarded”), a wyzwania leżały w pamięci obiektu.
  const pierwszy = miejsce();
  const t = await telefon();
  const z1 = await dane(await pierwszy.obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  const poSnie = miejsce({}, pierwszy);
  const zap = await dane(await poSnie.obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, nazwa: 'telefon', ...t.zaloz(z1.wyzwanie) } })));
  assert.equal(zap.ok, true, 'założenie po przebudzeniu: ' + JSON.stringify(zap));

  const z2 = await dane(await poSnie.obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  // licznik 0, jak w passkey Apple: przed powtórzeniem broni WYŁĄCZNIE jednorazowość wyzwania
  const cialo = { wyzwanie: z2.wyzwanie, poswiadczenie: t.id, ...(await t.wejdz(z2.wyzwanie, { licznik: 0 })) };
  const we = await dane(await miejsce({}, pierwszy).obiekt.fetch(zad('/api/drzwi/wejdz', { cialo })));
  assert.equal(we.ok, true, 'wejście po przebudzeniu: ' + JSON.stringify(we));

  // jednorazowość nie może zależeć od tego, czy obiekt w międzyczasie spał
  const znowu = await dane(await miejsce({}, pierwszy).obiekt.fetch(zad('/api/drzwi/wejdz', { cialo })));
  assert.equal(znowu.ok, false, 'ten sam podpis po kolejnym śnie: ' + JSON.stringify(znowu));
  assert.match(znowu.blad, /już go użyto/);
});

test('DT12. wyzwania nie trzeba pamiętać, bo jest podpisane: podrobione, przeterminowane i cudze nie otwierają', async () => {
  const { obiekt } = miejsce();
  const t = await telefon();
  const z1 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  assert.equal((await dane(await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, ...t.zaloz(z1.wyzwanie) } })))).ok, true);
  const wejdzZ = async (w) => dane(await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: { wyzwanie: w, poswiadczenie: t.id, ...(await t.wejdz(w)) } })));

  // 1. podrobione: przestawiony jeden bit terminu ważności, a urządzenie podpisuje właśnie to podrobione
  const z2 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  const b = b64uDo(z2.wyzwanie);
  b[5] ^= 0x40;
  const podrobione = await wejdzZ(b64uZ(b));
  assert.equal(podrobione.ok, false, JSON.stringify(podrobione));
  assert.match(podrobione.blad, /nie pochodzi od tych drzwi/);

  // 2. przeterminowane: ten sam zegar Miejsca, termin plus sekunda
  const z3 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  const zegar = Date.now;
  try {
    Date.now = () => zegar() + WYZWANIE_WAZNE_MS + 1000;
    const stare = await wejdzZ(z3.wyzwanie);
    assert.equal(stare.ok, false, JSON.stringify(stare));
    assert.match(stare.blad, /przeterminowało/);
  } finally { Date.now = zegar; }
  // to samo wyzwanie przed terminem dalej otwiera: nieudana próba go nie zużyła
  assert.equal((await wejdzZ(z3.wyzwanie)).ok, true, 'przeterminowanie sprawdzono na zegarze, nie na zużyciu');

  // 3. cudze: wydane przez Miejsce z innym sekretem (np. z podglądu) nie otwiera tego Miejsca
  const obce = miejsce({ SEKRET_SESJI: 'zupelnie-inny-sekret-podgladu-32zn' });
  const zObce = await dane(await obce.obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  const t2 = await telefon();
  const cudze = await dane(await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: zObce.wyzwanie, ...t2.zaloz(zObce.wyzwanie) } })));
  assert.equal(cudze.ok, false, JSON.stringify(cudze));
  assert.match(cudze.blad, /nie pochodzi od tych drzwi/);
});

test('DT13. jedno wyzwanie nie daje nieskończenie wielu prób, a próg stoi przed pierwszym pytaniem do bazy', async () => {
  // Regresja z tego samego wieczoru (18 XI 2026, Opus Code): wyzwanie zużywa się dopiero po podpisie, który przeszedł,
  // więc próg tylko przy wydawaniu wyzwań przestał ograniczać próby wejścia. Jedno wyzwanie, dużo śmieciowych podpisów.
  const { obiekt } = miejsce();
  const t = await telefon();
  const z1 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, ...t.zaloz(z1.wyzwanie) } }));
  const z2 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  const smiec = { wyzwanie: z2.wyzwanie, poswiadczenie: t.id, clientDataJSON: 'e30', authenticatorData: 'AAAA', podpis: 'AAAA' };
  const statusy = [];
  for (let i = 0; i < WYZWAN_NA_MINUTE + 5; i++) statusy.push((await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: smiec }))).status);
  assert.ok(statusy.filter((s) => s === 429).length >= 5, `po progu odmowa 429, a było: ${statusy.join(',')}`);
  assert.ok(statusy.slice(0, WYZWAN_NA_MINUTE - 3).every((s) => s !== 429), 'przed progiem drzwi odpowiadają na treść, nie progiem');
});

test('DT14. gest z ramki na cudzej stronie (crossOrigin) nie otwiera drzwi, choć podpis jest prawdziwy', async () => {
  const { obiekt } = miejsce();
  const t = await telefon();
  const z1 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { kto: 'jozz', cialo: { cel: 'zaloz' } })));
  assert.equal((await dane(await obiekt.fetch(zad('/api/drzwi/zapisz', { kto: 'jozz', cialo: { wyzwanie: z1.wyzwanie, ...t.zaloz(z1.wyzwanie) } })))).ok, true);
  const z2 = await dane(await obiekt.fetch(zad('/api/drzwi/zacznij', { cialo: { cel: 'wejdz' } })));
  const prawdziwe = await t.wejdz(z2.wyzwanie);
  // ta sama ceremonia, tylko przeglądarka mówi, że odbyła się w ramce osadzonej na cudzej stronie
  const cd = JSON.parse(new TextDecoder().decode(b64uDo(prawdziwe.clientDataJSON)));
  assert.equal(cd.crossOrigin, false, 'udawany telefon podaje crossOrigin jak przeglądarka');
  const wRamce = await t.wejdz(z2.wyzwanie, { crossOrigin: true });
  const we = await dane(await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: { wyzwanie: z2.wyzwanie, poswiadczenie: t.id, ...wRamce } })));
  assert.equal(we.ok, false, JSON.stringify(we));
  assert.match(we.blad, /ramce na cudzej stronie/);
  // to samo wyzwanie z prawdziwej strony dalej otwiera: odmowa w ramce go nie zużyła
  assert.equal((await dane(await obiekt.fetch(zad('/api/drzwi/wejdz', { cialo: { wyzwanie: z2.wyzwanie, poswiadczenie: t.id, ...prawdziwe } })))).ok, true);
});
