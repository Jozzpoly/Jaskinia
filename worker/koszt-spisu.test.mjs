// Koszt spisu (20 XI 2026, Opus Code): dwa pytania, które Start zadaje najczęściej, nie mogą czytać całego wycinka.
// Pod adresem pnia (nagłówek x-koszt, 20 XI, przy 664 rzeczach wycinka):
// - doganianie po zmianie kosztowało 1361 wierszy, choć oddało zero rzeczy;
// - wejście kosztowało 2688 wierszy, z czego połowa szła na samo `razem`.
// Indeks aktu powstał właśnie dla doganiania, ale od wycinka (rodzaje=) planista wybierał indeks rodzaju, a obietnicę
// pilnował tylko komentarz. Tu pilnują jej sprawdziany. Każdy pyta też o wynik, nie tylko o drogę: tania droga, która
// oddaje złą liczbę albo pokazuje gościowi zmianę w obszarze, którego nie widzi, jest gorsza niż droga droga.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';
import { WYCINEK } from '../public/start/drzwi.mjs';

const W = WYCINEK.split(',');

async function swiat() {
  const db = new DatabaseSync(':memory:');
  const baza = sqlZNode(db);
  const slad = [];
  const sql = { exec: (q, ...p) => { slad.push([q, p]); return baza.exec(q, ...p); } };
  let t = Date.UTC(2026, 10, 20, 17, 0, 0);
  const r = new Rdzen(sql, { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-probny'] }));
  let nr = 0;
  const ruch = async (c) => {
    const w = await s.ruch('jozz', { op: `koszt-spisu-${String(++nr).padStart(4, '0')}`, ...c });
    assert.equal(w.ok, true, JSON.stringify(w));
    return w;
  };
  const odloz = (id) => ruch({ co: 'odloz', rzecz: id, wersja: s.rzecz(id).wersja });
  // Trzy obszary o trzech widocznościach; w każdym trzy żywe projekty i jeden odłożony. Do tego projekt w głównym.
  const obszary = {};
  for (const [nazwa, widzi] of [['Jawny', 'wszyscy'], ['Dla uczestnikow', 'uczestnicy'], ['Tylko wlasciciel', 'wlasciciel']]) {
    const o = await ruch({ co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa, ile_wolno: 'proponowac', widzi } });
    obszary[widzi] = o.rzecz;
    for (let i = 0; i < 3; i++) await ruch({ co: 'poloz', rodzaj: 'projekt/1', obszar: o.rzecz, cechy: { nazwa: `${nazwa} ${i}` } });
    await odloz((await ruch({ co: 'poloz', rodzaj: 'projekt/1', obszar: o.rzecz, cechy: { nazwa: `${nazwa} odlozony` } })).rzecz);
  }
  await ruch({ co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'W glownym' } });
  const plan = (q, p) => db.prepare('EXPLAIN QUERY PLAN ' + q).all(...p).map((k) => String(k.detail)).join(' | ');
  return { s, slad, plan, obszary, ruch, odloz };
}

const CZYTAJACY = [undefined, 'jozz', 'agent-probny', null];
const oczami = (s, kto) => (kto === undefined ? s : s.dla(kto));

test('KS1. doganianie po zmianie idzie po indeksie aktu, nie po całym wycinku, i oddaje dokładnie zmiany', async () => {
  const { s, slad, plan, obszary, ruch, odloz } = await swiat();
  const akt = s.ostatniNr();
  const f = { po: akt, rodzaje: W, odlozone: 'razem' };
  for (const kto of CZYTAJACY) {
    const czyta = oczami(s, kto);
    czyta.spis(f); czyta.ile(f); // rozgrzanie: role i widoczność czytają się raz, nie przy każdym doganianiu
    slad.length = 0;
    assert.deepEqual(czyta.spis(f), [], 'nic się nie zmieniło');
    assert.equal(czyta.ile(f), 0);
    const poAkcie = slad.filter(([q]) => /r\.akt > \?/.test(q));
    assert.equal(poAkcie.length, 2, 'spis i liczenie: oba pytają po akcie');
    for (const [q, p] of poAkcie) {
      const pl = plan(q, p);
      assert.match(pl, /USING (COVERING )?INDEX rzeczy_akt/, `doganianie (${kto}) idzie po indeksie aktu: ${pl}`);
      assert.doesNotMatch(pl, /rzeczy_rodzaj|SCAN r\b/, `i nie czyta całego wycinka (${kto}): ${pl}`);
    }
  }
  // Wynik, nie tylko droga: nowa rzecz w jawnym obszarze i rzecz odłożona w obszarze właściciela.
  const nowa = await ruch({ co: 'poloz', rodzaj: 'projekt/1', obszar: obszary.wszyscy, cechy: { nazwa: 'Po znaczniku' } });
  const ukryta = s.spis({ rodzaj: 'projekt/1', obszar: obszary.wlasciciel, limit: 1 })[0];
  await odloz(ukryta.id);
  const zmiany = (kto) => oczami(s, kto).spis(f).map((x) => [x.id, Boolean(x.odlozone)]).sort();
  assert.deepEqual(zmiany('jozz'), [[nowa.rzecz, false], [ukryta.id, true]].sort());
  assert.equal(s.dla('jozz').ile(f), 2);
  assert.deepEqual(zmiany(null), [[nowa.rzecz, false]], 'gość nie dowiaduje się o zmianie w obszarze, którego nie widzi');
  assert.equal(s.dla(null).ile(f), 1);
  assert.deepEqual(oczami(s, 'jozz').spis({ ...f, odlozone: 'nie' }).map((x) => x.id), [nowa.rzecz], 'bez odłożonych: tylko żywe');
});

// Niezależna od kodu Miejsca odpowiedź: liczona tutaj z pełnej listy, którą widzi czytający.
const POPRAWNY = /^[a-z][a-z0-9_.-]{0,79}(\/[1-9][0-9]{0,5})?$/;
function policzRecznie(wszystkie, { rodzaje, odlozone, obszar }) {
  const lista = Array.isArray(rodzaje) ? [...new Set(rodzaje)].filter((x) => typeof x === 'string' && POPRAWNY.test(x)).slice(0, 24) : [];
  return wszystkie.filter((r) => lista.some((x) => (x.includes('/') ? r.rodzaj === x : r.rodzaj.split('/')[0] === x))
    && (odlozone === 'razem' || Boolean(r.odlozone) === (odlozone === 'tak'))
    && (obszar === undefined || (r.obszar ?? null) === obszar)).length;
}

test('KS2. razem wycinka z przekroju: bez przeglądu rzeczy, ta sama liczba co spis, dla każdego czytającego', async () => {
  const { s, slad, obszary } = await swiat();
  const listy = [
    W, ['projekt/1'], ['projekt'], ['projekt', 'projekt/1', 'projekt'], ['obszar'], [], ['ZLE', 'projekt/0', 'projekt'],
    [...Array.from({ length: 24 }, (_, i) => 'nic' + i), 'projekt'], // dwudziesty piąty rodzaj już się nie liczy
    'projekt', // nie lista: nic
    [...W, 'obszar/1'],
  ];
  let sprawdzonych = 0;
  for (const kto of CZYTAJACY) {
    const czyta = oczami(s, kto);
    const wszystkie = czyta.spis({ odlozone: 'razem', limit: 2000 });
    for (const rodzaje of listy) for (const odlozone of ['nie', 'tak', 'razem']) for (const obszar of [undefined, obszary.wszyscy, obszary.wlasciciel, null]) {
      const f = { rodzaje, odlozone, ...(obszar === undefined ? {} : { obszar }) };
      czyta.ile(f); // rozgrzanie przekroju i widoczności
      slad.length = 0;
      const n = czyta.ile(f);
      const opis = `${kto} ${JSON.stringify(f)}`;
      assert.equal(slad.filter(([q]) => /COUNT\(\*\)[\s\S]*FROM rzeczy/.test(q)).length, 0, `liczenie wycinka bez przeglądu rzeczy: ${opis}`);
      assert.equal(n, czyta.spis({ ...f, limit: 2000 }).length, `liczba zgodna ze spisem: ${opis}`);
      assert.equal(n, policzRecznie(wszystkie, { rodzaje, odlozone, obszar }), `liczba zgodna z policzoną ręcznie: ${opis}`);
      sprawdzonych++;
    }
  }
  assert.equal(sprawdzonych, CZYTAJACY.length * 10 * 3 * 4);
  // Sprawdzian, który nie może zaliczyć pustego świata: wycinek Startu dla właściciela ma tu co najmniej 13 projektów.
  assert.ok(s.dla('jozz').ile({ rodzaje: W, odlozone: 'razem' }) >= 13);
});

test('KS3. trasa spisu: razem wycinka zgadza się z tym, co oddała, dla gościa, uczestnika i właściciela', async () => {
  const { s } = await swiat();
  const zap = async (sciezka, kto = '') => (await obsluzSrodowisko(s, new Request('https://przyklad.test' + sciezka, { headers: { 'x-kto': kto } }), { podglad: false })).json();
  for (const kto of ['', 'agent-probny', 'jozz']) {
    const calosc = await zap('/api/srodowisko/spis?rodzaje=' + WYCINEK, kto);
    assert.equal(calosc.ok, true);
    assert.equal(calosc.razem, calosc.rzeczy.length, `razem = oddane (${kto || 'gość'})`);
    assert.equal(calosc.wszystko, true);
    const kawalek = await zap('/api/srodowisko/spis?ile=2&rodzaje=' + WYCINEK, kto);
    assert.equal(kawalek.razem, calosc.razem, 'razem nie zależy od kawałka');
    assert.equal(kawalek.wszystko, calosc.razem <= 2);
  }
});
