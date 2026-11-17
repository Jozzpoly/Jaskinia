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
import { opKlienta } from './ksztalty.mjs';

export const SRODOWISKO = 'srodowisko-1';
export const AUTOMAT = 'srodowisko'; // uczestnik, którym środowisko samo zasiewa swoje rzeczy; imię zastrzeżone

const RODZAJ = /^[a-z][a-z0-9_.-]{0,79}\/[1-9][0-9]{0,5}$/;
const RODZAJ_LUB_NAZWA = /^[a-z][a-z0-9_.-]{0,79}(\/[1-9][0-9]{0,5})?$/;
const ID = /^[0-9a-z]{26}$/;
const ZAPIS = /^[0-9a-f]{64}$/;
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
function trescRzeczy({ obszar, cechy, odlozone = false, powod = null }) {
  return JSON.stringify({ obszar: obszar ?? null, cechy, ...(odlozone ? { odlozone: true, ...(powod ? { powod } : {}) } : {}) });
}

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
    case 'tekst': return typeof w === 'string' && w.length <= 200000 ? null : `${sciezka}: ma być napisem`;
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

  rzecz(id) {
    if (typeof id !== 'string' || !ID.test(id)) return null;
    const w = this.q(`SELECT r.*, z.tresc FROM rzeczy r JOIN zapisy z ON z.id = r.zapis WHERE r.id = ?`, id)[0];
    return w ? this._zWiersza(w) : null;
  }

  // Wybór rzeczy: rodzaj (z pokoleniem albo sama nazwa), obszar, wartości cech (`gdzie`), tekst (`szukaj`) i to,
  // czy pokazywać odłożone (domyślnie nie; 'tak': tylko odłożone; 'razem': jedne i drugie).
  _warunek({ rodzaj = null, obszar, gdzie = null, szukaj = null, odlozone = 'nie', po = null } = {}) {
    const war = [], par = [];
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
    const { rodzaj = null, obszar, gdzie: cechy = null, szukaj = null, odlozone = 'nie', po = null } = filtr;
    const prostyRodzaj = rodzaj === null || (typeof rodzaj === 'string' && rodzaj.includes('/') && RODZAJ_LUB_NAZWA.test(rodzaj));
    if (!cechy && !szukaj && po === null && prostyRodzaj && ['nie', 'tak', 'razem'].includes(odlozone)) {
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
  // liczby rodzajów, liczby w obszarach i liczba odłożonych. Liczony z bazy raz na życie obiektu (jeden przegląd spisu),
  // a potem poprawiany w pamięci przy każdym zapisie rzeczy (_projekcja): zmierzone 17 XI, że liczenie go od nowa po
  // każdej zmianie kosztowało przy 560 rzeczach ponad tysiąc wierszy bazy na pierwsze czytanie opisu.
  _przekrojMapa() {
    if (!this._prz) {
      this._prz = new Map();
      for (const w of this.q(`SELECT rodzaj, obszar, odlozone, COUNT(*) AS ile FROM rzeczy NOT INDEXED GROUP BY rodzaj, obszar, odlozone`)) doliczPrzekroj(this._prz, w.rodzaj, w.obszar, w.odlozone, w.ile);
    }
    return this._prz;
  }
  przekroj() { return [...this._przekrojMapa().values()]; }

  liczby() {
    return this.pamietaj('liczby', () => {
      const m = new Map();
      for (const w of this.przekroj()) if (!w.odlozone) m.set(w.rodzaj, (m.get(w.rodzaj) || 0) + w.ile);
      return Object.freeze([...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([rodzaj, ile]) => ({ rodzaj, ile })));
    });
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
    return { rzecz: id, akt, numer: w.numer, kto: w.kto, kiedy: w.kiedy, rodzaj: z.rodzaj, obszar: t.obszar ?? null, cechy: t.cechy && typeof t.cechy === 'object' ? t.cechy : {}, odlozone: t.odlozone === true, powod: typeof t.powod === 'string' ? t.powod : null };
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
  rola(kto) {
    if (!kto) return 'zwiedzajacy';
    if (kto === this.wlasciciel) return 'wlasciciel';
    const nr = this.ostatniNr();
    if (this._role.nr !== nr) this._role = { nr, mapa: new Map() };
    if (!this._role.mapa.has(kto)) {
      const u = this.spis({ rodzaj: 'uczestnik/1', gdzie: { imie: kto }, limit: 1 })[0];
      this._role.mapa.set(kto, u && u.cechy.rola === 'automat' ? 'automat' : 'agent');
    }
    return this._role.mapa.get(kto);
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
      const dla = [rodzaj === 'ksztalt/1' ? cechy.dla : null, byl('ksztalt/1') ? stara.cechy.dla : null];
      const rdz = dla.find((d) => KSZTALTY_RDZENIA.includes(d));
      if (rdz) return `kształt rodzaju ${rdz} zmienia tylko właściciel`;
      if ((byl('ksztalt/1') && stara.cechy.uklad === true) !== (rodzaj === 'ksztalt/1' && cechy.uklad === true)) return 'to, czy rodzaj jest układem, ustala tylko właściciel';
    }
    return null;
  }

  // Ocena zmiany: skutek, propozycja albo odmowa. `stara` to rzecz przed zmianą (albo null, gdy powstaje nowa),
  // a rodzaj, obszar i cechy to stan po zmianie. Prawo liczy się tam, skąd rzecz wychodzi, i tam, dokąd trafia.
  ocen(kto, { stara = null, rodzaj, obszar = null, cechy = {} }) {
    const rola = this.rola(kto);
    if (rola === 'zwiedzajacy') return { tryb: 'odmowa', status: 401, powod: 'do ruchu potrzebny jest klucz uczestnika (nagłówek Authorization: Bearer <klucz>)' };
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
    const z = this._zastrzezone(rodzaj, cechy, stara);
    if (z) return { tryb: 'propozycja', powod: z, wymaga: 'wlasciciel' };
    return wynik;
  }

  // Co ten uczestnik może zrobić z istniejącą rzeczą, nie zmieniając jej rodzaju ani obszaru (dla tekstu pod adresem).
  prawo(kto, { rodzaj, obszar, rzecz = null }) {
    return this.ocen(kto, { stara: rzecz, rodzaj, obszar, cechy: rzecz ? rzecz.cechy : {} });
  }

  // --- ruchy ----------------------------------------------------------------------------------------------------
  async ruch(kto, cialo, { slad = null } = {}) {
    if (kto && !poprawneImie(kto)) return blad(401, 'nieznany wykonawca');
    if (kto === AUTOMAT) return blad(403, `imię ${AUTOMAT} jest zastrzeżone dla samego środowiska`);
    if (!cialo || typeof cialo !== 'object' || Array.isArray(cialo)) return blad(400, 'ciało żądania ma być obiektem JSON');
    if (!opKlienta(cialo.op)) return blad(400, 'op: Twój własny identyfikator tej czynności, 8 do 100 znaków z [A-Za-z0-9_-]; przy ponowieniu podaj ten sam, wtedy nic nie zrobi się dwa razy');
    const co = cialo.co;
    if (co === 'poloz') return this._wKolejce(() => this._poloz(kto, cialo, slad));
    if (co === 'odloz' || co === 'przywroc' || co === 'cofnij') return this._wKolejce(() => this._przestaw(kto, cialo, slad));
    if (co === 'przyjmij' || co === 'odrzuc') return this._wKolejce(() => this._rozstrzygnij(kto, cialo, slad));
    return blad(400, 'co: poloz (dołóż albo zmień rzecz), odloz, przywroc, cofnij (rzecz do wcześniejszej wersji), przyjmij albo odrzuc (rozstrzygnij propozycję)');
  }

  _maRzecz = (id) => this.rzecz(id);
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
  _sprawdzTresc(rodzaj, cechy, obszar, stara, odlozone = false) {
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
      if (stara && stara.rodzaj === 'ksztalt/1') {
        if (stara.cechy.dla !== cechy.dla) return blad(409, `ten kształt opisuje rodzaj ${stara.cechy.dla} i tak zostaje; inny rodzaj to osobny kształt`);
        if (this.ile({ rodzaj: cechy.dla, odlozone: 'razem' }) > 0) {
          const n = niezgodnosciKsztaltu(stara.cechy, cechy);
          if (n.length) return blad(409, `pod kształtem ${cechy.dla} leżą już rzeczy, więc wolno w nim tylko dokładać cechy niewymagane, poszerzać wybór i zmieniać opisy (${n.join('; ')}). Inną zmianę zrób jako następne pokolenie: ${nastepne}`, { bledy: n });
        }
      }
    }
    if (obszar) {
      const o = this.rzecz(obszar);
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
    const { bledy, nieznane } = sprawdzCechy(ksztalt, cechy, this._maRzecz, this._maZapis);
    if (bledy.length) return blad(422, `rzecz rodzaju ${rodzaj} nie przeszła sprawdzenia: ` + bledy.join('; '), { bledy, ksztalt: '/rodzaj/' + rodzaj });
    if (ksztalt.klucz && stara && nazwaRodzaju(stara.rodzaj) === nazwaRodzaju(rodzaj)) {
      const sk = this.ksztaltDla(stara.rodzaj);
      if (sk && JSON.stringify(sk.klucz || null) === JSON.stringify(ksztalt.klucz) && ksztalt.klucz.some((n) => JSON.stringify(stara.cechy[n]) !== JSON.stringify(cechy[n])))
        return blad(422, `cechy ${ksztalt.klucz.join(', ')} są kluczem, czyli tożsamością tej rzeczy; inna wartość klucza to inna rzecz`);
    }
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
    const { rodzaj, cechy } = c;
    if (typeof rodzaj !== 'string' || !RODZAJ.test(rodzaj)) return blad(400, 'rodzaj: nazwa z pokoleniem, np. projekt/1 (małe litery, cyfry, kropka, - i _, potem /numer)');
    if (!cechy || typeof cechy !== 'object' || Array.isArray(cechy)) return blad(400, 'cechy: obiekt z cechami rzeczy, np. {"nazwa": "…"}');
    if ('rzecz' in c && !(typeof c.rzecz === 'string' && ID.test(c.rzecz))) return blad(400, 'rzecz: identyfikator zmienianej rzeczy (26 znaków); pomiń, żeby dołożyć nową');
    if ('obszar' in c && c.obszar !== null && !(typeof c.obszar === 'string' && ID.test(c.obszar))) return blad(400, 'obszar: identyfikator obszaru (26 znaków) albo null dla głównego');
    if ('wersja' in c && !(Number.isInteger(c.wersja) || c.wersja === 'dowolna')) return blad(400, 'wersja: liczba z pola wersja Twojego ostatniego odczytu albo napis "dowolna" (świadoma zgoda na nadpisanie cudzej zmiany)');
    if (nazwaRodzaju(rodzaj) === 'kod') return blad(400, 'rodzaj kod jest zastrzeżony dla kodu gości; kod zapisuje się przez POST /api/srodowisko/kod, a gościa zgłasza jako rzecz rodzaju gosc/1');
    const wada = wadaSurowej(cechy);
    if (wada) return blad(400, 'cechy: ' + wada);
    const byl = this._powtorzenie(kto, c);
    if (byl) return byl;
    let stara = null, id;
    if (c.rzecz) {
      stara = this.rzecz(c.rzecz);
      if (!stara) return blad(404, `nie ma rzeczy ${c.rzecz}`);
      id = stara.id;
    } else {
      const zKlucza = await this._idZKlucza(rodzaj, this.ksztaltDla(rodzaj), cechy);
      id = zKlucza || await idZ('rzecz', kto, c.op);
      stara = this.rzecz(id);
      // Rzecz o tym kluczu już jest: to zmiana, nie nowa rzecz, więc potrzebna jest wersja jak przy każdej zmianie.
      if (stara && zKlucza && !('wersja' in c)) return blad(409, `rzecz o tym kluczu już jest (${id}); żeby ją zmienić, podaj jej wersję z odczytu albo "wersja":"dowolna"`, { rzecz: id, wersja: stara.wersja });
      if (stara && !zKlucza) return blad(409, 'ten op założył już inną rzecz; nowa rzecz potrzebuje nowego op', { rzecz: id });
    }
    if (stara && !('wersja' in c)) return blad(400, 'wersja: numer z pola wersja Twojego ostatniego odczytu tej rzeczy; bez niego nie wiadomo, czy nie nadpisujesz cudzej zmiany', { wersja: stara.wersja });
    const rola = this.rola(kto);
    let obszar;
    if ('obszar' in c) obszar = c.obszar;
    else if (stara) obszar = stara.obszar;
    else obszar = rola === 'wlasciciel' ? null : (this.r.meta('obszar_nowe') || null);
    return this._zmien(kto, c.op, slad, { co: 'poloz', stara, id, rodzaj, obszar, cechy, odlozone: stara ? !!stara.odlozone : false, powod: stara && stara.odlozone ? stara.powod : null, wersja: stara ? (c.wersja === 'dowolna' ? stara.wersja : c.wersja) : null });
  }

  // Ponowienie tej samej czynności (ten sam uczestnik, ten sam op): oddajemy to, co stało się za pierwszym razem,
  // zamiast oceniać ruch drugi raz w innym już świecie (po zmianie ustawienia obszaru albo po rozstrzygnięciu).
  // Inna czynność pod tym samym op to konflikt, nigdy cichy sukces.
  _powtorzenie(kto, c) {
    const akt = (op) => this.q(`SELECT a.nr, a.glowa, a.zapis, z.rodzaj, z.tresc FROM akty a JOIN zapisy z ON z.id = a.zapis WHERE a.kto = ? AND a.op = ? AND a.co = 'przesun'`, kto, op)[0];
    const a = akt(c.op + '.p');
    if (!a || !String(a.glowa).startsWith('rzecz:')) return null;
    const id = a.glowa.slice(6);
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
    const byl = this._powtorzenie(kto, c);
    if (byl) return byl;
    const stara = this.rzecz(c.rzecz);
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
      if (!cel) return blad(404, `rzecz ${stara.id} nie ma wersji o znaczniku ${c.do}`);
    } else {
      if (h.length < 2) return blad(409, 'ta rzecz ma tylko jedną wersję; nie ma do czego cofnąć (żeby ją schować, użyj co: odloz)');
      const poprzednia = h.filter((x) => x.akt < stara.wersja).pop();
      cel = poprzednia ? this.wersja(stara.id, poprzednia.akt) : null;
      if (!cel) return blad(409, 'nie ma wcześniejszej wersji tej rzeczy');
    }
    if (cel.akt === stara.wersja) return blad(409, 'to jest bieżąca wersja tej rzeczy; nie ma czego cofać');
    return this._zmien(kto, c.op, slad, { ...wspolne, co: 'cofnij', rodzaj: cel.rodzaj, obszar: cel.obszar, cechy: cel.cechy, odlozone: cel.odlozone, powod: cel.powod, zWersji: cel.akt });
  }

  // Wspólny koniec każdej zmiany rzeczy: sprawdzenie treści, ocena prawa, potem zapis albo propozycja.
  async _zmien(kto, op, slad, { co, stara, id, rodzaj, obszar, cechy, odlozone, powod, wersja, zWersji = null }) {
    const spr = this._sprawdzTresc(rodzaj, cechy, obszar, stara, odlozone);
    if (!spr.ok) return co === 'cofnij' ? blad(409, 'dawna wersja nie przechodzi dzisiejszego sprawdzenia: ' + spr.blad, { bledy: spr.bledy }) : spr;
    const ocena = this.ocen(kto, { stara, rodzaj, obszar, cechy });
    if (ocena.tryb === 'odmowa') return blad(ocena.status, ocena.powod);
    const uwagi = { ...(spr.nieznane.length ? { nieznane_cechy: spr.nieznane } : {}), ...(spr.bezKsztaltu ? { uwaga: `rodzaj ${rodzaj} nie ma kształtu: rzecz jest zapisana i widoczna, ale niczego w niej nie sprawdzono` } : {}) };
    if (ocena.tryb === 'skutek') {
      const p = await this.r.przygotujPolozenie({ op, rodzaj, tresc: trescRzeczy({ obszar, cechy, odlozone, powod }), glowa: 'rzecz:' + id, wersja: stara ? wersja : null });
      if (!p.ok) return p;
      return this._zatwierdz(kto, [{ p, id, rodzaj, obszar, cechy, odlozone, ksztalt: spr.ksztalt }], slad,
        { skutek: SKUTKI[co], rzecz: id, adres: '/rzecz/' + id, ...(zWersji ? { z_wersji: zWersji } : {}), ...uwagi });
    }
    // Propozycja kosztuje uwagę właściciela, więc jeden uczestnik nie może ich mnożyć bez końca: jedna czekająca na
    // rzecz i najwyżej NAJWIECEJ_CZEKAJACYCH naraz (uwaga drugiej linii do PR 35: agent w pętli zalałby listę "czeka").
    if (stara) {
      const juz = this.spis({ rodzaj: 'propozycja/1', gdzie: { od: kto, stan: 'czeka', rzecz: stara.id }, limit: 1 })[0];
      if (juz) return blad(409, `masz już czekającą propozycję zmiany tej rzeczy (${juz.id}); wycofaj ją (co: odrzuc) albo poczekaj na rozstrzygnięcie`, { propozycja: juz.id });
    }
    if (this.ile({ rodzaj: 'propozycja/1', gdzie: { od: kto, stan: 'czeka' } }) >= NAJWIECEJ_CZEKAJACYCH) return blad(429, `masz już ${NAJWIECEJ_CZEKAJACYCH} czekających propozycji; wycofaj którąś (co: odrzuc) albo poczekaj, aż zostaną rozstrzygnięte`);
    // propozycja: leży tam, gdzie leży rzecz, której dotyczy (albo tam, gdzie miała powstać nowa)
    const propId = await idZ('propozycja', kto, op);
    const obszarProp = stara ? stara.obszar : obszar;
    const cp = { od: kto, co, rodzaj, tresc: { obszar: obszar ?? null, cechy, ...(odlozone ? { odlozone: true, ...(powod ? { powod } : {}) } : {}) },
      ...(stara ? { rzecz: stara.id, wersja } : { nowa: id }), stan: 'czeka', ...(ocena.wymaga === 'wlasciciel' ? { wymaga: 'wlasciciel' } : {}) };
    const p = await this.r.przygotujPolozenie({ op, rodzaj: 'propozycja/1', tresc: trescRzeczy({ obszar: obszarProp, cechy: cp }), glowa: 'rzecz:' + propId, wersja: null });
    if (!p.ok) return p;
    return this._zatwierdz(kto, [{ p, id: propId, rodzaj: 'propozycja/1', obszar: obszarProp, cechy: cp, odlozone: false, ksztalt: this.ksztaltDla('propozycja/1') }], slad,
      { skutek: 'propozycja', propozycja: propId, adres: '/rzecz/' + propId, powod: ocena.powod, kto_przyjmuje: ocena.wymaga === 'wlasciciel' ? 'wlasciciel' : 'wlasciciel albo uczestnik, który sam mógłby zrobić ten ruch ze skutkiem', ...uwagi });
  }

  _zatwierdz(kto, lista, slad, wynik) {
    const z = this.r.zatwierdzPolozenia(kto, lista.map((x) => x.p), { slad });
    if (!z.ok) return z;
    if (!z.powtorzone) lista.forEach((x, i) => this._projekcja(x.id, x.rodzaj, x.obszar, x.p.id, z.wyniki[i].wersja, kto, x.cechy, x.ksztalt, x.odlozone, z.wyniki[i].kiedy));
    const pierwsza = this.rzecz(lista[0].id);
    return { ok: true, powtorzone: z.powtorzone, ...wynik, wersja: pierwsza ? pierwsza.wersja : z.wyniki[0].wersja, ...(pierwsza ? { numer: pierwsza.numer } : {}) };
  }

  // Wiersz spisu dla jednej rzeczy. Czas bierze z aktu, nie z chwili liczenia, żeby spis odbudowany z dziennika
  // był co do znaku taki sam jak spis liczony na bieżąco.
  _projekcja(id, rodzaj, obszar, zapis, akt, kto, cechy, ksztalt, odlozone = false, kiedy = null) {
    const t = kiedy ?? this.r.teraz();
    // pamiętany przekrój spisu idzie za zapisem: rzecz wychodzi ze starej przegródki i wchodzi do nowej
    if (this._prz) {
      const bylo = this.q(`SELECT rodzaj, obszar, odlozone FROM rzeczy WHERE id = ?`, id)[0];
      if (bylo) doliczPrzekroj(this._prz, bylo.rodzaj, bylo.obszar, bylo.odlozone, -1);
      doliczPrzekroj(this._prz, rodzaj, obszar ?? null, odlozone ? 1 : 0, 1);
    }
    this.r.sql.exec(`INSERT INTO rzeczy (id, rodzaj, obszar, zapis, akt, numer, odlozone, szukane, utworzyl, utworzono, zmienil, zmieniono) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rodzaj = excluded.rodzaj, obszar = excluded.obszar, zapis = excluded.zapis, akt = excluded.akt, numer = rzeczy.numer + 1,
        odlozone = excluded.odlozone, szukane = excluded.szukane, zmienil = excluded.zmienil, zmieniono = excluded.zmieniono`,
      id, rodzaj, obszar ?? null, zapis, akt, odlozone ? 1 : 0, doSzukania(cechy), kto, t, kto, t);
    this._odniesienia(id, rodzaj, cechy, ksztalt);
    // Nowy albo zmieniony kształt zmienia to, które cechy są odniesieniami: rzeczy tego rodzaju liczymy od nowa,
    // inaczej spis zależałby od kolejności, w jakiej powstały rzecz i jej kształt.
    if (rodzaj === 'ksztalt/1' && typeof cechy.dla === 'string') {
      this._k = null;
      const k = this.ksztaltDla(cechy.dla);
      for (const rz of this.wszystkie({ rodzaj: cechy.dla, odlozone: 'razem' })) this._odniesienia(rz.id, rz.rodzaj, rz.cechy, k);
    }
  }

  _odniesienia(id, rodzaj, cechy, ksztalt) {
    this.r.sql.exec(`DELETE FROM odniesienia WHERE od = ?`, id);
    const odn = odniesieniaZCech(ksztalt, cechy);
    if (rodzaj === 'propozycja/1' && typeof cechy.rzecz === 'string' && ID.test(cechy.rzecz) && !odn.some(([, c]) => c === cechy.rzecz)) odn.push(['rzecz', cechy.rzecz]);
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
    const byl = this._powtorzenie(kto, c);
    if (byl) return byl;
    const pr = this.rzecz(c.propozycja);
    if (!pr || pr.rodzaj !== 'propozycja/1') return blad(404, `nie ma propozycji ${c.propozycja}`);
    if (pr.cechy.stan !== 'czeka') return blad(409, `ta propozycja jest już rozstrzygnięta: ${pr.cechy.stan}`);
    const rola = this.rola(kto);
    if (rola === 'zwiedzajacy') return blad(401, 'do rozstrzygnięcia propozycji potrzebny jest klucz uczestnika');
    const t = pr.cechy.tresc && typeof pr.cechy.tresc === 'object' ? pr.cechy.tresc : {};
    const cechy = t.cechy && typeof t.cechy === 'object' && !Array.isArray(t.cechy) ? t.cechy : {};
    const obszar = t.obszar ?? null;
    const stara = pr.cechy.rzecz ? this.rzecz(pr.cechy.rzecz) : null;
    const autor = kto === pr.cechy.od;
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
    const id = stara ? stara.id : (typeof pr.cechy.nowa === 'string' && ID.test(pr.cechy.nowa) ? pr.cechy.nowa : await idZ('przyjeta', pr.id));
    if (!stara && this.rzecz(id)) return blad(409, 'rzecz, którą ta propozycja miała założyć, powstała w międzyczasie inną drogą; odrzuć propozycję albo poproś o nową', { rzecz: id });
    const odlozone = t.odlozone === true;
    const spr = this._sprawdzTresc(pr.cechy.rodzaj, cechy, obszar, stara, odlozone);
    if (!spr.ok) return blad(spr.status, 'propozycja nie przechodzi dzisiejszego sprawdzenia: ' + spr.blad);
    const p1 = await this.r.przygotujPolozenie({ op: c.op, rodzaj: pr.cechy.rodzaj, tresc: trescRzeczy({ obszar, cechy, odlozone, powod: typeof t.powod === 'string' ? t.powod : null }), glowa: 'rzecz:' + id, wersja: stara ? stara.wersja : null });
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
    if (rola === 'zwiedzajacy') return blad(401, 'do zapisania kodu potrzebny jest klucz uczestnika');
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
    this._prz = null;
    this._role = { nr: -1, mapa: new Map() };
    for (const rz of this.wszystkie({ odlozone: 'razem' })) this._odniesienia(rz.id, rz.rodzaj, rz.cechy, this.ksztaltDla(rz.rodzaj));
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
      if (!id) {
        const stale = await idZ('ziarno', z.nazwa);
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
        if (rz.zmienil !== AUTOMAT || rz.odlozone) continue; // ktoś zmienił ją ręką: jego zmiana wygrywa
        await zapisz(z, id, cechy, obszar, `zasiew-${z.nazwa}-${odcisk}`, rz.wersja);
        this.r.ustawMeta('ziarno-odcisk:' + z.nazwa, odcisk);
        zrobione.push(z.nazwa + ' (odświeżone)');
        continue;
      }
      id = await idZ('ziarno', z.nazwa);
      await zapisz(z, id, cechy, obszar, 'zasiew-' + z.nazwa, null);
      this.r.ustawMeta(klucz, id);
      this.r.ustawMeta('ziarno-odcisk:' + z.nazwa, odcisk);
      if (z.meta) this.r.ustawMeta(z.meta, id);
      zrobione.push(z.nazwa);
    }
    return zrobione;
  }
}
