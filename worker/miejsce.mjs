// Miejsce: wspólny stan Jaskini po stronie serwera, a nie w pamięci jednej przeglądarki (11 XI 2026).
// Status: próba (TYMCZASOWE.md). Kształt idzie za szkicem rdzenia zapisów (docs/rdzen-zapisow-szkic.md) i za R2
// Opusa Code (Jaskinia PR #8): trzy tożsamości zamiast jednej.
//   - zapis: niezmienna treść; tożsamość z treści (skrót rodzaju i treści), więc ta sama treść to ten sam zapis;
//   - akt: kto, kiedy i co zrobił; każdy akt zostaje w dzienniku, także drugi zapis tej samej treści;
//   - operacja (op): identyfikator czynności nadany przez wołającego. Powtórzone dostarczenie tej samej czynności
//     daje ten sam akt i mówi to wprost (powtorzone: true). Ten sam op dla innej czynności to konflikt (409),
//     nigdy cichy sukces (kontrprzykład Menadżera do R2, 10 XI).
// Głowa: nazwany wskaźnik na zapis, przesuwany tylko przez porównaj i zamień, więc stara karta, stary telefon albo
// spóźniony agent nie nadpiszą nowszego stanu. Porównanie idzie po numerze aktu, który ostatnio przesunął głowę
// (rośnie zawsze), a nie po zapisie: przy A -> B -> A klient pamiętający pierwsze A nie przejdzie (Astra, 5 XI). Durable Object wykonuje żądania jedno po drugim, więc sprawdzenie
// i zapis głowy nie przeplatają się z innym żądaniem.
// Ten plik nie zna Cloudflare: dostaje obiekt sql z metodą exec(zapytanie, ...parametry), jak ctx.storage.sql
// w Durable Object. Testy podają mu node:sqlite.

export const WERSJA = 'miejsce-1';
export const LIMIT_TRESCI = 2 * 1024 * 1024; // bajty; wiersz SQLite w Durable Object ma limit 8 MB
export const LIMIT_DZIENNIKA = 200;
export const WLASCICIEL = 'jozz';

const IMIE = /^[a-z][a-z0-9_-]{0,39}$/;
const RODZAJ = /^[a-z][a-z0-9_-]{0,39}$/;
const OP = /^[A-Za-z0-9_.:-]{8,120}$/;
// jozz:<ścieżka> przesuwa tylko właściciel; agent:<imię>:<ścieżka> ten agent i właściciel; wspolne:<ścieżka> każdy z kluczem
const GLOWA = /^(jozz|wspolne|agent:[a-z][a-z0-9_-]{0,39}):[a-z0-9_./-]{1,120}$/;

const enc = new TextEncoder();
export async function skrot(tekst) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(tekst));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const poprawneImie = (s) => typeof s === 'string' && IMIE.test(s);

function mozePrzesunac(kto, glowa) {
  if (kto === WLASCICIEL) return true;
  const [przestrzen, kogo] = glowa.split(':');
  if (przestrzen === 'wspolne') return true;
  if (przestrzen === 'agent') return kogo === kto;
  return false;
}

const SCHEMAT = [
  `CREATE TABLE IF NOT EXISTS zapisy (id TEXT PRIMARY KEY, rodzaj TEXT NOT NULL, tresc TEXT NOT NULL, rozmiar INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS akty (nr INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL UNIQUE, odcisk TEXT NOT NULL,
     kto TEXT NOT NULL, kiedy INTEGER NOT NULL, co TEXT NOT NULL, zapis TEXT, glowa TEXT, z_zapisu TEXT, nowy INTEGER)`,
  `CREATE TABLE IF NOT EXISTS glowy (nazwa TEXT PRIMARY KEY, zapis TEXT NOT NULL, akt INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS odczyty (kto TEXT PRIMARY KEY, nr INTEGER NOT NULL, kiedy INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS meta (klucz TEXT PRIMARY KEY, wartosc TEXT NOT NULL)`,
];

const blad = (status, tekst, extra = {}) => ({ ok: false, status, blad: tekst, ...extra });

export class Rdzen {
  constructor(sql, { teraz = () => Date.now() } = {}) {
    this.sql = sql;
    this.teraz = teraz;
    for (const s of SCHEMAT) sql.exec(s);
    const w = sql.exec(`SELECT wartosc FROM meta WHERE klucz = 'schemat'`).toArray()[0];
    if (!w) sql.exec(`INSERT INTO meta (klucz, wartosc) VALUES ('schemat', ?)`, WERSJA);
  }

  q(zapytanie, ...p) { return this.sql.exec(zapytanie, ...p).toArray(); }

  // Jedna czynność. Najpierw wszystko, co asynchroniczne (skróty), potem sprawdzenie i zapis bez przerwy.
  async wykonaj(kto, cialo) {
    if (!poprawneImie(kto)) return blad(401, 'nieznany wykonawca');
    if (!cialo || typeof cialo !== 'object') return blad(400, 'ciało żądania musi być obiektem JSON');
    const { op, co } = cialo;
    if (typeof op !== 'string' || !OP.test(op)) return blad(400, 'op: 8 do 120 znaków z [A-Za-z0-9_.:-], nadaje go wołający, ten sam przy ponowieniu');
    let przyg;
    if (co === 'zapisz') przyg = await this.przygotujZapis(cialo);
    else if (co === 'przesun') przyg = this.przygotujPrzesuniecie(kto, cialo);
    else return blad(400, 'co: zapisz albo przesun');
    if (!przyg.ok) return przyg;
    const odcisk = await skrot(JSON.stringify([co, przyg.odcisk]));
    // od tej linii synchronicznie: nic nie przeplata się z innym żądaniem
    const byl = this.q(`SELECT * FROM akty WHERE op = ?`, op)[0];
    if (byl) {
      if (byl.kto === kto && byl.odcisk === odcisk) return { ok: true, powtorzone: true, akt: this.opisAktu(byl) };
      return blad(409, 'ten op należy już do innej czynności; nowa czynność potrzebuje nowego op', { akt: this.opisAktu(byl) });
    }
    return co === 'zapisz' ? this.zapisz(kto, op, odcisk, przyg) : this.przesun(kto, op, odcisk, przyg);
  }

  async przygotujZapis({ rodzaj, tresc }) {
    if (typeof rodzaj !== 'string' || !RODZAJ.test(rodzaj)) return blad(400, 'rodzaj: małe litery, cyfry, - i _, do 40 znaków');
    if (typeof tresc !== 'string') return blad(400, 'tresc musi być tekstem (JSON zapisz jako tekst)');
    const rozmiar = enc.encode(tresc).length;
    if (rozmiar > LIMIT_TRESCI) return blad(413, `treść ma ${rozmiar} B, limit to ${LIMIT_TRESCI} B`);
    const id = await skrot(rodzaj + '\n' + tresc);
    return { ok: true, rodzaj, tresc, rozmiar, id, odcisk: id };
  }

  przygotujPrzesuniecie(kto, { glowa, wersja = null, na }) {
    if (typeof glowa !== 'string' || !GLOWA.test(glowa)) return blad(400, 'glowa: jozz:…, wspolne:… albo agent:<imię>:…');
    if (!mozePrzesunac(kto, glowa)) return blad(403, `${kto} nie może przesuwać głowy ${glowa}`);
    if (wersja !== null && !Number.isInteger(wersja)) return blad(400, 'wersja: numer aktu, który ostatnio przesunął głowę (z odczytu), albo null dla nowej głowy');
    if (typeof na !== 'string') return blad(400, 'na: identyfikator zapisu');
    return { ok: true, glowa, wersja, na, odcisk: [glowa, wersja, na].join('|') };
  }

  zapisz(kto, op, odcisk, { rodzaj, tresc, rozmiar, id }) {
    const nowy = !this.q(`SELECT 1 AS j FROM zapisy WHERE id = ?`, id).length;
    if (nowy) this.sql.exec(`INSERT INTO zapisy (id, rodzaj, tresc, rozmiar) VALUES (?, ?, ?, ?)`, id, rodzaj, tresc, rozmiar);
    this.sql.exec(`INSERT INTO akty (op, odcisk, kto, kiedy, co, zapis, nowy) VALUES (?, ?, ?, ?, 'zapisz', ?, ?)`, op, odcisk, kto, this.teraz(), id, nowy ? 1 : 0);
    return { ok: true, powtorzone: false, zapis: id, nowy, akt: this.opisAktu(this.ostatniAkt()) };
  }

  przesun(kto, op, odcisk, { glowa, wersja, na }) {
    if (!this.q(`SELECT 1 AS j FROM zapisy WHERE id = ?`, na).length) return blad(404, 'nie ma zapisu, na który miałaby wskazać głowa');
    const teraz = this.q(`SELECT zapis, akt FROM glowy WHERE nazwa = ?`, glowa)[0];
    const aktualna = teraz ? teraz.akt : null;
    if (aktualna !== wersja) return blad(409, 'głowa przesunęła się po Twoim odczycie; przeczytaj ją znowu', { glowa, wersja: aktualna, zapis: teraz ? teraz.zapis : null });
    this.sql.exec(`INSERT INTO akty (op, odcisk, kto, kiedy, co, zapis, glowa, z_zapisu) VALUES (?, ?, ?, ?, 'przesun', ?, ?, ?)`, op, odcisk, kto, this.teraz(), na, glowa, teraz ? teraz.zapis : null);
    const akt = this.ostatniAkt();
    this.sql.exec(`INSERT INTO glowy (nazwa, zapis, akt) VALUES (?, ?, ?) ON CONFLICT(nazwa) DO UPDATE SET zapis = excluded.zapis, akt = excluded.akt`, glowa, na, akt.nr);
    return { ok: true, powtorzone: false, glowa, zapis: na, wersja: akt.nr, akt: this.opisAktu(akt) };
  }

  ostatniAkt() { return this.q(`SELECT * FROM akty ORDER BY nr DESC LIMIT 1`)[0]; }

  opisAktu(a) {
    return { nr: a.nr, op: a.op, kto: a.kto, kiedy: new Date(a.kiedy).toISOString(), co: a.co, zapis: a.zapis,
      ...(a.co === 'przesun' ? { glowa: a.glowa, z: a.z_zapisu } : { nowy: !!a.nowy }) };
  }

  glowa(nazwa) {
    const g = this.q(`SELECT g.nazwa, g.zapis, g.akt, z.rodzaj, z.tresc FROM glowy g JOIN zapisy z ON z.id = g.zapis WHERE g.nazwa = ?`, nazwa)[0];
    return g ? { ok: true, glowa: g.nazwa, zapis: g.zapis, wersja: g.akt, rodzaj: g.rodzaj, tresc: g.tresc } : blad(404, 'nie ma takiej głowy', { wersja: null });
  }

  zapisTresc(id) {
    const z = this.q(`SELECT * FROM zapisy WHERE id = ?`, id)[0];
    return z ? { ok: true, ...z } : blad(404, 'nie ma takiego zapisu');
  }

  // Co się działo po akcie nr `od`. Treści dołączone do aktów zapisu; najwyżej LIMIT_DZIENNIKA na raz, z kursorem.
  dziennik(od = 0, limit = LIMIT_DZIENNIKA) {
    const n = Math.max(1, Math.min(LIMIT_DZIENNIKA, limit | 0 || LIMIT_DZIENNIKA));
    const wiersze = this.q(`SELECT a.*, z.rodzaj, z.tresc, z.rozmiar FROM akty a LEFT JOIN zapisy z ON z.id = a.zapis WHERE a.nr > ? ORDER BY a.nr LIMIT ?`, od | 0, n + 1);
    const wiecej = wiersze.length > n;
    const akty = wiersze.slice(0, n).map((w) => ({ ...this.opisAktu(w), rodzaj: w.rodzaj, tresc: w.co === 'zapisz' ? w.tresc : undefined, rozmiar: w.rozmiar }));
    const ostatni = this.q(`SELECT COALESCE(MAX(nr), 0) AS nr FROM akty`)[0].nr;
    return { ok: true, od: od | 0, akty, wiecej, dalej: akty.length ? akty[akty.length - 1].nr : od | 0, ostatni };
  }

  // Ponowne spotkanie: co przybyło od ostatniego odczytu tego czytelnika, na każdym jego urządzeniu naraz.
  nowe(kto) {
    const o = this.q(`SELECT nr, kiedy FROM odczyty WHERE kto = ?`, kto)[0];
    const d = this.dziennik(o ? o.nr : 0);
    return { ...d, widziane_do: o ? o.nr : 0, widziane_kiedy: o ? new Date(o.kiedy).toISOString() : null, cudze: d.akty.filter((a) => a.kto !== kto).length };
  }

  widzialem(kto, nr) {
    if (!Number.isInteger(nr) || nr < 0) return blad(400, 'nr: numer ostatniego przeczytanego aktu');
    const ostatni = this.q(`SELECT COALESCE(MAX(nr), 0) AS nr FROM akty`)[0].nr;
    const n = Math.min(nr, ostatni);
    // nigdy w tył: starszy telefon nie cofnie tego, co już przeczytałeś na komputerze
    this.sql.exec(`INSERT INTO odczyty (kto, nr, kiedy) VALUES (?, ?, ?) ON CONFLICT(kto) DO UPDATE SET nr = MAX(nr, excluded.nr), kiedy = excluded.kiedy`, kto, n, this.teraz());
    return { ok: true, widziane_do: this.q(`SELECT nr FROM odczyty WHERE kto = ?`, kto)[0].nr };
  }

  stan() {
    const l = (t) => this.q(`SELECT COUNT(*) AS n FROM ${t}`)[0].n;
    const ostatni = this.ostatniAkt();
    return { ok: true, wersja: WERSJA, zapisy: l('zapisy'), akty: l('akty'), glowy: l('glowy'),
      ostatni_akt: ostatni ? new Date(ostatni.kiedy).toISOString() : null };
  }

  // Całość jako jeden JSON: kopia na dysk właściciela, przeprowadzka, praca bez nas.
  eksport() {
    return { ok: true, format: 'jaskinia-miejsce', wersja: WERSJA, zebrane: new Date(this.teraz()).toISOString(),
      zapisy: this.q(`SELECT * FROM zapisy ORDER BY id`), akty: this.q(`SELECT * FROM akty ORDER BY nr`),
      glowy: this.q(`SELECT * FROM glowy ORDER BY nazwa`), odczyty: this.q(`SELECT * FROM odczyty ORDER BY kto`) };
  }
}

// HTTP wewnątrz Miejsca. Worker sprawdził klucz i podaje wykonawcę w nagłówku x-kto; z zewnątrz do Durable Object
// nie da się wejść inaczej niż przez Workera, a Worker zawsze nadpisuje ten nagłówek.
export async function obsluzMiejsce(rdzen, request) {
  const url = new URL(request.url);
  const kto = request.headers.get('x-kto');
  const sciezka = url.pathname.replace(/^\/api\/miejsce\/?/, '');
  const odp = (o) => new Response(JSON.stringify(o, null, 2), {
    status: o.ok === false ? o.status || 400 : 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
  const ciało = async () => { try { return await request.json(); } catch { return null; } };
  if (request.method === 'GET') {
    if (sciezka === '') return odp({ ...rdzen.stan(), ja: kto, wlasciciel: kto === WLASCICIEL });
    if (sciezka === 'dziennik') return odp(rdzen.dziennik(Number(url.searchParams.get('od') || 0), Number(url.searchParams.get('ile') || LIMIT_DZIENNIKA)));
    if (sciezka === 'nowe') return odp(rdzen.nowe(kto));
    if (sciezka === 'glowa') return odp(rdzen.glowa(url.searchParams.get('nazwa') || ''));
    if (sciezka === 'zapis') return odp(rdzen.zapisTresc(url.searchParams.get('id') || ''));
    if (sciezka === 'eksport') return odp(kto === WLASCICIEL ? rdzen.eksport() : blad(403, 'eksport całości tylko dla właściciela'));
  }
  if (request.method === 'POST') {
    if (sciezka === 'akt') return odp(await rdzen.wykonaj(kto, await ciało()));
    if (sciezka === 'widzialem') { const c = await ciało(); return odp(rdzen.widzialem(kto, c && c.nr)); }
  }
  return odp(blad(404, 'nie ma takiej ścieżki w Miejscu'));
}
