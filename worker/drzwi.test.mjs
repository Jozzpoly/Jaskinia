// Sprawdziany drzwi właściciela (passkey), 17 XI 2026. Udawany authenticator: para kluczy P-256 w Node, bajty
// składane dokładnie tak, jak składa je prawdziwy telefon. Node ma to samo WebCrypto co Workers, więc to, co
// tu przechodzi, przechodzi tam - ale czy JEGO telefon założy passkey dla tego adresu, sprawdzi tylko on.
//
// Każdy sprawdzian pyta z DWÓCH stron: że dobre przechodzi i że podmienione nie. Mechanizm, który wszystko
// przepuszcza, zalicza połowę takich sprawdzianów (lekcja z ataku na widoczność, 17 XI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sprawdzZalozenie, sprawdzWejscie, zrobSesje, czytajSesje, ciastkoZNaglowka, ciastkoNaglowek, ciastkoKoniec,
  b64uZ, b64uDo, czytajAuthData, nazwaStronyZAdresu, CIASTKO, SESJA_WAZNA_MS } from './drzwi.mjs';

const T = new TextEncoder();
const SEKRET = 'sekret-sesji-do-sprawdzianu-32-znaki';
const ADRES = 'https://jaskinia.przyklad.test';
const NAZWA = nazwaStronyZAdresu(ADRES);
const skrot = async (u8) => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));

// --- udawany authenticator ------------------------------------------------------------------------------------
const surowyNaDer = (sur) => {
  const ci = (v) => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; const z = v.slice(i); return z[0] & 0x80 ? new Uint8Array([0, ...z]) : z; };
  const r = ci(sur.slice(0, 32)), s = ci(sur.slice(32));
  const t = new Uint8Array([0x02, r.length, ...r, 0x02, s.length, ...s]);
  return new Uint8Array([0x30, t.length, ...t]);
};

async function telefon({ nazwaStrony = NAZWA } = {}) {
  const para = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const sur = new Uint8Array(await crypto.subtle.exportKey('raw', para.publicKey));
  const bs = (v) => new Uint8Array([0x58, v.length, ...v]);
  const cose = new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, ...bs(sur.slice(1, 33)), 0x22, ...bs(sur.slice(33, 65))]);
  const idPoswiadczenia = crypto.getRandomValues(new Uint8Array(16));
  const skrotNazwy = await skrot(T.encode(nazwaStrony));

  const clientData = (typ, wyzwanie, origin = ADRES) => T.encode(JSON.stringify({ type: typ, challenge: wyzwanie, origin, crossOrigin: false }));

  const authData = ({ licznik = 0, flagi = 0x05, zPoswiadczeniem = false } = {}) => {
    const dlugosc = zPoswiadczeniem ? 16 + 2 + 16 + cose.length : 0;
    const u = new Uint8Array(37 + dlugosc);
    u.set(skrotNazwy, 0);
    u[32] = zPoswiadczeniem ? flagi | 0x40 : flagi;
    new DataView(u.buffer).setUint32(33, licznik);
    if (zPoswiadczeniem) {
      new DataView(u.buffer).setUint16(53, idPoswiadczenia.length);
      u.set(idPoswiadczenia, 55);
      u.set(cose, 55 + idPoswiadczenia.length);
    }
    return u;
  };

  return {
    idPoswiadczenia,
    zaloz: (wyzwanie, o = {}) => ({ clientDataJSON: clientData('webauthn.create', wyzwanie, o.origin), authenticatorData: authData({ ...o, zPoswiadczeniem: true }) }),
    async wejdz(wyzwanie, o = {}) {
      const clientDataJSON = clientData('webauthn.get', wyzwanie, o.origin);
      const ad = authData(o);
      const doPodpisu = new Uint8Array(ad.length + 32);
      doPodpisu.set(ad);
      doPodpisu.set(await skrot(clientDataJSON), ad.length);
      const sp = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, para.privateKey, doPodpisu));
      return { clientDataJSON, authenticatorData: ad, podpis: surowyNaDer(sp) };
    },
  };
}

// --- sprawdziany ----------------------------------------------------------------------------------------------
test('D1. cała droga: telefon zakłada poświadczenie, potem nim wchodzi', async () => {
  const t = await telefon();
  const z = await sprawdzZalozenie({ ...t.zaloz('wyzwanie-1'), wyzwanie: 'wyzwanie-1', origin: ADRES, nazwaStrony: NAZWA });
  assert.equal(z.ok, true, z.blad);
  assert.equal(z.poswiadczenie, b64uZ(t.idPoswiadczenia), 'identyfikator poświadczenia wyjęty z authenticatorData');
  assert.equal(b64uDo(z.kluczPubliczny).length, 65, 'klucz publiczny jako surowy punkt 0x04||x||y');
  assert.equal(b64uDo(z.kluczPubliczny)[0], 4);

  const w = await sprawdzWejscie({ ...(await t.wejdz('wyzwanie-2', { licznik: 1 })), kluczPubliczny: z.kluczPubliczny, licznikZnany: 0, wyzwanie: 'wyzwanie-2', origin: ADRES, nazwaStrony: NAZWA });
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.licznik, 1);
  assert.equal(w.sprawdzony, true, 'flaga UV: telefon mówi, że sprawdził, kto go dotknął');
});

test('D2. cudze wyzwanie, cudzy adres i cudza nazwa strony nie przechodzą', async () => {
  const t = await telefon();
  const z = await sprawdzZalozenie({ ...t.zaloz('w-1'), wyzwanie: 'w-1', origin: ADRES, nazwaStrony: NAZWA });
  const wejdz = async (o, nad = {}) => sprawdzWejscie({ ...(await t.wejdz(o.w, o)), kluczPubliczny: z.kluczPubliczny, wyzwanie: o.oczekiwane ?? o.w, origin: ADRES, nazwaStrony: NAZWA, ...nad });

  assert.equal((await wejdz({ w: 'moje', oczekiwane: 'inne' })).ok, false, 'podpisane inne wyzwanie niż wydane');
  assert.match((await wejdz({ w: 'moje', oczekiwane: 'inne' })).blad, /wyzwanie w clientDataJSON/);
  const obcy = await wejdz({ w: 'ok', origin: 'https://obca.strona.test' });
  assert.equal(obcy.ok, false);
  assert.match(obcy.blad, /origin/, 'podpis zrobiony na obcej stronie nie wchodzi, choć klucz jest ten sam');
  // telefon, który założył passkey dla DOMENY NADRZĘDNEJ, nie wchodzi tutaj (granica z falsyfikatora)
  const nadrzedny = await telefon({ nazwaStrony: 'przyklad.test' });
  const zn = await sprawdzZalozenie({ ...nadrzedny.zaloz('w-2'), wyzwanie: 'w-2', origin: ADRES, nazwaStrony: NAZWA });
  assert.equal(zn.ok, false);
  assert.match(zn.blad, /innej nazwy strony/);
});

test('D3. podpis cudzym kluczem, podpis popsuty i podpis nie w DER nie przechodzą', async () => {
  const t = await telefon(), inny = await telefon();
  const z = await sprawdzZalozenie({ ...t.zaloz('w'), wyzwanie: 'w', origin: ADRES, nazwaStrony: NAZWA });
  const zi = await sprawdzZalozenie({ ...inny.zaloz('w'), wyzwanie: 'w', origin: ADRES, nazwaStrony: NAZWA });
  const dane = await t.wejdz('w2');

  assert.equal((await sprawdzWejscie({ ...dane, kluczPubliczny: zi.kluczPubliczny, wyzwanie: 'w2', origin: ADRES, nazwaStrony: NAZWA })).ok, false, 'drugi telefon nie wchodzi za pierwszy');
  const popsuty = { ...dane, authenticatorData: dane.authenticatorData.slice() };
  popsuty.authenticatorData[36] = 9;
  assert.equal((await sprawdzWejscie({ ...popsuty, kluczPubliczny: z.kluczPubliczny, wyzwanie: 'w2', origin: ADRES, nazwaStrony: NAZWA })).ok, false, 'podmieniony licznik psuje podpis');
  // pułapka z falsyfikatora: podpis surowy r||s podany tam, gdzie ma być DER
  const surowo = { ...dane, podpis: new Uint8Array(64) };
  const r = await sprawdzWejscie({ ...surowo, kluczPubliczny: z.kluczPubliczny, wyzwanie: 'w2', origin: ADRES, nazwaStrony: NAZWA });
  assert.equal(r.ok, false);
  assert.match(r.blad, /SEQUENCE/, 'i mówi, co jest nie tak, zamiast "podpis się nie zgadza"');
});

test('D4. licznik pilnuje tylko wtedy, gdy authenticator go prowadzi', async () => {
  // Passkey Apple zawsze podaje 0. Gdyby licznik był warunkiem zawsze, odrzucalibyśmy prawdziwe wejścia;
  // gdyby nie pilnował nigdy, powtórzenie starego podpisu przeszłoby. Przed powtórzeniem broni wyzwanie.
  const t = await telefon();
  const z = await sprawdzZalozenie({ ...t.zaloz('w'), wyzwanie: 'w', origin: ADRES, nazwaStrony: NAZWA });
  const wejdz = async (licznik, licznikZnany) => sprawdzWejscie({ ...(await t.wejdz('x' + licznik, { licznik })), kluczPubliczny: z.kluczPubliczny, licznikZnany, wyzwanie: 'x' + licznik, origin: ADRES, nazwaStrony: NAZWA });
  assert.equal((await wejdz(0, 0)).ok, true, 'authenticator bez licznika (zawsze 0) wchodzi');
  assert.equal((await wejdz(5, 0)).ok, true);
  assert.equal((await wejdz(5, 5)).ok, false, 'ten sam licznik u authenticatora, który licznik prowadzi, to powtórzenie');
  assert.equal((await wejdz(6, 5)).ok, true);
});

test('D5. authenticator, który nie mówi, że ktoś przy nim był, nie wchodzi', async () => {
  const t = await telefon();
  const z = await sprawdzZalozenie({ ...t.zaloz('w', { flagi: 0x00 }), wyzwanie: 'w', origin: ADRES, nazwaStrony: NAZWA });
  assert.equal(z.ok, false);
  assert.match(z.blad, /ktoś przy nim był/);
  const ok = await sprawdzZalozenie({ ...t.zaloz('w2'), wyzwanie: 'w2', origin: ADRES, nazwaStrony: NAZWA });
  const bez = await sprawdzWejscie({ ...(await t.wejdz('w3', { flagi: 0x00 })), kluczPubliczny: ok.kluczPubliczny, wyzwanie: 'w3', origin: ADRES, nazwaStrony: NAZWA });
  assert.equal(bez.ok, false);
  assert.match(bez.blad, /ktoś przy nim był/);
});

test('D6. sesja: własna przechodzi, podmieniona i przeterminowana nie', async () => {
  const teraz = Date.UTC(2026, 10, 17, 18, 0, 0);
  const zeton = await zrobSesje(SEKRET, 'jozz', { teraz, poswiadczenie: 'pos-telefon' });
  const s = await czytajSesje(SEKRET, zeton, { teraz });
  assert.deepEqual(s, { imie: 'jozz', do: teraz + SESJA_WAZNA_MS, poswiadczenie: 'pos-telefon' });

  assert.equal(await czytajSesje('inny-sekret-tez-dlugi-32-znaki', zeton, { teraz }), null, 'cudzy sekret nie podrobi sesji');
  assert.equal(await czytajSesje(SEKRET, zeton, { teraz: teraz + SESJA_WAZNA_MS + 1 }), null, 'przeterminowana nie wchodzi');
  const cz = zeton.split('.');
  assert.equal(cz.length, 4, 'żeton niesie imię, poświadczenie, ważność i podpis');
  assert.equal(await czytajSesje(SEKRET, `${b64uZ(T.encode('ktos-inny'))}.${cz[1]}.${cz[2]}.${cz[3]}`, { teraz }), null, 'podmiana imienia psuje podpis');
  assert.equal(await czytajSesje(SEKRET, `${cz[0]}.${b64uZ(T.encode('inne-poswiadczenie'))}.${cz[2]}.${cz[3]}`, { teraz }), null, 'podmiana poświadczenia psuje podpis');
  assert.equal(await czytajSesje(SEKRET, `${cz[0]}.${cz[1]}.${teraz + 10 * SESJA_WAZNA_MS}.${cz[3]}`, { teraz }), null, 'przedłużenie ważności psuje podpis');
  // Żeton w starym kształcie (bez poświadczenia) nie da się unieważnić z urządzeniem, więc nie wchodzi wcale.
  const stary = `${cz[0]}.${cz[2]}.${cz[3]}`;
  assert.equal(await czytajSesje(SEKRET, stary, { teraz }), null, 'stary trzyczłonowy żeton nie wchodzi');
  assert.equal(await czytajSesje(SEKRET, 'nie.jest.zetonem', { teraz }), null);
  assert.equal(await czytajSesje(SEKRET, '', { teraz }), null);
  // za krótki sekret to błąd ustawienia, nie cicha zgoda
  await assert.rejects(() => zrobSesje('krotki', 'jozz', { teraz }), /co najmniej 16 znaków/);
});

test('D7. ciastko: czytamy swoje z nagłówka, a nasz nagłówek zamyka drogę obcym stronom', () => {
  assert.equal(ciastkoZNaglowka(`inne=1; ${CIASTKO}=abc.def.ghi; jeszcze=2`), 'abc.def.ghi');
  assert.equal(ciastkoZNaglowka('inne=1'), null);
  assert.equal(ciastkoZNaglowka(null), null);
  assert.equal(ciastkoZNaglowka(`${CIASTKO}x=nie-to`), null, 'podobna nazwa to nie ta nazwa');
  const n = ciastkoNaglowek('z.e.ton');
  for (const musi of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(n.includes(musi), `brak ${musi} w: ${n}`);
  assert.ok(ciastkoKoniec().includes('Max-Age=0'));
});

test('D8. authenticatorData: za krótkie i kłamiące o długości poświadczenia odbijają się ze zdaniem', () => {
  assert.throws(() => czytajAuthData(new Uint8Array(36)), /krótsze niż 37/);
  const u = new Uint8Array(56); u[32] = 0x45; new DataView(u.buffer).setUint16(53, 500);
  assert.throws(() => czytajAuthData(u), /długość poświadczenia/);
  const bez = new Uint8Array(37); bez[32] = 0x05;
  assert.equal(czytajAuthData(bez).zPoswiadczeniem, false, 'wejście nie niesie poświadczenia i to jest normalne');
});

test('D9. nazwa strony to DOKŁADNY host, nigdy domena nadrzędna', () => {
  assert.equal(nazwaStronyZAdresu('https://opus-code-drzwi-jaskinia.jozzpoly.workers.dev'), 'opus-code-drzwi-jaskinia.jozzpoly.workers.dev');
  assert.notEqual(nazwaStronyZAdresu('https://jaskinia.jozzpoly.workers.dev'), 'jozzpoly.workers.dev');
  assert.equal(nazwaStronyZAdresu('https://przyklad.test:8787/cokolwiek'), 'przyklad.test');
});
