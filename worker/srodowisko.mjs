// Środowisko: cienka warstwa nad jądrem Miejsca (17 XI 2026). Status: próba (TYMCZASOWE.md).
// Jądro (miejsce.mjs) zna zapis, akt i głowę i nie wie, czym jest karta ani projekt. Ta warstwa dokłada to, czego
// potrzeba, żeby Jaskinia rosła cudzą ręką bez zmiany kodu:
//   - rzecz: tożsamość (głowa `rzecz:<id>`) i jej kolejne zapisy; rodzaj z pokoleniem (`projekt/1`);
//   - kształt: opis rodzaju jest rzeczą rodzaju `ksztalt/1`, czyli daną. Nowy rodzaj dokłada się ruchem;
//   - obszar: miejsce z ustawieniami (ile wolno agentom, ile uwagi, kto widzi, kto układa); obszar leży w obszarze;
//   - prawo do skutku liczone z danych: ten sam ruch daje skutek, propozycję albo odmowę zależnie od obszaru;
//   - propozycja z cyklem życia (czeka, przyjęta, odrzucona, wycofana);
//   - odkładanie i przywracanie rzeczy oraz cofanie do wcześniejszej wersji (nic nie znika, wszystko jest nową wersją);
//   - spis rzeczy i odniesień liczony z dziennika (tabele `rzeczy` i `odniesienia` da się odbudować z głów).
// Słowa: Miejsce to całość; obszar to węzeł z ustawieniami; cecha to pole kształtu (nazwy za Opusem czatu, 17 XI).
// Sprawdzanie jest przy zapisie, nie przy czytaniu: nieznaną cechę wolno i zostaje zachowana, niepoprawną odbijają
// drzwi ze zdaniem, co jest nie tak (falsyfikator Opusa Code do własnego prawa 1).
//
// Druga noc (17 XI, po niezależnym ataku; plan budowy, par. 0b): sprawdzenie treści i prawo do ruchu są rozdzielone
// (`_sprawdzTresc` nie wie, kto pyta; `ocen` nie wie, czy treść jest poprawna), prawo liczy się w obszarze źródłowym
// i docelowym, a propozycję przyjmuje tylko ten, kto sam mógłby zrobić ten ruch ze skutkiem. Wszystkie zmiany idą
// jedną kolejką, więc ruch nie przeplata się z innym ruchem.
import { poprawneImie, skrot } from './miejsce.mjs';
import { PRZEDROSTEK_GOSCIA } from './klucze.mjs';
import { opKlienta } from './ksztalty.mjs';
import { sprawdzUstawienie, POKRETLO_ZESTAWOW } from './ustawienia.mjs';

export const SRODOWISKO = 'srodowisko-1';
export const CZYTELNIK_PODGLADU = 'podglad'; // imię czytającego bez klucza na podglądzie; uczestnikiem jest tylko tam
export const AUTOMAT = 'srodowisko'; // uczestnik, którym środowisko samo zasiewa swoje rzeczy; imię zastrzeżone
// Trzeci parametr dróg zapisu to ślad ciała (napis) albo, przy ruchu z okna, {slad, przez}: ślad i imię tego, kto
// otworzył okno, z którego pisze gość.
const sladZ = (x) => (x && typeof x === 'object' ? x.slad : x) ?? null;
const przezZ = (x) => (x && typeof x === 'object' && typeof x.przez === 'string' ? x.przez : null);

const RODZAJ = /^[a-z][a-z0-9_.-]{0,79}\/[1-9][0-9]{0,5}$/;
const RODZAJ_LUB_NAZWA = /^[a-z][a-z0-9_.-]{0,79}(\/[1-9][0-9]{0,5})?$/;
const ID = /^[0-9a-z]{26}$/;
const ZAPIS = /^[0-9a-f]{64}$/;
const GEST = /^[A-Za-z0-9_-]{8,24}$/;
// Ile rzeczy rusza jedna czynność zbiorcza (cofnięcie gestu, powrót do zapisanego układu).
export const NAJWIECEJ_W_GESCIE = 1000;
const CECHA = /^[a-z][a-z0-9_]{0,39}$/;
const ALFABET = '0123456789abcdefghjkmnpqrstvwxyz';

export const TYPY = {
  tekst: 'napis',
  liczba: 'liczba skończona',
  'tak-nie': 'true albo false',
  czas: 'chwila w zapisie ISO 8601, np. 2026-11-17T02:30:00Z albo sama data 2026-11-17',
  adres: 'adres http albo https',
  rzecz: 'identyfikator innej rzeczy (26 znaków); w opisie cechy można podać `rodzaj`, którego ta rzecz ma być',
  zapis: 'identyfikator niezmiennego zapisu (64 znaki szesnastkowe), np. kodu gościa',
  lista: 'lista wartości jednego typu; opis cechy podaje typ elementów w `z`',
  wybor: 'jedna z wartości wymienionych w `wartosci`',
  dowolne: 'dowolna wartość JSON; środowisko jej nie sprawdza',
};
// Typy, które mogą być częścią klucza rzeczy (tożsamości liczonej z cech): tylko wartości proste.
const TYPY_KLUCZA = ['tekst', 'liczba', 'tak-nie', 'czas', 'adres', 'rzecz', 'zapis', 'wybor'];
export const STOPNIE = ['nic', 'proponowac', 'porzadkowac', 'prowadzic'];
export const UWAGI = ['cisza', 'skrot', 'znak', 'budzi'];
export const WIDZI = ['wlasciciel', 'uczestnicy', 'wszyscy'];
export const UKLADA = ['reka', 'regula', 'agent'];
export const USTAWIENIA = { ile_wolno: STOPNIE, uwaga: UWAGI, widzi: WIDZI, uklada: UKLADA };
export const DOMYSLNE = { ile_wolno: 'proponowac', uwaga: 'znak', widzi: 'uczestnicy', uklada: 'reka' };
export const ROLE = ['wlasciciel', 'agent', 'automat'];
// Rodzaje, których kształt i rzeczy trzymają całość w ryzach: zmienia je tylko właściciel.
// Rodzaje, które środowisko rozumie samo: kształt ich następnego pokolenia też ustala tylko właściciel.
const RODZAJE_SRODOWISKA = ['ksztalt', 'obszar', 'uczestnik', 'propozycja', 'poswiadczenie', 'pokretlo', 'wartosc', 'zestaw'];
const KSZTALTY_RDZENIA = ['ksztalt/1', 'obszar/1', 'uczestnik/1', 'propozycja/1'];
// Ile propozycji jednego uczestnika może czekać naraz: lista "czeka na właściciela" ma zostać listą, nie zalewem.
export const NAJWIECEJ_CZEKAJACYCH = 20;
// Co da się zrobić z rzeczą jednym ruchem i jak nazywa się skutek.
const SKUTKI = { poloz: 'polozone', odloz: 'odlozone', przywroc: 'przywrocone', cofnij: 'cofniete' };

const blad = (status, tekst, extra = {}) => ({ ok: false, status, blad: tekst, ...extra });

export function noweId() {
  const b = new Uint8Array(17);
  crypto.getRandomValues(b);
  let bity = 0n;
  for (const x of b) bity = (bity << 8n) | BigInt(x);
  let s = '';
  for (let i = 0; i < 26; i++) { s = ALFABET[Number(bity & 31n)] + s; bity >>= 5n; }
  return s;
}

// Identyfikator wyliczony z tego, kto i jaką czynnością coś zakłada: ponowienie tej samej czynności (ten sam op)
// trafia w tę samą rzecz, więc nic nie powstaje dwa razy.
export async function idZ(...czesci) {
  let bity = BigInt('0x' + (await skrot(czesci.map(String).join('|'))).slice(0, 34));
  let s = '';
  for (let i = 0; i < 26; i++) { s = ALFABET[Number(bity & 31n)] + s; bity >>= 5n; }
  return s;
}

// Szybki odcisk bez kryptografii (FNV-1a, 32 bity): tylko do sprawdzenia "czy ziarno w kodzie się zmieniło".
export function szybkiOdcisk(tekst) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const nazwaRodzaju = (r) => String(r).split('/')[0];
const typCechy = (def) => (typeof def === 'string' ? def : def && def.typ);

// Treść rzeczy w zapisie. Kolejność pól jest stała, bo z treści liczy się identyfikator zapisu.
// Rzecz, która z natury należy do innej (kształt mówi lezy_z), nie ma własnego obszaru: DZISIEJSZY obszar zawsze
// wynika z rzeczy wskazanej cechą (obszar_z), a nie z tego, co stoi w zapisie. Pole obszar mówi w jej zapisie co innego:
// gdzie rzecz leżała, GDY TEN ZAPIS POWSTAŁ (znacznik wtedy). Bez tego każdy strażnik historii widział dawną wersję
// takiej rzeczy w obszarze głównym, więc położenia, wartości i zapisane układy z czasu, gdy ich widok albo zasięg leżał
// w obszarze zamkniętym, wychodziły na jaw, gdy tylko właściciel przeniósł go do jawnego (niezależny atak, 18 XI 2026).
// Zapis takiej rzeczy sprzed tej poprawki (obszar_z bez znacznika) nie wie, gdzie rzecz leżała: zob. obszar_nieznany.
function trescRzeczy({ obszar, cechy, odlozone = false, powod = null, zNatury = null }) {
  return JSON.stringify({ obszar: obszar ?? null, ...(zNatury ? { obszar_z: zNatury, wtedy: 1 } : {}), cechy, ...(odlozone ? { odlozone: true, ...(powod ? { powod } : {}) } : {}) });
}
// Czy zapis jest dawnym zapisem rzeczy leżącej z natury, który nie mówi, gdzie rzecz wtedy leżała.
const obszarNieznany = (t) => typeof t.obszar_z === 'string' && t.wtedy !== 1;

// Tekst do szukania: wszystkie napisy z cech, małymi literami (po polsku), najwyżej 4000 znaków.
function doSzukania(cechy) {
  const cz = [];
  const idz = (w, gl) => {
    if (gl > 4 || cz.length > 400) return;
    if (typeof w === 'string') cz.push(w.length > 600 ? w.slice(0, 600) : w);
    else if (Array.isArray(w)) for (const x of w) idz(x, gl + 1);
    else if (w && typeof w === 'object') for (const x of Object.values(w)) idz(x, gl + 1);
  };
  idz(cechy, 0);
  return cz.join(' \n ').toLocaleLowerCase('pl').slice(0, 4000);
}

// Czy to chwila, która istnieje: zapis ISO 8601 z prawdziwym dniem miesiąca (30 lutego odpada).
function poprawnyCzas(w) {
  if (typeof w !== 'string' || w.length > 40) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(w);
  if (!m || Number.isNaN(Date.parse(w))) return false;
  const [r, mi, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mi >= 1 && mi <= 12 && d >= 1 && d <= new Date(Date.UTC(r, mi, 0)).getUTCDate();
}

// Adres http albo https, bez białych znaków i znaków sterujących. Wystawione, żeby ten, kto przynosi adresy
// z zewnątrz (obserwator faktów), sprawdzał je tą samą regułą, a nie jej kopią.
export function poprawnyAdres(w) {
  if (typeof w !== 'string' || w.length > 2000 || /[\s\u0000-\u001f\u007f]/.test(w) || !/^https?:\/\//i.test(w)) return false;
  try { const u = new URL(w); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

// Sprawdzenie surowej wartości, zanim cokolwiek ją obejrzy: nie za głęboka i bez liczb, których JSON nie umie zapisać
// (1e999 po wczytaniu jest nieskończonością, a przy zapisie po cichu stałoby się null).
export function wadaSurowej(w, glebokosc = 0) {
  if (typeof w === 'number') return Number.isFinite(w) ? null : 'jest w niej liczba poza zakresem (np. 1e999); JSON takiej nie zapisze';
  if (!w || typeof w !== 'object') return null;
  if (glebokosc >= 32) return 'jest zagnieżdżona głębiej niż na 32 poziomy';
  for (const x of Array.isArray(w) ? w : Object.values(w)) { const b = wadaSurowej(x, glebokosc + 1); if (b) return b; }
  return null;
}

// --- sprawdzanie wartości względem opisu cechy ------------------------------------------------------------------
// `maRzecz(id)` oddaje rzecz albo null; `maZapis(id)` oddaje rodzaj zapisu albo null.
function sprawdzWartosc(def, w, sciezka, maRzecz, maZapis) {
  const typ = typCechy(def);
  switch (typ) {
    case 'tekst': return typeof w !== 'string' ? `${sciezka}: ma być napisem` : (w.length <= 200000 ? null : `${sciezka}: napis ma ${w.length} znaków, a może mieć najwyżej 200000`);
    case 'liczba': return typeof w === 'number' && Number.isFinite(w) ? null : `${sciezka}: ma być liczbą`;
    case 'tak-nie': return typeof w === 'boolean' ? null : `${sciezka}: ma być true albo false`;
    case 'czas': return poprawnyCzas(w) ? null : `${sciezka}: ma być istniejącą chwilą w zapisie ISO 8601 (np. 2026-11-17T02:30:00Z albo 2026-11-17)`;
    case 'adres': return poprawnyAdres(w) ? null : `${sciezka}: ma być adresem http albo https, bez spacji i znaków sterujących`;
    case 'rzecz': {
      if (typeof w !== 'string' || !ID.test(w)) return `${sciezka}: ma być identyfikatorem rzeczy (26 znaków)`;
      const r = maRzecz(w);
      if (!r) return `${sciezka}: nie ma rzeczy ${w}`;
      const chce = typeof def === 'object' && def.rodzaj;
      if (chce && r.rodzaj !== chce && nazwaRodzaju(r.rodzaj) !== chce) return `${sciezka}: rzecz ${w} jest rodzaju ${r.rodzaj}, a ma być ${chce}`;
      return null;
    }
    case 'zapis': {
      const rz = typeof w === 'string' && ZAPIS.test(w) ? maZapis(w) : null;
      if (!rz) return `${sciezka}: ma być identyfikatorem istniejącego zapisu (64 znaki szesnastkowe)`;
      const chce = typeof def === 'object' && def.rodzaj;
      if (chce && rz !== chce && nazwaRodzaju(rz) !== chce) return `${sciezka}: zapis ${w.slice(0, 12)}… jest rodzaju ${rz}, a ma być ${chce}`;
      return null;
    }
    case 'lista': {
      if (!Array.isArray(w) || w.length > 2000) return `${sciezka}: ma być listą (najwyżej 2000 elementów)`;
      const z = typeof def === 'object' ? def.z : null;
      for (let i = 0; i < w.length; i++) { const b = sprawdzWartosc(z, w[i], `${sciezka}[${i}]`, maRzecz, maZapis); if (b) return b; }
      return null;
    }
    case 'wybor': return typeof def === 'object' && Array.isArray(def.wartosci) && def.wartosci.includes(w) ? null : `${sciezka}: ma być jedną z wartości: ${((def && def.wartosci) || []).join(', ')}`;
    case 'dowolne': return null;
    default: return `${sciezka}: kształt podaje nieznany typ ${JSON.stringify(typ)}`;
  }
}

function sprawdzDefinicje(nazwa, def, glebokosc = 0) {
  if (typeof def === 'string') def = { typ: def };
  if (!def || typeof def !== 'object' || Array.isArray(def)) return `cecha ${nazwa}: opis ma być obiektem z polem typ`;
  if (!Object.hasOwn(TYPY, def.typ)) return `cecha ${nazwa}: nieznany typ ${JSON.stringify(def.typ)}; znane typy: ${Object.keys(TYPY).join(', ')}`;
  if ('opis' in def && typeof def.opis !== 'string') return `cecha ${nazwa}: opis ma być napisem`;
  if ('wymagana' in def && typeof def.wymagana !== 'boolean') return `cecha ${nazwa}: wymagana ma być true albo false`;
  if ((def.typ === 'rzecz' || def.typ === 'zapis') && 'rodzaj' in def && !(typeof def.rodzaj === 'string' && RODZAJ_LUB_NAZWA.test(def.rodzaj))) return `cecha ${nazwa}: rodzaj ma być nazwą rodzaju, np. projekt/1 albo samo projekt`;
  if (def.typ === 'wybor' && !(Array.isArray(def.wartosci) && def.wartosci.length && def.wartosci.every((x) => typeof x === 'string'))) return `cecha ${nazwa}: wybor potrzebuje niepustej listy napisów w wartosci`;
  if (def.typ === 'lista') {
    if (!('z' in def)) return `cecha ${nazwa}: lista potrzebuje typu elementów w polu z (np. "tekst" albo {"typ":"rzecz","rodzaj":"projekt/1"})`;
    if (glebokosc >= 3) return `cecha ${nazwa}: lista w liście w liście to za głęboko; użyj typu dowolne`;
    const b = sprawdzDefinicje(nazwa + '[]', def.z, glebokosc + 1);
    if (b) return b;
  }
  return null;
}

// Kształt kształtu jest wpisany tutaj: to jedyna rzecz o kształtach, którą warstwa wie sama z siebie.
export function sprawdzKsztalt(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['kształt: cechy mają być obiektem'];
  const b = [];
  if (typeof c.dla !== 'string' || !RODZAJ.test(c.dla)) b.push('dla: nazwa rodzaju z pokoleniem, np. postac/1 (małe litery, cyfry, kropka, - i _, potem /numer)');
  if (typeof c.opis !== 'string' || !c.opis.trim()) b.push('opis: jedno zdanie, czym jest rzecz tego rodzaju (napis, wymagany)');
  if (!c.cechy || typeof c.cechy !== 'object' || Array.isArray(c.cechy)) b.push('cechy: obiekt {nazwa cechy: {typ, opis, wymagana}}; może być pusty {}');
  else {
    for (const [n, def] of Object.entries(c.cechy)) {
      if (!CECHA.test(n)) { b.push(`cecha ${JSON.stringify(n)}: nazwa z małych liter, cyfr i _, do 40 znaków`); continue; }
      const e = sprawdzDefinicje(n, def);
      if (e) b.push(e);
    }
    if ('tytul' in c && !(typeof c.tytul === 'string' && Object.hasOwn(c.cechy, c.tytul))) b.push('tytul: nazwa jednej z cech, tej, która jest nazwą rzeczy');
    if ('klucz' in c) {
      if (!Array.isArray(c.klucz) || !c.klucz.length || c.klucz.length > 4 || new Set(c.klucz).size !== c.klucz.length) b.push('klucz: lista od jednej do czterech różnych nazw cech, z których liczy się tożsamość rzeczy');
      else for (const n of c.klucz) {
        const def = typeof n === 'string' && Object.hasOwn(c.cechy, n) ? c.cechy[n] : null;
        if (!def) { b.push(`klucz: nie ma cechy ${JSON.stringify(n)}`); continue; }
        if (!TYPY_KLUCZA.includes(typCechy(def))) b.push(`klucz: cecha ${n} ma typ ${typCechy(def)}, a w kluczu mogą być tylko: ${TYPY_KLUCZA.join(', ')}`);
        if (!(typeof def === 'object' && def.wymagana === true)) b.push(`klucz: cecha ${n} musi być wymagana`);
      }
    }
  }
  if ('uklad' in c && typeof c.uklad !== 'boolean') b.push('uklad: true albo false (true: rzeczy tego rodzaju to układanie, nie treść)');
  if ('lezy_z' in c) {
    const def = typeof c.lezy_z === 'string' && c.cechy && typeof c.cechy === 'object' && Object.hasOwn(c.cechy, c.lezy_z) ? c.cechy[c.lezy_z] : null;
    if (!def || typCechy(def) !== 'rzecz' || !(typeof def === 'object' && def.wymagana === true)) b.push('lezy_z: nazwa wymaganej cechy typu rzecz; rzecz tego rodzaju leży zawsze w tym samym obszarze co rzecz, którą ta cecha wskazuje');
  }
  return b;
}

// Czy nowa postać kształtu nie psuje rzeczy, które już pod nim leżą (prawo 2: pokolenie znaczy zawsze to samo).
// Wolno: dołożyć cechę niewymaganą, zmienić opisy, poszerzyć wybór, zdjąć wymagalność. Reszta to następne pokolenie.
export function niezgodnosciKsztaltu(stary, nowy) {
  const b = [];
  const sc = stary.cechy || {}, nc = nowy.cechy || {};
  const def = (d) => (typeof d === 'string' ? { typ: d } : d || {});
  for (const [n, d0] of Object.entries(sc)) {
    if (!Object.hasOwn(nc, n)) { b.push(`cecha ${n} zniknęła`); continue; }
    const a = def(d0), z = def(nc[n]);
    if (a.typ !== z.typ) { b.push(`cecha ${n} zmieniła typ z ${a.typ} na ${z.typ}`); continue; }
    if ((a.typ === 'rzecz' || a.typ === 'zapis') && z.rodzaj && z.rodzaj !== a.rodzaj) b.push(`cecha ${n} wymaga teraz rodzaju ${z.rodzaj}`);
    if (a.typ === 'lista' && JSON.stringify(a.z) !== JSON.stringify(z.z)) b.push(`cecha ${n} zmieniła typ elementów listy`);
    if (a.typ === 'wybor' && !(a.wartosci || []).every((x) => (z.wartosci || []).includes(x))) b.push(`cecha ${n} straciła którąś z dotychczasowych wartości`);
    if (z.wymagana === true && a.wymagana !== true) b.push(`cecha ${n} stała się wymagana`);
  }
  for (const [n, d0] of Object.entries(nc)) if (!Object.hasOwn(sc, n) && def(d0).wymagana === true) b.push(`nowa cecha ${n} jest wymagana`);
  if ((stary.uklad === true) !== (nowy.uklad === true)) b.push('zmieniło się, czy rodzaj jest układem');
  if ((stary.lezy_z || null) !== (nowy.lezy_z || null)) b.push('zmieniło się, od której rzeczy rodzaj bierze obszar');
  if (JSON.stringify(stary.klucz || null) !== JSON.stringify(nowy.klucz || null)) b.push('zmienił się klucz, czyli tożsamość rzeczy');
  return b;
}

export function sprawdzCechy(ksztalt, cechy, maRzecz, maZapis) {
  const bledy = [];
  const defs = ksztalt.cechy || {};
  for (const [n, d0] of Object.entries(defs)) {
    const def = typeof d0 === 'string' ? { typ: d0 } : d0;
    if (!Object.hasOwn(cechy, n) || cechy[n] === null) { if (def.wymagana) bledy.push(`${n}: cecha wymagana, a jej nie ma`); continue; }
    const e = sprawdzWartosc(def, cechy[n], n, maRzecz, maZapis);
    if (e) bledy.push(e);
  }
  const nieznane = Object.keys(cechy).filter((n) => !Object.hasOwn(defs, n));
  return { bledy, nieznane };
}

// Identyfikatory rzeczy wskazane w cechach, według kształtu (do tabeli odniesień).
function odniesieniaZCech(ksztalt, cechy) {
  const wynik = [];
  if (!ksztalt) return wynik;
  const zbierz = (def, w, nazwa) => {
    const typ = typCechy(def);
    if (typ === 'rzecz' && typeof w === 'string' && ID.test(w)) wynik.push([nazwa, w]);
    else if (typ === 'lista' && Array.isArray(w)) for (const x of w) zbierz(def.z, x, nazwa);
  };
  for (const [n, def] of Object.entries(ksztalt.cechy || {})) if (Object.hasOwn(cechy, n)) zbierz(def, cechy[n], n);
  return wynik;
}

// Jedna przegródka przekroju spisu: rodzaj, obszar (albo brak) i to, czy rzeczy są odłożone.
function doliczPrzekroj(mapa, rodzaj, obszar, odlozone, ile) {
  const klucz = rodzaj + '\n' + (obszar ?? '') + '\n' + (odlozone ? 1 : 0);
  const w = mapa.get(klucz) || { rodzaj, obszar: obszar ?? null, odlozone: odlozone ? 1 : 0, ile: 0 };
  w.ile += ile;
  if (w.ile > 0) mapa.set(klucz, w); else mapa.delete(klucz);
}

const SPIS_SCHEMAT = [
  `CREATE TABLE IF NOT EXISTS rzeczy (id TEXT PRIMARY KEY, rodzaj TEXT NOT NULL, obszar TEXT, zapis TEXT NOT NULL, akt INTEGER NOT NULL,
     numer INTEGER NOT NULL DEFAULT 1, odlozone INTEGER NOT NULL DEFAULT 0, szukane TEXT NOT NULL DEFAULT '',
     utworzyl TEXT NOT NULL, utworzono INTEGER NOT NULL, zmienil TEXT NOT NULL, zmieniono INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS rzeczy_rodzaj ON rzeczy (rodzaj)`,
  `CREATE INDEX IF NOT EXISTS rzeczy_obszar ON rzeczy (obszar)`,
  // Pytanie "co zmieniło się po akcie N" zadaje każda otwarta strona po każdej zmianie: bez indeksu czytałoby cały spis.
  `CREATE INDEX IF NOT EXISTS rzeczy_akt ON rzeczy (akt)`,
  `CREATE TABLE IF NOT EXISTS odniesienia (od TEXT NOT NULL, cecha TEXT NOT NULL, cel TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS odniesienia_cel ON odniesienia (cel)`,
  `CREATE INDEX IF NOT EXISTS odniesienia_od ON odniesienia (od)`,
  // Przekrój spisu (ile rzeczy którego rodzaju leży w którym obszarze, osobno odłożone) utrwalony w małej tabeli.
  // Obiekt Miejsca zasypia po kilku sekundach bez ruchu i traci pamięć: bez tej tabeli pierwsze czytanie opisu po
  // każdym obudzeniu liczyło cały spis od nowa (zmierzone 17 XI: 1675 wierszy przy 647 rzeczach).
  `CREATE TABLE IF NOT EXISTS przekroj (rodzaj TEXT NOT NULL, obszar TEXT NOT NULL, odlozone INTEGER NOT NULL, ile INTEGER NOT NULL, PRIMARY KEY (rodzaj, obszar, odlozone)) WITHOUT ROWID`,
];

export class Srodowisko {
  constructor(rdzen) {
    this.r = rdzen;
    const sql = rdzen.sql;
    // Spis jest pochodną głów i dziennika. Gdy jego układ jest sprzed dzisiejszych kolumn, wyrzucamy go i liczymy od nowa.
    const kolumny = sql.exec(`PRAGMA table_info(rzeczy)`).toArray().map((k) => k.name);
    const stary = kolumny.length > 0 && !['numer', 'odlozone', 'szukane'].every((k) => kolumny.includes(k));
    if (stary) { sql.exec(`DROP TABLE rzeczy`); sql.exec(`DROP TABLE IF EXISTS odniesienia`); }
    for (const s of SPIS_SCHEMAT) sql.exec(s);
    this._kolejka = Promise.resolve();
    this._role = { nr: -1, mapa: new Map() };
    if (stary) this.przebuduj();
    // Spis sprzed tabeli przekroju: liczymy ją raz z tego, co już leży.
    else if (!sql.exec(`SELECT 1 AS jest FROM przekroj LIMIT 1`).toArray().length && sql.exec(`SELECT 1 AS jest FROM rzeczy LIMIT 1`).toArray().length) this._zbudujPrzekroj();
    // Spis sprzed chwili, w której obszar rzeczy z regułą lezy_z zaczął wynikać z rzeczy wskazanej: wyrównujemy go raz.
    // '3' (17 XI 2026): obszar z natury liczony po całym łańcuchu, a wartość włączająca zestawy wskazuje je w odniesieniach.
    if (rdzen.meta('spis:lezy_z') !== '3') {
      for (const rz of this.wszystkie({ rodzaj: 'wartosc/1', odlozone: 'razem' })) this._odniesienia(rz.id, rz.rodzaj, rz.cechy, this.ksztaltDla(rz.rodzaj));
      this.wyrownajZNatury();
      rdzen.ustawMeta('spis:lezy_z', '3');
    }
  }

  _zbudujPrzekroj() {
    this.r.sql.exec(`DELETE FROM przekroj`);
    this.r.sql.exec(`INSERT INTO przekroj (rodzaj, obszar, odlozone, ile) SELECT rodzaj, COALESCE(obszar, ''), odlozone, COUNT(*) FROM rzeczy NOT INDEXED GROUP BY rodzaj, COALESCE(obszar, ''), odlozone`);
    this._prz = null;
  }

  q(z, ...p) { return this.r.q(z, ...p); }
  get wlasciciel() { return this.r.wlasciciel; }
  ostatniNr() { return this.r.ostatniNr(); }

  // Wynik policzony z danych, pamiętany do następnego aktu: ten sam numer ostatniego aktu znaczy te same rzeczy.
  // To, co stąd wraca, dostają wszyscy pytający aż do następnej zmiany, więc nie wolno tego zmieniać w miejscu.
  pamietaj(klucz, licz) {
    const nr = this.ostatniNr();
    if (!this._pam || this._pam.nr !== nr) this._pam = { nr, mapa: new Map() };
    if (!this._pam.mapa.has(klucz)) this._pam.mapa.set(klucz, licz());
    return this._pam.mapa.get(klucz);
  }

  // Wszystkie zmiany idą jedna po drugiej. Skróty liczą się asynchronicznie, więc bez kolejki dwa ruchy mogłyby
  // przeczytać ten sam stan; z kolejką ruch widzi zawsze skutek poprzedniego.
  _wKolejce(fn) {
    const p = this._kolejka.then(() => fn());
    this._kolejka = p.then(() => {}, () => {});
    return p;
  }

  // --- czytanie ------------------------------------------------------------------------------------------------
  _zWiersza(w) {
    let t = {};
    try { t = JSON.parse(w.tresc); } catch { /* treść nie jest JSON-em: zostaje pusta, a rzecz widoczna */ }
    if (!t || typeof t !== 'object') t = {};
    return { id: w.id, rodzaj: w.rodzaj, obszar: w.obszar ?? null, cechy: t.cechy && typeof t.cechy === 'object' && !Array.isArray(t.cechy) ? t.cechy : {},
      wersja: w.akt, numer: w.numer, ...(w.odlozone ? { odlozone: true, ...(typeof t.powod === 'string' ? { powod: t.powod } : {}) } : {}), zapis: w.zapis,
      utworzyl: w.utworzyl, utworzono: new Date(w.utworzono).toISOString(), zmienil: w.zmienil, zmieniono: new Date(w.zmieniono).toISOString() };
  }

  rzecz(id, { dla = undefined } = {}) {
    if (typeof id !== 'string' || !ID.test(id)) return null;
    const w = this.q(`SELECT r.*, z.tresc FROM rzeczy r JOIN zapisy z ON z.id = r.zapis WHERE r.id = ?`, id)[0];
    if (!w) return null;
    // Rzecz z obszaru, którego ten czytający nie widzi, jest dla niego tym samym, czym rzecz nieistniejąca:
    // "nie ma" i "nie dla ciebie" mają brzmieć tak samo, inaczej sam adres zdradza, że coś tam jest.
    if (dla !== undefined) {
      const zle = this._niewidoczneDla(dla);
      // ...i obszar, do którego nie ma wstępu, nie odpowiada też pod własnym adresem.
      if (zle && (zle.includes(w.obszar ?? null) || zle.includes(w.id))) return null;
    }
    return this._zWiersza(w);
  }

  // Wybór rzeczy: rodzaj (z pokoleniem albo sama nazwa), obszar, wartości cech (`gdzie`), tekst (`szukaj`) i to,
  // czy pokazywać odłożone (domyślnie nie; 'tak': tylko odłożone; 'razem': jedne i drugie).
  // --- widoczność z danych (17 XI 2026, Opus Code, front B) ---------------------------------------------------
  // Ustawienie `widzi` obszaru było do dziś nazwą bez mechanizmu: czytanie było albo całe otwarte (podgląd), albo
  // całe zamknięte kluczem. Tutaj zaczyna znaczyć to, co mówi: `wszyscy` widzi też zwiedzający bez klucza,
  // `uczestnicy` tylko ktoś z kluczem, `wlasciciel` tylko właściciel. Dziedziczenie bierze `ustawienie()`, więc
  // obszar w obszarze ma to samo prawo co rodzic, dopóki nie powie inaczej.
  //
  // DLACZEGO PARAMETREM, A NIE DOMYŚLNIE: te same zapytania zadaje sobie samo środowisko (kształty, uczestnicy,
  // obszary, obserwator). Gdyby filtr działał zawsze, jądro przestałoby widzieć własne rzeczy. Dlatego filtruje
  // się tylko wtedy, gdy ktoś poda `dla`, a robi to warstwa drzwi — i pilnuje tego sprawdzian, który wylicza
  // wszystkie trasy czytające i nie przepuszcza nowej, która o tym zapomni.
  // Jedno miejsce, w którym warstwa drzwi zakłada okulary czytającego. Zwraca widok tego samego środowiska,
  // w którym `spis`, `wszystkie`, `ile`, `rzecz` i `wersja` same wiedzą, dla kogo liczą; wszystko inne idzie
  // bez zmian do oryginału, a środowisko w środku dalej widzi siebie całe.
  // Dlaczego widok, a nie parametr przy każdej trasie: tras czytających jest kilkanaście i będą dochodzić.
  // Parametr trzeba pamiętać za każdym razem; okulary zakłada się raz, na początku żądania.
  dla(kto) {
    const cel = this;
    const zFiltrem = {
      spis: (f = {}) => cel.spis({ ...f, dla: kto }),
      wszystkie: (f = {}) => cel.wszystkie({ ...f, dla: kto }),
      ile: (f = {}) => cel.ile({ ...f, dla: kto }),
      rzecz: (id, o = {}) => cel.rzecz(id, { ...o, dla: kto }),
      // Dawna wersja niesie obszar, w którym rzecz WTEDY leżała. Dzisiejsza widoczność nie wystarcza: rzecz
      // przeniesiona z obszaru zamkniętego do jawnego inaczej publikowałaby całą swoją przeszłość przy okazji
      // przeniesienia, a publikacja ma być świadomym gestem (znalezisko Fable, atak na tę granicę, 17 XI 2026).
      // Sam fakt, że akt był, zostaje widoczny: numery aktów i tak są słyszalne, tak samo jak w dzienniku.
      wersja: (id, akt) => {
        if (cel.rzecz(id, { dla: kto }) === null) return null;
        const w = cel.wersja(id, akt);
        if (!w) return null;
        const zle = cel._niewidoczneDla(kto);
        if (!zle || !zle.length) return w;
        // wersja, która nie wie, gdzie leżała (rzecz z natury, zapis sprzed 18 XI 2026), nie istnieje dla nikogo, przed kim
        // cokolwiek jest zamknięte: nie da się wykluczyć, że leżała właśnie tam
        return w.obszar_nieznany || zle.includes(w.obszar ?? null) ? null : w;
      },
      // Propozycje i prośby wychodzą z `wszystkie`, ale WOŁANE NA CELU, więc okulary ich nie dotyczyły: prośba
      // z zamkniętego obszaru stała w "co czeka" z identyfikatorem i treścią (ta sama usterka co niżej w liczbach).
      czeka: () => ({
        propozycje: cel.wszystkie({ rodzaj: 'propozycja/1', gdzie: { stan: 'czeka' }, dla: kto }),
        prosby: cel.wszystkie({ rodzaj: 'prosba/1', gdzie: { stan: 'czeka' }, dla: kto }),
      }),
      liczby: () => cel._liczbyDla(kto),
      przekroj: () => cel._przekrojDla(kto),
      // Surowy SQL przez widok czytelnika nie przechodzi. To nie wygoda, a bezpiecznik: dopóki tu stał, każde nowe
      // zapytanie napisane "szybko" obok widoku omijało granicę po cichu i nikt tego nie widział (dwie z pięciu
      // dziur z ataku Fable były dokładnie tym kształtem). Kto potrzebuje surowego zapytania, pisze je na
      // środowisku i sam mówi, dla kogo liczy.
      q: () => { throw new Error('widok czytelnika (srodowisko.dla) nie podaje surowego SQL: policz to przez spis/wszystkie/ile/rzecz albo dopisz tu jawne, filtrowane pytanie'); },
      // "co na to wskazuje" też jest treścią: odniesienie z obszaru, którego ten ktoś nie widzi, zdradzałoby,
      // że tam coś jest, i nawet czym się interesuje.
      wskazujaNa: (id) => cel.wskazujaNa(id).filter((x) => cel.rzecz(x.od, { dla: kto }) !== null),
      // Widok w wybranej chwili też jest czytaniem: położenia i chwila przechodzą przez te same okulary.
      widokNa: (widok, akt) => cel.widokNa(widok, akt, { dla: kto }),
      // Pamiętane liczby są liczone DLA KOGOŚ, odkąd czytanie zależy od tego, kto czyta. Wspólny klucz podałby
      // zwiedzającemu liczbę policzoną dla uczestnika (albo odwrotnie) i to byłby wyciek przez licznik, nie przez listę.
      pamietaj: (klucz, licz) => cel.pamietaj(`${klucz}|dla:${kto ?? ''}`, licz),
      czytelnik: kto,
    };
    return new Proxy(cel, {
      get(t, n, odb) {
        if (Object.hasOwn(zFiltrem, n)) return zFiltrem[n];
        const w = Reflect.get(t, n, t);
        return typeof w === 'function' ? w.bind(t) : w;
      },
    });
  }

  _niewidoczneDla(kto) {
    const rola = this.rola(kto);
    if (rola === 'wlasciciel') return null;
    const nr = this.ostatniNr();
    if (!this._widzi || this._widzi.nr !== nr) {
      const mapa = new Map();
      mapa.set(null, this.ustawienie(null, 'widzi').wartosc);
      for (const o of this.wszystkie({ rodzaj: 'obszar/1', odlozone: 'razem' })) mapa.set(o.id, this.ustawienie(o.id, 'widzi').wartosc);
      this._widzi = { nr, mapa };
    }
    const wolno = (w) => (rola === 'zwiedzajacy' ? w === 'wszyscy' : w !== 'wlasciciel');
    const zle = [...this._widzi.mapa].filter(([, w]) => !wolno(w)).map(([id]) => id);
    return zle.length ? zle : null;
  }

  _warunek({ rodzaj = null, obszar, gdzie = null, szukaj = null, odlozone = 'nie', po = null, dla = undefined } = {}) {
    const war = [], par = [];
    // Czytający podany wprost: rzeczy z obszarów, których nie widzi, nie trafiają nawet do liczenia.
    if (dla !== undefined) {
      const zle = this._niewidoczneDla(dla);
      if (zle) {
        const ids = zle.filter((x) => x !== null);
        const glowny = zle.includes(null);
        if (glowny) war.push('r.obszar IS NOT NULL');
        if (ids.length) {
          const pyt = ids.map(() => '?').join(', ');
          war.push(glowny ? `r.obszar NOT IN (${pyt})` : `(r.obszar IS NULL OR r.obszar NOT IN (${pyt}))`);
          par.push(...ids);
          // Sam obszar jest rzeczą i leży w obszarze NADRZĘDNYM, więc powyższy warunek go nie zasłania: zamknięty
          // skarbiec dalej stałby na liście z nazwą i ustawieniami. Obszar, do którego ktoś nie ma wstępu, nie jest
          // dla niego wymieniony - inaczej "nie widzisz" znaczy tylko "nie widzisz zawartości", a nazwa bywa treścią.
          // (Znalezione atakiem na własną granicę pod żywym adresem, 17 XI.)
          war.push(`r.id NOT IN (${pyt})`);
          par.push(...ids);
        }
      }
    }
    let trzebaTresci = false;
    // `po`: tylko rzeczy zmienione po akcie o tym numerze (z `odlozone: 'razem'` także te, które po nim odłożono)
    if (Number.isSafeInteger(po) && po >= 0) { war.push('r.akt > ?'); par.push(po); }
    if (rodzaj) {
      // Sama nazwa (bez pokolenia) znaczy wszystkie pokolenia. Porównanie po początku napisu, nie wzorcem LIKE,
      // bo podkreślnik w nazwie rodzaju byłby w nim dżokerem. Zły zapis rodzaju nie pasuje do niczego.
      if (typeof rodzaj !== 'string' || !RODZAJ_LUB_NAZWA.test(rodzaj)) war.push('0');
      else if (rodzaj.includes('/')) { war.push('r.rodzaj = ?'); par.push(rodzaj); }
      else { war.push('substr(r.rodzaj, 1, ?) = ?'); par.push(rodzaj.length + 1, rodzaj + '/'); }
    }
    if (obszar !== undefined) { if (obszar === null || obszar === '') war.push('r.obszar IS NULL'); else { war.push('r.obszar = ?'); par.push(String(obszar)); } }
    if (odlozone === 'tak') war.push('r.odlozone = 1'); else if (odlozone !== 'razem') war.push('r.odlozone = 0');
    if (gdzie && typeof gdzie === 'object') {
      for (const [n, w] of Object.entries(gdzie)) {
        if (!CECHA.test(n)) continue;
        trzebaTresci = true;
        if (w === null) { war.push(`json_extract(z.tresc, ?) IS NULL`); par.push('$.cechy.' + n); }
        else if (typeof w === 'boolean') { war.push(`json_extract(z.tresc, ?) = ?`); par.push('$.cechy.' + n, w ? 1 : 0); }
        else if (typeof w === 'number' || typeof w === 'string') { war.push(`json_extract(z.tresc, ?) = ?`); par.push('$.cechy.' + n, w); }
      }
    }
    if (typeof szukaj === 'string' && szukaj.trim()) { war.push(`r.szukane LIKE ? ESCAPE '\\'`); par.push('%' + szukaj.trim().toLocaleLowerCase('pl').replace(/[\\%_]/g, '\\$&') + '%'); }
    return { gdzie: war.length ? 'WHERE ' + war.join(' AND ') : '', par, trzebaTresci };
  }

  // Lista rzeczy od ostatnio zmienionej. `pomin` i `limit` dają kawałek; ile jest wszystkich, mówi `ile()`.
  spis({ limit = 1000, pomin = 0, ...filtr } = {}) {
    const { gdzie, par } = this._warunek(filtr);
    const calkowita = (x, domyslna) => { const l = Math.trunc(Number(x)); return Number.isFinite(l) ? l : domyslna; };
    const n = Math.max(1, Math.min(2000, calkowita(limit, 1000) || 1000));
    const od = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, calkowita(pomin, 0)));
    const w = this.q(`SELECT r.*, z.tresc FROM rzeczy r JOIN zapisy z ON z.id = r.zapis ${gdzie} ORDER BY r.zmieniono DESC, r.id LIMIT ? OFFSET ?`, ...par, n, od);
    return w.map((x) => this._zWiersza(x));
  }

  // To samo co spis, ale do końca: czyta kawałkami, więc nie urywa się po cichu na limicie.
  wszystkie(filtr = {}) {
    const wynik = [];
    for (let pomin = 0; ; pomin += 1000) {
      const kawalek = this.spis({ ...filtr, limit: 1000, pomin });
      wynik.push(...kawalek);
      if (kawalek.length < 1000) return wynik;
    }
  }

  ile(filtr = {}) {
    // Proste pytania (rodzaj z pokoleniem, obszar, odłożone albo nie) mają odpowiedź w pamiętanym przekroju spisu:
    // opis pyta o takie liczby kilkanaście razy, a każde osobne liczenie przeglądało cały spis.
    const { rodzaj = null, obszar, gdzie: cechy = null, szukaj = null, odlozone = 'nie', po = null, dla = undefined } = filtr;
    // Pamiętany przekrój spisu nie zna widoczności (liczy wszystko), więc pytanie "ile widzi TEN czytający" idzie
    // zwykłą drogą. Inaczej liczba zdradzałaby istnienie rzeczy, których ten ktoś nie ma prawa zobaczyć.
    const prostyRodzaj = rodzaj === null || (typeof rodzaj === 'string' && rodzaj.includes('/') && RODZAJ_LUB_NAZWA.test(rodzaj));
    if (dla === undefined && !cechy && !szukaj && po === null && prostyRodzaj && ['nie', 'tak', 'razem'].includes(odlozone)) {
      let n = 0;
      for (const w of this.przekroj()) {
        if (rodzaj !== null && w.rodzaj !== rodzaj) continue;
        if (obszar !== undefined && (obszar === null || obszar === '' ? w.obszar !== null : w.obszar !== String(obszar))) continue;
        if (odlozone === 'nie' ? w.odlozone : (odlozone === 'tak' ? !w.odlozone : false)) continue;
        n += w.ile;
      }
      return n;
    }
    const { gdzie, par, trzebaTresci } = this._warunek(filtr);
    return this.q(`SELECT COUNT(*) AS n FROM rzeczy r ${trzebaTresci ? 'JOIN zapisy z ON z.id = r.zapis' : ''} ${gdzie}`, ...par)[0].n;
  }

  // Przekrój spisu: ile rzeczy którego rodzaju leży w którym obszarze i ile z nich jest odłożonych. Z niego biorą się
  // liczby rodzajów, liczby w obszarach i liczba odłożonych. Stoi w małej tabeli, którą poprawia każdy zapis rzeczy
  // (_projekcja), więc czytanie go to kilkadziesiąt wierszy, a nie przegląd całego spisu: zmierzone 17 XI, że liczenie
  // go od nowa kosztowało przy 560 rzeczach ponad tysiąc wierszy bazy na pierwsze czytanie opisu po każdej zmianie.
  _przekrojMapa() {
    if (!this._prz) {
      this._prz = new Map();
      for (const w of this.q(`SELECT rodzaj, obszar, odlozone, ile FROM przekroj WHERE ile > 0`)) doliczPrzekroj(this._prz, w.rodzaj, w.obszar === '' ? null : w.obszar, w.odlozone, w.ile);
    }
    return this._prz;
  }
  przekroj() { return [...this._przekrojMapa().values()]; }

  // Przekrój i liczby dla jednego czytelnika. Liczby biorą się z tabeli przekroju, a nie z listy rzeczy, więc
  // filtr w zapytaniu ich nie dotyka - trzeba odjąć wiersze z obszarów, których ten ktoś nie widzi. Sam obszar
  // zamknięty leży w obszarze NADRZĘDNYM, więc przekrój policzył go po stronie rodzica: odejmujemy go osobno,
  // ale tylko wtedy, gdy rodzic jest widoczny (inaczej odjęlibyśmy go dwa razy).
  _przekrojDla(kto) {
    const zle = this._niewidoczneDla(kto);
    if (!zle) return this.przekroj();
    const ukryte = new Set(zle);
    const wiersze = this.przekroj().filter((w) => !ukryte.has(w.obszar ?? null)).map((w) => ({ ...w }));
    for (const id of ukryte) {
      if (id === null) continue;
      const o = this.rzecz(id, { odlozone: 'razem' });
      if (!o || ukryte.has(o.obszar ?? null)) continue;
      const w = wiersze.find((x) => x.rodzaj === o.rodzaj && (x.obszar ?? null) === (o.obszar ?? null) && Boolean(x.odlozone) === Boolean(o.odlozone));
      if (w) w.ile = Math.max(0, w.ile - 1);
    }
    return wiersze.filter((w) => w.ile > 0);
  }

  _liczbyDla(kto) {
    if (!this._niewidoczneDla(kto)) return this.liczby();
    return this.pamietaj(`liczby|dla:${kto ?? ''}`, () => {
      const m = new Map();
      for (const w of this._przekrojDla(kto)) if (!w.odlozone) m.set(w.rodzaj, (m.get(w.rodzaj) || 0) + w.ile);
      return Object.freeze([...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([rodzaj, ile]) => ({ rodzaj, ile })));
    });
  }

  liczby() {
    return this.pamietaj('liczby', () => {
      const m = new Map();
      for (const w of this.przekroj()) if (!w.odlozone) m.set(w.rodzaj, (m.get(w.rodzaj) || 0) + w.ile);
      return Object.freeze([...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([rodzaj, ile]) => ({ rodzaj, ile })));
    });
  }

  // Akty przesunięć rzeczy od numeru `od`, najnowsze pierwsze. Stoi tu, a nie w surowym zapytaniu u czytającego,
  // bo widok czytelnika surowego SQL nie podaje: tytuł i rodzaj każdego wiersza i tak trzeba potem sprawdzić
  // oczami czytelnika (opis.mjs: zmiany), a akt bez widocznej rzeczy zostaje samą liczbą.
  aktyRzeczy(od, limit) {
    return this.q(`SELECT a.nr, a.kto, a.kiedy, a.glowa, a.z_zapisu, a.cialo FROM akty a WHERE a.co = 'przesun' AND a.glowa LIKE 'rzecz:%' AND a.nr > ? ORDER BY a.nr DESC LIMIT ?`, od | 0, limit);
  }

  // Historia rzeczy: każda wersja ma kolejny numer (1, 2, 3…) i znacznik `akt`, czyli numer aktu, który ją ustawił.
  historia(id) {
    return this.q(`SELECT nr, kto, kiedy, cialo, zapis FROM akty WHERE glowa = ? AND co = 'przesun' ORDER BY nr`, 'rzecz:' + id)
      .map((a, i) => ({ numer: i + 1, akt: a.nr, kto: a.kto, kiedy: new Date(a.kiedy).toISOString(), zapis: a.zapis, ...(a.cialo ? { cialo: a.cialo } : {}) }));
  }

  // Treść wcześniejszej wersji rzeczy (po znaczniku `akt` z historii).
  wersja(id, akt) {
    if (typeof id !== 'string' || !ID.test(id) || !Number.isInteger(akt)) return null;
    const h = this.historia(id);
    const w = h.find((x) => x.akt === akt);
    if (!w) return null;
    const z = this.q(`SELECT rodzaj, tresc FROM zapisy WHERE id = ?`, w.zapis)[0];
    if (!z) return null;
    let t = {};
    try { t = JSON.parse(z.tresc); } catch { /* zostaje puste */ }
    if (!t || typeof t !== 'object') t = {};
    return { rzecz: id, akt, numer: w.numer, kto: w.kto, kiedy: w.kiedy, rodzaj: z.rodzaj, obszar: t.obszar ?? null, ...(obszarNieznany(t) ? { obszar_nieznany: true } : {}), cechy: t.cechy && typeof t.cechy === 'object' ? t.cechy : {}, odlozone: t.odlozone === true, powod: typeof t.powod === 'string' ? t.powod : null };
  }

  wskazujaNa(id) { return this.q(`SELECT od, cecha FROM odniesienia WHERE cel = ? ORDER BY od`, id); }

  ksztalty() {
    const nr = this.ostatniNr();
    if (this._k && this._k.nr === nr) return this._k.mapa;
    const mapa = new Map();
    for (const k of this.wszystkie({ rodzaj: 'ksztalt/1' })) if (typeof k.cechy.dla === 'string' && !mapa.has(k.cechy.dla)) mapa.set(k.cechy.dla, k);
    this._k = { nr, mapa };
    return mapa;
  }
  ksztaltDla(rodzaj) { const k = this.ksztalty().get(rodzaj); return k ? k.cechy : null; }

  // Nazwa rzeczy: wartość cechy wskazanej przez kształt. Dłuższa niż 300 znaków jest obcięta i mówi to wielokropkiem.
  tytul(rz) {
    const k = this.ksztaltDla(rz.rodzaj);
    const n = (k && k.tytul) || 'nazwa';
    const t = rz.cechy[n];
    if (typeof t !== 'string' || !t.trim()) return `${nazwaRodzaju(rz.rodzaj)} ${rz.id.slice(0, 6)}`;
    const s = t.trim();
    return s.length > 300 ? s.slice(0, 299) + '…' : s;
  }

  // --- uczestnicy i prawa ---------------------------------------------------------------------------------------
  // Właścicielem jest jedno imię, ustawione poza danymi (WLASCICIEL w ustawieniach Workera). Rzecz rodzaju uczestnik
  // może nadać rolę agent albo automat; roli właściciela nadać nie może.
  // Kto jest uczestnikiem, mówią DANE, a nie ustawienie Workera (17 XI 2026, front B). Klucz w ustawieniu KLUCZE
  // dowodzi tylko, KIM ktoś jest; czy ten ktoś ma tu prawa, stoi w rzeczy rodzaju uczestnik/1, którą właściciel
  // widzi i zmienia w Miejscu. Do 17 XI było odwrotnie i otwarcie: imię, którego nie było wśród uczestników,
  // dostawało rolę `agent` z samego faktu, że jest imieniem. Teraz brak rzeczy znaczy brak praw - i to jest
  // kierunek, w którym błąd ma padać. Imię z klucza zasiewa się jako uczestnik przy pierwszym wejściu i na
  // otwarciu kanału (miejsce-do.mjs), więc fałszywego braku praw nie da się dostać zwykłą drogą; gdy jednak
  // padnie, mówi o tym wprost (`powodBrakuPrawa`), a nie "podaj klucz" do kogoś, kto klucz właśnie podał.
  rola(kto) {
    if (!kto) return 'zwiedzajacy';
    if (kto === this.wlasciciel) return 'wlasciciel';
    if (kto === AUTOMAT) return 'automat';
    // Gość (narzędzie w oknie) działa pod imieniem gosc-<identyfikator swojej rzeczy>. Imię bez takiej rzeczy nie ma
    // żadnej roli. Rola gościa daje w obszarze tyle samo co rola agenta (ustawienie ile_wolno).
    if (kto.startsWith(PRZEDROSTEK_GOSCIA)) { const g = this.rzecz(kto.slice(PRZEDROSTEK_GOSCIA.length)); return g && nazwaRodzaju(g.rodzaj) === 'gosc' ? 'gosc' : 'zwiedzajacy'; }
    const nr = this.ostatniNr();
    if (this._role.nr !== nr) this._role = { nr, mapa: new Map() };
    if (!this._role.mapa.has(kto)) {
      const u = this.spis({ rodzaj: 'uczestnik/1', gdzie: { imie: kto }, odlozone: 'razem', limit: 1 })[0];
      // Uczestnik odłożony przestaje być uczestnikiem: odłożenie jest tu tym, czym odebranie prawa wstępu, i jest
      // odwracalne (`przywroc`), inaczej niż usunięcie, którego Miejsce nie ma.
      this._role.mapa.set(kto, !u || u.odlozone ? 'zwiedzajacy' : (ROLE.includes(u.cechy.rola) && u.cechy.rola !== 'wlasciciel' ? u.cechy.rola : 'agent'));
    }
    return this._role.mapa.get(kto);
  }

  // Dlaczego ktoś nie ma prawa: sama rola nie wystarcza na uczciwy komunikat. Kto nie podał klucza, ma go podać;
  // kto podał klucz, ale nie ma rzeczy uczestnika (albo jest odłożona), musi usłyszeć prawdę, bo inaczej szuka
  // błędu w kluczu, którego w kluczu nie ma.
  powodBrakuPrawa(kto, co = 'do ruchu') {
    if (!kto) return `${co} potrzebny jest klucz uczestnika (nagłówek Authorization: Bearer <klucz>)`;
    return `klucz jest poprawny, ale w tym Miejscu nie ma uczestnika o imieniu ${kto} (rzecz rodzaju uczestnik/1 - dopisuje i przywraca ją właściciel), więc ${co} nie ma prawa`;
  }

  // Ustawienie obowiązujące w obszarze: pierwsze znalezione w drodze do góry; na samej górze wartość domyślna.
  ustawienie(obszar, klucz) {
    let id = obszar, kroki = 0;
    while (id) {
      // Droga w górę dłuższa, niż pozwala zagnieżdżenie, oznacza pętlę albo błąd w danych: wtedy prawo zamyka się,
      // a nie otwiera.
      if (kroki++ >= 64) return { wartosc: klucz === 'ile_wolno' ? 'nic' : DOMYSLNE[klucz], skad: null, urwane: true };
      const o = this.rzecz(id);
      if (!o || o.rodzaj !== 'obszar/1') break;
      if (USTAWIENIA[klucz].includes(o.cechy[klucz])) return { wartosc: o.cechy[klucz], skad: id };
      id = o.obszar;
    }
    // Na samej górze stoi obszar główny Miejsca: jego ustawienia są domyślnymi dla wszystkiego, co nie mówi inaczej.
    const g = this.r.meta('obszar_glowny');
    const glowny = g && g !== obszar ? this.rzecz(g) : null;
    if (glowny && USTAWIENIA[klucz].includes(glowny.cechy[klucz])) return { wartosc: glowny.cechy[klucz], skad: g };
    return { wartosc: DOMYSLNE[klucz], skad: null };
  }

  // Co agentowi wolno z rzeczą danego rodzaju w danym obszarze (bez patrzenia, kim jest i co dokładnie zmienia).
  _prawoWObszarze(rodzaj, obszar) {
    const u = this.ustawienie(obszar, 'ile_wolno');
    const gdzie = obszar ? `w obszarze ${obszar}` : 'w głównym obszarze Miejsca';
    if (u.wartosc === 'prowadzic') return { tryb: 'skutek' };
    if (u.wartosc === 'porzadkowac') {
      const k = this.ksztaltDla(rodzaj);
      if (k && k.uklad === true) return { tryb: 'skutek' };
      return { tryb: 'propozycja', powod: `${gdzie} agenci mogą porządkować (rzeczy rodzaju oznaczonego jako układ), a dokładanie i zmianę treści tylko proponować` };
    }
    if (u.wartosc === 'proponowac') return { tryb: 'propozycja', powod: `${gdzie} agenci mogą tylko proponować` };
    return { tryb: 'odmowa', status: 403, powod: `${gdzie} agentom nie wolno nic (ustawienie ile_wolno: nic)` };
  }

  // Zmiany, które należą do właściciela bez względu na obszar. Kto inny je zgłosi, zgłasza propozycję do niego.
  _zastrzezone(rodzaj, cechy, stara) {
    const byl = (r) => !!stara && stara.rodzaj === r;
    if (rodzaj === 'uczestnik/1' || byl('uczestnik/1')) return 'uczestników dopisuje i zmienia tylko właściciel';
    if (rodzaj === 'obszar/1' || byl('obszar/1')) {
      for (const k of Object.keys(USTAWIENIA)) {
        const bylo = byl('obszar/1') ? (stara.cechy[k] ?? null) : null;
        const jest = rodzaj === 'obszar/1' ? (cechy[k] ?? null) : null;
        if (bylo !== jest) return `ustawienie ${k} obszaru zmienia tylko właściciel`;
      }
    }
    if (rodzaj === 'ksztalt/1' || byl('ksztalt/1')) {
      // Tożsamość z klucza nie zależy od pokolenia, więc kształt innego pokolenia rodzaju, który już ma kształt, nie może
      // bez właściciela zmienić tego, gdzie leżą rzeczy, czy są układem ani z czego liczy się ich tożsamość: inaczej
      // agent zakładał wartosc/2 bez reguły leżenia i zajmował identyfikator wartości całego Miejsca (niezależny atak, 17 XI).
      const nowyDla = rodzaj === 'ksztalt/1' && typeof cechy.dla === 'string' ? cechy.dla : null;
      if (nowyDla && !KSZTALTY_RDZENIA.includes(nowyDla)) {
        const nazwa = nazwaRodzaju(nowyDla);
        if (RODZAJE_SRODOWISKA.includes(nazwa)) return `rodzaj ${nazwa} należy do środowiska; kształt jego następnego pokolenia ustala tylko właściciel`;
        for (const [r, k] of this.ksztalty()) {
          if (r === nowyDla || nazwaRodzaju(r) !== nazwa) continue;
          const a = k.cechy;
          if ((a.lezy_z || null) !== (cechy.lezy_z || null) || (a.uklad === true) !== (cechy.uklad === true) || JSON.stringify(a.klucz || null) !== JSON.stringify(cechy.klucz || null))
            return `kształt ${nowyDla} zmienia względem ${r} to, gdzie leżą rzeczy, czy są układem albo z czego liczy się ich tożsamość; to ustala tylko właściciel`;
        }
      }
      const dla = [rodzaj === 'ksztalt/1' ? cechy.dla : null, byl('ksztalt/1') ? stara.cechy.dla : null];
      const rdz = dla.find((d) => KSZTALTY_RDZENIA.includes(d));
      if (rdz) return `kształt rodzaju ${rdz} zmienia tylko właściciel`;
      if ((byl('ksztalt/1') && stara.cechy.uklad === true) !== (rodzaj === 'ksztalt/1' && cechy.uklad === true)) return 'to, czy rodzaj jest układem, ustala tylko właściciel';
      // lezy_z rozstrzyga, w którym obszarze (czyli pod jakim prawem) leżą rzeczy rodzaju: to też zmiana praw
      if (((byl('ksztalt/1') && stara.cechy.lezy_z) || null) !== ((rodzaj === 'ksztalt/1' && cechy.lezy_z) || null)) return 'to, od której rzeczy rodzaj bierze obszar, ustala tylko właściciel';
    }
    return null;
  }

  // Czynne wartości, które włączają zestaw `id` w swoim zasięgu (odniesienie zapisuje _odniesienia): ich rodzaj i obszar.
  _wlaczajaZestaw(id) {
    return this.q(`SELECT r.rodzaj, r.obszar FROM odniesienia o JOIN rzeczy r ON r.id = o.od WHERE o.cel = ? AND o.cecha = 'wartosc' AND r.odlozone = 0`, id)
      .filter((v) => v.rodzaj === 'wartosc/1');
  }

  // Ocena zmiany: skutek, propozycja albo odmowa. `stara` to rzecz przed zmianą (albo null, gdy powstaje nowa),
  // a rodzaj, obszar i cechy to stan po zmianie. Prawo liczy się tam, skąd rzecz wychodzi, i tam, dokąd trafia.
  ocen(kto, { stara = null, rodzaj, obszar = null, cechy = {} }) {
    const rola = this.rola(kto);
    if (rola === 'zwiedzajacy') return { tryb: 'odmowa', status: 401, powod: this.powodBrakuPrawa(kto, 'do ruchu') };
    if (rodzaj === 'propozycja/1' || (stara && stara.rodzaj === 'propozycja/1')) return { tryb: 'odmowa', status: 403, powod: 'propozycje powstają same, gdy ruch nie ma prawa do skutku; zmienia je tylko przyjęcie albo odrzucenie (co: przyjmij, co: odrzuc)' };
    if (rola === 'wlasciciel') return { tryb: 'skutek' };
    let wynik = { tryb: 'skutek' };
    const miejsca = [{ rodzaj, obszar }];
    if (stara) miejsca.push({ rodzaj: stara.rodzaj, obszar: stara.obszar });
    for (const m of miejsca) {
      const p = this._prawoWObszarze(m.rodzaj, m.obszar);
      if (p.tryb === 'odmowa') return p; // tam, gdzie agentom nie wolno nic, nie ma też propozycji
      if (p.tryb === 'propozycja' && wynik.tryb === 'skutek') wynik = p;
    }
    // Przeniesienie rzeczy pociąga rzeczy, które z natury leżą z nią. Kto sam nie mógłby ich tam przenieść ze skutkiem,
    // nie przeniesie ich też przy okazji: cały ruch staje się propozycją.
    if (stara && (stara.obszar ?? null) !== (obszar ?? null)) {
      for (const rz of this._rodzajeZaleznych(stara.id)) for (const o of [obszar ?? null, stara.obszar ?? null]) {
        const p = this._prawoWObszarze(rz, o);
        if (p.tryb === 'odmowa') return p;
        if (p.tryb === 'propozycja' && wynik.tryb === 'skutek') wynik = { ...p, powod: `${p.powod}; razem z tą rzeczą przenoszą się rzeczy rodzaju ${rz}, które leżą tam, gdzie ona` };
      }
    }
    // Zestaw (motyw, preset) zmienia wygląd wszędzie tam, gdzie jest włączony, więc jego zmiana, odłożenie i przeniesienie
    // podlegają także prawu każdego zasięgu, który go włącza: słabsze prawo wygrywa. Inaczej ten, kto prowadzi w obszarze
    // zestawu, zmieniałby ze skutkiem wygląd zasięgu, w którym może tylko proponować, a przyjęcie propozycji "włącz ten
    // zestaw" zatwierdzałoby treść, którą potem dałoby się podmienić (niezależny atak, 17 XI 2026). Kucie na żywo
    // zostaje tam, gdzie zestaw i zasięg mają to samo prawo. Powód nie nazywa zasięgu: może leżeć tam, gdzie piszący nie widzi.
    if (stara && stara.rodzaj === 'zestaw/1' && wynik.tryb === 'skutek') {
      for (const v of this._wlaczajaZestaw(stara.id)) {
        if (this._prawoWObszarze(v.rodzaj, v.obszar ?? null).tryb !== 'skutek') { wynik = { tryb: 'propozycja', powod: 'ten zestaw jest włączony w zasięgu, w którym Twoja zmiana nie miałaby skutku od razu, więc zmiana samego zestawu też jest propozycją' }; break; }
      }
    }
    const z = this._zastrzezone(rodzaj, cechy, stara);
    if (z) return { tryb: 'propozycja', powod: z, wymaga: 'wlasciciel' };
    return wynik;
  }

  // --- rzeczy, które z natury leżą z inną rzeczą (lezy_z) --------------------------------------------------------
  // Kształt może powiedzieć lezy_z: <cecha>. Rzecz takiego rodzaju nie ma własnego obszaru: leży tam, gdzie rzecz
  // wskazana tą cechą. To jest jedna prawda dla wszystkich dróg zapisu (połóż, odłóż, przywróć, cofnij, przyjmij)
  // i dla przeniesienia rzeczy wskazanej: wtedy zależne idą za nią w tej samej chwili. Druga linia zmierzyła 17 XI,
  // że pilnowana tylko przy zwykłym zapisie reguła zostawiała po cichu sieroty na trzech pozostałych drogach.
  // Zwraca undefined, gdy rodzaj takiej reguły nie ma; {cecha, obszar}, gdy ma; {cecha, brak: true}, gdy cecha
  // nie wskazuje istniejącej rzeczy.
  _zNatury(rodzaj, cechy) {
    const k = this.ksztaltDla(rodzaj);
    if (!k || typeof k.lezy_z !== 'string') return undefined;
    const wskazana = cechy ? cechy[k.lezy_z] : null;
    const dom = typeof wskazana === 'string' && ID.test(wskazana) ? this.q(`SELECT id, rodzaj, obszar FROM rzeczy WHERE id = ?`, wskazana)[0] : null;
    if (!dom) return { cecha: k.lezy_z, brak: true };
    // Gdy rzecz wskazana sama jest obszarem, rzecz leży W NIM, a nie obok niego: wartość ustawienia, której zasięgiem
    // jest obszar, podlega prawu tego obszaru (w szkicu agent stroi sam, w głównym proponuje). Obszar główny jest
    // rzeczą, ale to, co w nim leży, ma obszar pusty.
    if (dom.rodzaj === 'obszar/1') return { cecha: k.lezy_z, obszar: dom.id === this.r.meta('obszar_glowny') ? null : dom.id };
    return { cecha: k.lezy_z, obszar: dom.obszar ?? null };
  }

  // Pytania o rzecz, która z natury leży z inną, wspólne dla każdej drogi powrotu do dawnego stanu (cofnij, przywróć,
  // cofnij gest, powrót do układu): rzecz wskazana musi istnieć dla piszącego, a wskazanie nie może zamknąć koła.
  // Zwykły zapis (połóż) pyta o to samo we własnej kolejności; bez tych pytań cofnięcie gestu zamykało koło, którego
  // zwykły zapis nie przepuszcza (niezależny atak, 18 XI 2026).
  _wadaNatury(rodzaj, cechy, id, widzi) {
    const n = this._zNatury(rodzaj, cechy);
    if (!n) return null;
    if (n.brak || !widzi(cechy[n.cecha])) return `cecha ${n.cecha} musi wskazywać istniejącą rzecz: od niej rzecz rodzaju ${rodzaj} bierze obszar`;
    if (id && this._lezyPod(cechy[n.cecha], id)) return `rzecz nie może leżeć z rzeczą, która sama leży z nią (cecha ${n.cecha} zamyka koło)`;
    return null;
  }

  // Czy idąc od rzeczy `od` w górę po regule lezy_z dojdzie się do rzeczy `szukana` (wtedy powstałoby koło).
  _lezyPod(od, szukana) {
    const widziane = new Set();
    for (let id = od; typeof id === 'string' && ID.test(id) && !widziane.has(id) && widziane.size < 64;) {
      if (id === szukana) return true;
      widziane.add(id);
      const rz = this.rzecz(id);
      const k = rz ? this.ksztaltDla(rz.rodzaj) : null;
      id = k && typeof k.lezy_z === 'string' ? rz.cechy[k.lezy_z] : null;
    }
    return false;
  }

  // Zmiana obszaru w samym spisie, bez nowego zapisu: rzecz z regułą lezy_z obszaru nie niesie, więc nie ma czego
  // zapisywać. Przekrój spisu idzie za nią. Licznik `pociagniete` czyta obiekt Miejsca, żeby powiedzieć otwartym
  // stronom, że mają przeczytać całość (stronie czytającej same zmiany taka rzecz by umknęła).
  _przenies(id, rodzaj, stary, odlozone, nowy) {
    this.r.sql.exec(`UPDATE rzeczy SET obszar = ? WHERE id = ?`, nowy, id);
    this.r.sql.exec(`UPDATE przekroj SET ile = ile - 1 WHERE rodzaj = ? AND obszar = ? AND odlozone = ?`, rodzaj, stary ?? '', odlozone ? 1 : 0);
    this.r.sql.exec(`INSERT INTO przekroj (rodzaj, obszar, odlozone, ile) VALUES (?, ?, ?, 1) ON CONFLICT(rodzaj, obszar, odlozone) DO UPDATE SET ile = ile + 1`, rodzaj, nowy ?? '', odlozone ? 1 : 0);
    if (this._prz) { doliczPrzekroj(this._prz, rodzaj, stary, odlozone ? 1 : 0, -1); doliczPrzekroj(this._prz, rodzaj, nowy, odlozone ? 1 : 0, 1); }
    this._pam = null;
    this.pociagniete = (this.pociagniete || 0) + 1;
  }

  // Rzeczy, które z natury leżą z rzeczą `id`, idą do jej nowego obszaru; potem ich własne zależne, i tak dalej.
  _pociagnij(id, obszar, widziane = new Set([id])) {
    // To, co z natury leży z obszarem, leży w nim samym: gdy obszar zmienia rodzica, jego wnętrze zostaje, gdzie było.
    const sam = this.q(`SELECT rodzaj FROM rzeczy WHERE id = ?`, id)[0];
    if (sam && sam.rodzaj === 'obszar/1') return;
    for (const w of this.q(`SELECT o.od, o.cecha, r.rodzaj, r.obszar, r.odlozone FROM odniesienia o JOIN rzeczy r ON r.id = o.od WHERE o.cel = ?`, id)) {
      if (widziane.has(w.od)) continue;
      const k = this.ksztaltDla(w.rodzaj);
      if (!k || k.lezy_z !== w.cecha) continue;
      widziane.add(w.od);
      if ((w.obszar ?? null) !== obszar) this._przenies(w.od, w.rodzaj, w.obszar ?? null, !!w.odlozone, obszar);
      this._pociagnij(w.od, obszar, widziane);
    }
  }

  // Rodzaje rzeczy, które poszłyby za rzeczą `id`, gdyby zmieniła obszar (do oceny prawa przy przenoszeniu).
  _rodzajeZaleznych(id, widziane = new Set([id]), glebokosc = 0) {
    const wynik = new Set();
    if (glebokosc > 8) return wynik;
    const sam = this.q(`SELECT rodzaj FROM rzeczy WHERE id = ?`, id)[0];
    if (sam && sam.rodzaj === 'obszar/1') return wynik; // wnętrze obszaru nie idzie za nim (zob. _pociagnij)
    for (const w of this.q(`SELECT o.od, o.cecha, r.rodzaj FROM odniesienia o JOIN rzeczy r ON r.id = o.od WHERE o.cel = ?`, id)) {
      if (widziane.has(w.od)) continue;
      const k = this.ksztaltDla(w.rodzaj);
      if (!k || k.lezy_z !== w.cecha) continue;
      widziane.add(w.od);
      wynik.add(w.rodzaj);
      for (const x of this._rodzajeZaleznych(w.od, widziane, glebokosc + 1)) wynik.add(x);
    }
    return wynik;
  }

  // Obszar, który wynika rzeczy z natury, liczony po całym łańcuchu aż do rzeczy, która własny obszar niesie w zapisie.
  // Rzecz bez reguły, sierota albo koło zostają przy obszarze ze spisu (sierotę i tak nazwie sprawdzian spójności).
  // Rzeczy na kole (A leży z B, B leży z A) zostają każda przy swoim obszarze ze spisu, niezależnie od tego, od której
  // zaczęto liczyć: wyrównanie i sprawdzian spójności muszą dawać ten sam wynik.
  _obszarZNatury(rz, pamiec = new Map()) {
    const o = this._lancuchNatury(rz, pamiec, []);
    return o !== null && typeof o === 'object' ? (rz.obszar ?? null) : o;
  }

  // Zwraca obszar (napis albo null dla głównego) albo {kolo: id}, gdy droga wróciła do rzeczy `id`, która jest w toku.
  _lancuchNatury(rz, pamiec, droga) {
    if (pamiec.has(rz.id)) return pamiec.get(rz.id);
    const wlasny = rz.obszar ?? null;
    const k = this.ksztaltDla(rz.rodzaj);
    if (!k || typeof k.lezy_z !== 'string') return wlasny;
    if (droga.includes(rz.id)) return { kolo: rz.id };
    if (droga.length > 512) return wlasny;
    const cel = rz.cechy ? rz.cechy[k.lezy_z] : null;
    if (typeof cel !== 'string' || !ID.test(cel)) return wlasny;
    let dom = pamiec.get('#' + cel);
    if (dom === undefined) { dom = this.rzecz(cel); pamiec.set('#' + cel, dom); }
    if (!dom) return wlasny;
    let obszar;
    if (dom.rodzaj === 'obszar/1') {
      let glowny = pamiec.get('@glowny');
      if (glowny === undefined) { glowny = this.r.meta('obszar_glowny') || null; pamiec.set('@glowny', glowny); }
      obszar = dom.id === glowny ? null : dom.id;
    } else {
      droga.push(rz.id);
      const o = this._lancuchNatury(dom, pamiec, droga);
      droga.pop();
      if (o !== null && typeof o === 'object') { pamiec.set(rz.id, wlasny); return o.kolo === rz.id ? wlasny : o; }
      obszar = o;
    }
    pamiec.set(rz.id, obszar);
    return obszar;
  }

  // Wyrównanie spisu z regułą lezy_z: każda rzecz rodzaju, który z natury leży z inną rzeczą, dostaje w spisie obszar
  // tamtej. Potrzebne dla spisu sprzed tej reguły i po odbudowie z dziennika. Zwraca, ile rzeczy zmieniło obszar.
  wyrownajZNatury({ slad = true } = {}) {
    const rodzaje = [...this.ksztalty()].filter(([, k]) => k && k.cechy && typeof k.cechy.lezy_z === 'string').map(([r]) => r);
    // Obszar liczy się po całym łańcuchu (rzecz wskazana może sama leżeć z natury z inną), z pamięcią, więc głębokość
    // łańcucha nie ma znaczenia. Wersja z ograniczoną liczbą obiegów zostawiała po odbudowie spisu głębokie łańcuchy
    // w obszarze głównym, także te, które leżały w obszarze zamkniętym (niezależny atak, 17 XI 2026).
    let razem = 0;
    const pamiec = new Map();
    for (const rodzaj of rodzaje) for (const rz of this.wszystkie({ rodzaj, odlozone: 'razem' })) {
      const ma = this._obszarZNatury(rz, pamiec);
      if (ma === (rz.obszar ?? null)) continue;
      this._przenies(rz.id, rz.rodzaj, rz.obszar ?? null, !!rz.odlozone, ma);
      razem++;
    }
    // Wyrównanie nie zmienia żadnego zapisu, więc bez tego śladu nikt by się o nim nie dowiedział (uwaga drugiej linii:
    // naprawialiśmy ciszę, nie wolno naprawić jej czymś, co samo milczy). Opis pod adresem mówi to jednym zdaniem.
    if (razem && slad) {
      let bylo = {};
      try { bylo = JSON.parse(this.r.meta('spis:wyrownano') || '{}') || {}; } catch { /* zaczynamy od zera */ }
      this.r.ustawMeta('spis:wyrownano', JSON.stringify({ razem: (Number(bylo.razem) || 0) + razem, ostatnio: razem, kiedy: new Date(this.r.teraz()).toISOString() }));
    }
    return razem;
  }

  // Ślad po wyrównaniach spisu: ile rzeczy dostało obszar z natury bez nowego zapisu (razem i ostatnim razem) i kiedy.
  wyrownano() {
    try { const w = JSON.parse(this.r.meta('spis:wyrownano') || 'null'); return w && Number(w.razem) > 0 ? w : null; } catch { return null; }
  }

  // Co ten uczestnik może zrobić z istniejącą rzeczą, nie zmieniając jej rodzaju ani obszaru (dla tekstu pod adresem).
  prawo(kto, { rodzaj, obszar, rzecz = null }) {
    return this.ocen(kto, { stara: rzecz, rodzaj, obszar, cechy: rzecz ? rzecz.cechy : {} });
  }

  // --- ruchy ----------------------------------------------------------------------------------------------------
  async ruch(kto, cialo, { slad = null, gosc = null } = {}) {
    if (kto && !poprawneImie(kto)) return blad(401, 'nieznany wykonawca');
    if (kto === AUTOMAT) return blad(403, `imię ${AUTOMAT} jest zastrzeżone dla samego środowiska`);
    if (kto && kto.startsWith(PRZEDROSTEK_GOSCIA)) return blad(403, `imiona zaczynające się od ${PRZEDROSTEK_GOSCIA} należą do gości w oknach; uczestnik z kluczem nie działa pod takim imieniem`);
    if (!cialo || typeof cialo !== 'object' || Array.isArray(cialo)) return blad(400, 'ciało żądania ma być obiektem JSON');
    if (!opKlienta(cialo.op)) return blad(400, 'op: Twój własny identyfikator tej czynności, 8 do 100 znaków z [A-Za-z0-9_-]; przy ponowieniu podaj ten sam, wtedy nic nie zrobi się dwa razy');
    // Gest: ruchy z tym samym znakiem są jedną czynnością ręki i cofają się razem (co: cofnij-gest). Znak wchodzi do
    // identyfikatora czynności jądra (g:<gest>:<op>), więc akty gestu leżą obok siebie i jądro nie musi go znać.
    if ('gest' in cialo) {
      if (typeof cialo.gest !== 'string' || !GEST.test(cialo.gest)) return blad(400, 'gest: znak czynności, do której należy ten ruch: 8 do 24 znaków z [A-Za-z0-9_-]; ruchy z tym samym znakiem cofają się razem (co: cofnij-gest)');
      if (cialo.op.length > 80) return blad(400, 'op: przy ruchu ze znakiem gestu najwyżej 80 znaków');
      cialo = { ...cialo, op: 'g:' + cialo.gest + ':' + cialo.op };
    }
    const co = cialo.co;
    // Ruch z okna: aktorem jest gość (gosc-<id jego rzeczy>), a ten, kto otworzył okno, zostaje przy akcie jako kontekst.
    // Dziennik nie mówi wtedy, że uczestnik zrobił coś, co zrobiło narzędzie w jego oknie. Prawo liczy się dla obu
    // i wygrywa słabsze (w _zmien); okno, którego nikt nie otworzył kluczem, nie pisze wcale.
    let aktor = kto, ctx = slad;
    if (gosc !== null && gosc !== undefined) {
      if (!kto) return blad(401, 'okno pisze tylko wtedy, gdy ten, kto je otworzył, wszedł kluczem');
      if (typeof gosc !== 'string' || !ID.test(gosc)) return blad(400, 'gosc: identyfikator rzeczy rodzaju gosc (26 znaków)');
      // otwierający, który nie ma tu żadnego prawa, słyszy to wprost, zanim okno zacznie pytać o gościa
      const bezPrawa = this._bezPrawa(kto);
      if (bezPrawa) return bezPrawa;
      const g = this._oczy(kto)(gosc);
      if (!g || nazwaRodzaju(g.rodzaj) !== 'gosc') return blad(404, `nie ma gościa ${gosc}`);
      if (g.odlozone) return blad(409, 'ten gość jest odłożony; odłożone narzędzie nie pisze');
      if (g.cechy.umowa !== 'okno/3') return blad(409, 'ten gość mówi umową okna, która nie zna ruchów; żeby pisał, zgłoś go z "umowa":"okno/3"');
      if (co === 'przyjmij' || co === 'odrzuc') return blad(403, 'propozycji nie rozstrzyga się z okna: przyjmuje i odrzuca uczestnik, własną ręką');
      aktor = PRZEDROSTEK_GOSCIA + gosc;
      // ślad ciała zostaje tylko wtedy, gdy mieści się w tym, co jądro przyjmuje (drukowalne znaki ASCII); to, w czyim
      // oknie pisał gość, zostaje przy akcie zawsze
      const czysty = typeof slad === 'string' && /^[ -~]{1,60}$/.test(slad) ? slad : null;
      ctx = { slad: ('okno:' + kto + (czysty ? ' ' + czysty : '')).slice(0, 80), przez: kto };
    }
    if (co === 'poloz') return this._wKolejce(() => this._poloz(aktor, cialo, ctx));
    if (co === 'odloz' || co === 'przywroc' || co === 'cofnij') return this._wKolejce(() => this._przestaw(aktor, cialo, ctx));
    if (co === 'przyjmij' || co === 'odrzuc') return this._wKolejce(() => this._rozstrzygnij(aktor, cialo, ctx));
    if (co === 'cofnij-gest') return this._wKolejce(() => this._cofnijGest(aktor, cialo, ctx));
    if (co === 'przywroc-uklad') return this._wKolejce(() => this._przywrocUklad(aktor, cialo, ctx));
    return blad(400, 'co: poloz (dołóż albo zmień rzecz), odloz, przywroc, cofnij (rzecz do wcześniejszej wersji), przyjmij albo odrzuc (rozstrzygnij propozycję), cofnij-gest (cały gest jednym krokiem), przywroc-uklad (powrót do zapisanego układu)');
  }

  _maRzecz = (id) => this.rzecz(id);

  // --- oczy piszącego -------------------------------------------------------------------------------------------
  // Czytanie przechodzi przez okulary czytającego (`dla`). Zapis szedł obok i pytał o istnienie oczami środowiska,
  // które widzi wszystko, więc drzwi ruchu mówiły piszącemu to, czego nie mówiło mu czytanie: że rzecz o zgadniętym
  // kluczu jest (z identyfikatorem i wersją), że identyfikator wskazuje coś istniejącego (odniesienie przechodziło),
  // w którym zamkniętym obszarze leży rzecz (odmowa go nazywała). Dwa ataki drugiej linii, 17 XI 2026.
  // Zasada: rzecz, której piszący nie widzi, jest dla zapisu tym samym, czym rzecz, której nie ma, i brzmi tak samo.
  // Zwraca funkcję (id) => rzecz albo null, z dodatkiem `.obszar(id)`: czy piszący widzi obszar o tym identyfikatorze
  // (null to obszar główny). Przy ruchu z okna patrzą dwie pary oczu, gościa i tego, kto okno otworzył, i rzecz
  // istnieje dopiero wtedy, gdy widzą ją obie: narzędzie w oknie właściciela nie dowie się tego, co wie właściciel.
  // Właściciel widzi wszystko. Automat środowiska (obserwator faktów) też pyta wprost: chodzi zwykłym ruchem i musi
  // odświeżyć fakt także wtedy, gdy właściciel schował rzecz, a jego odpowiedzi nie wychodzą do obcych.
  // Czego to NIE zamyka: jednego bitu przy rodzajach z kluczem. Tożsamość z klucza jest jedna na całe Miejsce, więc
  // uczestnik z prawem zapisu, który zgadnie wartość klucza, dowie się z odmowy, że taka rzecz gdzieś jest. Nie dostanie
  // identyfikatora, wersji ani obszaru, a każda próba, która nie trafi, zostawia rzecz albo propozycję, czyli ślad.
  _oczy(kto, przez = null) {
    const wprost = (k) => { const r = this.rola(k); return r === 'wlasciciel' || r === 'automat'; };
    const patrzacy = [kto, ...(przez ? [przez] : [])].filter((k) => !wprost(k));
    const widzi = patrzacy.length
      ? (id) => { for (const k of patrzacy) if (this.rzecz(id, { dla: k }) === null) return null; return this.rzecz(id); }
      : (id) => this.rzecz(id);
    widzi.obszar = (id) => patrzacy.every((k) => { const zle = this._niewidoczneDla(k); return !zle || !zle.includes(id ?? null); });
    // Dawny stan rzeczy (wersja, stan sprzed gestu, stan w zapisanej chwili): widać go, gdy widać obszar, w którym rzecz
    // wtedy leżała. Stan, który tego nie wie, widzi tylko ten, przed kim nic nie jest zamknięte.
    widzi.dawna = (stan) => (stan.obszar_nieznany ? patrzacy.every((k) => { const zle = this._niewidoczneDla(k); return !zle || !zle.length; }) : widzi.obszar(stan.obszar));
    return widzi;
  }

  // Kto nie ma tu żadnego prawa, słyszy to od razu i wprost, zanim zapis zacznie pytać o cokolwiek: inaczej uczestnik
  // z odebranym wstępem dostawałby "nie ma takiej rzeczy" i szukał błędu tam, gdzie go nie ma.
  _bezPrawa(kto, przez = null, co = 'do ruchu') {
    for (const k of [kto, ...(przez ? [przez] : [])]) if (this.rola(k) === 'zwiedzajacy') return blad(401, this.powodBrakuPrawa(k, co));
    return null;
  }
  _maZapis = (id) => { const z = this.q(`SELECT rodzaj FROM zapisy WHERE id = ?`, id)[0]; return z ? z.rodzaj : null; };

  // Jak głęboko leży obszar (główny: 0). Zagnieżdżenie ma granicę, żeby żadne liczenie w górę nie urwało się w pół
  // drogi: ustawienie, które "wypada otwarte" powyżej granicy, byłoby dziurą w prawie (znalezisko psującego, 17 XI).
  _glebokosc(obszar) {
    let id = obszar, n = 0;
    const widziane = new Set();
    while (id && !widziane.has(id)) { widziane.add(id); n++; const o = this.rzecz(id); id = o ? o.obszar : null; }
    return n;
  }

  // Sprawdzenie treści rzeczy przed zapisem, bez pytania, kto ją zapisuje. Zwraca {ok, ksztalt, nieznane} albo błąd
  // z listą, co jest nie tak.
  _sprawdzTresc(rodzaj, cechy, obszar, stara, odlozone = false, widzi = this._maRzecz) {
    // Kształt, pod którym leżą rzeczy, i obszar, w którym leżą rzeczy, nie mogą zniknąć ani stać się czymś innym:
    // rzeczy zostałyby bez opisu albo bez miejsca.
    if (stara && stara.rodzaj === 'ksztalt/1' && (rodzaj !== 'ksztalt/1' || odlozone) && this.ile({ rodzaj: stara.cechy.dla, odlozone: 'razem' }) > 0)
      return blad(409, `pod kształtem ${stara.cechy.dla} leżą rzeczy, więc nie da się go odłożyć ani zamienić w coś innego`);
    if (stara && stara.rodzaj === 'obszar/1' && (rodzaj !== 'obszar/1' || odlozone)) {
      if (stara.id === this.r.meta('obszar_glowny') || stara.id === this.r.meta('obszar_nowe')) return blad(409, 'tego obszaru środowisko potrzebuje do działania; nie da się go odłożyć ani zamienić w coś innego');
      if (this.ile({ obszar: stara.id, odlozone: 'razem' }) > 0) return blad(409, 'w tym obszarze leżą rzeczy; najpierw je przenieś, wtedy obszar da się odłożyć albo zamienić w coś innego');
    }
    if (rodzaj === 'ksztalt/1') {
      const b = sprawdzKsztalt(cechy);
      if (b.length) return blad(422, 'kształt nie przeszedł sprawdzenia: ' + b.join('; '), { bledy: b });
      const juz = this.ksztalty().get(cechy.dla);
      const nastepne = `${nazwaRodzaju(cechy.dla)}/${Number(cechy.dla.split('/')[1]) + 1}`;
      if (juz && (!stara || juz.id !== stara.id)) return blad(409, `rodzaj ${cechy.dla} ma już kształt (rzecz ${juz.id}); zmień tamtą rzecz albo załóż następne pokolenie, np. ${nastepne}`, { rzecz: juz.id });
      // Pierwszy kształt rodzaju, pod którym leżą już rzeczy, ma je opisywać. Inaczej rzeczy zapisane wczoraj stałyby
      // się dziś niezgodne z własnym rodzajem bez żadnego ruchu (znalezisko sprawdzianu spójności, 17 XI, SP5).
      if (!juz) {
        const leza = this.wszystkie({ rodzaj: cechy.dla, odlozone: 'razem' });
        const zle = leza.filter((rz) => sprawdzCechy(cechy, rz.cechy, this._maRzecz, this._maZapis).bledy.length);
        if (zle.length) return blad(409, `pod rodzajem ${cechy.dla} leży już ${leza.length} rzeczy, a ${zle.length} z nich nie przechodzi tego kształtu (np. ${zle.slice(0, 3).map((x) => x.id).join(', ')}). Opisz kształtem to, co leży, albo załóż ostrzejszy opis jako następne pokolenie: ${nastepne}`, { rzeczy: zle.slice(0, 20).map((x) => x.id) });
      }
      if (stara && stara.rodzaj === 'ksztalt/1') {
        if (stara.cechy.dla !== cechy.dla) return blad(409, `ten kształt opisuje rodzaj ${stara.cechy.dla} i tak zostaje; inny rodzaj to osobny kształt`);
        if (this.ile({ rodzaj: cechy.dla, odlozone: 'razem' }) > 0) {
          const n = niezgodnosciKsztaltu(stara.cechy, cechy);
          if (n.length) return blad(409, `pod kształtem ${cechy.dla} leżą już rzeczy, więc wolno w nim tylko dokładać cechy niewymagane, poszerzać wybór i zmieniać opisy (${n.join('; ')}). Inną zmianę zrób jako następne pokolenie: ${nastepne}`, { bledy: n });
        }
      }
    }
    if (obszar) {
      const o = widzi(obszar);
      if (!o || o.rodzaj !== 'obszar/1') return blad(422, `obszar ${obszar}: nie ma takiego obszaru`);
      if (o.odlozone) return blad(422, `obszar ${obszar} jest odłożony; wybierz inny albo najpierw go przywróć`);
      if (rodzaj === 'obszar/1' || (stara && stara.rodzaj === 'obszar/1')) {
        // obszar nie może leżeć w sobie samym ani we własnym wnętrzu; drogę w górę przechodzimy całą
        const widziane = new Set();
        for (let id = obszar; id && !widziane.has(id);) { if (stara && id === stara.id) return blad(422, 'obszar nie może leżeć we własnym wnętrzu'); widziane.add(id); const x = this.rzecz(id); id = x ? x.obszar : null; }
        if (this._glebokosc(obszar) + 1 > 32) return blad(422, 'obszary mogą być zagnieżdżone najwyżej na 32 poziomy');
      }
    }
    const ksztalt = this.ksztaltDla(rodzaj);
    if (!ksztalt) return { ok: true, ksztalt: null, nieznane: Object.keys(cechy), bezKsztaltu: true };
    // Odniesienie, które stało w rzeczy już wcześniej, zostaje bez pytania o widoczność: agent ma móc zmienić rzecz,
    // którą właściciel przypiął do czegoś zamkniętego. Każde NOWE odniesienie piszący musi widzieć.
    const dawne = stara && widzi !== this._maRzecz ? new Set(odniesieniaZCech(this.ksztaltDla(stara.rodzaj), stara.cechy).map(([, cel]) => cel)) : null;
    const maRzecz = dawne ? (id) => (dawne.has(id) ? this.rzecz(id) : widzi(id)) : widzi;
    const { bledy, nieznane } = sprawdzCechy(ksztalt, cechy, maRzecz, this._maZapis);
    if (bledy.length) return blad(422, `rzecz rodzaju ${rodzaj} nie przeszła sprawdzenia: ` + bledy.join('; '), { bledy, ksztalt: '/rodzaj/' + rodzaj });
    if (ksztalt.klucz && stara && nazwaRodzaju(stara.rodzaj) === nazwaRodzaju(rodzaj)) {
      const sk = this.ksztaltDla(stara.rodzaj);
      if (sk && JSON.stringify(sk.klucz || null) === JSON.stringify(ksztalt.klucz) && ksztalt.klucz.some((n) => JSON.stringify(stara.cechy[n]) !== JSON.stringify(cechy[n])))
        return blad(422, `cechy ${ksztalt.klucz.join(', ')} są kluczem, czyli tożsamością tej rzeczy; inna wartość klucza to inna rzecz`);
    }
    // Pokrętła, wartości i zestawy: kształt mówi, jakie mają cechy, a to, czy wartość pasuje do deklaracji pokrętła,
    // umie sprawdzić tylko środowisko (worker/ustawienia.mjs).
    const wada = sprawdzUstawienie(this, rodzaj, cechy, widzi, obszar ?? null);
    if (wada) return blad(422, wada.blad, wada.bledy ? { bledy: wada.bledy } : {});
    return { ok: true, ksztalt, nieznane };
  }

  // Dla rodzaju z kluczem tożsamość rzeczy liczy się z nazwy rodzaju (bez pokolenia) i wartości cech klucza:
  // ta sama rzecz ma ten sam identyfikator bez względu na to, kto i kiedy ją dokłada.
  async _idZKlucza(rodzaj, ksztalt, cechy) {
    if (!ksztalt || !Array.isArray(ksztalt.klucz)) return null;
    if (ksztalt.klucz.some((n) => cechy[n] === undefined || cechy[n] === null)) return null;
    return idZ('klucz', nazwaRodzaju(rodzaj), JSON.stringify(ksztalt.klucz.map((n) => cechy[n])));
  }

  async _poloz(kto, c, slad) {
    // Wartość pokrętła bez podanego zasięgu dotyczy całego Miejsca: zasięgiem jest obszar główny. Dopisujemy go tu,
    // przed wszystkim innym, żeby ponowienie tej samej czynności dawało tę samą treść.
    if (c.rodzaj === 'wartosc/1' && c.cechy && typeof c.cechy === 'object' && !Array.isArray(c.cechy) && (c.cechy.zasieg === undefined || c.cechy.zasieg === null) && this.r.meta('obszar_glowny'))
      c = { ...c, cechy: { ...c.cechy, zasieg: this.r.meta('obszar_glowny') } };
    const { rodzaj, cechy } = c;
    if (typeof rodzaj !== 'string' || !RODZAJ.test(rodzaj)) return blad(400, 'rodzaj: nazwa z pokoleniem, np. projekt/1 (małe litery, cyfry, kropka, - i _, potem /numer)');
    if (!cechy || typeof cechy !== 'object' || Array.isArray(cechy)) return blad(400, 'cechy: obiekt z cechami rzeczy, np. {"nazwa": "…"}');
    if ('rzecz' in c && !(typeof c.rzecz === 'string' && ID.test(c.rzecz))) return blad(400, 'rzecz: identyfikator zmienianej rzeczy (26 znaków); pomiń, żeby dołożyć nową');
    if ('obszar' in c && c.obszar !== null && !(typeof c.obszar === 'string' && ID.test(c.obszar))) return blad(400, 'obszar: identyfikator obszaru (26 znaków) albo null dla głównego');
    if ('wersja' in c && !(Number.isInteger(c.wersja) || c.wersja === 'dowolna')) return blad(400, 'wersja: liczba z pola wersja Twojego ostatniego odczytu albo napis "dowolna" (świadoma zgoda na nadpisanie cudzej zmiany)');
    if (nazwaRodzaju(rodzaj) === 'kod') return blad(400, 'rodzaj kod jest zastrzeżony dla kodu gości; kod zapisuje się przez POST /api/srodowisko/kod, a gościa zgłasza jako rzecz rodzaju gosc/1');
    const wada = wadaSurowej(cechy);
    if (wada) return blad(400, 'cechy: ' + wada);
    // Kolejność ma znaczenie: kto nie ma tu prawa, słyszy to także przy ponowieniu dawnej czynności, a ponowienie
    // oddaje uchwyt rzeczy tylko oczom, które ją widzą (niezależny atak, 17 XI 2026).
    const bez = this._bezPrawa(kto, przezZ(slad));
    if (bez) return bez;
    const widzi = this._oczy(kto, przezZ(slad));
    const byl = this._powtorzenie(kto, c, widzi);
    if (byl) return byl;
    // Rzecz, która z natury należy do innej (miejsce do widoku), leży zawsze w tym samym obszarze co ona. Inaczej prawo
    // do jej zmiany liczyłoby się gdzie indziej niż prawo do rzeczy, której dotyczy: agent kładłby położenia w obszarze,
    // w którym prowadzi sam, a widok właściciela i tak by je brał (znalezione na podglądzie 17 XI).
    // Rzecz wskazana, której piszący nie widzi, jest dla niego rzeczą, której nie ma, i to pytanie idzie pierwsze:
    // inaczej zajęty klucz położenia w zamkniętym widoku mówiłby mu, że widok i położenie istnieją.
    let n = this._zNatury(rodzaj, cechy);
    if (n && !n.brak && !widzi(cechy[n.cecha])) n = { cecha: n.cecha, brak: true };
    if (n && n.brak) return blad(400, `cecha ${n.cecha} musi wskazywać istniejącą rzecz: od niej rzecz rodzaju ${rodzaj} bierze obszar`);
    let stara = null, id;
    if (c.rzecz) {
      stara = widzi(c.rzecz);
      if (!stara) return blad(404, `nie ma rzeczy ${c.rzecz}`);
      id = stara.id;
    } else {
      const zKlucza = await this._idZKlucza(rodzaj, this.ksztaltDla(rodzaj), cechy);
      id = zKlucza || await idZ('rzecz', kto, c.op);
      stara = this.rzecz(id);
      // Klucz zajęty przez rzecz, której piszący nie widzi: odmowa bez identyfikatora, wersji i obszaru, także wtedy,
      // gdy podał wersję. Na ślepo nie da się takiej rzeczy ani poznać, ani nadpisać.
      if (stara && zKlucza && !widzi(id)) return blad(409, 'rzecz o tym kluczu już jest, ale leży tam, dokąd nie masz wstępu: nie da się jej stąd ani zobaczyć, ani zmienić');
      // Rzecz o tym kluczu już jest: to zmiana, nie nowa rzecz, więc potrzebna jest wersja jak przy każdej zmianie.
      if (stara && zKlucza && !('wersja' in c)) return blad(409, `rzecz o tym kluczu już jest (${id}); żeby ją zmienić, podaj jej wersję z odczytu albo "wersja":"dowolna"`, { rzecz: id, wersja: stara.wersja });
      if (stara && !zKlucza) return blad(409, 'ten op założył już inną rzecz; nowa rzecz potrzebuje nowego op', widzi(id) ? { rzecz: id } : {});
    }
    if (stara && !('wersja' in c)) return blad(400, 'wersja: numer z pola wersja Twojego ostatniego odczytu tej rzeczy; bez niego nie wiadomo, czy nie nadpisujesz cudzej zmiany', { wersja: stara.wersja });
    const rola = this.rola(kto);
    let obszar;
    if ('obszar' in c) obszar = c.obszar;
    else if (stara) obszar = stara.obszar;
    else obszar = rola === 'wlasciciel' ? null : (this.r.meta('obszar_nowe') || null);
    if (n) {
      if ('obszar' in c && (c.obszar ?? null) !== n.obszar) return blad(400, `rzecz rodzaju ${rodzaj} leży zawsze w obszarze rzeczy z cechy ${n.cecha}; pomiń obszar albo podaj ten sam`);
      if (stara && this._lezyPod(cechy[n.cecha], stara.id)) return blad(422, `rzecz nie może leżeć z rzeczą, która sama leży z nią (cecha ${n.cecha} zamyka koło)`);
      obszar = n.obszar;
    }
    // Ustawienie wartości pokrętła zawsze czyni ją czynną: odłożenie wartości znaczy "wróć do odziedziczonej", więc
    // ponowne ustawienie musi ją przywrócić, inaczej ręka ustawiałaby coś, co nie ma skutku.
    const czynna = rodzaj === 'wartosc/1';
    return this._zmien(kto, c.op, slad, { co: 'poloz', stara, id, rodzaj, obszar, cechy, odlozone: stara && !czynna ? !!stara.odlozone : false, powod: stara && stara.odlozone && !czynna ? stara.powod : null, wersja: stara ? (c.wersja === 'dowolna' ? stara.wersja : c.wersja) : null });
  }

  // Ponowienie tej samej czynności (ten sam uczestnik, ten sam op): oddajemy to, co stało się za pierwszym razem,
  // zamiast oceniać ruch drugi raz w innym już świecie (po zmianie ustawienia obszaru albo po rozstrzygnięciu).
  // Inna czynność pod tym samym op to konflikt, nigdy cichy sukces.
  _powtorzenie(kto, c, widzi = null) {
    const akt = (op) => this.q(`SELECT a.nr, a.glowa, a.zapis, z.rodzaj, z.tresc FROM akty a JOIN zapisy z ON z.id = a.zapis WHERE a.kto = ? AND a.op = ? AND a.co = 'przesun'`, kto, op)[0];
    const a = akt(c.op + '.p');
    if (!a || !String(a.glowa).startsWith('rzecz:')) return null;
    const id = a.glowa.slice(6);
    // Rzecz, którą ta czynność kiedyś założyła albo zmieniła, mogła potem trafić tam, gdzie piszący jej nie widzi;
    // przy ruchu z okna czynności wszystkich otwierających mają wspólnego aktora, więc "ta sama czynność" bywa cudza.
    // Wtedy ponowienie nie oddaje uchwytu: mówi tylko, że op jest zajęty.
    if (widzi && !widzi(id)) return blad(409, 'ten op należy już do innej czynności; nowa czynność potrzebuje nowego op');
    let t = {};
    try { t = JSON.parse(a.tresc) || {}; } catch { /* zostaje puste */ }
    const cechy = t.cechy && typeof t.cechy === 'object' ? t.cechy : {};
    const konflikt = blad(409, 'ten op należy już do innej czynności; nowa czynność potrzebuje nowego op', { rzecz: id });
    const numer = this.historia(id).findIndex((h) => h.akt === a.nr) + 1;
    const wspolne = { ok: true, powtorzone: true, wersja: a.nr, ...(numer ? { numer } : {}) };
    if (c.co === 'przyjmij') {
      const b = akt(c.op + '.prop.p');
      if (!b || b.glowa !== 'rzecz:' + c.propozycja) return konflikt;
      return { ...wspolne, skutek: 'przyjeta', propozycja: c.propozycja, rzecz: id, adres: '/rzecz/' + id };
    }
    if (c.co === 'odrzuc') {
      if (a.rodzaj !== 'propozycja/1' || id !== c.propozycja) return konflikt;
      return { ...wspolne, skutek: cechy.stan, propozycja: id };
    }
    if (a.rodzaj === 'propozycja/1' && cechy.od === kto && cechy.co === c.co) {
      // Za pierwszym razem ruch stał się propozycją. To ta sama czynność, jeśli dotyczy tej samej rzeczy i treści.
      if ((c.rzecz || null) !== (cechy.rzecz || null)) return konflikt;
      if (c.co === 'poloz' && (cechy.rodzaj !== c.rodzaj || JSON.stringify(cechy.tresc && cechy.tresc.cechy) !== JSON.stringify(c.cechy))) return konflikt;
      return { ...wspolne, skutek: 'propozycja', propozycja: id, adres: '/rzecz/' + id };
    }
    if (c.rzecz && c.rzecz !== id) return konflikt;
    if (c.co === 'poloz' && (a.rodzaj !== c.rodzaj || JSON.stringify(cechy) !== JSON.stringify(c.cechy))) return konflikt;
    if (c.co === 'odloz' && t.odlozone !== true) return konflikt;
    if (c.co === 'przywroc' && t.odlozone === true) return konflikt;
    if (!Object.hasOwn(SKUTKI, c.co)) return konflikt;
    return { ...wspolne, skutek: SKUTKI[c.co], rzecz: id, adres: '/rzecz/' + id };
  }

  // Odłożenie, przywrócenie i cofnięcie do wcześniejszej wersji: każde jest nową wersją tej samej rzeczy.
  async _przestaw(kto, c, slad) {
    if (typeof c.rzecz !== 'string' || !ID.test(c.rzecz)) return blad(400, 'rzecz: identyfikator rzeczy (26 znaków)');
    if (!(Number.isInteger(c.wersja) || c.wersja === 'dowolna')) return blad(400, 'wersja: liczba z pola wersja Twojego ostatniego odczytu tej rzeczy albo "dowolna"');
    if ('powod' in c && typeof c.powod !== 'string') return blad(400, 'powod: napis');
    // Kolejność ma znaczenie: kto nie ma tu prawa, słyszy to także przy ponowieniu dawnej czynności, a ponowienie
    // oddaje uchwyt rzeczy tylko oczom, które ją widzą (niezależny atak, 17 XI 2026).
    const bez = this._bezPrawa(kto, przezZ(slad));
    if (bez) return bez;
    const widzi = this._oczy(kto, przezZ(slad));
    const byl = this._powtorzenie(kto, c, widzi);
    if (byl) return byl;
    const stara = widzi(c.rzecz);
    if (!stara) return blad(404, `nie ma rzeczy ${c.rzecz}`);
    const wersja = c.wersja === 'dowolna' ? stara.wersja : c.wersja;
    const wspolne = { stara, id: stara.id, wersja };
    if (c.co === 'odloz') {
      if (stara.odlozone) return blad(409, 'ta rzecz jest już odłożona');
      return this._zmien(kto, c.op, slad, { ...wspolne, co: 'odloz', rodzaj: stara.rodzaj, obszar: stara.obszar, cechy: stara.cechy, odlozone: true, powod: c.powod ? c.powod.slice(0, 2000) : null });
    }
    if (c.co === 'przywroc') {
      if (!stara.odlozone) return blad(409, 'ta rzecz nie jest odłożona');
      return this._zmien(kto, c.op, slad, { ...wspolne, co: 'przywroc', rodzaj: stara.rodzaj, obszar: stara.obszar, cechy: stara.cechy, odlozone: false, powod: null });
    }
    // cofnij: do wersji wskazanej znacznikiem `do` (pole akt z historii) albo do poprzedniej
    const h = this.historia(stara.id);
    let cel;
    if ('do' in c) {
      if (!Number.isInteger(c.do)) return blad(400, 'do: znacznik wcześniejszej wersji tej rzeczy (pole akt z jej historii)');
      cel = this.wersja(stara.id, c.do);
      // Dawna wersja niesie obszar, w którym rzecz wtedy leżała. Wersja z obszaru, którego piszący nie widzi, nie
      // istnieje dla niego tak samo jak przy czytaniu (`dla().wersja`): cofnięcie nie może być drogą do tego, czego
      // czytanie nie pokazuje, ani odmową, która nazywa zamknięty obszar.
      if (!cel || !widzi.dawna(cel)) return blad(404, `rzecz ${stara.id} nie ma wersji o znaczniku ${c.do}`);
    } else {
      if (h.length < 2) return blad(409, 'ta rzecz ma tylko jedną wersję; nie ma do czego cofnąć (żeby ją schować, użyj co: odloz)');
      const poprzednia = h.filter((x) => x.akt < stara.wersja).pop();
      cel = poprzednia ? this.wersja(stara.id, poprzednia.akt) : null;
      if (!cel) return blad(409, 'nie ma wcześniejszej wersji tej rzeczy');
      // Że poprzednia wersja jest, mówi sama historia (numery aktów są słyszalne); jej treści i obszaru nie mówimy.
      if (!widzi.dawna(cel)) return blad(409, 'poprzednia wersja tej rzeczy leży poza tym, do czego masz wstęp; wskaż wcześniejszą wersję znacznikiem do');
    }
    if (cel.akt === stara.wersja) return blad(409, 'to jest bieżąca wersja tej rzeczy; nie ma czego cofać');
    return this._zmien(kto, c.op, slad, { ...wspolne, co: 'cofnij', rodzaj: cel.rodzaj, obszar: cel.obszar, cechy: cel.cechy, odlozone: cel.odlozone, powod: cel.powod, zWersji: cel.akt });
  }

  // --- gest: wiele zmian jako jedna czynność ręki ------------------------------------------------------------------
  // Jedno przeciągnięcie, zamiana albo powrót do zapisanego układu rusza wiele rzeczy, a ręka chce to cofnąć jednym
  // krokiem (standard jakości właściciela: cofanie, także po przeładowaniu strony). Jądro nie zna gestu i nie musi:
  // ruch może nieść znak `gest`, a środowisko składa wtedy identyfikator czynności jądra jako g:<gest>:<op>. Klient
  // dwukropka w op użyć nie może, więc znak nie zderzy się ze zwykłym op, a akty jednego gestu jednego wykonawcy leżą
  // obok siebie w indeksie (kto, op). Cofnięcie gestu wraca każdej ruszonej rzeczy zapis sprzed gestu (rzecz, która
  // w geście powstała, odkłada), wszystko albo nic, i samo jest gestem, więc da się je ponowić. Cofa się tylko to,
  // czego nikt po geście nie ruszył: cofnięcie nie nadpisuje cudzej zmiany.
  _aktyGestu(kto, gest) {
    return this.q(`SELECT nr, glowa, z_zapisu, kiedy, cialo FROM akty WHERE kto = ? AND op >= ? AND op < ? AND co = 'przesun' AND glowa LIKE 'rzecz:%' ORDER BY nr`, kto, 'g:' + gest + ':', 'g:' + gest + ';');
  }
  _ostatnieGesty(kto, odAktu) {
    return this.q(`SELECT nr, op, glowa, kiedy FROM akty WHERE kto = ? AND op >= 'g:' AND op < 'g;' AND co = 'przesun' AND glowa LIKE 'rzecz:%' AND nr > ? ORDER BY nr DESC LIMIT 1000`, kto, odAktu);
  }
  // Stan rzeczy przy akcie o numerze `akt`: ostatnia wersja ustawiona nie później niż on; null, gdy rzeczy jeszcze nie było.
  _stanNa(id, akt) {
    const a = this.q(`SELECT nr, zapis FROM akty WHERE glowa = ? AND co = 'przesun' AND nr <= ? ORDER BY nr DESC LIMIT 1`, 'rzecz:' + id, akt)[0];
    if (!a) return null;
    const t = this._zeZapisu(a.zapis);
    return t ? { rzecz: id, akt: a.nr, ...t } : null;
  }
  _zeZapisu(zapis) {
    const z = this.q(`SELECT rodzaj, tresc FROM zapisy WHERE id = ?`, zapis)[0];
    return z ? this._zTresci(z.rodzaj, z.tresc) : null;
  }
  _zTresci(rodzaj, tresc) {
    let t = {};
    try { t = JSON.parse(tresc) || {}; } catch { /* zostaje puste */ }
    if (!t || typeof t !== 'object') t = {};
    return { rodzaj, obszar: t.obszar ?? null, ...(obszarNieznany(t) ? { obszar_nieznany: true } : {}), cechy: t.cechy && typeof t.cechy === 'object' && !Array.isArray(t.cechy) ? t.cechy : {}, odlozone: t.odlozone === true, powod: typeof t.powod === 'string' ? t.powod : null };
  }
  // Stany wielu rzeczy przy akcie `akt`: jedno pytanie na paczkę stu rzeczy zamiast dwóch pytań na każdą.
  _stanyNa(ids, akt) {
    const m = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const paczka = ids.slice(i, i + 100);
      const wiersze = this.q(`SELECT a.glowa, a.nr, z.rodzaj, z.tresc FROM akty a JOIN zapisy z ON z.id = a.zapis WHERE a.co = 'przesun' AND a.glowa IN (${paczka.map(() => '?').join(',')}) AND a.nr = (SELECT MAX(b.nr) FROM akty b WHERE b.glowa = a.glowa AND b.co = 'przesun' AND b.nr <= ?)`, ...paczka.map((id) => 'rzecz:' + id), akt);
      for (const w of wiersze) m.set(w.glowa.slice(6), { rzecz: w.glowa.slice(6), akt: w.nr, ...this._zTresci(w.rodzaj, w.tresc) });
    }
    return m;
  }

  // Co gest ruszył: dla każdej rzeczy zapis sprzed gestu (null: powstała w nim) i akt, którym gest ją zostawił.
  // `przez`: gdy pyta okno narzędzia, liczą się tylko akty zrobione przez okno otwarte przez tego samego uczestnika.
  // Wykonawcą gestu z okna jest gość, wspólny dla wszystkich, którzy je otwierają: bez tego każdy otwierający cofałby
  // gesty pozostałych (niezależny atak, 18 XI 2026).
  gestDla(kto, gest, przez = undefined) {
    if (typeof gest !== 'string' || !GEST.test(gest) || !poprawneImie(kto)) return [];
    const m = new Map();
    for (const a of this._aktyGestu(kto, gest)) {
      if (typeof przez === 'string' && !(a.cialo === 'okno:' + przez || String(a.cialo || '').startsWith('okno:' + przez + ' '))) continue;
      const id = a.glowa.slice(6), x = m.get(id);
      if (!x) m.set(id, { rzecz: id, przed: a.z_zapisu ?? null, po: a.nr, kiedy: new Date(a.kiedy).toISOString() });
      else { x.po = a.nr; x.kiedy = new Date(a.kiedy).toISOString(); }
    }
    return [...m.values()];
  }

  // Ostatnie gesty uczestnika, od najnowszego: znak, ile rzeczy ruszył, kiedy i którym aktem się skończył.
  gestyDla(kto, ile = 20) {
    if (!poprawneImie(kto)) return [];
    const m = new Map();
    // lista do guzika "cofnij": patrzy na ostatnie 5000 aktów Miejsca i najwyżej 1000 aktów gestów pytającego
    for (const a of this._ostatnieGesty(kto, Math.max(0, this.ostatniNr() - 5000))) {
      const gest = String(a.op).split(':')[1];
      let g = m.get(gest);
      if (!g) { if (m.size >= Math.max(1, Math.min(100, ile | 0 || 20))) continue; g = { gest, rzeczy: new Set(), akt: a.nr, kiedy: new Date(a.kiedy).toISOString() }; m.set(gest, g); }
      g.rzeczy.add(a.glowa);
    }
    return [...m.values()].map((g) => ({ ...g, rzeczy: g.rzeczy.size }));
  }

  // Położenia widoku takie, jakie były przy akcie `akt` (to, co doszło później, jeszcze nie istnieje; to, co było
  // wtedy odłożone, nie jest pokazane). Z `dla`: oczami czytającego, tak jak dawna wersja rzeczy - chwila, w której
  // widok leżał w obszarze niewidocznym dla czytającego, nie jest dla niego do odczytania.
  widokNa(widok, akt, { dla = undefined } = {}) {
    if (typeof widok !== 'string' || !ID.test(widok) || !Number.isInteger(akt) || akt < 0) return [];
    if (dla !== undefined) {
      if (this.rzecz(widok, { dla }) === null) return [];
      const zle = this._niewidoczneDla(dla), wtedy = this._stanNa(widok, akt);
      if (!wtedy || (zle && zle.includes(wtedy.obszar ?? null))) return [];
    }
    const polozenia = this.wszystkie({ rodzaj: 'miejsce', gdzie: { widok }, odlozone: 'razem', ...(dla === undefined ? {} : { dla }) });
    // Ta sama granica co przy powrocie do układu: czytanie bez granicy kosztowało dwa pytania na każde położenie i mógł
    // je wymusić każdy, kto zna adres widoku (niezależny atak, 18 XI 2026).
    if (polozenia.length > NAJWIECEJ_W_GESCIE) return blad(413, `widok ma ${polozenia.length} położeń, a w jednej chwili pokazuje się najwyżej ${NAJWIECEJ_W_GESCIE}`);
    const zle = dla === undefined ? null : this._niewidoczneDla(dla);
    const widac = (d) => !zle || !zle.length || (!d.obszar_nieznany && !zle.includes(d.obszar ?? null));
    const wynik = [], stany = this._stanyNa(polozenia.map((rz) => rz.id), akt);
    for (const rz of polozenia) {
      const d = stany.get(rz.id);
      if (d && !d.odlozone && widac(d)) wynik.push({ rzecz: rz.id, akt: d.akt, cechy: d.cechy });
    }
    return wynik;
  }

  // Zapis wielu rzeczy naraz, wszystko albo nic. `cele`: [{ rz, rodzaj, obszar, cechy, odlozone, powod }], gdzie rz
  // to rzecz w stanie dzisiejszym. Każda zmiana przechodzi to samo sprawdzenie treści i tę samą ocenę prawa co zwykły
  // ruch i każda musi mieć skutek: czynność, która w części byłaby propozycją, nie robi się wcale.
  async _zapiszWiele(kto, op, slad, cele, wynik) {
    const przez = przezZ(slad), widzi = this._oczy(kto, przez);
    const lista = [];
    for (const [i, c] of cele.entries()) {
      let { rodzaj, obszar, cechy, odlozone, powod } = c;
      const n = this._zNatury(rodzaj, cechy);
      if (n && !n.brak) obszar = n.obszar;
      const wn = this._wadaNatury(rodzaj, cechy, c.rz.id, widzi);
      if (wn) return blad(409, `rzecz ${c.rz.id} nie może wrócić do tamtego stanu: ${wn}`, { rzecz: c.rz.id });
      const spr = this._sprawdzTresc(rodzaj, cechy, obszar, c.rz, odlozone, widzi);
      if (!spr.ok) return blad(409, `rzecz ${c.rz.id} nie przechodzi dzisiejszego sprawdzenia w stanie, do którego miała wrócić: ${spr.blad}`, { rzecz: c.rz.id });
      for (const k of [kto, ...(przez ? [przez] : [])]) {
        const o = this.ocen(k, { stara: c.rz, rodzaj, obszar, cechy });
        if (o.tryb !== 'skutek') return blad(o.tryb === 'odmowa' ? o.status : 403, `tej czynności nie da się zrobić w całości: zmiana rzeczy ${c.rz.id} nie miałaby tu skutku${o.powod ? ' (' + o.powod + ')' : ''}`, { rzecz: c.rz.id });
      }
      const p = await this.r.przygotujPolozenie({ op: `${op}.${i}`, rodzaj, tresc: trescRzeczy({ obszar, cechy, odlozone, powod, zNatury: n ? n.cecha : null }), glowa: 'rzecz:' + c.rz.id, wersja: c.rz.wersja });
      if (!p.ok) return p;
      lista.push({ p, id: c.rz.id, rodzaj, obszar, cechy, odlozone, ksztalt: spr.ksztalt });
    }
    if (!lista.length) return { ok: true, powtorzone: false, ...wynik, rzeczy: 0 };
    return this._zatwierdz(kto, lista, slad, { ...wynik, rzeczy: lista.length });
  }
  // Czy ta czynność (ten uczestnik, ten op) już raz coś zapisała: wtedy jej ponowienie niczego nie robi drugi raz.
  _juzZapisala(kto, op) { return this.q(`SELECT 1 AS j FROM akty WHERE kto = ? AND op = ?`, kto, op + '.0.p').length > 0; }

  async _cofnijGest(kto, c, slad) {
    if (typeof c.cofany !== 'string' || !GEST.test(c.cofany)) return blad(400, 'cofany: znak gestu, który ma być cofnięty (ten sam, który niosły jego ruchy w polu gest)');
    const bez = this._bezPrawa(kto, przezZ(slad));
    if (bez) return bez;
    if (this._juzZapisala(kto, c.op)) return { ok: true, powtorzone: true, skutek: 'cofniety-gest', gest: c.cofany };
    let czyj = kto;
    if ('czyj' in c) {
      if (this.rola(kto) !== 'wlasciciel') return blad(403, 'cudzy gest cofa tylko właściciel');
      if (!poprawneImie(c.czyj)) return blad(400, 'czyj: imię uczestnika, którego gest ma być cofnięty');
      czyj = c.czyj;
    }
    const ruszone = this.gestDla(czyj, c.cofany, 'czyj' in c ? undefined : (przezZ(slad) || undefined));
    if (!ruszone.length) return blad(404, `nie ma gestu ${c.cofany} wśród czynności uczestnika ${czyj}`);
    if (ruszone.length > NAJWIECEJ_W_GESCIE) return blad(413, `gest ruszył ${ruszone.length} rzeczy, a jednym krokiem cofa się najwyżej ${NAJWIECEJ_W_GESCIE}`);
    const widzi = this._oczy(kto, przezZ(slad));
    const zmienione = [], cele = [];
    for (const x of ruszone) {
      const rz = widzi(x.rzecz);
      if (!rz || rz.wersja !== x.po) { zmienione.push(x.rzecz); continue; }
      if (x.przed === null) { if (!rz.odlozone) cele.push({ rz, rodzaj: rz.rodzaj, obszar: rz.obszar, cechy: rz.cechy, odlozone: true, powod: 'cofnięty gest, w którym ta rzecz powstała' }); continue; }
      const d = this._zeZapisu(x.przed);
      if (!d || !widzi.dawna(d)) { zmienione.push(x.rzecz); continue; }
      cele.push({ rz, ...d });
    }
    if (zmienione.length) return blad(409, `${zmienione.length === 1 ? 'jedna rzecz z tego gestu zmieniła się' : 'część rzeczy z tego gestu zmieniła się'} po nim (albo nie jest już dla Ciebie dostępna); cofnięcie całego gestu nadpisałoby późniejszą zmianę, więc nie cofam niczego`, { zmienione });
    return this._zapiszWiele(kto, c.op, slad, cele, { skutek: 'cofniety-gest', gest: c.cofany });
  }

  // Powrót do zapisanego układu (rzecz chwila/1: nazwa, widok, akt): położenia widoku wracają do stanu z tamtej chwili.
  // Zapisuje się tylko różnica, jedną czynnością; ze znakiem gestu sam powrót daje się cofnąć.
  async _przywrocUklad(kto, c, slad) {
    if (typeof c.chwila !== 'string' || !ID.test(c.chwila)) return blad(400, 'chwila: identyfikator zapisanego układu (rzecz rodzaju chwila/1)');
    const bez = this._bezPrawa(kto, przezZ(slad));
    if (bez) return bez;
    if (this._juzZapisala(kto, c.op)) return { ok: true, powtorzone: true, skutek: 'przywrocony-uklad', chwila: c.chwila };
    const widzi = this._oczy(kto, przezZ(slad));
    const ch = widzi(c.chwila);
    if (!ch || nazwaRodzaju(ch.rodzaj) !== 'chwila' || ch.odlozone) return blad(404, `nie ma zapisanego układu ${c.chwila}`);
    const { akt, widok } = ch.cechy;
    if (!Number.isInteger(akt) || akt < 0 || akt > this.ostatniNr()) return blad(422, 'zapisany układ wskazuje akt, którego w tym Miejscu nie ma');
    const polozenia = this.wszystkie({ rodzaj: 'miejsce', gdzie: { widok }, odlozone: 'razem' });
    if (polozenia.length > NAJWIECEJ_W_GESCIE) return blad(413, `widok ma ${polozenia.length} położeń, a jedną czynnością wraca najwyżej ${NAJWIECEJ_W_GESCIE}`);
    const cele = [], stany = this._stanyNa(polozenia.map((p) => p.id), akt);
    for (const p of polozenia) {
      const rz = widzi(p.id);
      if (!rz) continue;
      const d = stany.get(rz.id) || null;
      // układ z chwili, w której położenia leżały poza tym, do czego piszący ma wstęp, nie jest drogą do tamtej przeszłości
      if (d && !widzi.dawna(d)) return blad(409, 'zapisany układ sięga chwili, w której te położenia leżały poza tym, do czego masz wstęp; nie przywracam niczego');
      if (!d) { if (!rz.odlozone) cele.push({ rz, rodzaj: rz.rodzaj, obszar: rz.obszar, cechy: rz.cechy, odlozone: true, powod: 'nie było tego położenia w przywróconym układzie' }); continue; }
      if (d.rodzaj === rz.rodzaj && d.odlozone === !!rz.odlozone && JSON.stringify(d.cechy) === JSON.stringify(rz.cechy)) continue;
      cele.push({ rz, ...d });
    }
    return this._zapiszWiele(kto, c.op, slad, cele, { skutek: 'przywrocony-uklad', chwila: ch.id, akt });
  }

  // Wspólny koniec każdej zmiany rzeczy: sprawdzenie treści, ocena prawa, potem zapis albo propozycja.
  async _zmien(kto, op, slad, { co, stara, id, rodzaj, obszar, cechy, odlozone, powod, wersja, zWersji = null }) {
    // Jedno miejsce dla wszystkich dróg zmiany (połóż, odłóż, przywróć, cofnij): rzecz, która z natury należy do innej,
    // leży tam, gdzie tamta leży dziś, a nie tam, gdzie leżała, gdy powstawała wersja, do której wracamy.
    const n = this._zNatury(rodzaj, cechy);
    if (n && !n.brak) obszar = n.obszar;
    const zNatury = n ? n.cecha : null;
    if (co === 'cofnij' || co === 'przywroc') {
      const wn = this._wadaNatury(rodzaj, cechy, stara ? stara.id : null, this._oczy(kto, przezZ(slad)));
      if (wn) return blad(409, 'dawna wersja nie przechodzi dzisiejszego sprawdzenia: ' + wn);
    }
    const spr = this._sprawdzTresc(rodzaj, cechy, obszar, stara, odlozone, this._oczy(kto, przezZ(slad)));
    if (!spr.ok) return co === 'cofnij' ? blad(409, 'dawna wersja nie przechodzi dzisiejszego sprawdzenia: ' + spr.blad, { bledy: spr.bledy }) : spr;
    let ocena = this.ocen(kto, { stara, rodzaj, obszar, cechy });
    // Okno nie ma więcej prawa niż ten, kto je otworzył: z dwóch ocen (gościa i otwierającego) wygrywa słabsza.
    const przez = przezZ(slad);
    if (przez && ocena.tryb !== 'odmowa') {
      const jego = this.ocen(przez, { stara, rodzaj, obszar, cechy });
      if (jego.tryb === 'odmowa' || (jego.tryb === 'propozycja' && ocena.tryb === 'skutek')) ocena = jego;
    }
    if (ocena.tryb === 'odmowa') return blad(ocena.status, ocena.powod);
    const uwagi = { ...(spr.nieznane.length ? { nieznane_cechy: spr.nieznane } : {}), ...(spr.bezKsztaltu ? { uwaga: `rodzaj ${rodzaj} nie ma kształtu: rzecz jest zapisana i widoczna, ale niczego w niej nie sprawdzono` } : {}) };
    if (ocena.tryb === 'skutek') {
      const p = await this.r.przygotujPolozenie({ op, rodzaj, tresc: trescRzeczy({ obszar, cechy, odlozone, powod, zNatury }), glowa: 'rzecz:' + id, wersja: stara ? wersja : null });
      if (!p.ok) return p;
      return this._zatwierdz(kto, [{ p, id, rodzaj, obszar, cechy, odlozone, ksztalt: spr.ksztalt }], slad,
        { skutek: SKUTKI[co], rzecz: id, adres: '/rzecz/' + id, ...(zWersji ? { z_wersji: zWersji } : {}), ...uwagi });
    }
    // Propozycja kosztuje uwagę właściciela, więc jeden uczestnik nie może ich mnożyć bez końca: jedna czekająca na
    // rzecz i najwyżej NAJWIECEJ_CZEKAJACYCH naraz (uwaga drugiej linii do PR 35: agent w pętli zalałby listę "czeka").
    if (stara) {
      // przy ruchu z okna "ta sama propozycja" to ta sama rzecz, ten sam gość i ten sam otwierający: gość jest wspólny
      // dla wszystkich, którzy otwierają to okno
      const juz = this.spis({ rodzaj: 'propozycja/1', gdzie: { od: kto, stan: 'czeka', rzecz: stara.id, ...(przez ? { przez } : {}) }, limit: 1 })[0];
      if (juz) return blad(409, `masz już czekającą propozycję zmiany tej rzeczy (${juz.id}); wycofaj ją (co: odrzuc) albo poczekaj na rozstrzygnięcie`, { propozycja: juz.id });
    }
    // Jeden licznik na uczestnika: jego propozycje złożone wprost i te z okien, które otworzył, razem. Przy ruchu
    // z okna liczy się otwierający, nie gość: gość jest wspólny dla wszystkich otwierających, więc licznik na gościa
    // pozwalał jednemu uczestnikowi zająć limit całego narzędzia (okno właściciela dostawało 429), a dwa osobne
    // liczniki dawały jednemu uczestnikowi dwa limity naraz (niezależny atak, 17 XI 2026).
    const czyja = przez || kto;
    const czeka = this.ile({ rodzaj: 'propozycja/1', gdzie: { od: czyja, stan: 'czeka' } }) + this.ile({ rodzaj: 'propozycja/1', gdzie: { przez: czyja, stan: 'czeka' } });
    if (czeka >= NAJWIECEJ_CZEKAJACYCH) return blad(429, przez
      ? `z ruchów uczestnika ${przez} i z okien, które otworzył, czeka już ${NAJWIECEJ_CZEKAJACYCH} propozycji; najpierw trzeba je rozstrzygnąć`
      : `masz już ${NAJWIECEJ_CZEKAJACYCH} czekających propozycji (razem z tymi z okien, które otworzyłeś); wycofaj którąś (co: odrzuc) albo poczekaj, aż zostaną rozstrzygnięte`);
    // propozycja: leży tam, gdzie leży rzecz, której dotyczy (albo tam, gdzie miała powstać nowa)
    const propId = await idZ('propozycja', kto, op);
    const obszarProp = stara ? stara.obszar : obszar;
    const cp = { od: kto, ...(przez ? { przez } : {}), co, rodzaj, tresc: { obszar: obszar ?? null, cechy, ...(odlozone ? { odlozone: true, ...(powod ? { powod } : {}) } : {}) },
      ...(stara ? { rzecz: stara.id, wersja } : { nowa: id }), stan: 'czeka', ...(ocena.wymaga === 'wlasciciel' ? { wymaga: 'wlasciciel' } : {}), ...this._przypiete(rodzaj, cechy) };
    const p = await this.r.przygotujPolozenie({ op, rodzaj: 'propozycja/1', tresc: trescRzeczy({ obszar: obszarProp, cechy: cp }), glowa: 'rzecz:' + propId, wersja: null });
    if (!p.ok) return p;
    return this._zatwierdz(kto, [{ p, id: propId, rodzaj: 'propozycja/1', obszar: obszarProp, cechy: cp, odlozone: false, ksztalt: this.ksztaltDla('propozycja/1') }], slad,
      { skutek: 'propozycja', propozycja: propId, adres: '/rzecz/' + propId, powod: ocena.powod, kto_przyjmuje: ocena.wymaga === 'wlasciciel' ? 'wlasciciel' : 'wlasciciel albo uczestnik, który sam mógłby zrobić ten ruch ze skutkiem', ...uwagi });
  }

  // Propozycja, która włącza zestawy, pamięta ich wersje z chwili złożenia: kto ją przyjmuje, przyjmuje to, co oglądał
  // (linia wyglądu, 18 XI 2026: on przyjmuje motyw, który zobaczył; niezależny atak, 17 XI: autor mógł zmienić zestaw
  // między propozycją a przyjęciem).
  _przypiete(rodzaj, cechy) {
    if (rodzaj !== 'wartosc/1' || cechy.pokretlo !== POKRETLO_ZESTAWOW || !Array.isArray(cechy.wartosc)) return {};
    const p = {};
    for (const id of cechy.wartosc) { const z = typeof id === 'string' ? this.rzecz(id) : null; if (z && z.rodzaj === 'zestaw/1') p[id] = z.wersja; }
    return Object.keys(p).length ? { przypiete: p } : {};
  }

  _zatwierdz(kto, lista, slad, wynik) {
    const z = this.r.zatwierdzPolozenia(kto, lista.map((x) => x.p), { slad: sladZ(slad) });
    if (!z.ok) return z;
    if (!z.powtorzone) lista.forEach((x, i) => this._projekcja(x.id, x.rodzaj, x.obszar, x.p.id, z.wyniki[i].wersja, kto, x.cechy, x.ksztalt, x.odlozone, z.wyniki[i].kiedy));
    const pierwsza = this.rzecz(lista[0].id);
    return { ok: true, powtorzone: z.powtorzone, ...wynik, wersja: pierwsza ? pierwsza.wersja : z.wyniki[0].wersja, ...(pierwsza ? { numer: pierwsza.numer } : {}) };
  }

  // Wiersz spisu dla jednej rzeczy. Czas bierze z aktu, nie z chwili liczenia, żeby spis odbudowany z dziennika
  // był co do znaku taki sam jak spis liczony na bieżąco.
  _projekcja(id, rodzaj, obszar, zapis, akt, kto, cechy, ksztalt, odlozone = false, kiedy = null) {
    const t = kiedy ?? this.r.teraz();
    // Przekrój spisu idzie za zapisem: gdy rzecz zmienia przegródkę (nowa rzecz, inny obszar, odłożenie, przywrócenie),
    // wychodzi ze starej i wchodzi do nowej, w tabeli i w pamięci. Zmiana samej treści przegródki nie rusza.
    const bylo = this.q(`SELECT rodzaj, obszar, odlozone FROM rzeczy WHERE id = ?`, id)[0] || null;
    const nowa = [rodzaj, obszar ?? '', odlozone ? 1 : 0];
    const stara = bylo ? [bylo.rodzaj, bylo.obszar ?? '', bylo.odlozone ? 1 : 0] : null;
    if (!stara || stara[0] !== nowa[0] || stara[1] !== nowa[1] || stara[2] !== nowa[2]) {
      if (stara) this.r.sql.exec(`UPDATE przekroj SET ile = ile - 1 WHERE rodzaj = ? AND obszar = ? AND odlozone = ?`, ...stara);
      this.r.sql.exec(`INSERT INTO przekroj (rodzaj, obszar, odlozone, ile) VALUES (?, ?, ?, 1) ON CONFLICT(rodzaj, obszar, odlozone) DO UPDATE SET ile = ile + 1`, ...nowa);
      if (this._prz) {
        if (stara) doliczPrzekroj(this._prz, bylo.rodzaj, bylo.obszar, bylo.odlozone, -1);
        doliczPrzekroj(this._prz, rodzaj, obszar ?? null, odlozone ? 1 : 0, 1);
      }
    }
    this.r.sql.exec(`INSERT INTO rzeczy (id, rodzaj, obszar, zapis, akt, numer, odlozone, szukane, utworzyl, utworzono, zmienil, zmieniono) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rodzaj = excluded.rodzaj, obszar = excluded.obszar, zapis = excluded.zapis, akt = excluded.akt, numer = rzeczy.numer + 1,
        odlozone = excluded.odlozone, szukane = excluded.szukane, zmienil = excluded.zmienil, zmieniono = excluded.zmieniono`,
      id, rodzaj, obszar ?? null, zapis, akt, odlozone ? 1 : 0, doSzukania(cechy), kto, t, kto, t);
    this._odniesienia(id, rodzaj, cechy, ksztalt);
    // Rzeczy, które z natury leżą z tą rzeczą, idą za nią w tej samej chwili (ich zapisy się nie zmieniają, bo obszaru
    // nie niosą). Inaczej po przeniesieniu widoku jego położenia zostawałyby w starym obszarze i pod starym prawem.
    if (bylo && (bylo.obszar ?? null) !== (obszar ?? null)) this._pociagnij(id, obszar ?? null);
    // Nowy albo zmieniony kształt zmienia to, które cechy są odniesieniami: rzeczy tego rodzaju liczymy od nowa,
    // inaczej spis zależałby od kolejności, w jakiej powstały rzecz i jej kształt.
    if (rodzaj === 'ksztalt/1' && typeof cechy.dla === 'string') {
      this._k = null;
      const k = this.ksztaltDla(cechy.dla);
      for (const rz of this.wszystkie({ rodzaj: cechy.dla, odlozone: 'razem' })) this._odniesienia(rz.id, rz.rodzaj, rz.cechy, k);
      // kształt, który każe rzeczom leżeć z inną rzeczą, zastał już rzeczy tego rodzaju: dostają obszar z natury
      if (typeof cechy.lezy_z === 'string') this.wyrownajZNatury();
    }
  }

  _odniesienia(id, rodzaj, cechy, ksztalt) {
    this.r.sql.exec(`DELETE FROM odniesienia WHERE od = ?`, id);
    const odn = odniesieniaZCech(ksztalt, cechy);
    if (rodzaj === 'propozycja/1' && typeof cechy.rzecz === 'string' && ID.test(cechy.rzecz) && !odn.some(([, c]) => c === cechy.rzecz)) odn.push(['rzecz', cechy.rzecz]);
    // Wartość, która włącza zestawy w zasięgu, wskazuje je: zmiana zestawu musi wiedzieć, w których zasięgach działa.
    if (rodzaj === 'wartosc/1' && cechy.pokretlo === POKRETLO_ZESTAWOW && Array.isArray(cechy.wartosc)) for (const z of cechy.wartosc) if (typeof z === 'string' && ID.test(z)) odn.push(['wartosc', z]);
    const byly = new Set();
    for (const [cecha, cel] of odn) {
      if (byly.has(cecha + '|' + cel)) continue;
      byly.add(cecha + '|' + cel);
      this.r.sql.exec(`INSERT INTO odniesienia (od, cecha, cel) VALUES (?, ?, ?)`, id, cecha, cel);
    }
  }

  async _rozstrzygnij(kto, c, slad) {
    if (typeof c.propozycja !== 'string' || !ID.test(c.propozycja)) return blad(400, 'propozycja: identyfikator propozycji (26 znaków)');
    if ('powod' in c && typeof c.powod !== 'string') return blad(400, 'powod: napis');
    const rola = this.rola(kto);
    if (rola === 'zwiedzajacy') return blad(401, this.powodBrakuPrawa(kto, 'do rozstrzygnięcia propozycji'));
    // Propozycję z obszaru, którego rozstrzygający nie widzi, zna tylko jej autor (i ten, kto otworzył okno, z którego
    // wyszła): może ją wycofać. Dla każdego innego brzmi jak propozycja, której nie ma.
    const widzi = this._oczy(kto);
    const byl = this._powtorzenie(kto, c, widzi);
    if (byl) return byl;
    const surowa = this.rzecz(c.propozycja);
    const swoja = !!surowa && surowa.rodzaj === 'propozycja/1' && (surowa.cechy.od === kto || surowa.cechy.przez === kto);
    const pr = swoja ? surowa : widzi(c.propozycja);
    if (!pr || pr.rodzaj !== 'propozycja/1') return blad(404, `nie ma propozycji ${c.propozycja}`);
    if (pr.cechy.stan !== 'czeka') return blad(409, `ta propozycja jest już rozstrzygnięta: ${pr.cechy.stan}`);
    const t = pr.cechy.tresc && typeof pr.cechy.tresc === 'object' ? pr.cechy.tresc : {};
    const cechy = t.cechy && typeof t.cechy === 'object' && !Array.isArray(t.cechy) ? t.cechy : {};
    // Propozycja pamięta obszar z chwili, w której powstała. Rzecz, która z natury należy do innej, bierze go z tamtej
    // dzisiaj: inaczej właściciel własnym przyjęciem zakładałby rzecz tam, gdzie jej rodzic już nie leży.
    const zn = this._zNatury(pr.cechy.rodzaj, cechy);
    const obszar = zn && !zn.brak ? zn.obszar : (t.obszar ?? null);
    const stara = pr.cechy.rzecz ? widzi(pr.cechy.rzecz) : null;
    // Propozycję z okna może wycofać także ten, kto okno otworzył (i tak jak autor nie może jej sam przyjąć).
    const autor = kto === pr.cechy.od || (typeof pr.cechy.przez === 'string' && kto === pr.cechy.przez);
    // Kto rozstrzyga: właściciel, albo uczestnik, który ten sam ruch mógłby zrobić sam ze skutkiem. Autor może swoją
    // propozycję tylko wycofać.
    const sam = rola === 'wlasciciel' ? { tryb: 'skutek' } : this.ocen(kto, { stara: stara || null, rodzaj: pr.cechy.rodzaj, obszar, cechy });
    const kiedy = new Date(this.r.teraz()).toISOString();
    const ksztaltProp = this.ksztaltDla('propozycja/1');
    if (c.co === 'odrzuc') {
      if (!autor && sam.tryb !== 'skutek') return blad(403, 'propozycję odrzuca właściciel, uczestnik, który sam mógłby zrobić ten ruch ze skutkiem, albo jej autor (wycofanie)');
      const nc = { ...pr.cechy, stan: autor && rola !== 'wlasciciel' ? 'wycofana' : 'odrzucona', rozstrzygnal: kto, rozstrzygnieto: kiedy, ...(c.powod ? { powod: c.powod.slice(0, 2000) } : {}) };
      const p = await this.r.przygotujPolozenie({ op: c.op, rodzaj: 'propozycja/1', tresc: trescRzeczy({ obszar: pr.obszar, cechy: nc }), glowa: 'rzecz:' + pr.id, wersja: pr.wersja });
      if (!p.ok) return p;
      return this._zatwierdz(kto, [{ p, id: pr.id, rodzaj: 'propozycja/1', obszar: pr.obszar, cechy: nc, odlozone: false, ksztalt: ksztaltProp }], slad, { skutek: nc.stan, propozycja: pr.id });
    }
    if (autor && rola !== 'wlasciciel') return blad(403, 'autor nie przyjmuje własnej propozycji');
    if (sam.tryb !== 'skutek') return blad(403, 'propozycję przyjmuje właściciel albo uczestnik, który sam mógłby zrobić ten ruch ze skutkiem' + (sam.powod ? ` (${sam.powod})` : ''));
    if (pr.cechy.rzecz && !stara) return blad(409, 'rzecz, której dotyczy propozycja, już nie istnieje pod tym identyfikatorem');
    if (stara && stara.wersja !== pr.cechy.wersja) return blad(409, 'rzecz zmieniła się od czasu propozycji; odrzuć ją albo poproś o nową', { wersja: stara.wersja });
    // Zestawy przypięte przy propozycji: gdy któryś zmienił się albo zniknął, przyjęcie odmawia i mówi który. Przyjmujący
    // może obejrzeć dzisiejszą wersję i przyjąć świadomie (mimo_zmian: true).
    if (pr.cechy.przypiete && typeof pr.cechy.przypiete === 'object' && c.mimo_zmian !== true) {
      const zmienione = [];
      for (const [zid, wersja] of Object.entries(pr.cechy.przypiete)) {
        const z = widzi(zid);
        if (!z || z.odlozone || z.wersja !== wersja) zmienione.push({ rzecz: zid, nazwa: z ? this.tytul(z) : null, byla: wersja, jest: z && !z.odlozone ? z.wersja : null });
      }
      if (zmienione.length) return blad(409, `od chwili, gdy złożono tę propozycję, zmieniło się to, co ma włączyć: ${zmienione.map((x) => (x.nazwa ? `zestaw "${x.nazwa}"` : `zestaw ${x.rzecz}`) + (x.jest === null ? ' (już go nie ma)' : '')).join(', ')}; obejrzyj dzisiejszą wersję i przyjmij z "mimo_zmian": true albo odrzuć`, { zmienione });
    }
    const id = stara ? stara.id : (typeof pr.cechy.nowa === 'string' && ID.test(pr.cechy.nowa) ? pr.cechy.nowa : await idZ('przyjeta', pr.id));
    if (!stara && this.rzecz(id)) return blad(409, 'rzecz, którą ta propozycja miała założyć, powstała w międzyczasie inną drogą; odrzuć propozycję albo poproś o nową', { rzecz: id });
    const odlozone = t.odlozone === true;
    const spr = this._sprawdzTresc(pr.cechy.rodzaj, cechy, obszar, stara, odlozone, widzi);
    if (!spr.ok) return blad(spr.status, 'propozycja nie przechodzi dzisiejszego sprawdzenia: ' + spr.blad);
    const p1 = await this.r.przygotujPolozenie({ op: c.op, rodzaj: pr.cechy.rodzaj, tresc: trescRzeczy({ obszar, cechy, odlozone, powod: typeof t.powod === 'string' ? t.powod : null, zNatury: zn ? zn.cecha : null }), glowa: 'rzecz:' + id, wersja: stara ? stara.wersja : null });
    if (!p1.ok) return p1;
    const nc = { ...pr.cechy, stan: 'przyjeta', rozstrzygnal: kto, rozstrzygnieto: kiedy, wynik: id };
    const p2 = await this.r.przygotujPolozenie({ op: c.op + '.prop', rodzaj: 'propozycja/1', tresc: trescRzeczy({ obszar: pr.obszar, cechy: nc }), glowa: 'rzecz:' + pr.id, wersja: pr.wersja });
    if (!p2.ok) return p2;
    return this._zatwierdz(kto, [
      { p: p1, id, rodzaj: pr.cechy.rodzaj, obszar, cechy, odlozone, ksztalt: spr.ksztalt },
      { p: p2, id: pr.id, rodzaj: 'propozycja/1', obszar: pr.obszar, cechy: nc, odlozone: false, ksztalt: ksztaltProp },
    ], slad, { skutek: 'przyjeta', propozycja: pr.id, rzecz: id, adres: '/rzecz/' + id });
  }

  // Kod gościa: niezmienny zapis rodzaju kod/1. Wskazuje go cecha `kod` rzeczy rodzaju gosc/1.
  async kod(kto, tekst, { op, slad = null } = {}) {
    const rola = this.rola(kto);
    if (rola === 'zwiedzajacy') return blad(401, this.powodBrakuPrawa(kto, 'do zapisania kodu'));
    if (kto === AUTOMAT) return blad(403, `imię ${AUTOMAT} jest zastrzeżone dla samego środowiska`);
    if (typeof tekst !== 'string' || !tekst.trim()) return blad(400, 'ciało żądania: tekst strony gościa (jeden plik HTML)');
    if (!opKlienta(op)) return blad(400, 'op: w adresie, ?op=<8 do 100 znaków z [A-Za-z0-9_-]>');
    return this._wKolejce(async () => {
      const w = await this.r.wykonaj(kto, { op: op + '.kod', co: 'zapisz', rodzaj: 'kod/1', tresc: tekst }, { slad });
      if (!w.ok) return w;
      return { ok: true, powtorzone: w.powtorzone, zapis: w.zapis ?? w.akt.zapis, adres: '/gosc/' + (w.zapis ?? w.akt.zapis), rozmiar: new TextEncoder().encode(tekst).length };
    });
  }

  // Kod wychodzi pod adresem dopiero wtedy, gdy wskazuje go jakiś gość (rzecz rodzaju gosc): sam zapis, którego nikt
  // nie zgłosił jako gościa, nie jest stroną, a odgadnięty identyfikator niczego nie otwiera.
  kodGoscia(zapis) {
    if (typeof zapis !== 'string' || !ZAPIS.test(zapis)) return null;
    const z = this.q(`SELECT rodzaj, tresc FROM zapisy WHERE id = ?`, zapis)[0];
    if (!z || z.rodzaj !== 'kod/1') return null;
    const wskazany = this.q(`SELECT 1 AS j FROM rzeczy r JOIN zapisy t ON t.id = r.zapis WHERE substr(r.rodzaj, 1, 5) = 'gosc/' AND r.odlozone = 0 AND json_extract(t.tresc, '$.cechy.kod') = ? LIMIT 1`, zapis).length > 0;
    return wskazany ? z.tresc : null;
  }

  // --- co czeka na właściciela ------------------------------------------------------------------------------------
  czeka() {
    return { propozycje: this.wszystkie({ rodzaj: 'propozycja/1', gdzie: { stan: 'czeka' } }), prosby: this.wszystkie({ rodzaj: 'prosba/1', gdzie: { stan: 'czeka' } }) };
  }

  // Odbudowa spisu z samych głów i dziennika (po wwozie albo gdy tabele spisu zginą).
  przebuduj() {
    this.r.sql.exec(`DELETE FROM rzeczy`);
    this.r.sql.exec(`DELETE FROM odniesienia`);
    const glowy = this.q(`SELECT g.nazwa, g.zapis, g.akt, z.rodzaj, z.tresc FROM glowy g JOIN zapisy z ON z.id = g.zapis WHERE g.nazwa LIKE 'rzecz:%' ORDER BY g.akt`);
    for (const g of glowy) {
      const id = g.nazwa.slice(6);
      let t = {};
      try { t = JSON.parse(g.tresc); } catch { /* zostaje puste */ }
      if (!t || typeof t !== 'object') t = {};
      const cechy = t.cechy && typeof t.cechy === 'object' && !Array.isArray(t.cechy) ? t.cechy : {};
      const przesuniecia = this.q(`SELECT kto, kiedy FROM akty WHERE glowa = ? AND co = 'przesun' ORDER BY nr`, g.nazwa);
      const pierwszy = przesuniecia[0], ostatni = przesuniecia[przesuniecia.length - 1];
      if (!pierwszy) continue;
      this.r.sql.exec(`INSERT INTO rzeczy (id, rodzaj, obszar, zapis, akt, numer, odlozone, szukane, utworzyl, utworzono, zmienil, zmieniono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, g.rodzaj, t.obszar ?? null, g.zapis, g.akt, przesuniecia.length, t.odlozone === true ? 1 : 0, doSzukania(cechy), pierwszy.kto, pierwszy.kiedy, ostatni.kto, ostatni.kiedy);
    }
    this._k = null;
    this._pam = null;
    this._zbudujPrzekroj();
    this._role = { nr: -1, mapa: new Map() };
    for (const rz of this.wszystkie({ odlozone: 'razem' })) this._odniesienia(rz.id, rz.rodzaj, rz.cechy, this.ksztaltDla(rz.rodzaj));
    // zapis rzeczy z regułą lezy_z obszaru nie niesie (albo niesie dawny): spis dostaje go z rzeczy wskazanej.
    // To jest zwykłe liczenie spisu od nowa, a nie poprawka zastanego, więc nie zostawia śladu wyrównania.
    this.wyrownajZNatury({ slad: false });
    return { ok: true, rzeczy: glowy.length };
  }

  // --- zasiew: to, bez czego środowisko nie umie opisać samego siebie ---------------------------------------------
  // Ziarno ma nazwę i stałą tożsamość liczoną z tej nazwy. Raz zasiane zostaje rzeczą jak każda inna: gdy zmieni je
  // uczestnik, jego zmiana wygrywa i zasiew jej nie rusza. Dopóki nikt poza automatem go nie ruszył, zasiew odświeża
  // je, gdy zmieni się w kodzie: inaczej stan budowy pod adresem rozjeżdżałby się z kodem (17 XI, uwaga po PR 33).
  zasiej(ziarna) { return this._wKolejce(() => this._zasiej(ziarna)); }

  // Ziarno zasiane dawniej (losowy identyfikator, bez znacznika w mecie, np. po wwozie starego wywozu): rozpoznajemy
  // je po rodzaju, nazwie i autorze, zamiast siać drugi raz.
  _znajdzZiarno(z, cechy) {
    const k = z.rodzaj === 'ksztalt/1' ? { tytul: 'dla' } : this.ksztaltDla(z.rodzaj);
    const n = (k && k.tytul) || 'nazwa';
    if (typeof cechy[n] !== 'string') return null;
    const traf = this.spis({ rodzaj: z.rodzaj, gdzie: { [n]: cechy[n] }, odlozone: 'razem', limit: 5 }).find((x) => x.utworzyl === AUTOMAT);
    return traf ? traf.id : null;
  }

  async _zasiej(ziarna) {
    const zrobione = [];
    const zapisz = async (z, id, cechy, obszar, op, wersja) => {
      const ksztalt = z.rodzaj === 'ksztalt/1' ? null : this.ksztaltDla(z.rodzaj);
      if (z.rodzaj === 'ksztalt/1') { const b = sprawdzKsztalt(cechy); if (b.length) throw new Error(`ziarno ${z.nazwa}: ${b.join('; ')}`); }
      else if (ksztalt) { const s = sprawdzCechy(ksztalt, cechy, this._maRzecz, this._maZapis); if (s.bledy.length) throw new Error(`ziarno ${z.nazwa}: ${s.bledy.join('; ')}`); }
      const p = await this.r.przygotujPolozenie({ op, rodzaj: z.rodzaj, tresc: trescRzeczy({ obszar, cechy }), glowa: 'rzecz:' + id, wersja });
      if (!p.ok) throw new Error(`ziarno ${z.nazwa}: ${p.blad}`);
      const w = this.r.zatwierdzPolozenia(AUTOMAT, [p], { slad: 'zasiew' });
      if (!w.ok) throw new Error(`ziarno ${z.nazwa}: ${w.blad}`);
      if (!w.powtorzone) this._projekcja(id, z.rodzaj, obszar, p.id, w.wyniki[0].wersja, AUTOMAT, cechy, z.rodzaj === 'ksztalt/1' ? this.ksztaltDla('ksztalt/1') : ksztalt, false, w.wyniki[0].kiedy);
    };
    for (const z of ziarna) {
      const klucz = 'ziarno:' + z.nazwa;
      const cechy = typeof z.cechy === 'function' ? await z.cechy(this) : z.cechy;
      const obszar = z.obszar ? (this.r.meta('ziarno:' + z.obszar) || null) : null;
      const odcisk = szybkiOdcisk(JSON.stringify([z.rodzaj, obszar, cechy]));
      let id = this.r.meta(klucz);
      // Ziarno rodzaju, który ma klucz, dostaje tożsamość z klucza: inaczej ta sama rzecz dołożona potem ręką albo
      // przez narzędzie powstałaby drugi raz, pod innym identyfikatorem.
      const zKlucza = z.rodzaj === 'ksztalt/1' ? null : await this._idZKlucza(z.rodzaj, this.ksztaltDla(z.rodzaj), cechy);
      if (!id) {
        const stale = zKlucza || await idZ('ziarno', z.nazwa);
        id = this.rzecz(stale) ? stale : this._znajdzZiarno(z, cechy);
        if (id) this.r.ustawMeta(klucz, id);
      }
      if (id) {
        if (z.meta && this.r.meta(z.meta) !== id) this.r.ustawMeta(z.meta, id);
        if (this.r.meta('ziarno-odcisk:' + z.nazwa) === odcisk) continue;
        const rz = this.rzecz(id);
        if (!rz) continue;
        const taSama = rz.rodzaj === z.rodzaj && (rz.obszar ?? null) === (obszar ?? null) && JSON.stringify(rz.cechy) === JSON.stringify(cechy);
        if (taSama) { this.r.ustawMeta('ziarno-odcisk:' + z.nazwa, odcisk); continue; }
        // Zasiew ustępuje ręce: rzecz, którą sam założył, a potem ktoś zmienił albo odłożył, zostaje po zmianie. Nie
        // ustępuje rzeczy, którą pod kluczem ziarna założył ktoś inny niż właściciel i której właściciel nigdy nie
        // ruszył: agent zajmował tak z góry nazwę pokrętła, które kod dopiero zasieje, i podstawiał własną deklarację
        // (niezależny atak, 17 XI 2026). Taka rzecz wraca do treści i miejsca z ziarna; obca wersja zostaje w historii.
        const zajeta = rz.utworzyl !== AUTOMAT && rz.utworzyl !== this.wlasciciel && rz.zmienil !== this.wlasciciel
          && !this.historia(id).some((h) => h.kto === this.wlasciciel);
        if (!zajeta && (rz.zmienil !== AUTOMAT || rz.odlozone)) continue; // ktoś zmienił ją ręką: jego zmiana wygrywa
        await zapisz(z, id, cechy, obszar, zajeta ? `zasiew-${z.nazwa}-${odcisk}-po-${rz.wersja}` : `zasiew-${z.nazwa}-${odcisk}`, rz.wersja);
        this.r.ustawMeta('ziarno-odcisk:' + z.nazwa, odcisk);
        zrobione.push(z.nazwa + ' (odświeżone)');
        continue;
      }
      id = zKlucza || await idZ('ziarno', z.nazwa);
      await zapisz(z, id, cechy, obszar, 'zasiew-' + z.nazwa, null);
      this.r.ustawMeta(klucz, id);
      this.r.ustawMeta('ziarno-odcisk:' + z.nazwa, odcisk);
      if (z.meta) this.r.ustawMeta(z.meta, id);
      zrobione.push(z.nazwa);
    }
    return zrobione;
  }
}
