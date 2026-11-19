// Warianty (19 XI 2026): jego presety na danych. Jego model jego słowami (18 XI 21:34 i 23:18, rejestr poz. 193 i 204):
// domyślny prowadzą agenci; on go kopiuje, nazywa swoim, psuje, zapisuje ciekawy układ, wraca do niego albo do
// domyślnego, a wszystkie jego presety odnoszą się do tego samego domyślnego, który agenci aktualizują bez jego zgody.
// Sprawdziany pytają z dwóch stron: że ruch robi to, co ma, i że nie robi tego, czego nie wolno (granica publikacji).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';
import { DatabaseSync } from 'node:sqlite';

let n = 0;
const op = (p = 'w') => `wa-${p}-${String(++n).padStart(5, '0')}`;
const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };

async function swiat() {
  let t = Date.UTC(2026, 10, 19, 18, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const nowe = r.meta('obszar_nowe');
  const obszar = async (nazwa, widzi, ile_wolno) => ok(await s.ruch('jozz', { op: op('obszar'), co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa, widzi, ile_wolno } })).rzecz;
  // domyślny preset agentów: zestaw w obszarze Nowe, gdzie agenci prowadzą
  const D = ok(await s.ruch('agent-a', { op: op('d'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe, cechy: { nazwa: 'Domyślny', po_co: 'preset', wartosci: { 'odczucie.ruch.natezenie': 1, 'wyglad.paleta.jasna.tlo': '#f4f1ea' } } })).rzecz;
  return { r, s, nowe, obszar, D };
}
const ile = (s, rodzaj) => s.ile({ rodzaj, odlozone: 'razem' });

test('WA1. kopiuj: jednym gestem kopia z pochodzeniem; źródło nietknięte; ponowienie tego samego op nie robi drugiej kopii', async () => {
  const { s, D } = await swiat();
  const przedD = s.rzecz(D);
  const o = op('kopia');
  const w = ok(await s.ruch('jozz', { op: o, co: 'kopiuj', rzecz: D, nazwa: 'Mój' }));
  assert.equal(w.skutek, 'skopiowane');
  const k = s.rzecz(w.rzecz);
  assert.equal(k.rodzaj, 'zestaw/1');
  assert.equal(k.cechy.nazwa, 'Mój');
  assert.deepEqual(k.cechy.wartosci, przedD.cechy.wartosci, 'treść jak w źródle');
  assert.equal(k.obszar ?? null, null, 'kopia właściciela trafia do obszaru głównego, jak jego zwykła nowa rzecz');
  const p = s.spis({ rodzaj: 'pochodzenie/1', gdzie: { kopia: k.id } })[0];
  assert.ok(p, 'pochodzenie leży przy kopii');
  assert.deepEqual([p.cechy.z, p.cechy.wersja], [D, przedD.wersja]);
  assert.equal(p.obszar ?? null, k.obszar ?? null, 'pochodzenie leży tam, gdzie kopia');
  assert.equal(s.rzecz(D).wersja, przedD.wersja, 'źródło nietknięte');
  assert.deepEqual(s.pochodzenieDla(k.id, 'jozz'), { z: D, wersja: przedD.wersja, wersja_zrodla: przedD.wersja, nowsze: false, zrodlo_odlozone: false });
  const akt = s.ostatniNr();
  const znowu = ok(await s.ruch('jozz', { op: o, co: 'kopiuj', rzecz: D, nazwa: 'Mój' }));
  assert.equal(znowu.powtorzone, true);
  assert.equal(znowu.rzecz, k.id);
  assert.equal(s.ostatniNr(), akt, 'ponowienie nic nie zapisało');
  // bez nazwy: tytuł źródła z dopiskiem
  const bezNazwy = ok(await s.ruch('jozz', { op: op('kopia'), co: 'kopiuj', rzecz: D }));
  assert.equal(s.rzecz(bezNazwy.rzecz).cechy.nazwa, 'Domyślny (kopia)');
  // ponowienie po odłożeniu źródła: nadal ta sama kopia, a nie odmowa (ponowienie odpowiada tym, co się stało)
  ok(await s.ruch('agent-a', { op: op('odloz'), co: 'odloz', rzecz: D, wersja: 'dowolna', powod: 'nowy domyślny' }));
  assert.equal((await s.ruch('jozz', { op: op('kopia'), co: 'kopiuj', rzecz: D })).status, 409, 'kontrola: nowa kopia odłożonego źródła to odmowa');
  const poOdlozeniu = ok(await s.ruch('jozz', { op: o, co: 'kopiuj', rzecz: D, nazwa: 'Mój' }));
  assert.deepEqual([poOdlozeniu.powtorzone, poOdlozeniu.rzecz], [true, k.id]);
});

test('WA2. domyslny na kopii: po jego zmianach i po tym, jak agenci zmienili domyślny, kopia wraca do DZISIEJSZEJ treści źródła, nazwa zostaje', async () => {
  const { s, D } = await swiat();
  const k = ok(await s.ruch('jozz', { op: op('kopia'), co: 'kopiuj', rzecz: D, nazwa: 'Mój' })).rzecz;
  // on psuje swój
  const kk = s.rzecz(k);
  ok(await s.ruch('jozz', { op: op('psuje'), co: 'poloz', rzecz: k, wersja: kk.wersja, rodzaj: 'zestaw/1', cechy: { ...kk.cechy, wartosci: { 'odczucie.ruch.natezenie': 9 } } }));
  // agenci aktualizują domyślny bez jego zgody
  const dd = s.rzecz(D);
  ok(await s.ruch('agent-a', { op: op('agent'), co: 'poloz', rzecz: D, wersja: dd.wersja, rodzaj: 'zestaw/1', cechy: { ...dd.cechy, wartosci: { ...dd.cechy.wartosci, 'odczucie.ruch.natezenie': 2 } } }));
  assert.equal(s.pochodzenieDla(k, 'jozz').nowsze, true, 'znak: domyślny ma nowszą wersję (bez zapisu)');
  const przed = s.ostatniNr();
  const w = ok(await s.ruch('jozz', { op: op('dom'), co: 'domyslny', rzecz: k }));
  assert.equal(w.skutek, 'domyslny-ze-zrodla');
  const po = s.rzecz(k);
  assert.deepEqual(po.cechy.wartosci, s.rzecz(D).cechy.wartosci, 'treść dzisiejszego źródła');
  assert.equal(po.cechy.nazwa, 'Mój', 'jego nazwa zostaje');
  assert.equal(s.pochodzenieDla(k, 'jozz').nowsze, false);
  assert.ok(s.historia(k).some((h) => h.kto === 'jozz'), 'jego wersje zostają w historii');
  assert.ok(s.ostatniNr() > przed);
  const znow = await s.ruch('jozz', { op: op('dom'), co: 'domyslny', rzecz: k });
  assert.equal(znow.status, 409, 'drugi raz: już jest domyślna');
});

test('WA3. punkt zapisu: ciekawy układ zapisany jednym ruchem, po dalszym psuciu wraca jednym ruchem', async () => {
  const { s, D } = await swiat();
  const k = ok(await s.ruch('jozz', { op: op('kopia'), co: 'kopiuj', rzecz: D, nazwa: 'Mój' })).rzecz;
  let kk = s.rzecz(k);
  ok(await s.ruch('jozz', { op: op('stroi'), co: 'poloz', rzecz: k, wersja: kk.wersja, rodzaj: 'zestaw/1', cechy: { ...kk.cechy, wartosci: { 'odczucie.ruch.natezenie': 5 } } }));
  kk = s.rzecz(k);
  const ciekawy = JSON.stringify(kk.cechy);
  const pkt = ok(await s.ruch('jozz', { op: op('punkt'), co: 'poloz', rodzaj: 'punkt/1', cechy: { nazwa: 'ciekawy', czego: k, wersja: kk.wersja } })).rzecz;
  assert.equal(s.rzecz(pkt).obszar ?? null, kk.obszar ?? null, 'punkt leży tam, gdzie rzecz');
  ok(await s.ruch('jozz', { op: op('niszczy'), co: 'poloz', rzecz: k, wersja: kk.wersja, rodzaj: 'zestaw/1', cechy: { ...kk.cechy, wartosci: {} } }));
  assert.notEqual(JSON.stringify(s.rzecz(k).cechy), ciekawy);
  ok(await s.ruch('jozz', { op: op('wraca'), co: 'wroc-do-punktu', punkt: pkt }));
  assert.equal(JSON.stringify(s.rzecz(k).cechy), ciekawy, 'stan wraca co do wartości');
  assert.equal((await s.ruch('jozz', { op: op('wraca'), co: 'wroc-do-punktu', punkt: 'z'.repeat(26) })).status, 404);
  assert.equal((await s.ruch('jozz', { op: op('wraca'), co: 'wroc-do-punktu', punkt: k })).status, 404, 'rzecz, która nie jest punktem zapisu, nie działa jak punkt');
});

test('WA4. granica publikacji: agent nie kopiuje do obszaru jawniejszego niż źródło; właściciel może, ale bez pochodzenia', async () => {
  const { s, obszar } = await swiat();
  const U = await obszar('Uczestników', 'uczestnicy', 'prowadzic');
  const P = await obszar('Publiczny', 'wszyscy', 'prowadzic');
  const T = await obszar('Tajny', 'wlasciciel', 'nic');
  const zU = ok(await s.ruch('agent-a', { op: op('zu'), co: 'poloz', rodzaj: 'zestaw/1', obszar: U, cechy: { nazwa: 'W obszarze uczestników', wartosci: {} } })).rzecz;
  const zT = ok(await s.ruch('jozz', { op: op('zt'), co: 'poloz', rodzaj: 'zestaw/1', obszar: T, cechy: { nazwa: 'Tajny preset', wartosci: {} } })).rzecz;
  // agent: zamknięte źródło brzmi jak nieistniejące
  assert.equal((await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: zT, obszar: U })).status, 404);
  // agent: do jawniejszego = publikacja
  const pub = await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: zU, obszar: P });
  assert.equal(pub.status, 403, JSON.stringify(pub));
  assert.match(pub.blad, /publikacja/);
  // kontrola: agent w obszarze tak samo widocznym robi kopię z pochodzeniem
  const wU = ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: zU, obszar: U }));
  assert.ok(wU.pochodzenie, 'kopia agenta ma pochodzenie');
  // właściciel publikuje tylko jawnie: bez "publikuj" odmowa bez śladu; z nim kopia jest, a pochodzenia nie ma
  // (zdradzałoby identyfikator źródła tym, którzy źródła nie widzą)
  const akt = s.ostatniNr();
  const bez = await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zT, obszar: P });
  assert.deepEqual([bez.status, bez.potwierdz, s.ostatniNr()], [409, 'publikuj', akt], JSON.stringify(bez));
  assert.equal((await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zT, obszar: P, publikuj: 'tak' })).status, 400, 'publikuj to tylko true');
  const wP = ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zT, obszar: P, publikuj: true }));
  assert.equal(wP.publikacja, true);
  assert.equal(wP.pochodzenie, null);
  assert.equal(s.spis({ rodzaj: 'pochodzenie/1', gdzie: { kopia: wP.rzecz } }).length, 0);
});

test('WA5. domyslny na kopii, która leży jawniej niż źródło: agent dostaje odmowę, właściciel wraca', async () => {
  const { s, obszar } = await swiat();
  const U = await obszar('Uczestników', 'uczestnicy', 'prowadzic');
  const P = await obszar('Publiczny', 'wszyscy', 'prowadzic');
  const zU = ok(await s.ruch('agent-a', { op: op('zu'), co: 'poloz', rodzaj: 'zestaw/1', obszar: U, cechy: { nazwa: 'Źródło', wartosci: { 'odczucie.ruch.natezenie': 1 } } })).rzecz;
  const k = ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zU, obszar: U, nazwa: 'Kopia' })).rzecz;
  // właściciel przenosi kopię do obszaru publicznego (pochodzenie idzie za nią)
  const kk = s.rzecz(k);
  ok(await s.ruch('jozz', { op: op('przenies'), co: 'poloz', rzecz: k, wersja: kk.wersja, rodzaj: 'zestaw/1', obszar: P, cechy: { ...kk.cechy, wartosci: {} } }));
  const odmowa = await s.ruch('agent-a', { op: op('dom'), co: 'domyslny', rzecz: k });
  assert.equal(odmowa.status, 403, JSON.stringify(odmowa));
  assert.match(odmowa.blad, /publikacj/);
  assert.deepEqual(s.rzecz(k).cechy.wartosci, {}, 'treść źródła nie przeszła do jawnego obszaru');
  const bez = await s.ruch('jozz', { op: op('dom'), co: 'domyslny', rzecz: k });
  assert.deepEqual([bez.status, bez.potwierdz], [409, 'publikuj'], 'właściciel też nie publikuje mimochodem: ' + JSON.stringify(bez));
  assert.deepEqual(s.rzecz(k).cechy.wartosci, {});
  ok(await s.ruch('jozz', { op: op('dom'), co: 'domyslny', rzecz: k, publikuj: true }));
  assert.deepEqual(s.rzecz(k).cechy.wartosci, { 'odczucie.ruch.natezenie': 1 }, 'właściciel publikuje świadomie');
});

test('WA6. czego się nie kopiuje, rodzaj z kluczem tożsamości, sprawdzenie treści i odmowa bez śladu', async () => {
  const { s, D } = await swiat();
  const uczestnik = s.spis({ rodzaj: 'uczestnik/1', limit: 1 })[0];
  assert.equal((await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: uczestnik.id })).status, 422);
  const obszarRz = s.spis({ rodzaj: 'obszar/1', limit: 1 })[0];
  assert.equal((await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: obszarRz.id })).status, 422);
  // rodzaj z kluczem: kopia z tym samym kluczem byłaby tą samą rzeczą
  const rod = ok(await s.ruch('jozz', { op: op('rod'), co: 'poloz', rodzaj: 'rodzina/1', cechy: { znak: 'proba', nazwa: 'Próba', pytanie: 'o co pyta', stan_na: '2026-11-19T18:00:00Z' } })).rzecz;
  const ten = await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: rod });
  assert.equal(ten.status, 409, JSON.stringify(ten));
  ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: rod, zmien: { znak: 'proba-2' } }));
  // treść kopii przechodzi to samo sprawdzenie co zwykła nowa rzecz, z tym samym kodem odpowiedzi
  const zla = await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: D, zmien: { wartosci: { 'nie.ma.takiego': 1 } } });
  assert.equal(zla.status, 422, JSON.stringify(zla));
  assert.match(zla.blad, /nowa rzecz rodzaju zestaw\/1 nie przechodzi sprawdzenia/);
  // odmowa bez śladu: agent kopiuje do obszaru głównego, gdzie tylko proponuje, więc nie powstaje ani kopia, ani
  // pochodzenie, ani propozycja (kopia z pochodzeniem to dwie rzeczy, a propozycja niesie jedną)
  const przedZ = ile(s, 'zestaw/1'), przedP = ile(s, 'pochodzenie/1'), akt = s.ostatniNr();
  const w = await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: D, obszar: null });
  assert.equal(w.status, 403, JSON.stringify(w));
  assert.match(w.blad, /w całości/, 'powodem jest prawo obszaru, nie granica publikacji (Nowe i główny są tak samo jawne)');
  assert.deepEqual([ile(s, 'zestaw/1'), ile(s, 'pochodzenie/1'), s.ostatniNr()], [przedZ, przedP, akt]);
  // kontrola: ten sam agent tym samym ruchem do obszaru, w którym prowadzi, robi kopię
  ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: D }));
});

test('WA7. pochodzenie oczami czytającego, także przez adres: kto nie widzi źródła, nie dostaje jego identyfikatora', async () => {
  const { s, obszar } = await swiat();
  const T = await obszar('Tajny', 'wlasciciel', 'nic');
  const U = await obszar('Uczestników', 'uczestnicy', 'prowadzic');
  const zT = ok(await s.ruch('jozz', { op: op('zt'), co: 'poloz', rodzaj: 'zestaw/1', obszar: T, cechy: { nazwa: 'Tajny', wartosci: {} } })).rzecz;
  // kopia właściciela z tajnego do obszaru uczestników: to publikacja, więc bez pochodzenia
  const pub = ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zT, obszar: U, publikuj: true }));
  assert.equal(s.dla('agent-a').pochodzenieDla(pub.rzecz), null, 'przy kopii bez pochodzenia nie ma czego mówić');
  // kopia w tym samym tajnym obszarze: agent nie widzi ani kopii, ani jej pochodzenia
  const tk = ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zT, obszar: T })).rzecz;
  assert.equal(s.dla('agent-a').pochodzenieDla(tk), null, 'kopia niewidoczna: nic');
  assert.equal(s.dla('jozz').pochodzenieDla(tk).z, zT, 'kontrola: właściciel widzi źródło');
  // przez adres
  const pytanie = async (id, kto) => (await obsluzSrodowisko(s, new Request('https://proba.example/api/srodowisko/rzecz?id=' + id, { headers: { 'x-kto': kto } }))).json();
  assert.equal((await pytanie(tk, 'jozz')).pochodzenie.z, zT);
  assert.equal((await pytanie(tk, 'agent-a')).ok, false, 'agent nie widzi kopii z tajnego obszaru');
  // czytelnik widzi kopię, ale nie źródło: właściciel schował źródło po skopiowaniu
  const zU = ok(await s.ruch('agent-a', { op: op('zu'), co: 'poloz', rodzaj: 'zestaw/1', obszar: U, cechy: { nazwa: 'Źródło', wartosci: {} } })).rzecz;
  const kU = ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: zU, obszar: U })).rzecz;
  assert.equal(s.dla('agent-a').pochodzenieDla(kU).z, zU, 'kontrola: póki źródło widać, czytelnik dostaje jego identyfikator');
  const zz = s.rzecz(zU);
  ok(await s.ruch('jozz', { op: op('chowa'), co: 'poloz', rzecz: zU, wersja: zz.wersja, rodzaj: 'zestaw/1', obszar: T, cechy: zz.cechy }));
  assert.deepEqual(s.dla('agent-a').pochodzenieDla(kU), { widac_zrodlo: false });
  const przezAdres = await pytanie(kU, 'agent-a');
  assert.deepEqual(przezAdres.pochodzenie, { widac_zrodlo: false });
  assert.ok(!JSON.stringify(przezAdres).includes(`"wersja_zrodla"`), 'bez wersji źródła');
});

test('WA8. dwie pułapki na niego: kopia bez obszaru nie publikuje domyślnie, a źródło schowane po skopiowaniu nie wraca do jawnej kopii bez pytania', async () => {
  const { s, obszar } = await swiat();
  const T = await obszar('Tajny', 'wlasciciel', 'nic');
  const U = await obszar('Uczestników', 'uczestnicy', 'prowadzic');
  // 1. jego tajny preset skopiowany bez obszaru: główny jest jawniejszy niż źródło, więc kopia ląduje obok źródła
  const zT = ok(await s.ruch('jozz', { op: op('zt'), co: 'poloz', rodzaj: 'zestaw/1', obszar: T, cechy: { nazwa: 'Tajny', wartosci: { 'odczucie.ruch.natezenie': 3 } } })).rzecz;
  const w = ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zT }));
  assert.equal(s.rzecz(w.rzecz).obszar, T, 'kopia obok źródła, nie w głównym');
  assert.equal(w.publikacja, undefined);
  assert.ok(w.pochodzenie, 'zwykła kopia ma pochodzenie');
  assert.equal(s.dla('agent-a').rzecz(w.rzecz), null, 'agent jej nie widzi');
  // kontrola: kopia źródła z obszaru tak jawnego jak główny ląduje w głównym, jak jego zwykła nowa rzecz
  const zU = ok(await s.ruch('agent-a', { op: op('zu'), co: 'poloz', rodzaj: 'zestaw/1', obszar: U, cechy: { nazwa: 'Agentów', wartosci: {} } })).rzecz;
  assert.equal(s.rzecz(ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zU })).rzecz).obszar ?? null, null);
  // 2. kopia w U, potem on chowa źródło do T (i je zmienia), a później naciska "wróć do domyślnego" na kopii
  const k = ok(await s.ruch('jozz', { op: op('k'), co: 'kopiuj', rzecz: zU, obszar: U, nazwa: 'Moja w U' })).rzecz;
  const zz = s.rzecz(zU);
  ok(await s.ruch('jozz', { op: op('chowa'), co: 'poloz', rzecz: zU, wersja: zz.wersja, rodzaj: 'zestaw/1', obszar: T, cechy: { ...zz.cechy, wartosci: { 'odczucie.ruch.natezenie': 7 } } }));
  const pytanie = await s.ruch('jozz', { op: op('dom'), co: 'domyslny', rzecz: k });
  assert.deepEqual([pytanie.status, pytanie.potwierdz], [409, 'publikuj'], JSON.stringify(pytanie));
  assert.deepEqual(s.rzecz(k).cechy.wartosci, {}, 'tajna treść nie przeszła do obszaru uczestników');
  const agent = await s.ruch('agent-a', { op: op('dom'), co: 'domyslny', rzecz: k });
  assert.equal(agent.status, 409, 'agent źródła już nie widzi: ' + JSON.stringify(agent));
  assert.ok(!JSON.stringify(agent).includes(zU), 'odmowa nie podaje identyfikatora schowanego źródła');
});

test('WA9. o pochodzenie pyta każdy odczyt rzeczy pod adresem, więc idzie po odniesieniu, a nie przez wszystkie pochodzenia w Miejscu', async () => {
  const db = new DatabaseSync(':memory:');
  let t = Date.UTC(2026, 10, 19, 21, 0, 0);
  const r = new Rdzen(sqlZNode(db), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const nowe = r.meta('obszar_nowe');
  const ids = [];
  for (let i = 0; i < 20; i++) ids.push(ok(await s.ruch('agent-a', { op: op('z'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe, cechy: { nazwa: 'z' + i, wartosci: {} } })).rzecz);
  const kopie = [];
  for (const id of ids) kopie.push(ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: id })).rzecz);
  const zapytania = (fn) => {
    const slad = [];
    const q = s.q;
    s.q = (z, ...p) => { slad.push([z, p]); return q.call(s, z, ...p); };
    try { fn(); } finally { delete s.q; }
    return slad.filter(([z, p]) => /pochodzenie|odniesienia/.test(z + JSON.stringify(p)));
  };
  for (const [nazwa, id] of [['zwykła rzecz', ids[3]], ['kopia', kopie[7]]]) {
    const slad = zapytania(() => s.pochodzenieDla(id, 'agent-a'));
    assert.ok(slad.length >= 1, nazwa + ': pytanie o pochodzenie w ogóle poszło');
    for (const [z, p] of slad) {
      const kroki = db.prepare('EXPLAIN QUERY PLAN ' + z).all(...p).map((k) => String(k.detail));
      assert.ok(!kroki.some((k) => k.startsWith('SCAN')), `${nazwa}: skan całej tabeli: ${z} | ${kroki.join(' | ')}`);
      assert.ok(!kroki.some((k) => /rzeczy_rodzaj/.test(k)), `${nazwa}: przegląd wszystkich rzeczy jednego rodzaju: ${z} | ${kroki.join(' | ')}`);
    }
  }
  assert.equal(s.pochodzenieDla(kopie[7], 'agent-a').z, ids[7], 'kontrola: ta sama odpowiedź co przed zmianą drogi');
  assert.equal(s.pochodzenieDla(ids[3], 'agent-a'), null);
});
