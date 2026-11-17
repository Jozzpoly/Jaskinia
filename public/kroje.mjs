// Kroje z bajtów w Miejscu (18 XI 2026; wiersz 14 listy wyjścia z gruntu). Status: próba (TYMCZASOWE.md).
// Wartość kroju może wskazać plik: {rodzina, grubosc?, osie?, plik: {rzecz, odcisk}}. Bajty przychodzą drzwiami
// (GET /api/srodowisko/bajty, wersja przypięta odciskiem) i stają się krojem o własnej nazwie, który działa na
// stronie i na płótnie. Polityka strony (CSP) zamyka kroje z adresów data: i blob:, ale krój zbudowany z bajtów
// pobranych przez fetch przechodzi (pomiar linii wyglądu w Chromium, 17 XI).
// Osie i grubość idą w deskryptorach kroju, bo płótno nie zna font-variation-settings: deskryptor z jedną wartością
// przypina oś (szerokość 118% rysuje dokładnie 118%), więc dla każdego użytego zestawu osi powstaje osobny krój z tych
// samych bajtów. Bez pliku nic się tu nie dzieje: zostaje rodzina z wartości, czyli krój, który urządzenie już ma.

const bajty = new Map();  // odcisk -> obietnica bajtów (jedno pobranie na wersję pliku)
const kroje = new Map();  // odcisk, osie i grubość -> { nazwa, stan: 'laduje' | 'gotowy' | 'blad' }
const skrot = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };

// Rodzina do użycia teraz: krój z bajtów, gdy jest już gotowy, a przed nim zawsze rodzina zapasowa z wartości.
// `czytajBajty(plik)` oddaje obietnicę ArrayBuffer; `naGotowe()` woła twarz, żeby narysowała się nowym krojem.
export function rodzinaKroju(k, { czytajBajty, naGotowe }) {
  if (!k || typeof k.rodzina !== 'string') return '';
  const p = k.plik;
  if (!p || typeof p.rzecz !== 'string' || typeof p.odcisk !== 'string' || typeof FontFace !== 'function' || typeof document === 'undefined' || !document.fonts) return k.rodzina;
  const osie = k.osie && typeof k.osie === 'object' ? Object.keys(k.osie).sort().map((n) => `"${n}" ${Number(k.osie[n])}`).join(', ') : '';
  const klucz = p.odcisk + '|' + osie + '|' + (k.grubosc === undefined ? '' : k.grubosc);
  let wpis = kroje.get(klucz);
  if (!wpis) {
    wpis = { nazwa: 'jk-' + p.odcisk.slice(0, 10) + '-' + skrot(klucz), stan: 'laduje' };
    kroje.set(klucz, wpis);
    if (!bajty.has(p.odcisk)) bajty.set(p.odcisk, Promise.resolve().then(() => czytajBajty(p)));
    bajty.get(p.odcisk).then((b) => {
      // jedna wartość w deskryptorze przypina oś; bez grubości krój przyjmuje każdą, o którą poprosi rysowanie
      const opis = { weight: k.grubosc === undefined ? '1 1000' : String(Math.round(k.grubosc)) };
      if (osie) opis.variationSettings = osie;
      if (k.osie && Number.isFinite(Number(k.osie.wdth))) opis.stretch = Number(k.osie.wdth) + '%';
      const kroj = new FontFace(wpis.nazwa, b, opis);
      return kroj.load().then(() => { document.fonts.add(kroj); wpis.stan = 'gotowy'; naGotowe(); });
    }).catch(() => { wpis.stan = 'blad'; bajty.delete(p.odcisk); });
  }
  return wpis.stan === 'gotowy' ? `"${wpis.nazwa}", ${k.rodzina}` : k.rodzina;
}

// Typ pliku kroju po rozszerzeniu nazwy (do wgrywania z ręki); null, gdy to nie krój.
export const typKroju = (nazwa) => ({ woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' })[String(nazwa).toLowerCase().split('.').pop()] || null;
