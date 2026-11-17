// Duża treść jako rzecz (18 XI 2026; wiersz 14 listy wyjścia z gruntu, gotowość na wykończenie G7). Status: próba
// (TYMCZASOWE.md).
// Po co: rzecz mogła dotąd nieść tylko adres w sieci. Krój pisma, obraz w notatce, dźwięk czy zrzut świata to bajty,
// których nie ma gdzie trzymać, a stara Jaskinia wpisywała kroje wprost w stronę (238 KB w czterech plikach), czyli
// każda zmiana kroju była wydaniem kodu.
// Jak: bajty leżą w niezmiennym zapisie rodzaju bajty/1 (pierwszy magazyn to zapisy, które jądro już ma; treść zapisu
// to base64, więc jeden plik ma najwyżej NAJWIEKSZY_PLIK bajtów). Rzecz rodzaju plik/1 niesie WSKAZANIE: odcisk zapisu
// (cecha tresc), typ i rozmiar. TREŚĆ PLIKU JEST NIEZMIENNA: nowe bajty to nowy plik, a historię mają tylko nazwa
// i opis. Autor, prawo obszaru i widoczność przychodzą z samego środowiska. Kto wskazuje plik razem z odciskiem
// (np. wartość kroju), dostaje zawsze te same bajty, także wtedy, gdy plik został potem odłożony: ten, kto prowadzi
// tam, gdzie plik leży, nie zmieni ani nie zabierze po cichu tego, co ktoś przyjął.
// Droga bajtów do strony: GET /api/srodowisko/bajty?rzecz=<id>[&odcisk=<zapis>], oczami czytającego. Plik z obszaru,
// którego czytający nie widzi, brzmi jak plik, którego nie ma.
// Czego tu nie ma: magazynu na rzeczy większe niż półtora megabajta (build, model): wymaga osobnej usługi i jej dostępu.

export const NAJWIEKSZY_PLIK = 1500000;                   // bajty jednego pliku (zapis ma limit 2 MB tekstu)
export const NAJWIECEJ_BAJTOW_NA_DOBE = 50 * 1024 * 1024; // suma bajtów przyjętych przez Miejsce w jednej dobie UTC
// Typy z zamkniętej listy. Strony i obrazy, które mogą nieść skrypt (text/html, image/svg+xml), nie są plikami:
// kod wchodzi jako gość, w piaskownicy.
export const TYPY_PLIKOW = {
  'font/woff2': 'krój', 'font/woff': 'krój', 'font/ttf': 'krój', 'font/otf': 'krój',
  'image/png': 'obraz', 'image/jpeg': 'obraz', 'image/webp': 'obraz', 'image/gif': 'obraz', 'image/avif': 'obraz',
  'audio/mpeg': 'dźwięk', 'audio/ogg': 'dźwięk', 'audio/wav': 'dźwięk',
  'application/octet-stream': 'inne',
};
const ID = /^[0-9a-z]{26}$/;
const ZAPIS = /^[0-9a-f]{64}$/;

export function naBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function zBase64(tekst) {
  const s = atob(tekst);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
export const rozmiarZBase64 = (t) => Math.floor(t.length * 3 / 4) - (t.endsWith('==') ? 2 : t.endsWith('=') ? 1 : 0);

// Sprawdzenie rzeczy rodzaju plik/1 przy zapisie (to, czego nie umie sam kształt). Zwraca null albo { blad }.
export function sprawdzPlik(s, rodzaj, cechy, stara = null) {
  if (rodzaj !== 'plik/1') return null;
  if (stara && stara.rodzaj === 'plik/1' && (stara.cechy.tresc !== cechy.tresc || stara.cechy.typ !== cechy.typ || stara.cechy.rozmiar !== cechy.rozmiar))
    return { blad: 'treść pliku jest niezmienna (odcisk, typ i rozmiar): nowe bajty to nowy plik; zmienić można nazwę i opis' };
  if (!Object.hasOwn(TYPY_PLIKOW, cechy.typ)) return { blad: `typ: jeden z: ${Object.keys(TYPY_PLIKOW).join(', ')} (strony i obrazy ze skryptem nie są plikami: kod wchodzi jako gość)` };
  const z = typeof cechy.tresc === 'string' ? s._bajtyZapisu(cechy.tresc) : null;
  if (!z) return { blad: 'tresc: odcisk zapisu z bajtami (64 znaki); zapis powstaje przez POST /api/srodowisko/bajty' };
  const rozmiar = rozmiarZBase64(z.tresc);
  if (cechy.rozmiar !== rozmiar) return { blad: `rozmiar: zapis ma ${rozmiar} bajtów, a rzecz mówi ${JSON.stringify(cechy.rozmiar)}` };
  return null;
}

// Bajty pliku oczami czytającego (`w` to widok z srodowisko.dla). Odcisk, jeśli podany, musi być odciskiem tego pliku;
// plik odłożony oddaje bajty tylko temu, kto zna jego odcisk (czyli temu, kto wskazał go, zanim został odłożony).
export function bajtyDlaCzytajacego(w, id, odcisk = null) {
  if (typeof id !== 'string' || !ID.test(id) || (odcisk !== null && !(typeof odcisk === 'string' && ZAPIS.test(odcisk)))) return { ok: false, status: 400, blad: 'rzecz: identyfikator rzeczy rodzaju plik/1 (26 znaków); odcisk (niewymagany): 64 znaki szesnastkowe' };
  const brak = { ok: false, status: 404, blad: `nie ma pliku ${id}` };
  const rz = w.rzecz(id);
  if (!rz || rz.rodzaj !== 'plik/1') return brak;
  const zapis = rz.cechy.tresc, typ = rz.cechy.typ;
  if (odcisk === null ? rz.odlozone : odcisk !== zapis) return brak;
  const z = w._bajtyZapisu(zapis);
  if (!z || !Object.hasOwn(TYPY_PLIKOW, typ)) return brak;
  return { ok: true, bajty: zBase64(z.tresc), typ, odcisk: zapis, przypiety: odcisk !== null };
}
