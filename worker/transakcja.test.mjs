// Transakcja: czynność, która pisze wiele wierszy, zapisuje się w całości albo wcale (21 XI 2026, Opus Code).
// Durable Object łączy zapisy bez `await` w jeden atomowy zapis na dysk, więc awaria maszyny nie zostawia połowy.
// Wyjątek w połowie (błąd magazynu, przekroczony limit, błąd w kodzie spisu) zostawiał jednak zapisy sprzed niego.
// Tu wyjątek wywołujemy sami: baza rzuca przy n-tym zapytaniu pasującym do wzorca. Każdy sprawdzian ma kontrolę, że
// wyjątek naprawdę padł w połowie, a mutacje (wspólna pamięć agentów, opus-code/narzedzia/transakcja-mutacje.mjs)
// pokazują, że bez transakcji każdy z nich pada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { Miejsce } from './miejsce-do.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';

// Baza, która rzuca wyjątek przy n-tym zapytaniu pasującym do wzorca (udany błąd magazynu w połowie czynności).
function zastrzal(baza = sqlZNode()) {
  const z = { wzor: null, ile: 0, padlo: 0 };
  const sql = {
    exec: (q, ...p) => {
      if (z.wzor && z.wzor.test(q) && --z.ile === 0) { z.wzor = null; z.padlo++; throw new Error('udany błąd magazynu w połowie czynności'); }
      return baza.exec(q, ...p);
    },
    transakcja: baza.transakcja,
  };
  return { z, sql };
}
const uzbroj = (z, wzor, ktory) => { z.wzor = wzor; z.ile = ktory; };
// wiersze z node:sqlite nie mają prototypu, więc do porównań przepisujemy je w zwykłe obiekty
const dziennik = (r) => ({ ...r.q(`SELECT (SELECT COUNT(*) FROM akty) AS akty, (SELECT COUNT(*) FROM zapisy) AS zapisy, (SELECT COUNT(*) FROM glowy) AS glowy`)[0] });
const spisu = (r) => ({ ...r.q(`SELECT (SELECT COUNT(*) FROM rzeczy) AS rzeczy, (SELECT COUNT(*) FROM odniesienia) AS odniesienia, (SELECT COALESCE(SUM(ile), 0) FROM przekroj) AS przekroj`)[0] });
const zegar = () => { let t = Date.UTC(2026, 10, 21, 3, 0, 0); return () => (t += 1000); };

async function swiat(sql) {
  const r = new Rdzen(sql, { teraz: zegar() });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  return { r, s, nowe: r.meta('obszar_nowe') };
}

test('TR1 czynność dwóch rzeczy: wyjątek przy drugiej cofa także pierwszą, a ta sama czynność przechodzi potem od nowa', async () => {
  const { z, sql } = zastrzal();
  const r = new Rdzen(sql, { teraz: zegar() });
  const p1 = await r.przygotujPolozenie({ op: 'tr1-czynnosc.0', rodzaj: 'proba/1', tresc: '{"a":1}', glowa: 'wspolne:tr1/jeden' });
  const p2 = await r.przygotujPolozenie({ op: 'tr1-czynnosc.1', rodzaj: 'proba/1', tresc: '{"b":2}', glowa: 'wspolne:tr1/dwa' });
  assert.ok(p1.ok && p2.ok, 'przygotowanie przechodzi');
  const przed = dziennik(r), nrPrzed = r.ostatniNr();
  uzbroj(z, /^\s*INSERT INTO akty/i, 3); // pierwsza rzecz pisze dwa akty; trzeci to pierwszy akt drugiej
  assert.throws(() => r.zatwierdzPolozenia('agent-a', [p1, p2]), /udany błąd magazynu/);
  assert.equal(z.padlo, 1, 'kontrola przyrządu: wyjątek naprawdę padł w połowie czynności');
  assert.deepEqual(dziennik(r), przed, 'po wyjątku w połowie nie zostaje ani akt, ani zapis, ani głowa pierwszej rzeczy');
  assert.equal(r.ostatniNr(), nrPrzed);
  // Bez transakcji pierwsza rzecz zostawała zapisana, a powtórzenie tej samej czynności dostawało 409 ("ten op należy
  // już do innej Twojej czynności"): czynność utykała na zawsze w połowie.
  const w = r.zatwierdzPolozenia('agent-a', [p1, p2]);
  assert.equal(w.ok, true, 'ta sama czynność przechodzi od nowa');
  assert.equal(w.powtorzone, false, 'jako nowa, nie jako powtórzenie połowy');
  assert.equal(dziennik(r).akty, przed.akty + 4);
});

test('TR1b pamięć numeru aktu po wycofaniu nie pamięta aktu, którego nie ma', async () => {
  const r = new Rdzen(sqlZNode(), { teraz: zegar() });
  const p = await r.przygotujPolozenie({ op: 'tr1b-czynnosc', rodzaj: 'proba/1', tresc: '{"c":3}', glowa: 'wspolne:tr1b/jeden' });
  const nrPrzed = r.ostatniNr();
  assert.throws(() => r.wTransakcji(() => {
    assert.equal(r.zatwierdzPolozenia('agent-a', [p]).ok, true);
    assert.equal(r.ostatniNr(), nrPrzed + 2, 'kontrola: w środku transakcji pamięć zna nowe akty');
    throw new Error('udany błąd po zapisie');
  }), /udany błąd po zapisie/);
  assert.equal(r.ostatniNr(), nrPrzed, 'po wycofaniu pamięć numeru aktu wraca do bazy');
  assert.equal(dziennik(r).akty, 0);
});

test('TR2 wwóz: wyjątek w połowie zostawia Miejsce puste, więc drugi wwóz tej samej kopii przechodzi', async () => {
  const zrodlo = new Rdzen(sqlZNode(), { teraz: zegar() });
  for (let i = 0; i < 3; i++) {
    const p = await zrodlo.przygotujPolozenie({ op: 'tr2-zrodlo-' + i, rodzaj: 'proba/1', tresc: JSON.stringify({ i }), glowa: 'wspolne:tr2/' + i });
    assert.equal(zrodlo.zatwierdzPolozenia('agent-a', [p]).ok, true);
  }
  const kopia = zrodlo.eksport();
  const { z, sql } = zastrzal();
  const cel = new Rdzen(sql, { teraz: zegar() });
  uzbroj(z, /^\s*INSERT INTO akty/i, 4);
  await assert.rejects(cel.importuj(kopia), /udany błąd magazynu/);
  assert.equal(z.padlo, 1, 'kontrola przyrządu: wyjątek padł w połowie wwozu');
  assert.deepEqual(dziennik(cel), { akty: 0, zapisy: 0, glowy: 0 }, 'po połowie wwozu Miejsce jest dalej puste');
  // Bez transakcji zostawała połowa historii, a wwóz przyjmuje tylko puste Miejsce: przeprowadzka i odtworzenie
  // z kopii przestawały działać na tym adresie na zawsze.
  const w = await cel.importuj(kopia);
  assert.equal(w.ok, true, 'drugi wwóz tej samej kopii przechodzi');
  assert.deepEqual(dziennik(cel), dziennik(zrodlo));
});

test('TR3 ruch: wyjątek w liczeniu spisu cofa także akty, a pamięć spisu nie liczy rzeczy, której nie ma', async () => {
  const { z, sql } = zastrzal();
  const { r, s, nowe } = await swiat(sql);
  const ilePrzed = s.ile({ rodzaj: 'projekt/1' }); // wypełnia pamięć przekroju
  const przed = { ...dziennik(r), ...spisu(r) }, nrPrzed = r.ostatniNr();
  const ruch = () => s.ruch('agent-a', { op: 'tr3-ruch-0001', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Pół ruchu' }, obszar: nowe });
  uzbroj(z, /^\s*INSERT INTO rzeczy/i, 1); // spis liczy się po zapisie aktów
  let wynik = null, wyjatek = null;
  try { wynik = await ruch(); } catch (e) { wyjatek = e; }
  assert.equal(z.padlo, 1, 'kontrola przyrządu: wyjątek padł w liczeniu spisu, po zapisie aktów');
  assert.ok(wyjatek || (wynik && !wynik.ok), 'ruch nie mówi, że się udał');
  assert.deepEqual({ ...dziennik(r), ...spisu(r) }, przed, 'ani akt w dzienniku, ani wiersz spisu');
  assert.equal(r.ostatniNr(), nrPrzed);
  assert.equal(s.ile({ rodzaj: 'projekt/1' }), ilePrzed, 'pamięć przekroju nie liczy rzeczy z wycofanej czynności');
  const w = await ruch();
  assert.equal(w.ok, true, 'ten sam op przechodzi od nowa');
  assert.equal(s.ile({ rodzaj: 'projekt/1' }), ilePrzed + 1);
  const naBiezaco = spisu(r);
  s.przebuduj();
  assert.deepEqual(spisu(r), naBiezaco, 'spis liczony na bieżąco równa się spisowi odbudowanemu z dziennika');
});

test('TR4 odbudowa spisu: wyjątek w połowie zostawia cały dawny spis, a nie połowę', async () => {
  const { z, sql } = zastrzal();
  const { r, s } = await swiat(sql);
  const przed = spisu(r), widac = s.spis().length;
  uzbroj(z, /^\s*INSERT INTO rzeczy/i, 5);
  assert.throws(() => s.przebuduj(), /udany błąd magazynu/);
  assert.equal(z.padlo, 1, 'kontrola przyrządu: wyjątek padł w połowie odbudowy');
  assert.deepEqual(spisu(r), przed, 'spis nie jest w połowie pusty (z połowy liczyłyby się prawa i widoczność)');
  assert.equal(s.spis().length, widac, 'czytanie widzi wszystkie rzeczy');
});

test('TR5 obiekt Miejsca daje jądru transakcję ze swojego magazynu, a bez niej jej nie udaje', () => {
  let wolania = 0;
  const baza = sqlZNode();
  const obiekt = new Miejsce({ storage: { sql: { exec: baza.exec }, transactionSync: (fn) => { wolania++; return baza.transakcja(fn); } } }, { WLASCICIEL: 'jozz', PODGLAD: 'tak' });
  const przed = wolania;
  assert.equal(obiekt.rdzen.wTransakcji(() => 7), 7);
  assert.equal(wolania, przed + 1, 'czynność jądra idzie przez ctx.storage.transactionSync');
  const bez = new Miejsce({ storage: { sql: { exec: sqlZNode().exec } } }, { WLASCICIEL: 'jozz', PODGLAD: 'tak' });
  assert.equal(bez.rdzen._transakcja, null, 'kontrola: magazyn bez transactionSync nie dostaje udawanej transakcji');
});
