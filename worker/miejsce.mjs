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

// Wersja formatu wywozu. miejsce-2 (17 XI 2026): akt niesie ślad ciała (`cialo`), rodzaj może mieć pokolenie
// (`rzecz/2`), a obok starych przestrzeni głów jest `rzecz:<id>` (tożsamość rzeczy, rusza ją tylko warstwa środowiska).
// miejsce-3 (17 XI 2026, po niezależnym ataku): `op` jest jednoznaczny w obrębie uczestnika, nie całego Miejsca,
// a wywóz niesie też `meta` (znaczniki zasiewu i wskazania obszarów), bez której wwóz nie odtwarzał środowiska.
// miejsce-4 (20 XI 2026, próba 1 umowy zapisu): akt może być wydalony (kolumny `wydalone`: chwila wydalenia w ms,
// `wydalone_przez`: obszar, którego ustawienie historii o tym zdecydowało). Akt wydalony zostaje w dzienniku jako ślad
// (numer, kto, kiedy), a jego zapis może już nie istnieć. Wwóz przyjmuje wszystkie cztery: starsze są tym samym
// układem bez tych rzeczy (żaden akt nie jest w nich wydalony).
export const WERSJA = 'miejsce-4';
// Zapytania, które zmieniają tabelę aktów: po każdym takim pamiętany numer ostatniego aktu przestaje być ważny.
const ZMIENIA_AKTY = /^\s*(INSERT\s+INTO|DELETE\s+FROM|UPDATE|ALTER\s+TABLE|DROP\s+TABLE)\s+akty\b/i;
export const WERSJE_WWOZU = ['miejsce-1', 'miejsce-2', 'miejsce-3', 'miejsce-4'];
export const LIMIT_TRESCI = 2 * 1024 * 1024; // bajty; wiersz SQLite w Durable Object ma limit 8 MB
export const LIMIT_DZIENNIKA = 200;
export const WLASCICIEL = 'jozz';

const IMIE = /^[a-z][a-z0-9_-]{0,39}$/;
export const PRYWATNE_GLOWY = 'jozz:prywatne/';
// Rodzaj z opcjonalnym pokoleniem: `uwaga`, `rzecz/2`, `gosc.edytor-potworow/1`. Jądro nie wie, co rodzaj znaczy.
const RODZAJ = /^[a-z][a-z0-9_.-]{0,79}(\/[1-9][0-9]{0,5})?$/;
export const poprawnyRodzaj = (s) => typeof s === 'string' && RODZAJ.test(s);
const CIALO = /^[\x20-\x7e]{1,80}$/;
const OP = /^[A-Za-z0-9_.:-]{8,120}$/;
// jozz:<ścieżka> przesuwa tylko właściciel; agent:<imię>:<ścieżka> ten agent i właściciel; wspolne:<ścieżka> każdy z kluczem
// rzecz:<26 znaków> to tożsamość rzeczy w środowisku; prawo do jej ruszenia liczy warstwa środowiska z danych
// (worker/srodowisko.mjs), więc starymi drzwiami /api/miejsce nie da się jej przesunąć.
const GLOWA = /^((jozz|wspolne|agent:[a-z][a-z0-9_-]{0,39}):[a-z0-9_./-]{1,120}|rzecz:[0-9a-z]{26})$/;
export const poprawnaGlowa = (s) => typeof s === 'string' && GLOWA.test(s);

const enc = new TextEncoder();
export async function skrot(tekst) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(tekst));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const poprawneImie = (s) => typeof s === 'string' && IMIE.test(s);

function mozePrzesunac(kto, glowa, wlasciciel = WLASCICIEL, warstwa = false) {
  const [przestrzen, kogo] = glowa.split(':');
  if (przestrzen === 'rzecz') return warstwa === true;
  if (kto === wlasciciel) return true;
  if (przestrzen === 'wspolne') return true;
  if (przestrzen === 'agent') return kogo === kto;
  return false;
}

// `op` jest jednoznaczny w obrębie uczestnika (indeks akty_kto_op), nie całego Miejsca: dwóch uczestników może
// użyć tego samego napisu i żaden nie zobaczy przez to cudzego aktu (znalezisko niezależnego ataku, 17 XI 2026).
const TABELA_AKTY = `(nr INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL, odcisk TEXT NOT NULL,
     kto TEXT NOT NULL, kiedy INTEGER NOT NULL, co TEXT NOT NULL, zapis TEXT, glowa TEXT, z_zapisu TEXT, nowy INTEGER,
     prywatne INTEGER NOT NULL DEFAULT 0, cialo TEXT, wydalone INTEGER, wydalone_przez TEXT)`;
const SCHEMAT = [
  `CREATE TABLE IF NOT EXISTS zapisy (id TEXT PRIMARY KEY, rodzaj TEXT NOT NULL, tresc TEXT NOT NULL, rozmiar INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS akty ${TABELA_AKTY}`,
  `CREATE TABLE IF NOT EXISTS glowy (nazwa TEXT PRIMARY KEY, zapis TEXT NOT NULL, akt INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS odczyty (kto TEXT PRIMARY KEY, nr INTEGER NOT NULL, kiedy INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS meta (klucz TEXT PRIMARY KEY, wartosc TEXT NOT NULL)`,
];
// Indeksy dołożone 17 XI 2026, zanim są dane: po danych byłaby to zmiana istniejącej kości (uwaga Opusa Code).
const INDEKSY = [
  `CREATE UNIQUE INDEX IF NOT EXISTS akty_kto_op ON akty (kto, op)`,
  `CREATE INDEX IF NOT EXISTS akty_zapis ON akty (zapis)`,
  `CREATE INDEX IF NOT EXISTS akty_glowa ON akty (glowa)`,
  `CREATE INDEX IF NOT EXISTS zapisy_rodzaj ON zapisy (rodzaj)`,
];

const blad = (status, tekst, extra = {}) => ({ ok: false, status, blad: tekst, ...extra });

export class Rdzen {
  constructor(sql, { teraz = () => Date.now(), wlasciciel = WLASCICIEL, transakcja = null } = {}) {
    // Numer ostatniego aktu jest pamiętany (ostatniNr), bo pyta o niego prawie każde czytanie, a bez pamięci każde
    // pytanie to wiersz bazy (zmierzone 17 XI: spis 636 rzeczy pytał o niego 636 razy). Każde zapytanie, które zmienia
    // tabelę aktów, kasuje tę pamięć, więc jest zawsze prawdziwa. Założenie: jedno jądro na jedną bazę (tak jest
    // w Durable Object); drugie jądro piszące do tej samej bazy tej pamięci by nie skasowało.
    this._nr = null;
    this.sql = {
      exec: (zapytanie, ...p) => { if (ZMIENIA_AKTY.test(zapytanie)) this._nr = null; return sql.exec(zapytanie, ...p); },
      get databaseSize() { return sql.databaseSize; },
    };
    // Wszystko albo nic (21 XI 2026). Durable Object łączy zapisy bez `await` w jeden atomowy zapis na dysk, więc awaria
    // maszyny nie zostawia połowy czynności. Wyjątek w połowie (błąd magazynu, przekroczony limit, błąd w kodzie spisu)
    // zostawia jednak zapisy sprzed niego; cofa je dopiero ctx.storage.transactionSync, a w Node punkt zapisu
    // (sql-node.mjs). Bez żadnej z nich czynność idzie jak dotąd, bez tej gwarancji.
    this._transakcja = typeof transakcja === 'function' ? transakcja : typeof sql.transakcja === 'function' ? (fn) => sql.transakcja(fn) : null;
    this._glebokosc = 0;
    this.teraz = teraz;
    // Kto jest właścicielem, przychodzi z ustawienia Workera, a nie z kodu; `jozz` jest tylko wartością domyślną.
    this.wlasciciel = poprawneImie(wlasciciel) ? wlasciciel : WLASCICIEL;
    for (const s of SCHEMAT) sql.exec(s);
    const kolumny = () => sql.exec(`PRAGMA table_info(akty)`).toArray().map((k) => k.name);
    // migracja 11 XI: prywatność aktu (kolumna dopisana do istniejących baz, bez ruszania danych)
    if (!kolumny().includes('prywatne')) sql.exec(`ALTER TABLE akty ADD COLUMN prywatne INTEGER NOT NULL DEFAULT 0`);
    // migracja 17 XI: ślad ciała przy akcie (czym uczestnik to zrobił; jego własna deklaracja, nie dowód)
    if (!kolumny().includes('cialo')) sql.exec(`ALTER TABLE akty ADD COLUMN cialo TEXT`);
    // migracja 20 XI (próba 1 umowy zapisu): ślad wydalenia przy akcie. Dopisane kolumny są puste, czyli "nic nie
    // wydalono", co dla każdej bazy sprzed tej chwili jest prawdą.
    if (!kolumny().includes('wydalone')) sql.exec(`ALTER TABLE akty ADD COLUMN wydalone INTEGER`);
    if (!kolumny().includes('wydalone_przez')) sql.exec(`ALTER TABLE akty ADD COLUMN wydalone_przez TEXT`);
    // migracja 17 XI (druga): dawna tabela miała `op` jednoznaczny w całym Miejscu, wpisany w jej definicję.
    // Tego nie da się zdjąć w miejscu, więc tabela jest przepisywana raz, z tymi samymi numerami aktów.
    const def = sql.exec(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'akty'`).toArray()[0];
    if (def && /op\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(String(def.sql))) {
      sql.exec(`ALTER TABLE akty RENAME TO akty_dawne`);
      sql.exec(`CREATE TABLE akty ${TABELA_AKTY}`);
      sql.exec(`INSERT INTO akty (nr, op, odcisk, kto, kiedy, co, zapis, glowa, z_zapisu, nowy, prywatne, cialo)
        SELECT nr, op, odcisk, kto, kiedy, co, zapis, glowa, z_zapisu, nowy, prywatne, cialo FROM akty_dawne ORDER BY nr`);
      sql.exec(`DROP TABLE akty_dawne`);
    }
    for (const s of INDEKSY) sql.exec(s);
    const w = sql.exec(`SELECT wartosc FROM meta WHERE klucz = 'schemat'`).toArray()[0];
    if (!w) sql.exec(`INSERT INTO meta (klucz, wartosc) VALUES ('schemat', ?)`, WERSJA);
  }

  q(zapytanie, ...p) { return this.sql.exec(zapytanie, ...p).toArray(); }

  // Jedna czynność. Najpierw wszystko, co asynchroniczne (skróty), potem sprawdzenie i zapis bez przerwy.
  async wykonaj(kto, cialo, { warstwa = false, slad = null } = {}) {
    if (!poprawneImie(kto)) return blad(401, 'nieznany wykonawca');
    this._slad = typeof slad === 'string' && CIALO.test(slad) ? slad : null;
    this._warstwa = warstwa === true;
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
    const byl = this.q(`SELECT * FROM akty WHERE kto = ? AND op = ?`, kto, op)[0];
    if (byl) {
      if (byl.odcisk === odcisk) return { ok: true, powtorzone: true, akt: this.opisAktu(byl) };
      return blad(409, 'ten op należy już do innej Twojej czynności; nowa czynność potrzebuje nowego op', { akt: this.opisAktu(byl) });
    }
    return co === 'zapisz' ? this.zapisz(kto, op, odcisk, przyg) : this.przesun(kto, op, odcisk, przyg);
  }

  async przygotujZapis({ rodzaj, tresc, prywatne = false }) {
    if (typeof prywatne !== 'boolean') return blad(400, 'prywatne: true albo false');
    if (typeof rodzaj !== 'string' || !RODZAJ.test(rodzaj)) return blad(400, 'rodzaj: małe litery, cyfry, kropka, - i _, do 80 znaków, opcjonalnie /pokolenie (np. rzecz/2)');
    if (typeof tresc !== 'string') return blad(400, 'tresc musi być tekstem (JSON zapisz jako tekst)');
    const rozmiar = enc.encode(tresc).length;
    if (rozmiar > LIMIT_TRESCI) return blad(413, `treść ma ${rozmiar} B, limit to ${LIMIT_TRESCI} B`);
    const id = await skrot(rodzaj + '\n' + tresc);
    return { ok: true, rodzaj, tresc, rozmiar, id, prywatne, odcisk: id + (prywatne ? '|prywatne' : '') };
  }

  przygotujPrzesuniecie(kto, { glowa, wersja = null, na }) {
    if (typeof glowa !== 'string' || !GLOWA.test(glowa)) return blad(400, 'glowa: jozz:…, wspolne:… albo agent:<imię>:…');
    if (!mozePrzesunac(kto, glowa, this.wlasciciel, this._warstwa)) return blad(403, glowa.startsWith('rzecz:') ? 'rzeczy środowiska rusza się przez /api/srodowisko/ruch, nie tędy' : `${kto} nie może przesuwać głowy ${glowa}`);
    if (wersja !== null && !Number.isInteger(wersja)) return blad(400, 'wersja: numer aktu, który ostatnio przesunął głowę (z odczytu), albo null dla nowej głowy');
    if (typeof na !== 'string') return blad(400, 'na: identyfikator zapisu');
    return { ok: true, glowa, wersja, na, odcisk: [glowa, wersja, na].join('|') };
  }

  zapisz(kto, op, odcisk, { rodzaj, tresc, rozmiar, id, prywatne }) {
    const nowy = !this.q(`SELECT 1 AS j FROM zapisy WHERE id = ?`, id).length;
    if (nowy) this.sql.exec(`INSERT INTO zapisy (id, rodzaj, tresc, rozmiar) VALUES (?, ?, ?, ?)`, id, rodzaj, tresc, rozmiar);
    this.sql.exec(`INSERT INTO akty (op, odcisk, kto, kiedy, co, zapis, nowy, prywatne, cialo) VALUES (?, ?, ?, ?, 'zapisz', ?, ?, ?, ?)`, op, odcisk, kto, this.teraz(), id, nowy ? 1 : 0, prywatne ? 1 : 0, this._slad ?? null);
    return { ok: true, powtorzone: false, zapis: id, nowy, akt: this.opisAktu(this.ostatniAkt()) };
  }

  przesun(kto, op, odcisk, { glowa, wersja, na }) {
    if (!this.q(`SELECT 1 AS j FROM zapisy WHERE id = ?`, na).length) return blad(404, 'nie ma zapisu, na który miałaby wskazać głowa');
    const teraz = this.q(`SELECT zapis, akt FROM glowy WHERE nazwa = ?`, glowa)[0];
    const aktualna = teraz ? teraz.akt : null;
    if (aktualna !== wersja) return blad(409, 'głowa przesunęła się po Twoim odczycie; przeczytaj ją znowu', { glowa, wersja: aktualna, zapis: teraz ? teraz.zapis : null });
    this.sql.exec(`INSERT INTO akty (op, odcisk, kto, kiedy, co, zapis, glowa, z_zapisu, cialo) VALUES (?, ?, ?, ?, 'przesun', ?, ?, ?, ?)`, op, odcisk, kto, this.teraz(), na, glowa, teraz ? teraz.zapis : null, this._slad ?? null);
    const akt = this.ostatniAkt();
    this.sql.exec(`INSERT INTO glowy (nazwa, zapis, akt) VALUES (?, ?, ?) ON CONFLICT(nazwa) DO UPDATE SET zapis = excluded.zapis, akt = excluded.akt`, glowa, na, akt.nr);
    return { ok: true, powtorzone: false, glowa, zapis: na, wersja: akt.nr, akt: this.opisAktu(akt) };
  }

  // Czynność w transakcji; zagnieżdżona idzie w zewnętrznej. Po wycofaniu kasujemy pamięć numeru aktu, bo mogła
  // zapamiętać akt, którego już nie ma.
  wTransakcji(fn) {
    if (!this._transakcja || this._glebokosc > 0) return fn();
    this._glebokosc++;
    try { return this._transakcja(fn); }
    catch (e) { this._nr = null; throw e; }
    finally { this._glebokosc--; }
  }

  ostatniAkt() { return this.q(`SELECT * FROM akty ORDER BY nr DESC LIMIT 1`)[0]; }
  ostatniNr() {
    if (this._nr === null) this._nr = this.q(`SELECT COALESCE(MAX(nr), 0) AS nr FROM akty`)[0].nr;
    return this._nr;
  }

  // Położenie: zapis treści i przesunięcie głowy jako jedna czynność. Używa go warstwa środowiska, która sama
  // policzyła prawo do ruchu z danych. Dwa kroki, bo skróty są asynchroniczne, a sprawdzenie i zapis muszą iść
  // bez przerwy: `przygotujPolozenie` liczy skróty, `zatwierdzPolozenia` robi resztę synchronicznie dla całej
  // listy, wszystko albo nic (gest zmieniający dwie rzeczy jest jedną czynnością).
  async przygotujPolozenie({ op, rodzaj, tresc, glowa, wersja = null }) {
    if (typeof op !== 'string' || !OP.test(op)) return blad(400, 'op: 8 do 120 znaków z [A-Za-z0-9_.:-]');
    const z = await this.przygotujZapis({ rodzaj, tresc });
    if (!z.ok) return z;
    if (!poprawnaGlowa(glowa)) return blad(400, 'glowa: zła nazwa');
    if (wersja !== null && !Number.isInteger(wersja)) return blad(400, 'wersja: numer aktu, który ostatnio przesunął głowę, albo null dla nowej');
    const odciskZ = await skrot(JSON.stringify(['zapisz', z.odcisk]));
    const odciskP = await skrot(JSON.stringify(['przesun', [glowa, wersja, z.id].join('|')]));
    return { ok: true, op, rodzaj, tresc, rozmiar: z.rozmiar, id: z.id, glowa, wersja, odciskZ, odciskP };
  }

  zatwierdzPolozenia(kto, lista, opcje = {}) { return this.wTransakcji(() => this._zatwierdzPolozenia(kto, lista, opcje)); }

  _zatwierdzPolozenia(kto, lista, { slad = null } = {}) {
    if (!poprawneImie(kto)) return blad(401, 'nieznany wykonawca');
    const cialo = typeof slad === 'string' && CIALO.test(slad) ? slad : null;
    // 1. powtórzenie tej samej czynności: wszystkie akty już są, z tym samym odciskiem
    const jeden = (op) => this.q(`SELECT * FROM akty WHERE kto = ? AND op = ?`, kto, op)[0];
    const byle = lista.map((p) => ({ z: jeden(p.op + '.z'), p: jeden(p.op + '.p') }));
    if (byle.length && byle.every((b) => b.z && b.p)) {
      const te = byle.every((b, i) => b.z.odcisk === lista[i].odciskZ && b.p.odcisk === lista[i].odciskP);
      if (te) return { ok: true, powtorzone: true, wyniki: byle.map((b, i) => ({ glowa: lista[i].glowa, zapis: lista[i].id, wersja: b.p.nr, kiedy: b.p.kiedy })) };
      return blad(409, 'ten op należy już do innej Twojej czynności; nowa czynność potrzebuje nowego op');
    }
    if (byle.some((b) => b.z || b.p)) return blad(409, 'ten op należy już do innej Twojej czynności; nowa czynność potrzebuje nowego op');
    // 2. porównanie wszystkich głów, zanim cokolwiek zostanie zapisane
    for (const p of lista) {
      const g = this.q(`SELECT zapis, akt FROM glowy WHERE nazwa = ?`, p.glowa)[0];
      const aktualna = g ? g.akt : null;
      if (aktualna !== p.wersja) return blad(409, 'rzecz zmieniła się po Twoim odczycie; przeczytaj ją znowu', { glowa: p.glowa, wersja: aktualna });
    }
    // 3. zapis: nic tu nie zależy już od danych
    const wyniki = [];
    for (const p of lista) {
      const nowy = !this.q(`SELECT 1 AS j FROM zapisy WHERE id = ?`, p.id).length;
      if (nowy) this.sql.exec(`INSERT INTO zapisy (id, rodzaj, tresc, rozmiar) VALUES (?, ?, ?, ?)`, p.id, p.rodzaj, p.tresc, p.rozmiar);
      const g = this.q(`SELECT zapis FROM glowy WHERE nazwa = ?`, p.glowa)[0];
      const kiedy = this.teraz(); // jedna chwila na oba akty położenia: to jeden ruch
      this.sql.exec(`INSERT INTO akty (op, odcisk, kto, kiedy, co, zapis, nowy, prywatne, cialo) VALUES (?, ?, ?, ?, 'zapisz', ?, ?, 0, ?)`, p.op + '.z', p.odciskZ, kto, kiedy, p.id, nowy ? 1 : 0, cialo);
      this.sql.exec(`INSERT INTO akty (op, odcisk, kto, kiedy, co, zapis, glowa, z_zapisu, cialo) VALUES (?, ?, ?, ?, 'przesun', ?, ?, ?, ?)`, p.op + '.p', p.odciskP, kto, kiedy, p.id, p.glowa, g ? g.zapis : null, cialo);
      const akt = this.ostatniAkt();
      this.sql.exec(`INSERT INTO glowy (nazwa, zapis, akt) VALUES (?, ?, ?) ON CONFLICT(nazwa) DO UPDATE SET zapis = excluded.zapis, akt = excluded.akt`, p.glowa, p.id, akt.nr);
      wyniki.push({ glowa: p.glowa, zapis: p.id, wersja: akt.nr, kiedy, z: g ? g.zapis : null });
    }
    return { ok: true, powtorzone: false, wyniki };
  }

  opisAktu(a) {
    return { nr: a.nr, op: a.op, kto: a.kto, kiedy: new Date(a.kiedy).toISOString(), co: a.co, zapis: a.zapis,
      ...(a.co === 'przesun' ? { glowa: a.glowa, z: a.z_zapisu } : { nowy: !!a.nowy }), ...(a.prywatne ? { prywatne: true } : {}), ...(a.cialo ? { cialo: a.cialo } : {}),
      ...(a.wydalone != null ? { wydalone: true, wydalone_kiedy: new Date(a.wydalone).toISOString(), wydalone_przez: a.wydalone_przez ?? null } : {}) };
  }

  // Kto co widzi (uwaga Menadżera do #10, 11 XI): domyślnie wszystko widzą wszyscy uczestnicy z kluczem, i UI mówi to
  // wprost. Wyjątki: akt zapisany z `prywatne: true` widzą właściciel i jego autor, a gdy to wiadomość, także ci z
  // pola `do`; głowy `jozz:prywatne/…` i ich przesunięcia widzi tylko właściciel. Treść zapisu po identyfikatorze
  // dostaje tylko ten, kto widzi jakiś akt z tym zapisem, więc odgadnięty skrót niczego nie otwiera. Prywatność
  // siedzi na akcie, nie na treści: ta sama treść zapisana jawnie przez kogoś innego jest jawna.
  widoczny(kto, w) {
    if (kto === this.wlasciciel || w.kto === kto) return true;
    if (w.co === 'przesun' && String(w.glowa || '').startsWith(PRYWATNE_GLOWY)) return false;
    if (!w.prywatne) return true;
    // prywatny akt: poza właścicielem i autorem tylko adresaci wiadomości
    if (w.rodzaj === 'wiadomosc' && w.tresc) { try { const t = JSON.parse(w.tresc); return Array.isArray(t.do) && t.do.includes(kto); } catch { return false; } }
    return false;
  }

  glowa(nazwa, kto = this.wlasciciel) {
    if (String(nazwa).startsWith(PRYWATNE_GLOWY) && kto !== this.wlasciciel) return blad(403, 'prywatne głowy widzi tylko właściciel');
    const g = this.q(`SELECT g.nazwa, g.zapis, g.akt, z.rodzaj, z.tresc FROM glowy g JOIN zapisy z ON z.id = g.zapis WHERE g.nazwa = ?`, nazwa)[0];
    return g ? { ok: true, glowa: g.nazwa, zapis: g.zapis, wersja: g.akt, rodzaj: g.rodzaj, tresc: g.tresc } : blad(404, 'nie ma takiej głowy', { wersja: null });
  }

  zapisTresc(id, kto = this.wlasciciel) {
    const z = this.q(`SELECT * FROM zapisy WHERE id = ?`, id)[0];
    if (!z) return blad(404, 'nie ma takiego zapisu');
    if (kto !== this.wlasciciel && !this.q(`SELECT * FROM akty WHERE zapis = ?`, id).some((a) => this.widoczny(kto, { ...a, rodzaj: z.rodzaj, tresc: z.tresc })))
      return blad(404, 'nie ma takiego zapisu');
    return { ok: true, ...z };
  }

  // Co się działo po akcie nr `od`. Treści dołączone do aktów zapisu; najwyżej LIMIT_DZIENNIKA na raz, z kursorem.
  dziennik(od = 0, limit = LIMIT_DZIENNIKA, kto = this.wlasciciel) {
    const n = Math.max(1, Math.min(LIMIT_DZIENNIKA, limit | 0 || LIMIT_DZIENNIKA));
    const wiersze = this.q(`SELECT a.*, z.rodzaj, z.tresc, z.rozmiar FROM akty a LEFT JOIN zapisy z ON z.id = a.zapis WHERE a.nr > ? ORDER BY a.nr LIMIT ?`, od | 0, n + 1);
    const wiecej = wiersze.length > n;
    const przejrzane = wiersze.slice(0, n);
    const akty = przejrzane.filter((w) => this.widoczny(kto, w)).map((w) => ({ ...this.opisAktu(w), rodzaj: w.rodzaj, tresc: w.co === 'zapisz' ? w.tresc : undefined, rozmiar: w.rozmiar }));
    const ostatni = this.q(`SELECT COALESCE(MAX(nr), 0) AS nr FROM akty`)[0].nr;
    // kursor idzie po przejrzanych, nie po widocznych: ukryty akt nie zatrzymuje czytelnika w miejscu
    return { ok: true, od: od | 0, akty, wiecej, dalej: przejrzane.length ? przejrzane[przejrzane.length - 1].nr : od | 0, ostatni };
  }

  // Ponowne spotkanie: co przybyło od ostatniego odczytu tego czytelnika, na każdym jego urządzeniu naraz.
  nowe(kto) {
    const o = this.q(`SELECT nr, kiedy FROM odczyty WHERE kto = ?`, kto)[0];
    const d = this.dziennik(o ? o.nr : 0, LIMIT_DZIENNIKA, kto);
    // pierwszy_raz: czytelnik nie ma jeszcze zapisanej wizyty. To najczęstszy przypadek (każda nowa sesja agenta),
    // więc ma własną, jawną odpowiedź zamiast pustej listy udającej "nic się nie zmieniło".
    return { ...d, pierwszy_raz: !o, widziane_do: o ? o.nr : 0, widziane_kiedy: o ? new Date(o.kiedy).toISOString() : null, cudze: d.akty.filter((a) => a.kto !== kto).length };
  }

  // Sama zapisana wizyta czytelnika, bez dziennika. Opis środowiska potrzebuje tylko tego, dokąd czytelnik doczytał;
  // `nowe` czyta przy okazji do 200 aktów z treścią, a strona pyta o opis po każdej zmianie.
  wizyta(kto) {
    const o = this.q(`SELECT nr, kiedy FROM odczyty WHERE kto = ?`, kto)[0];
    return { pierwszy_raz: !o, widziane_do: o ? o.nr : 0, widziane_kiedy: o ? new Date(o.kiedy).toISOString() : null };
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

  // Meta pamiętamy w instancji: te same klucze (obszar_glowny, obszar_nowe, adres) pytane są po kilkanaście razy
  // na jedno żądanie, a zmienia je tylko `ustawMeta`, które pamięć od razu poprawia. Zmierzone 17 XI 2026
  // (tools/koszt.mjs): 15 z 82 zapytań jednego otwarcia strony to były te same pytania o meta.
  // Obiekt Miejsca jest jeden na Miejsce i tylko on pisze do tej tabeli, więc nic nie może się rozjechać;
  // po uśpieniu instancji pamięć znika razem z nią i pierwsze żądanie czyta na nowo.
  meta(klucz) {
    this._meta ??= new Map();
    if (this._meta.has(klucz)) return this._meta.get(klucz);
    const w = this.q(`SELECT wartosc FROM meta WHERE klucz = ?`, klucz)[0];
    const wartosc = w ? w.wartosc : null;
    this._meta.set(klucz, wartosc);
    return wartosc;
  }
  ustawMeta(klucz, wartosc) {
    this.sql.exec(`INSERT INTO meta (klucz, wartosc) VALUES (?, ?) ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc`, klucz, String(wartosc));
    this._meta ??= new Map();
    this._meta.set(klucz, String(wartosc));
  }

  // Most (worker/most.mjs): wiadomości jeszcze niewysłane do repozytorium agentów, bez tych, które przyszły mostem.
  doWyslania(limit = 50) {
    const od = Number(this.meta('most_wyslane') || 0);
    const akty = this.q(`SELECT a.*, z.tresc FROM akty a JOIN zapisy z ON z.id = a.zapis WHERE a.nr > ? AND a.co = 'zapisz' AND z.rodzaj = 'wiadomosc' AND a.op NOT LIKE 'most-%' ORDER BY a.nr LIMIT ?`, od, limit)
      .filter((a) => !a.prywatne) // prywatne nie idą do wspólnej pamięci, którą czytają wszyscy agenci
      .map((a) => ({ nr: a.nr, kto: a.kto, kiedy: new Date(a.kiedy).toISOString(), tresc: a.tresc }));
    return { ok: true, od, akty };
  }
  wyslane(nr) {
    if (!Number.isInteger(nr)) return blad(400, 'nr');
    this.ustawMeta('most_wyslane', Math.max(nr, Number(this.meta('most_wyslane') || 0)));
    return { ok: true, most_wyslane: Number(this.meta('most_wyslane')) };
  }
  znaneOpy(opy) {
    if (!Array.isArray(opy)) return blad(400, 'opy: lista');
    const znane = opy.filter((o) => typeof o === 'string' && this.q(`SELECT 1 AS j FROM akty WHERE op = ?`, o).length);
    return { ok: true, znane };
  }

  // Całość jako jeden JSON: kopia na dysk właściciela, przeprowadzka, praca bez nas.
  // Dowod D3 (17 XI 2026): obcy czytnik odtworzyl z samego wywozu 78 rzeczy, ich rodzaje, obszary i tytuly,
  // ale wersje pomylil co do jednej - bo musial zgadnac, czym jest "wersja". Dane byly w pliku (akt glowy),
  // brakowalo tylko zdania, ze to one. Dlatego wywoz tlumaczy sie teraz sam: kto go czyta, nie potrzebuje
  // ani kodu Jaskini, ani jej opisu pod adresem.
  static JAK_ODBUDOWAC = [
    'zapisy: niezmienne tresci; id to odcisk tresci. tresc rzeczy to napis JSON {"obszar": <id albo null>, "cechy": {...}}; rzecz odlozona ma tam jeszcze "odlozone": true i czasem "powod". Rzecz, ktora z natury nalezy do innej, ma "obszar": null i "obszar_z": "<nazwa cechy>": lezy w tym samym obszarze co rzecz wskazana ta cecha, a gdy wskazana rzecz sama jest obszarem: w nim (ksztalt jej rodzaju mowi to polem lezy_z; tak samo czytaj starszy zapis takiej rzeczy, w ktorym obszar jeszcze stoi). Zapisy rodzaju kod/1 to strony gosci, nie rzeczy.',
    'akty: dziennik. Jeden ruch to para aktow o tym samym op z koncowkami .z (co:"zapisz", wklada tresc) i .p (co:"przesun", ustawia glowe). Pole z_zapisu to poprzedni zapis tej glowy, null przy pierwszej wersji. op jest jednoznaczny w obrebie uczestnika (pole kto), nie calego Miejsca.',
    'glowy: stan biezacy. Glowa o nazwie "rzecz:<id>" to rzecz o tozsamosci <id>; jej pole zapis wskazuje aktualna tresc. Zapisy, ktorych nie wskazuje zadna glowa, to stare wersje albo strony gosci.',
    'wersja rzeczy = pole akt jej glowy (numer aktu, ktory ja tam ustawil), a NIE liczba przesuniec. Tej samej liczby zada drzwi przy zmianie rzeczy. Kolejny numer wersji (1, 2, 3...) to liczba aktow przesun tej glowy.',
    'tytul rzeczy: rzeczy rodzaju ksztalt/1 maja ceche dla (opisywany rodzaj) i tytul (nazwa cechy, ktora jest nazwa rzeczy tego rodzaju).',
    'zastapienie to przesuniecie glowy na nowy zapis, a stary zostaje w magazynie. Odlozenie rzeczy to tez nowa wersja, nie usuniecie. Wyjatek (od formatu miejsce-4): wlasciciel moze ustawic w obszarze, ile wersji rzeczy trzymac (cecha historia obszaru); wtedy najstarsze wersje ponad to traca tresc. Ich akty zostaja w dzienniku z polem wydalone (chwila wydalenia w ms) i wydalone_przez (obszar, ktorego ustawienie zdecydowalo), a zapis, ktorego nie wskazuje juz zaden niewydalony akt, znika z listy zapisy. Wersja wydalona to wiec numer, autor i chwila bez tresci.',
    'meta: klucze "ziarno:<nazwa>" wskazuja rzeczy, ktore srodowisko zasialo samo; "obszar_glowny" i "obszar_nowe" wskazuja dwa obszary, ktorych potrzebuje do liczenia praw. Wwoz odtwarza mete razem z reszta.',
  ];

  eksport() {
    return { ok: true, format: 'jaskinia-miejsce', wersja: WERSJA, zebrane: new Date(this.teraz()).toISOString(),
      jak_odbudowac: Rdzen.JAK_ODBUDOWAC,
      zapisy: this.q(`SELECT * FROM zapisy ORDER BY id`), akty: this.q(`SELECT * FROM akty ORDER BY nr`),
      glowy: this.q(`SELECT * FROM glowy ORDER BY nazwa`), odczyty: this.q(`SELECT * FROM odczyty ORDER BY kto`),
      meta: this.q(`SELECT * FROM meta WHERE klucz != 'schemat' ORDER BY klucz`) };
  }

  // Import całości z eksportu: przeprowadzka na inny adres, odtworzenie z kopii na dysku, praca bez nas.
  // Tylko do pustego Miejsca (bez łączenia dwóch historii po cichu). Wszystko sprawdzone przed pierwszym zapisem:
  // każda treść musi dać swój identyfikator (podmieniona nie wejdzie), głowy i akty wskazują istniejące zapisy.
  // Uwaga na zasięg: to łapie niespójną podmianę, a nie dowodzi pochodzenia (Astra, obs. 2; umowa rdzenia, U7).
  async importuj(e) {
    if (!e || e.format !== 'jaskinia-miejsce') return blad(400, 'to nie jest eksport Miejsca (format jaskinia-miejsce)');
    if (!WERSJE_WWOZU.includes(e.wersja)) return blad(400, `eksport w wersji ${e.wersja}, a to Miejsce zna ${WERSJE_WWOZU.join(' i ')}; potrzebna migracja`);
    for (const t of ['zapisy', 'akty', 'glowy', 'odczyty']) if (!Array.isArray(e[t])) return blad(400, `brak listy ${t}`);
    const s = this.stan();
    if (s.zapisy || s.akty || s.glowy) return blad(409, 'import tylko do pustego Miejsca; to ma już historię, której nie łączę po cichu');
    const ids = new Set();
    for (const z of e.zapisy) {
      if (typeof z.rodzaj !== 'string' || typeof z.tresc !== 'string') return blad(400, 'zapis bez rodzaju albo treści');
      if ((await skrot(z.rodzaj + '\n' + z.tresc)) !== z.id) return blad(422, `treść zapisu ${String(z.id).slice(0, 12)} nie zgadza się z jego identyfikatorem`);
      ids.add(z.id);
    }
    const nry = new Set(), opy = new Set();
    for (const a of e.akty) {
      const klucz = a.kto + '\n' + a.op; // op jest jednoznaczny w obrębie uczestnika
      // Akt wydalony (miejsce-4) może wskazywać zapis, którego już nie ma: to jest właśnie ślad wydalenia.
      const wydalony = a.wydalone !== undefined && a.wydalone !== null;
      if (wydalony && (!Number.isSafeInteger(a.wydalone) || (a.wydalone_przez != null && typeof a.wydalone_przez !== 'string'))) return blad(422, `akt ${a.nr}: pole wydalone ma być chwilą w ms, a wydalone_przez identyfikatorem albo null`);
      if (!Number.isInteger(a.nr) || nry.has(a.nr) || typeof a.op !== 'string' || opy.has(klucz) || !poprawneImie(a.kto) || !['zapisz', 'przesun'].includes(a.co) || (!ids.has(a.zapis) && !(wydalony && typeof a.zapis === 'string')))
        return blad(422, `akt ${a.nr} jest niespójny (numer, op, wykonawca, czynność albo zapis)`);
      nry.add(a.nr); opy.add(klucz);
    }
    for (const g of e.glowy) if (!GLOWA.test(g.nazwa) || !ids.has(g.zapis) || !nry.has(g.akt)) return blad(422, `głowa ${g.nazwa} wskazuje coś, czego nie ma`);
    const meta = Array.isArray(e.meta) ? e.meta : [];
    for (const m of meta) if (!m || typeof m.klucz !== 'string' || typeof m.wartosc !== 'string' || m.klucz.length > 200 || m.wartosc.length > 4000) return blad(422, 'meta: każdy wpis ma mieć napisy klucz i wartosc');
    // Od tej linii nic nie może się nie udać z powodu danych: wszystko sprawdzone. Z innego powodu może (magazyn, limit),
    // a połowa wwozu zostawiłaby Miejsce niepuste, więc drugiego wwozu już by nie przyjęło (21 XI 2026): stąd transakcja.
    this.wTransakcji(() => this._wwiez(e, meta));
    return { ok: true, zapisy: e.zapisy.length, akty: e.akty.length, glowy: e.glowy.length, meta: meta.length };
  }

  _wwiez(e, meta) {
    for (const z of e.zapisy) this.sql.exec(`INSERT INTO zapisy (id, rodzaj, tresc, rozmiar) VALUES (?, ?, ?, ?)`, z.id, z.rodzaj, z.tresc, enc.encode(z.tresc).length);
    for (const a of e.akty) this.sql.exec(`INSERT INTO akty (nr, op, odcisk, kto, kiedy, co, zapis, glowa, z_zapisu, nowy, prywatne, cialo, wydalone, wydalone_przez) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      a.nr, a.op, String(a.odcisk || ''), a.kto, Number(a.kiedy), a.co, a.zapis, a.glowa ?? null, a.z_zapisu ?? null, a.nowy ?? null, a.prywatne ? 1 : 0, typeof a.cialo === 'string' && CIALO.test(a.cialo) ? a.cialo : null,
      a.wydalone ?? null, a.wydalone != null ? (a.wydalone_przez ?? null) : null);
    for (const g of e.glowy) this.sql.exec(`INSERT INTO glowy (nazwa, zapis, akt) VALUES (?, ?, ?)`, g.nazwa, g.zapis, g.akt);
    for (const o of e.odczyty) if (poprawneImie(o.kto) && Number.isInteger(o.nr)) this.sql.exec(`INSERT INTO odczyty (kto, nr, kiedy) VALUES (?, ?, ?)`, o.kto, o.nr, Number(o.kiedy) || this.teraz());
    for (const m of meta) if (m.klucz !== 'schemat') this.ustawMeta(m.klucz, m.wartosc);
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
  // Te drzwi są sprzed środowiska i nie znają widoczności rzeczy: dziennik oddałby treść każdej rzeczy każdemu
  // z kluczem. Dlatego od 17 XI 2026 są tylko dla właściciela (wywóz, wwóz, wgląd w dziennik); wszystko inne idzie
  // przez /api/srodowisko. Wyjątkiem jest zamknięta ścieżka mostu, którą woła sam Worker.
  if (kto !== rdzen.wlasciciel && !sciezka.startsWith('most/')) return odp(blad(403, 'drzwi /api/miejsce są tylko dla właściciela; rzeczy czyta się i zmienia przez /api/srodowisko (opis: /co-tu-jest)'));
  if (request.method === 'GET') {
    if (sciezka === '') { let most = null; try { most = JSON.parse(rdzen.meta('most_ostatni')); } catch { /* brak */ } return odp({ ...rdzen.stan(), ja: kto, wlasciciel: kto === rdzen.wlasciciel, most }); }
    if (sciezka === 'dziennik') return odp(rdzen.dziennik(Number(url.searchParams.get('od') || 0), Number(url.searchParams.get('ile') || LIMIT_DZIENNIKA), kto));
    if (sciezka === 'nowe') return odp(rdzen.nowe(kto));
    if (sciezka === 'glowa') return odp(rdzen.glowa(url.searchParams.get('nazwa') || '', kto));
    if (sciezka === 'zapis') return odp(rdzen.zapisTresc(url.searchParams.get('id') || '', kto));
    if (sciezka === 'eksport') return odp(kto === rdzen.wlasciciel ? rdzen.eksport() : blad(403, 'eksport całości tylko dla właściciela'));
  }
  // Tylko dla mostu wołanego przez Workera z crona. Worker przekazuje żądania z zewnątrz z nagłówkami budowanymi od
  // zera, więc x-wewnetrzne nie przejdzie z przeglądarki ani od agenta.
  if (sciezka.startsWith('most/')) {
    if (request.headers.get('x-wewnetrzne') !== 'tak') return odp(blad(404, 'nie ma takiej ścieżki w Miejscu'));
    if (sciezka === 'most/do-wyslania') return odp(rdzen.doWyslania());
    const c = (await ciało()) || {};
    if (sciezka === 'most/wyslane') return odp(rdzen.wyslane(c.nr));
    if (sciezka === 'most/znane-pliki') return odp(rdzen.znaneOpy(c.opy));
    if (sciezka === 'most/przyjmij') return odp(await rdzen.wykonaj(c.kto, { op: c.op, co: 'zapisz', rodzaj: 'wiadomosc', tresc: c.tresc }));
  }
  if (request.method === 'POST') {
    if (sciezka === 'akt') return odp(await rdzen.wykonaj(kto, await ciało(), { slad: request.headers.get('x-cialo') }));
    if (sciezka === 'widzialem') { const c = await ciało(); return odp(rdzen.widzialem(kto, c && c.nr)); }
    if (sciezka === 'import') return odp(kto === rdzen.wlasciciel ? await rdzen.importuj(await ciało()) : blad(403, 'import całości tylko dla właściciela'));
  }
  return odp(blad(404, 'nie ma takiej ścieżki w Miejscu'));
}
