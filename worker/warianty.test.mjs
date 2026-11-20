// Warianty (19 XI 2026): jego presety na danych. Jego model jego słowami (18 XI 21:34 i 23:18, rejestr poz. 193 i 204):
// domyślny prowadzą agenci; on go kopiuje, nazywa swoim, psuje, zapisuje ciekawy układ, wraca do niego albo do
// domyślnego, a wszystkie jego presety odnoszą się do tego samego domyślnego, który agenci aktualizują bez jego zgody.
// Sprawdziany pytają z dwóch stron: że ruch robi to, co ma, i że nie robi tego, czego nie wolno (granica publikacji).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko, WSKAZUJA_NAJWIECEJ } from './srodowisko.mjs';
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
    // od 20 XI także pytanie o akty, którym pochodzenie urodziło się razem z kopią (drugi zamek, _pochodzenieKopii)
    return slad.filter(([z, p]) => /pochodzenie|odniesienia|akty/.test(z + JSON.stringify(p)));
  };
  for (const [nazwa, id] of [['zwykła rzecz', ids[3]], ['kopia', kopie[7]]]) {
    const slad = zapytania(() => s.pochodzenieDla(id, 'agent-a'));
    assert.ok(slad.length >= 1, nazwa + ': pytanie o pochodzenie w ogóle poszło');
    if (nazwa === 'kopia') assert.ok(slad.some(([z]) => /akty/.test(z)), 'kopia: pytanie o akty urodzenia poszło i też jest mierzone');
    for (const [z, p] of slad) {
      const kroki = db.prepare('EXPLAIN QUERY PLAN ' + z).all(...p).map((k) => String(k.detail));
      // "SCAN CONSTANT ROW" to SELECT bez FROM (dwa podzapytania obok siebie), nie przegląd tabeli
      assert.ok(!kroki.some((k) => k.startsWith('SCAN') && k !== 'SCAN CONSTANT ROW'), `${nazwa}: skan całej tabeli: ${z} | ${kroki.join(' | ')}`);
      assert.ok(!kroki.some((k) => /rzeczy_rodzaj/.test(k)), `${nazwa}: przegląd wszystkich rzeczy jednego rodzaju: ${z} | ${kroki.join(' | ')}`);
    }
  }
  assert.equal(s.pochodzenieDla(kopie[7], 'agent-a').z, ids[7], 'kontrola: ta sama odpowiedź co przed zmianą drogi');
  assert.equal(s.pochodzenieDla(ids[3], 'agent-a'), null);
});

// --- po niezależnym ataku (20 XI 2026, Commons narzedzia/atak-niezalezny-2026-11-20-warianty): 3 dziury i 3 uwagi -------

test('WA10. pochodzenie kładzie tylko kopiuj: ręką nikt go nie położy ani nie przepnie, także właściciel, więc "wróć do domyślnego" nie przeniesie cudzej treści na obszar (B11c)', async () => {
  const { s, nowe, D, obszar } = await swiat();
  const P = await obszar('Publiczny', 'wszyscy', 'prowadzic');
  const moja = ok(await s.ruch('agent-a', { op: op('m'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe, cechy: { nazwa: 'robocze agenta', wartosci: {} } })).rzecz;
  assert.equal(s.dla(null).rzecz(moja), null, 'kontrola: zwiedzający nie widzi rzeczy agenta');
  for (const [kto, cechy] of [['agent-a', { kopia: nowe, z: P, wersja: 1 }], ['jozz', { kopia: nowe, z: P, wersja: 1 }], ['agent-a', { kopia: moja, z: D, wersja: 1 }]]) {
    const w = await s.ruch(kto, { op: op('pod'), co: 'poloz', rodzaj: 'pochodzenie/1', cechy });
    assert.equal(w.status, 403, `${kto}: ${JSON.stringify(w)}`);
  }
  assert.equal(ile(s, 'pochodzenie/1'), 0, 'nic nie powstało');
  assert.equal(s.dla('jozz').pochodzenieDla(nowe), null, 'bez znaku "nowsze" na obszarze');
  const jego = await s.ruch('jozz', { op: op('d'), co: 'domyslny', rzecz: nowe });
  assert.notEqual(jego.skutek, 'domyslny-ze-zrodla', JSON.stringify(jego));
  assert.equal(s.ustawienie(nowe, 'widzi').wartosc, 'uczestnicy', 'ustawienia Nowych bez zmian');
  assert.equal(s.dla(null).rzecz(moja), null, 'zwiedzający dalej nie widzi rzeczy agenta');
  // pochodzenia z kopiuj nie da się przepiąć na inne źródło; odłożyć i przywrócić wolno
  const k = ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: D }));
  const p = s.rzecz(k.pochodzenie);
  const przepnij = await s.ruch('agent-a', { op: op('pp'), co: 'poloz', rzecz: p.id, wersja: p.wersja, rodzaj: 'pochodzenie/1', cechy: { ...p.cechy, z: moja } });
  assert.equal(przepnij.status, 403, JSON.stringify(przepnij));
  ok(await s.ruch('agent-a', { op: op('od'), co: 'odloz', rzecz: p.id, wersja: 'dowolna' }));
  assert.equal(s.pochodzenieDla(k.rzecz, 'agent-a'), null, 'odłożone pochodzenie nic nie mówi');
  ok(await s.ruch('agent-a', { op: op('pr'), co: 'przywroc', rzecz: p.id, wersja: 'dowolna' }));
  assert.equal(s.pochodzenieDla(k.rzecz, 'agent-a').z, D, 'kontrola: prawdziwe pochodzenie działa dalej');
});

test('WA11. drugi zamek: pochodzenie, które nie urodziło się razem z kopią jednym ruchem kopiuj, nie daje znaku "nowsze" ani powrotu do źródła', async () => {
  const { s, nowe, D } = await swiat();
  const X = ok(await s.ruch('agent-a', { op: op('x'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe, cechy: { nazwa: 'X', wartosci: {} } })).rzecz;
  // droga obok ruchów (przyszły wwóz albo błąd w innym ruchu): pochodzenie zapisane systemowo, ale osobną czynnością
  const cp = { kopia: X, z: D, wersja: 1 };
  const idP = await s._idZKlucza('pochodzenie/1', s.ksztaltDla('pochodzenie/1'), cp);
  ok(await s._zapiszWiele('agent-a', op('obok'), null, [{ nowa: true, rz: { id: idP }, rodzaj: 'pochodzenie/1', obszar: nowe, cechy: cp, odlozone: false, przed: 1, systemowe: true }], { skutek: 'proba' }));
  assert.ok(s.rzecz(idP), 'kontrola: pochodzenie leży');
  assert.equal(s.pochodzenieDla(X, 'jozz'), null, 'bez znaku "nowsze"');
  const d = await s.ruch('jozz', { op: op('d'), co: 'domyslny', rzecz: X });
  assert.notEqual(d.skutek, 'domyslny-ze-zrodla', JSON.stringify(d));
  assert.equal(s.rzecz(X).cechy.nazwa, 'X');
  // kontrola: kopia zrobiona ruchem kopiuj ma pochodzenie i znak
  const k = ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: D }));
  assert.equal(s.pochodzenieDla(k.rzecz, 'jozz').z, D);
});

test('WA12. publikacja jest skutkiem, nie gestem: powrót do punktu, cofnięcie i cofnięcie gestu, po których coś zobaczy więcej osób, pytają właściciela o publikuj, a agentowi odmawiają (A2b)', async () => {
  const { s, obszar } = await swiat();
  const P = await obszar('Publiczny', 'wszyscy', 'prowadzic');
  const T = await obszar('Tajny', 'wlasciciel', 'prowadzic');
  const U = await obszar('Uczestników', 'uczestnicy', 'prowadzic');
  // jego preset był publiczny; zapisał punkt, schował preset do T, zmienił go tam i dołożył przy nim tajny punkt
  const X = ok(await s.ruch('jozz', { op: op('x'), co: 'poloz', rodzaj: 'zestaw/1', obszar: P, cechy: { nazwa: 'Jego', wartosci: { 'odczucie.ruch.natezenie': 1 } } })).rzecz;
  const p1 = ok(await s.ruch('jozz', { op: op('p'), co: 'poloz', rodzaj: 'punkt/1', cechy: { nazwa: 'ładny', czego: X, wersja: s.rzecz(X).wersja } })).rzecz;
  const x = s.rzecz(X);
  ok(await s.ruch('jozz', { op: op('chowa'), co: 'poloz', rzecz: X, wersja: x.wersja, rodzaj: x.rodzaj, obszar: T, cechy: { ...x.cechy, wartosci: { 'odczucie.ruch.natezenie': 9 } } }));
  const tajny = ok(await s.ruch('jozz', { op: op('p'), co: 'poloz', rodzaj: 'punkt/1', cechy: { nazwa: 'TAJNY-PLAN', czego: X, wersja: s.rzecz(X).wersja } })).rzecz;
  const widac = () => [s.dla(null).rzecz(X) !== null, s.dla(null).rzecz(tajny) !== null, s.dla('agent-a').rzecz(tajny) !== null];
  assert.deepEqual(widac(), [false, false, false], 'kontrola przed');
  for (const ruch of [{ co: 'wroc-do-punktu', punkt: p1 }, { co: 'cofnij', rzecz: X, wersja: 'dowolna' }]) {
    const w = await s.ruch('jozz', { op: op('w'), ...ruch });
    assert.deepEqual([w.status, w.potwierdz], [409, 'publikuj'], JSON.stringify(w));
    assert.deepEqual(widac(), [false, false, false], `${ruch.co}: bez zgody nic nie wyszło`);
  }
  ok(await s.ruch('jozz', { op: op('w'), co: 'wroc-do-punktu', punkt: p1, publikuj: true }));
  assert.deepEqual(widac(), [true, true, true], 'z publikuj: true wychodzi świadomie, razem z tym, co leży przy nim');
  // kontrola: cofnięcie bez zmiany grona przechodzi bez pytania
  const Y = ok(await s.ruch('jozz', { op: op('y'), co: 'poloz', rodzaj: 'zestaw/1', obszar: U, cechy: { nazwa: 'Y', wartosci: {} } })).rzecz;
  const y = s.rzecz(Y);
  ok(await s.ruch('jozz', { op: op('y'), co: 'poloz', rzecz: Y, wersja: y.wersja, rodzaj: y.rodzaj, cechy: { ...y.cechy, nazwa: 'Y2' } }));
  ok(await s.ruch('jozz', { op: op('y'), co: 'cofnij', rzecz: Y, wersja: 'dowolna' }));
  assert.equal(s.rzecz(Y).cechy.nazwa, 'Y');
  // agent: ruch, po którym coś wyszłoby szerzej, dostaje odmowę, nie pytanie, także z publikuj: true
  const Z = ok(await s.ruch('agent-a', { op: op('z'), co: 'poloz', rodzaj: 'zestaw/1', obszar: P, cechy: { nazwa: 'Z agenta', wartosci: {} } })).rzecz;
  const z = s.rzecz(Z);
  ok(await s.ruch('agent-a', { op: op('z'), co: 'poloz', rzecz: Z, wersja: z.wersja, rodzaj: z.rodzaj, obszar: U, cechy: z.cechy }));
  const ag = await s.ruch('agent-a', { op: op('z'), co: 'cofnij', rzecz: Z, wersja: 'dowolna', publikuj: true });
  assert.equal(ag.status, 403, JSON.stringify(ag));
  assert.equal(s.dla(null).rzecz(Z), null, 'zwiedzający dalej nie widzi');
  // cofnięcie gestu, które wyniosłoby rzecz szerzej, też pyta
  const G = ok(await s.ruch('jozz', { op: op('g'), co: 'poloz', rodzaj: 'zestaw/1', obszar: P, cechy: { nazwa: 'G', wartosci: {} } })).rzecz;
  const g = s.rzecz(G);
  ok(await s.ruch('jozz', { op: op('g'), gest: 'wa12-gest-chowa', co: 'poloz', rzecz: G, wersja: g.wersja, rodzaj: g.rodzaj, obszar: T, cechy: g.cechy }));
  const cg = await s.ruch('jozz', { op: op('cg'), co: 'cofnij-gest', cofany: 'wa12-gest-chowa' });
  assert.deepEqual([cg.status, cg.potwierdz], [409, 'publikuj'], JSON.stringify(cg));
  assert.equal(s.dla(null).rzecz(G), null);
  ok(await s.ruch('jozz', { op: op('cg'), co: 'cofnij-gest', cofany: 'wa12-gest-chowa', publikuj: true }));
  assert.ok(s.dla(null).rzecz(G), 'po świadomym cofnięciu gestu znowu jawne');
  // obszar: cofnięcie zmiany jego widzi, po którym widzi go więcej osób (a z nim wszystko, co w nim leży), też pyta
  const O = await obszar('Otwarty', 'wszyscy', 'prowadzic');
  const o1 = s.rzecz(O);
  ok(await s.ruch('jozz', { op: op('o'), co: 'poloz', rzecz: O, wersja: o1.wersja, rodzaj: 'obszar/1', cechy: { ...o1.cechy, widzi: 'uczestnicy' } }));
  const oc = await s.ruch('jozz', { op: op('oc'), co: 'cofnij', rzecz: O, wersja: 'dowolna' });
  assert.deepEqual([oc.status, oc.potwierdz], [409, 'publikuj'], JSON.stringify(oc));
  assert.equal(s.ustawienie(O, 'widzi').wartosc, 'uczestnicy');
  // zła wartość publikuj nie przechodzi żadnym ruchem
  assert.equal((await s.ruch('jozz', { op: op('b'), co: 'cofnij', rzecz: Y, wersja: 'dowolna', publikuj: 'tak' })).status, 400);
});

test('WA13. odczyt źródła pod adresem kosztuje tyle samo przy 60 i 200 jego kopiach: "co na to wskazuje" ma górną granicę i nie pyta o każde odniesienie osobno (A6b)', async () => {
  let t = Date.UTC(2026, 10, 20, 1, 0, 0);
  const sql = sqlZNode();
  const miara = { zapytan: 0, wierszy: 0 };
  const licz = { exec: (q, ...p) => { miara.zapytan++; const a = sql.exec(q, ...p).toArray(); miara.wierszy += a.length; return { toArray: () => a }; } };
  const r = new Rdzen(licz, { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }));
  const nowe = r.meta('obszar_nowe');
  const D = ok(await s.ruch('agent-a', { op: op('d'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe, cechy: { nazwa: 'Domyślny', wartosci: {} } })).rzecz;
  const pytaj = async () => (await obsluzSrodowisko(s, new Request('https://proba.example/api/srodowisko/rzecz?id=' + D, { headers: { 'x-kto': 'agent-a' } }))).json();
  const zmierz = async () => { await pytaj(); const q0 = miara.zapytan, w0 = miara.wierszy; const o = await pytaj(); return { o, koszt: [miara.zapytan - q0, miara.wierszy - w0] }; };
  const kopie = [];
  const dokopiuj = async (do_) => { while (kopie.length < do_) kopie.push(ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: D })).rzecz); };
  const zero = await zmierz();
  await dokopiuj(3);
  const trzy = await zmierz();
  // kontrola: przy kilku odniesieniach lista jest pełna i w tej samej kolejności co dotąd (po identyfikatorze)
  const pelna = s.q(`SELECT od, cecha FROM odniesienia WHERE cel = ? ORDER BY od`, D).map(({ od, cecha }) => ({ od, cecha }));
  assert.deepEqual(trzy.o.wskazuja, pelna);
  assert.equal(trzy.o.wskazuja_wiecej, undefined);
  await dokopiuj(60);
  const szescdziesiat = await zmierz();
  await dokopiuj(200);
  const dwiescie = await zmierz();
  assert.equal(dwiescie.o.wskazuja.length, WSKAZUJA_NAJWIECEJ);
  assert.equal(dwiescie.o.wskazuja_wiecej, true);
  assert.deepEqual(dwiescie.koszt, szescdziesiat.koszt, `koszt [zapytań, wierszy] przy 60 i 200 kopiach: ${JSON.stringify([szescdziesiat.koszt, dwiescie.koszt])}`);
  assert.equal(dwiescie.koszt[0], zero.koszt[0], `liczba zapytań nie rośnie z kopiami: ${JSON.stringify([zero.koszt, dwiescie.koszt])}`);
  assert.ok(dwiescie.koszt[1] <= zero.koszt[1] + 2 * (WSKAZUJA_NAJWIECEJ + 1), 'wierszy najwyżej tyle, ile granica');
  // oczami zwiedzającego: odniesienia z obszaru, którego nie widzi, nie wychodzą (Nowe widzą tylko uczestnicy)
  assert.deepEqual(s.dla(null).wskazujaNa(D), []);
});

test('WA14. ponowienie to ten sam op i ta sama prośba: inne źródło, op z innego ruchu albo inny otwierający okno dają 409, nie cudzą kopię (uwagi A4e–A4g)', async () => {
  const { s, nowe, D } = await swiat();
  const E = ok(await s.ruch('agent-a', { op: op('e'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe, cechy: { nazwa: 'E', wartosci: {} } })).rzecz;
  const o = op('k');
  const k1 = ok(await s.ruch('agent-a', { op: o, co: 'kopiuj', rzecz: D }));
  const znowu = ok(await s.ruch('agent-a', { op: o, co: 'kopiuj', rzecz: D }));
  assert.deepEqual([znowu.powtorzone, znowu.rzecz], [true, k1.rzecz], 'kontrola: ta sama prośba oddaje tę samą kopię');
  const inne = await s.ruch('agent-a', { op: o, co: 'kopiuj', rzecz: E });
  assert.equal(inne.status, 409, JSON.stringify(inne));
  const kE = ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: E }));
  const e = s.rzecz(E);
  ok(await s.ruch('agent-a', { op: op('ez'), co: 'poloz', rzecz: E, wersja: e.wersja, rodzaj: e.rodzaj, cechy: { ...e.cechy, wartosci: { 'odczucie.ruch.natezenie': 5 } } }));
  const zlyOp = await s.ruch('agent-a', { op: o, co: 'domyslny', rzecz: kE.rzecz });
  assert.equal(zlyOp.status, 409, 'op zużyty przez kopiuj to inna czynność: ' + JSON.stringify(zlyOp));
  const od = op('dd');
  assert.equal(ok(await s.ruch('agent-a', { op: od, co: 'domyslny', rzecz: kE.rzecz })).skutek, 'domyslny-ze-zrodla');
  assert.equal(ok(await s.ruch('agent-a', { op: od, co: 'domyslny', rzecz: kE.rzecz })).powtorzone, true, 'kontrola: ponowienie tego samego powrotu');
  // okno: gość jest wspólny dla wszystkich otwierających, więc ten sam op drugiego otwierającego to inna prośba
  let t = Date.UTC(2026, 10, 20, 2, 0, 0);
  const r2 = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s2 = new Srodowisko(r2);
  await s2.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a', 'agent-b'] }));
  const gosc = s2.spis({ rodzaj: 'gosc/1', limit: 50 }).find((g) => g.cechy.umowa === 'okno/3').id;
  const nowe2 = r2.meta('obszar_nowe');
  const A = ok(await s2.ruch('agent-a', { op: op('a'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe2, cechy: { nazwa: 'A', wartosci: {} } })).rzecz;
  const B = ok(await s2.ruch('agent-b', { op: op('b'), co: 'poloz', rodzaj: 'zestaw/1', obszar: nowe2, cechy: { nazwa: 'B', wartosci: {} } })).rzecz;
  const wspolny = op('okno');
  const ka = ok(await s2.ruch('agent-a', { op: wspolny, co: 'kopiuj', rzecz: A }, { gosc }));
  const kb = await s2.ruch('agent-b', { op: wspolny, co: 'kopiuj', rzecz: B }, { gosc });
  assert.equal(kb.status, 409, JSON.stringify(kb));
  assert.notEqual(kb.rzecz, ka.rzecz, 'nie dostaje cudzej kopii');
  assert.equal(ok(await s2.ruch('agent-a', { op: wspolny, co: 'kopiuj', rzecz: A }, { gosc })).rzecz, ka.rzecz, 'kontrola: ten sam otwierający, ta sama prośba');
});

test('WA15. kopia wartości pokrętła nie psuje jego nazwy: dopisek "(kopia)" i własna nazwa trafiają tylko w tytuł, który jest nazwą (uwaga A4h)', async () => {
  const { s, nowe, D, obszar } = await swiat();
  const Z1 = await obszar('Szkic 1', 'uczestnicy', 'prowadzic');
  const Z2 = await obszar('Szkic 2', 'uczestnicy', 'prowadzic');
  const v = ok(await s.ruch('agent-a', { op: op('v'), co: 'poloz', rodzaj: 'wartosc/1', cechy: { pokretlo: 'odczucie.ruch.natezenie', zasieg: Z1, wartosc: 1 } })).rzecz;
  const k = ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: v, zmien: { zasieg: Z2 } }));
  assert.equal(s.rzecz(k.rzecz).cechy.pokretlo, 'odczucie.ruch.natezenie', 'nazwa pokrętła bez dopisku');
  assert.equal(s.rzecz(k.rzecz).obszar, Z2, 'kopia wartości leży w swoim zasięgu');
  const zNazwa = await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: v, nazwa: 'moja', zmien: { zasieg: nowe } });
  assert.equal(zNazwa.status, 422, JSON.stringify(zNazwa));
  // kontrola: zestaw (tytułem jest nazwa) dalej dostaje dopisek
  assert.equal(s.rzecz(ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: D })).rzecz).cechy.nazwa, 'Domyślny (kopia)');
});

test('WA16. warianty, których niezależny atak nie uruchomił: pochodzenia nie podrzuci się kształtowi ani cudzemu oknu, a okna i poświadczenia się nie kopiuje', async () => {
  const { s, r, D } = await swiat();
  const gosc = s.spis({ rodzaj: 'gosc/1', limit: 50 })[0];
  const okno = ok(await s.ruch('jozz', { op: op('ok'), co: 'poloz', rodzaj: 'okno/1', wersja: 'dowolna', cechy: { nazwa: 'Jego okno', czyje: 'jozz', gosc: gosc.id, otwarte: true } })).rzecz;
  const ksztalt = s.ksztaltDla('zestaw/1').id;
  const posw = ok(await s.ruch('jozz', { op: op('pw'), co: 'poloz', rodzaj: 'poswiadczenie/1', obszar: r.meta('obszar_drzwi'),
    cechy: { nazwa: 'telefon', imie: 'jozz', poswiadczenie: 'AAAAAAAAAAAAAAAAAAAAAA', klucz_publiczny: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', nazwa_strony: 'proba.example' } })).rzecz;
  // pochodzenie, które uzbroiłoby "wróć do domyślnego" na zastrzeżonych cechach kształtu albo na cudzym oknie
  for (const kto of ['agent-a', 'jozz']) for (const kopia of [ksztalt, okno]) {
    const w = await s.ruch(kto, { op: op('pod'), co: 'poloz', rodzaj: 'pochodzenie/1', cechy: { kopia, z: D, wersja: 1 } });
    assert.equal(w.ok, false, `${kto} -> ${kopia}: ${JSON.stringify(w)}`);
  }
  assert.equal(ile(s, 'pochodzenie/1'), 0);
  // okna i poświadczenia się nie kopiuje, niczyją ręką
  const okien = ile(s, 'okno/1'), poswiadczen = ile(s, 'poswiadczenie/1');
  for (const kto of ['agent-a', 'jozz']) for (const rzecz of [okno, posw]) {
    const w = await s.ruch(kto, { op: op('k'), co: 'kopiuj', rzecz });
    assert.equal(w.ok, false, `${kto} kopiuje ${rzecz}: ${JSON.stringify(w)}`);
  }
  assert.deepEqual([ile(s, 'okno/1'), ile(s, 'poswiadczenie/1')], [okien, poswiadczen], 'nic nie powstało');
});

test('WA14. przyjęcie propozycji przechodzi przez granicę publikacji: propozycja, która wynosi rzecz do szerszego grona, pyta właściciela o publikuj, także gdy obszar otwarto dopiero po jej złożeniu (atak 6, F4a i F4b)', async () => {
  const { s, obszar } = await swiat();
  const Q = await obszar('Q', 'uczestnicy', 'proponowac');
  const P = await obszar('P', 'wszyscy', 'prowadzic');
  // F4a: agent proponuje przeniesienie rzeczy z Q do P
  const X = ok(await s.ruch('jozz', { op: op('x'), co: 'poloz', rodzaj: 'zestaw/1', obszar: Q, cechy: { nazwa: 'dla uczestników', wartosci: {} } })).rzecz;
  const x = s.rzecz(X);
  const pr = ok(await s.ruch('agent-a', { op: op('mv'), co: 'poloz', rzecz: X, wersja: x.wersja, rodzaj: x.rodzaj, obszar: P, cechy: x.cechy }));
  assert.equal(pr.skutek, 'propozycja');
  const bez = await s.ruch('jozz', { op: op('prz'), co: 'przyjmij', propozycja: pr.propozycja });
  assert.deepEqual([bez.ok, bez.status, bez.potwierdz], [false, 409, 'publikuj']);
  assert.equal(s.dla(null).rzecz(X), null, 'bez potwierdzenia nic nie wychodzi');
  assert.equal(ok(await s.ruch('jozz', { op: op('prz'), co: 'przyjmij', propozycja: pr.propozycja, publikuj: true })).skutek, 'przyjeta');
  assert.ok(s.dla(null).rzecz(X), 'po potwierdzeniu rzecz jest jawna');
  // F4b: propozycja cofnięcia złożona, gdy niczego nie publikowała; potem właściciel otwiera obszar dawnej wersji
  const J = await obszar('J', 'uczestnicy', 'proponowac'), K = await obszar('K', 'uczestnicy', 'proponowac');
  const Y = ok(await s.ruch('jozz', { op: op('y'), co: 'poloz', rodzaj: 'zestaw/1', obszar: J, cechy: { nazwa: 'z czasu, gdy J było zamknięte', wartosci: {} } })).rzecz;
  const y = s.rzecz(Y), a1 = y.wersja;
  ok(await s.ruch('jozz', { op: op('mv'), co: 'poloz', rzecz: Y, wersja: y.wersja, rodzaj: y.rodzaj, obszar: K, cechy: { ...y.cechy, nazwa: 'w K' } }));
  const pc = ok(await s.ruch('agent-a', { op: op('cof'), co: 'cofnij', rzecz: Y, wersja: s.rzecz(Y).wersja, do: a1 }));
  assert.equal(pc.skutek, 'propozycja');
  const j = s.rzecz(J);
  ok(await s.ruch('jozz', { op: op('otw'), co: 'poloz', rzecz: J, wersja: j.wersja, rodzaj: j.rodzaj, obszar: j.obszar, cechy: { ...j.cechy, widzi: 'wszyscy' } }));
  const bez2 = await s.ruch('jozz', { op: op('prz'), co: 'przyjmij', propozycja: pc.propozycja });
  assert.deepEqual([bez2.ok, bez2.status, bez2.potwierdz], [false, 409, 'publikuj']);
  assert.equal(s.dla(null).rzecz(Y), null, 'dawna propozycja nie wynosi rzeczy do obszaru otwartego w międzyczasie');
  // kontrola drogi uczciwej: propozycja, która niczego nie wynosi, przyjmuje się jak dotąd
  const Z = ok(await s.ruch('jozz', { op: op('z'), co: 'poloz', rodzaj: 'zestaw/1', obszar: Q, cechy: { nazwa: 'zostaje w Q', wartosci: {} } })).rzecz;
  const zz = s.rzecz(Z);
  const pz = ok(await s.ruch('agent-a', { op: op('zm'), co: 'poloz', rzecz: Z, wersja: zz.wersja, rodzaj: zz.rodzaj, obszar: Q, cechy: { ...zz.cechy, nazwa: 'zmieniona' } }));
  assert.equal(pz.skutek, 'propozycja');
  assert.equal(ok(await s.ruch('jozz', { op: op('prz'), co: 'przyjmij', propozycja: pz.propozycja })).skutek, 'przyjeta');
});

test('WA15. "co na to wskazuje" liczy granicę po okularach czytającego: ukryte kopie nie stawiają znacznika i nie wypychają widocznych (atak 6, F3)', async () => {
  const { s, obszar, D } = await swiat();
  const T = await obszar('T', 'wlasciciel', 'prowadzic');
  ok(await s.ruch('agent-a', { op: op('k'), co: 'kopiuj', rzecz: D }));
  for (let i = 0; i < 60; i++) ok(await s.ruch('jozz', { op: op('kt'), co: 'kopiuj', rzecz: D, obszar: T, nazwa: 'prywatna ' + i }));
  const agent = s.dla('agent-a').wskazujaNa(D);
  assert.equal(agent.length, 1, 'agent widzi odniesienie swojej kopii');
  assert.equal(agent.wiecej, undefined, 'ukryte kopie nie stawiają znacznika');
  assert.deepEqual([...s.dla(null).wskazujaNa(D)], [], 'zwiedzający nie widzi żadnego');
  assert.equal(s.dla(null).wskazujaNa(D).wiecej, undefined);
  const wlasciciel = s.dla('jozz').wskazujaNa(D);
  assert.equal(wlasciciel.length, WSKAZUJA_NAJWIECEJ);
  assert.equal(wlasciciel.wiecej, true, 'właściciel widzi wszystko, więc u niego lista jest ucięta');
  // kontrola: gdy widocznych jest ponad granicę, znacznik stoi także u agenta
  for (let i = 0; i < WSKAZUJA_NAJWIECEJ + 1; i++) ok(await s.ruch('agent-a', { op: op('ka'), co: 'kopiuj', rzecz: D }));
  const agent2 = s.dla('agent-a').wskazujaNa(D);
  assert.equal(agent2.length, WSKAZUJA_NAJWIECEJ);
  assert.equal(agent2.wiecej, true);
});
