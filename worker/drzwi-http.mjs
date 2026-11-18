// Drzwi właściciela po stronie Miejsca: cztery kroki pod adresem (17 XI 2026, front B, Opus Code).
// Status: próba (TYMCZASOWE.md).
//
// Co tu jest, czego nie ma w drzwi.mjs: pamięć. Sprawdzenie podpisu jest czystą funkcją, ale wyzwanie musi być
// JEDNORAZOWE, a poświadczenie musi gdzieś leżeć. Samo wyzwanie nie leży nigdzie: niesie swój termin i podpis
// Miejsca (drzwi.mjs: zrobWyzwanie). Leży tylko krótka lista wyzwań JUŻ UŻYTYCH (storage klucz-wartość, nie spis
// rzeczy: to nie fakt o świecie, tylko pamięć drzwi na pięć minut). Poświadczenia leżą w spisie jako rzeczy
// rodzaju poswiadczenie/1 w obszarze Drzwi (widzi: wlasciciel) - bo to fakt o świecie i właściciel ma je widzieć,
// móc nazwać i móc odłożyć. Klucz PRYWATNY nie opuszcza jego urządzenia; my mamy publiczny, który nie jest sekretem.
//
// Czemu wyzwanie jest jednorazowe, a nie tylko krótkie: licznik podpisów authenticatora bywa zawsze zerowy
// (passkey Apple), więc licznik nie obroni przed powtórzeniem starego podpisu. Obroni wyzwanie, którego już nie ma.
import { json } from './trasy.mjs';
import { sprawdzZalozenie, sprawdzWejscie, zrobSesje, ciastkoNaglowek, ciastkoKoniec, b64uDo,
  sekretSesji, zrobWyzwanie, czytajWyzwanie, WYZWANIE_WAZNE_MS, SESJA_WAZNA_MS } from './drzwi.mjs';

export const ADRES_DRZWI = '/api/drzwi/';
// Ile PRÓB na minutę (zacznij, zapisz i wejdz razem) przyjmuje jeden obiekt Miejsca. Licznik stoi w PAMIĘCI
// instancji, nie w zapisie: kosztuje zero, a działa dokładnie wtedy, gdy ma działać - gdy ktoś wali w drzwi, obiekt
// jest obudzony. Po uśpieniu okno startuje od nowa i to jest w porządku: spanie znaczy, że nikt nie wali.
// Do 18 XI wieczorem próg stał tylko przy wydawaniu wyzwań, i wystarczał, bo wyzwanie przepadało przy pierwszym
// użyciu, także nieudanym. Odkąd wyzwanie niesie swój podpis i zużywa się dopiero po podpisie, który przeszedł,
// jedno wyzwanie pozwalałoby na dowolnie wiele nieudanych prób przez pięć minut, a każda czyta wiersze ze
// wspólnej puli konta (zasada 13). Dlatego próg liczy teraz każdy krok, i to PRZED pierwszym pytaniem do bazy.
// Cena: kto wali w drzwi, zamyka je na minutę także właścicielowi; lepsze to niż zjedzona pula całego konta.
export const WYZWAN_NA_MINUTE = 30;

// UŻYTE WYZWANIA: jedyny ślad drzwi w trwałej pamięci obiektu, i powstaje dopiero PO podpisie, który przeszedł.
// Wyzwania nie trzeba pamiętać od wydania do użycia, bo niesie swój termin i podpis Miejsca. Pamiętać trzeba tylko,
// że JUŻ go użyto: inaczej ten sam podpis dałoby się powtórzyć do końca terminu, a licznik podpisów bywa zawsze
// zerowy (passkey Apple), więc sam nie obroni. Obcy pukający nie zostawia tu nic; lista trzyma tylko wyzwania
// jeszcze ważne, najwyżej ZUZYTYCH_NAJWYZEJ (dopisać do niej może tylko urządzenie, które naprawdę otwiera drzwi).
// Historia dwóch pomyłek, obie moje (Opus Code): do 18 XI rano wyzwania szły do `ctx.storage.put` z opcją
// `expirationTtl`, której pamięć Durable Object NIE ZNA (to opcja Workers KV), więc każde pukanie obcego zostawało
// w Miejscu na zawsze (atak Fable). Potem przez pół dnia leżały w pamięci instancji, z komentarzem, że żyją dwie
// minuty - a obiekt zasypia po ok. 10 s ciszy i wyzwanie przepadało w połowie gestu (pierwsza próba Jozza na
// telefonie, DT11).
const KLUCZ_ZUZYTYCH = 'drzwi:zuzyte-wyzwania';
export const ZUZYTYCH_NAJWYZEJ = 64;
const JUZ_UZYTE = 'już go użyto: jedno wyzwanie otwiera drzwi tylko raz; zacznij od nowa';
async function zuzyj(m, los, az) {
  const teraz = Date.now();
  const st = m.ctx && m.ctx.storage;
  if (!m._zuzyte) m._zuzyte = new Map();
  for (const [k, d] of m._zuzyte) if (!(d > teraz)) m._zuzyte.delete(k);
  let lista = [];
  try {
    const z = st && typeof st.get === 'function' ? await st.get(KLUCZ_ZUZYTYCH) : null;
    if (Array.isArray(z)) lista = z.filter((e) => Array.isArray(e) && e[1] > teraz);
  } catch { lista = []; }
  if (m._zuzyte.has(los) || lista.some((e) => e[0] === los)) return false;
  m._zuzyte.set(los, az);
  lista.push([los, az]);
  // Nieudany zapis nie zamyka tu drzwi: jednorazowości pilnuje wtedy pamięć instancji, dopóki obiekt nie zaśnie.
  // Czy platforma przepuści odpowiedź po nieudanym zapisie (np. przy wyczerpanym dobowym limicie konta), NIE
  // sprawdziliśmy - przy takim limicie i tak stoi każda trasa z bazą (AGENTS.md, zasada 13).
  try { if (st && typeof st.put === 'function') await st.put(KLUCZ_ZUZYTYCH, lista.slice(-ZUZYTYCH_NAJWYZEJ)); } catch { /* jw. */ }
  return true;
}
const CELE = ['zaloz', 'wejdz'];

const bajty = (s, ile) => {
  const u = b64uDo(s);
  if (ile && u.length > ile) throw new Error('za dużo bajtów');
  return u;
};

async function cialoJson(request) {
  const t = await request.text();
  if (!t) return {};
  try { const c = JSON.parse(t); return c && typeof c === 'object' ? c : null; } catch { return null; }
}

// Adres, pod którym te drzwi stoją. Miejsce pamięta sam host (`m.host`), a przeglądarka w clientDataJSON podaje
// pełny origin, więc oba trzeba mieć osobno - i oba muszą pochodzić od Workera, nie od tego, kto pyta.
const adres = (m, request) => {
  for (const kandydat of [request.headers.get('x-origin'), m.host ? 'https://' + m.host : null, request.url]) {
    if (!kandydat) continue;
    try { const u = new URL(kandydat); return { origin: u.origin, nazwaStrony: u.hostname }; } catch { /* następny */ }
  }
  return { origin: null, nazwaStrony: null };
};

// Czy drzwi są w ogóle gotowe. O sekrecie kod może powiedzieć TYLKO, czy jest ustawiony (zasada 12).
const stan = (m, request) => ({
  sekret_sesji_ustawiony: sekretSesji(m.env) !== null,
  poswiadczen: m.srod.ile({ rodzaj: 'poswiadczenie/1' }),
  nazwa_strony: adres(m, request).nazwaStrony,
  sesja_wazna_dni: Math.round(SESJA_WAZNA_MS / 86400000),
});

export async function obsluzDrzwi(m, request) {
  const krok = new URL(request.url).pathname.slice(ADRES_DRZWI.length);
  const kto = request.headers.get('x-kto') || null;
  const { origin, nazwaStrony } = adres(m, request);
  const wlasciciel = m.rdzen.wlasciciel;

  if (krok === 'stan') return json({ ok: true, ...stan(m, request) });
  if (request.method !== 'POST') return json({ ok: false, blad: 'te drzwi otwiera się żądaniem POST' }, 405);
  if (!origin) return json({ ok: false, blad: 'Miejsce nie zna jeszcze własnego adresu; wejdź przez stronę, nie wprost do obiektu' }, 400);
  const sekret = sekretSesji(m.env);
  if (!sekret) {
    return json({ ok: false, blad: 'drzwi właściciela nie są gotowe: nie ma ustawienia SEKRET_SESJI (co najmniej 16 znaków) w Cloudflare', ...stan(m, request) }, 503);
  }
  const c = await cialoJson(request);
  if (c === null) return json({ ok: false, blad: 'ciało żądania ma być obiektem JSON' }, 400);
  if (krok === 'zacznij' || krok === 'zapisz' || krok === 'wejdz') {
    const teraz = Date.now();
    if (!m._drzwiOkno || teraz - m._drzwiOkno.od > 60000) m._drzwiOkno = { od: teraz, ile: 0 };
    if (++m._drzwiOkno.ile > WYZWAN_NA_MINUTE) return json({ ok: false, blad: 'za dużo prób otwarcia drzwi w ciągu minuty; spróbuj za chwilę' }, 429);
  }

  // --- 1. wyzwanie ---------------------------------------------------------------------------------------------
  if (krok === 'zacznij') {
    const cel = CELE.includes(c.cel) ? c.cel : null;
    if (!cel) return json({ ok: false, blad: `cel: "zaloz" (nowe poświadczenie) albo "wejdz"` }, 400);
    if (cel === 'zaloz' && kto !== wlasciciel) return json({ ok: false, blad: 'nowe poświadczenie zakłada tylko właściciel, i tylko wtedy, gdy JUŻ jest wpuszczony (kluczem albo poprzednimi drzwiami)' }, 403);
    // Prosić o wyzwanie do wejścia może każdy. Wydanie nie zostawia żadnego zapisu, ale liczy poświadczenia
    // (wiersze czytane, wspólne dla konta - zasada 13), więc stoją dwa tanie progi: tam, gdzie nie ma czym wejść,
    // nie wydajemy nic, a wszystkie kroki razem mieszczą się w WYZWAN_NA_MINUTE (wyżej). Oba odmawiają BEZ zapisu.
    const ilePoswiadczen = m.srod.ile({ rodzaj: 'poswiadczenie/1' });
    if (cel === 'wejdz' && ilePoswiadczen === 0) return json({ ok: false, blad: 'to Miejsce nie ma jeszcze żadnego poświadczenia: najpierw dodaj urządzenie, będąc wpuszczonym kluczem' }, 404);
    const w = await zrobWyzwanie(sekret, cel);
    // Przy ZAKŁADANIU przeglądarka ma wiedzieć, czego nie zakładać drugi raz — a o to prosi tylko właściciel,
    // który JUŻ jest wpuszczony (sprawdzone wyżej). Przy WEJŚCIU nie wydajemy niczego: poświadczenia są
    // odnajdywalne (discoverable), więc przeglądarka sama wie, czym wejść, a lista identyfikatorów w odpowiedzi
    // mówiła obcemu bez klucza, ile urządzeń ma właściciel i jak się nazywają w bajtach. Pierwsze pytanie
    // u drzwi nie ma nic opowiadać o tym, kto za nimi mieszka (atak Fable na te drzwi, 18 XI 2026).
    // `odlozone: 'razem'`, bo przeglądarka ma nie zakładać drugi raz TAKŻE urządzenia odłożonego: zapis odbiłby
    // się o „to poświadczenie jest już zapisane” po niepotrzebnym dotknięciu telefonu.
    const znane = cel === 'zaloz'
      ? m.srod.wszystkie({ rodzaj: 'poswiadczenie/1', gdzie: { imie: wlasciciel }, odlozone: 'razem' }).map((p) => p.cechy.poswiadczenie)
      : null;
    return json({
      ok: true, wyzwanie: w, wazne_ms: WYZWANIE_WAZNE_MS, nazwa_strony: nazwaStrony, imie: wlasciciel,
      ...(znane ? { juz_znane: znane } : {}),
    });
  }

  // Wyzwanie sprawdzamy jego własnym podpisem i terminem; czy już go użyto, mówi `zuzyj` - wołane dopiero PO
  // podpisie urządzenia, który przeszedł, bo tylko taki gest ma prawo zostawić ślad w Miejscu.
  const wezWyzwanie = async (cel) => {
    const w = typeof c.wyzwanie === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(c.wyzwanie) ? c.wyzwanie : null;
    if (!w) return { blad: 'wyzwanie: to, które wydały drzwi w kroku zacznij' };
    const z = await czytajWyzwanie(sekret, w);
    if (!z.ok) return { blad: z.blad };
    if (z.cel !== cel) return { blad: `to wyzwanie było wydane do kroku ${z.cel}, nie do ${cel}` };
    return { w, los: z.los, az: z.az };
  };

  // --- 2. założenie poświadczenia (jego ręką, raz na urządzenie) -----------------------------------------------
  if (krok === 'zapisz') {
    if (kto !== wlasciciel) return json({ ok: false, blad: 'poświadczenie zakłada tylko właściciel' }, 403);
    // Zapis poświadczenia jest zwykłym zapisem i podlega dobowemu bezpiecznikowi jak każdy inny (budzet.mjs).
    if (m.budzet.przekroczony()) { const o = m.budzet.odmowa(); return json({ ok: false, blad: o.blad, ...o }, o.status || 429); }
    const wz = await wezWyzwanie('zaloz');
    if (wz.blad) return json({ ok: false, blad: wz.blad }, 400);
    let clientDataJSON, authenticatorData;
    try {
      clientDataJSON = bajty(c.clientDataJSON, 4096);
      authenticatorData = bajty(c.authenticatorData, 8192);
    } catch (e) { return json({ ok: false, blad: 'clientDataJSON i authenticatorData podaje się w base64url: ' + String(e.message || e) }, 400); }
    const z = await sprawdzZalozenie({ clientDataJSON, authenticatorData, wyzwanie: wz.w, origin, nazwaStrony });
    if (!z.ok) return json({ ok: false, blad: z.blad }, 400);
    if (!(await zuzyj(m, wz.los, wz.az))) return json({ ok: false, blad: JUZ_UZYTE }, 400);
    const juz = m.srod.wszystkie({ rodzaj: 'poswiadczenie/1', odlozone: 'razem' }).find((p) => p.cechy.poswiadczenie === z.poswiadczenie);
    if (juz) return json({ ok: false, blad: 'to poświadczenie jest już zapisane', rzecz: juz.id }, 409);
    const nazwa = typeof c.nazwa === 'string' && c.nazwa.trim() ? c.nazwa.trim().slice(0, 80) : 'urządzenie';
    const w = await m.srod.ruch(wlasciciel, {
      op: 'drzwi-zaloz-' + z.poswiadczenie.slice(0, 16).replace(/[^A-Za-z0-9_-]/g, ''),
      co: 'poloz', rodzaj: 'poswiadczenie/1', obszar: m.rdzen.meta('obszar_drzwi') || null,
      cechy: { nazwa, imie: wlasciciel, poswiadczenie: z.poswiadczenie, klucz_publiczny: z.kluczPubliczny, licznik: z.licznik, nazwa_strony: nazwaStrony, dodano: new Date(m.rdzen.teraz()).toISOString() },
    }, { slad: 'drzwi' });
    if (!w.ok) return json({ ok: false, blad: w.blad || 'poświadczenia nie udało się zapisać', szczegoly: w }, w.status || 500);
    return json({ ok: true, skutek: 'zalozone', rzecz: w.rzecz, poswiadczenie: z.poswiadczenie, sprawdzony: z.sprawdzony, nazwa });
  }

  // --- 3. wejście ----------------------------------------------------------------------------------------------
  if (krok === 'wejdz') {
    const wz = await wezWyzwanie('wejdz');
    if (wz.blad) return json({ ok: false, blad: wz.blad }, 400);
    const id = typeof c.poswiadczenie === 'string' ? c.poswiadczenie : '';
    const rz = m.srod.wszystkie({ rodzaj: 'poswiadczenie/1' }).find((p) => p.cechy.poswiadczenie === id);
    // Nie ma takiego poświadczenia i jest odłożone brzmią tak samo: inaczej te drzwi mówiłyby obcemu,
    // czym właściciel kiedyś wchodził.
    if (!rz) return json({ ok: false, blad: 'to poświadczenie nie otwiera tych drzwi' }, 401);
    let clientDataJSON, authenticatorData, podpis;
    try {
      clientDataJSON = bajty(c.clientDataJSON, 4096);
      authenticatorData = bajty(c.authenticatorData, 8192);
      podpis = bajty(c.podpis, 512);
    } catch (e) { return json({ ok: false, blad: 'clientDataJSON, authenticatorData i podpis podaje się w base64url: ' + String(e.message || e) }, 400); }
    const w = await sprawdzWejscie({
      clientDataJSON, authenticatorData, podpis,
      kluczPubliczny: rz.cechy.klucz_publiczny, licznikZnany: Number(rz.cechy.licznik) || 0,
      wyzwanie: wz.w, origin, nazwaStrony,
    });
    if (!w.ok) return json({ ok: false, blad: w.blad }, 401);
    if (!(await zuzyj(m, wz.los, wz.az))) return json({ ok: false, blad: JUZ_UZYTE }, 401);
    // Ślad wejścia zapisujemy, ale nie na każdym wejściu: zapis kosztuje wiersze, a licznik zerowy nic nie zmienia.
    // Po dojściu do dobowego limitu ŚLAD odpada, a wejście zostaje. To jest świadoma asymetria: bezpiecznik ma
    // zatrzymywać zmiany, nigdy zamykać właścicielowi drzwi do własnego Miejsca.
    if (w.licznik > (Number(rz.cechy.licznik) || 0) && !m.budzet.przekroczony()) {
      await m.srod.ruch(wlasciciel, { op: 'drzwi-licznik-' + rz.id.slice(0, 10) + '-' + w.licznik, co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'poswiadczenie/1', obszar: rz.obszar, cechy: { ...rz.cechy, licznik: w.licznik, uzyte: new Date(m.rdzen.teraz()).toISOString() } }, { slad: 'drzwi' }).catch(() => null);
    }
    const zeton = await zrobSesje(sekret, wlasciciel, { poswiadczenie: rz.cechy.poswiadczenie });
    return json({ ok: true, skutek: 'wpuszczone', imie: wlasciciel, sesja_wazna_dni: Math.round(SESJA_WAZNA_MS / 86400000) }, 200, { 'set-cookie': ciastkoNaglowek(zeton) });
  }

  // --- 4. wyjście ----------------------------------------------------------------------------------------------
  if (krok === 'wyjdz') return json({ ok: true, skutek: 'wyszedl' }, 200, { 'set-cookie': ciastkoKoniec() });

  return json({ ok: false, blad: 'drzwi mają kroki: stan (GET), zacznij, zapisz, wejdz, wyjdz' }, 404);
}
