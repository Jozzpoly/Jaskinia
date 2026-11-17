// Drzwi właściciela po stronie Miejsca: cztery kroki pod adresem (17 XI 2026, front B, Opus Code).
// Status: próba (TYMCZASOWE.md).
//
// Co tu jest, czego nie ma w drzwi.mjs: pamięć. Sprawdzenie podpisu jest czystą funkcją, ale wyzwanie musi być
// JEDNORAZOWE, a poświadczenie musi gdzieś leżeć. Wyzwania leżą w pamięci obiektu Miejsca (storage klucz-wartość,
// nie w spisie rzeczy: to sekret na dwie minuty, nie fakt o świecie). Poświadczenia leżą w spisie jako rzeczy
// rodzaju poswiadczenie/1 w obszarze Drzwi (widzi: wlasciciel) - bo to fakt o świecie i właściciel ma je widzieć,
// móc nazwać i móc odłożyć. Klucz PRYWATNY nie opuszcza jego urządzenia; my mamy publiczny, który nie jest sekretem.
//
// Czemu wyzwanie jest jednorazowe, a nie tylko krótkie: licznik podpisów authenticatora bywa zawsze zerowy
// (passkey Apple), więc licznik nie obroni przed powtórzeniem starego podpisu. Obroni wyzwanie, którego już nie ma.
import { json } from './trasy.mjs';
import { sprawdzZalozenie, sprawdzWejscie, zrobSesje, ciastkoNaglowek, ciastkoKoniec, b64uZ, b64uDo,
  sekretSesji, WYZWANIE_WAZNE_MS, SESJA_WAZNA_MS } from './drzwi.mjs';

export const ADRES_DRZWI = '/api/drzwi/';
// Ile wyzwań na minutę wolno wydać jednemu obiektowi Miejsca. Licznik stoi w PAMIĘCI instancji, nie w zapisie:
// kosztuje zero, a działa dokładnie wtedy, gdy ma działać - gdy ktoś wali w drzwi, obiekt jest obudzony.
// Po uśpieniu okno startuje od nowa i to jest w porządku: spanie znaczy, że nikt nie wali.
export const WYZWAN_NA_MINUTE = 30;
const KLUCZ_WYZWANIA = (w) => 'drzwi:wyzwanie:' + w;
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

  // --- 1. wyzwanie ---------------------------------------------------------------------------------------------
  if (krok === 'zacznij') {
    const cel = CELE.includes(c.cel) ? c.cel : null;
    if (!cel) return json({ ok: false, blad: `cel: "zaloz" (nowe poświadczenie) albo "wejdz"` }, 400);
    if (cel === 'zaloz' && kto !== wlasciciel) return json({ ok: false, blad: 'nowe poświadczenie zakłada tylko właściciel, i tylko wtedy, gdy JUŻ jest wpuszczony (kluczem albo poprzednimi drzwiami)' }, 403);
    // Wyzwanie do wejścia zostawia ślad w pamięci obiektu, a prosić o nie może każdy - to jest powierzchnia
    // do zalewania. Dwa tanie progi: tam, gdzie nie ma czym wejść, nie wydajemy nic, i nie więcej niż
    // WYZWAN_NA_MINUTE na obiekt. Oba odmawiają BEZ zapisu, więc zalewanie nic nie kosztuje Miejsca.
    const ilePoswiadczen = m.srod.ile({ rodzaj: 'poswiadczenie/1' });
    if (cel === 'wejdz' && ilePoswiadczen === 0) return json({ ok: false, blad: 'to Miejsce nie ma jeszcze żadnego poświadczenia: najpierw dodaj urządzenie, będąc wpuszczonym kluczem' }, 404);
    const teraz = Date.now();
    if (!m._drzwiOkno || teraz - m._drzwiOkno.od > 60000) m._drzwiOkno = { od: teraz, ile: 0 };
    if (++m._drzwiOkno.ile > WYZWAN_NA_MINUTE) return json({ ok: false, blad: 'za dużo prób otwarcia drzwi w ciągu minuty; spróbuj za chwilę' }, 429);
    const w = b64uZ(crypto.getRandomValues(new Uint8Array(32)));
    await m.ctx.storage.put(KLUCZ_WYZWANIA(w), { cel, do: Date.now() + WYZWANIE_WAZNE_MS }, { expirationTtl: Math.ceil(WYZWANIE_WAZNE_MS / 1000) + 60 });
    const znane = m.srod.wszystkie({ rodzaj: 'poswiadczenie/1', gdzie: { imie: wlasciciel } }).map((p) => p.cechy.poswiadczenie);
    return json({
      ok: true, wyzwanie: w, wazne_ms: WYZWANIE_WAZNE_MS, nazwa_strony: nazwaStrony, imie: wlasciciel,
      // Przy zakładaniu przeglądarka ma wiedzieć, czego NIE zakładać drugi raz; przy wejściu - czym może wejść.
      ...(cel === 'zaloz' ? { juz_znane: znane } : { poswiadczenia: znane }),
    });
  }

  // Wyzwanie zużywa się raz. Pobieramy i od razu usuwamy: drugi raz tego samego podpisu już nie da się użyć.
  const wezWyzwanie = async (cel) => {
    const w = typeof c.wyzwanie === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(c.wyzwanie) ? c.wyzwanie : null;
    if (!w) return { blad: 'wyzwanie: to, które wydały drzwi w kroku zacznij' };
    const zapis = await m.ctx.storage.get(KLUCZ_WYZWANIA(w));
    await m.ctx.storage.delete(KLUCZ_WYZWANIA(w));
    if (!zapis) return { blad: 'tego wyzwania nie ma: albo już go użyto, albo minęły dwie minuty; zacznij od nowa' };
    if (zapis.cel !== cel) return { blad: `to wyzwanie było wydane do kroku ${zapis.cel}, nie do ${cel}` };
    if (!(zapis.do > Date.now())) return { blad: 'wyzwanie się przeterminowało; zacznij od nowa' };
    return { w };
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
    // Ślad wejścia zapisujemy, ale nie na każdym wejściu: zapis kosztuje wiersze, a licznik zerowy nic nie zmienia.
    // Po dojściu do dobowego limitu ŚLAD odpada, a wejście zostaje. To jest świadoma asymetria: bezpiecznik ma
    // zatrzymywać zmiany, nigdy zamykać właścicielowi drzwi do własnego Miejsca.
    if (w.licznik > (Number(rz.cechy.licznik) || 0) && !m.budzet.przekroczony()) {
      await m.srod.ruch(wlasciciel, { op: 'drzwi-licznik-' + rz.id.slice(0, 10) + '-' + w.licznik, co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'poswiadczenie/1', obszar: rz.obszar, cechy: { ...rz.cechy, licznik: w.licznik, uzyte: new Date(m.rdzen.teraz()).toISOString() } }, { slad: 'drzwi' }).catch(() => null);
    }
    const zeton = await zrobSesje(sekret, wlasciciel);
    return json({ ok: true, skutek: 'wpuszczone', imie: wlasciciel, sesja_wazna_dni: Math.round(SESJA_WAZNA_MS / 86400000) }, 200, { 'set-cookie': ciastkoNaglowek(zeton) });
  }

  // --- 4. wyjście ----------------------------------------------------------------------------------------------
  if (krok === 'wyjdz') return json({ ok: true, skutek: 'wyszedl' }, 200, { 'set-cookie': ciastkoKoniec() });

  return json({ ok: false, blad: 'drzwi mają kroki: stan (GET), zacznij, zapisz, wejdz, wyjdz' }, 404);
}
