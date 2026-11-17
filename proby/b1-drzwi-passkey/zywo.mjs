// Cala ceremonia drzwi wlasciciela POD ZYWYM ADRESEM, z udawanym authenticatorem (17 XI 2026, Opus Code).
//
// POWOD. Sprawdziany w Node pilnuja tego, o czym ktos pomyslal. Tego samego dnia jedna mechaniczna zmiana
// nazwy w trasie wywracala /api/srodowisko/wersja na KAZDYM zadaniu, a node --check i 339 sprawdzianow byly
// zielone, bo zaden nie szedl przez te drzwi. Wiec kazdy mechanizm, ktory ma adres, ma pomiar pod adresem.
//
// Serwer nie wie i nie ma prawa wiedziec, czy po drugiej stronie jest przegladarka: sprawdza podpis, origin
// z clientDataJSON i skrot nazwy strony. Udawany telefon podaje wszystkie trzy, wiec to jest pelna ceremonia,
// nie atrapa.
//
// CZEGO TO NIE DOWODZI. Ze JEGO telefon zalozy passkey dla tego adresu. Tego nie da sie sprawdzic bez niego
// (README, pytanie 2) i to jedyny moment, w ktorym te drzwi potrzebuja jego reki. Ani tego, ze strona
// (public/drzwi.js) wola przegladarke poprawnie: tu nie ma przegladarki.
//
// Uruchomienie:  node proby/b1-drzwi-passkey/zywo.mjs <adres https> [klucz wlasciciela]
const B = (process.argv[2] || '').replace(/\/$/, '');
const WL = process.argv[3] || 'podglad-jozz-klucz-publiczny';
if (!B) { console.log('podaj adres: node proby/b1-drzwi-passkey/zywo.mjs <adres https>'); process.exit(2); }
const HOST = new URL(B).hostname;
const T = new TextEncoder();
const spij = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, zle = 0;
const pokaz = (nr, co, dobrze, szcz = '') => { dobrze ? ok++ : zle++; console.log(`${dobrze ? 'OK  ' : 'ZLE '} Z${nr}. ${co}` + (szcz ? `\n        ${szcz}` : '')); };

const b64uZ = (u8) => Buffer.from(u8).toString('base64url');
const skrot = async (u8) => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
const surowyNaDer = (sur) => {
  const ci = (v) => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; const z = v.slice(i); return z[0] & 0x80 ? new Uint8Array([0, ...z]) : z; };
  const r = ci(sur.slice(0, 32)), s = ci(sur.slice(32));
  const t = new Uint8Array([0x02, r.length, ...r, 0x02, s.length, ...s]);
  return new Uint8Array([0x30, t.length, ...t]);
};

async function zad(sciezka, cialo, klucz = null) {
  const h = { 'User-Agent': 'jaskinia-druga-linia/1' };
  if (cialo !== undefined) h['Content-Type'] = 'application/json';
  if (klucz) h.Authorization = 'Bearer ' + klucz;
  const o = await fetch(B + sciezka, { method: cialo === undefined ? 'GET' : 'POST', headers: h, body: cialo === undefined ? undefined : JSON.stringify(cialo) });
  const t = await o.text();
  let d = null; try { d = JSON.parse(t); } catch { d = t; }
  return { status: o.status, d, ciastko: o.headers.get('set-cookie') };
}

async function telefon(nazwaStrony = HOST) {
  const para = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const sur = new Uint8Array(await crypto.subtle.exportKey('raw', para.publicKey));
  const bs = (v) => new Uint8Array([0x58, v.length, ...v]);
  const cose = new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, ...bs(sur.slice(1, 33)), 0x22, ...bs(sur.slice(33, 65))]);
  const idP = crypto.getRandomValues(new Uint8Array(16));
  const skrotNazwy = await skrot(T.encode(nazwaStrony));
  const cd = (typ, w, origin = B) => T.encode(JSON.stringify({ type: typ, challenge: w, origin, crossOrigin: false }));
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
    async wejdz(w, { licznik = 1, origin = B } = {}) {
      const clientDataJSON = cd('webauthn.get', w, origin);
      const a = ad({ licznik });
      const doP = new Uint8Array(a.length + 32); doP.set(a); doP.set(await skrot(clientDataJSON), a.length);
      const p = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, para.privateKey, doP));
      return { clientDataJSON: b64uZ(clientDataJSON), authenticatorData: b64uZ(a), podpis: b64uZ(surowyNaDer(p)) };
    },
  };
}

// obiekt Miejsca moze spac, a podglad moze sie jeszcze budowac
for (let i = 0; i < 40; i++) { const { status } = await zad('/api/srodowisko/puls', undefined, WL); if (status === 200) break; await spij(15000); }

const stan = await zad('/api/drzwi/stan');
pokaz(1, 'drzwi mowia, czy sa gotowe, i nie podaja wartosci sekretu', stan.status === 200 && stan.d.sekret_sesji_ustawiony === true && stan.d.nazwa_strony === HOST,
  `nazwa_strony=${stan.d && stan.d.nazwa_strony} sekret_ustawiony=${stan.d && stan.d.sekret_sesji_ustawiony} poswiadczen=${stan.d && stan.d.poswiadczen}`);

const bezKlucza = await zad('/api/drzwi/zacznij', { cel: 'zaloz' });
pokaz(2, 'bez klucza nie da sie nawet zaczac zakladania poswiadczenia', bezKlucza.status === 403, `status=${bezKlucza.status} ${JSON.stringify(bezKlucza.d).slice(0, 140)}`);

const t = await telefon();
const z1 = await zad('/api/drzwi/zacznij', { cel: 'zaloz' }, WL);
pokaz(3, 'wlasciciel dostaje wyzwanie i dokladna nazwe strony', z1.status === 200 && z1.d.nazwa_strony === HOST && typeof z1.d.wyzwanie === 'string',
  `nazwa_strony=${z1.d && z1.d.nazwa_strony} (host adresu: ${HOST})`);

const zap = await zad('/api/drzwi/zapisz', { wyzwanie: z1.d.wyzwanie, nazwa: 'udawany telefon drugiej linii', ...t.zaloz(z1.d.wyzwanie) }, WL);
pokaz(4, 'poswiadczenie zapisane jako rzecz w Miejscu', zap.status === 200 && zap.d.ok === true && zap.d.poswiadczenie === t.id, `${JSON.stringify(zap.d).slice(0, 200)}`);

const rz = zap.d.rzecz ? await zad('/api/srodowisko/rzecz?id=' + zap.d.rzecz, undefined, WL) : { d: {} };
const cechy = (rz.d && rz.d.rzecz && rz.d.rzecz.cechy) || {};
pokaz(5, 'w danych lezy sam klucz publiczny, w obszarze Drzwi', Boolean(cechy.klucz_publiczny) && Buffer.from(cechy.klucz_publiczny, 'base64url')[0] === 4,
  `nazwa=${cechy.nazwa} licznik=${cechy.licznik} dlugosc klucza=${cechy.klucz_publiczny ? Buffer.from(cechy.klucz_publiczny, 'base64url').length : 0} B`);
const bezWlasciciela = zap.d.rzecz ? await zad('/api/srodowisko/rzecz?id=' + zap.d.rzecz, undefined, 'podglad-agent-klucz-publiczny') : { d: {} };
pokaz(6, 'uczestnik nie widzi, czym wlasciciel wchodzi', bezWlasciciela.d && bezWlasciciela.d.ok !== true, `odpowiedz: ${JSON.stringify(bezWlasciciela.d).slice(0, 120)}`);

const z2 = await zad('/api/drzwi/zacznij', { cel: 'wejdz' });
const cialo = { wyzwanie: z2.d.wyzwanie, poswiadczenie: t.id, ...(await t.wejdz(z2.d.wyzwanie, { licznik: 1 })) };
const we = await zad('/api/drzwi/wejdz', cialo);
pokaz(7, 'wejscie BEZ klucza, samym podpisem, oddaje ciastko sesji', we.status === 200 && we.d.ok === true && /jaskinia_wejscie=/.test(we.ciastko || '') && /HttpOnly/.test(we.ciastko || '') && /SameSite=Strict/.test(we.ciastko || ''),
  `imie=${we.d && we.d.imie}; ciastko: ${(we.ciastko || 'brak').slice(0, 90)}`);

const znow = await zad('/api/drzwi/wejdz', cialo);
pokaz(8, 'ten sam podpis drugi raz nie wchodzi (wyzwanie jednorazowe)', znow.status !== 200, `status=${znow.status} ${String(znow.d && znow.d.blad).slice(0, 110)}`);

const z3 = await zad('/api/drzwi/zacznij', { cel: 'wejdz' });
const obcy = await zad('/api/drzwi/wejdz', { wyzwanie: z3.d.wyzwanie, poswiadczenie: t.id, ...(await t.wejdz(z3.d.wyzwanie, { licznik: 2, origin: 'https://obca.strona.test' })) });
pokaz(9, 'podpis zrobiony na obcej stronie nie wchodzi, choc poswiadczenie to samo', obcy.status !== 200, `status=${obcy.status} ${String(obcy.d && obcy.d.blad).slice(0, 110)}`);

const nadrzedny = await telefon(HOST.split('.').slice(-3).join('.'));
const z4 = await zad('/api/drzwi/zacznij', { cel: 'zaloz' }, WL);
const nad = await zad('/api/drzwi/zapisz', { wyzwanie: z4.d.wyzwanie, ...nadrzedny.zaloz(z4.d.wyzwanie) }, WL);
pokaz(10, 'poswiadczenie zalozone dla DOMENY NADRZEDNEJ nie wchodzi tutaj', nad.status !== 200, `dla ${HOST.split('.').slice(-3).join('.')}: status=${nad.status} ${String(nad.d && nad.d.blad).slice(0, 110)}`);

// sprzatanie: odkladamy udawane poswiadczenie, zeby nie zostalo w Miejscu jako droga wejscia
if (zap.d.rzecz) {
  const r = await zad('/api/srodowisko/rzecz?id=' + zap.d.rzecz, undefined, WL);
  if (r.d && r.d.ok) {
    const u = await zad('/api/srodowisko/ruch', { op: 'drzwi-zywo-sprzatam-' + zap.d.rzecz.slice(0, 8), co: 'odloz', rzecz: zap.d.rzecz, wersja: r.d.rzecz.wersja, powod: 'udawany authenticator drugiej linii: pomiar skonczony' }, WL);
    const po = await zad('/api/drzwi/zacznij', { cel: 'wejdz' });
    // Gdy to bylo ostatnie poswiadczenie, drzwi w ogole nie wydaja wyzwania do wejscia (404) - tam, gdzie nie ma
    // czym wejsc, nie ma po co zostawiac sladu w pamieci. Jedno i drugie znaczy to samo: ta droga zamknieta.
    const zamkniete = po.status === 404 || (Array.isArray(po.d.poswiadczenia) && !po.d.poswiadczenia.includes(t.id));
    pokaz(11, 'po odlozeniu poswiadczenie przestaje byc droga wejscia', u.d && u.d.skutek === 'odlozone' && zamkniete,
      `odlozenie=${u.d && (u.d.skutek || u.d.blad)}; zacznij(wejdz): status=${po.status} ${JSON.stringify(po.d && po.d.poswiadczenia)}`);
    const zalew = [];
    for (let i = 0; i < 6; i++) zalew.push((await zad('/api/drzwi/zacznij', { cel: 'wejdz' })).status);
    pokaz(12, 'proszenie o wyzwanie tam, gdzie nie ma czym wejsc, nic nie kosztuje Miejsca', zalew.every((x) => x === 404), `statusy: ${zalew.join(',')}`);
  }
}
console.log(`\npodsumowanie: ${ok} z ${ok + zle} trzyma`);
process.exit(zle ? 1 : 0);
