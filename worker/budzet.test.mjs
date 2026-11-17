// Sprawdziany budżetu wierszy (17 XI 2026): licznik, suma doby, dobowy bezpiecznik i wstęp obserwatora pod adres.
// To podłoga budowniczego, nie miara: prawdziwe liczby wierszy podaje dopiero baza na Cloudflare (nagłówek x-koszt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { liczacySql, Budzet, naglowekKosztu, LIMIT_KONTA } from './budzet.mjs';
import { Miejsce } from './miejsce-do.mjs';

// Baza, która podaje liczby wierszy tak jak baza Durable Object: na kursorze. Uproszczenie sprawdzianu: zapytanie
// zmieniające to jeden zapisany wiersz, a czytane wiersze pojawiają się dopiero po odczytaniu wyniku.
function sqlZLiczbami() {
  const sql = sqlZNode();
  return {
    exec(q, ...p) {
      const k = sql.exec(q, ...p);
      const pisze = /^\s*(INSERT|UPDATE|DELETE)/i.test(q);
      let odczytane = false;
      return {
        toArray() { odczytane = true; return k.toArray(); },
        get rowsRead() { return odczytane && !pisze ? k.toArray().length : 0; },
        get rowsWritten() { return pisze ? 1 : 0; },
      };
    },
  };
}

test('B1. licznik dolicza wiersze każdego zapytania, także te, które baza policzyła dopiero po odczytaniu wyniku', () => {
  const s = liczacySql(sqlZLiczbami());
  s.exec('CREATE TABLE t (a INTEGER)');
  s.exec('INSERT INTO t (a) VALUES (?)', 1);
  s.exec('INSERT INTO t (a) VALUES (?)', 2);
  assert.deepEqual(s.licznik, { czytane: 0, zapisane: 2 });
  const k = s.exec('SELECT a FROM t WHERE a > ?', 0);
  assert.equal(s.licznik.czytane, 0, 'przed odczytaniem wyniku baza nie policzyła jeszcze wierszy');
  assert.equal(k.toArray().length, 2);
  assert.deepEqual(s.licznik, { czytane: 2, zapisane: 2 });
  k.toArray();
  assert.equal(s.licznik.czytane, 2, 'drugi odczyt tego samego wyniku niczego nie dolicza');
  assert.equal(naglowekKosztu({ czytane: 2, zapisane: 5 }), 'wiersze-czytane=2; wiersze-zapisane=5');
});

test('B2. licznik bez liczb od bazy (sprawdziany w Node) stoi na zerze i niczego nie psuje', () => {
  const s = liczacySql(sqlZNode());
  s.exec('CREATE TABLE t (a INTEGER)');
  s.exec('INSERT INTO t (a) VALUES (?)', 1);
  assert.equal(s.exec('SELECT a FROM t WHERE a = ?', 1).toArray().length, 1);
  assert.deepEqual(s.licznik, { czytane: 0, zapisane: 0 });
});

test('B3. suma doby: zapisuje się po żądaniu, które coś zapisało; samo czytanie jej nie rusza; limit i nowa doba', () => {
  let teraz = Date.UTC(2026, 10, 17, 10, 0, 0);
  const sql = liczacySql(sqlZLiczbami());
  const r = new Rdzen(sql, { teraz: () => teraz });
  const b = new Budzet(r, sql.licznik, { limit: 8, teraz: () => teraz });
  const z1 = b.otworz();
  r.meta('cokolwiek');
  assert.equal(b.zamknij(z1).zapisane, 0);
  assert.equal(r.meta('budzet:2026-11-17'), null, 'czytanie nie zapisuje sumy');

  const z2 = b.otworz();
  r.ustawMeta('a', 1);
  r.ustawMeta('b', 2);
  assert.equal(b.zamknij(z2).zapisane, 2);
  assert.equal(JSON.parse(r.meta('budzet:2026-11-17')).zapisane, 2);
  assert.equal(b.dzis().zapisane, 3, 'sam zapis sumy też jest zapisem i dolicza się do doby');
  assert.equal(b.przekroczony(), false);

  // obiekt zasnął i wstał: nowa suma zaczyna od tego, co było zapisane trwale
  const b2 = new Budzet(r, sql.licznik, { limit: 8, teraz: () => teraz });
  assert.equal(b2.dzis().zapisane, 2);

  const z3 = b.otworz();
  for (let i = 0; i < 5; i++) r.ustawMeta('c' + i, i);
  b.zamknij(z3);
  assert.equal(b.przekroczony(), true);
  assert.match(b.odmowa().blad, /dobowego limitu \(8\)/);
  assert.equal(b.odmowa().status, 429);
  assert.deepEqual(b.opis().limit_konta, LIMIT_KONTA);

  teraz += 24 * 60 * 60 * 1000;
  assert.equal(b.dzis().dzien, '2026-11-18');
  assert.equal(b.dzis().zapisane, 0, 'nowa doba liczy od zera');
  assert.equal(b.przekroczony(), false);
  assert.equal(new Budzet(r, sql.licznik, { limit: 'nie liczba' }).limit, null, 'zły limit znaczy: tylko licz');
});

test('B4. Miejsce z limitem: po jego wyczerpaniu ruch dostaje 429 ze zdaniem dlaczego, czytanie działa, każda odpowiedź niesie koszt', async () => {
  const baza = sqlZLiczbami();
  const naglowki = { 'x-kto': 'jozz', 'x-origin': 'https://przyklad.test', 'content-type': 'application/json' };
  const zad = (obiekt, sciezka, opcje = {}) => obiekt.fetch(new Request('https://przyklad.test' + sciezka, { ...opcje, headers: naglowki }));
  // pierwsze Miejsce bez limitu: zasiew przy pierwszym wejściu sam kosztuje, więc najpierw mierzymy, ile
  const bezLimitu = new Miejsce({ storage: { sql: baza } }, { WLASCICIEL: 'jozz', PODGLAD: 'tak' });
  const pierwsza = await zad(bezLimitu, '/api/srodowisko/opis');
  assert.match(pierwsza.headers.get('x-koszt'), /^wiersze-czytane=\d+; wiersze-zapisane=\d+$/);
  const poZasiewie = (await pierwsza.json()).budzet;
  assert.ok(poZasiewie.zapisane > 0, 'zasiew został policzony');
  assert.equal(poZasiewie.limit_miejsca, null);

  // to samo Miejsce po uśpieniu, tym razem z limitem o kilkadziesiąt wierszy wyższym niż dotychczasowa suma
  const limit = poZasiewie.zapisane + 40;
  const zLimitem = new Miejsce({ storage: { sql: baza } }, { WLASCICIEL: 'jozz', PODGLAD: 'tak', BUDZET_ZAPISOW_NA_DOBE: String(limit) });
  let odmowa = null, ruchow = 0;
  for (let i = 0; i < 100 && !odmowa; i++) {
    const o = await zad(zLimitem, '/api/srodowisko/ruch', { method: 'POST', body: JSON.stringify({ op: 'budzet-' + i, co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'slowo ' + i, dotyczy: [] } }) });
    if (o.status === 429) odmowa = o;
    else { assert.equal(o.status, 200, await o.clone().text()); assert.match(o.headers.get('x-koszt'), /wiersze-zapisane=[1-9]/); ruchow++; }
  }
  assert.ok(ruchow >= 1, 'przed limitem ruchy przechodzą');
  assert.ok(odmowa, 'limit w końcu zatrzymuje ruch');
  const tresc = await odmowa.json();
  assert.match(tresc.blad, new RegExp('dobowego limitu \\(' + limit + '\\)'));
  assert.match(tresc.blad, /czytanie działa dalej/);
  const czytanie = await zad(zLimitem, '/co-tu-jest');
  assert.equal(czytanie.status, 200);
  const tekst = await czytanie.text();
  assert.match(tekst, /Budżet tego Miejsca dziś/);
  assert.match(tekst, /LIMIT TEGO MIEJSCA JEST WYCZERPANY/);
});

test('B5. obserwator chodzi tylko pod adresami z listy: gdzie indziej nie ustawia alarmu, alarm gaśnie, a ręczne drzwi mówią 503', async () => {
  const st = { alarm: null };
  const ctx = () => ({ storage: { sql: sqlZNode(), getAlarm: async () => st.alarm, setAlarm: async (t) => { st.alarm = t; } } });
  const env = { OBSERWATOR: 'tak', OBSERWATOR_ADRESY: 'fable-srodowisko-, fable-automat-faktow-', WLASCICIEL: 'jozz', PODGLAD: 'tak' };
  const zad = (obiekt, host, sciezka, metoda = 'GET') => obiekt.fetch(new Request(`https://${host}${sciezka}`, { method: metoda, headers: { 'x-kto': 'jozz', 'x-origin': `https://${host}` } }));

  const obcy = new Miejsce(ctx(), env);
  await zad(obcy, 'inna-galaz-jaskinia.przyklad.test', '/api/srodowisko/puls');
  assert.equal(st.alarm, null, 'pod adresem spoza listy alarm nie powstaje');
  const reczne = await zad(obcy, 'inna-galaz-jaskinia.przyklad.test', '/api/srodowisko/obejdz', 'POST');
  assert.equal(reczne.status, 503);
  assert.match(await reczne.text(), /nie ma wstępu pod ten adres/);
  await obcy.alarm();
  assert.equal(st.alarm, null, 'alarm, który został po dawnym ustawieniu, gaśnie');

  const swoj = new Miejsce(ctx(), env);
  await zad(swoj, 'fable-srodowisko-jaskinia.przyklad.test', '/api/srodowisko/puls');
  assert.ok(st.alarm > 0, 'pod adresem z listy alarm jest ustawiony');

  // bez listy obserwator chodzi wszędzie, gdzie jest włączony (tak jak dotąd)
  st.alarm = null;
  const bezListy = new Miejsce(ctx(), { OBSERWATOR: 'tak', WLASCICIEL: 'jozz', PODGLAD: 'tak' });
  await zad(bezListy, 'cokolwiek.przyklad.test', '/api/srodowisko/puls');
  assert.ok(st.alarm > 0);
});
