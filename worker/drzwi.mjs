// Drzwi właściciela: wejście jednym dotknięciem, bez klucza do wklejania i bez cudzej usługi tożsamości
// (17 XI 2026, front B, Opus Code). Status: próba (TYMCZASOWE.md).
//
// Po co. Dziś właściciel wchodzi, wklejając klucz z ustawień Cloudflare. To jest dokładnie ten rodzaj tarcia,
// który sprawia, że człowiek nie wraca: na telefonie wklejenie klucza jest gestem na pół minuty, a wejście
// ma być gestem na sekundę. Passkey (WebAuthn) daje to bez hasła i bez konta u nikogo obcego: telefon trzyma
// klucz prywatny, my trzymamy sam klucz publiczny, a Miejsce sprawdza podpis własnym kodem.
//
// Czego ten plik NIE zna. Ani Cloudflare, ani bazy, ani Miejsca: dostaje bajty i sekrety jako argumenty,
// więc cały łańcuch sprawdzenia da się puścić w Node z udawanym authenticatorem (worker/drzwi.test.mjs).
// Trzy funkcje (cbor, kluczZCose, derNaSurowy) pochodzą z falsyfikatora proby/b1-drzwi-passkey i wchodzą tu
// bez zmiany: tam zadaliśmy pytanie, czy to się da samym WebCrypto, tu z odpowiedzi robi się mechanizm.
//
// Granica, którą trzeba postawić od pierwszego dnia (falsyfikator, pytanie 2): nazwa strony (rp.id) jest
// DOKŁADNYM hostem tego Miejsca, nigdy domeną nadrzędną. workers.dev jest na publicznej liście sufiksów,
// więc jozzpoly.workers.dev byłaby domeną rejestrowalną - i jedno poświadczenie dzieliłoby się z każdym
// podglądem gałęzi na tym koncie, a podglądy są publiczne i mają jawne klucze.

// Przedrostek `__Host-`: przeglądarka przyjmie takie ciastko tylko od tego samego hosta, z Secure, ze ścieżką / i bez
// Domain. Bez niego strona z dowolnej gałęzi na workers.dev (domena rejestrowalna jest wspólna dla wszystkich podglądów
// tego konta) mogła podrzucić ciastko o tej samej nazwie z Domain na całą domenę i Path=/api i postawić je przed
// prawdziwym, a drzwi czytały pierwsze (niezależny atak, 19 XI 2026, znalezisko 3). Ciastko o dawnej nazwie
// (`jaskinia_wejscie`, do 19 XI) niczego już nie otwiera i wygasa samo; kosztem zmiany jest jedno dotknięcie.
export const CIASTKO = '__Host-jaskinia_wejscie';

// Sekret, którym podpisujemy sesję. Na podglądzie stoi JAWNIE w wrangler.jsonc, jak wszystkie klucze podglądu;
// w prawdziwym Miejscu jest sekretem z ustawień Cloudflare i nigdy nie leży w pliku (zasada 12). Wartość
// z przedrostkiem `podglad-` poza podglądem jest odrzucana, więc skopiowanie tamtej linii do prawdziwego
// Miejsca nie zadziała po cichu - drzwi powiedzą, że nie są gotowe.
export const sekretSesji = (env = {}) => {
  const s = env.SEKRET_SESJI;
  if (typeof s !== 'string' || s.length < 16) return null;
  if (s.startsWith('podglad-') && env.PODGLAD !== 'tak') return null;
  return s;
};
// Pięć minut, nie dwie: pierwsze założenie passkey na telefonie to czytanie, wybór, gdzie zapisać klucz, i dopiero
// potem palec. Jozz 18 XI 2026: „zajeło mi chyba z ponad 2 minuty na całość”. Dłuższy termin nic nie kosztuje,
// bo powtórzeniu podpisu broni jednorazowość wyzwania (drzwi-http.mjs: zuzyj), nie jego krótkość.
export const WYZWANIE_WAZNE_MS = 5 * 60 * 1000;
export const SESJA_WAZNA_MS = 30 * 24 * 60 * 60 * 1000; // miesiąc: wejście ma być gestem na sekundę, nie co dzień
const T = new TextEncoder();

// --- bajty i napisy ------------------------------------------------------------------------------------------
export const b64uZ = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64uDo = (s) => {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('to nie jest base64url');
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const rowne = (a, b) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
};
const skrot = async (u8) => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));

// --- CBOR, klucz COSE i podpis (z falsyfikatora, bez zmiany) -------------------------------------------------
export function cbor(u8, i = 0) {
  const d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const glowa = u8[i++], typ = glowa >> 5; let n = glowa & 31;
  if (n === 24) n = u8[i++];
  else if (n === 25) { n = d.getUint16(i); i += 2; }
  else if (n === 26) { n = d.getUint32(i); i += 4; }
  else if (n === 27) throw new Error('64-bitowe długości: nie w kluczu COSE');
  // Zadeklarowana długość nie może przekraczać bajtów, które zostały: każdy element tablicy ma co najmniej bajt, a pole
  // mapy dwa. Bez tego `0x9a ffffffff` kazało pętli kręcić się 4,3 mld razy (niezależny atak, 19 XI 2026, uwaga U4).
  const zostalo = u8.length - i;
  if ((typ === 2 || typ === 3 || typ === 4) && n > zostalo) throw new Error('CBOR: zadeklarowana długość jest większa niż bajty, które zostały');
  if (typ === 5 && n * 2 > zostalo) throw new Error('CBOR: zadeklarowana długość mapy jest większa niż bajty, które zostały');
  if (typ === 0) return [n, i];
  if (typ === 1) return [-1 - n, i];
  if (typ === 2) return [u8.slice(i, i + n), i + n];
  if (typ === 3) return [new TextDecoder().decode(u8.slice(i, i + n)), i + n];
  if (typ === 4) { const t = []; for (let k = 0; k < n; k++) { const [w, j] = cbor(u8, i); t.push(w); i = j; } return [t, i]; }
  if (typ === 5) { const m = new Map(); for (let k = 0; k < n; k++) { const [kk, j] = cbor(u8, i); const [vv, j2] = cbor(u8, j); m.set(kk, vv); i = j2; } return [m, i]; }
  throw new Error('nieobsługiwany typ CBOR: ' + typ);
}

// Klucz COSE EC2 (alg -7) -> CryptoKey, przez surowy punkt 0x04||x||y.
export async function kluczZCose(cose) {
  const [m] = cbor(cose instanceof Uint8Array ? cose : new Uint8Array(cose));
  if (!(m instanceof Map)) throw new Error('klucz COSE nie jest mapą');
  const kty = m.get(1), alg = m.get(3), crv = m.get(-1), x = m.get(-2), y = m.get(-3);
  if (kty !== 2 || alg !== -7 || crv !== 1) throw new Error(`nieobsługiwany klucz: kty=${kty} alg=${alg} crv=${crv}`);
  if (!(x instanceof Uint8Array) || x.length !== 32 || !(y instanceof Uint8Array) || y.length !== 32) throw new Error('współrzędne klucza nie mają 32 bajtów');
  const surowy = new Uint8Array(65); surowy[0] = 4; surowy.set(x, 1); surowy.set(y, 33);
  return { klucz: await crypto.subtle.importKey('raw', surowy, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']), surowy };
}

// Podpis z authenticatora jest w DER (ASN.1 SEQUENCE{r,s}), a WebCrypto chce surowego r||s.
export function derNaSurowy(der) {
  if (der[0] !== 0x30) throw new Error('podpis nie jest SEQUENCE');
  let i = 2; if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const czytaj = () => { if (der[i++] !== 0x02) throw new Error('podpis nie jest INTEGER'); const n = der[i++]; const v = der.slice(i, i + n); i += n; return v; };
  const dopelnij = (v) => { const out = new Uint8Array(32); const z = v[0] === 0 ? v.slice(1) : v; if (z.length > 32) throw new Error('liczba dłuższa niż 32 bajty'); out.set(z, 32 - z.length); return out; };
  const r = dopelnij(czytaj()), s = dopelnij(czytaj());
  const out = new Uint8Array(64); out.set(r, 0); out.set(s, 32); return out;
}

// --- authenticatorData ---------------------------------------------------------------------------------------
// 32 bajty skrótu nazwy strony, bajt flag, 4 bajty licznika; przy zakładaniu dalej jeszcze dane poświadczenia.
export function czytajAuthData(u8) {
  if (!(u8 instanceof Uint8Array) || u8.length < 37) throw new Error('authenticatorData krótsze niż 37 bajtów');
  const d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const flagi = u8[32];
  const stan = { skrotNazwyStrony: u8.slice(0, 32), flagi, obecny: (flagi & 1) === 1, sprawdzony: (flagi & 4) === 4, zPoswiadczeniem: (flagi & 64) === 64, licznik: d.getUint32(33) };
  if (!stan.zPoswiadczeniem) return stan;
  if (u8.length < 55) throw new Error('authenticatorData mówi, że niesie poświadczenie, a jest za krótkie');
  const dlugosc = d.getUint16(53);
  if (u8.length < 55 + dlugosc) throw new Error('authenticatorData krótsze niż długość poświadczenia w nim zapisana');
  stan.poswiadczenie = u8.slice(55, 55 + dlugosc);
  stan.cose = u8.slice(55 + dlugosc);
  return stan;
}

// --- wyzwanie i sesja ----------------------------------------------------------------------------------------
const hmac = async (sekret, tekst) => {
  if (typeof sekret !== 'string' || sekret.length < 16) throw new Error('sekret sesji musi mieć co najmniej 16 znaków');
  const k = await crypto.subtle.importKey('raw', T.encode(sekret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, T.encode(tekst)));
};

// --- wyzwanie, którego Miejsce NIE MUSI pamiętać (18 XI 2026) ---------------------------------------------------
// Obiekt Miejsca zasypia po ok. 10 s bez żądań i traci wtedy pamięć instancji (dokumentacja Cloudflare, „Durable
// Object Lifecycle”: „When hibernated, the in-memory state is discarded”). Wyzwanie trzymane w pamięci przepadało
// więc w połowie gestu każdemu, kto przy telefonie myślał dłużej niż kilka sekund - i tak padły pierwsze próby
// Jozza, a drugie, szybkie, przeszły. Teraz wyzwanie NIESIE wszystko, co trzeba sprawdzić: wersję, cel, termin
// i 16 losowych bajtów, a całość jest podpisana sekretem sesji. Bez sekretu nie da się go podrobić ani przedłużyć,
// a do sprawdzenia nie trzeba niczego pamiętać, więc przeżywa każde uśpienie obiektu.
const CELE_WYZWANIA = ['zaloz', 'wejdz'];
const WERSJA_WYZWANIA = 1;
const DL_TRESCI_WYZWANIA = 26;  // wersja (1), cel (1), termin w ms (8), los (16)
const NIE_STAD = 'to wyzwanie nie pochodzi od tych drzwi; zacznij od nowa';
// Przedrostek z ukośnikiem: pierwsza część żetonu sesji jest w base64url, więc ukośnika mieć nie może i żaden
// podpis wyzwania nie da się przełożyć na podpis sesji ani odwrotnie.
const podpisWyzwania = (sekret, tresc) => hmac(sekret, 'wyzwanie/1.' + b64uZ(tresc));

export async function zrobWyzwanie(sekret, cel, { teraz = Date.now(), ile = WYZWANIE_WAZNE_MS } = {}) {
  const k = CELE_WYZWANIA.indexOf(cel);
  if (k < 0) throw new Error('cel wyzwania: zaloz albo wejdz');
  const tresc = new Uint8Array(DL_TRESCI_WYZWANIA);
  const d = new DataView(tresc.buffer);
  const az = Math.floor(teraz + ile);
  tresc[0] = WERSJA_WYZWANIA;
  tresc[1] = k + 1;
  d.setUint32(2, Math.floor(az / 2 ** 32));
  d.setUint32(6, az >>> 0);
  tresc.set(crypto.getRandomValues(new Uint8Array(16)), 10);
  const podpis = await podpisWyzwania(sekret, tresc);
  const w = new Uint8Array(DL_TRESCI_WYZWANIA + podpis.length);
  w.set(tresc);
  w.set(podpis, DL_TRESCI_WYZWANIA);
  return b64uZ(w);
}

// Oddaje { ok, cel, az, los } albo { ok: false, blad }. `los` jest tożsamością wyzwania dla listy użytych.
export async function czytajWyzwanie(sekret, w, { teraz = Date.now() } = {}) {
  let u;
  try { u = b64uDo(w); } catch { return { ok: false, blad: NIE_STAD }; }
  if (u.length !== DL_TRESCI_WYZWANIA + 32 || u[0] !== WERSJA_WYZWANIA) return { ok: false, blad: NIE_STAD };
  const tresc = u.slice(0, DL_TRESCI_WYZWANIA);
  if (!rowne(u.slice(DL_TRESCI_WYZWANIA), await podpisWyzwania(sekret, tresc))) return { ok: false, blad: NIE_STAD };
  const cel = CELE_WYZWANIA[tresc[1] - 1];
  if (!cel) return { ok: false, blad: NIE_STAD };
  const d = new DataView(tresc.buffer);
  const az = d.getUint32(2) * 2 ** 32 + d.getUint32(6);
  if (!(az > teraz)) return { ok: false, blad: `wyzwanie się przeterminowało (jest ważne ${Math.round(WYZWANIE_WAZNE_MS / 60000)} minut od naciśnięcia guzika); zacznij od nowa` };
  return { ok: true, cel, az, los: b64uZ(tresc.slice(10)) };
}

// Sesja: imię, do kiedy, podpis. Nic nie trzeba pamiętać po stronie Miejsca, a sekret stoi w ustawieniach
// Workera, nigdy w kodzie ani w danych (zasada 12).
// Sesja NIESIE POŚWIADCZENIE, którym ją otwarto. Bez tego odłożenie poświadczenia (jego słowami: zgubiony
// telefon) nie zamykało wejścia: ciastko dalej czytało i pisało jako właściciel, bo niosło samo imię.
// Odebranie dostępu, które nie odbiera dostępu, jest gorsze niż jego brak - obiecuje coś, czego nie robi.
export async function zrobSesje(sekret, imie, { teraz = Date.now(), ile = SESJA_WAZNA_MS, poswiadczenie = '' } = {}) {
  const az = teraz + ile;
  const tresc = `${b64uZ(T.encode(imie))}.${b64uZ(T.encode(String(poswiadczenie)))}.${az}`;
  return `${tresc}.${b64uZ(await hmac(sekret, tresc))}`;
}
export async function czytajSesje(sekret, zeton, { teraz = Date.now() } = {}) {
  if (typeof zeton !== 'string' || zeton.length > 1024) return null;
  const cz = zeton.split('.');
  // Żeton w starym kształcie (imię, do kiedy, podpis) nie mówi, którym poświadczeniem go otwarto, więc nie da
  // się go unieważnić razem z urządzeniem. Odrzucamy go wprost: koszt to jedno ponowne dotknięcie telefonu.
  if (cz.length !== 4) return null;
  const [imieB, posB, azB, podpis] = cz;
  const tresc = `${imieB}.${posB}.${azB}`;
  let oczekiwany;
  try { oczekiwany = b64uZ(await hmac(sekret, tresc)); } catch { return null; }
  if (!rowne(T.encode(podpis), T.encode(oczekiwany))) return null;
  const az = Number(azB);
  if (!Number.isFinite(az) || az <= teraz) return null;
  let imie, poswiadczenie;
  try {
    imie = new TextDecoder().decode(b64uDo(imieB));
    poswiadczenie = new TextDecoder().decode(b64uDo(posB));
  } catch { return null; }
  if (!poswiadczenie) return null;
  return { imie, do: az, poswiadczenie };
}

// Wszystkie wartości ciastka wejścia z nagłówka, w kolejności, najwyżej cztery. Przeglądarka może wysłać kilka ciastek
// o tej samej nazwie (podrzucone stawia przed prawdziwym, gdy ma dłuższą ścieżkę), więc liczy się to, które przejdzie
// sprawdzenie, a nie to, które przyszło pierwsze (znalezisko 3; `__Host-` wyżej zamyka to po stronie przeglądarki).
export const CIASTEK_NAJWYZEJ = 4;
export const ciastkaZNaglowka = (naglowek) => {
  if (typeof naglowek !== 'string') return [];
  const out = [];
  for (const cz of naglowek.split(';')) {
    const i = cz.indexOf('=');
    if (i > 0 && cz.slice(0, i).trim() === CIASTKO) { out.push(cz.slice(i + 1).trim()); if (out.length >= CIASTEK_NAJWYZEJ) break; }
  }
  return out;
};
export const ciastkoZNaglowka = (naglowek) => ciastkaZNaglowka(naglowek)[0] ?? null;

// Pieczęć poświadczenia (19 XI 2026, niezależny atak, znalezisko 1). Drzwi przybijają ją same, w kroku `zapisz`, po
// ceremonii WebAuthn (origin, nazwa strony, flaga sprawdzenia człowieka), sekretem sesji, na imieniu, identyfikatorze
// i kluczu publicznym. Poświadczenie położone każdą inną drogą (zwykły ruch, propozycja przyjęta jednym kliknięciem,
// wwóz pliku) pieczęci nie ma i drzwi nie otwiera. Przedrostek z ukośnikiem, jak przy wyzwaniu: podpisu pieczęci nie da
// się przełożyć na podpis sesji ani wyzwania, ani odwrotnie.
export async function pieczecPoswiadczenia(sekret, { imie, poswiadczenie, klucz_publiczny }) {
  const pola = [imie, poswiadczenie, klucz_publiczny].map((x) => b64uZ(T.encode(String(x ?? ''))));
  return b64uZ(await hmac(sekret, 'pieczec/1.' + pola.join('.')));
}
export async function pieczecZgodna(sekret, cechy) {
  if (!cechy || typeof cechy.pieczec !== 'string' || !cechy.pieczec) return false;
  let oczekiwana;
  try { oczekiwana = await pieczecPoswiadczenia(sekret, cechy); } catch { return false; }
  return rowne(T.encode(cechy.pieczec), T.encode(oczekiwana));
}
// Skrót identyfikatora poświadczenia. Sesja niesie skrót (43 znaki), nie sam identyfikator: identyfikator bywa długi
// (klucze sprzętowe, poświadczenia nie-rezydentne: do 1023 bajtów), a ucięty w nagłówku przestawał pasować i drzwi
// mówiły "wpuszczone", dając ciastko, które nic nie otwierało (znalezisko 6).
export const skrotPoswiadczenia = async (id) => b64uZ(new Uint8Array(await crypto.subtle.digest('SHA-256', T.encode(String(id)))));
// Co sesja niesie jako "poświadczenie": skrót identyfikatora i pokolenie wyjść. Krok `wyjdz` podbija pokolenie w rzeczy
// poświadczenia, więc żeton skopiowany przed wyjściem przestaje działać (znalezisko 7).
export const posSesji = (skrot, pokolenie) => `${skrot}~${Number.isInteger(pokolenie) && pokolenie >= 0 ? pokolenie : 0}`;
export const czytajPosSesji = (pos) => {
  const m = typeof pos === 'string' ? /^([A-Za-z0-9_-]{43})~(\d{1,9})$/.exec(pos) : null;
  return m ? { skrot: m[1], pokolenie: Number(m[2]) } : null;
};
// SameSite=Strict, bo to ciastko JEST wejściem: żadna obca strona nie ma go wysyłać w naszym imieniu.
export const ciastkoNaglowek = (zeton, { ile = SESJA_WAZNA_MS } = {}) =>
  `${CIASTKO}=${zeton}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ile / 1000)}`;
export const ciastkoKoniec = () => `${CIASTKO}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

// --- sprawdzenie, co przyszło od przeglądarki ----------------------------------------------------------------
const czytajClientData = (bajty, oczekiwanyTyp, wyzwanie, origin) => {
  let c;
  try { c = JSON.parse(new TextDecoder().decode(bajty)); } catch { return 'clientDataJSON nie jest poprawnym JSON'; }
  if (!c || typeof c !== 'object') return 'clientDataJSON nie jest obiektem';
  if (c.type !== oczekiwanyTyp) return `clientDataJSON mówi type: ${c.type}, a tu są drzwi ${oczekiwanyTyp}`;
  if (typeof c.challenge !== 'string' || c.challenge !== wyzwanie) return 'wyzwanie w clientDataJSON jest inne niż to, które wydaliśmy';
  if (c.origin !== origin) return `clientDataJSON mówi origin: ${c.origin}, a te drzwi stoją pod ${origin}`;
  // Gest w cudzej ramce: strona obcego adresu osadza stronę Miejsca i podsuwa właścicielowi guzik. Drzwi otwiera
  // się tylko na własnej stronie, więc ceremonia z `crossOrigin: true` nie przechodzi (WebAuthn, weryfikacja
  // clientDataJSON: crossOrigin ma być fałszem, chyba że strona świadomie chce działać w ramce - my nie chcemy).
  if (c.crossOrigin === true) return 'ten gest odbył się w ramce na cudzej stronie, a te drzwi otwiera się tylko na stronie Miejsca';
  return null;
};

// Założenie poświadczenia. Nie sprawdzamy oświadczenia producenta (attestation): sami jesteśmy stroną, a klucz
// zaufany jest ten, który przyszedł, gdy właściciel BYŁ JUŻ wpuszczony kluczem. To świadomy wybór, nie luka:
// zaufanie bierze się z tego, kto o to poprosił, nie z tego, kto zrobił telefon.
export async function sprawdzZalozenie({ clientDataJSON, authenticatorData, wyzwanie, origin, nazwaStrony }) {
  const cd = czytajClientData(clientDataJSON, 'webauthn.create', wyzwanie, origin);
  if (cd) return { ok: false, blad: cd };
  let a;
  try { a = czytajAuthData(authenticatorData); } catch (e) { return { ok: false, blad: String(e.message || e) }; }
  if (!rowne(a.skrotNazwyStrony, await skrot(T.encode(nazwaStrony)))) return { ok: false, blad: 'authenticatorData jest dla innej nazwy strony niż ta' };
  if (!a.obecny) return { ok: false, blad: 'authenticator nie potwierdził, że ktoś przy nim był' };
  // SPRAWDZENIE CZŁOWIEKA (flaga UV) jest tu wymagane, nie doradzane. Bez niego te drzwi obiecują „moje
  // urządzenie i mój odcisk”, a dają „ktokolwiek, kto trzyma to urządzenie” — czyli każdego, kto je podniesie.
  // Dlatego strona prosi o `userVerification: 'required'`, a Miejsce nie wierzy stronie i patrzy na flagę.
  if (!a.sprawdzony) return { ok: false, blad: 'to urządzenie nie sprawdziło, że to Ty (odcisk, twarz albo PIN); te drzwi wymagają sprawdzenia' };
  if (!a.zPoswiadczeniem || !a.poswiadczenie || !a.poswiadczenie.length) return { ok: false, blad: 'authenticatorData nie niesie poświadczenia' };
  let k;
  try { k = await kluczZCose(a.cose); } catch (e) { return { ok: false, blad: String(e.message || e) }; }
  return { ok: true, poswiadczenie: b64uZ(a.poswiadczenie), kluczPubliczny: b64uZ(k.surowy), licznik: a.licznik, sprawdzony: a.sprawdzony };
}

// Wejście. `licznikZnany` to ostatni widziany licznik tego poświadczenia; wiele authenticatorów (passkey
// Apple) zawsze podaje 0, więc licznik PILNUJE tylko wtedy, gdy kiedyś był większy od zera - inaczej
// odrzucalibyśmy prawdziwe wejścia. Przed powtórzeniem broni jednorazowe wyzwanie, nie licznik.
export async function sprawdzWejscie({ clientDataJSON, authenticatorData, podpis, kluczPubliczny, licznikZnany = 0, wyzwanie, origin, nazwaStrony }) {
  const cd = czytajClientData(clientDataJSON, 'webauthn.get', wyzwanie, origin);
  if (cd) return { ok: false, blad: cd };
  let a;
  try { a = czytajAuthData(authenticatorData); } catch (e) { return { ok: false, blad: String(e.message || e) }; }
  if (!rowne(a.skrotNazwyStrony, await skrot(T.encode(nazwaStrony)))) return { ok: false, blad: 'authenticatorData jest dla innej nazwy strony niż ta' };
  if (!a.obecny) return { ok: false, blad: 'authenticator nie potwierdził, że ktoś przy nim był' };
  if (!a.sprawdzony) return { ok: false, blad: 'to urządzenie nie sprawdziło, że to Ty (odcisk, twarz albo PIN); te drzwi wymagają sprawdzenia' };
  if (licznikZnany > 0 && a.licznik <= licznikZnany) return { ok: false, blad: 'licznik authenticatora nie urósł: to wygląda na powtórzenie starego podpisu' };
  let klucz;
  try { klucz = await crypto.subtle.importKey('raw', b64uDo(kluczPubliczny), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); } catch (e) { return { ok: false, blad: 'zapisany klucz publiczny nie da się wczytać: ' + String(e.message || e) }; }
  let surowy;
  try { surowy = derNaSurowy(podpis); } catch (e) { return { ok: false, blad: String(e.message || e) }; }
  const doPodpisu = new Uint8Array(authenticatorData.length + 32);
  doPodpisu.set(authenticatorData);
  doPodpisu.set(await skrot(clientDataJSON), authenticatorData.length);
  const zgadza = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, klucz, surowy, doPodpisu);
  if (!zgadza) return { ok: false, blad: 'podpis się nie zgadza' };
  return { ok: true, licznik: a.licznik, sprawdzony: a.sprawdzony };
}

// Nazwa strony dla WebAuthn: DOKŁADNY host, nigdy domena nadrzędna (patrz nagłówek tego pliku).
export const nazwaStronyZAdresu = (origin) => new URL(origin).hostname;
