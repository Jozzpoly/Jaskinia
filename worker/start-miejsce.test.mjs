// Sprawdziany położeń na Starcie po stronie Miejsca (17 XI 2026): rzecz rodzaju miejsce leży zawsze w obszarze
// swojego widoku, więc o tym, czy agent układa sam, czy proponuje, mówi ustawienie tego obszaru.
// Powód: na podglądzie agent próbny przesunął kartę ze skutkiem, bo jego położenie trafiło do obszaru Nowe
// (tam agenci prowadzą sami), a widok właściciela i tak je brał.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko, sprawdzKsztalt } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 9, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  const widok = s.spis({ rodzaj: 'widok/1', limit: 5 }).find((w) => w.cechy.nazwa === 'Start');
  const projekt = await s.ruch('jozz', { op: 'miejsce-test-projekt', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Próbny projekt' } });
  assert.equal(projekt.ok, true, JSON.stringify(projekt));
  return { r, s, widok, projekt: projekt.rzecz, nowe: r.meta('obszar_nowe') };
}
const poloz = (s, kto, op, cechy, dodatkowe = {}) => s.ruch(kto, { op, co: 'poloz', rodzaj: 'miejsce/1', cechy, ...dodatkowe });

test('M1. widok Start jest zasiany w obszarze głównym, a kształt miejsca mówi, że to układanie i że leży tam, gdzie widok', async () => {
  const { s, widok } = await swiat();
  assert.ok(widok, 'jest widok o nazwie Start');
  assert.equal(widok.obszar, null);
  const k = s.ksztaltDla('miejsce/1');
  assert.deepEqual([k.klucz, k.uklad, k.lezy_z], [['widok', 'rzecz'], true, 'widok']);
});

test('M2. właściciel kładzie rzecz ze skutkiem; drugie położenie tej samej rzeczy to nowa wersja tego samego miejsca', async () => {
  const { s, widok, projekt } = await swiat();
  const a = await poloz(s, 'jozz', 'miejsce-test-a1', { widok: widok.id, rzecz: projekt, x: 100, y: 200 });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.skutek, 'polozone');
  assert.equal(s.rzecz(a.rzecz).obszar, null, 'miejsce leży w obszarze widoku');
  const b = await poloz(s, 'jozz', 'miejsce-test-a2', { widok: widok.id, rzecz: projekt, x: 300, y: 50, skala: 1.5 }, { wersja: 'dowolna' });
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(b.rzecz, a.rzecz, 'klucz (widok, rzecz) trafia w to samo miejsce');
  const m = s.rzecz(a.rzecz);
  assert.deepEqual([m.cechy.x, m.cechy.y, m.cechy.skala, m.numer, m.zmienil], [300, 50, 1.5, 2, 'jozz']);
  assert.equal(s.historia(a.rzecz).length, 2, 'historia mówi, kto i kiedy kładł');
});

test('M3. agent w obszarze, gdzie wolno mu tylko proponować: jego położenie czeka jako propozycja i nie trafia do obszaru Nowe', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  const w = await poloz(s, 'agent-probny', 'miejsce-test-agent-1', { widok: widok.id, rzecz: projekt, x: 9, y: 9 });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.skutek, 'propozycja', 'obszar główny pozwala agentom tylko proponować');
  assert.equal(s.spis({ rodzaj: 'miejsce/1', odlozone: 'razem' }).length, 0, 'położenie nie powstało');
  // próba położenia wprost w obszarze, w którym agent prowadzi sam, odbija się od drzwi
  const obok = await poloz(s, 'agent-probny', 'miejsce-test-agent-2', { widok: widok.id, rzecz: projekt, x: 9, y: 9 }, { obszar: nowe });
  assert.equal(obok.ok, false);
  assert.equal(obok.status, 400);
  assert.match(obok.blad, /leży zawsze w obszarze rzeczy z cechy widok/);
  // miejsce bez istniejącego widoku nie ma skąd wziąć obszaru
  const bez = await poloz(s, 'agent-probny', 'miejsce-test-agent-3', { widok: 'z'.repeat(26), rzecz: projekt, x: 1, y: 1 });
  assert.equal(bez.ok, false);
  assert.equal(bez.status, 400);
});

test('M4. gdy właściciel pozwoli agentom porządkować w obszarze widoku, agent układa sam, bo miejsce to układanie, nie treść', async () => {
  const { s, widok, projekt } = await swiat();
  const glowny = s.rzecz(s.r.meta('obszar_glowny'));
  const ust = await s.ruch('jozz', { op: 'miejsce-test-ustawienie', co: 'poloz', rzecz: glowny.id, wersja: glowny.wersja, rodzaj: glowny.rodzaj, cechy: { ...glowny.cechy, ile_wolno: 'porzadkowac' } });
  assert.equal(ust.ok, true, JSON.stringify(ust));
  const w = await poloz(s, 'agent-probny', 'miejsce-test-agent-4', { widok: widok.id, rzecz: projekt, x: 40, y: 60 });
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.skutek, 'polozone');
  const m = s.rzecz(w.rzecz);
  assert.deepEqual([m.obszar, m.zmienil, m.cechy.x], [null, 'agent-probny', 40]);
  // ale treść (projekt) w tym samym obszarze agent dalej tylko proponuje
  const p = s.rzecz(projekt);
  const tresc = await s.ruch('agent-probny', { op: 'miejsce-test-agent-5', co: 'poloz', rzecz: p.id, wersja: p.wersja, rodzaj: p.rodzaj, cechy: { ...p.cechy, nazwa: 'Zmieniona nazwa' } });
  assert.equal(tresc.skutek, 'propozycja');
});

test('M5. lezy_z w kształcie: tylko wymagana cecha typu rzecz; zmiana tego ustawienia to zmiana praw, więc należy do właściciela', async () => {
  const dobry = { dla: 'x/1', opis: 'Rzecz, która leży tam, gdzie jej dom.', cechy: { dom: { typ: 'rzecz', wymagana: true }, n: { typ: 'tekst' } }, lezy_z: 'dom' };
  assert.deepEqual(sprawdzKsztalt(dobry), []);
  assert.ok(sprawdzKsztalt({ ...dobry, lezy_z: 'n' }).some((b) => /lezy_z/.test(b)), 'cecha tekstowa nie może być domem');
  assert.ok(sprawdzKsztalt({ ...dobry, lezy_z: 'nie-ma' }).some((b) => /lezy_z/.test(b)));
  assert.ok(sprawdzKsztalt({ ...dobry, cechy: { dom: { typ: 'rzecz' } } }).some((b) => /lezy_z/.test(b)), 'cecha musi być wymagana');
  const { s } = await swiat();
  const nowy = await s.ruch('agent-probny', { op: 'miejsce-test-ksztalt-1', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'notka-agenta/1', opis: 'próba', cechy: { dom: { typ: 'rzecz', wymagana: true } }, lezy_z: 'dom' } });
  assert.equal(nowy.ok, true, JSON.stringify(nowy));
  assert.equal(nowy.skutek, 'propozycja', 'agent nie ustala sam, pod jakim prawem leżą rzeczy rodzaju');
  const propozycja = s.spis({ rodzaj: 'propozycja/1', limit: 5 }).find((p) => p.cechy.rodzaj === 'ksztalt/1');
  assert.equal(propozycja.cechy.wymaga, 'wlasciciel', 'taką propozycję przyjmuje tylko właściciel');
  // ten sam kształt bez lezy_z agent dokłada sam (w obszarze Nowe agenci prowadzą): to lezy_z jest zmianą praw
  const zwykly = await s.ruch('agent-probny', { op: 'miejsce-test-ksztalt-2', co: 'poloz', rodzaj: 'ksztalt/1', cechy: { dla: 'notka-zwykla/1', opis: 'próba', cechy: { dom: { typ: 'rzecz', wymagana: true } } } });
  assert.equal(zwykly.skutek, 'polozone', JSON.stringify(zwykly));
});

// --- 17 XI, po sądzie drugiej linii: obszar miejsca nie jest osobnym zapisem, tylko wynika z widoku ----------------
const przeniesWidok = (s, kto, op, widok, obszar) => s.ruch(kto, { op, co: 'poloz', rodzaj: 'widok/1', rzecz: widok.id, obszar, wersja: 'dowolna', cechy: widok.cechy });
const liczby = (s, rodzaj) => Object.fromEntries(s.przekroj().filter((x) => x.rodzaj === rodzaj && x.ile > 0).map((x) => [(x.obszar ?? 'glowny') + (x.odlozone ? ':odlozone' : ''), x.ile]));

test('M6. miejsce idzie za widokiem: spis, liczby i pytanie po obszarze zgadzają się po przeniesieniu, a zapis miejsca się nie zmienia', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  const drugi = await s.ruch('jozz', { op: 'miejsce-test-drugi-projekt', co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Drugi projekt' } });
  const a = await poloz(s, 'jozz', 'miejsce-test-m6-a', { widok: widok.id, rzecz: projekt, x: 1, y: 2 });
  const b = await poloz(s, 'jozz', 'miejsce-test-m6-b', { widok: widok.id, rzecz: drugi.rzecz, x: 3, y: 4 });
  await s.ruch('jozz', { op: 'miejsce-test-m6-odloz', co: 'odloz', rzecz: b.rzecz, wersja: 'dowolna', powod: 'próba' });
  const przed = [s.rzecz(a.rzecz).wersja, s.rzecz(b.rzecz).wersja];
  assert.deepEqual(liczby(s, 'miejsce/1'), { glowny: 1, 'glowny:odlozone': 1 });
  const p = await przeniesWidok(s, 'jozz', 'miejsce-test-m6-widok', widok, nowe);
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual([s.rzecz(a.rzecz).obszar, s.rzecz(b.rzecz).obszar], [nowe, nowe], 'oba miejsca, także odłożone, leżą tam, gdzie widok');
  assert.deepEqual([s.rzecz(a.rzecz).wersja, s.rzecz(b.rzecz).wersja], przed, 'miejsca nie dostały nowej wersji: ich zapis obszaru nie niesie');
  assert.deepEqual(liczby(s, 'miejsce/1'), { [nowe]: 1, [nowe + ':odlozone']: 1 }, 'przekrój spisu poszedł za rzeczami');
  assert.equal(s.ile({ rodzaj: 'miejsce/1', obszar: nowe }), 1);
  assert.equal(s.ile({ rodzaj: 'miejsce/1', obszar: null }), 0);
  assert.ok(s.pociagniete >= 2, 'środowisko mówi, że pociągnęło rzeczy, żeby otwarte strony przeczytały całość');
  const tresc = JSON.parse(s.q(`SELECT z.tresc FROM rzeczy r JOIN zapisy z ON z.id = r.zapis WHERE r.id = ?`, a.rzecz)[0].tresc);
  assert.deepEqual([tresc.obszar, tresc.obszar_z], [null, 'widok'], 'zapis mówi, z której cechy bierze się obszar, i nie niesie własnego');
});

test('M7. przyjęcie propozycji po przeniesieniu widoku zakłada miejsce tam, gdzie widok leży dziś', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  const prop = await poloz(s, 'agent-a', 'miejsce-test-m7-prop', { widok: widok.id, rzecz: projekt, x: 5, y: 6 });
  assert.equal(prop.skutek, 'propozycja', JSON.stringify(prop));
  await przeniesWidok(s, 'jozz', 'miejsce-test-m7-widok', widok, nowe);
  const przyjecie = await s.ruch('jozz', { op: 'miejsce-test-m7-przyjmij', co: 'przyjmij', propozycja: prop.propozycja });
  assert.equal(przyjecie.ok, true, JSON.stringify(przyjecie));
  assert.equal(s.rzecz(przyjecie.rzecz).obszar, nowe, 'własne przyjęcie właściciela nie zakłada niespójności');
});

test('M8. agent nie przeciągnie cudzych położeń przy okazji: przeniesienie widoku tam, gdzie mógłby tylko proponować, jest propozycją', async () => {
  const { s, widok, projekt, nowe } = await swiat();
  // widok leży w Nowe (agenci prowadzą tam sami) i ma jedno miejsce
  await przeniesWidok(s, 'jozz', 'miejsce-test-m8-widok', widok, nowe);
  const m = await poloz(s, 'agent-a', 'miejsce-test-m8-miejsce', { widok: widok.id, rzecz: projekt, x: 7, y: 8 });
  assert.equal(m.skutek, 'polozone', JSON.stringify(m));
  // agent chce przenieść widok do głównego, gdzie wolno mu tylko proponować: propozycja, nic się nie rusza
  const w = s.rzecz(widok.id);
  const ruch = await przeniesWidok(s, 'agent-a', 'miejsce-test-m8-do-glownego', w, null);
  assert.equal(ruch.skutek, 'propozycja', JSON.stringify(ruch));
  assert.deepEqual([s.rzecz(widok.id).obszar, s.rzecz(m.rzecz).obszar], [nowe, nowe]);
  // po przyjęciu przez właściciela idą razem
  const przyjecie = await s.ruch('jozz', { op: 'miejsce-test-m8-przyjmij', co: 'przyjmij', propozycja: ruch.propozycja });
  assert.equal(przyjecie.ok, true, JSON.stringify(przyjecie));
  assert.deepEqual([s.rzecz(widok.id).obszar, s.rzecz(m.rzecz).obszar], [null, null]);
});

test('M9. odbudowa spisu z dziennika daje ten sam obszar miejsc co praca na bieżąco, także dla zapisów sprzed tej reguły', async () => {
  const { r, s, widok, projekt, nowe } = await swiat();
  const a = await poloz(s, 'jozz', 'miejsce-test-m9-a', { widok: widok.id, rzecz: projekt, x: 1, y: 2 });
  await przeniesWidok(s, 'jozz', 'miejsce-test-m9-widok', widok, nowe);
  const przed = s.wszystkie({ odlozone: 'razem' }).map((x) => [x.id, x.obszar]).sort();
  const liczbyPrzed = JSON.stringify(s.przekroj().filter((x) => x.ile > 0).sort((x, y) => JSON.stringify(x) < JSON.stringify(y) ? -1 : 1));
  s.przebuduj();
  assert.deepEqual(s.wszystkie({ odlozone: 'razem' }).map((x) => [x.id, x.obszar]).sort(), przed);
  assert.equal(JSON.stringify(s.przekroj().filter((x) => x.ile > 0).sort((x, y) => JSON.stringify(x) < JSON.stringify(y) ? -1 : 1)), liczbyPrzed);
  assert.equal(s.rzecz(a.rzecz).obszar, nowe);
  // spis sprzed reguły (obszar miejsca zapisany osobno i już nieprawdziwy): nowe środowisko na tych samych danych go wyrównuje
  r.sql.exec(`UPDATE rzeczy SET obszar = NULL WHERE id = ?`, a.rzecz);
  s._zbudujPrzekroj(); // przekrój liczony z tego samego, dawnego spisu
  r.ustawMeta('spis:lezy_z', '0');
  const s2 = new Srodowisko(r);
  assert.equal(s2.rzecz(a.rzecz).obszar, nowe, 'wyrównanie przy starcie');
  assert.equal(s2.ile({ rodzaj: 'miejsce/1', obszar: nowe }), 1);
  // wyrównanie nie zmienia żadnego zapisu, więc zostawia ślad: liczbę i chwilę, a opis pod adresem mówi to zdaniem
  const slad = s2.wyrownano();
  assert.deepEqual([slad.razem, slad.ostatnio], [1, 1], JSON.stringify(slad));
  const { coTuJest } = await import('./opis.mjs');
  assert.match(coTuJest(s2, { origin: 'https://proba.example' }), /Wyrównanie spisu: 1 rzecz dostała w spisie obszar rzeczy, z którą z natury leży/);
});

test('M10. reguła nie daje się zamknąć w koło, a kształt z lezy_z dołożony po rzeczach od razu je porządkuje', async () => {
  const { s, nowe } = await swiat();
  const ks = (dla, extra = {}) => ({ dla, opis: 'Rzecz próbna, która leży z inną.', tytul: 'nazwa', cechy: { nazwa: { typ: 'tekst', wymagana: true }, przy: { typ: 'rzecz', wymagana: true } }, ...extra });
  const k = await s.ruch('jozz', { op: 'miejsce-test-m10-ksztalt', co: 'poloz', rodzaj: 'ksztalt/1', cechy: ks('przypinka/1', { lezy_z: 'przy' }) });
  assert.equal(k.ok, true, JSON.stringify(k));
  const kotwica = await s.ruch('jozz', { op: 'miejsce-test-m10-kotwica', co: 'poloz', rodzaj: 'projekt/1', obszar: nowe, cechy: { nazwa: 'Kotwica' } });
  const a = await s.ruch('jozz', { op: 'miejsce-test-m10-a', co: 'poloz', rodzaj: 'przypinka/1', cechy: { nazwa: 'A', przy: kotwica.rzecz } });
  const b = await s.ruch('jozz', { op: 'miejsce-test-m10-b', co: 'poloz', rodzaj: 'przypinka/1', cechy: { nazwa: 'B', przy: a.rzecz } });
  assert.deepEqual([s.rzecz(a.rzecz).obszar, s.rzecz(b.rzecz).obszar], [nowe, nowe], 'łańcuch: B leży z A, A z kotwicą');
  const kolo = await s.ruch('jozz', { op: 'miejsce-test-m10-kolo', co: 'poloz', rodzaj: 'przypinka/1', rzecz: a.rzecz, wersja: 'dowolna', cechy: { nazwa: 'A', przy: b.rzecz } });
  assert.equal(kolo.ok, false);
  assert.equal(kolo.status, 422);
  assert.match(kolo.blad, /zamyka koło/);
  // kotwica wraca do głównego: idzie za nią cały łańcuch
  await s.ruch('jozz', { op: 'miejsce-test-m10-przenies', co: 'poloz', rodzaj: 'projekt/1', rzecz: kotwica.rzecz, obszar: null, wersja: 'dowolna', cechy: { nazwa: 'Kotwica' } });
  assert.deepEqual([s.rzecz(a.rzecz).obszar, s.rzecz(b.rzecz).obszar], [null, null]);
  // rodzaj bez kształtu, rzeczy leżą w Nowe; kształt z lezy_z przychodzi później i od razu daje im obszar z natury
  const luzna = await s.ruch('agent-a', { op: 'miejsce-test-m10-luzna', co: 'poloz', rodzaj: 'znaczek/1', cechy: { nazwa: 'Luźny', przy: kotwica.rzecz } });
  assert.equal(s.rzecz(luzna.rzecz).obszar, nowe);
  const k2 = await s.ruch('jozz', { op: 'miejsce-test-m10-ksztalt-2', co: 'poloz', rodzaj: 'ksztalt/1', cechy: ks('znaczek/1', { lezy_z: 'przy' }) });
  assert.equal(k2.ok, true, JSON.stringify(k2));
  assert.equal(s.rzecz(luzna.rzecz).obszar, null, 'znaczek leży teraz tam, gdzie kotwica');
});
