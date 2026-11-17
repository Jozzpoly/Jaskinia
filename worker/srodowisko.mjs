// Środowisko: cienka warstwa nad jądrem Miejsca (17 XI 2026). Status: próba (TYMCZASOWE.md).
// Jądro (miejsce.mjs) zna zapis, akt i głowę i nie wie, czym jest karta ani projekt. Ta warstwa dokłada to, czego
// potrzeba, żeby Jaskinia rosła cudzą ręką bez zmiany kodu:
//   - rzecz: tożsamość (głowa `rzecz:<id>`) i jej kolejne zapisy; rodzaj z pokoleniem (`projekt/1`);
//   - kształt: opis rodzaju jest rzeczą rodzaju `ksztalt/1`, czyli daną. Nowy rodzaj dokłada się ruchem;
//   - obszar: miejsce z ustawieniami (ile wolno agentom, ile uwagi, kto widzi, kto układa); obszar leży w obszarze;
//   - prawo do skutku liczone z danych: ten sam ruch daje skutek, propozycję albo odmowę zależnie od obszaru;
//   - propozycja z cyklem życia (czeka, przyjęta, odrzucona);
//   - spis rzeczy i odniesień liczony z dziennika (tabele `rzeczy` i `odniesienia` da się odbudować z głów).
// Słowa: Miejsce to całość; obszar to węzeł z ustawieniami; cecha to pole kształtu (nazwy za Opusem czatu, 17 XI).
// Sprawdzanie jest przy zapisie, nie przy czytaniu: nieznaną cechę wolno i zostaje zachowana, niepoprawną odbijają
// drzwi ze zdaniem, co jest nie tak (falsyfikator Opusa Code do własnego prawa 1).
import { poprawneImie, skrot } from './miejsce.mjs';
import { opKlienta } from './ksztalty.mjs';

export const SRODOWISKO = 'srodowisko-1';
export const AUTOMAT = 'srodowisko'; // uczestnik, którym środowisko samo zasiewa swoje rzeczy

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
export const STOPNIE = ['nic', 'proponowac', 'porzadkowac', 'prowadzic'];
export const UWAGI = ['cisza', 'skrot', 'znak', 'budzi'];
export const WIDZI = ['wlasciciel', 'uczestnicy', 'wszyscy'];
export const UKLADA = ['reka', 'regula', 'agent'];
export const USTAWIENIA = { ile_wolno: STOPNIE, uwaga: UWAGI, widzi: WIDZI, uklada: UKLADA };
export const DOMYSLNE = { ile_wolno: 'proponowac', uwaga: 'znak', widzi: 'uczestnicy', uklada: 'reka' };
// Rodzaje, których kształt i rzeczy trzymają całość w ryzach: zmienia je tylko właściciel.
const KSZTALTY_RDZENIA = ['ksztalt/1', 'obszar/1', 'uczestnik/1', 'propozycja/1'];

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

const nazwaRodzaju = (r) => String(r).split('/')[0];

// --- sprawdzanie wartości względem opisu cechy ------------------------------------------------------------------
function sprawdzWartosc(def, w, sciezka, maRzecz, maZapis) {
  const typ = typeof def === 'string' ? def : def && def.typ;
  switch (typ) {
    case 'tekst': return typeof w === 'string' && w.length <= 200000 ? null : `${sciezka}: ma być napisem`;
    case 'liczba': return typeof w === 'number' && Number.isFinite(w) ? null : `${sciezka}: ma być liczbą`;
    case 'tak-nie': return typeof w === 'boolean' ? null : `${sciezka}: ma być true albo false`;
    case 'czas': return typeof w === 'string' && /^\d{4}-\d{2}-\d{2}/.test(w) && !Number.isNaN(Date.parse(w)) ? null : `${sciezka}: ma być chwilą w zapisie ISO 8601 (np. 2026-11-17T02:30:00Z)`;
    case 'adres': return typeof w === 'string' && /^https?:\/\/[^\s]{1,2000}$/.test(w) ? null : `${sciezka}: ma być adresem http albo https`;
    case 'rzecz': {
      if (typeof w !== 'string' || !ID.test(w)) return `${sciezka}: ma być identyfikatorem rzeczy (26 znaków)`;
      const r = maRzecz(w);
      if (!r) return `${sciezka}: nie ma rzeczy ${w}`;
      const chce = typeof def === 'object' && def.rodzaj;
      if (chce && r.rodzaj !== chce && nazwaRodzaju(r.rodzaj) !== chce) return `${sciezka}: rzecz ${w} jest rodzaju ${r.rodzaj}, a ma być ${chce}`;
      return null;
    }
    case 'zapis': return typeof w === 'string' && ZAPIS.test(w) && maZapis(w) ? null : `${sciezka}: ma być identyfikatorem istniejącego zapisu (64 znaki szesnastkowe)`;
    case 'lista': {
      if (!Array.isArray(w) || w.length > 2000) return `${sciezka}: ma być listą (najwyżej 2000 elementów)`;
      const z = typeof def === 'object' ? def.z : null;
      for (let i = 0; i < w.length; i++) { const b = sprawdzWartosc(z, w[i], `${sciezka}[${i}]`, maRzecz, maZapis); if (b) return b; }
      return null;
    }
    case 'wybor': return typeof def === 'object' && Array.isArray(def.wartosci) && def.wartosci.includes(w) ? null : `${sciezka}: ma być jedną z wartości: ${(def.wartosci || []).join(', ')}`;
    case 'dowolne': return null;
    default: return `${sciezka}: kształt podaje nieznany typ ${JSON.stringify(typ)}`;
  }
}

function sprawdzDefinicje(nazwa, def) {
  if (typeof def === 'string') def = { typ: def };
  if (!def || typeof def !== 'object' || Array.isArray(def)) return `cecha ${nazwa}: opis ma być obiektem z polem typ`;
  if (!Object.hasOwn(TYPY, def.typ)) return `cecha ${nazwa}: nieznany typ ${JSON.stringify(def.typ)}; znane typy: ${Object.keys(TYPY).join(', ')}`;
  if ('opis' in def && typeof def.opis !== 'string') return `cecha ${nazwa}: opis ma być napisem`;
  if ('wymagana' in def && typeof def.wymagana !== 'boolean') return `cecha ${nazwa}: wymagana ma być true albo false`;
  if (def.typ === 'rzecz' && 'rodzaj' in def && !(typeof def.rodzaj === 'string' && RODZAJ_LUB_NAZWA.test(def.rodzaj))) return `cecha ${nazwa}: rodzaj ma być nazwą rodzaju, np. projekt/1 albo samo projekt`;
  if (def.typ === 'wybor' && !(Array.isArray(def.wartosci) && def.wartosci.length && def.wartosci.every((x) => typeof x === 'string'))) return `cecha ${nazwa}: wybor potrzebuje niepustej listy napisów w wartosci`;
  if (def.typ === 'lista') {
    if (!('z' in def)) return `cecha ${nazwa}: lista potrzebuje typu elementów w polu z (np. "tekst" albo {"typ":"rzecz","rodzaj":"projekt/1"})`;
    const b = sprawdzDefinicje(nazwa + '[]', def.z);
    if (b) return b;
  }
  return null;
}

// Kształt kształtu jest wpisany tutaj: to jedyna rzecz o kształtach, którą warstwa wie sama z siebie.
export function sprawdzKsztalt(c) {
  if (!c || typeof c !== 'object') return ['kształt: cechy mają być obiektem'];
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
  }
  if ('uklad' in c && typeof c.uklad !== 'boolean') b.push('uklad: true albo false (true: rzeczy tego rodzaju to układanie, nie treść)');
  return b;
}

export function sprawdzCechy(ksztalt, cechy, maRzecz, maZapis) {
  const bledy = [];
  const defs = ksztalt.cechy || {};
  for (const [n, d0] of Object.entries(defs)) {
    const def = typeof d0 === 'string' ? { typ: d0 } : d0;
    if (!(n in cechy) || cechy[n] === null) { if (def.wymagana) bledy.push(`${n}: cecha wymagana, a jej nie ma`); continue; }
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
    const typ = typeof def === 'string' ? def : def && def.typ;
    if (typ === 'rzecz' && typeof w === 'string' && ID.test(w)) wynik.push([nazwa, w]);
    else if (typ === 'lista' && Array.isArray(w)) for (const x of w) zbierz(def.z, x, nazwa);
  };
  for (const [n, def] of Object.entries(ksztalt.cechy || {})) if (n in cechy) zbierz(def, cechy[n], n);
  return wynik;
}

export class Srodowisko {
  constructor(rdzen) {
    this.r = rdzen;
    const sql = rdzen.sql;
    for (const s of [
      `CREATE TABLE IF NOT EXISTS rzeczy (id TEXT PRIMARY KEY, rodzaj TEXT NOT NULL, obszar TEXT, zapis TEXT NOT NULL, akt INTEGER NOT NULL,
         utworzyl TEXT NOT NULL, utworzono INTEGER NOT NULL, zmienil TEXT NOT NULL, zmieniono INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS rzeczy_rodzaj ON rzeczy (rodzaj)`,
      `CREATE INDEX IF NOT EXISTS rzeczy_obszar ON rzeczy (obszar)`,
      `CREATE TABLE IF NOT EXISTS odniesienia (od TEXT NOT NULL, cecha TEXT NOT NULL, cel TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS odniesienia_cel ON odniesienia (cel)`,
      `CREATE INDEX IF NOT EXISTS odniesienia_od ON odniesienia (od)`,
    ]) sql.exec(s);
  }

  q(z, ...p) { return this.r.q(z, ...p); }
  get wlasciciel() { return this.r.wlasciciel; }
  ostatniNr() { return this.q(`SELECT COALESCE(MAX(nr), 0) AS nr FROM akty`)[0].nr; }

  // --- czytanie ------------------------------------------------------------------------------------------------
  _zWiersza(w) {
    let t = {};
    try { t = JSON.parse(w.tresc); } catch { /* treść nie jest JSON-em: zostaje pusta, a rzecz widoczna */ }
    return { id: w.id, rodzaj: w.rodzaj, obszar: w.obszar ?? null, cechy: t && typeof t.cechy === 'object' && t.cechy ? t.cechy : {}, wersja: w.akt, zapis: w.zapis,
      utworzyl: w.utworzyl, utworzono: new Date(w.utworzono).toISOString(), zmienil: w.zmienil, zmieniono: new Date(w.zmieniono).toISOString() };
  }

  rzecz(id) {
    if (typeof id !== 'string' || !ID.test(id)) return null;
    const w = this.q(`SELECT r.*, z.tresc FROM rzeczy r JOIN zapisy z ON z.id = r.zapis WHERE r.id = ?`, id)[0];
    return w ? this._zWiersza(w) : null;
  }

  spis({ rodzaj = null, obszar, limit = 1000 } = {}) {
    const war = [], par = [];
    if (rodzaj) { if (String(rodzaj).includes('/')) { war.push('r.rodzaj = ?'); par.push(rodzaj); } else { war.push('(r.rodzaj = ? OR r.rodzaj LIKE ?)'); par.push(rodzaj, rodzaj + '/%'); } }
    if (obszar !== undefined) { if (obszar === null || obszar === '') war.push('r.obszar IS NULL'); else { war.push('r.obszar = ?'); par.push(obszar); } }
    const n = Math.max(1, Math.min(2000, limit | 0 || 1000));
    const w = this.q(`SELECT r.*, z.tresc FROM rzeczy r JOIN zapisy z ON z.id = r.zapis ${war.length ? 'WHERE ' + war.join(' AND ') : ''} ORDER BY r.zmieniono DESC, r.id LIMIT ?`, ...par, n);
    return w.map((x) => this._zWiersza(x));
  }

  liczby() { return this.q(`SELECT rodzaj, COUNT(*) AS ile FROM rzeczy GROUP BY rodzaj ORDER BY rodzaj`); }

  historia(id) {
    return this.q(`SELECT nr, kto, kiedy, cialo, zapis FROM akty WHERE glowa = ? ORDER BY nr`, 'rzecz:' + id)
      .map((a) => ({ akt: a.nr, kto: a.kto, kiedy: new Date(a.kiedy).toISOString(), zapis: a.zapis, ...(a.cialo ? { cialo: a.cialo } : {}) }));
  }

  wskazujaNa(id) { return this.q(`SELECT od, cecha FROM odniesienia WHERE cel = ? ORDER BY od`, id); }

  ksztalty() {
    const nr = this.ostatniNr();
    if (this._k && this._k.nr === nr) return this._k.mapa;
    const mapa = new Map();
    for (const k of this.spis({ rodzaj: 'ksztalt/1', limit: 2000 })) if (typeof k.cechy.dla === 'string' && !mapa.has(k.cechy.dla)) mapa.set(k.cechy.dla, k);
    this._k = { nr, mapa };
    return mapa;
  }
  ksztaltDla(rodzaj) { const k = this.ksztalty().get(rodzaj); return k ? k.cechy : null; }

  tytul(rz) {
    const k = this.ksztaltDla(rz.rodzaj);
    const n = (k && k.tytul) || 'nazwa';
    const t = rz.cechy[n];
    return typeof t === 'string' && t.trim() ? t.trim().slice(0, 120) : `${nazwaRodzaju(rz.rodzaj)} ${rz.id.slice(0, 6)}`;
  }

  // --- uczestnicy i prawa ---------------------------------------------------------------------------------------
  rola(kto) {
    if (!kto) return 'zwiedzajacy';
    if (kto === this.wlasciciel) return 'wlasciciel';
    const u = this.spis({ rodzaj: 'uczestnik/1', limit: 2000 }).find((x) => x.cechy.imie === kto);
    return u && ['agent', 'automat'].includes(u.cechy.rola) ? u.cechy.rola : 'agent';
  }

  // Ustawienie obowiązujące w obszarze: pierwsze znalezione w drodze do góry; na samej górze wartość domyślna.
  ustawienie(obszar, klucz) {
    let id = obszar, kroki = 0;
    while (id && kroki++ < 64) {
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

  // Co ten uczestnik może zrobić ruchem na rzeczy danego rodzaju w danym obszarze: skutek, propozycja albo odmowa.
  prawo(kto, { rodzaj, obszar }) {
    const rola = this.rola(kto);
    if (rola === 'zwiedzajacy') return { tryb: 'odmowa', status: 401, powod: 'do ruchu potrzebny jest klucz uczestnika (nagłówek Authorization: Bearer <klucz>)' };
    if (rola === 'wlasciciel') return { tryb: 'skutek' };
    if (rodzaj === 'uczestnik/1') return { tryb: 'odmowa', status: 403, powod: 'uczestników dopisuje i zmienia tylko właściciel' };
    if (rodzaj === 'propozycja/1') return { tryb: 'odmowa', status: 403, powod: 'propozycje powstają same, gdy ruch nie ma prawa do skutku; przyjmuje je albo odrzuca właściciel' };
    const u = this.ustawienie(obszar, 'ile_wolno');
    const gdzie = obszar ? `w obszarze ${obszar}` : 'w głównym obszarze Miejsca';
    if (u.wartosc === 'prowadzic') return { tryb: 'skutek' };
    if (u.wartosc === 'porzadkowac') {
      const k = this.ksztaltDla(rodzaj);
      if (k && k.uklad === true) return { tryb: 'skutek' };
      return { tryb: 'propozycja', powod: `${gdzie} agenci mogą porządkować (rzeczy rodzaju oznaczonego jako układ), a zmianę treści tylko proponować` };
    }
    if (u.wartosc === 'proponowac') return { tryb: 'propozycja', powod: `${gdzie} agenci mogą tylko proponować` };
    return { tryb: 'odmowa', status: 403, powod: `${gdzie} agentom nie wolno nic (ustawienie ile_wolno: nic)` };
  }

  // --- ruchy ----------------------------------------------------------------------------------------------------
  async ruch(kto, cialo, { slad = null } = {}) {
    if (kto && !poprawneImie(kto)) return blad(401, 'nieznany wykonawca');
    if (!cialo || typeof cialo !== 'object' || Array.isArray(cialo)) return blad(400, 'ciało żądania ma być obiektem JSON');
    if (!opKlienta(cialo.op)) return blad(400, 'op: Twój własny identyfikator tej czynności, 8 do 100 znaków z [A-Za-z0-9_-]; przy ponowieniu podaj ten sam, wtedy nic nie zrobi się dwa razy');
    if (cialo.co === 'poloz') return this._poloz(kto, cialo, slad);
    if (cialo.co === 'przyjmij' || cialo.co === 'odrzuc') return this._rozstrzygnij(kto, cialo, slad);
    return blad(400, 'co: poloz (dołóż albo zmień rzecz), przyjmij albo odrzuc (rozstrzygnij propozycję)');
  }

  _maRzecz = (id) => this.rzecz(id);
  _maZapis = (id) => this.q(`SELECT 1 AS j FROM zapisy WHERE id = ?`, id).length > 0;

  // Sprawdzenie treści rzeczy przed zapisem. Zwraca {ok, ksztalt, nieznane} albo błąd z listą, co jest nie tak.
  _sprawdzTresc(kto, rodzaj, cechy, obszar, stara) {
    const rola = this.rola(kto);
    if (rodzaj === 'ksztalt/1') {
      const b = sprawdzKsztalt(cechy);
      if (b.length) return blad(422, 'kształt nie przeszedł sprawdzenia: ' + b.join('; '), { bledy: b });
      const juz = this.ksztalty().get(cechy.dla);
      if (juz && (!stara || juz.id !== stara.id)) return blad(409, `rodzaj ${cechy.dla} ma już kształt (rzecz ${juz.id}); zmień tamtą rzecz albo załóż następne pokolenie, np. ${nazwaRodzaju(cechy.dla)}/${Number(cechy.dla.split('/')[1]) + 1}`, { rzecz: juz.id });
      if (rola !== 'wlasciciel' && kto !== AUTOMAT && (KSZTALTY_RDZENIA.includes(cechy.dla) || (stara && KSZTALTY_RDZENIA.includes(stara.cechy.dla)))) return blad(403, `kształt rodzaju ${cechy.dla} zmienia tylko właściciel`);
    }
    if (rodzaj === 'obszar/1' && rola !== 'wlasciciel' && kto !== AUTOMAT) {
      for (const k of Object.keys(USTAWIENIA)) if ((cechy[k] ?? null) !== ((stara && stara.cechy[k]) ?? null)) return blad(403, `ustawienie ${k} obszaru zmienia tylko właściciel; możesz zmienić nazwę i opis`);
    }
    if (obszar) {
      const o = this.rzecz(obszar);
      if (!o || o.rodzaj !== 'obszar/1') return blad(422, `obszar ${obszar}: nie ma takiego obszaru`);
      if (stara && stara.rodzaj === 'obszar/1') { // obszar nie może leżeć w sobie samym ani we własnym wnętrzu
        let id = obszar, kroki = 0;
        while (id && kroki++ < 64) { if (id === stara.id) return blad(422, 'obszar nie może leżeć we własnym wnętrzu'); const x = this.rzecz(id); id = x ? x.obszar : null; }
      }
    }
    const ksztalt = this.ksztaltDla(rodzaj);
    if (!ksztalt) return { ok: true, ksztalt: null, nieznane: Object.keys(cechy), bezKsztaltu: true };
    const { bledy, nieznane } = sprawdzCechy(ksztalt, cechy, this._maRzecz, this._maZapis);
    if (bledy.length) return blad(422, `rzecz rodzaju ${rodzaj} nie przeszła sprawdzenia: ` + bledy.join('; '), { bledy, ksztalt: '/rodzaj/' + rodzaj });
    return { ok: true, ksztalt, nieznane };
  }

  async _poloz(kto, c, slad) {
    const { op, rodzaj, cechy } = c;
    if (typeof rodzaj !== 'string' || !RODZAJ.test(rodzaj)) return blad(400, 'rodzaj: nazwa z pokoleniem, np. projekt/1 (małe litery, cyfry, kropka, - i _, potem /numer)');
    if (!cechy || typeof cechy !== 'object' || Array.isArray(cechy)) return blad(400, 'cechy: obiekt z cechami rzeczy, np. {"nazwa": "…"}');
    if ('rzecz' in c && !(typeof c.rzecz === 'string' && ID.test(c.rzecz))) return blad(400, 'rzecz: identyfikator zmienianej rzeczy (26 znaków); pomiń, żeby dołożyć nową');
    if ('obszar' in c && c.obszar !== null && !(typeof c.obszar === 'string' && ID.test(c.obszar))) return blad(400, 'obszar: identyfikator obszaru (26 znaków) albo null dla głównego');
    const nowaId = c.rzecz ? null : await idZ('rzecz', kto, op);
    const propId = await idZ('propozycja', kto, op);
    for (let proba = 0; proba < 4; proba++) {
      const nr0 = this.ostatniNr();
      // A. odczyt i decyzja (synchronicznie)
      const stara = c.rzecz ? this.rzecz(c.rzecz) : null;
      if (c.rzecz && !stara) return blad(404, `nie ma rzeczy ${c.rzecz}`);
      if (stara && !Number.isInteger(c.wersja)) return blad(400, 'wersja: numer wersji rzeczy z Twojego ostatniego odczytu (pole wersja); bez niego nie wiadomo, czy nie nadpisujesz cudzej zmiany', { wersja: stara.wersja });
      const rola = this.rola(kto);
      let obszar;
      if ('obszar' in c) obszar = c.obszar;
      else if (stara) obszar = stara.obszar;
      else obszar = rola === 'wlasciciel' ? null : (this.r.meta('obszar_nowe') || null);
      const spr = this._sprawdzTresc(kto, rodzaj, cechy, obszar, stara);
      if (!spr.ok) return spr;
      // prawo: w obszarze docelowym, a przy przenoszeniu także w dotychczasowym
      let prawo = this.prawo(kto, { rodzaj, obszar });
      if (prawo.tryb === 'skutek' && stara && (stara.obszar ?? null) !== (obszar ?? null)) {
        const p2 = this.prawo(kto, { rodzaj: stara.rodzaj, obszar: stara.obszar });
        if (p2.tryb !== 'skutek') prawo = p2.tryb === 'odmowa' ? p2 : { tryb: 'propozycja', powod: 'rzecz leży w obszarze, w którym możesz tylko proponować, więc przeniesienie też jest propozycją' };
      }
      if (prawo.tryb === 'odmowa') return blad(prawo.status, prawo.powod);
      const id = stara ? stara.id : nowaId;
      const tresc = JSON.stringify({ obszar: obszar ?? null, cechy });
      let lista, wynik;
      if (prawo.tryb === 'skutek') {
        // B. skróty (asynchronicznie)
        const p = await this.r.przygotujPolozenie({ op, rodzaj, tresc, glowa: 'rzecz:' + id, wersja: stara ? c.wersja : null });
        if (!p.ok) return p;
        lista = [{ p, id, rodzaj, obszar, cechy, ksztalt: spr.ksztalt }];
        wynik = { skutek: 'polozone', rzecz: id, adres: '/rzecz/' + id };
      } else {
        const tp = JSON.stringify({ obszar: obszar ?? null, cechy: { od: kto, co: 'poloz', rodzaj, tresc: { obszar: obszar ?? null, cechy }, ...(stara ? { rzecz: stara.id, wersja: c.wersja } : {}), stan: 'czeka' } });
        const p = await this.r.przygotujPolozenie({ op, rodzaj: 'propozycja/1', tresc: tp, glowa: 'rzecz:' + propId, wersja: null });
        if (!p.ok) return p;
        lista = [{ p, id: propId, rodzaj: 'propozycja/1', obszar, cechy: JSON.parse(tp).cechy, ksztalt: this.ksztaltDla('propozycja/1') }];
        wynik = { skutek: 'propozycja', propozycja: propId, adres: '/rzecz/' + propId, powod: prawo.powod };
      }
      // C. nic się nie zmieniło od odczytu? Jeśli tak, zapis; jeśli nie, jeszcze raz od A.
      if (this.ostatniNr() !== nr0) continue;
      return this._zatwierdz(kto, lista, slad, { ...wynik, ...(spr.nieznane.length ? { nieznane_cechy: spr.nieznane } : {}), ...(spr.bezKsztaltu ? { uwaga: `rodzaj ${rodzaj} nie ma kształtu: rzecz jest zapisana i widoczna, ale niczego w niej nie sprawdzono` } : {}) });
    }
    return blad(503, 'Miejsce jest teraz bardzo zajęte; ponów z tym samym op');
  }

  _zatwierdz(kto, lista, slad, wynik) {
    const z = this.r.zatwierdzPolozenia(kto, lista.map((x) => x.p), { slad });
    if (!z.ok) return z;
    if (!z.powtorzone) lista.forEach((x, i) => this._projekcja(x.id, x.rodzaj, x.obszar, x.p.id, z.wyniki[i].wersja, kto, x.cechy, x.ksztalt));
    const pierwsza = this.rzecz(lista[0].id);
    return { ok: true, powtorzone: z.powtorzone, ...wynik, wersja: pierwsza ? pierwsza.wersja : z.wyniki[0].wersja };
  }

  _projekcja(id, rodzaj, obszar, zapis, akt, kto, cechy, ksztalt) {
    const t = this.r.teraz();
    this.r.sql.exec(`INSERT INTO rzeczy (id, rodzaj, obszar, zapis, akt, utworzyl, utworzono, zmienil, zmieniono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rodzaj = excluded.rodzaj, obszar = excluded.obszar, zapis = excluded.zapis, akt = excluded.akt, zmienil = excluded.zmienil, zmieniono = excluded.zmieniono`,
      id, rodzaj, obszar ?? null, zapis, akt, kto, t, kto, t);
    this.r.sql.exec(`DELETE FROM odniesienia WHERE od = ?`, id);
    const odn = odniesieniaZCech(ksztalt, cechy);
    if (rodzaj === 'propozycja/1' && typeof cechy.rzecz === 'string' && ID.test(cechy.rzecz) && !odn.some(([, c]) => c === cechy.rzecz)) odn.push(['rzecz', cechy.rzecz]);
    for (const [cecha, cel] of odn) this.r.sql.exec(`INSERT INTO odniesienia (od, cecha, cel) VALUES (?, ?, ?)`, id, cecha, cel);
  }

  async _rozstrzygnij(kto, c, slad) {
    if (typeof c.propozycja !== 'string' || !ID.test(c.propozycja)) return blad(400, 'propozycja: identyfikator propozycji (26 znaków)');
    if ('powod' in c && typeof c.powod !== 'string') return blad(400, 'powod: napis');
    const noweIdCelu = await idZ('przyjeta', c.propozycja);
    for (let proba = 0; proba < 4; proba++) {
      const nr0 = this.ostatniNr();
      const pr = this.rzecz(c.propozycja);
      if (!pr || pr.rodzaj !== 'propozycja/1') return blad(404, `nie ma propozycji ${c.propozycja}`);
      if (pr.cechy.stan !== 'czeka') return blad(409, `ta propozycja jest już rozstrzygnięta: ${pr.cechy.stan}`);
      const rola = this.rola(kto);
      const prowadzi = rola === 'wlasciciel' || (rola !== 'zwiedzajacy' && kto !== pr.cechy.od && this.ustawienie(pr.obszar, 'ile_wolno').wartosc === 'prowadzic');
      if (!prowadzi) return blad(rola === 'zwiedzajacy' ? 401 : 403, 'propozycję przyjmuje albo odrzuca właściciel, albo uczestnik, który w tym obszarze może prowadzić i nie jest jej autorem');
      const kiedy = new Date(this.r.teraz()).toISOString();
      const lista = [];
      let wynik;
      if (c.co === 'odrzuc') {
        const nc = { ...pr.cechy, stan: 'odrzucona', rozstrzygnal: kto, rozstrzygnieto: kiedy, ...(c.powod ? { powod: c.powod } : {}) };
        const p = await this.r.przygotujPolozenie({ op: c.op, rodzaj: 'propozycja/1', tresc: JSON.stringify({ obszar: pr.obszar, cechy: nc }), glowa: 'rzecz:' + pr.id, wersja: pr.wersja });
        if (!p.ok) return p;
        lista.push({ p, id: pr.id, rodzaj: 'propozycja/1', obszar: pr.obszar, cechy: nc, ksztalt: this.ksztaltDla('propozycja/1') });
        wynik = { skutek: 'odrzucona', propozycja: pr.id };
      } else {
        const t = pr.cechy.tresc || {};
        const stara = pr.cechy.rzecz ? this.rzecz(pr.cechy.rzecz) : null;
        if (pr.cechy.rzecz && !stara) return blad(409, 'rzecz, której dotyczy propozycja, już nie istnieje pod tym identyfikatorem');
        if (stara && stara.wersja !== pr.cechy.wersja) return blad(409, 'rzecz zmieniła się od czasu propozycji; odrzuć ją albo poproś o nową', { wersja: stara.wersja });
        const spr = this._sprawdzTresc(pr.cechy.od, pr.cechy.rodzaj, t.cechy || {}, t.obszar ?? null, stara);
        if (!spr.ok) return blad(spr.status, 'propozycja nie przechodzi dzisiejszego sprawdzenia: ' + spr.blad);
        const id = stara ? stara.id : noweIdCelu;
        const p1 = await this.r.przygotujPolozenie({ op: c.op, rodzaj: pr.cechy.rodzaj, tresc: JSON.stringify({ obszar: t.obszar ?? null, cechy: t.cechy || {} }), glowa: 'rzecz:' + id, wersja: stara ? stara.wersja : null });
        if (!p1.ok) return p1;
        const nc = { ...pr.cechy, stan: 'przyjeta', rozstrzygnal: kto, rozstrzygnieto: kiedy, wynik: id };
        const p2 = await this.r.przygotujPolozenie({ op: c.op + '.prop', rodzaj: 'propozycja/1', tresc: JSON.stringify({ obszar: pr.obszar, cechy: nc }), glowa: 'rzecz:' + pr.id, wersja: pr.wersja });
        if (!p2.ok) return p2;
        lista.push({ p: p1, id, rodzaj: pr.cechy.rodzaj, obszar: t.obszar ?? null, cechy: t.cechy || {}, ksztalt: spr.ksztalt });
        lista.push({ p: p2, id: pr.id, rodzaj: 'propozycja/1', obszar: pr.obszar, cechy: nc, ksztalt: this.ksztaltDla('propozycja/1') });
        wynik = { skutek: 'przyjeta', propozycja: pr.id, rzecz: id, adres: '/rzecz/' + id };
      }
      if (this.ostatniNr() !== nr0) continue;
      return this._zatwierdz(kto, lista, slad, wynik);
    }
    return blad(503, 'Miejsce jest teraz bardzo zajęte; ponów z tym samym op');
  }

  // Kod gościa: niezmienny zapis rodzaju kod/1. Wskazuje go cecha `kod` rzeczy rodzaju gosc/1.
  async kod(kto, tekst, { op, slad = null } = {}) {
    const rola = this.rola(kto);
    if (rola === 'zwiedzajacy') return blad(401, 'do zapisania kodu potrzebny jest klucz uczestnika');
    if (typeof tekst !== 'string' || !tekst.trim()) return blad(400, 'ciało żądania: tekst strony gościa (jeden plik HTML)');
    if (!opKlienta(op)) return blad(400, 'op: w adresie, ?op=<8 do 100 znaków z [A-Za-z0-9_-]>');
    const w = await this.r.wykonaj(kto, { op: op + '.kod', co: 'zapisz', rodzaj: 'kod/1', tresc: tekst }, { slad });
    if (!w.ok) return w;
    return { ok: true, powtorzone: w.powtorzone, zapis: w.zapis ?? w.akt.zapis, adres: '/gosc/' + (w.zapis ?? w.akt.zapis), rozmiar: new TextEncoder().encode(tekst).length };
  }

  kodGoscia(zapis) {
    if (typeof zapis !== 'string' || !ZAPIS.test(zapis)) return null;
    const z = this.q(`SELECT rodzaj, tresc FROM zapisy WHERE id = ?`, zapis)[0];
    return z && z.rodzaj === 'kod/1' ? z.tresc : null;
  }

  // --- co czeka na właściciela ------------------------------------------------------------------------------------
  czeka() {
    const prop = this.spis({ rodzaj: 'propozycja/1', limit: 2000 }).filter((p) => p.cechy.stan === 'czeka');
    const prosby = this.spis({ rodzaj: 'prosba/1', limit: 2000 }).filter((p) => p.cechy.stan === 'czeka');
    return { propozycje: prop, prosby };
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
      const pierwszy = this.q(`SELECT kto, kiedy FROM akty WHERE glowa = ? ORDER BY nr LIMIT 1`, g.nazwa)[0];
      const ostatni = this.q(`SELECT kto, kiedy FROM akty WHERE nr = ?`, g.akt)[0];
      this.r.sql.exec(`INSERT INTO rzeczy (id, rodzaj, obszar, zapis, akt, utworzyl, utworzono, zmienil, zmieniono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, g.rodzaj, (t && t.obszar) ?? null, g.zapis, g.akt, pierwszy.kto, pierwszy.kiedy, ostatni.kto, ostatni.kiedy);
    }
    this._k = null;
    for (const rz of this.spis({ limit: 2000 })) {
      const odn = odniesieniaZCech(this.ksztaltDla(rz.rodzaj), rz.cechy);
      if (rz.rodzaj === 'propozycja/1' && typeof rz.cechy.rzecz === 'string' && ID.test(rz.cechy.rzecz)) odn.push(['rzecz', rz.cechy.rzecz]);
      for (const [cecha, cel] of odn) this.r.sql.exec(`INSERT INTO odniesienia (od, cecha, cel) VALUES (?, ?, ?)`, rz.id, cecha, cel);
    }
    return { ok: true, rzeczy: glowy.length };
  }

  // --- zasiew: to, bez czego środowisko nie umie opisać samego siebie ---------------------------------------------
  // Każde ziarno ma nazwę; raz zasiane nie jest nadpisywane (zmiany po zasiewie należą do uczestników).
  async zasiej(ziarna) {
    const zrobione = [];
    for (const z of ziarna) {
      const klucz = 'ziarno:' + z.nazwa;
      if (this.r.meta(klucz)) continue;
      const id = noweId();
      const cechy = typeof z.cechy === 'function' ? await z.cechy(this) : z.cechy;
      const obszar = z.obszar ? this.r.meta('ziarno:' + z.obszar) : null;
      const ksztalt = z.rodzaj === 'ksztalt/1' ? null : this.ksztaltDla(z.rodzaj);
      if (z.rodzaj === 'ksztalt/1') { const b = sprawdzKsztalt(cechy); if (b.length) throw new Error(`ziarno ${z.nazwa}: ${b.join('; ')}`); }
      else if (ksztalt) { const s = sprawdzCechy(ksztalt, cechy, this._maRzecz, this._maZapis); if (s.bledy.length) throw new Error(`ziarno ${z.nazwa}: ${s.bledy.join('; ')}`); }
      const p = await this.r.przygotujPolozenie({ op: 'zasiew-' + z.nazwa, rodzaj: z.rodzaj, tresc: JSON.stringify({ obszar: obszar ?? null, cechy }), glowa: 'rzecz:' + id, wersja: null });
      if (!p.ok) throw new Error(`ziarno ${z.nazwa}: ${p.blad}`);
      if (this.r.meta(klucz)) continue; // ktoś zasiał w czasie liczenia skrótu
      const w = this.r.zatwierdzPolozenia(AUTOMAT, [p], { slad: 'zasiew' });
      if (!w.ok) throw new Error(`ziarno ${z.nazwa}: ${w.blad}`);
      this._projekcja(id, z.rodzaj, obszar, p.id, w.wyniki[0].wersja, AUTOMAT, cechy, z.rodzaj === 'ksztalt/1' ? this.ksztaltDla('ksztalt/1') : ksztalt);
      this.r.ustawMeta(klucz, id);
      if (z.meta) this.r.ustawMeta(z.meta, id);
      zrobione.push(z.nazwa);
    }
    return zrobione;
  }
}
