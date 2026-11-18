// (skrypt zwykły, nie moduł: strona Miejsca ładuje go znacznikiem <script defer> i czyta przez window.Drzwi)
// Drzwi właściciela po stronie strony: dwa gesty i nic więcej (17 XI 2026, front B, Opus Code).
// „Wejdź dotknięciem” woła przeglądarkę o podpis poświadczeniem, które już tu leży; „Dodaj to urządzenie”
// zakłada nowe, i może to zrobić tylko ten, kto JEST już wpuszczony. Klucz prywatny nigdy nie opuszcza
// urządzenia: na serwer idą same bajty podpisu.
//
// Czego ten plik nie wie: czy jego telefon założy passkey dla tego adresu. Protokół na to pozwala (falsyfikator
// proby/b1-drzwi-passkey, pytanie 2), ale sprawdzi to tylko jego ręka. Dlatego każdy błąd z przeglądarki
// pokazujemy dosłownie - zgadywanie, co się nie udało, byłoby tu najgorszą przysługą.
const b64uZ = (bufor) => btoa(String.fromCharCode(...new Uint8Array(bufor))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDo = (s) => {
  const p = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const umieDotkniecie = () => typeof window !== 'undefined' && !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get);

const zad = async (krok, cialo, naglowki = {}) => {
  const o = await fetch('/api/drzwi/' + krok, {
    method: cialo === undefined ? 'GET' : 'POST',
    headers: { ...(cialo === undefined ? {} : { 'content-type': 'application/json' }), ...naglowki },
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
    credentials: 'same-origin',
  });
  const d = await o.json().catch(() => ({}));
  if (!o.ok || d.ok === false) throw new Error(d.blad || `drzwi odpowiedziały ${o.status}`);
  return d;
};

const stanDrzwi = () => zad('stan');

// Wejście: przeglądarka sama pokazuje, czym można wejść, i sama je odnajduje (discoverable). Miejsce NIE podaje
// listy poświadczeń — wydawało ją każdemu, kto zapukał, także obcemu bez klucza.
async function wejdzDotknieciem() {
  const z = await zad('zacznij', { cel: 'wejdz' });
  // Brak poświadczeń mówią same drzwi (404 w kroku `zacznij`), więc tutaj nie ma czego sprawdzać.
  const p = await navigator.credentials.get({
    publicKey: {
      challenge: b64uDo(z.wyzwanie),
      rpId: z.nazwa_strony,
      timeout: z.wazne_ms,
      // Sprawdzenie człowieka jest WYMAGANE: Miejsce odmówi wejścia bez flagi UV, więc prośba o mniej kończyłaby
      // się dotknięciem telefonu i odmową na końcu. Bez `allowCredentials`: przeglądarka pokazuje swoje własne.
      userVerification: 'required',
    },
  });
  if (!p) throw new Error('przeglądarka nie podała podpisu');
  return zad('wejdz', {
    wyzwanie: z.wyzwanie,
    poswiadczenie: b64uZ(p.rawId),
    clientDataJSON: b64uZ(p.response.clientDataJSON),
    authenticatorData: b64uZ(p.response.authenticatorData),
    podpis: b64uZ(p.response.signature),
  });
}

// Założenie: tylko dla wpuszczonego właściciela, więc `naglowki` nosi jego klucz, jeśli wszedł kluczem.
async function dodajUrzadzenie(nazwa, naglowki = {}) {
  const z = await zad('zacznij', { cel: 'zaloz' }, naglowki);
  const p = await navigator.credentials.create({
    publicKey: {
      challenge: b64uDo(z.wyzwanie),
      rp: { id: z.nazwa_strony, name: 'Jaskinia' },
      // Imię użytkownika jest jego imieniem w Miejscu, nie adresem e-mail: to jest jego Miejsce, nie usługa.
      user: { id: new TextEncoder().encode(z.imie), name: z.imie, displayName: z.imie },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      // `residentKey: 'required'`, bo wejście nie dostaje od Miejsca listy poświadczeń i urządzenie musi umieć
      // odnaleźć swoje samo; `userVerification: 'required'`, bo tego żądają drzwi przy każdym wejściu.
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      attestation: 'none',
      timeout: z.wazne_ms,
      excludeCredentials: (z.juz_znane || []).map((id) => ({ type: 'public-key', id: b64uDo(id) })),
    },
  });
  if (!p) throw new Error('przeglądarka nie założyła poświadczenia');
  if (typeof p.response.getAuthenticatorData !== 'function') throw new Error('ta przeglądarka nie oddaje authenticatorData wprost (getAuthenticatorData); drzwi jej jeszcze nie obsługują - powiedz nam, która to');
  return zad('zapisz', {
    wyzwanie: z.wyzwanie,
    nazwa: nazwa || 'urządzenie',
    clientDataJSON: b64uZ(p.response.clientDataJSON),
    // getAuthenticatorData() oddaje authenticatorData RAZEM z danymi poświadczenia (tam siedzi klucz publiczny).
    // Gdyby przeglądarka tego nie umiała, trzeba by rozpakować CBOR attestationObject - mówimy to wprost,
    // zamiast zostawiać kod, którego nikt nie sprawdził.
    authenticatorData: b64uZ(p.response.getAuthenticatorData()),
  }, naglowki);
}

const wyjdzDrzwiami = () => zad('wyjdz', {});

// Jeden globalny przedmiot, bo strona Miejsca jest zwykłym skryptem, nie modułem.
window.Drzwi = { umieDotkniecie, stanDrzwi, wejdzDotknieciem, dodajUrzadzenie, wyjdzDrzwiami, b64uZ, b64uDo };
