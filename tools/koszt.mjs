// Gdzie Miejsce przepala wiersze bazy? Przyrzad, nie opinia (17 XI 2026, Opus Code).
//
// POWOD. 17 XI o 17:53 UTC cale srodowisko stanelo: kazda trasa dotykajaca Durable Objecta oddawala 500 na
// WSZYSTKICH pieciu podgladach naraz, a zwykle trasy Workera 200. To dobowy limit darmowego planu, liczony
// dla CALEGO KONTA i zerowany o 00:00 UTC: 5 000 000 wierszy czytanych, 100 000 zapisanych.
// Bezpiecznik w budzet.mjs pilnuje ZAPISOW JEDNEGO Miejsca - padl limit ODCZYTOW CALEGO KONTA.
//
// CZEGO TEN PLIK NIE ROBI, I TO JEST WAZNE. Nie podaje, ile wierszy bazy kosztuje zadanie. Probowalem:
// pierwsza wersja zgadywala to z planu zapytan i wyszla 788 tam, gdzie pod adresem zmierzono 5510 - pomylka
// siedem razy. Liczba, ktora myli sie siedem razy, jest gorsza niz jej brak, bo wyglada jak pomiar.
// Prawdziwe wiersze podaje tylko baza Cloudflare, w naglowku x-koszt: do tego sluzy tools/koszt-pod-adresem.mjs.
//
// TU liczymy to, co Node wie na pewno i co JEST przyczyna kosztu: ILE ZAPYTAN idzie do bazy na jedno zadanie
// i KTORE z nich przegladaja cala tabele zamiast wejsc po indeksie. Jesli liczba zapytan albo liczba skanow
// rosnie razem z Miejscem, to zadanie bedzie drozec bez konca - i to widac tutaj, bez zgadywania wierszy.
//
// Uruchomienie:  node tools/koszt.mjs [ile-rzeczy ...]      (domyslnie 636 2000 5000)
import { DatabaseSync } from 'node:sqlite';
import { Rdzen } from '../worker/miejsce.mjs';
import { Srodowisko } from '../worker/srodowisko.mjs';
import { ziarna } from '../worker/ziarna.mjs';
import { opisDane, coTuJest } from '../worker/opis.mjs';

const ROZMIARY = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
const ILE = ROZMIARY.length ? ROZMIARY : [636, 2000, 5000];
const POMIAR_POD_ADRESEM = { rzeczy: 636, wiersze: 5510, co: '/co-tu-jest' }; // worker/opis.mjs, 17 XI 2026

// --- sql, ktory pamieta, o co go pytano -----------------------------------------------------------------------
function sqlZLicznikiem(db) {
  const slad = [];
  let zbieram = false;
  return {
    slad,
    start() { zbieram = true; slad.length = 0; },
    stop() { zbieram = false; },
    db,
    exec: (q, ...p) => {
      if (zbieram) slad.push([q, p]);
      const rows = p.length || /^\s*(SELECT|INSERT|UPDATE|DELETE|PRAGMA|WITH)/i.test(q) ? db.prepare(q).all(...p) : (db.exec(q), []);
      return { toArray: () => rows };
    },
  };
}

const wierszyW = (db, tabela) => { try { return db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n; } catch { return 0; } };

// Czy zapytanie przeglada cala tabele, czy wchodzi po indeksie. To jest dokladnie ta rzecz, ktora Cloudflare
// kaze sprawdzic jako pierwsza, gdy padnie limit odczytow.
function plan(db, q, p) {
  try {
    const kroki = db.prepare('EXPLAIN QUERY PLAN ' + q).all(...p);
    return kroki.map((k) => String(k.detail || ''));
  } catch { return []; }
}

function policz(sql, db) {
  const tabele = ['rzeczy', 'akty', 'zapisy', 'glowy', 'odniesienia', 'przekroj', 'meta', 'odczyty'];
  const rozmiar = Object.fromEntries(tabele.map((t) => [t, wierszyW(db, t)]));
  const razem = { zapytan: 0, skanow: 0 };
  const wg = new Map();
  for (const [q, p] of sql.slad) {
    if (!/^\s*(SELECT|WITH)/i.test(q)) continue;        // zapisy liczymy osobno, tu chodzi o odczyt
    const kroki = plan(db, q, p);
    const scan = kroki.some((k) => k.startsWith('SCAN'));
    razem.zapytan++; if (scan) razem.skanow++;
    const klucz = q.replace(/\s+/g, ' ').trim().slice(0, 120);
    const w = wg.get(klucz) || { ile: 0, scan };
    w.ile++; w.scan = w.scan || scan;
    wg.set(klucz, w);
  }
  return { razem, wg, rozmiar };
}

// --- swiat probny ----------------------------------------------------------------------------------------------
async function swiat(ile) {
  const db = new DatabaseSync(':memory:');
  const sql = sqlZLicznikiem(db);
  let t = Date.UTC(2026, 10, 17, 6, 0, 0);
  const r = new Rdzen(sql, { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-probny', 'obserwator'] }));
  // Rzeczy jak u nas naprawde: wiekszosc to fakty obserwatora (repo i galezie), reszta to dziela i narzedzia.
  const obszarFaktow = r.meta('obszar_fakty');
  const n = Math.max(0, ile - s.ile({}));
  let nieudane = 0, pierwszyBlad = null;
  for (let i = 0; i < n; i++) {
    const w = await s.ruch('jozz', {
      op: `koszt-${String(i).padStart(6, '0')}`, co: 'poloz', rodzaj: 'projekt/1', obszar: obszarFaktow,
      cechy: { nazwa: 'rzecz-' + i, opis: 'Rzecz probna numer ' + i + ', zalozona przez przyrzad kosztu.' },
    });
    if (!w.ok) { nieudane++; pierwszyBlad = pierwszyBlad || (w.blad || JSON.stringify(w)).slice(0, 120); }
  }
  // Swiat, ktorego nie udalo sie zbudowac, dalby pomiar czegos innego niz obiecany: mowimy to glosno.
  if (nieudane) { console.log(`UWAGA: ${nieudane} z ${n} rzeczy sie nie zalozylo. Pierwszy powod: ${pierwszyBlad}`); process.exit(1); }
  return { s, r, sql, db };
}

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

async function zmierz(ile) {
  const { s, sql, db } = await swiat(ile);
  const rzeczy = s.ile({});
  const wyniki = [];
  const probuj = (nazwa, fn) => {
    s._prz = null; s._k = null; s._widzi = null; s._role = { nr: -1, mapa: new Map() }; s._pam = null; // zimny start: tak wyglada pierwsze zadanie po przebudzeniu obiektu
    sql.start();
    try { fn(); } catch (e) { sql.stop(); wyniki.push([nazwa, null, String(e.message || e).slice(0, 60)]); return; }
    sql.stop();
    wyniki.push([nazwa, policz(sql, db), null]);
  };

  probuj('/co-tu-jest (pelny opis tekstem)', () => coTuJest(s.dla('agent-probny'), { kto: 'agent-probny', podglad: true }));
  probuj('/api/srodowisko/opis (te same dane)', () => opisDane(s.dla('agent-probny'), { kto: 'agent-probny', podglad: true }));
  probuj('/api/srodowisko/puls (sam numer aktu)', () => s.ostatniNr());
  probuj('/api/srodowisko/spis?rodzaj=galaz/1&ile=50', () => s.dla('agent-probny').spis({ rodzaj: 'galaz/1', limit: 50 }));
  probuj('/api/srodowisko/spis?ile=1000 (bez filtra)', () => s.dla('agent-probny').spis({ limit: 1000 }));
  probuj('/api/srodowisko/rzecz?id=... (jedna rzecz)', () => { const x = s.spis({ rodzaj: 'galaz/1', limit: 1 })[0]; return x && s.dla('agent-probny').rzecz(x.id); });
  probuj('spis po cesze (gdzie.repo=...)', () => s.dla('agent-probny').spis({ rodzaj: 'galaz/1', gdzie: { repo: 'jozzpoly/projekt-3' }, limit: 50 }));
  probuj('szukanie po slowie', () => s.dla('agent-probny').spis({ szukaj: 'projekt-7', limit: 50 }));

  console.log(`\n=== ${fmt(rzeczy)} rzeczy w Miejscu ===`);
  console.log('tabele:', Object.entries(policz(sql, db).rozmiar).filter(([, n]) => n).map(([t, n]) => `${t}=${fmt(n)}`).join('  '));
  console.log('');
  console.log('trasa                                       zapytan do bazy   z tego skanow calej tabeli');
  for (const [nazwa, w, blad] of wyniki) {
    if (!w) { console.log(`${nazwa.padEnd(42)}  BLAD: ${blad}`); continue; }
    console.log(`${nazwa.padEnd(42)} ${String(w.razem.zapytan).padStart(15)} ${String(w.razem.skanow).padStart(28)}`);
  }

  const opis = wyniki.find((x) => x[0].startsWith('/co-tu-jest'))[1];
  console.log(`\n(pod adresem to samo /co-tu-jest przy ${POMIAR_POD_ADRESEM.rzeczy} rzeczach kosztowalo ${fmt(POMIAR_POD_ADRESEM.wiersze)} wierszy bazy - jedyny prawdziwy pomiar, jaki mamy)`);
  const skany = [...opis.wg.entries()].filter(([, w]) => w.scan);
  if (skany.length) {
    console.log('\nSKANY CALEJ TABELI (to one rosna razem z Miejscem):');
    skany.forEach(([q, w]) => console.log(`  ${String(w.ile).padStart(3)}x  ${q}`));
  }
  console.log('\nnajczestsze zapytania w /co-tu-jest:');
  [...opis.wg.entries()].sort((x, y) => y[1].ile - x[1].ile).slice(0, 7)
    .forEach(([q, w]) => console.log(`  ${String(w.ile).padStart(4)}x ${w.scan ? 'SKAN CALEJ TABELI' : 'po indeksie      '}  ${q}`));
  return { rzeczy, opis };
}

const seria = [];
for (const ile of ILE) seria.push(await zmierz(ile));
if (seria.length > 1) {
  console.log('\n=== jak to rosnie ===');
  console.log('rzeczy        zapytan na otwarcie strony       skanow calej tabeli');
  for (const { rzeczy, opis } of seria) {
    console.log(`${fmt(rzeczy).padStart(7)} ${String(opis.razem.zapytan).padStart(28)} ${String(opis.razem.skanow).padStart(25)}`);
  }
  const a = seria[0], b = seria[seria.length - 1];
  const stale = a.opis.razem.zapytan === b.opis.razem.zapytan;
  console.log(`\nKSZTALT: ${(b.rzeczy / a.rzeczy).toFixed(1)}x wiecej rzeczy -> ${stale ? 'TYLE SAMO' : (b.opis.razem.zapytan / a.opis.razem.zapytan).toFixed(1) + 'x wiecej'} zapytan na jedno zadanie.`);
  console.log(stale
    ? 'Liczba zapytan nie rosnie z Miejscem - i to jest dobra wiadomosc. Zla: kazdy SKAN czyta CALA tabele,\nwiec jeden skan przy 50 000 rzeczy to 50 000 wierszy na jedno otwarcie strony. Dlug siedzi w skanach.'
    : 'Liczba zapytan rosnie razem z Miejscem: to gorszy dlug niz skany, bo mnozy sie przez kazde zadanie.');
}
