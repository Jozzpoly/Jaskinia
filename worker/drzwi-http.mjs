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
//
// Po niezależnym ataku z 19 XI 2026 (Commons, narzedzia/atak-niezalezny-2026-11-19-drzwi/RAPORT.md) drzwi otwiera
// tylko poświadczenie, które same założyły: z pieczęcią, w obszarze Drzwi, z imieniem właściciela (znalezisko 1);
// próg prób nie zamyka już drzwi właścicielowi (znalezisko 2); obcy nie dowiaduje się, ile urządzeń ma właściciel
// ani jak ma na imię (znalezisko 4); sesja niesie skrót poświadczenia i pokolenie wyjść (znaleziska 6 i 7); a gdy
// pamięć obiektu nie odpowiada, drzwi odmawiają zamiast wpuszczać drugi raz (uwaga U1).
import { json } from './trasy.mjs';
import { sprawdzZalozenie, sprawdzWejscie, zrobSesje, ciastkoNaglowek, ciastkoKoniec, b64uDo,
  sekretSesji, zrobWyzwanie, czytajWyzwanie, WYZWANIE_WAZNE_MS, SESJA_WAZNA_MS,
  pieczecPoswiadczenia, pieczecZgodna, skrotPoswiadczenia, posSesji, czytajPosSesji } from './drzwi.mjs';

export const ADRES_DRZWI = '/api/drzwi/';
// Ile NIEUDANYCH prób na minutę przyjmują drzwi od jednego pukającego, i ile kroków na minutę od właściciela.
// Licznik stoi w PAMIĘCI instancji, nie w zapisie: kosztuje zero, a działa dokładnie wtedy, gdy ma działać - gdy ktoś
// wali w drzwi, obiekt jest obudzony. Po uśpieniu okno startuje od nowa i to jest w porządku: spanie znaczy, że nikt
// nie wali.
// Do 19 XI stał tu JEDEN licznik na całe Miejsce, liczony przed sprawdzeniem, kto puka: 30 pustych żądań obcego na
// minutę zamykało drzwi także właścicielowi, i to z kluczem (niezależny atak, 19 XI 2026, znalezisko 2). Komentarz nazywał
// to świadomą ceną; była to po prostu dziura w dostępności. Dziś:
// - wydanie wyzwania do wejścia nie czyta bazy ani nie zapisuje niczego, więc nie ma czego tu oszczędzać i nie liczy
//   się wcale (wyzwanie jest podpisane i przeterminowuje się samo);
// - właściciel z kluczem albo ciastkiem ma własny kubełek, do którego obcy nie sięga;
// - nieudana próba wejścia liczy się w kubełku poświadczenia, którym ktoś próbował wejść (obcy nie zna identyfikatora
//   poświadczenia właściciela, więc nie zapcha jego kubełka), a próba nieznanym poświadczeniem w kubełku adresu,
//   z którego przyszła (Worker podaje go w x-ip; bez adresu, czyli lokalnie, wszyscy obcy dzielą jeden kubełek).
export const WYZWAN_NA_MINUTE = 30;
// Ile kubełków naraz trzyma pamięć instancji. Ponad to nowi obcy dzielą jeden wspólny kubełek, więc pamięć ma granicę,
// a właściciel (kubełek z imienia albo z poświadczenia) dalej ma swój.
export const KUBELKOW_NAJWYZEJ = 512;
const MINUTA = 60000;
// Największe ciało żądania do drzwi. Najdłuższe prawdziwe (zapis z kluczem publicznym) ma kilka kilobajtów; do 19 XI
// granicy nie było i 16 MB bez klucza było czytane i parsowane (uwaga U3). Worker odmawia wcześniej, tu stoi druga granica.
export const CIALO_DRZWI_NAJWYZEJ = 32 * 1024;

function kubelek(m, klucz, teraz) {
  if (!m._drzwiKubelki) m._drzwiKubelki = new Map();
  const k = m._drzwiKubelki;
  let b = k.get(klucz);
  if (b && teraz - b.od > MINUTA) { k.delete(klucz); b = null; }
  if (b) return b;
  if (k.size >= KUBELKOW_NAJWYZEJ) for (const [kk, bb] of k) if (teraz - bb.od > MINUTA) k.delete(kk);
  if (k.size >= KUBELKOW_NAJWYZEJ && !klucz.startsWith('kto:') && !klucz.startsWith('pos:')) {
    klucz = 'reszta';
    b = k.get(klucz);
    if (b && teraz - b.od <= MINUTA) return b;
  }
  b = { od: teraz, ile: 0 };
  k.set(klucz, b);
  return b;
}
// Policz jedną próbę w kubełku i powiedz, czy przekroczyła próg.
const ponadProg = (m, klucz) => ++kubelek(m, klucz, Date.now()).ile > WYZWAN_NA_MINUTE;
const ZA_DUZO = 'za dużo prób otwarcia drzwi w ciągu minuty; spróbuj za chwilę';

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
// Trzecia pomyłka, do 19 XI: błąd pamięci (get albo put) był połykany i drzwi wpuszczały, licząc na pamięć instancji,
// która po uśpieniu znika, więc ten sam podpis wpuszczał drugi raz (uwaga U1). Teraz błąd pamięci to odmowa: właściciel
// dotyka jeszcze raz, a powtórzenie podpisu nie przechodzi nigdy.
const KLUCZ_ZUZYTYCH = 'drzwi:zuzyte-wyzwania';
export const ZUZYTYCH_NAJWYZEJ = 64;
const JUZ_UZYTE = 'już go użyto: jedno wyzwanie otwiera drzwi tylko raz; zacznij od nowa';
const PAMIEC_NIE_ODPOWIADA = 'pamięć drzwi nie odpowiada; nic się nie zmieniło, dotknij jeszcze raz za chwilę';
// Oddaje true (zużyte teraz), false (już było użyte) albo null (pamięć nie odpowiedziała: odmowa).
async function zuzyj(m, los, az) {
  const teraz = Date.now();
  const st = m.ctx && m.ctx.storage;
  const maPamiec = !!st && typeof st.get === 'function' && typeof st.put === 'function';
  if (!m._zuzyte) m._zuzyte = new Map();
  for (const [k, d] of m._zuzyte) if (!(d > teraz)) m._zuzyte.delete(k);
  if (m._zuzyte.has(los)) return false;
  let lista = [];
  if (maPamiec) {
    try {
      const z = await st.get(KLUCZ_ZUZYTYCH);
      if (Array.isArray(z)) lista = z.filter((e) => Array.isArray(e) && e[1] > teraz);
    } catch { return null; }
    if (lista.some((e) => e[0] === los)) return false;
  }
  m._zuzyte.set(los, az);
  if (maPamiec) {
    lista.push([los, az]);
    try { await st.put(KLUCZ_ZUZYTYCH, lista.slice(-ZUZYTYCH_NAJWYZEJ)); } catch { return null; }
  }
  return true;
}
const CELE = ['zaloz', 'wejdz'];

const bajty = (s, ile) => {
  const u = b64uDo(s);
  if (ile && u.length > ile) throw new Error('za dużo bajtów');
  return u;
};

const ZA_DUZE = Symbol('za duże');
async function cialoJson(request) {
  const dl = Number(request.headers.get('content-length'));
  if (Number.isFinite(dl) && dl > CIALO_DRZWI_NAJWYZEJ) return ZA_DUZE;
  const t = await request.text();
  if (t.length > CIALO_DRZWI_NAJWYZEJ) return ZA_DUZE;
  if (!t) return {};
  try { const c = JSON.parse(t); return c && typeof c === 'object' && !Array.isArray(c) ? c : null; } catch { return null; }
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

// Poświadczenia, które w ogóle mogą otworzyć drzwi: leżą w obszarze Drzwi i należą do właściciela. Pieczęć sprawdza się
// osobno (async), przy wejściu. Do 19 XI drzwi brały KAŻDĄ rzecz poswiadczenie/1, gdziekolwiek leżała i jakkolwiek
// powstała, więc agent kładł swoją propozycję poświadczenia, właściciel klikał "przyjmij" i agent wchodził jako on.
export function poswiadczeniaDrzwi(m, { odlozone = 'nie' } = {}) {
  const obszar = m.rdzen.meta('obszar_drzwi') || null;
  const wlasciciel = m.rdzen.wlasciciel;
  return m.srod.wszystkie({ rodzaj: 'poswiadczenie/1', odlozone })
    .filter((p) => (p.obszar ?? null) === obszar && obszar !== null && p.cechy.imie === wlasciciel);
}

// Czy drzwi są w ogóle gotowe. O sekrecie kod może powiedzieć TYLKO, czy jest ustawiony (zasada 12).
// Liczbę urządzeń dostaje tylko właściciel (strona pokazuje mu "dodaj to urządzenie", gdy nie ma żadnego). Obcy
// dostaje tyle, ile potrzeba, żeby pokazać guzik wejścia: czy drzwi są gotowe. Do 19 XI dostawał dokładną liczbę
// urządzeń właściciela (znalezisko 4).
const stan = (m, request, dlaWlasciciela) => {
  const gotowe = sekretSesji(m.env) !== null;
  return {
    sekret_sesji_ustawiony: gotowe,
    wejscie_dotknieciem: gotowe,
    ...(dlaWlasciciela ? { poswiadczen: poswiadczeniaDrzwi(m).length } : {}),
    nazwa_strony: adres(m, request).nazwaStrony,
    sesja_wazna_dni: Math.round(SESJA_WAZNA_MS / 86400000),
  };
};

export async function obsluzDrzwi(m, request) {
  const krok = new URL(request.url).pathname.slice(ADRES_DRZWI.length);
  const kto = request.headers.get('x-kto') || null;
  const { origin, nazwaStrony } = adres(m, request);
  const wlasciciel = m.rdzen.wlasciciel;
  const jestWlascicielem = !!kto && kto === wlasciciel;

  if (krok === 'stan') return json({ ok: true, ...stan(m, request, jestWlascicielem) });
  if (request.method !== 'POST') return json({ ok: false, blad: 'te drzwi otwiera się żądaniem POST' }, 405);
  if (!origin) return json({ ok: false, blad: 'Miejsce nie zna jeszcze własnego adresu; wejdź przez stronę, nie wprost do obiektu' }, 400);
  const sekret = sekretSesji(m.env);
  if (!sekret) {
    return json({ ok: false, blad: 'drzwi właściciela nie są gotowe: nie ma ustawienia SEKRET_SESJI (co najmniej 16 znaków) w Cloudflare', ...stan(m, request, jestWlascicielem) }, 503);
  }
  // Kroki właściciela (zakładanie, zapis) liczą się w jego własnym kubełku, zanim cokolwiek dotknie bazy.
  if (jestWlascicielem && (krok === 'zapisz' || krok === 'zacznij') && ponadProg(m, 'kto:' + kto)) return json({ ok: false, blad: ZA_DUZO }, 429);
  const c = await cialoJson(request);
  if (c === ZA_DUZE) return json({ ok: false, blad: `ciało żądania do drzwi może mieć najwyżej ${CIALO_DRZWI_NAJWYZEJ} bajtów` }, 413);
  if (c === null) return json({ ok: false, blad: 'ciało żądania ma być obiektem JSON' }, 400);

  // --- 1. wyzwanie ---------------------------------------------------------------------------------------------
  if (krok === 'zacznij') {
    const cel = CELE.includes(c.cel) ? c.cel : null;
    if (!cel) return json({ ok: false, blad: `cel: "zaloz" (nowe poświadczenie) albo "wejdz"` }, 400);
    if (cel === 'zaloz' && !jestWlascicielem) return json({ ok: false, blad: 'nowe poświadczenie zakłada tylko właściciel, i tylko wtedy, gdy JUŻ jest wpuszczony (kluczem albo poprzednimi drzwiami)' }, 403);
    // Wyzwanie do wejścia dostaje każdy i zawsze, także wtedy, gdy w Miejscu nie ma jeszcze żadnego poświadczenia:
    // do 19 XI odpowiedź 404 przy zerze mówiła obcemu, czy właściciel ma jakiekolwiek urządzenie (uwaga P1b), a samo
    // liczenie czytało bazę przy każdym pukaniu. Wydanie nie czyta bazy i nie zostawia żadnego zapisu.
    const w = await zrobWyzwanie(sekret, cel);
    // Przy ZAKŁADANIU przeglądarka ma wiedzieć, czego nie zakładać drugi raz, i jak nazwać użytkownika - a o to prosi
    // tylko właściciel, który JUŻ jest wpuszczony (sprawdzone wyżej). Przy WEJŚCIU nie wydajemy niczego: poświadczenia
    // są odnajdywalne (discoverable), więc przeglądarka sama wie, czym wejść; lista identyfikatorów mówiła obcemu, ile
    // urządzeń ma właściciel (atak Fable, 18 XI), a imię właściciela mówiło mu, kogo szukać (niezależny atak, 19 XI).
    // `odlozone: 'razem'`, bo przeglądarka ma nie zakładać drugi raz TAKŻE urządzenia odłożonego: zapis odbiłby
    // się o "to poświadczenie jest już zapisane" po niepotrzebnym dotknięciu telefonu.
    // Tylko poświadczenia z pieczęcią: urządzenie założone przed 19 XI (albo położone ruchem) drzwi już nie otwiera,
    // więc nie może też blokować dodania tego samego telefonu jeszcze raz - przeglądarka odmówiłaby założenia
    // poświadczenia, które Miejsce wymienia jako znane, i właściciel zostałby bez drogi z powrotem.
    const zaloz = cel === 'zaloz';
    let znane = null;
    if (zaloz) {
      znane = [];
      for (const p of poswiadczeniaDrzwi(m, { odlozone: 'razem' })) if (await pieczecZgodna(sekret, p.cechy)) znane.push(p.cechy.poswiadczenie);
    }
    return json({
      ok: true, wyzwanie: w, wazne_ms: WYZWANIE_WAZNE_MS, nazwa_strony: nazwaStrony,
      ...(zaloz ? { imie: wlasciciel, juz_znane: znane } : {}),
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
    if (!jestWlascicielem) return json({ ok: false, blad: 'poświadczenie zakłada tylko właściciel' }, 403);
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
    const zu = await zuzyj(m, wz.los, wz.az);
    if (zu === null) return json({ ok: false, blad: PAMIEC_NIE_ODPOWIADA }, 503);
    if (!zu) return json({ ok: false, blad: JUZ_UZYTE }, 400);
    const juz = m.srod.wszystkie({ rodzaj: 'poswiadczenie/1', odlozone: 'razem' }).find((p) => p.cechy.poswiadczenie === z.poswiadczenie);
    if (juz) return json({ ok: false, blad: 'to poświadczenie jest już zapisane', rzecz: juz.id }, 409);
    const obszar = m.rdzen.meta('obszar_drzwi') || null;
    if (!obszar) return json({ ok: false, blad: 'to Miejsce nie ma obszaru Drzwi; poświadczenie leży tylko tam' }, 500);
    const nazwa = typeof c.nazwa === 'string' && c.nazwa.trim() ? c.nazwa.trim().slice(0, 80) : 'urządzenie';
    const cechy = { nazwa, imie: wlasciciel, poswiadczenie: z.poswiadczenie, klucz_publiczny: z.kluczPubliczny, licznik: z.licznik, nazwa_strony: nazwaStrony, dodano: new Date(m.rdzen.teraz()).toISOString(), pokolenie: 0 };
    cechy.skrot = await skrotPoswiadczenia(z.poswiadczenie);
    cechy.pieczec = await pieczecPoswiadczenia(sekret, cechy);
    const w = await m.srod.ruch(wlasciciel, {
      op: 'drzwi-zaloz-' + cechy.skrot.slice(0, 16),
      co: 'poloz', rodzaj: 'poswiadczenie/1', obszar, cechy,
    }, { slad: 'drzwi' });
    if (!w.ok) return json({ ok: false, blad: w.blad || 'poświadczenia nie udało się zapisać', szczegoly: w }, w.status || 500);
    return json({ ok: true, skutek: 'zalozone', rzecz: w.rzecz, poswiadczenie: z.poswiadczenie, sprawdzony: z.sprawdzony, nazwa });
  }

  // --- 3. wejście ----------------------------------------------------------------------------------------------
  if (krok === 'wejdz') {
    const wz = await wezWyzwanie('wejdz');
    if (wz.blad) return json({ ok: false, blad: wz.blad }, 400);
    const id = typeof c.poswiadczenie === 'string' ? c.poswiadczenie : '';
    const rz = id ? poswiadczeniaDrzwi(m).find((p) => p.cechy.poswiadczenie === id) : null;
    // Nie ma takiego poświadczenia, jest odłożone albo leży poza drzwiami: brzmi tak samo. Inaczej te drzwi mówiłyby
    // obcemu, czym właściciel kiedyś wchodził. Próba nieznanym poświadczeniem liczy się w kubełku adresu.
    const NIE_OTWIERA = 'to poświadczenie nie otwiera tych drzwi';
    if (!rz) {
      const ponad = ponadProg(m, 'ip:' + (request.headers.get('x-ip') || '?'));
      return json({ ok: false, blad: ponad ? ZA_DUZO : NIE_OTWIERA }, ponad ? 429 : 401);
    }
    const kubelekPos = 'pos:' + (rz.cechy.skrot || rz.id);
    if (ponadProg(m, kubelekPos)) return json({ ok: false, blad: ZA_DUZO }, 429);
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
    // Pieczęć dopiero po podpisie, który przeszedł: o tym, że urządzenie trzeba dodać jeszcze raz, dowiaduje się tylko
    // ten, kto trzyma jego klucz prywatny. Skrót identyfikatora też musi się zgadzać, bo na nim stoi sesja.
    if (!(await pieczecZgodna(sekret, rz.cechy)) || rz.cechy.skrot !== (await skrotPoswiadczenia(rz.cechy.poswiadczenie))) {
      return json({ ok: false, blad: 'tego urządzenia nie założyły te drzwi (albo założyły je przed 19 XI 2026, przed pieczęcią): wejdź kluczem i dodaj je jeszcze raz' }, 401);
    }
    const zu = await zuzyj(m, wz.los, wz.az);
    if (zu === null) return json({ ok: false, blad: PAMIEC_NIE_ODPOWIADA }, 503);
    if (!zu) return json({ ok: false, blad: JUZ_UZYTE }, 401);
    // Ślad wejścia zapisujemy, ale nie na każdym wejściu: zapis kosztuje wiersze, a licznik zerowy nic nie zmienia.
    // Po dojściu do dobowego limitu ŚLAD odpada, a wejście zostaje. To jest świadoma asymetria: bezpiecznik ma
    // zatrzymywać zmiany, nigdy zamykać właścicielowi drzwi do własnego Miejsca.
    if (w.licznik > (Number(rz.cechy.licznik) || 0) && !m.budzet.przekroczony()) {
      await m.srod.ruch(wlasciciel, { op: 'drzwi-licznik-' + rz.id.slice(0, 10) + '-' + w.licznik, co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'poswiadczenie/1', obszar: rz.obszar, cechy: { ...rz.cechy, licznik: w.licznik, uzyte: new Date(m.rdzen.teraz()).toISOString() } }, { slad: 'drzwi' }).catch(() => null);
    }
    const zeton = await zrobSesje(sekret, wlasciciel, { poswiadczenie: posSesji(rz.cechy.skrot, Number(rz.cechy.pokolenie) || 0) });
    return json({ ok: true, skutek: 'wpuszczone', imie: wlasciciel, sesja_wazna_dni: Math.round(SESJA_WAZNA_MS / 86400000) }, 200, { 'set-cookie': ciastkoNaglowek(zeton) });
  }

  // --- 4. wyjście ----------------------------------------------------------------------------------------------
  // Wyjście z sesji drzwi podbija pokolenie poświadczenia, którym ją otwarto: żeton skopiowany wcześniej z tego
  // urządzenia przestaje działać od następnego żądania (do 19 XI wyjście czyściło tylko ciastko w tej przeglądarce,
  // a żeton działał do końca 30 dni: znalezisko 7). Kto wszedł kluczem, ten nie ma sesji drzwi do zamknięcia.
  if (krok === 'wyjdz') {
    const pos = jestWlascicielem ? czytajPosSesji(request.headers.get('x-sesja-pos')) : null;
    if (pos) {
      const rz = poswiadczeniaDrzwi(m).find((p) => p.cechy.skrot === pos.skrot);
      if (rz && (Number(rz.cechy.pokolenie) || 0) === pos.pokolenie) {
        const nast = pos.pokolenie + 1;
        const w = await m.srod.ruch(wlasciciel, { op: 'drzwi-wyjdz-' + rz.id.slice(0, 10) + '-' + nast, co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: 'poswiadczenie/1', obszar: rz.obszar, cechy: { ...rz.cechy, pokolenie: nast } }, { slad: 'drzwi' }).catch(() => null);
        if (!w || !w.ok) return json({ ok: false, blad: 'nie udało się zamknąć sesji tego urządzenia; ciastko zostało, spróbuj jeszcze raz', szczegoly: w || null }, 503);
      }
    }
    return json({ ok: true, skutek: 'wyszedl' }, 200, { 'set-cookie': ciastkoKoniec() });
  }

  return json({ ok: false, blad: 'drzwi mają kroki: stan (GET), zacznij, zapisz, wejdz, wyjdz' }, 404);
}
